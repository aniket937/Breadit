'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWeb3 } from '@/context/Web3Context';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { PostCard, type PostData } from '@/components/PostCard';
import { useSubredditByName, useIsMember, useJoinSubreddit, useSubredditMemberCount } from '@/hooks/useContracts';

type SortOption = 'hot' | 'new' | 'top';

export default function SubredditPage() {
  const router = useRouter();
  const { subreddit: subredditName } = router.query;
  const { address } = useWeb3();
  
  const { data: subreddit, isLoading: loadingSubreddit } = useSubredditByName(
    typeof subredditName === 'string' ? subredditName : ''
  );
  const { data: isMember } = useIsMember(address || undefined, subreddit?.id);
  const { data: memberCount } = useSubredditMemberCount(subreddit?.id || 0n);
  const { joinSubreddit, isPending: joining } = useJoinSubreddit();
  
  const [sortBy, setSortBy] = useState<SortOption>('hot');
  const [posts, setPosts] = useState<PostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load posts for this subreddit
  useEffect(() => {
    if (!subredditName) return;
    
    setIsLoading(true);
    
    // Mock posts for demo
    const mockPosts: PostData[] = [
      {
        id: 1n,
        subredditId: 1n,
        subredditName: subredditName as string,
        author: '0x1234...5678',
        postType: 0,
        title: `Welcome to r/${subredditName}!`,
        body: `This is the ${subredditName} community on Bread-it. Share posts, discuss topics, and earn karma!`,
        ipfsCid: '',
        mimeType: '',
        score: 42n,
        commentCount: 5n,
        createdAt: BigInt(Math.floor(Date.now() / 1000) - 3600),
        status: 0,
      },
    ];

    setPosts(mockPosts);
    setIsLoading(false);
  }, [subredditName, sortBy]);

  const handleJoin = async () => {
    if (!subreddit?.id) return;
    try {
      await joinSubreddit(subreddit.id);
    } catch (err) {
      console.error('Failed to join:', err);
    }
  };

  if (!subredditName) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      
      {/* Subreddit Banner */}
      <div className="bg-gradient-to-r from-bread-500 to-bread-600 h-32" />
      
      <div className="bg-white border-b">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex items-end gap-4 -mt-4 pb-4">
            {/* Subreddit Icon */}
            <div className="w-20 h-20 bg-white rounded-full border-4 border-white flex items-center justify-center text-4xl">
              🍞
            </div>
            
            <div className="flex-1 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  r/{subredditName}
                </h1>
                <p className="text-gray-500">
                  {memberCount?.toString() || '0'} members
                </p>
              </div>
              
              <div className="flex gap-3">
                {isMember ? (
                  <button className="px-6 py-2.5 border-2 border-bread-500 text-bread-600 rounded-full font-semibold hover:bg-bread-50 transition-all">
                    Joined ✓
                  </button>
                ) : (
                  <button
                    onClick={handleJoin}
                    disabled={joining || !address}
                    className="btn-primary"
                  >
                    {joining ? 'Joining...' : 'Join'}
                  </button>
                )}
                <a
                  href={`/submit?subreddit=${subredditName}`}
                  className="btn-secondary"
                >
                  Create Post
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-6">
          {/* Posts */}
          <div className="flex-1 space-y-4">
            {/* Sort Options */}
            <div className="card">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">Sort by:</span>
                <div className="flex gap-2">
                  {(['hot', 'new', 'top'] as SortOption[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => setSortBy(option)}
                      className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
                        sortBy === option
                          ? 'bg-gradient-to-r from-bread-400 to-bread-500 text-white shadow-md'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Posts List */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="card animate-pulse">
                    <div className="h-24 bg-gray-200 rounded" />
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
              <div className="card text-center py-12">
                <p className="text-gray-500 mb-4">No posts in this community yet.</p>
                <a href={`/submit?subreddit=${subredditName}`} className="btn-primary">
                  Be the first to post!
                </a>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block w-80 space-y-4">
            {/* About Community */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">About Community</h3>
              <p className="text-gray-600 text-sm mb-4">
                {subreddit?.description || `Welcome to r/${subredditName}!`}
              </p>
              
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Members</span>
                  <span className="font-medium">{memberCount?.toString() || '0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Created</span>
                  <span className="font-medium">
                    {subreddit?.createdAt 
                      ? new Date(Number(subreddit.createdAt) * 1000).toLocaleDateString()
                      : 'Recently'
                    }
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Min Karma to Post</span>
                  <span className="font-medium">
                    {subreddit?.minKarmaToPost?.toString() || '1'}
                  </span>
                </div>
              </div>

              <a
                href={`/submit?subreddit=${subredditName}`}
                className="btn-primary w-full text-center mt-4 block"
              >
                Create Post
              </a>
            </div>

            {/* Rules */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Community Rules</h3>
              <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                <li>Be respectful to others</li>
                <li>No spam or self-promotion</li>
                <li>Stay on topic</li>
                <li>No illegal content</li>
                <li>Stake responsibly when voting</li>
              </ol>
            </div>

            {/* Moderators */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Moderators</h3>
              <div className="text-sm text-gray-600">
                <p className="text-gray-500">
                  Creator: {subreddit?.creator 
                    ? `${subreddit.creator.slice(0, 6)}...${subreddit.creator.slice(-4)}`
                    : 'Loading...'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
