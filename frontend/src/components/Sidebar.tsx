'use client';

import Link from 'next/link';
import { useSubredditList } from '@/hooks/useContracts';
import { formatDistanceToNow } from 'date-fns';

export function Sidebar() {
  const { data: subreddits, isLoading } = useSubredditList();

  return (
    <aside className="hidden lg:block w-80 space-y-5 sticky top-24">
      {/* Create Community */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-lg mb-3 text-gray-800">Create a Community</h3>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          Start your own decentralized community. No central control, governed by its members.
        </p>
        <Link href="/create-community" className="btn-primary block text-center">
          Create Community
        </Link>
      </div>

      {/* Popular Communities */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-lg mb-4 text-gray-800">Popular Communities</h3>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse h-10 bg-gray-100 rounded-lg" />
            ))}
          </div>
        ) : subreddits && subreddits.length > 0 ? (
          <ul className="space-y-2">
            {subreddits.slice(0, 10).map((sub: any, index: number) => (
              <li key={sub.id}>
                <Link
                  href={`/r/${sub.name}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-gray-400 text-xs font-medium w-5">{index + 1}</span>
                  <span className="text-2xl">🍞</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 group-hover:text-bread-500 transition-colors">r/{sub.name}</div>
                    <div className="text-xs text-gray-500">
                      {sub.memberCount} members
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            No communities yet. Be the first to create one!
          </p>
        )}
      </div>

      {/* Protocol Info */}
      <div className="bg-gradient-to-br from-bread-50 to-bread-100 border border-bread-200 rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-lg mb-3 text-gray-800">About Bread-it</h3>
        <p className="text-sm text-gray-700 mb-4 leading-relaxed">
          A fully decentralized Reddit alternative. All content and governance is on-chain.
        </p>
        <ul className="text-sm text-gray-700 space-y-2">
          <li className="flex items-center gap-2">🔒 <span>Censorship resistant</span></li>
          <li className="flex items-center gap-2">⚖️ <span>DAO governance</span></li>
          <li className="flex items-center gap-2">💎 <span>Stake-based voting</span></li>
          <li className="flex items-center gap-2">🌐 <span>IPFS media storage</span></li>
        </ul>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-500 space-y-1 px-2">
        <p className="font-medium">Built on Monad Testnet</p>
        <p>© 2026 Bread-it Protocol</p>
      </div>
    </aside>
  );
}
