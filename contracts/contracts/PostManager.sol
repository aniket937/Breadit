// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IBreadItCore.sol";
import "./libraries/BreadItErrors.sol";

/**
 * @title PostManager
 * @author Bread-it Protocol
 * @notice Manages posts and comments for the Bread-it platform
 * @dev All text content is stored on-chain, media content references IPFS
 * 
 * ARCHITECTURE:
 * - Text posts store title and body directly on-chain as bytes
 * - Media posts store IPFS CID and MIME type (actual media on IPFS)
 * - Comments form a tree structure using parentId references
 * - Content is NEVER deleted, only soft-hidden
 * 
 * GAS OPTIMIZATIONS:
 * - Uses bytes instead of string for cheaper storage
 * - Compact struct packing
 * - Length limits to bound gas costs
 * 
 * SECURITY:
 * - Validates user permissions via UserRegistry and SubredditDAO
 * - Rate limiting through UserRegistry
 * - Only authorized contracts can update scores and visibility
 */
contract PostManager is IPostManager, ReentrancyGuard, AccessControl {
    using BreadItConstants for *;

    // ═══════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Role for voting contract to update scores
    bytes32 public constant VOTING_ROLE = keccak256("VOTING_ROLE");
    
    /// @notice Role for moderation contract to change visibility
    bytes32 public constant MODERATION_ROLE = keccak256("MODERATION_ROLE");

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════
    
    /// @notice User registry contract
    IUserRegistry public immutable userRegistry;
    
    /// @notice Subreddit DAO contract
    ISubredditDAO public immutable subredditDAO;
    
    /// @notice Total posts created
    uint256 public postCount;
    
    /// @notice Total comments created
    uint256 public commentCount;
    
    /// @notice Mapping from post ID to post
    mapping(uint256 => Post) private _posts;
    
    /// @notice Mapping from comment ID to comment
    mapping(uint256 => Comment) private _comments;
    
    /// @notice Mapping from post ID to comment IDs
    mapping(uint256 => uint256[]) private _postComments;
    
    /// @notice Mapping from comment ID to child comment IDs
    mapping(uint256 => uint256[]) private _commentReplies;
    
    /// @notice Mapping from subreddit ID to post IDs
    mapping(uint256 => uint256[]) private _subredditPosts;
    
    /// @notice Mapping from user to their post IDs
    mapping(address => uint256[]) private _userPosts;
    
    /// @notice Mapping from user to their comment IDs
    mapping(address => uint256[]) private _userComments;

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════
    
    constructor(address _userRegistry, address _subredditDAO) {
        if (_userRegistry == address(0) || _subredditDAO == address(0)) {
            revert BreadItErrors.ZeroAddress();
        }
        userRegistry = IUserRegistry(_userRegistry);
        subredditDAO = ISubredditDAO(_subredditDAO);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS - POSTS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Create a text post
     * @param subredditId The subreddit to post in
     * @param title The post title (bytes, stored on-chain)
     * @param body The post body (bytes, stored on-chain)
     * @return postId The ID of the created post
     * 
     * Requirements:
     * - User must be registered and not banned
     * - User must meet subreddit karma requirements
     * - User must not be rate limited
     * - Title and body must be within length limits
     */
    function createTextPost(
        uint256 subredditId,
        bytes calldata title,
        bytes calldata body
    ) external override nonReentrant returns (uint256) {
        _validatePostCreation(subredditId, title);
        
        if (body.length == 0) {
            revert BreadItErrors.EmptyContent();
        }
        
        if (body.length > BreadItConstants.MAX_BODY_LENGTH) {
            revert BreadItErrors.BodyTooLong(body.length, BreadItConstants.MAX_BODY_LENGTH);
        }
        
        postCount++;
        uint256 postId = postCount;
        
        _posts[postId] = Post({
            id: postId,
            subredditId: subredditId,
            author: msg.sender,
            postType: PostType.Text,
            title: title,
            body: body,
            ipfsCid: "",
            mimeType: bytes32(0),
            score: 0,
            commentCount: 0,
            createdAt: block.timestamp,
            status: ContentStatus.Visible
        });
        
        _subredditPosts[subredditId].push(postId);
        _userPosts[msg.sender].push(postId);
        
        // Record activity in user registry
        userRegistry.recordPostActivity(msg.sender);
        
        emit PostCreated(postId, subredditId, msg.sender, PostType.Text, block.timestamp);
        
        return postId;
    }
    
    /**
     * @notice Create a media post (image, video, gif, meme)
     * @param subredditId The subreddit to post in
     * @param title The post title (bytes, stored on-chain)
     * @param ipfsCid The IPFS CID of the media (stored on-chain)
     * @param mimeType The MIME type of the media (e.g., "image/png")
     * @param isMeme Whether this is a meme post
     * @return postId The ID of the created post
     * 
     * NOTE: The actual media content is stored on IPFS, only the
     * reference (CID) is stored on-chain. This keeps gas costs low
     * while maintaining on-chain verification of content ownership.
     */
    function createMediaPost(
        uint256 subredditId,
        bytes calldata title,
        bytes calldata ipfsCid,
        bytes32 mimeType,
        bool isMeme
    ) external override nonReentrant returns (uint256) {
        _validatePostCreation(subredditId, title);
        
        if (ipfsCid.length == 0) {
            revert BreadItErrors.InvalidIPFSCid();
        }
        
        if (ipfsCid.length > BreadItConstants.MAX_CID_LENGTH) {
            revert BreadItErrors.InvalidIPFSCid();
        }
        
        if (mimeType == bytes32(0)) {
            revert BreadItErrors.InvalidMimeType();
        }
        
        postCount++;
        uint256 postId = postCount;
        
        _posts[postId] = Post({
            id: postId,
            subredditId: subredditId,
            author: msg.sender,
            postType: isMeme ? PostType.Meme : PostType.Media,
            title: title,
            body: "",
            ipfsCid: ipfsCid,
            mimeType: mimeType,
            score: 0,
            commentCount: 0,
            createdAt: block.timestamp,
            status: ContentStatus.Visible
        });
        
        _subredditPosts[subredditId].push(postId);
        _userPosts[msg.sender].push(postId);
        
        userRegistry.recordPostActivity(msg.sender);
        
        emit PostCreated(
            postId, 
            subredditId, 
            msg.sender, 
            isMeme ? PostType.Meme : PostType.Media, 
            block.timestamp
        );
        
        return postId;
    }
    
    /**
     * @notice Get a post by ID
     * @param postId The post ID
     * @return The post struct
     */
    function getPost(uint256 postId) external view override returns (Post memory) {
        if (_posts[postId].id == 0) {
            revert BreadItErrors.PostNotFound(postId);
        }
        return _posts[postId];
    }
    
    /**
     * @notice Get posts for a subreddit with pagination
     * @param subredditId The subreddit ID
     * @param offset Starting index
     * @param limit Maximum number of posts to return
     * @return postIds Array of post IDs
     */
    function getSubredditPosts(
        uint256 subredditId,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256[] storage posts = _subredditPosts[subredditId];
        
        if (offset >= posts.length) {
            return new uint256[](0);
        }
        
        uint256 end = offset + limit;
        if (end > posts.length) {
            end = posts.length;
        }
        
        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = posts[i];
        }
        
        return result;
    }
    
    /**
     * @notice Get total posts in a subreddit
     * @param subredditId The subreddit ID
     * @return count The number of posts
     */
    function getSubredditPostCount(uint256 subredditId) external view returns (uint256) {
        return _subredditPosts[subredditId].length;
    }
    
    /**
     * @notice Get user's posts
     * @param user The user's wallet
     * @param offset Starting index
     * @param limit Maximum number of posts to return
     * @return postIds Array of post IDs
     */
    function getUserPosts(
        address user,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256[] storage posts = _userPosts[user];
        
        if (offset >= posts.length) {
            return new uint256[](0);
        }
        
        uint256 end = offset + limit;
        if (end > posts.length) {
            end = posts.length;
        }
        
        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = posts[i];
        }
        
        return result;
    }

    // ═══════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS - COMMENTS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Create a comment on a post or reply to another comment
     * @param postId The post to comment on
     * @param parentId The parent comment ID (0 for top-level comment)
     * @param content The comment content (bytes, stored on-chain)
     * @return commentId The ID of the created comment
     * 
     * Requirements:
     * - Post must exist and not be hidden
     * - User must meet subreddit requirements
     * - If replying, parent comment must exist
     */
    function createComment(
        uint256 postId,
        uint256 parentId,
        bytes calldata content
    ) external override nonReentrant returns (uint256) {
        Post storage post = _posts[postId];
        
        if (post.id == 0) {
            revert BreadItErrors.PostNotFound(postId);
        }
        
        if (post.status == ContentStatus.Hidden) {
            revert BreadItErrors.ContentHidden(postId);
        }
        
        // Validate parent comment if replying
        if (parentId != 0) {
            if (_comments[parentId].id == 0) {
                revert BreadItErrors.CommentNotFound(parentId);
            }
            if (_comments[parentId].postId != postId) {
                revert BreadItErrors.CommentNotFound(parentId);
            }
        }
        
        // Validate user permissions
        if (!userRegistry.isRegistered(msg.sender)) {
            revert BreadItErrors.UserNotRegistered(msg.sender);
        }
        
        if (userRegistry.isBanned(msg.sender)) {
            revert BreadItErrors.UserIsBanned(msg.sender);
        }
        
        if (!subredditDAO.canUserComment(post.subredditId, msg.sender)) {
            int256 userKarma = userRegistry.getUserKarma(msg.sender);
            ISubredditDAO.SubredditConfig memory config = subredditDAO.getSubreddit(post.subredditId);
            revert BreadItErrors.InsufficientKarma(msg.sender, config.minKarmaToComment, userKarma);
        }
        
        // Validate content
        if (content.length == 0) {
            revert BreadItErrors.EmptyContent();
        }
        
        if (content.length > BreadItConstants.MAX_COMMENT_LENGTH) {
            revert BreadItErrors.BodyTooLong(content.length, BreadItConstants.MAX_COMMENT_LENGTH);
        }
        
        commentCount++;
        uint256 commentId = commentCount;
        
        _comments[commentId] = Comment({
            id: commentId,
            postId: postId,
            parentId: parentId,
            author: msg.sender,
            content: content,
            score: 0,
            createdAt: block.timestamp,
            status: ContentStatus.Visible
        });
        
        // Update post comment count
        post.commentCount++;
        
        // Add to appropriate index
        if (parentId == 0) {
            _postComments[postId].push(commentId);
        } else {
            _commentReplies[parentId].push(commentId);
        }
        
        _userComments[msg.sender].push(commentId);
        
        userRegistry.recordCommentActivity(msg.sender);
        
        emit CommentCreated(commentId, postId, parentId, msg.sender, block.timestamp);
        
        return commentId;
    }
    
    /**
     * @notice Get a comment by ID
     * @param commentId The comment ID
     * @return The comment struct
     */
    function getComment(uint256 commentId) external view override returns (Comment memory) {
        if (_comments[commentId].id == 0) {
            revert BreadItErrors.CommentNotFound(commentId);
        }
        return _comments[commentId];
    }
    
    /**
     * @notice Get top-level comments for a post
     * @param postId The post ID
     * @param offset Starting index
     * @param limit Maximum number of comments to return
     * @return commentIds Array of comment IDs
     */
    function getPostComments(
        uint256 postId,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256[] storage comments = _postComments[postId];
        
        if (offset >= comments.length) {
            return new uint256[](0);
        }
        
        uint256 end = offset + limit;
        if (end > comments.length) {
            end = comments.length;
        }
        
        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = comments[i];
        }
        
        return result;
    }
    
    /**
     * @notice Get replies to a comment
     * @param commentId The parent comment ID
     * @return commentIds Array of reply comment IDs
     */
    function getCommentReplies(uint256 commentId) external view returns (uint256[] memory) {
        return _commentReplies[commentId];
    }
    
    /**
     * @notice Get user's comments
     * @param user The user's wallet
     * @param offset Starting index
     * @param limit Maximum number of comments to return
     * @return commentIds Array of comment IDs
     */
    function getUserComments(
        address user,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256[] storage comments = _userComments[user];
        
        if (offset >= comments.length) {
            return new uint256[](0);
        }
        
        uint256 end = offset + limit;
        if (end > comments.length) {
            end = comments.length;
        }
        
        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = comments[i];
        }
        
        return result;
    }

    // ═══════════════════════════════════════════════════════════
    // AUTHORIZED FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Update a post's score (voting contract only)
     * @param postId The post ID
     * @param delta The score change
     */
    function updatePostScore(uint256 postId, int256 delta) external override onlyRole(VOTING_ROLE) {
        if (_posts[postId].id == 0) {
            revert BreadItErrors.PostNotFound(postId);
        }
        _posts[postId].score += delta;
    }
    
    /**
     * @notice Update a comment's score (voting contract only)
     * @param commentId The comment ID
     * @param delta The score change
     */
    function updateCommentScore(uint256 commentId, int256 delta) external override onlyRole(VOTING_ROLE) {
        if (_comments[commentId].id == 0) {
            revert BreadItErrors.CommentNotFound(commentId);
        }
        _comments[commentId].score += delta;
    }
    
    /**
     * @notice Set content visibility status (moderation contract only)
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @param status The new status
     * @param reason The reason for the change
     */
    function setContentStatus(
        uint256 contentId, 
        bool isPost, 
        ContentStatus status, 
        string calldata reason
    ) external override onlyRole(MODERATION_ROLE) {
        ContentStatus oldStatus;
        
        if (isPost) {
            if (_posts[contentId].id == 0) {
                revert BreadItErrors.PostNotFound(contentId);
            }
            oldStatus = _posts[contentId].status;
            _posts[contentId].status = status;
        } else {
            if (_comments[contentId].id == 0) {
                revert BreadItErrors.CommentNotFound(contentId);
            }
            oldStatus = _comments[contentId].status;
            _comments[contentId].status = status;
        }
        
        emit ContentStatusChanged(contentId, isPost, oldStatus, status, reason);
    }
    
    /**
     * @notice Get content author (for voting and moderation contracts)
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @return The author's address
     */
    function getContentAuthor(uint256 contentId, bool isPost) external view returns (address) {
        if (isPost) {
            if (_posts[contentId].id == 0) {
                revert BreadItErrors.PostNotFound(contentId);
            }
            return _posts[contentId].author;
        } else {
            if (_comments[contentId].id == 0) {
                revert BreadItErrors.CommentNotFound(contentId);
            }
            return _comments[contentId].author;
        }
    }
    
    /**
     * @notice Get content subreddit ID
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @return The subreddit ID
     */
    function getContentSubreddit(uint256 contentId, bool isPost) external view returns (uint256) {
        if (isPost) {
            if (_posts[contentId].id == 0) {
                revert BreadItErrors.PostNotFound(contentId);
            }
            return _posts[contentId].subredditId;
        } else {
            if (_comments[contentId].id == 0) {
                revert BreadItErrors.CommentNotFound(contentId);
            }
            return _posts[_comments[contentId].postId].subredditId;
        }
    }
    
    /**
     * @notice Get content creation time
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @return The creation timestamp
     */
    function getContentCreatedAt(uint256 contentId, bool isPost) external view returns (uint256) {
        if (isPost) {
            if (_posts[contentId].id == 0) {
                revert BreadItErrors.PostNotFound(contentId);
            }
            return _posts[contentId].createdAt;
        } else {
            if (_comments[contentId].id == 0) {
                revert BreadItErrors.CommentNotFound(contentId);
            }
            return _comments[contentId].createdAt;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Set voting contract
     * @param voting The voting contract address
     */
    function setVotingContract(address voting) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (voting == address(0)) {
            revert BreadItErrors.ZeroAddress();
        }
        _grantRole(VOTING_ROLE, voting);
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
     * @notice Validate post creation permissions and content
     * @param subredditId The subreddit ID
     * @param title The post title
     */
    function _validatePostCreation(uint256 subredditId, bytes calldata title) internal view {
        // Validate user registration
        if (!userRegistry.isRegistered(msg.sender)) {
            revert BreadItErrors.UserNotRegistered(msg.sender);
        }
        
        if (userRegistry.isBanned(msg.sender)) {
            revert BreadItErrors.UserIsBanned(msg.sender);
        }
        
        // Check rate limiting
        if (!userRegistry.canPost(msg.sender)) {
            IUserRegistry.UserProfile memory user = userRegistry.getUser(msg.sender);
            revert BreadItErrors.RateLimitExceeded(msg.sender, user.lastPostTime);
        }
        
        // Validate subreddit permissions
        if (!subredditDAO.canUserPost(subredditId, msg.sender)) {
            int256 userKarma = userRegistry.getUserKarma(msg.sender);
            ISubredditDAO.SubredditConfig memory config = subredditDAO.getSubreddit(subredditId);
            revert BreadItErrors.InsufficientKarma(msg.sender, config.minKarmaToPost, userKarma);
        }
        
        // Validate title
        if (title.length == 0) {
            revert BreadItErrors.EmptyContent();
        }
        
        if (title.length > BreadItConstants.MAX_TITLE_LENGTH) {
            revert BreadItErrors.TitleTooLong(title.length, BreadItConstants.MAX_TITLE_LENGTH);
        }
    }
}
