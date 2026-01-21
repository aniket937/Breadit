const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

/**
 * @title Bread-it Protocol Tests
 * @notice Comprehensive test suite for all contracts
 */
describe("Bread-it Protocol", function () {
  // ═══════════════════════════════════════════════════════════
  // FIXTURES
  // ═══════════════════════════════════════════════════════════

  async function deployProtocolFixture() {
    const [deployer, user1, user2, user3, moderator] = await ethers.getSigners();

    // Deploy UserRegistry
    const UserRegistry = await ethers.getContractFactory("UserRegistry");
    const userRegistry = await UserRegistry.deploy();
    await userRegistry.waitForDeployment();

    // Deploy SubredditDAO
    const SubredditDAO = await ethers.getContractFactory("SubredditDAO");
    const subredditDAO = await SubredditDAO.deploy(
      await userRegistry.getAddress(),
      deployer.address
    );
    await subredditDAO.waitForDeployment();

    // Deploy PostManager
    const PostManager = await ethers.getContractFactory("PostManager");
    const postManager = await PostManager.deploy(
      await userRegistry.getAddress(),
      await subredditDAO.getAddress()
    );
    await postManager.waitForDeployment();

    // Deploy Voting
    const Voting = await ethers.getContractFactory("Voting");
    const voting = await Voting.deploy(await userRegistry.getAddress());
    await voting.waitForDeployment();

    // Deploy Governance
    const Governance = await ethers.getContractFactory("Governance");
    const governance = await Governance.deploy(await userRegistry.getAddress());
    await governance.waitForDeployment();

    // Deploy Moderation
    const Moderation = await ethers.getContractFactory("Moderation");
    const moderation = await Moderation.deploy(await userRegistry.getAddress());
    await moderation.waitForDeployment();

    // Configure permissions
    await userRegistry.addKarmaManager(await voting.getAddress());
    await userRegistry.addKarmaManager(await moderation.getAddress());
    await userRegistry.addActivityRecorder(await postManager.getAddress());

    await subredditDAO.setGovernance(await governance.getAddress());
    await subredditDAO.setPostManager(await postManager.getAddress());

    await postManager.setVotingContract(await voting.getAddress());
    await postManager.setModerationContract(await moderation.getAddress());

    await voting.setPostManager(await postManager.getAddress());
    await voting.setSubredditDAO(await subredditDAO.getAddress());
    await voting.setModerationContract(await moderation.getAddress());

    await governance.setSubredditDAO(await subredditDAO.getAddress());

    await moderation.setPostManager(await postManager.getAddress());
    await moderation.setSubredditDAO(await subredditDAO.getAddress());
    await moderation.setVoting(await voting.getAddress());

    return {
      userRegistry,
      subredditDAO,
      postManager,
      voting,
      governance,
      moderation,
      deployer,
      user1,
      user2,
      user3,
      moderator,
    };
  }

  async function registeredUsersFixture() {
    const contracts = await loadFixture(deployProtocolFixture);
    const { userRegistry, user1, user2, user3 } = contracts;

    // Register users
    await userRegistry.connect(user1).registerUser(ethers.encodeBytes32String("alice"));
    await userRegistry.connect(user2).registerUser(ethers.encodeBytes32String("bob"));
    await userRegistry.connect(user3).registerUser(ethers.encodeBytes32String("charlie"));

    return contracts;
  }

  async function subredditCreatedFixture() {
    const contracts = await loadFixture(registeredUsersFixture);
    const { subredditDAO, user1 } = contracts;

    // Create subreddit
    const tx = await subredditDAO.connect(user1).createSubreddit(
      ethers.encodeBytes32String("test_sub"),
      ethers.toUtf8Bytes("A test subreddit for testing"),
      1, // minKarmaToPost
      0, // minKarmaToComment
      60, // postCooldown (1 minute)
      { value: ethers.parseEther("0.1") }
    );
    await tx.wait();

    return { ...contracts, subredditId: 1 };
  }

  // ═══════════════════════════════════════════════════════════
  // USER REGISTRY TESTS
  // ═══════════════════════════════════════════════════════════

  describe("UserRegistry", function () {
    it("Should register a new user", async function () {
      const { userRegistry, user1 } = await loadFixture(deployProtocolFixture);

      await expect(
        userRegistry.connect(user1).registerUser(ethers.encodeBytes32String("alice"))
      ).to.emit(userRegistry, "UserRegistered");

      expect(await userRegistry.isRegistered(user1.address)).to.be.true;
    });

    it("Should not allow duplicate registration", async function () {
      const { userRegistry, user1 } = await loadFixture(registeredUsersFixture);

      await expect(
        userRegistry.connect(user1).registerUser(ethers.encodeBytes32String("alice2"))
      ).to.be.revertedWithCustomError(userRegistry, "UserAlreadyRegistered");
    });

    it("Should not allow duplicate username", async function () {
      const { userRegistry, user1, moderator } = await loadFixture(registeredUsersFixture);

      await expect(
        userRegistry.connect(moderator).registerUser(ethers.encodeBytes32String("alice"))
      ).to.be.revertedWithCustomError(userRegistry, "UsernameTaken");
    });

    it("Should initialize karma correctly", async function () {
      const { userRegistry, user1 } = await loadFixture(registeredUsersFixture);

      const karma = await userRegistry.getUserKarma(user1.address);
      expect(karma).to.equal(1); // INITIAL_KARMA
    });

    it("Should track user profile correctly", async function () {
      const { userRegistry, user1 } = await loadFixture(registeredUsersFixture);

      const profile = await userRegistry.getUser(user1.address);
      expect(profile.wallet).to.equal(user1.address);
      expect(profile.username).to.equal(ethers.encodeBytes32String("alice"));
      expect(profile.karma).to.equal(1);
      expect(profile.isBanned).to.be.false;
    });

    it("Should allow karma updates from authorized contracts", async function () {
      const { userRegistry, voting, user1 } = await loadFixture(registeredUsersFixture);

      // Voting contract is a karma manager
      const votingAddress = await voting.getAddress();
      
      // Simulate karma update (would normally come from voting)
      await userRegistry.updateKarma(user1.address, 10, "Test karma update");
      
      const newKarma = await userRegistry.getUserKarma(user1.address);
      expect(newKarma).to.equal(11); // 1 initial + 10
    });
  });

  // ═══════════════════════════════════════════════════════════
  // SUBREDDIT DAO TESTS
  // ═══════════════════════════════════════════════════════════

  describe("SubredditDAO", function () {
    it("Should create a subreddit with payment", async function () {
      const { subredditDAO, user1 } = await loadFixture(registeredUsersFixture);

      await expect(
        subredditDAO.connect(user1).createSubreddit(
          ethers.encodeBytes32String("my_sub"),
          ethers.toUtf8Bytes("My awesome subreddit"),
          1,
          0,
          60,
          { value: ethers.parseEther("0.1") }
        )
      ).to.emit(subredditDAO, "SubredditCreated");
    });

    it("Should not create subreddit without payment", async function () {
      const { subredditDAO, user1 } = await loadFixture(registeredUsersFixture);

      await expect(
        subredditDAO.connect(user1).createSubreddit(
          ethers.encodeBytes32String("my_sub"),
          ethers.toUtf8Bytes("My awesome subreddit"),
          1,
          0,
          60,
          { value: ethers.parseEther("0.05") } // Less than required
        )
      ).to.be.revertedWithCustomError(subredditDAO, "InsufficientStake");
    });

    it("Should not allow duplicate subreddit names", async function () {
      const { subredditDAO, user1, user2 } = await loadFixture(subredditCreatedFixture);

      await expect(
        subredditDAO.connect(user2).createSubreddit(
          ethers.encodeBytes32String("test_sub"),
          ethers.toUtf8Bytes("Another subreddit"),
          1,
          0,
          60,
          { value: ethers.parseEther("0.1") }
        )
      ).to.be.revertedWithCustomError(subredditDAO, "SubredditNameTaken");
    });

    it("Should set creator as moderator", async function () {
      const { subredditDAO, user1, subredditId } = await loadFixture(subredditCreatedFixture);

      expect(await subredditDAO.isModerator(subredditId, user1.address)).to.be.true;
    });

    it("Should allow joining a subreddit", async function () {
      const { subredditDAO, user2, subredditId } = await loadFixture(subredditCreatedFixture);

      await subredditDAO.connect(user2).joinSubreddit(subredditId);
      expect(await subredditDAO.isMember(user2.address, subredditId)).to.be.true;
    });

    it("Should track member count", async function () {
      const { subredditDAO, user2, subredditId } = await loadFixture(subredditCreatedFixture);

      const countBefore = await subredditDAO.memberCount(subredditId);
      await subredditDAO.connect(user2).joinSubreddit(subredditId);
      const countAfter = await subredditDAO.memberCount(subredditId);

      expect(countAfter).to.equal(countBefore + 1n);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // POST MANAGER TESTS
  // ═══════════════════════════════════════════════════════════

  describe("PostManager", function () {
    it("Should create a text post", async function () {
      const { postManager, subredditDAO, user1, subredditId } = await loadFixture(
        subredditCreatedFixture
      );

      // Need to wait for cooldown from subreddit creation
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        postManager.connect(user1).createTextPost(
          subredditId,
          ethers.toUtf8Bytes("Test Post Title"),
          ethers.toUtf8Bytes("This is the body of my test post")
        )
      ).to.emit(postManager, "PostCreated");
    });

    it("Should create a media post with IPFS CID", async function () {
      const { postManager, user1, subredditId } = await loadFixture(subredditCreatedFixture);

      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);

      const ipfsCid = "QmXnnyufdzAWL5CqZ2RnSNgPbvCc1ALT73s6epPrRnZ1Xy";

      await expect(
        postManager.connect(user1).createMediaPost(
          subredditId,
          ethers.toUtf8Bytes("Meme Title"),
          ethers.toUtf8Bytes(ipfsCid),
          ethers.encodeBytes32String("image/png"),
          true // isMeme
        )
      ).to.emit(postManager, "PostCreated");
    });

    it("Should not allow posts from unregistered users", async function () {
      const { postManager, moderator, subredditId } = await loadFixture(subredditCreatedFixture);

      await expect(
        postManager.connect(moderator).createTextPost(
          subredditId,
          ethers.toUtf8Bytes("Title"),
          ethers.toUtf8Bytes("Body")
        )
      ).to.be.revertedWithCustomError(postManager, "UserNotRegistered");
    });

    it("Should enforce rate limiting", async function () {
      const { postManager, user1, subredditId } = await loadFixture(subredditCreatedFixture);

      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);

      // First post should succeed
      await postManager.connect(user1).createTextPost(
        subredditId,
        ethers.toUtf8Bytes("First Post"),
        ethers.toUtf8Bytes("First body")
      );

      // Second post immediately should fail
      await expect(
        postManager.connect(user1).createTextPost(
          subredditId,
          ethers.toUtf8Bytes("Second Post"),
          ethers.toUtf8Bytes("Second body")
        )
      ).to.be.revertedWithCustomError(postManager, "RateLimitExceeded");
    });

    it("Should create comments", async function () {
      const { postManager, user1, user2, subredditId } = await loadFixture(
        subredditCreatedFixture
      );

      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);

      await postManager.connect(user1).createTextPost(
        subredditId,
        ethers.toUtf8Bytes("Post Title"),
        ethers.toUtf8Bytes("Post body")
      );

      // User2 comments
      await expect(
        postManager.connect(user2).createComment(
          1, // postId
          0, // parentId (top-level)
          ethers.toUtf8Bytes("This is a comment!")
        )
      ).to.emit(postManager, "CommentCreated");
    });

    it("Should create nested comments", async function () {
      const { postManager, user1, user2, user3, subredditId } = await loadFixture(
        subredditCreatedFixture
      );

      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);

      await postManager.connect(user1).createTextPost(
        subredditId,
        ethers.toUtf8Bytes("Post Title"),
        ethers.toUtf8Bytes("Post body")
      );

      // First comment
      await postManager.connect(user2).createComment(
        1,
        0,
        ethers.toUtf8Bytes("First comment")
      );

      // Reply to first comment
      await postManager.connect(user3).createComment(
        1,
        1, // parentId = first comment
        ethers.toUtf8Bytes("Reply to first comment")
      );

      const replies = await postManager.getCommentReplies(1);
      expect(replies.length).to.equal(1);
      expect(replies[0]).to.equal(2n);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // VOTING TESTS
  // ═══════════════════════════════════════════════════════════

  describe("Voting", function () {
    async function postCreatedFixture() {
      const contracts = await loadFixture(subredditCreatedFixture);
      const { postManager, user1, subredditId } = contracts;

      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);

      await postManager.connect(user1).createTextPost(
        subredditId,
        ethers.toUtf8Bytes("Post for Voting"),
        ethers.toUtf8Bytes("Vote on this post")
      );

      return { ...contracts, postId: 1 };
    }

    it("Should allow upvoting with stake", async function () {
      const { voting, user2, postId } = await loadFixture(postCreatedFixture);

      await expect(
        voting.connect(user2).vote(postId, true, 1, {
          // 1 = Upvote
          value: ethers.parseEther("0.001"),
        })
      ).to.emit(voting, "Voted");
    });

    it("Should require minimum stake for upvote", async function () {
      const { voting, user2, postId } = await loadFixture(postCreatedFixture);

      await expect(
        voting.connect(user2).vote(postId, true, 1, {
          value: ethers.parseEther("0.0005"), // Less than minimum
        })
      ).to.be.revertedWithCustomError(voting, "InsufficientStake");
    });

    it("Should require higher stake for downvote", async function () {
      const { voting, user2, postId } = await loadFixture(postCreatedFixture);

      // Upvote stake should fail for downvote
      await expect(
        voting.connect(user2).vote(postId, true, 2, {
          // 2 = Downvote
          value: ethers.parseEther("0.001"),
        })
      ).to.be.revertedWithCustomError(voting, "InsufficientStake");

      // Correct downvote stake should work
      await expect(
        voting.connect(user2).vote(postId, true, 2, {
          value: ethers.parseEther("0.005"),
        })
      ).to.emit(voting, "Voted");
    });

    it("Should prevent self-voting", async function () {
      const { voting, user1, postId } = await loadFixture(postCreatedFixture);

      await expect(
        voting.connect(user1).vote(postId, true, 1, {
          value: ethers.parseEther("0.001"),
        })
      ).to.be.revertedWithCustomError(voting, "CannotVoteOwnContent");
    });

    it("Should prevent double voting", async function () {
      const { voting, user2, postId } = await loadFixture(postCreatedFixture);

      await voting.connect(user2).vote(postId, true, 1, {
        value: ethers.parseEther("0.001"),
      });

      await expect(
        voting.connect(user2).vote(postId, true, 1, {
          value: ethers.parseEther("0.001"),
        })
      ).to.be.revertedWithCustomError(voting, "AlreadyVoted");
    });

    it("Should update post score", async function () {
      const { voting, postManager, user2, user3, postId } = await loadFixture(
        postCreatedFixture
      );

      await voting.connect(user2).vote(postId, true, 1, {
        value: ethers.parseEther("0.001"),
      });

      await voting.connect(user3).vote(postId, true, 1, {
        value: ethers.parseEther("0.001"),
      });

      const post = await postManager.getPost(postId);
      expect(post.score).to.equal(2);
    });

    it("Should update author karma on votes", async function () {
      const { voting, userRegistry, user1, user2, postId } = await loadFixture(
        postCreatedFixture
      );

      const karmaBefore = await userRegistry.getUserKarma(user1.address);

      await voting.connect(user2).vote(postId, true, 1, {
        value: ethers.parseEther("0.001"),
      });

      const karmaAfter = await userRegistry.getUserKarma(user1.address);
      expect(karmaAfter).to.be.greaterThan(karmaBefore);
    });

    it("Should allow stake withdrawal after lock period", async function () {
      const { voting, user2, postId } = await loadFixture(postCreatedFixture);

      await voting.connect(user2).vote(postId, true, 1, {
        value: ethers.parseEther("0.001"),
      });

      // Fast forward past lock period (24 hours)
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      const balanceBefore = await ethers.provider.getBalance(user2.address);

      await voting.connect(user2).withdrawStake(postId, true);

      const balanceAfter = await ethers.provider.getBalance(user2.address);
      expect(balanceAfter).to.be.greaterThan(balanceBefore);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // MODERATION TESTS
  // ═══════════════════════════════════════════════════════════

  describe("Moderation", function () {
    async function postForModerationFixture() {
      const contracts = await loadFixture(subredditCreatedFixture);
      const { postManager, user1, subredditId } = contracts;

      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);

      await postManager.connect(user1).createTextPost(
        subredditId,
        ethers.toUtf8Bytes("Controversial Post"),
        ethers.toUtf8Bytes("This might need moderation")
      );

      return { ...contracts, postId: 1 };
    }

    it("Should allow reporting content", async function () {
      const { moderation, user2, postId } = await loadFixture(postForModerationFixture);

      await expect(
        moderation
          .connect(user2)
          .reportContent(postId, true, ethers.toUtf8Bytes("Spam content"))
      ).to.emit(moderation, "ContentReported");
    });

    it("Should prevent self-reporting", async function () {
      const { moderation, user1, postId } = await loadFixture(postForModerationFixture);

      await expect(
        moderation
          .connect(user1)
          .reportContent(postId, true, ethers.toUtf8Bytes("Self report"))
      ).to.be.revertedWithCustomError(moderation, "CannotReportOwnContent");
    });

    it("Should enforce report cooldown", async function () {
      const { moderation, postManager, user1, user2, subredditId, postId } = await loadFixture(
        postForModerationFixture
      );

      // Create second post
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);

      await postManager.connect(user1).createTextPost(
        subredditId,
        ethers.toUtf8Bytes("Another Post"),
        ethers.toUtf8Bytes("Another body")
      );

      // First report
      await moderation
        .connect(user2)
        .reportContent(postId, true, ethers.toUtf8Bytes("First report"));

      // Second report immediately should fail
      await expect(
        moderation.connect(user2).reportContent(2, true, ethers.toUtf8Bytes("Second report"))
      ).to.be.revertedWithCustomError(moderation, "RateLimitExceeded");
    });

    it("Should allow moderator to resolve reports", async function () {
      const { moderation, user1, user2, postId } = await loadFixture(
        postForModerationFixture
      );

      await moderation
        .connect(user2)
        .reportContent(postId, true, ethers.toUtf8Bytes("Spam"));

      // user1 is moderator (created subreddit)
      await expect(
        moderation
          .connect(user1)
          .resolveReport(1, true, ethers.toUtf8Bytes("hide"))
      ).to.emit(moderation, "ModerationActionTaken");
    });

    it("Should hide content when report is upheld", async function () {
      const { moderation, postManager, user1, user2, postId } = await loadFixture(
        postForModerationFixture
      );

      await moderation
        .connect(user2)
        .reportContent(postId, true, ethers.toUtf8Bytes("Spam"));

      await moderation.connect(user1).resolveReport(1, true, ethers.toUtf8Bytes("hide"));

      const post = await postManager.getPost(postId);
      expect(post.status).to.equal(1); // ContentStatus.Hidden
    });

    it("Should slash karma when content is hidden", async function () {
      const { moderation, userRegistry, user1, user2, postId } = await loadFixture(
        postForModerationFixture
      );

      const karmaBefore = await userRegistry.getUserKarma(user1.address);

      await moderation
        .connect(user2)
        .reportContent(postId, true, ethers.toUtf8Bytes("Spam"));

      await moderation.connect(user1).resolveReport(1, true, ethers.toUtf8Bytes("hide"));

      const karmaAfter = await userRegistry.getUserKarma(user1.address);
      expect(karmaAfter).to.be.lessThan(karmaBefore);
    });
  });
});
