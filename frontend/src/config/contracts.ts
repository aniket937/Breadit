/**
 * Bread-it Protocol Contract Configuration
 * 
 * This file contains the deployed contract addresses and ABIs
 * Configuration is loaded from environment variables
 */

// Monad Testnet Chain Configuration
export const monadTestnet = {
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 10143,
  name: process.env.NEXT_PUBLIC_CHAIN_NAME || 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Monad',
    symbol: 'MON',
  },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz'] },
    public: { http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz'] },
    quicknode: { http: ['https://testnet-rpc.monad.xyz'], ws: ['wss://testnet-rpc.monad.xyz'] },
    ankr: { http: ['https://rpc.ankr.com/monad_testnet'] },
    monadFoundation: { http: ['https://rpc-testnet.monadinfra.com'], ws: ['wss://rpc-testnet.monadinfra.com'] },
  },
  blockExplorers: {
    default: { 
      name: 'MonadVision', 
      url: process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || 'https://testnet.monadvision.com' 
    },
    monadscan: { name: 'Monadscan', url: 'https://testnet.monadscan.com' },
    socialscan: { name: 'Socialscan', url: 'https://monad-testnet.socialscan.io' },
  },
  testnet: true,
} as const;

// Contract Addresses - Loaded from Environment Variables
export const CONTRACT_ADDRESSES = {
  UserRegistry: process.env.NEXT_PUBLIC_CONTRACT_USER_REGISTRY || '0x0BDC19C476823ee9EE3F66f2B619eB3eC7279BD1',
  SubredditDAO: process.env.NEXT_PUBLIC_CONTRACT_SUBREDDIT_DAO || '0xbD3a1C6935064cC5063d4478dB63476695E39fAa',
  PostManager: process.env.NEXT_PUBLIC_CONTRACT_POST_MANAGER || '0x2D656a86216b3494e857BeE505Ff5e7FDa408333',
  Voting: process.env.NEXT_PUBLIC_CONTRACT_VOTING || '0xc164429D339d93f71c8d697834102441e3B8F8aC',
  Governance: process.env.NEXT_PUBLIC_CONTRACT_GOVERNANCE || '0x1945C6e4D739ECA4c6E2AF93a2F8322BA018519E',
  Moderation: process.env.NEXT_PUBLIC_CONTRACT_MODERATION || '0x1BDe6578757a8F1861FD3211776810a2052DD79f',
} as const;

// Protocol Constants (must match smart contract constants)
export const PROTOCOL_CONSTANTS = {
  // Content limits
  MAX_TITLE_LENGTH: 300,
  MAX_BODY_LENGTH: 30000,
  MAX_COMMENT_LENGTH: 10000,
  MAX_CID_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 1000,

  // Karma thresholds
  BAN_KARMA_THRESHOLD: -100,
  INITIAL_KARMA: 1,
  KARMA_PER_POST_UPVOTE: 10,
  KARMA_PER_POST_DOWNVOTE: -5,
  KARMA_PER_COMMENT_UPVOTE: 5,
  KARMA_PER_COMMENT_DOWNVOTE: -3,

  // Voting stakes (in ETH)
  MIN_UPVOTE_STAKE: '0.001',
  MIN_DOWNVOTE_STAKE: '0.005',
  MAX_VOTING_AGE_DAYS: 7,
  STAKE_LOCK_HOURS: 24,

  // Subreddit creation
  SUBREDDIT_CREATION_COST: '0.1',

  // Governance
  STANDARD_VOTING_PERIOD_DAYS: 3,
  CRITICAL_VOTING_PERIOD_DAYS: 7,
  SUPERMAJORITY_PERCENTAGE: 66,
} as const;

// IPFS Configuration - Loaded from Environment Variables
export const IPFS_CONFIG = {
  gateway: process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/',
  pinata: {
    apiKey: process.env.NEXT_PUBLIC_PINATA_API_KEY || '',
    secretKey: process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || '',
    jwt: process.env.NEXT_PUBLIC_PINATA_JWT || '',
    uploadEndpoint: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
  },
  web3Storage: {
    token: process.env.NEXT_PUBLIC_WEB3_STORAGE_TOKEN || '',
  },
} as const;

// App Configuration
export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'Bread-it',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  enableDebug: process.env.NEXT_PUBLIC_ENABLE_DEBUG === 'true',
} as const;
