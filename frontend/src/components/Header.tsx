'use client';

import Link from 'next/link';
import { useWeb3 } from '@/context/Web3Context';
import { useUserProfile } from '@/hooks/useContracts';
import { monadTestnet } from '@/config/contracts';

export function Header() {
  const { address, isConnected, isConnecting, chainId, connect, disconnect, switchToMonad } = useWeb3();
  const { data: userProfile } = useUserProfile(address || undefined);

  const isWrongNetwork = isConnected && chainId !== monadTestnet.id;

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <span className="text-4xl">🍞</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-bread-500 to-bread-600 bg-clip-text text-transparent">bread-it</span>
          </Link>

          {/* Search */}
          <div className="flex-1 max-w-2xl mx-8">
            <input
              type="text"
              placeholder="Search bread-it"
              className="w-full bg-gray-50 border border-gray-200 rounded-full px-5 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-bread-400 focus:border-transparent transition-all"
            />
          </div>

          {/* User Section */}
          <div className="flex items-center gap-4">
            {isConnected && userProfile && (
              <div className="hidden md:flex items-center gap-2 text-sm bg-gray-50 px-4 py-2 rounded-full">
                <span className="text-gray-600">Karma:</span>
                <span className={`font-bold ${Number(userProfile.karma) >= 0 ? 'text-bread-500' : 'text-red-500'}`}>
                  {userProfile.karma.toString()}
                </span>
              </div>
            )}
            
            <Link
              href="/submit"
              className="btn-primary hidden md:block"
            >
              Create Post
            </Link>

            {/* Wallet Connection */}
            {!isConnected ? (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="px-6 py-2.5 bg-gradient-to-r from-bread-500 to-bread-600 hover:from-bread-600 hover:to-bread-700 text-white rounded-full font-medium transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            ) : isWrongNetwork ? (
              <button
                onClick={switchToMonad}
                className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full font-medium transition-all shadow-sm hover:shadow-md"
              >
                Switch to Monad
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full border border-gray-200">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm font-medium text-gray-700">
                    {userProfile?.username || formatAddress(address!)}
                  </span>
                </div>
                <button
                  onClick={disconnect}
                  className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                  title="Disconnect"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
