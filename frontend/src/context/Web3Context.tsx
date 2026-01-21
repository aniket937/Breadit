'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ethers, BrowserProvider, JsonRpcSigner, Contract } from 'ethers';
import { CONTRACT_ADDRESSES, monadTestnet } from '@/config/contracts';
import {
  UserRegistryABI,
  SubredditDAOABI,
  PostManagerABI,
  VotingABI,
  ModerationABI,
  GovernanceABI,
} from '@/config/abis';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface Web3State {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  address: string | null;
  chainId: number | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: Error | null;
}

interface Contracts {
  userRegistry: Contract | null;
  subredditDAO: Contract | null;
  postManager: Contract | null;
  voting: Contract | null;
  moderation: Contract | null;
  governance: Contract | null;
}

interface Web3ContextType extends Web3State {
  contracts: Contracts;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToMonad: () => Promise<void>;
}

const initialState: Web3State = {
  provider: null,
  signer: null,
  address: null,
  chainId: null,
  isConnecting: false,
  isConnected: false,
  error: null,
};

const initialContracts: Contracts = {
  userRegistry: null,
  subredditDAO: null,
  postManager: null,
  voting: null,
  moderation: null,
  governance: null,
};

// ═══════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function useWeb3(): Web3ContextType {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}

// ═══════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════

interface Web3ProviderProps {
  children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  const [state, setState] = useState<Web3State>(initialState);
  const [contracts, setContracts] = useState<Contracts>(initialContracts);

  // Initialize contracts when signer is available
  const initializeContracts = useCallback((signer: JsonRpcSigner) => {
    setContracts({
      userRegistry: new Contract(CONTRACT_ADDRESSES.UserRegistry, UserRegistryABI, signer),
      subredditDAO: new Contract(CONTRACT_ADDRESSES.SubredditDAO, SubredditDAOABI, signer),
      postManager: new Contract(CONTRACT_ADDRESSES.PostManager, PostManagerABI, signer),
      voting: new Contract(CONTRACT_ADDRESSES.Voting, VotingABI, signer),
      moderation: new Contract(CONTRACT_ADDRESSES.Moderation, ModerationABI, signer),
      governance: new Contract(CONTRACT_ADDRESSES.Governance, GovernanceABI, signer),
    });
  }, []);

  // Connect wallet
  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setState(prev => ({
        ...prev,
        error: new Error('No wallet detected. Please install MetaMask.'),
      }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      setState({
        provider,
        signer,
        address: accounts[0],
        chainId: Number(network.chainId),
        isConnecting: false,
        isConnected: true,
        error: null,
      });

      initializeContracts(signer);
    } catch (err) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: err as Error,
      }));
    }
  }, [initializeContracts]);

  // Disconnect
  const disconnect = useCallback(() => {
    setState(initialState);
    setContracts(initialContracts);
  }, []);

  // Switch to Monad network
  const switchToMonad = useCallback(async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${monadTestnet.id.toString(16)}` }],
      });
    } catch (switchError: any) {
      // Chain not added, add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: `0x${monadTestnet.id.toString(16)}`,
              chainName: monadTestnet.name,
              nativeCurrency: monadTestnet.nativeCurrency,
              rpcUrls: [monadTestnet.rpcUrls.default.http[0]],
              blockExplorerUrls: [monadTestnet.blockExplorers.default.url],
            },
          ],
        });
      }
    }
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (state.provider) {
        const signer = await state.provider.getSigner();
        setState(prev => ({ ...prev, address: accounts[0], signer }));
        initializeContracts(signer);
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16);
      setState(prev => ({ ...prev, chainId }));
      // Reload to reset state on chain change
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [state.provider, disconnect, initializeContracts]);

  // Auto-connect if previously connected
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window === 'undefined' || !window.ethereum) return;

      try {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_accounts', []);
        
        if (accounts.length > 0) {
          const signer = await provider.getSigner();
          const network = await provider.getNetwork();

          setState({
            provider,
            signer,
            address: accounts[0],
            chainId: Number(network.chainId),
            isConnecting: false,
            isConnected: true,
            error: null,
          });

          initializeContracts(signer);
        }
      } catch (err) {
        console.error('Auto-connect failed:', err);
      }
    };

    checkConnection();
  }, [initializeContracts]);

  const value: Web3ContextType = {
    ...state,
    contracts,
    connect,
    disconnect,
    switchToMonad,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

// ═══════════════════════════════════════════════════════════
// WINDOW TYPE EXTENSION
// ═══════════════════════════════════════════════════════════

declare global {
  interface Window {
    ethereum?: any;
  }
}
