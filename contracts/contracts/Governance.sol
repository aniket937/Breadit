// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IBreadItCore.sol";
import "./libraries/BreadItErrors.sol";

/**
 * @title Governance
 * @author Bread-it Protocol
 * @notice DAO governance system for subreddit management
 * @dev Implements proposal creation, voting, and timelocked execution
 * 
 * GOVERNANCE MODEL:
 * - Each subreddit is governed independently
 * - Proposals can modify rules, elect/remove moderators, spend treasury
 * - Voting power is based on karma (reputation-weighted)
 * - Critical actions require supermajority and longer timelock
 * - No central admin can override DAO decisions
 * 
 * SECURITY:
 * - Quorum requirements prevent minority attacks
 * - Timelocks allow users to react before execution
 * - Supermajority for critical changes
 * - Karma-based voting prevents Sybil attacks
 */
contract Governance is IGovernance, ReentrancyGuard, AccessControl {
    using BreadItConstants for *;

    // ═══════════════════════════════════════════════════════════
    // STRUCTS (Extended)
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Extended proposal with execution data
    struct ProposalExtended {
        uint256 id;
        uint256 subredditId;
        ProposalType proposalType;
        address proposer;
        bytes data;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        uint256 executionTime;
        ProposalState state;
        bool executed;
        uint256 quorumRequired;
    }

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════
    
    /// @notice User registry for karma-based voting
    IUserRegistry public immutable userRegistry;
    
    /// @notice Subreddit DAO for executing proposals
    ISubredditDAO public subredditDAO;
    
    /// @notice Total proposals created
    uint256 public proposalCount;
    
    /// @notice Mapping from proposal ID to proposal
    mapping(uint256 => ProposalExtended) private _proposals;
    
    /// @notice Mapping from proposal ID to voter to has voted
    mapping(uint256 => mapping(address => bool)) private _hasVoted;
    
    /// @notice Mapping from proposal ID to voter to vote weight
    mapping(uint256 => mapping(address => uint256)) private _voteWeight;
    
    /// @notice Mapping from subreddit ID to active proposal IDs
    mapping(uint256 => uint256[]) private _subredditProposals;
    
    /// @notice Mapping from user to their proposals
    mapping(address => uint256[]) private _userProposals;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════
    
    event ProposalCancelled(uint256 indexed proposalId, address indexed canceller, string reason);
    event QuorumReached(uint256 indexed proposalId, uint256 totalVotes);

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════
    
    constructor(address _userRegistry) {
        if (_userRegistry == address(0)) {
            revert BreadItErrors.ZeroAddress();
        }
        userRegistry = IUserRegistry(_userRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Create a new governance proposal
     * @param subredditId The subreddit for this proposal
     * @param proposalType The type of proposal
     * @param data ABI-encoded proposal data
     * @return proposalId The ID of the created proposal
     * 
     * Requirements:
     * - Proposer must be registered member
     * - Proposer must have minimum karma to propose
     * - Must be a member of the subreddit
     * 
     * Data encoding by proposal type:
     * - RuleChange: abi.encode(minKarmaToPost, minKarmaToComment, postCooldown)
     * - ModeratorElection: abi.encode(candidateAddress)
     * - ModeratorRemoval: abi.encode(moderatorAddress, reason)
     * - TreasurySpend: abi.encode(recipient, amount, reason)
     * - ConfigChange: abi.encode(key, value)
     */
    function createProposal(
        uint256 subredditId,
        ProposalType proposalType,
        bytes calldata data
    ) external override nonReentrant returns (uint256) {
        // Validate proposer
        if (!userRegistry.isRegistered(msg.sender)) {
            revert BreadItErrors.UserNotRegistered(msg.sender);
        }
        
        if (userRegistry.isBanned(msg.sender)) {
            revert BreadItErrors.UserIsBanned(msg.sender);
        }
        
        int256 proposerKarma = userRegistry.getUserKarma(msg.sender);
        if (proposerKarma < BreadItConstants.MIN_KARMA_TO_PROPOSE) {
            revert BreadItErrors.InsufficientKarma(
                msg.sender, 
                BreadItConstants.MIN_KARMA_TO_PROPOSE, 
                proposerKarma
            );
        }
        
        // Validate subreddit membership
        if (!subredditDAO.isMember(msg.sender, subredditId)) {
            revert BreadItErrors.Unauthorized(msg.sender);
        }
        
        // Validate data
        if (data.length == 0) {
            revert BreadItErrors.InvalidProposalData();
        }
        
        proposalCount++;
        uint256 proposalId = proposalCount;
        
        // Determine voting period and quorum based on proposal type
        (uint256 votingPeriod, uint256 timelock, uint256 quorum) = _getProposalParameters(proposalType);
        
        _proposals[proposalId] = ProposalExtended({
            id: proposalId,
            subredditId: subredditId,
            proposalType: proposalType,
            proposer: msg.sender,
            data: data,
            forVotes: 0,
            againstVotes: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + votingPeriod,
            executionTime: block.timestamp + votingPeriod + timelock,
            state: ProposalState.Active,
            executed: false,
            quorumRequired: quorum
        });
        
        _subredditProposals[subredditId].push(proposalId);
        _userProposals[msg.sender].push(proposalId);
        
        emit ProposalCreated(
            proposalId, 
            subredditId, 
            proposalType, 
            msg.sender, 
            block.timestamp, 
            block.timestamp + votingPeriod
        );
        
        return proposalId;
    }
    
    /**
     * @notice Cast a vote on a proposal
     * @param proposalId The proposal to vote on
     * @param support True for yes, false for no
     * 
     * Requirements:
     * - Proposal must be active
     * - Voter must be registered and not banned
     * - Voter must be subreddit member
     * - Cannot vote twice
     * 
     * Voting Power:
     * - Based on voter's karma at time of vote
     * - Higher karma = more voting weight
     */
    function castVote(uint256 proposalId, bool support) external override nonReentrant {
        ProposalExtended storage proposal = _proposals[proposalId];
        
        if (proposal.id == 0) {
            revert BreadItErrors.ProposalNotFound(proposalId);
        }
        
        if (getProposalState(proposalId) != ProposalState.Active) {
            revert BreadItErrors.ProposalNotActive(proposalId);
        }
        
        if (_hasVoted[proposalId][msg.sender]) {
            revert BreadItErrors.AlreadyVotedOnProposal(proposalId, msg.sender);
        }
        
        // Validate voter
        if (!userRegistry.isRegistered(msg.sender)) {
            revert BreadItErrors.UserNotRegistered(msg.sender);
        }
        
        if (userRegistry.isBanned(msg.sender)) {
            revert BreadItErrors.UserIsBanned(msg.sender);
        }
        
        // Check subreddit membership
        if (!subredditDAO.isMember(msg.sender, proposal.subredditId)) {
            revert BreadItErrors.Unauthorized(msg.sender);
        }
        
        // Calculate voting weight based on karma
        int256 karma = userRegistry.getUserKarma(msg.sender);
        uint256 weight = _calculateVotingWeight(karma);
        
        if (weight == 0) {
            revert BreadItErrors.InsufficientVotingPower(msg.sender);
        }
        
        _hasVoted[proposalId][msg.sender] = true;
        _voteWeight[proposalId][msg.sender] = weight;
        
        if (support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }
        
        emit ProposalVoted(proposalId, msg.sender, support, weight);
        
        // Check if quorum reached
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        uint256 memberCount = subredditDAO.memberCount(proposal.subredditId);
        uint256 quorumVotes = (memberCount * proposal.quorumRequired) / 100;
        
        if (totalVotes >= quorumVotes) {
            emit QuorumReached(proposalId, totalVotes);
        }
    }
    
    /**
     * @notice Execute a successful proposal after timelock
     * @param proposalId The proposal to execute
     * 
     * Requirements:
     * - Proposal must have succeeded
     * - Timelock must have passed
     * - Cannot execute twice
     */
    function executeProposal(uint256 proposalId) external override nonReentrant {
        ProposalExtended storage proposal = _proposals[proposalId];
        
        if (proposal.id == 0) {
            revert BreadItErrors.ProposalNotFound(proposalId);
        }
        
        if (proposal.executed) {
            revert BreadItErrors.ProposalAlreadyExecuted(proposalId);
        }
        
        ProposalState state = getProposalState(proposalId);
        if (state != ProposalState.Succeeded) {
            revert BreadItErrors.ProposalNotSucceeded(proposalId);
        }
        
        if (block.timestamp < proposal.executionTime) {
            revert BreadItErrors.TimelockNotPassed(proposalId, proposal.executionTime);
        }
        
        proposal.executed = true;
        proposal.state = ProposalState.Executed;
        
        _executeProposalAction(proposal);
        
        emit ProposalExecuted(proposalId, block.timestamp);
    }
    
    /**
     * @notice Get a proposal's details
     * @param proposalId The proposal ID
     * @return The proposal struct (basic interface version)
     */
    function getProposal(uint256 proposalId) external view override returns (Proposal memory) {
        ProposalExtended storage p = _proposals[proposalId];
        if (p.id == 0) {
            revert BreadItErrors.ProposalNotFound(proposalId);
        }
        
        return Proposal({
            id: p.id,
            subredditId: p.subredditId,
            proposalType: p.proposalType,
            proposer: p.proposer,
            data: p.data,
            forVotes: p.forVotes,
            againstVotes: p.againstVotes,
            startTime: p.startTime,
            endTime: p.endTime,
            executionTime: p.executionTime,
            state: getProposalState(proposalId)
        });
    }
    
    /**
     * @notice Get extended proposal details
     * @param proposalId The proposal ID
     * @return The extended proposal struct
     */
    function getProposalExtended(uint256 proposalId) external view returns (ProposalExtended memory) {
        if (_proposals[proposalId].id == 0) {
            revert BreadItErrors.ProposalNotFound(proposalId);
        }
        
        ProposalExtended memory p = _proposals[proposalId];
        p.state = getProposalState(proposalId);
        return p;
    }
    
    /**
     * @notice Get current state of a proposal
     * @param proposalId The proposal ID
     * @return The proposal state
     */
    function getProposalState(uint256 proposalId) public view override returns (ProposalState) {
        ProposalExtended storage proposal = _proposals[proposalId];
        
        if (proposal.id == 0) {
            revert BreadItErrors.ProposalNotFound(proposalId);
        }
        
        if (proposal.executed) {
            return ProposalState.Executed;
        }
        
        if (block.timestamp < proposal.endTime) {
            return ProposalState.Active;
        }
        
        // Voting ended - check outcome
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        uint256 memberCount = subredditDAO.memberCount(proposal.subredditId);
        uint256 quorumVotes = (memberCount * proposal.quorumRequired) / 100;
        
        // Check quorum
        if (totalVotes < quorumVotes) {
            return ProposalState.Defeated;
        }
        
        // Check supermajority for critical proposals
        bool isCritical = proposal.proposalType == ProposalType.ModeratorRemoval ||
                         proposal.proposalType == ProposalType.TreasurySpend;
        
        uint256 requiredPercentage = isCritical ? BreadItConstants.SUPERMAJORITY : 50;
        uint256 forPercentage = (proposal.forVotes * 100) / totalVotes;
        
        if (forPercentage > requiredPercentage) {
            // Check if execution window expired (proposals expire 7 days after voting ends)
            if (block.timestamp > proposal.executionTime + 7 days) {
                return ProposalState.Expired;
            }
            return ProposalState.Succeeded;
        }
        
        return ProposalState.Defeated;
    }
    
    /**
     * @notice Get proposals for a subreddit
     * @param subredditId The subreddit ID
     * @param offset Starting index
     * @param limit Maximum proposals to return
     * @return proposalIds Array of proposal IDs
     */
    function getSubredditProposals(
        uint256 subredditId,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256[] storage proposals = _subredditProposals[subredditId];
        
        if (offset >= proposals.length) {
            return new uint256[](0);
        }
        
        uint256 end = offset + limit;
        if (end > proposals.length) {
            end = proposals.length;
        }
        
        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = proposals[i];
        }
        
        return result;
    }
    
    /**
     * @notice Check if a user has voted on a proposal
     * @param proposalId The proposal ID
     * @param voter The voter address
     * @return hasVoted Whether they voted
     * @return weight Their vote weight
     */
    function getVoterInfo(
        uint256 proposalId, 
        address voter
    ) external view returns (bool hasVoted, uint256 weight) {
        return (_hasVoted[proposalId][voter], _voteWeight[proposalId][voter]);
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Set subreddit DAO contract
     * @param _subredditDAO The subreddit DAO address
     */
    function setSubredditDAO(address _subredditDAO) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_subredditDAO == address(0)) {
            revert BreadItErrors.ZeroAddress();
        }
        subredditDAO = ISubredditDAO(_subredditDAO);
    }

    // ═══════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Get voting parameters based on proposal type
     * @param proposalType The type of proposal
     * @return votingPeriod Voting duration
     * @return timelock Execution delay
     * @return quorum Required quorum percentage
     */
    function _getProposalParameters(
        ProposalType proposalType
    ) internal pure returns (uint256 votingPeriod, uint256 timelock, uint256 quorum) {
        if (proposalType == ProposalType.ModeratorRemoval || 
            proposalType == ProposalType.TreasurySpend) {
            // Critical proposals
            return (
                BreadItConstants.CRITICAL_VOTING_PERIOD,
                BreadItConstants.CRITICAL_TIMELOCK,
                BreadItConstants.CRITICAL_QUORUM
            );
        } else {
            // Standard proposals
            return (
                BreadItConstants.STANDARD_VOTING_PERIOD,
                BreadItConstants.STANDARD_TIMELOCK,
                BreadItConstants.STANDARD_QUORUM
            );
        }
    }
    
    /**
     * @notice Calculate voting weight from karma
     * @param karma The user's karma
     * @return weight The voting weight
     * 
     * Voting weight curve:
     * - Negative karma: 0 weight
     * - 0-99 karma: 1 weight
     * - 100-499 karma: 2 weight
     * - 500-999 karma: 3 weight
     * - 1000+ karma: 4 weight + 1 per additional 1000
     */
    function _calculateVotingWeight(int256 karma) internal pure returns (uint256) {
        if (karma <= 0) {
            return 0;
        }
        
        uint256 positiveKarma = uint256(karma);
        
        if (positiveKarma < 100) {
            return 1;
        } else if (positiveKarma < 500) {
            return 2;
        } else if (positiveKarma < 1000) {
            return 3;
        } else {
            return 4 + (positiveKarma / 1000);
        }
    }
    
    /**
     * @notice Execute the action specified in a proposal
     * @param proposal The proposal to execute
     */
    function _executeProposalAction(ProposalExtended storage proposal) internal {
        if (proposal.proposalType == ProposalType.RuleChange) {
            _executeRuleChange(proposal);
        } else if (proposal.proposalType == ProposalType.ModeratorElection) {
            _executeModeratorElection(proposal);
        } else if (proposal.proposalType == ProposalType.ModeratorRemoval) {
            _executeModeratorRemoval(proposal);
        } else if (proposal.proposalType == ProposalType.TreasurySpend) {
            _executeTreasurySpend(proposal);
        } else if (proposal.proposalType == ProposalType.ConfigChange) {
            _executeConfigChange(proposal);
        }
    }
    
    function _executeRuleChange(ProposalExtended storage proposal) internal {
        (int256 minKarmaToPost, int256 minKarmaToComment, uint256 postCooldown) = 
            abi.decode(proposal.data, (int256, int256, uint256));
        
        subredditDAO.updateConfig(
            proposal.subredditId,
            minKarmaToPost,
            minKarmaToComment,
            postCooldown
        );
    }
    
    function _executeModeratorElection(ProposalExtended storage proposal) internal {
        address candidate = abi.decode(proposal.data, (address));
        subredditDAO.addModerator(proposal.subredditId, candidate, proposal.forVotes);
    }
    
    function _executeModeratorRemoval(ProposalExtended storage proposal) internal {
        (address moderator, string memory reason) = abi.decode(proposal.data, (address, string));
        subredditDAO.removeModerator(proposal.subredditId, moderator, reason);
    }
    
    function _executeTreasurySpend(ProposalExtended storage proposal) internal {
        (address recipient, uint256 amount, string memory reason) = 
            abi.decode(proposal.data, (address, uint256, string));
        subredditDAO.withdrawTreasury(proposal.subredditId, recipient, amount, reason);
    }
    
    function _executeConfigChange(ProposalExtended storage proposal) internal {
        // Generic config change - decode as rules update
        bytes memory newRules = proposal.data;
        subredditDAO.updateRules(proposal.subredditId, newRules);
    }
}
