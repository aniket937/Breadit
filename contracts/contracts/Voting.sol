// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IBreadItCore.sol";
import "./libraries/BreadItErrors.sol";

/**
 * @title Voting
 * @author Bread-it Protocol
 * @notice Stake-based voting system with anti-spam and karma integration
 * @dev Implements economic disincentives for abuse and spam voting
 * 
 * VOTING MECHANICS:
 * - Voting requires staking native tokens
 * - Downvotes cost more than upvotes (economic disincentive for negativity)
 * - One vote per user per content item
 * - Votes affect both content score and author karma
 * - Stakes are locked for a period and can be slashed
 * 
 * ANTI-ABUSE MEASURES:
 * - Self-voting is prevented
 * - Stake requirements create economic cost for vote brigading
 * - Time-based voting window prevents vote manipulation on old content
 * - Karma-weighted voting power prevents Sybil attacks
 */
contract Voting is IVoting, ReentrancyGuard, AccessControl {
    using BreadItConstants for *;

    // ═══════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Role for moderation to slash stakes
    bytes32 public constant MODERATION_ROLE = keccak256("MODERATION_ROLE");

    // ═══════════════════════════════════════════════════════════
    // STRUCTS
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Extended vote info with withdrawal tracking
    struct VoteInfo {
        VoteType voteType;
        uint256 stake;
        uint256 timestamp;
        bool withdrawn;
        bool slashed;
    }

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════
    
    /// @notice User registry contract
    IUserRegistry public immutable userRegistry;
    
    /// @notice Post manager contract
    IPostManager public postManager;
    
    /// @notice Subreddit DAO contract
    ISubredditDAO public subredditDAO;
    
    /// @notice Mapping: contentId => isPost => voter => vote info
    mapping(uint256 => mapping(bool => mapping(address => VoteInfo))) private _votes;
    
    /// @notice Mapping: contentId => isPost => total score
    mapping(uint256 => mapping(bool => int256)) private _scores;
    
    /// @notice Mapping: contentId => isPost => upvote count
    mapping(uint256 => mapping(bool => uint256)) private _upvoteCount;
    
    /// @notice Mapping: contentId => isPost => downvote count
    mapping(uint256 => mapping(bool => uint256)) private _downvoteCount;
    
    /// @notice Total staked in voting system
    uint256 public totalStaked;
    
    /// @notice Slashed stakes treasury
    uint256 public slashedStakesTreasury;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════
    
    event StakeWithdrawn(
        uint256 indexed contentId,
        bool isPost,
        address indexed voter,
        uint256 amount
    );
    
    event StakeSlashed(
        uint256 indexed contentId,
        bool isPost,
        address indexed voter,
        uint256 amount,
        string reason
    );

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
     * @notice Vote on a post or comment
     * @param contentId The ID of the post or comment
     * @param isPost Whether this is a post (true) or comment (false)
     * @param voteType Upvote or Downvote
     * 
     * Requirements:
     * - User must be registered and not banned
     * - User must meet minimum karma to vote
     * - Must include required stake (msg.value)
     * - Cannot vote on own content
     * - Content must not be too old
     * - Cannot vote twice on same content
     * 
     * Effects:
     * - Records vote and locks stake
     * - Updates content score
     * - Updates author karma
     */
    function vote(
        uint256 contentId, 
        bool isPost, 
        VoteType voteType
    ) external payable override nonReentrant {
        if (voteType == VoteType.None) {
            revert BreadItErrors.InvalidAmount();
        }
        
        // Validate user
        if (!userRegistry.isRegistered(msg.sender)) {
            revert BreadItErrors.UserNotRegistered(msg.sender);
        }
        
        if (userRegistry.isBanned(msg.sender)) {
            revert BreadItErrors.UserIsBanned(msg.sender);
        }
        
        if (!userRegistry.canVote(msg.sender)) {
            revert BreadItErrors.InsufficientVotingPower(msg.sender);
        }
        
        // Validate stake
        uint256 requiredStake = voteType == VoteType.Upvote 
            ? BreadItConstants.MIN_UPVOTE_STAKE 
            : BreadItConstants.MIN_DOWNVOTE_STAKE;
        
        if (msg.value < requiredStake) {
            revert BreadItErrors.InsufficientStake(msg.value, requiredStake);
        }
        
        // Get content author and validate
        address author = postManager.getContentAuthor(contentId, isPost);
        
        if (author == msg.sender) {
            revert BreadItErrors.CannotVoteOwnContent(msg.sender);
        }
        
        // Check content age
        uint256 createdAt = postManager.getContentCreatedAt(contentId, isPost);
        if (block.timestamp - createdAt > BreadItConstants.MAX_VOTING_AGE) {
            revert BreadItErrors.ContentTooOldForVoting(contentId, block.timestamp - createdAt);
        }
        
        // Check existing vote
        VoteInfo storage existingVote = _votes[contentId][isPost][msg.sender];
        
        if (existingVote.voteType != VoteType.None) {
            // Change vote
            _handleVoteChange(contentId, isPost, existingVote, voteType, author);
        } else {
            // New vote
            _handleNewVote(contentId, isPost, voteType, author);
        }
    }
    
    /**
     * @notice Get a user's vote on content
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @param voter The voter's address
     * @return The vote struct
     */
    function getVote(
        uint256 contentId, 
        bool isPost, 
        address voter
    ) external view override returns (Vote memory) {
        VoteInfo storage info = _votes[contentId][isPost][voter];
        return Vote({
            voter: voter,
            voteType: info.voteType,
            stake: info.stake,
            timestamp: info.timestamp
        });
    }
    
    /**
     * @notice Get the score of content
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @return The score (upvotes - downvotes)
     */
    function getContentScore(
        uint256 contentId, 
        bool isPost
    ) external view override returns (int256) {
        return _scores[contentId][isPost];
    }
    
    /**
     * @notice Get vote counts for content
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @return upvotes Number of upvotes
     * @return downvotes Number of downvotes
     */
    function getVoteCounts(
        uint256 contentId,
        bool isPost
    ) external view returns (uint256 upvotes, uint256 downvotes) {
        return (_upvoteCount[contentId][isPost], _downvoteCount[contentId][isPost]);
    }
    
    /**
     * @notice Withdraw staked tokens after lock period
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * 
     * Requirements:
     * - User must have voted
     * - Stake lock period must have passed
     * - Stake must not have been slashed
     * - Cannot withdraw twice
     */
    function withdrawStake(
        uint256 contentId, 
        bool isPost
    ) external override nonReentrant {
        VoteInfo storage voteInfo = _votes[contentId][isPost][msg.sender];
        
        if (voteInfo.voteType == VoteType.None) {
            revert BreadItErrors.VoteNotFound(contentId, isPost, msg.sender);
        }
        
        if (voteInfo.withdrawn) {
            revert BreadItErrors.StakeAlreadyWithdrawn();
        }
        
        if (voteInfo.slashed) {
            revert BreadItErrors.StakeAlreadyWithdrawn();
        }
        
        if (block.timestamp < voteInfo.timestamp + BreadItConstants.STAKE_LOCK_PERIOD) {
            revert BreadItErrors.TimelockNotPassed(
                contentId, 
                voteInfo.timestamp + BreadItConstants.STAKE_LOCK_PERIOD
            );
        }
        
        uint256 amount = voteInfo.stake;
        voteInfo.withdrawn = true;
        totalStaked -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) {
            revert BreadItErrors.TransferFailed();
        }
        
        emit StakeWithdrawn(contentId, isPost, msg.sender, amount);
    }
    
    /**
     * @notice Batch withdraw multiple stakes
     * @param contentIds Array of content IDs
     * @param isPostFlags Array of isPost flags
     */
    function batchWithdrawStakes(
        uint256[] calldata contentIds,
        bool[] calldata isPostFlags
    ) external nonReentrant {
        require(contentIds.length == isPostFlags.length, "Length mismatch");
        
        uint256 totalAmount = 0;
        
        for (uint256 i = 0; i < contentIds.length; i++) {
            VoteInfo storage voteInfo = _votes[contentIds[i]][isPostFlags[i]][msg.sender];
            
            if (voteInfo.voteType == VoteType.None) continue;
            if (voteInfo.withdrawn) continue;
            if (voteInfo.slashed) continue;
            if (block.timestamp < voteInfo.timestamp + BreadItConstants.STAKE_LOCK_PERIOD) continue;
            
            totalAmount += voteInfo.stake;
            voteInfo.withdrawn = true;
            
            emit StakeWithdrawn(contentIds[i], isPostFlags[i], msg.sender, voteInfo.stake);
        }
        
        if (totalAmount > 0) {
            totalStaked -= totalAmount;
            (bool success, ) = msg.sender.call{value: totalAmount}("");
            if (!success) {
                revert BreadItErrors.TransferFailed();
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════
    // MODERATION FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Slash a voter's stake (moderation only)
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @param voter The voter whose stake to slash
     * @param reason The reason for slashing
     * 
     * Used when moderation determines abusive voting behavior
     */
    function slashStake(
        uint256 contentId,
        bool isPost,
        address voter,
        string calldata reason
    ) external onlyRole(MODERATION_ROLE) {
        VoteInfo storage voteInfo = _votes[contentId][isPost][voter];
        
        if (voteInfo.voteType == VoteType.None) {
            revert BreadItErrors.VoteNotFound(contentId, isPost, voter);
        }
        
        if (voteInfo.withdrawn || voteInfo.slashed) {
            revert BreadItErrors.StakeAlreadyWithdrawn();
        }
        
        uint256 slashAmount = (voteInfo.stake * BreadItConstants.STAKE_SLASH_PERCENTAGE) / 100;
        
        voteInfo.slashed = true;
        voteInfo.stake -= slashAmount;
        
        totalStaked -= slashAmount;
        slashedStakesTreasury += slashAmount;
        
        emit StakeSlashed(contentId, isPost, voter, slashAmount, reason);
    }
    
    /**
     * @notice Distribute slashed stakes to subreddit treasury
     * @param subredditId The subreddit to receive funds
     * @param amount The amount to distribute
     */
    function distributeSlashedStakes(
        uint256 subredditId, 
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (amount > slashedStakesTreasury) {
            revert BreadItErrors.InsufficientTreasuryBalance(amount, slashedStakesTreasury);
        }
        
        slashedStakesTreasury -= amount;
        
        // Send to subreddit treasury via deposit
        subredditDAO.depositTreasury{value: amount}(subredditId);
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Set post manager contract
     * @param _postManager The post manager address
     */
    function setPostManager(address _postManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_postManager == address(0)) {
            revert BreadItErrors.ZeroAddress();
        }
        postManager = IPostManager(_postManager);
    }
    
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
    
    /**
     * @notice Set moderation contract
     * @param moderation The moderation contract address
     */
    function setModerationContract(address moderation) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (moderation == address(0)) {
            revert BreadItErrors.ZeroAddress();
        }
        _grantRole(MODERATION_ROLE, moderation);
    }

    // ═══════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Handle a new vote
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @param voteType The vote type
     * @param author The content author
     */
    function _handleNewVote(
        uint256 contentId,
        bool isPost,
        VoteType voteType,
        address author
    ) internal {
        _votes[contentId][isPost][msg.sender] = VoteInfo({
            voteType: voteType,
            stake: msg.value,
            timestamp: block.timestamp,
            withdrawn: false,
            slashed: false
        });
        
        totalStaked += msg.value;
        
        int256 scoreDelta;
        int256 karmaDelta;
        
        if (voteType == VoteType.Upvote) {
            scoreDelta = 1;
            _upvoteCount[contentId][isPost]++;
            karmaDelta = isPost 
                ? BreadItConstants.KARMA_PER_POST_UPVOTE 
                : BreadItConstants.KARMA_PER_COMMENT_UPVOTE;
        } else {
            scoreDelta = -1;
            _downvoteCount[contentId][isPost]++;
            karmaDelta = isPost 
                ? BreadItConstants.KARMA_PER_POST_DOWNVOTE 
                : BreadItConstants.KARMA_PER_COMMENT_DOWNVOTE;
        }
        
        _scores[contentId][isPost] += scoreDelta;
        
        // Update content score in PostManager
        if (isPost) {
            postManager.updatePostScore(contentId, scoreDelta);
        } else {
            postManager.updateCommentScore(contentId, scoreDelta);
        }
        
        // Update author karma
        string memory reason = voteType == VoteType.Upvote 
            ? "Received upvote" 
            : "Received downvote";
        userRegistry.updateKarma(author, karmaDelta, reason);
        
        emit Voted(contentId, isPost, msg.sender, voteType, msg.value, block.timestamp);
    }
    
    /**
     * @notice Handle changing an existing vote
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @param existingVote The existing vote info
     * @param newVoteType The new vote type
     * @param author The content author
     */
    function _handleVoteChange(
        uint256 contentId,
        bool isPost,
        VoteInfo storage existingVote,
        VoteType newVoteType,
        address author
    ) internal {
        VoteType oldVoteType = existingVote.voteType;
        
        // Can't change to same vote type
        if (oldVoteType == newVoteType) {
            revert BreadItErrors.AlreadyVoted(contentId, isPost, msg.sender);
        }
        
        // Update vote info
        existingVote.voteType = newVoteType;
        existingVote.stake += msg.value;
        existingVote.timestamp = block.timestamp;
        
        totalStaked += msg.value;
        
        int256 scoreDelta;
        int256 karmaDelta;
        
        if (oldVoteType == VoteType.Upvote && newVoteType == VoteType.Downvote) {
            // Changed from upvote to downvote: -2 score
            scoreDelta = -2;
            _upvoteCount[contentId][isPost]--;
            _downvoteCount[contentId][isPost]++;
            
            // Reverse upvote karma + apply downvote karma
            karmaDelta = isPost 
                ? -(BreadItConstants.KARMA_PER_POST_UPVOTE) + BreadItConstants.KARMA_PER_POST_DOWNVOTE
                : -(BreadItConstants.KARMA_PER_COMMENT_UPVOTE) + BreadItConstants.KARMA_PER_COMMENT_DOWNVOTE;
        } else {
            // Changed from downvote to upvote: +2 score
            scoreDelta = 2;
            _downvoteCount[contentId][isPost]--;
            _upvoteCount[contentId][isPost]++;
            
            // Reverse downvote karma + apply upvote karma
            karmaDelta = isPost 
                ? -(BreadItConstants.KARMA_PER_POST_DOWNVOTE) + BreadItConstants.KARMA_PER_POST_UPVOTE
                : -(BreadItConstants.KARMA_PER_COMMENT_DOWNVOTE) + BreadItConstants.KARMA_PER_COMMENT_UPVOTE;
        }
        
        _scores[contentId][isPost] += scoreDelta;
        
        // Update content score in PostManager
        if (isPost) {
            postManager.updatePostScore(contentId, scoreDelta);
        } else {
            postManager.updateCommentScore(contentId, scoreDelta);
        }
        
        // Update author karma
        userRegistry.updateKarma(author, karmaDelta, "Vote changed");
        
        emit VoteChanged(contentId, isPost, msg.sender, oldVoteType, newVoteType);
    }
    
    // ═══════════════════════════════════════════════════════════
    // RECEIVE
    // ═══════════════════════════════════════════════════════════
    
    receive() external payable {
        // Accept ETH
    }
}
