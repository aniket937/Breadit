const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

/**
 * Bread-it Protocol Deployment Module using Hardhat Ignition
 * 
 * This module deploys all 6 core contracts and configures their permissions
 * in the correct order with proper dependencies.
 * 
 * Deploy with:
 *   npx hardhat ignition deploy ignition/modules/BreadIt.js --network monadTestnet
 */
module.exports = buildModule("BreadItProtocol", (m) => {
  // ═══════════════════════════════════════════════════════════
  // STEP 1: Deploy Core Contracts
  // ═══════════════════════════════════════════════════════════

  // Deploy UserRegistry (no dependencies)
  const userRegistry = m.contract("UserRegistry");

  // Deploy SubredditDAO (depends on UserRegistry)
  const protocolTreasury = m.getAccount(0); // Use deployer as treasury
  const subredditDAO = m.contract("SubredditDAO", [userRegistry, protocolTreasury]);

  // Deploy PostManager (depends on UserRegistry and SubredditDAO)
  const postManager = m.contract("PostManager", [userRegistry, subredditDAO]);

  // Deploy Voting (depends on UserRegistry)
  const voting = m.contract("Voting", [userRegistry]);

  // Deploy Governance (depends on UserRegistry)
  const governance = m.contract("Governance", [userRegistry]);

  // Deploy Moderation (depends on UserRegistry)
  const moderation = m.contract("Moderation", [userRegistry]);

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Configure Permissions
  // ═══════════════════════════════════════════════════════════

  // UserRegistry: Grant roles to PostManager, Voting, Moderation
  m.call(userRegistry, "addKarmaManager", [voting], { id: "UserRegistry_addKarmaManager_Voting" });
  m.call(userRegistry, "addKarmaManager", [moderation], { id: "UserRegistry_addKarmaManager_Moderation" });
  m.call(userRegistry, "addActivityRecorder", [postManager], { id: "UserRegistry_addActivityRecorder" });

  // SubredditDAO: Grant roles to Governance and PostManager
  m.call(subredditDAO, "setGovernance", [governance], { id: "SubredditDAO_setGovernance" });
  m.call(subredditDAO, "setPostManager", [postManager], { id: "SubredditDAO_setPostManager" });

  // PostManager: Grant roles to Voting and Moderation
  m.call(postManager, "setVotingContract", [voting], { id: "PostManager_setVotingContract" });
  m.call(postManager, "setModerationContract", [moderation], { id: "PostManager_setModerationContract" });

  // Voting: Set dependencies
  m.call(voting, "setPostManager", [postManager], { id: "Voting_setPostManager" });
  m.call(voting, "setSubredditDAO", [subredditDAO], { id: "Voting_setSubredditDAO" });
  m.call(voting, "setModerationContract", [moderation], { id: "Voting_setModerationContract" });

  // Governance: Set dependencies
  m.call(governance, "setSubredditDAO", [subredditDAO], { id: "Governance_setSubredditDAO" });

  // Moderation: Set dependencies
  m.call(moderation, "setPostManager", [postManager], { id: "Moderation_setPostManager" });
  m.call(moderation, "setSubredditDAO", [subredditDAO], { id: "Moderation_setSubredditDAO" });
  m.call(moderation, "setVoting", [voting], { id: "Moderation_setVoting" });

  // ═══════════════════════════════════════════════════════════
  // Return all deployed contracts
  // ═══════════════════════════════════════════════════════════

  return {
    userRegistry,
    subredditDAO,
    postManager,
    voting,
    governance,
    moderation,
  };
});
