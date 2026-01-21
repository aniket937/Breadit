// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title BreadItErrors
 * @notice Custom errors for gas-efficient reverts across all Bread-it contracts
 * @dev Using custom errors instead of require strings saves significant gas
 */
library BreadItErrors {
    // User Registry Errors
    error UserAlreadyRegistered(address wallet);
    error UserNotRegistered(address wallet);
    error UserIsBanned(address wallet);
    error InvalidUsername();
    error UsernameTaken(bytes32 username);
    error InsufficientKarma(address wallet, int256 required, int256 actual);
    error RateLimitExceeded(address wallet, uint256 nextAllowedTime);
    
    // Post Manager Errors
    error PostNotFound(uint256 postId);
    error CommentNotFound(uint256 commentId);
    error TitleTooLong(uint256 length, uint256 maxLength);
    error BodyTooLong(uint256 length, uint256 maxLength);
    error EmptyContent();
    error InvalidIPFSCid();
    error ContentHidden(uint256 contentId);
    error InvalidMimeType();
    
    // Subreddit Errors
    error SubredditNotFound(uint256 subredditId);
    error SubredditNameTaken(bytes32 name);
    error SubredditInactive(uint256 subredditId);
    error InvalidSubredditName();
    error NotModerator(uint256 subredditId, address wallet);
    error AlreadyModerator(uint256 subredditId, address wallet);
    error CreatorCannotBeRemoved(uint256 subredditId);
    
    // Voting Errors
    error AlreadyVoted(uint256 contentId, bool isPost, address voter);
    error CannotVoteOwnContent(address wallet);
    error InsufficientStake(uint256 provided, uint256 required);
    error VoteNotFound(uint256 contentId, bool isPost, address voter);
    error StakeAlreadyWithdrawn();
    error ContentTooOldForVoting(uint256 contentId, uint256 age);
    
    // Governance Errors
    error ProposalNotFound(uint256 proposalId);
    error ProposalNotActive(uint256 proposalId);
    error ProposalAlreadyExecuted(uint256 proposalId);
    error ProposalNotSucceeded(uint256 proposalId);
    error TimelockNotPassed(uint256 proposalId, uint256 executeTime);
    error AlreadyVotedOnProposal(uint256 proposalId, address voter);
    error InsufficientVotingPower(address wallet);
    error QuorumNotReached(uint256 proposalId);
    error InvalidProposalData();
    
    // Moderation Errors
    error ReportNotFound(uint256 reportId);
    error ReportAlreadyResolved(uint256 reportId);
    error NotAuthorizedModerator(address wallet);
    error CannotReportOwnContent(address wallet);
    error DuplicateReport(uint256 contentId, bool isPost, address reporter);
    
    // Treasury Errors
    error InsufficientTreasuryBalance(uint256 requested, uint256 available);
    error InvalidRecipient();
    error TransferFailed();
    
    // General Errors
    error Unauthorized(address caller);
    error ZeroAddress();
    error InvalidAmount();
    error ContractPaused();
    error ReentrancyGuard();
}

/**
 * @title BreadItConstants
 * @notice Protocol-wide constants for the Bread-it platform
 * @dev These values are carefully tuned for gas efficiency and anti-abuse
 */
