// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IBreadItCore
 * @notice Core interfaces for the Bread-it decentralized social protocol
 * @dev All contracts must implement these interfaces for cross-contract communication
 */

/**
 * @notice User profile and karma management interface
 */
interface IUserRegistry {
    /// @notice User profile structure
    struct UserProfile {
        address wallet;
        bytes32 username;
        int256 karma;
        uint256 createdAt;
        uint256 lastPostTime;
        uint256 lastCommentTime;
        uint256 totalPosts;
        uint256 totalComments;
        bool isBanned;
    }

    /// @notice Emitted when a new user registers
    event UserRegistered(address indexed wallet, bytes32 username, uint256 timestamp);
    
    /// @notice Emitted when karma is updated
    event KarmaUpdated(address indexed wallet, int256 oldKarma, int256 newKarma, string reason);
    
    /// @notice Emitted when user is banned/unbanned
    event UserBanStatusChanged(address indexed wallet, bool isBanned, string reason);

    function registerUser(bytes32 username) external;
    function getUser(address wallet) external view returns (UserProfile memory);
    function isRegistered(address wallet) external view returns (bool);
    function updateKarma(address wallet, int256 delta, string calldata reason) external;
    function getUserKarma(address wallet) external view returns (int256);
    function isBanned(address wallet) external view returns (bool);
    function canPost(address wallet) external view returns (bool);
    function canVote(address wallet) external view returns (bool);
    function recordPostActivity(address wallet) external;
    function recordCommentActivity(address wallet) external;
}

/**
 * @notice Post types enumeration
 */
enum PostType {
    Text,
    Media,
    Meme
}

/**
 * @notice Content visibility states
 */
enum ContentStatus {
    Visible,
    Hidden,
    Flagged
}

/**
 * @notice Post and comment management interface
 */
interface IPostManager {
    /// @notice Post structure
    struct Post {
        uint256 id;
        uint256 subredditId;
        address author;
        PostType postType;
        bytes title;
        bytes body;
        bytes ipfsCid;
        bytes32 mimeType;
        int256 score;
        uint256 commentCount;
        uint256 createdAt;
        ContentStatus status;
    }

    /// @notice Comment structure
    struct Comment {
        uint256 id;
        uint256 postId;
        uint256 parentId;
        address author;
        bytes content;
        int256 score;
        uint256 createdAt;
        ContentStatus status;
    }

    event PostCreated(
        uint256 indexed postId,
        uint256 indexed subredditId,
        address indexed author,
        PostType postType,
        uint256 timestamp
    );

    event CommentCreated(
        uint256 indexed commentId,
        uint256 indexed postId,
        uint256 parentId,
        address indexed author,
        uint256 timestamp
    );

    event ContentStatusChanged(
        uint256 indexed contentId,
        bool isPost,
        ContentStatus oldStatus,
        ContentStatus newStatus,
        string reason
    );

    function createTextPost(
        uint256 subredditId,
        bytes calldata title,
        bytes calldata body
    ) external returns (uint256);

    function createMediaPost(
        uint256 subredditId,
        bytes calldata title,
        bytes calldata ipfsCid,
        bytes32 mimeType,
        bool isMeme
    ) external returns (uint256);

    function createComment(
        uint256 postId,
        uint256 parentId,
        bytes calldata content
    ) external returns (uint256);

    function getPost(uint256 postId) external view returns (Post memory);
    function getComment(uint256 commentId) external view returns (Comment memory);
    function getContentAuthor(uint256 contentId, bool isPost) external view returns (address);
    function getContentSubreddit(uint256 contentId, bool isPost) external view returns (uint256);
    function getContentCreatedAt(uint256 contentId, bool isPost) external view returns (uint256);
    function updatePostScore(uint256 postId, int256 delta) external;
    function updateCommentScore(uint256 commentId, int256 delta) external;
    function setContentStatus(uint256 contentId, bool isPost, ContentStatus status, string calldata reason) external;
}

/**
 * @notice Voting system interface
 */
interface IVoting {
    /// @notice Vote types
    enum VoteType {
        None,
        Upvote,
        Downvote
    }

    /// @notice Vote structure
    struct Vote {
        address voter;
        VoteType voteType;
        uint256 stake;
        uint256 timestamp;
    }

    event Voted(
        uint256 indexed contentId,
        bool isPost,
        address indexed voter,
        VoteType voteType,
        uint256 stake,
        uint256 timestamp
    );

    event VoteChanged(
        uint256 indexed contentId,
        bool isPost,
        address indexed voter,
        VoteType oldVote,
        VoteType newVote
    );

    function vote(uint256 contentId, bool isPost, VoteType voteType) external payable;
    function getVote(uint256 contentId, bool isPost, address voter) external view returns (Vote memory);
    function getContentScore(uint256 contentId, bool isPost) external view returns (int256);
    function withdrawStake(uint256 contentId, bool isPost) external;
}

/**
 * @notice Subreddit DAO interface
 */
