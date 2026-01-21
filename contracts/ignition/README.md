# Hardhat Ignition Deployment

This directory contains Hardhat Ignition modules for deploying the Bread-it Protocol contracts.

## What is Hardhat Ignition?

Hardhat Ignition is the official deployment system recommended by Monad. It provides:
- Declarative deployment definitions
- Automatic dependency management
- Built-in idempotency (safe to re-run)
- State management and recovery
- Better deployment tracking

## Deployment Module

### BreadIt.js

Main deployment module that deploys all 6 core contracts:
1. UserRegistry
2. SubredditDAO
3. PostManager
4. Voting
5. Governance
6. Moderation

The module automatically configures all permissions and dependencies.

## Usage

### Deploy to Local Hardhat Node

```bash
# Terminal 1: Start local node
npm run node

# Terminal 2: Deploy
npm run deploy:local
```

### Deploy to Monad Testnet

```bash
# Ensure .env file has your PRIVATE_KEY set
npm run deploy:monad
```

### Redeploy (Force New Addresses)

```bash
npm run deploy:monad:reset
```

## Deployment Files

Ignition stores deployment data in:
- `ignition/deployments/` - Deployment state and addresses
- `ignition/deployments/chain-<chainId>/` - Network-specific deployments

## Why Hardhat Ignition?

- ✅ Official Monad recommendation
- ✅ Automatic dependency resolution
- ✅ Built-in state management
- ✅ Idempotent (safe to re-run)
- ✅ Better for complex deployments
- ✅ Deployment verification built-in
- ✅ Automatic recovery on failure

## Documentation

- [Hardhat Ignition Docs](https://hardhat.org/ignition/docs/getting-started)
- [Monad Deployment Guide](https://docs.monad.xyz/guides/deploy-smart-contract/hardhat)
