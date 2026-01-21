'use client';

import { useState, useEffect } from 'react';
import { useWeb3 } from '@/context/Web3Context';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { PostCard, type PostData } from '@/components/PostCard';
import { useIsRegistered, useSubredditPosts } from '@/hooks/useContracts';

// Feed sort options
type SortOption = 'hot' | 'new' | 'top';

export default function Home() {
  const { address } = useWeb3();
  const { data: isRegistered } = useIsRegistered(address || undefined);
  const [sortBy, setSortBy] = useState<SortOption>('hot');
  const [posts, setPosts] = useState<PostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load real posts from blockchain
  useEffect(() => {
    const loadPosts = async () => {
      setIsLoading(true);
      // TODO: Implement fetching posts from all subreddits
      // For now, show empty state
      setPosts([]);
      setIsLoading(false);
    };

    loadPosts();
  }, [sortBy]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex gap-6">
          {/* Main Feed */}
          <div className="flex-1 space-y-4">
            {/* Sort Options */}
            <div className="card p-3">
              <div className="flex gap-2">
                {(['hot', 'new', 'top'] as SortOption[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => setSortBy(option)}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium capitalize transition-all ${
                      sortBy === option
                        ? 'bg-gradient-to-r from-bread-400 to-bread-500 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {option === 'hot' && '🔥 '}
                    {option === 'new' && '✨ '}
                    {option === 'top' && '📈 '}
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Welcome Banner for New Users */}
            {!isRegistered && address && (
              <div className="bg-gradient-to-r from-bread-400 to-bread-500 p-6 rounded-2xl text-white shadow-md">
                <h2 className="text-2xl font-bold mb-2">Welcome to Bread-it! 🍞</h2>
                <p className="mb-4 opacity-95">
                  Register your username to start posting, commenting, and earning karma.
                  All your actions are recorded on-chain!
                </p>
                <a
                  href="/register"
                  className="inline-block bg-white text-bread-600 px-6 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-all shadow-sm"
                >
                  Register Now →
                </a>
              </div>
            )}

            {/* Posts */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card p-6 animate-pulse">
                    <div className="flex gap-4">
                      <div className="w-10 h-24 bg-gray-200 rounded-xl" />
                      <div className="flex-1 space-y-3">
                        <div className="h-4 bg-gray-200 rounded-lg w-1/4" />
                        <div className="h-6 bg-gray-200 rounded-lg w-3/4" />
                        <div className="h-4 bg-gray-200 rounded-lg w-full" />
                        <div className="h-4 bg-gray-200 rounded-lg w-2/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : posts.length > 0 ? (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard key={post.id.toString()} post={post} />
                ))}
              </div>
            ) : (
              <div className="card p-16 text-center">
                <div className="text-7xl mb-6 animate-bounce">🍞</div>
                <h3 className="text-2xl font-bold text-gray-800 mb-3">
                  Nothing here yet!
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Be the first to share something with the community. Create a post and start the conversation!
                </p>
                {isRegistered ? (
                  <a
                    href="/submit"
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <span>✏️</span>
                    <span>Create First Post</span>
                  </a>
                ) : (
                  <a
                    href="/register"
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <span>🚀</span>
                    <span>Register to Post</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block w-80">
            <Sidebar />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16 py-8">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3 text-gray-700">
              <span className="text-3xl">🍞</span>
              <div>
                <div className="font-bold text-lg">Bread-it</div>
                <div className="text-sm text-gray-500">Decentralized Social on Monad</div>
              </div>
            </div>
            <div className="flex gap-8 text-sm">
              <a href="/about" className="hover:text-gray-700">About</a>
              <a href="/docs" className="hover:text-gray-700">Docs</a>
              <a 
                href="https://github.com/bread-it" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-gray-700"
              >
                GitHub
              </a>
              <a 
                href="https://docs.monad.xyz" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-gray-700"
              >
                Monad Docs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
