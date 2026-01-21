// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IBreadItCore.sol";
import "./libraries/BreadItErrors.sol";

/**
 * @title Moderation
 * @author Bread-it Protocol
 * @notice Decentralized content moderation system
 * @dev Implements transparent, on-chain moderation with full logging
 * 
 * MODERATION PHILOSOPHY:
 * - NO content is ever deleted - only soft-hidden
 * - All moderation actions are logged permanently
 * - Moderators are accountable to the DAO
 * - Users can appeal through governance
 * - Economic penalties (karma slashing) deter abuse
 * 
 * PROCESS:
 * 1. Users report content with reason
 * 2. If report threshold reached, auto-flagged for review
 * 3. Moderators can hide content
 * 4. Karma penalties applied to violators
 * 5. All actions visible on-chain for transparency
 * 
 * ANTI-ABUSE:
 * - Report cooldowns prevent spam reports
 * - Frivolous reports penalize reporter
 * - Moderators can be removed via governance
 */
contract Moderation is IModeration, ReentrancyGuard, AccessControl {
    using BreadItConstants for *;

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════
    
    /// @notice User registry for karma updates
    IUserRegistry public immutable userRegistry;
    
    /// @notice Post manager for content status updates
    IPostManager public postManager;
    
    /// @notice Subreddit DAO for moderator checks
    ISubredditDAO public subredditDAO;
    
    /// @notice Voting contract for stake slashing
    IVoting public voting;
    
    /// @notice Total reports created
    uint256 public reportCount;
    
    /// @notice Total moderation actions taken
    uint256 public actionCount;
    
    /// @notice Mapping from report ID to report
    mapping(uint256 => Report) private _reports;
    
    /// @notice Mapping from content ID to isPost to report IDs
    mapping(uint256 => mapping(bool => uint256[])) private _contentReports;
    
    /// @notice Mapping from reporter to last report time (cooldown)
    mapping(address => uint256) private _lastReportTime;
    
    /// @notice Mapping from reporter to content ID to isPost to has reported
    mapping(address => mapping(uint256 => mapping(bool => bool))) private _hasReported;
    
    /// @notice Mapping from action ID to action
    mapping(uint256 => ModerationAction) private _actions;
    
    /// @notice Mapping from content ID to isPost to action IDs
    mapping(uint256 => mapping(bool => uint256[])) private _contentActions;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════
    
    event ContentFlagged(
        uint256 indexed contentId,
        bool isPost,
        uint256 reportCount,
        uint256 timestamp
    );
    
    event KarmaSlashed(
        address indexed user,
        int256 amount,
        string reason,
        uint256 timestamp
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
    // EXTERNAL FUNCTIONS - REPORTING
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Report content for moderation
     * @param contentId The content ID to report
     * @param isPost Whether this is a post or comment
     * @param reason The reason for reporting (bytes)
     * @return reportId The ID of the created report
     * 
     * Requirements:
     * - Reporter must be registered
     * - Cannot report own content
     * - Must wait for report cooldown
     * - Cannot report same content twice
     */
    function reportContent(
        uint256 contentId,
        bool isPost,
        bytes calldata reason
    ) external override nonReentrant returns (uint256) {
        // Validate reporter
        if (!userRegistry.isRegistered(msg.sender)) {
            revert BreadItErrors.UserNotRegistered(msg.sender);
        }
        
        if (userRegistry.isBanned(msg.sender)) {
            revert BreadItErrors.UserIsBanned(msg.sender);
        }
        
        // Check cooldown
        if (block.timestamp < _lastReportTime[msg.sender] + BreadItConstants.REPORT_COOLDOWN) {
            revert BreadItErrors.RateLimitExceeded(
                msg.sender, 
                _lastReportTime[msg.sender] + BreadItConstants.REPORT_COOLDOWN
            );
        }
        
        // Check duplicate
        if (_hasReported[msg.sender][contentId][isPost]) {
            revert BreadItErrors.DuplicateReport(contentId, isPost, msg.sender);
        }
        
        // Get content author
        address author = postManager.getContentAuthor(contentId, isPost);
        
        if (author == msg.sender) {
            revert BreadItErrors.CannotReportOwnContent(msg.sender);
        }
        
        // Create report
        reportCount++;
        uint256 reportId = reportCount;
        
        _reports[reportId] = Report({
            id: reportId,
            contentId: contentId,
            isPost: isPost,
            reporter: msg.sender,
            reason: reason,
            timestamp: block.timestamp,
            resolved: false,
            upheld: false
        });
        
        _contentReports[contentId][isPost].push(reportId);
        _lastReportTime[msg.sender] = block.timestamp;
        _hasReported[msg.sender][contentId][isPost] = true;
        
        emit ContentReported(reportId, contentId, isPost, msg.sender, block.timestamp);
        
        // Check if auto-flag threshold reached
        uint256 reportCountForContent = _contentReports[contentId][isPost].length;
        if (reportCountForContent >= BreadItConstants.REPORTS_FOR_AUTO_REVIEW) {
            // Auto-flag content for review
            postManager.setContentStatus(contentId, isPost, ContentStatus.Flagged, "Auto-flagged: report threshold");
            emit ContentFlagged(contentId, isPost, reportCountForContent, block.timestamp);
        }
        
        return reportId;
    }
    
    /**
     * @notice Resolve a report (moderator only)
     * @param reportId The report ID
     * @param uphold Whether to uphold the report
     * @param action The moderation action taken (if upheld)
     * 
     * Effects:
     * - If upheld: content is hidden, author karma slashed
     * - If not upheld: reporter may be penalized for frivolous report
     */
    function resolveReport(
        uint256 reportId,
        bool uphold,
        bytes calldata action
    ) external override nonReentrant {
        Report storage report = _reports[reportId];
        
        if (report.id == 0) {
            revert BreadItErrors.ReportNotFound(reportId);
        }
        
        if (report.resolved) {
            revert BreadItErrors.ReportAlreadyResolved(reportId);
        }
        
        // Get subreddit and verify moderator
        uint256 subredditId = postManager.getContentSubreddit(report.contentId, report.isPost);
        
        if (!subredditDAO.isModerator(subredditId, msg.sender)) {
            revert BreadItErrors.NotAuthorizedModerator(msg.sender);
        }
        
        report.resolved = true;
        report.upheld = uphold;
        
        // Record moderation action
        actionCount++;
        uint256 actionId = actionCount;
        
        _actions[actionId] = ModerationAction({
            id: actionId,
            contentId: report.contentId,
            isPost: report.isPost,
            moderator: msg.sender,
            action: action,
            reason: report.reason,
            timestamp: block.timestamp
        });
        
        _contentActions[report.contentId][report.isPost].push(actionId);
        
        if (uphold) {
            // Hide content
            postManager.setContentStatus(
                report.contentId, 
                report.isPost, 
                ContentStatus.Hidden, 
                "Moderator action: report upheld"
            );
            
            // Slash author karma
            address author = postManager.getContentAuthor(report.contentId, report.isPost);
            userRegistry.updateKarma(
                author, 
                BreadItConstants.KARMA_PENALTY_CONTENT_HIDDEN, 
                "Content hidden by moderation"
            );
            
            emit KarmaSlashed(
                author, 
                BreadItConstants.KARMA_PENALTY_CONTENT_HIDDEN, 
                "Content hidden", 
                block.timestamp
            );
            
            // Reward reporter
            userRegistry.updateKarma(
                report.reporter, 
                BreadItConstants.KARMA_BONUS_VALID_REPORT, 
                "Valid report submitted"
            );
        } else {
            // Penalize frivolous reporter (optional, based on action data)
            if (action.length > 0 && keccak256(action) == keccak256("frivolous")) {
                userRegistry.updateKarma(
                    report.reporter,
                    BreadItConstants.KARMA_PENALTY_FRIVOLOUS_REPORT,
                    "Frivolous report"
                );
                
                emit KarmaSlashed(
                    report.reporter,
                    BreadItConstants.KARMA_PENALTY_FRIVOLOUS_REPORT,
                    "Frivolous report",
                    block.timestamp
                );
            }
        }
        
        emit ModerationActionTaken(
            actionId, 
            report.contentId, 
            report.isPost, 
            msg.sender, 
            action, 
            block.timestamp
        );
        
        emit ReportResolved(reportId, uphold, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Moderator direct action (without report)
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @param hide Whether to hide the content
     * @param slashKarma Whether to slash author karma
     * @param reason The reason for action
     * 
     * For urgent cases where moderators need to act immediately
     */
    function moderatorAction(
        uint256 contentId,
        bool isPost,
        bool hide,
        bool slashKarma,
        bytes calldata reason
    ) external nonReentrant {
        // Get subreddit and verify moderator
        uint256 subredditId = postManager.getContentSubreddit(contentId, isPost);
        
        if (!subredditDAO.isModerator(subredditId, msg.sender)) {
            revert BreadItErrors.NotAuthorizedModerator(msg.sender);
        }
        
        // Record action
        actionCount++;
        uint256 actionId = actionCount;
        
        bytes memory actionBytes = abi.encode(hide, slashKarma);
        
        _actions[actionId] = ModerationAction({
            id: actionId,
            contentId: contentId,
            isPost: isPost,
            moderator: msg.sender,
            action: actionBytes,
            reason: reason,
            timestamp: block.timestamp
        });
        
        _contentActions[contentId][isPost].push(actionId);
        
        if (hide) {
            postManager.setContentStatus(
                contentId, 
                isPost, 
                ContentStatus.Hidden, 
                "Moderator direct action"
            );
        }
        
        if (slashKarma) {
            address author = postManager.getContentAuthor(contentId, isPost);
            userRegistry.updateKarma(
                author, 
                BreadItConstants.KARMA_PENALTY_CONTENT_HIDDEN, 
                "Moderator karma penalty"
            );
            
            emit KarmaSlashed(
                author, 
                BreadItConstants.KARMA_PENALTY_CONTENT_HIDDEN, 
                "Moderator action", 
                block.timestamp
            );
        }
        
        emit ModerationActionTaken(
            actionId, 
            contentId, 
            isPost, 
            msg.sender, 
            actionBytes, 
            block.timestamp
        );
    }
    
    /**
     * @notice Unhide content (moderator only)
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @param reason The reason for unhiding
     */
    function unhideContent(
        uint256 contentId,
        bool isPost,
        bytes calldata reason
    ) external nonReentrant {
        uint256 subredditId = postManager.getContentSubreddit(contentId, isPost);
        
        if (!subredditDAO.isModerator(subredditId, msg.sender)) {
            revert BreadItErrors.NotAuthorizedModerator(msg.sender);
        }
        
        postManager.setContentStatus(
            contentId, 
            isPost, 
            ContentStatus.Visible, 
            "Moderator unhide"
        );
        
        // Record action
        actionCount++;
        uint256 actionId = actionCount;
        
        bytes memory actionBytes = abi.encode("unhide");
        
        _actions[actionId] = ModerationAction({
            id: actionId,
            contentId: contentId,
            isPost: isPost,
            moderator: msg.sender,
            action: actionBytes,
            reason: reason,
            timestamp: block.timestamp
        });
        
        _contentActions[contentId][isPost].push(actionId);
        
        emit ModerationActionTaken(actionId, contentId, isPost, msg.sender, actionBytes, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Get a report by ID
     * @param reportId The report ID
     * @return The report struct
     */
    function getReport(uint256 reportId) external view override returns (Report memory) {
        if (_reports[reportId].id == 0) {
            revert BreadItErrors.ReportNotFound(reportId);
        }
        return _reports[reportId];
    }
    
    /**
     * @notice Get all report IDs for content
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @return reportIds Array of report IDs
     */
    function getContentReports(
        uint256 contentId, 
        bool isPost
    ) external view override returns (uint256[] memory) {
        return _contentReports[contentId][isPost];
    }
    
    /**
     * @notice Get moderation action by ID
     * @param actionId The action ID
     * @return The moderation action struct
     */
    function getModerationAction(uint256 actionId) external view returns (ModerationAction memory) {
        return _actions[actionId];
    }
    
    /**
     * @notice Get all moderation actions for content
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @return actionIds Array of action IDs
     */
    function getContentActions(
        uint256 contentId,
        bool isPost
    ) external view returns (uint256[] memory) {
        return _contentActions[contentId][isPost];
    }
    
    /**
     * @notice Get report count for content
     * @param contentId The content ID
     * @param isPost Whether this is a post or comment
     * @return count Number of reports
     */
    function getReportCount(uint256 contentId, bool isPost) external view returns (uint256) {
        return _contentReports[contentId][isPost].length;
    }
    
    /**
     * @notice Check if user can report (cooldown check)
     * @param reporter The reporter address
     * @return canReportNow Whether they can report now
     * @return nextReportTime When they can report next
     */
    function canReport(address reporter) external view returns (bool canReportNow, uint256 nextReportTime) {
        nextReportTime = _lastReportTime[reporter] + BreadItConstants.REPORT_COOLDOWN;
        canReportNow = block.timestamp >= nextReportTime;
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
     * @notice Set voting contract (for stake slashing)
     * @param _voting The voting contract address
     */
    function setVoting(address _voting) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_voting == address(0)) {
            revert BreadItErrors.ZeroAddress();
        }
        voting = IVoting(_voting);
    }
}
