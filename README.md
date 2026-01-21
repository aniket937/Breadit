# Bread-it 🍞

> A fully decentralized Reddit-like social platform on Monad Testnet

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-blue)](https://soliditylang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)

## Overview

Bread-it is a production-ready, decentralized Reddit clone with **no backend servers, no databases, and no indexers**. Everything runs on smart contracts and IPFS.

### Features

- 🔐 **On-chain Identity**: Permanent usernames and karma tracked on-chain
- 🏛️ **DAO Communities**: Create subreddits as decentralized autonomous organizations
- 📝 **Posts & Comments**: Text stored on-chain, media on IPFS
- 🗳️ **Stake-based Voting**: Economic incentives prevent brigading
- ⚖️ **Decentralized Moderation**: Community-driven with transparent logging
- 🏛️ **Governance**: Proposals, timelocks, and supermajority voting

## Tech Stack

**Smart Contracts:**
- Solidity 0.8.28 (EVM Version: Prague)
- Hardhat 2.22+
- OpenZeppelin Contracts 5.0+

**Frontend:**
- Next.js 15
- ethers.js 6.0+
- TailwindCSS

**Storage:**
- Monad Testnet (Chain ID: 10143)
- IPFS (media content)

## Quick Start

### Prerequisites

- Node.js 18+
- MetaMask with Monad Testnet configured
- Testnet MON from [faucet](https://faucet.monad.xyz)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/bread-it.git
cd bread-it

# Install contract dependencies
cd contracts
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Deploy Contracts

```bash
cd contracts

# Create .env file
cp .env.example .env
# Edit .env and add your PRIVATE_KEY

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to Monad Testnet
npm run deploy:monad

# View deployment: https://testnet.monadvision.com
```

### Run Frontend

```bash
cd frontend

# Create .env.local with contract addresses
cp .env.example .env.local
# Edit .env.local with deployed addresses

# Start development server
npm run dev
```

Open http://localhost:3000

## Project Structure

```
bread-it/
├── contracts/                 # Solidity smart contracts
│   ├── contracts/
│   │   ├── interfaces/       # Contract interfaces
│   │   ├── libraries/        # Shared libraries
│   │   ├── UserRegistry.sol  # Identity & karma
│   │   ├── SubredditDAO.sol  # Communities
│   │   ├── PostManager.sol   # Posts & comments
│   │   ├── Voting.sol        # Stake-based voting
│   │   ├── Governance.sol    # DAO governance
│   │   └── Moderation.sol    # Content moderation
│   ├── scripts/              # Deployment scripts
│   └── test/                 # Contract tests
├── frontend/                  # Next.js application
│   └── src/
│       ├── pages/            # Route pages
│       ├── components/       # React components
│       ├── hooks/            # Contract hooks
│       ├── utils/            # IPFS utilities
│       └── config/           # Contracts & wagmi
├── ARCHITECTURE.md           # Technical architecture
├── RISKS.md                  # Security analysis
└── DEPLOYMENT.md             # Deployment guide
```

## Smart Contracts

| Contract | Description |
|----------|-------------|
| **UserRegistry** | User identity, karma system, rate limiting |
| **SubredditDAO** | Community creation, settings, treasury |
| **PostManager** | Posts, comments, IPFS integration |
| **Voting** | Stake-based voting with economic incentives |
| **Governance** | Proposals, timelock, execution |
| **Moderation** | Reports, resolution, karma slashing |

## Economic Model

| Action | Cost |
|--------|------|
| Create Subreddit | 0.1 MON |
| Upvote | 0.001 MON (locked 24h) |
| Downvote | 0.005 MON (locked 24h) |
| Post/Comment | Gas only |

**Why 5x downvote cost?** Prevents brigading and ensures downvotes are meaningful.

## Governance

Community members can submit proposals for:
- Rule changes
- Moderator elections
- Moderator removal
- Treasury spending
- Configuration updates

All proposals require:
- 10% quorum
- 66% supermajority
- 48-hour timelock

## Documentation

- [Architecture](./ARCHITECTURE.md) - Technical deep dive
- [Risks & Mitigations](./RISKS.md) - Security analysis
- [Deployment Guide](./DEPLOYMENT.md) - Step-by-step deployment

## Network Configuration

**Monad Testnet:**
```
Network Name: Monad Testnet
Chain ID: 10143
RPC URL: https://testnet-rpc.monad.xyz
Currency Symbol: MON
Block Explorer: https://testnet.monadvision.com
Faucet: https://faucet.monad.xyz
```

**Alternative RPCs:**
- Ankr: `https://rpc.ankr.com/monad_testnet`
- Monad Foundation: `https://rpc-testnet.monadinfra.com`

**Explorers:**
- MonadVision (primary): https://testnet.monadvision.com
- Monadscan: https://testnet.monadscan.com
- Socialscan: https://monad-testnet.socialscan.io

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## Security

This is experimental software. Use at your own risk.

For security issues, please email security@bread-it.xyz

## License

MIT License - see [LICENSE](LICENSE) for details

## Acknowledgements

- [Monad](https://monad.xyz) - High-performance EVM L1 blockchain
- [OpenZeppelin](https://openzeppelin.com) - Secure smart contract libraries
- [ethers.js](https://docs.ethers.org) - Ethereum library
- [Next.js](https://nextjs.org) - React framework

## Documentation

- [Architecture Overview](ARCHITECTURE.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Risk Analysis](RISKS.md)
- [Monad Developer Docs](https://docs.monad.xyz)

---

Built with 🍞 for the decentralized future
