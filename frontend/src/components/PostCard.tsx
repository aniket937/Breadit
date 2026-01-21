'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useWeb3 } from '@/context/Web3Context';
import { useVote, useUserProfile } from '@/hooks/useContracts';
import { IPFS_CONFIG } from '@/config/contracts';
import clsx from 'clsx';

export interface PostData {
  id: bigint;
  subredditId: bigint;
  author: string;
  postType: number;
  title: string;
  body: string;
  ipfsCid: string;
  mimeType: string;
  score: bigint;
  commentCount: bigint;
  createdAt: bigint;
  status: number;
  subredditName?: string;
}

interface PostCardProps {
  post: PostData;
  subredditName?: string;
  showSubreddit?: boolean;
}

export function PostCard({ post, subredditName, showSubreddit = true }: PostCardProps) {
  const { address, isConnected } = useWeb3();
  const { vote, isPending, userVote } = useVote(post.id, true);
  const [optimisticScore, setOptimisticScore] = useState<number | null>(null);
  const [optimisticVote, setOptimisticVote] = useState<'up' | 'down' | null>(null);

  const displayScore = optimisticScore !== null ? optimisticScore : Number(post.score);
  const currentVote = optimisticVote || (userVote === 1 ? 'up' : userVote === 2 ? 'down' : null);

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!isConnected || isPending) return;

    const isUpvote = voteType === 'up';
    
    // Optimistic update
    if (currentVote === voteType) {
      // Already voted same way, can't undo in current implementation
      return;
    }
    
    const scoreDelta = isUpvote ? 
      (currentVote === 'down' ? 2 : 1) : 
      (currentVote === 'up' ? -2 : -1);
    
    setOptimisticScore(displayScore + scoreDelta);
    setOptimisticVote(voteType);

    try {
      await vote(isUpvote ? 1 : 2);
    } catch (error) {
      // Revert on error
      setOptimisticScore(null);
      setOptimisticVote(null);
      console.error('Vote failed:', error);
    }
  };

  const isHidden = post.status === 1; // ContentStatus.Hidden

  if (isHidden) {
    return (
      <div className="card p-4 opacity-50">
        <p className="text-gray-400 italic">
          This content has been hidden by community moderators.
        </p>
      </div>
    );
  }

  const getPostTypeIcon = () => {
    switch (post.postType) {
      case 0: return '📝'; // Text
      case 1: return '🖼️'; // Media
      case 2: return '😂'; // Meme
      default: return '📝';
    }
  };

  const renderMedia = () => {
    if (post.postType === 0 || !post.ipfsCid) return null;

    const ipfsUrl = `${IPFS_CONFIG.gateway}${post.ipfsCid}`;
    const mimeType = post.mimeType.replace(/\x00/g, '').trim();

    if (mimeType.startsWith('image/')) {
      return (
        <div className="mt-3 max-h-[500px] overflow-hidden rounded">
          <img
            src={ipfsUrl}
            alt={post.title}
            className="w-full object-contain"
            loading="lazy"
          />
        </div>
      );
    }

    if (mimeType.startsWith('video/')) {
      return (
        <div className="mt-3">
          <video
            src={ipfsUrl}
            controls
            className="w-full max-h-[500px] rounded"
          />
        </div>
      );
    }

    return (
      <a
        href={ipfsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-bread-500 hover:underline"
      >
        View media on IPFS →
      </a>
    );
  };

  return (
    <article className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
      <div className="flex">
        {/* Vote Column */}
        <div className="flex flex-col items-center px-3 py-4 bg-gray-50 border-r border-gray-100">
          <button
            onClick={() => handleVote('up')}
            disabled={isPending || !isConnected}
            className={clsx(
              'p-1.5 rounded-lg transition-all',
              currentVote === 'up' ? 'text-bread-500 bg-bread-100' : 'text-gray-400 hover:text-bread-500 hover:bg-bread-50'
            )}
            title="Upvote (0.001 ETH stake)"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3l-7 7h4v7h6v-7h4l-7-7z" clipRule="evenodd" />
            </svg>
          </button>
          
          <span className={clsx(
            'text-sm font-bold py-2 px-1 min-w-[2rem] text-center',
            displayScore > 0 ? 'text-bread-500' : displayScore < 0 ? 'text-red-500' : 'text-gray-500'
          )}>
            {displayScore}
          </span>
          
          <button
            onClick={() => handleVote('down')}
            disabled={isPending || !isConnected}
            className={clsx(
              'p-1.5 rounded-lg transition-all',
              currentVote === 'down' ? 'text-blue-500 bg-blue-100' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
            )}
            title="Downvote (0.005 ETH stake)"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 17l7-7h-4V3H7v7H3l7 7z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-5">
          {/* Meta */}
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            {showSubreddit && subredditName && (
              <>
                <Link href={`/r/${subredditName}`} className="font-bold text-bread-600 hover:text-bread-700 hover:underline">
                  r/{subredditName}
                </Link>
                <span>•</span>
              </>
            )}
            <span>{getPostTypeIcon()}</span>
            <span>Posted by</span>
            <Link href={`/u/${post.author}`} className="hover:underline hover:text-gray-700">
              {post.author.slice(0, 6)}...{post.author.slice(-4)}
            </Link>
            <span>•</span>
            <span>{formatDistanceToNow(new Date(Number(post.createdAt) * 1000))} ago</span>
          </div>

          {/* Title */}
          <Link href={`/post/${post.id}`}>
            <h2 className="text-lg font-semibold text-gray-900 hover:text-bread-600 transition-colors mb-2">
              {post.title}
            </h2>
          </Link>

          {/* Body Preview (for text posts) */}
          {post.postType === 0 && post.body && (
            <p className="text-gray-600 mt-2 line-clamp-3 leading-relaxed">
              {post.body}
            </p>
          )}

          {/* Media */}
          {renderMedia()}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-4 text-sm text-gray-600">
            <Link
              href={`/post/${post.id}`}
              className="flex items-center gap-1.5 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              {post.commentCount.toString()} Comments
            </Link>

            <button className="flex items-center gap-1.5 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>

            <button className="flex items-center gap-1.5 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Save
            </button>

            <button className="flex items-center gap-1.5 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors text-red-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Report
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
