/**
 * Contract ABIs for Bread-it Protocol
 * These are simplified ABIs with only the functions we need
 */

export const UserRegistryABI = [
  {
    inputs: [{ name: 'username', type: 'bytes32' }],
    name: 'registerUser',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'wallet', type: 'address' }],
    name: 'getUser',
    outputs: [
      {
        components: [
          { name: 'wallet', type: 'address' },
          { name: 'username', type: 'bytes32' },
          { name: 'karma', type: 'int256' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'lastPostTime', type: 'uint256' },
          { name: 'lastCommentTime', type: 'uint256' },
          { name: 'totalPosts', type: 'uint256' },
          { name: 'totalComments', type: 'uint256' },
          { name: 'isBanned', type: 'bool' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'wallet', type: 'address' }],
    name: 'isRegistered',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'wallet', type: 'address' }],
    name: 'getUserKarma',
    outputs: [{ type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'wallet', type: 'address' }],
    name: 'isBanned',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'wallet', type: 'address' }],
    name: 'canPost',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'wallet', type: 'address' }],
    name: 'getNextPostTime',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalUsers',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'wallet', type: 'address' },
      { indexed: false, name: 'username', type: 'bytes32' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'UserRegistered',
    type: 'event',
  },
] as const;

export const SubredditDAOABI = [
  {
    inputs: [
      { name: 'name', type: 'bytes32' },
      { name: 'description', type: 'bytes' },
      { name: 'minKarmaToPost', type: 'int256' },
      { name: 'minKarmaToComment', type: 'int256' },
      { name: 'postCooldown', type: 'uint256' },
    ],
    name: 'createSubreddit',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'subredditId', type: 'uint256' }],
    name: 'getSubreddit',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'name', type: 'bytes32' },
          { name: 'description', type: 'bytes' },
          { name: 'creator', type: 'address' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'minKarmaToPost', type: 'int256' },
          { name: 'minKarmaToComment', type: 'int256' },
          { name: 'minKarmaToVote', type: 'int256' },
          { name: 'postCooldown', type: 'uint256' },
          { name: 'commentCooldown', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'subredditId', type: 'uint256' }],
    name: 'joinSubreddit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'subredditId', type: 'uint256' }],
    name: 'leaveSubreddit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'subredditId', type: 'uint256' },
    ],
    name: 'isMember',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'subredditId', type: 'uint256' }],
    name: 'memberCount',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'subredditId', type: 'uint256' },
      { name: 'wallet', type: 'address' },
    ],
    name: 'isModerator',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'subredditId', type: 'uint256' }],
    name: 'getModerators',
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'name', type: 'bytes32' }],
    name: 'getSubredditIdByName',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'subredditCount',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'subredditId', type: 'uint256' },
      { indexed: false, name: 'name', type: 'bytes32' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'SubredditCreated',
    type: 'event',
  },
] as const;

export const PostManagerABI = [
  {
    inputs: [
      { name: 'subredditId', type: 'uint256' },
      { name: 'title', type: 'bytes' },
      { name: 'body', type: 'bytes' },
    ],
    name: 'createTextPost',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'subredditId', type: 'uint256' },
      { name: 'title', type: 'bytes' },
      { name: 'ipfsCid', type: 'bytes' },
      { name: 'mimeType', type: 'bytes32' },
      { name: 'isMeme', type: 'bool' },
    ],
    name: 'createMediaPost',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'postId', type: 'uint256' },
      { name: 'parentId', type: 'uint256' },
      { name: 'content', type: 'bytes' },
    ],
    name: 'createComment',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'postId', type: 'uint256' }],
    name: 'getPost',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'subredditId', type: 'uint256' },
          { name: 'author', type: 'address' },
          { name: 'postType', type: 'uint8' },
          { name: 'title', type: 'bytes' },
          { name: 'body', type: 'bytes' },
          { name: 'ipfsCid', type: 'bytes' },
          { name: 'mimeType', type: 'bytes32' },
          { name: 'score', type: 'int256' },
          { name: 'commentCount', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'status', type: 'uint8' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'commentId', type: 'uint256' }],
    name: 'getComment',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'postId', type: 'uint256' },
          { name: 'parentId', type: 'uint256' },
          { name: 'author', type: 'address' },
          { name: 'content', type: 'bytes' },
          { name: 'score', type: 'int256' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'status', type: 'uint8' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'subredditId', type: 'uint256' },
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    name: 'getSubredditPosts',
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'subredditId', type: 'uint256' }],
    name: 'getSubredditPostCount',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'postId', type: 'uint256' },
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    name: 'getPostComments',
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'commentId', type: 'uint256' }],
    name: 'getCommentReplies',
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'postCount',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'postId', type: 'uint256' },
      { indexed: true, name: 'subredditId', type: 'uint256' },
      { indexed: true, name: 'author', type: 'address' },
      { indexed: false, name: 'postType', type: 'uint8' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'PostCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'commentId', type: 'uint256' },
      { indexed: true, name: 'postId', type: 'uint256' },
      { indexed: false, name: 'parentId', type: 'uint256' },
      { indexed: true, name: 'author', type: 'address' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'CommentCreated',
    type: 'event',
  },
] as const;

