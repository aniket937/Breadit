// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IBreadItCore.sol";
import "./libraries/BreadItErrors.sol";

/**
 * @title SubredditDAO
 * @author Bread-it Protocol
 * @notice Factory and registry for decentralized subreddit communities
 * @dev Each subreddit operates as an independent DAO with its own governance
 * 
 * ARCHITECTURE:
 * - This contract is a factory that creates and manages subreddit configurations
 * - Each subreddit has its own rules, karma thresholds, and moderator list
 * - Governance is handled by the separate Governance contract
 * - No global admin can override subreddit-level decisions
 * 
 * SECURITY CONSIDERATIONS:
 * - Subreddit creation requires payment (anti-spam)
 * - Creator is initial moderator but can be removed via governance
 * - All rule changes must go through governance proposals
 * - Moderator elections prevent centralized control
 */
contract SubredditDAO is ISubredditDAO, ReentrancyGuard, AccessControl {
    using BreadItConstants for *;

    // ═══════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Role for governance contract to execute proposals
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    /// @notice Role for post manager to check permissions
    bytes32 public constant POST_MANAGER_ROLE = keccak256("POST_MANAGER_ROLE");

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════
    
    /// @notice User registry for karma checks
    IUserRegistry public immutable userRegistry;
    
    /// @notice Total subreddits created
    uint256 public subredditCount;
    
    /// @notice Mapping from subreddit ID to config
    mapping(uint256 => SubredditConfig) private _subreddits;
    
    /// @notice Mapping from subreddit name to ID (for uniqueness)
    mapping(bytes32 => uint256) private _nameToId;
    
    /// @notice Mapping from subreddit ID to moderator list
    mapping(uint256 => address[]) private _moderators;
    
    /// @notice Mapping from subreddit ID to moderator status
    mapping(uint256 => mapping(address => Moderator)) private _moderatorInfo;
    
    /// @notice Mapping from subreddit ID to rules (stored as bytes)
    mapping(uint256 => bytes) private _rules;
    
    /// @notice Treasury balance per subreddit
    mapping(uint256 => uint256) public treasuryBalance;
    
    /// @notice Protocol treasury (receives portion of fees)
    address public protocolTreasury;
    
    /// @notice Mapping subreddit ID to member count (for governance weight)
    mapping(uint256 => uint256) public memberCount;
    
    /// @notice Mapping user -> subreddit -> joined status
    mapping(address => mapping(uint256 => bool)) public isMember;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════
    
    event MemberJoined(uint256 indexed subredditId, address indexed member, uint256 timestamp);
    event MemberLeft(uint256 indexed subredditId, address indexed member, uint256 timestamp);
    event TreasuryDeposit(uint256 indexed subredditId, address indexed from, uint256 amount);
    event TreasuryWithdraw(uint256 indexed subredditId, address indexed to, uint256 amount, string reason);
    event RulesUpdated(uint256 indexed subredditId, uint256 timestamp);

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════
    
    constructor(address _userRegistry, address _protocolTreasury) {
        if (_userRegistry == address(0) || _protocolTreasury == address(0)) {
            revert BreadItErrors.ZeroAddress();
        }
        userRegistry = IUserRegistry(_userRegistry);
        protocolTreasury = _protocolTreasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Create a new subreddit community
     * @param name The subreddit name (unique, bytes32)
     * @param description Community description
     * @param minKarmaToPost Minimum karma required to post
     * @param minKarmaToComment Minimum karma required to comment
     * @param postCooldown Cooldown between posts in seconds
     * @return subredditId The ID of the created subreddit
     * 
     * Requirements:
     * - Caller must be registered user
     * - Must pay creation fee
     * - Name must be unique and valid
     * 
     * Effects:
     * - Creates subreddit with caller as initial moderator
     * - Splits creation fee between protocol and subreddit treasury
     */
    function createSubreddit(
        bytes32 name,
        bytes calldata description,
        int256 minKarmaToPost,
        int256 minKarmaToComment,
        uint256 postCooldown
    ) external payable override nonReentrant returns (uint256) {
        // Validate sender
        if (!userRegistry.isRegistered(msg.sender)) {
            revert BreadItErrors.UserNotRegistered(msg.sender);
        }
        
        if (userRegistry.isBanned(msg.sender)) {
            revert BreadItErrors.UserIsBanned(msg.sender);
        }
        
        // Validate payment
        if (msg.value < BreadItConstants.SUBREDDIT_CREATION_COST) {
            revert BreadItErrors.InsufficientStake(msg.value, BreadItConstants.SUBREDDIT_CREATION_COST);
        }
        
        // Validate name
        if (name == bytes32(0)) {
            revert BreadItErrors.InvalidSubredditName();
        }
        
        if (_nameToId[name] != 0) {
            revert BreadItErrors.SubredditNameTaken(name);
        }
        
        // Validate description length
        if (description.length > BreadItConstants.MAX_DESCRIPTION_LENGTH) {
            revert BreadItErrors.BodyTooLong(description.length, BreadItConstants.MAX_DESCRIPTION_LENGTH);
        }
        
        // Create subreddit
        subredditCount++;
        uint256 subredditId = subredditCount;
        
        _subreddits[subredditId] = SubredditConfig({
            id: subredditId,
            name: name,
            description: description,
            creator: msg.sender,
            createdAt: block.timestamp,
            minKarmaToPost: minKarmaToPost,
            minKarmaToComment: minKarmaToComment,
            minKarmaToVote: BreadItConstants.DEFAULT_MIN_KARMA_TO_VOTE,
            postCooldown: postCooldown > 0 ? postCooldown : BreadItConstants.BASE_POST_COOLDOWN,
            commentCooldown: BreadItConstants.BASE_COMMENT_COOLDOWN,
            isActive: true
        });
        
        _nameToId[name] = subredditId;
        
        // Set creator as initial moderator
        _moderators[subredditId].push(msg.sender);
        _moderatorInfo[subredditId][msg.sender] = Moderator({
            wallet: msg.sender,
            appointedAt: block.timestamp,
            votesReceived: 0,
            isActive: true
        });
        
        // Creator auto-joins
        isMember[msg.sender][subredditId] = true;
        memberCount[subredditId] = 1;
        
        // Split fees: 50% protocol, 50% subreddit treasury
        uint256 protocolShare = msg.value / 2;
        uint256 subredditShare = msg.value - protocolShare;
        
        treasuryBalance[subredditId] = subredditShare;
        
        // Transfer protocol share
        (bool success, ) = protocolTreasury.call{value: protocolShare}("");
        if (!success) {
            revert BreadItErrors.TransferFailed();
        }
        
        emit SubredditCreated(subredditId, name, msg.sender, block.timestamp);
        emit MemberJoined(subredditId, msg.sender, block.timestamp);
        emit TreasuryDeposit(subredditId, msg.sender, subredditShare);
        
        return subredditId;
    }
    
    /**
     * @notice Join a subreddit community
     * @param subredditId The subreddit to join
     */
    function joinSubreddit(uint256 subredditId) external {
        if (_subreddits[subredditId].id == 0) {
            revert BreadItErrors.SubredditNotFound(subredditId);
        }
        
        if (!_subreddits[subredditId].isActive) {
            revert BreadItErrors.SubredditInactive(subredditId);
        }
        
        if (!userRegistry.isRegistered(msg.sender)) {
            revert BreadItErrors.UserNotRegistered(msg.sender);
        }
        
        if (!isMember[msg.sender][subredditId]) {
            isMember[msg.sender][subredditId] = true;
            memberCount[subredditId]++;
            emit MemberJoined(subredditId, msg.sender, block.timestamp);
        }
    }
    
    /**
     * @notice Leave a subreddit community
     * @param subredditId The subreddit to leave
     */
    function leaveSubreddit(uint256 subredditId) external {
        if (isMember[msg.sender][subredditId]) {
            isMember[msg.sender][subredditId] = false;
            memberCount[subredditId]--;
            emit MemberLeft(subredditId, msg.sender, block.timestamp);
        }
    }
    
    /**
     * @notice Get subreddit configuration
     * @param subredditId The subreddit ID
     * @return The subreddit configuration
     */
    function getSubreddit(uint256 subredditId) external view override returns (SubredditConfig memory) {
        if (_subreddits[subredditId].id == 0) {
            revert BreadItErrors.SubredditNotFound(subredditId);
        }
        return _subreddits[subredditId];
    }
    
    /**
     * @notice Check if an address is a moderator
     * @param subredditId The subreddit ID
     * @param wallet The address to check
     * @return True if moderator, false otherwise
     */
    function isModerator(uint256 subredditId, address wallet) external view override returns (bool) {
        return _moderatorInfo[subredditId][wallet].isActive;
    }
    
    /**
     * @notice Get all active moderators for a subreddit
     * @param subredditId The subreddit ID
     * @return Array of moderator addresses
     */
    function getModerators(uint256 subredditId) external view override returns (address[] memory) {
        address[] storage mods = _moderators[subredditId];
        uint256 activeCount = 0;
        
        // Count active moderators
        for (uint256 i = 0; i < mods.length; i++) {
            if (_moderatorInfo[subredditId][mods[i]].isActive) {
                activeCount++;
            }
        }
        
        // Build result array
        address[] memory activeMods = new address[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < mods.length; i++) {
            if (_moderatorInfo[subredditId][mods[i]].isActive) {
                activeMods[idx] = mods[i];
                idx++;
            }
        }
        
        return activeMods;
    }
    
    /**
     * @notice Check if a user can post in a subreddit
     * @param subredditId The subreddit ID
     * @param wallet The user's wallet
     * @return True if user can post
     */
    function canUserPost(uint256 subredditId, address wallet) external view override returns (bool) {
        SubredditConfig storage config = _subreddits[subredditId];
        
        if (config.id == 0 || !config.isActive) {
            return false;
        }
        
        if (!userRegistry.isRegistered(wallet) || userRegistry.isBanned(wallet)) {
            return false;
        }
        
        int256 userKarma = userRegistry.getUserKarma(wallet);
        return userKarma >= config.minKarmaToPost;
    }
    
    /**
     * @notice Check if a user can comment in a subreddit
     * @param subredditId The subreddit ID
     * @param wallet The user's wallet
     * @return True if user can comment
     */
    function canUserComment(uint256 subredditId, address wallet) external view override returns (bool) {
        SubredditConfig storage config = _subreddits[subredditId];
        
        if (config.id == 0 || !config.isActive) {
            return false;
        }
        
        if (!userRegistry.isRegistered(wallet) || userRegistry.isBanned(wallet)) {
            return false;
        }
        
        int256 userKarma = userRegistry.getUserKarma(wallet);
        return userKarma >= config.minKarmaToComment;
    }
    
    /**
     * @notice Get subreddit rules
     * @param subredditId The subreddit ID
     * @return The rules as bytes
     */
    function getRules(uint256 subredditId) external view returns (bytes memory) {
        return _rules[subredditId];
    }
    
    /**
     * @notice Get subreddit ID by name
     * @param name The subreddit name
     * @return The subreddit ID (0 if not found)
     */
    function getSubredditIdByName(bytes32 name) external view returns (uint256) {
        return _nameToId[name];
    }
    
    // ═══════════════════════════════════════════════════════════
    // GOVERNANCE FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Add a new moderator (governance only)
     * @param subredditId The subreddit ID
     * @param moderator The address to add as moderator
     * @param votes The votes received in election
     */
    function addModerator(
        uint256 subredditId, 
        address moderator, 
        uint256 votes
    ) external onlyRole(GOVERNANCE_ROLE) {
        if (_subreddits[subredditId].id == 0) {
            revert BreadItErrors.SubredditNotFound(subredditId);
        }
        
        if (_moderatorInfo[subredditId][moderator].isActive) {
            revert BreadItErrors.AlreadyModerator(subredditId, moderator);
        }
        
        if (_moderators[subredditId].length >= BreadItConstants.MAX_MODERATORS) {
            revert BreadItErrors.InvalidAmount();
        }
        
        _moderators[subredditId].push(moderator);
        _moderatorInfo[subredditId][moderator] = Moderator({
            wallet: moderator,
            appointedAt: block.timestamp,
            votesReceived: votes,
            isActive: true
        });
        
        emit ModeratorElected(subredditId, moderator, votes, block.timestamp);
    }
    
    /**
     * @notice Remove a moderator (governance only)
     * @param subredditId The subreddit ID
     * @param moderator The moderator to remove
     * @param reason The reason for removal
     */
    function removeModerator(
        uint256 subredditId, 
        address moderator, 
        string calldata reason
    ) external onlyRole(GOVERNANCE_ROLE) {
        if (!_moderatorInfo[subredditId][moderator].isActive) {
            revert BreadItErrors.NotModerator(subredditId, moderator);
        }
        
        _moderatorInfo[subredditId][moderator].isActive = false;
        
        emit ModeratorRemoved(subredditId, moderator, reason, block.timestamp);
    }
    
    /**
     * @notice Update subreddit configuration (governance only)
     * @param subredditId The subreddit ID
     * @param minKarmaToPost New minimum karma to post
     * @param minKarmaToComment New minimum karma to comment
     * @param postCooldown New post cooldown
     */
    function updateConfig(
        uint256 subredditId,
        int256 minKarmaToPost,
        int256 minKarmaToComment,
        uint256 postCooldown
    ) external onlyRole(GOVERNANCE_ROLE) {
        SubredditConfig storage config = _subreddits[subredditId];
        
        if (config.id == 0) {
            revert BreadItErrors.SubredditNotFound(subredditId);
        }
        
        bytes memory oldValue = abi.encode(config.minKarmaToPost, config.minKarmaToComment, config.postCooldown);
        
        config.minKarmaToPost = minKarmaToPost;
        config.minKarmaToComment = minKarmaToComment;
        config.postCooldown = postCooldown;
        
        bytes memory newValue = abi.encode(minKarmaToPost, minKarmaToComment, postCooldown);
        
        emit RuleChanged(subredditId, "config", oldValue, newValue, block.timestamp);
    }
    
    /**
     * @notice Update subreddit rules (governance only)
     * @param subredditId The subreddit ID
     * @param rules New rules
     */
    function updateRules(
        uint256 subredditId, 
        bytes calldata rules
    ) external onlyRole(GOVERNANCE_ROLE) {
        if (_subreddits[subredditId].id == 0) {
            revert BreadItErrors.SubredditNotFound(subredditId);
        }
        
        if (rules.length > BreadItConstants.MAX_RULES_LENGTH) {
            revert BreadItErrors.BodyTooLong(rules.length, BreadItConstants.MAX_RULES_LENGTH);
        }
        
        _rules[subredditId] = rules;
        emit RulesUpdated(subredditId, block.timestamp);
    }
    
    /**
     * @notice Withdraw from subreddit treasury (governance only)
     * @param subredditId The subreddit ID
     * @param recipient The recipient address
     * @param amount The amount to withdraw
     * @param reason The reason for withdrawal
     */
    function withdrawTreasury(
        uint256 subredditId,
        address recipient,
        uint256 amount,
        string calldata reason
    ) external onlyRole(GOVERNANCE_ROLE) nonReentrant {
        if (recipient == address(0)) {
            revert BreadItErrors.InvalidRecipient();
        }
        
        if (treasuryBalance[subredditId] < amount) {
            revert BreadItErrors.InsufficientTreasuryBalance(amount, treasuryBalance[subredditId]);
        }
        
        treasuryBalance[subredditId] -= amount;
        
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert BreadItErrors.TransferFailed();
        }
        
        emit TreasuryWithdraw(subredditId, recipient, amount, reason);
    }
    
    /**
     * @notice Deposit to subreddit treasury
     * @param subredditId The subreddit ID
     */
    function depositTreasury(uint256 subredditId) external payable {
        if (_subreddits[subredditId].id == 0) {
            revert BreadItErrors.SubredditNotFound(subredditId);
        }
        
        treasuryBalance[subredditId] += msg.value;
        emit TreasuryDeposit(subredditId, msg.sender, msg.value);
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Set governance contract
     * @param governance The governance contract address
     */
    function setGovernance(address governance) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (governance == address(0)) {
            revert BreadItErrors.ZeroAddress();
        }
        _grantRole(GOVERNANCE_ROLE, governance);
    }
    
    /**
     * @notice Set post manager contract
     * @param postManager The post manager contract address
     */
    function setPostManager(address postManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (postManager == address(0)) {
            revert BreadItErrors.ZeroAddress();
        }
        _grantRole(POST_MANAGER_ROLE, postManager);
    }
    
    /**
     * @notice Update protocol treasury address
     * @param newTreasury The new treasury address
     */
    function setProtocolTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) {
            revert BreadItErrors.ZeroAddress();
        }
        protocolTreasury = newTreasury;
    }
    
    /**
     * @notice Emergency: Deactivate a subreddit (should be rare)
     * @param subredditId The subreddit ID
     * @param active Whether to activate or deactivate
     */
    function setSubredditActive(
        uint256 subredditId, 
        bool active
    ) external onlyRole(GOVERNANCE_ROLE) {
        if (_subreddits[subredditId].id == 0) {
            revert BreadItErrors.SubredditNotFound(subredditId);
        }
        _subreddits[subredditId].isActive = active;
    }
    
    // ═══════════════════════════════════════════════════════════
    // RECEIVE
    // ═══════════════════════════════════════════════════════════
    
    receive() external payable {
        // Accept ETH for protocol treasury
    }
}