interface ISubredditDAO {
    /// @notice Subreddit configuration
    struct SubredditConfig {
        uint256 id;
        bytes32 name;
        bytes description;
        address creator;
        uint256 createdAt;
        int256 minKarmaToPost;
        int256 minKarmaToComment;
        int256 minKarmaToVote;
        uint256 postCooldown;
        uint256 commentCooldown;
        bool isActive;
    }

    /// @notice Moderator structure
    struct Moderator {
        address wallet;
        uint256 appointedAt;
        uint256 votesReceived;
        bool isActive;
    }

    event SubredditCreated(
        uint256 indexed subredditId,
        bytes32 name,
        address indexed creator,
        uint256 timestamp
    );

    event ModeratorElected(
        uint256 indexed subredditId,
        address indexed moderator,
        uint256 votes,
        uint256 timestamp
    );

    event ModeratorRemoved(
        uint256 indexed subredditId,
        address indexed moderator,
        string reason,
        uint256 timestamp
    );

    event RuleChanged(
        uint256 indexed subredditId,
        string ruleType,
        bytes oldValue,
        bytes newValue,
        uint256 timestamp
    );

    function createSubreddit(
        bytes32 name,
        bytes calldata description,
        int256 minKarmaToPost,
        int256 minKarmaToComment,
        uint256 postCooldown
    ) external payable returns (uint256);

    function getSubreddit(uint256 subredditId) external view returns (SubredditConfig memory);
    function isMember(address user, uint256 subredditId) external view returns (bool);
    function memberCount(uint256 subredditId) external view returns (uint256);
    function isModerator(uint256 subredditId, address wallet) external view returns (bool);
    function getModerators(uint256 subredditId) external view returns (address[] memory);
    function canUserPost(uint256 subredditId, address wallet) external view returns (bool);
    function canUserComment(uint256 subredditId, address wallet) external view returns (bool);
    
    // Governance functions
    function updateConfig(
        uint256 subredditId,
        int256 minKarmaToPost,
        int256 minKarmaToComment,
        uint256 postCooldown
    ) external;
    function addModerator(uint256 subredditId, address moderator, uint256 votes) external;
    function removeModerator(uint256 subredditId, address moderator, string calldata reason) external;
    function depositTreasury(uint256 subredditId) external payable;
    function withdrawTreasury(uint256 subredditId, address recipient, uint256 amount, string calldata reason) external;
    function updateRules(uint256 subredditId, bytes calldata newRules) external;
}

/**
 * @notice Governance interface for proposals and voting
 */
interface IGovernance {
    /// @notice Proposal types
    enum ProposalType {
        RuleChange,
        ModeratorElection,
        ModeratorRemoval,
        TreasurySpend,
        ConfigChange
    }

    /// @notice Proposal states
    enum ProposalState {
        Pending,
        Active,
        Succeeded,
        Defeated,
        Executed,
        Expired
    }

    /// @notice Proposal structure
    struct Proposal {
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
    }

    event ProposalCreated(
        uint256 indexed proposalId,
        uint256 indexed subredditId,
        ProposalType proposalType,
        address indexed proposer,
        uint256 startTime,
        uint256 endTime
    );

    event ProposalVoted(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );

    event ProposalExecuted(
        uint256 indexed proposalId,
        uint256 timestamp
    );

    function createProposal(
        uint256 subredditId,
        ProposalType proposalType,
        bytes calldata data
    ) external returns (uint256);

    function castVote(uint256 proposalId, bool support) external;
    function executeProposal(uint256 proposalId) external;
    function getProposal(uint256 proposalId) external view returns (Proposal memory);
    function getProposalState(uint256 proposalId) external view returns (ProposalState);
}

/**
 * @notice Moderation interface
 */
interface IModeration {
    /// @notice Report structure
    struct Report {
        uint256 id;
        uint256 contentId;
        bool isPost;
        address reporter;
        bytes reason;
        uint256 timestamp;
        bool resolved;
        bool upheld;
    }

    /// @notice Moderation action structure
    struct ModerationAction {
        uint256 id;
        uint256 contentId;
        bool isPost;
        address moderator;
        bytes action;
        bytes reason;
        uint256 timestamp;
    }

    event ContentReported(
        uint256 indexed reportId,
        uint256 indexed contentId,
        bool isPost,
        address indexed reporter,
        uint256 timestamp
    );

    event ModerationActionTaken(
        uint256 indexed actionId,
        uint256 indexed contentId,
        bool isPost,
        address indexed moderator,
        bytes action,
        uint256 timestamp
    );

    event ReportResolved(
        uint256 indexed reportId,
        bool upheld,
        address resolver,
        uint256 timestamp
    );

    function reportContent(
        uint256 contentId,
        bool isPost,
        bytes calldata reason
    ) external returns (uint256);

    function resolveReport(
        uint256 reportId,
        bool uphold,
        bytes calldata action
    ) external;

    function getReport(uint256 reportId) external view returns (Report memory);
    function getContentReports(uint256 contentId, bool isPost) external view returns (uint256[] memory);
}