export const VotingABI = [
  {
    inputs: [
      { name: 'contentId', type: 'uint256' },
      { name: 'isPost', type: 'bool' },
      { name: 'voteType', type: 'uint8' },
    ],
    name: 'vote',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contentId', type: 'uint256' },
      { name: 'isPost', type: 'bool' },
      { name: 'voter', type: 'address' },
    ],
    name: 'getVote',
    outputs: [
      {
        components: [
          { name: 'voter', type: 'address' },
          { name: 'voteType', type: 'uint8' },
          { name: 'stake', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contentId', type: 'uint256' },
      { name: 'isPost', type: 'bool' },
    ],
    name: 'getContentScore',
    outputs: [{ type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contentId', type: 'uint256' },
      { name: 'isPost', type: 'bool' },
    ],
    name: 'getVoteCounts',
    outputs: [
      { name: 'upvotes', type: 'uint256' },
      { name: 'downvotes', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contentId', type: 'uint256' },
      { name: 'isPost', type: 'bool' },
    ],
    name: 'withdrawStake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'contentId', type: 'uint256' },
      { indexed: false, name: 'isPost', type: 'bool' },
      { indexed: true, name: 'voter', type: 'address' },
      { indexed: false, name: 'voteType', type: 'uint8' },
      { indexed: false, name: 'stake', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'Voted',
    type: 'event',
  },
] as const;

export const ModerationABI = [
  {
    inputs: [
      { name: 'contentId', type: 'uint256' },
      { name: 'isPost', type: 'bool' },
      { name: 'reason', type: 'bytes' },
    ],
    name: 'reportContent',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'reportId', type: 'uint256' },
      { name: 'uphold', type: 'bool' },
      { name: 'action', type: 'bytes' },
    ],
    name: 'resolveReport',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'reportId', type: 'uint256' }],
    name: 'getReport',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'contentId', type: 'uint256' },
          { name: 'isPost', type: 'bool' },
          { name: 'reporter', type: 'address' },
          { name: 'reason', type: 'bytes' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'resolved', type: 'bool' },
          { name: 'upheld', type: 'bool' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contentId', type: 'uint256' },
      { name: 'isPost', type: 'bool' },
    ],
    name: 'getContentReports',
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contentId', type: 'uint256' },
      { name: 'isPost', type: 'bool' },
    ],
    name: 'getReportCount',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'reporter', type: 'address' }],
    name: 'canReport',
    outputs: [
      { name: 'canReport', type: 'bool' },
      { name: 'nextReportTime', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'reportId', type: 'uint256' },
      { indexed: true, name: 'contentId', type: 'uint256' },
      { indexed: false, name: 'isPost', type: 'bool' },
      { indexed: true, name: 'reporter', type: 'address' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'ContentReported',
    type: 'event',
  },
] as const;

export const GovernanceABI = [
  {
    inputs: [
      { name: 'subredditId', type: 'uint256' },
      { name: 'proposalType', type: 'uint8' },
      { name: 'data', type: 'bytes' },
    ],
    name: 'createProposal',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'bool' },
    ],
    name: 'castVote',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    name: 'executeProposal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    name: 'getProposal',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'subredditId', type: 'uint256' },
          { name: 'proposalType', type: 'uint8' },
          { name: 'proposer', type: 'address' },
          { name: 'data', type: 'bytes' },
          { name: 'forVotes', type: 'uint256' },
          { name: 'againstVotes', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'executionTime', type: 'uint256' },
          { name: 'state', type: 'uint8' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    name: 'getProposalState',
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'subredditId', type: 'uint256' },
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    name: 'getSubredditProposals',
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'proposalId', type: 'uint256' },
      { indexed: true, name: 'subredditId', type: 'uint256' },
      { indexed: false, name: 'proposalType', type: 'uint8' },
      { indexed: true, name: 'proposer', type: 'address' },
      { indexed: false, name: 'startTime', type: 'uint256' },
      { indexed: false, name: 'endTime', type: 'uint256' },
    ],
    name: 'ProposalCreated',
    type: 'event',
  },
] as const;
