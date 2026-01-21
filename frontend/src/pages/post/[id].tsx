'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWeb3 } from '@/context/Web3Context';
import { formatDistanceToNow } from 'date-fns';
import { Header } from '@/components/Header';
import { CommentSection } from '@/components/Comment';
import { usePost, useVote, useVoteCounts } from '@/hooks/useContracts';
import { getIPFSUrl } from '@/utils/ipfs';

export default function PostPage() {
  const router = useRouter();
  const { id } = router.query;
  const { address } = useWeb3();
  
  const postId = id ? BigInt(id as string) : 0n;
  const { data: post, isLoading: loadingPost } = usePost(postId);
  const { vote, userVote, isPending: voting } = useVote(postId, true);
  const { data: voteCounts } = useVoteCounts(postId, true);

  const [currentVote, setCurrentVote] = useState<1 | 2 | null>(null);
  const [localScore, setLocalScore] = useState(0n);

  useEffect(() => {
    if (post?.score !== undefined) {
      setLocalScore(post.score);
    }
  }, [post?.score]);

  useEffect(() => {
    if (userVote) {
      setCurrentVote(userVote as 1 | 2);
    }
  }, [userVote]);

  const handleVote = async (voteType: 1 | 2) => {
    if (!address) return;
    
    // Optimistic update
    const prevVote = currentVote;
    const prevScore = localScore;
    
    if (currentVote === voteType) {
      // Already voted this way - could implement unvote
      return;
    }
    
    setCurrentVote(voteType);
    if (voteType === 1) {
      setLocalScore(prev => prev + (prevVote === 2 ? 2n : 1n));
    } else {
      setLocalScore(prev => prev - (prevVote === 1 ? 2n : 1n));
    }
    
    try {
      await vote(voteType);
    } catch (err) {
      // Revert on error
      setCurrentVote(prevVote);
      setLocalScore(prevScore);
    }
  };

  if (loadingPost || !post) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="container mx-auto max-w-4xl px-4 py-6">
          <div className="card animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-6" />
            <div className="h-48 bg-gray-200 rounded mb-4" />
          </div>
        </main>
      </div>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(Number(post.createdAt) * 1000), { addSuffix: true });
  const isMedia = post.postType === 1 || post.postType === 2;
  const isImage = post.mimeType?.startsWith('image/');
  const isVideo = post.mimeType?.startsWith('video/');

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      
      <main className="container mx-auto max-w-4xl px-4 py-6">
        <div className="card">
          <div className="flex gap-4">
            {/* Vote Column */}
            <div className="flex flex-col items-center gap-1 min-w-[40px]">
              <button
                onClick={() => handleVote(1)}
                disabled={voting || !address}
                className={`p-2 rounded-lg transition-colors ${
                  currentVote === 1 ? 'text-bread-500 bg-bread-100' : 'text-gray-400 hover:text-bread-500 hover:bg-bread-50'
                }`}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4l8 8h-6v8h-4v-8H4l8-8z" />
                </svg>
              </button>
              
              <span className={`font-bold text-lg ${
                currentVote === 1 ? 'text-bread-500' :
                currentVote === 2 ? 'text-blue-600' : 'text-gray-700'
              }`}>
                {localScore.toString()}
              </span>
              
              <button
                onClick={() => handleVote(2)}
                disabled={voting || !address}
                className={`p-2 rounded-lg transition-colors ${
                  currentVote === 2 ? 'text-blue-600 bg-blue-100' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 20l-8-8h6V4h4v8h6l-8 8z" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Meta */}
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                <a 
                  href={`/r/${post.subredditId}`}
                  className="font-semibold text-gray-700 hover:underline"
                >
                  r/{post.subredditId.toString()}
                </a>
                <span>•</span>
                <span>Posted by u/{post.author.slice(0, 6)}...{post.author.slice(-4)}</span>
                <span>•</span>
                <span>{timeAgo}</span>
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {post.title}
              </h1>

              {/* Content */}
              {post.body && (
                <div className="prose max-w-none mb-6">
                  <p className="text-gray-800 whitespace-pre-wrap">{post.body}</p>
                </div>
              )}

              {/* Media */}
              {isMedia && post.ipfsCid && (
                <div className="mb-6">
                  {isImage && (
                    <img
                      src={getIPFSUrl(post.ipfsCid)}
                      alt={post.title}
                      className="max-w-full max-h-[600px] rounded-lg"
                    />
                  )}
                  {isVideo && (
                    <video
                      src={getIPFSUrl(post.ipfsCid)}
                      controls
                      className="max-w-full max-h-[600px] rounded-lg"
                    />
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-4 text-gray-500 text-sm border-t pt-4">
                <span className="flex items-center gap-1">
                  💬 {post.commentCount.toString()} comments
                </span>
                <button className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded">
                  🔗 Share
                </button>
                <button className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded">
                  ⚑ Save
                </button>
                <button className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded">
                  ⚠️ Report
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="mt-4">
          <CommentSection postId={postId} />
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Back to feed
          </button>
        </div>
      </main>
    </div>
  );
}