library BreadItConstants {
    // ═══════════════════════════════════════════════════════════
    // CONTENT LIMITS (Gas Optimization)
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Maximum title length in bytes (approx 100 chars)
    uint256 constant MAX_TITLE_LENGTH = 300;
    
    /// @notice Maximum body length in bytes (approx 10K chars)
    uint256 constant MAX_BODY_LENGTH = 30000;
    
    /// @notice Maximum comment length in bytes
    uint256 constant MAX_COMMENT_LENGTH = 10000;
    
    /// @notice Maximum IPFS CID length
    uint256 constant MAX_CID_LENGTH = 100;
    
    /// @notice Maximum subreddit description length
    uint256 constant MAX_DESCRIPTION_LENGTH = 1000;
    
    /// @notice Maximum subreddit rules length
    uint256 constant MAX_RULES_LENGTH = 5000;
    
    // ═══════════════════════════════════════════════════════════
    // KARMA THRESHOLDS
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Karma at which user is auto-banned
    int256 constant BAN_KARMA_THRESHOLD = -100;
    
    /// @notice Starting karma for new users
    int256 constant INITIAL_KARMA = 1;
    
    /// @notice Karma gained per upvote received on post
    int256 constant KARMA_PER_POST_UPVOTE = 10;
    
    /// @notice Karma lost per downvote received on post
    int256 constant KARMA_PER_POST_DOWNVOTE = -5;
    
    /// @notice Karma gained per upvote received on comment
    int256 constant KARMA_PER_COMMENT_UPVOTE = 5;
    
    /// @notice Karma lost per downvote received on comment
    int256 constant KARMA_PER_COMMENT_DOWNVOTE = -3;
    
    /// @notice Karma penalty for content hidden by moderation
    int256 constant KARMA_PENALTY_CONTENT_HIDDEN = -50;
    
    /// @notice Maximum karma gain per day (anti-farming)
    int256 constant MAX_DAILY_KARMA_GAIN = 500;
    
    // ═══════════════════════════════════════════════════════════
    // RATE LIMITING
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Base cooldown between posts for new users (10 minutes)
    uint256 constant BASE_POST_COOLDOWN = 10 minutes;
    
    /// @notice Base cooldown between comments for new users (1 minute)
    uint256 constant BASE_COMMENT_COOLDOWN = 1 minutes;
    
    /// @notice Karma threshold for reduced cooldowns
    int256 constant REDUCED_COOLDOWN_KARMA = 100;
    
    /// @notice Cooldown reduction factor for high-karma users
    uint256 constant COOLDOWN_REDUCTION_FACTOR = 2;
    
    /// @notice Account age for trusted status (30 days)
    uint256 constant TRUSTED_ACCOUNT_AGE = 30 days;
    
    // ═══════════════════════════════════════════════════════════
    // VOTING ECONOMICS
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Minimum stake required to upvote (0.001 ETH equivalent)
    uint256 constant MIN_UPVOTE_STAKE = 0.001 ether;
    
    /// @notice Minimum stake required to downvote (higher barrier - 0.005 ETH)
    uint256 constant MIN_DOWNVOTE_STAKE = 0.005 ether;
    
    /// @notice Maximum age of content that can be voted on (7 days)
    uint256 constant MAX_VOTING_AGE = 7 days;
    
    /// @notice Stake lock period before withdrawal (24 hours)
    uint256 constant STAKE_LOCK_PERIOD = 24 hours;
    
    /// @notice Percentage of stake slashed on moderation action (10%)
    uint256 constant STAKE_SLASH_PERCENTAGE = 10;
    
    // ═══════════════════════════════════════════════════════════
    // GOVERNANCE
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Voting period for standard proposals (3 days)
    uint256 constant STANDARD_VOTING_PERIOD = 3 days;
    
    /// @notice Voting period for critical proposals (7 days)
    uint256 constant CRITICAL_VOTING_PERIOD = 7 days;
    
    /// @notice Timelock for standard proposal execution (1 day)
    uint256 constant STANDARD_TIMELOCK = 1 days;
    
    /// @notice Timelock for critical proposal execution (3 days)
    uint256 constant CRITICAL_TIMELOCK = 3 days;
    
    /// @notice Quorum percentage for standard proposals (10%)
    uint256 constant STANDARD_QUORUM = 10;
    
    /// @notice Quorum percentage for critical proposals (25%)
    uint256 constant CRITICAL_QUORUM = 25;
    
    /// @notice Supermajority percentage required (66%)
    uint256 constant SUPERMAJORITY = 66;
    
    /// @notice Minimum karma to create proposal
    int256 constant MIN_KARMA_TO_PROPOSE = 100;
    
    // ═══════════════════════════════════════════════════════════
    // MODERATION
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Reports needed to trigger automatic review
    uint256 constant REPORTS_FOR_AUTO_REVIEW = 5;
    
    /// @notice Cooldown between reports from same user (1 hour)
    uint256 constant REPORT_COOLDOWN = 1 hours;
    
    /// @notice Karma bonus for valid reports
    int256 constant KARMA_BONUS_VALID_REPORT = 5;
    
    /// @notice Karma penalty for frivolous reports
    int256 constant KARMA_PENALTY_FRIVOLOUS_REPORT = -10;
    
    /// @notice Maximum moderators per subreddit
    uint256 constant MAX_MODERATORS = 20;
    
    // ═══════════════════════════════════════════════════════════
    // SUBREDDIT DEFAULTS
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Default minimum karma to post in new subreddit
    int256 constant DEFAULT_MIN_KARMA_TO_POST = 1;
    
    /// @notice Default minimum karma to comment
    int256 constant DEFAULT_MIN_KARMA_TO_COMMENT = 0;
    
    /// @notice Default minimum karma to vote
    int256 constant DEFAULT_MIN_KARMA_TO_VOTE = 1;
    
    /// @notice Cost to create a subreddit (anti-spam)
    uint256 constant SUBREDDIT_CREATION_COST = 0.1 ether;
}
