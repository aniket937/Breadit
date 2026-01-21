// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IBreadItCore.sol";
import "./libraries/BreadItErrors.sol";

/**
 * @title UserRegistry
 * @author Bread-it Protocol
 * @notice Manages user identities, karma, and rate limiting for the Bread-it platform
 * @dev Implements wallet-based identity with on-chain karma tracking
 * 
 * SECURITY CONSIDERATIONS:
 * - Karma is non-transferable and bound to wallet address
 * - Auto-ban mechanism for extremely negative karma prevents abuse
 * - Rate limiting based on karma prevents spam from new/low-reputation users
 * - Only authorized contracts can modify karma (PostManager, Voting, Moderation)
 * 
 * GAS OPTIMIZATIONS:
 * - Uses bytes32 for username (fixed size, cheaper than string)
 * - Compact struct packing for UserProfile
 * - Avoids string comparisons where possible
 */
contract UserRegistry is IUserRegistry, ReentrancyGuard, AccessControl {
    using BreadItConstants for *;

    // ═══════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Role that can update karma (assigned to PostManager, Voting, Moderation contracts)
    bytes32 public constant KARMA_MANAGER_ROLE = keccak256("KARMA_MANAGER_ROLE");
    
    /// @notice Role for recording activity (assigned to PostManager)
    bytes32 public constant ACTIVITY_RECORDER_ROLE = keccak256("ACTIVITY_RECORDER_ROLE");

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════
    
    /// @notice Mapping from wallet to user profile
    mapping(address => UserProfile) private _users;
    
    /// @notice Mapping from username to wallet (for uniqueness check)
    mapping(bytes32 => address) private _usernameToWallet;
    
    /// @notice Daily karma tracking for anti-farming
    mapping(address => mapping(uint256 => int256)) private _dailyKarmaGain;
    
    /// @notice Total registered users
    uint256 public totalUsers;
    
    /// @notice Mapping to track all registered addresses for enumeration
    mapping(uint256 => address) private _usersByIndex;

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════
    // EXTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Register a new user with a unique username
     * @param username The desired username as bytes32 (must be unique)
     * @dev Creates on-chain identity with initial karma
     * 
     * Requirements:
     * - Caller must not already be registered
     * - Username must not be empty
     * - Username must not be taken
     * 
     * Effects:
     * - Creates new UserProfile
     * - Assigns initial karma
     * - Emits UserRegistered event
     */
    function registerUser(bytes32 username) external override nonReentrant {
        if (_users[msg.sender].wallet != address(0)) {
            revert BreadItErrors.UserAlreadyRegistered(msg.sender);
        }
        
        if (username == bytes32(0)) {
            revert BreadItErrors.InvalidUsername();
        }
        
        if (_usernameToWallet[username] != address(0)) {
            revert BreadItErrors.UsernameTaken(username);
        }
        
        _users[msg.sender] = UserProfile({
            wallet: msg.sender,
            username: username,
            karma: BreadItConstants.INITIAL_KARMA,
            createdAt: block.timestamp,
            lastPostTime: 0,
            lastCommentTime: 0,
            totalPosts: 0,
            totalComments: 0,
            isBanned: false
        });
        
        _usernameToWallet[username] = msg.sender;
        _usersByIndex[totalUsers] = msg.sender;
        totalUsers++;
        
        emit UserRegistered(msg.sender, username, block.timestamp);
    }
    
    /**
     * @notice Get a user's profile
     * @param wallet The wallet address to look up
     * @return The user's profile struct
     */
    function getUser(address wallet) external view override returns (UserProfile memory) {
        if (_users[wallet].wallet == address(0)) {
            revert BreadItErrors.UserNotRegistered(wallet);
        }
        return _users[wallet];
    }
    
    /**
     * @notice Check if a wallet is registered
     * @param wallet The wallet address to check
     * @return True if registered, false otherwise
     */
    function isRegistered(address wallet) external view override returns (bool) {
        return _users[wallet].wallet != address(0);
    }
    
    /**
     * @notice Update a user's karma
     * @param wallet The wallet address to update
     * @param delta The karma change (positive or negative)
     * @param reason Description of why karma changed
     * @dev Only callable by authorized karma managers
     * 
     * Security:
     * - Implements daily karma gain cap to prevent farming
     * - Automatically bans users below threshold
     * - Logs all karma changes for transparency
     */
    function updateKarma(
        address wallet, 
        int256 delta, 
        string calldata reason
    ) external override onlyRole(KARMA_MANAGER_ROLE) {
        if (_users[wallet].wallet == address(0)) {
            revert BreadItErrors.UserNotRegistered(wallet);
        }
        
        UserProfile storage user = _users[wallet];
        int256 oldKarma = user.karma;
        
        // Apply daily karma gain cap for positive changes
        if (delta > 0) {
            uint256 today = block.timestamp / 1 days;
            int256 todayGain = _dailyKarmaGain[wallet][today];
            
            // Cap daily gain
            if (todayGain + delta > BreadItConstants.MAX_DAILY_KARMA_GAIN) {
                delta = BreadItConstants.MAX_DAILY_KARMA_GAIN - todayGain;
                if (delta <= 0) {
                    return; // Already at daily cap
                }
            }
            _dailyKarmaGain[wallet][today] = todayGain + delta;
        }
        
        user.karma = oldKarma + delta;
        
        // Auto-ban check
        if (user.karma <= BreadItConstants.BAN_KARMA_THRESHOLD && !user.isBanned) {
            user.isBanned = true;
            emit UserBanStatusChanged(wallet, true, "Auto-banned: karma below threshold");
        }
        
        emit KarmaUpdated(wallet, oldKarma, user.karma, reason);
    }
    
    /**
     * @notice Get a user's current karma
     * @param wallet The wallet address
     * @return The user's karma value
     */
    function getUserKarma(address wallet) external view override returns (int256) {
        if (_users[wallet].wallet == address(0)) {
            return 0; // Unregistered users have 0 karma
        }
        return _users[wallet].karma;
    }
    
    /**
     * @notice Check if a user is banned
     * @param wallet The wallet address
     * @return True if banned, false otherwise
     */
    function isBanned(address wallet) external view override returns (bool) {
        return _users[wallet].isBanned;
    }
    
    /**
     * @notice Check if a user can create a post (rate limiting)
     * @param wallet The wallet address
     * @return True if user can post, false if rate limited
     * @dev Rate limiting is based on karma - higher karma = shorter cooldowns
     */
    function canPost(address wallet) external view override returns (bool) {
        UserProfile storage user = _users[wallet];
        
        if (user.wallet == address(0)) {
            return false; // Not registered
        }
        
        if (user.isBanned) {
            return false;
        }
        
        uint256 cooldown = _calculatePostCooldown(user.karma, user.createdAt);
        return block.timestamp >= user.lastPostTime + cooldown;
    }
    
    /**
     * @notice Check if a user can vote
     * @param wallet The wallet address
     * @return True if user can vote
     */
    function canVote(address wallet) external view override returns (bool) {
        UserProfile storage user = _users[wallet];
        
        if (user.wallet == address(0)) {
            return false;
        }
        
        if (user.isBanned) {
            return false;
        }
        
        return user.karma >= BreadItConstants.DEFAULT_MIN_KARMA_TO_VOTE;
    }
    
    /**
     * @notice Record that a user created a post
     * @param wallet The user's wallet
     * @dev Updates last post time and total posts count
     */
    function recordPostActivity(address wallet) external override onlyRole(ACTIVITY_RECORDER_ROLE) {
        UserProfile storage user = _users[wallet];
        if (user.wallet == address(0)) {
            revert BreadItErrors.UserNotRegistered(wallet);
        }
        user.lastPostTime = block.timestamp;
        user.totalPosts++;
    }
    
    /**
     * @notice Record that a user created a comment
     * @param wallet The user's wallet
     * @dev Updates last comment time and total comments count
     */
    function recordCommentActivity(address wallet) external override onlyRole(ACTIVITY_RECORDER_ROLE) {
        UserProfile storage user = _users[wallet];
        if (user.wallet == address(0)) {
            revert BreadItErrors.UserNotRegistered(wallet);
        }
        user.lastCommentTime = block.timestamp;
        user.totalComments++;
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Grant karma manager role to a contract
     * @param manager The contract address to authorize
     * @dev Only admin can call this
     */
    function addKarmaManager(address manager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (manager == address(0)) {
            revert BreadItErrors.ZeroAddress();
        }
        _grantRole(KARMA_MANAGER_ROLE, manager);
    }
    
    /**
     * @notice Grant activity recorder role to a contract
     * @param recorder The contract address to authorize
     */
    function addActivityRecorder(address recorder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (recorder == address(0)) {
            revert BreadItErrors.ZeroAddress();
        }
        _grantRole(ACTIVITY_RECORDER_ROLE, recorder);
    }
    
    /**
     * @notice Manually ban/unban a user (emergency only)
     * @param wallet The user's wallet
     * @param banned Whether to ban or unban
     * @param reason The reason for the action
     * @dev Only admin - should be used sparingly, prefer DAO governance
     */
    function setBanStatus(
        address wallet, 
        bool banned, 
        string calldata reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_users[wallet].wallet == address(0)) {
            revert BreadItErrors.UserNotRegistered(wallet);
        }
        _users[wallet].isBanned = banned;
        emit UserBanStatusChanged(wallet, banned, reason);
    }
    
    // ═══════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Get user address by index for enumeration
     * @param index The index to look up
     * @return The user's wallet address
     */
    function getUserByIndex(uint256 index) external view returns (address) {
        require(index < totalUsers, "Index out of bounds");
        return _usersByIndex[index];
    }
    
    /**
     * @notice Get wallet address for a username
     * @param username The username to look up
     * @return The wallet address (zero if not found)
     */
    function getWalletByUsername(bytes32 username) external view returns (address) {
        return _usernameToWallet[username];
    }
    
    /**
     * @notice Calculate when a user can next post
     * @param wallet The user's wallet
     * @return Timestamp when user can post next
     */
    function getNextPostTime(address wallet) external view returns (uint256) {
        UserProfile storage user = _users[wallet];
        if (user.wallet == address(0)) {
            return type(uint256).max;
        }
        uint256 cooldown = _calculatePostCooldown(user.karma, user.createdAt);
        return user.lastPostTime + cooldown;
    }
    
    /**
     * @notice Calculate when a user can next comment
     * @param wallet The user's wallet
     * @return Timestamp when user can comment next
     */
    function getNextCommentTime(address wallet) external view returns (uint256) {
        UserProfile storage user = _users[wallet];
        if (user.wallet == address(0)) {
            return type(uint256).max;
        }
        uint256 cooldown = _calculateCommentCooldown(user.karma, user.createdAt);
        return user.lastCommentTime + cooldown;
    }
    
    // ═══════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    
    /**
     * @notice Calculate post cooldown based on karma and account age
     * @param karma User's current karma
     * @param createdAt Account creation timestamp
     * @return Cooldown in seconds
     */
    function _calculatePostCooldown(int256 karma, uint256 createdAt) internal view returns (uint256) {
        uint256 baseCooldown = BreadItConstants.BASE_POST_COOLDOWN;
        
        // Trusted accounts (30+ days old with positive karma) get reduced cooldown
        bool isTrusted = (block.timestamp - createdAt >= BreadItConstants.TRUSTED_ACCOUNT_AGE) 
            && karma >= BreadItConstants.REDUCED_COOLDOWN_KARMA;
        
        if (isTrusted) {
            baseCooldown = baseCooldown / BreadItConstants.COOLDOWN_REDUCTION_FACTOR;
        }
        
        // High karma users get further reduction
        if (karma >= 1000) {
            baseCooldown = baseCooldown / 4;
        } else if (karma >= 500) {
            baseCooldown = baseCooldown / 2;
        }
        
        // Minimum 30 seconds cooldown
        return baseCooldown > 30 ? baseCooldown : 30;
    }
    
    /**
     * @notice Calculate comment cooldown based on karma and account age
     * @param karma User's current karma
     * @param createdAt Account creation timestamp
     * @return Cooldown in seconds
     */
    function _calculateCommentCooldown(int256 karma, uint256 createdAt) internal view returns (uint256) {
        uint256 baseCooldown = BreadItConstants.BASE_COMMENT_COOLDOWN;
        
        bool isTrusted = (block.timestamp - createdAt >= BreadItConstants.TRUSTED_ACCOUNT_AGE) 
            && karma >= BreadItConstants.REDUCED_COOLDOWN_KARMA;
        
        if (isTrusted) {
            baseCooldown = baseCooldown / BreadItConstants.COOLDOWN_REDUCTION_FACTOR;
        }
        
        if (karma >= 500) {
            baseCooldown = baseCooldown / 4;
        } else if (karma >= 100) {
            baseCooldown = baseCooldown / 2;
        }
        
        // Minimum 5 seconds cooldown
        return baseCooldown > 5 ? baseCooldown : 5;
    }
}
