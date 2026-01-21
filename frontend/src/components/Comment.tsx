'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useWeb3 } from '@/context/Web3Context';
import Link from 'next/link';
import clsx from 'clsx';
import { useVote, useCommentReplies } from '@/hooks/useContracts';

export interface CommentData {
  id: bigint;
  postId: bigint;
  parentId: bigint;
  author: string;
  content: string;
  score: bigint;
  createdAt: bigint;
  status: number;
}

interface CommentProps {
  comment: CommentData;
  depth?: number;
  maxDepth?: number;
}

export function Comment({ comment, depth = 0, maxDepth = 6 }: CommentProps) {
  const { address, isConnected } = useWeb3();
  const { vote, isPending, userVote } = useVote(comment.id, false);
  const { data: replies } = useCommentReplies(comment.id);
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [optimisticScore, setOptimisticScore] = useState<number | null>(null);
  const [optimisticVote, setOptimisticVote] = useState<'up' | 'down' | null>(null);

  const displayScore = optimisticScore !== null ? optimisticScore : Number(comment.score);
  const currentVote = optimisticVote || (userVote === 1 ? 'up' : userVote === 2 ? 'down' : null);

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!isConnected || isPending) return;

    const isUpvote = voteType === 'up';
    
    if (currentVote === voteType) return;
    
    const scoreDelta = isUpvote ? 
      (currentVote === 'down' ? 2 : 1) : 
      (currentVote === 'up' ? -2 : -1);
    
    setOptimisticScore(displayScore + scoreDelta);
    setOptimisticVote(voteType);

    try {
      await vote(isUpvote ? 1 : 2);
    } catch (error) {
      setOptimisticScore(null);
      setOptimisticVote(null);
    }
  };

  const isHidden = comment.status === 1;

  if (isHidden) {
    return (
      <div className={clsx('py-2 text-gray-500 italic text-sm', depth > 0 && 'ml-4 pl-4 border-l border-gray-300')}>
        [This comment has been hidden by moderators]
      </div>
    );
  }

  const depthColors = [
    'border-bread-500',
    'border-blue-500',
    'border-green-500',
    'border-purple-500',
    'border-pink-500',
    'border-yellow-500',
  ];

  return (
    <div className={clsx(depth > 0 && 'ml-4 pl-4 border-l', depthColors[depth % depthColors.length])}>
      {/* Comment Header */}
      <div className="flex items-center gap-2 text-xs text-gray-600 py-2">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hover:text-gray-800 font-medium"
        >
          [{isCollapsed ? '+' : '−'}]
        </button>
        <Link href={`/u/${comment.author}`} className="text-bread-600 hover:underline font-medium">
          {comment.author.slice(0, 6)}...{comment.author.slice(-4)}
        </Link>
        <span>•</span>
        <span className={clsx(
          'font-medium',
          displayScore > 0 ? 'text-bread-500' : displayScore < 0 ? 'text-red-500' : ''
        )}>
          {displayScore} points
        </span>
        <span>•</span>
        <span>{formatDistanceToNow(new Date(Number(comment.createdAt) * 1000))} ago</span>
      </div>

      {/* Comment Content */}
      {!isCollapsed && (
        <>
          <div className="text-gray-700 py-1 whitespace-pre-wrap leading-relaxed">
            {comment.content}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 text-xs text-gray-400 py-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleVote('up')}
                disabled={isPending || !isConnected}
                className={clsx(
                  'hover:text-bread-500',
                  currentVote === 'up' && 'text-bread-500'
                )}
              >
                ▲
              </button>
              <button
                onClick={() => handleVote('down')}
                disabled={isPending || !isConnected}
                className={clsx(
                  'hover:text-blue-500',
                  currentVote === 'down' && 'text-blue-500'
                )}
              >
                ▼
              </button>
            </div>

            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="hover:text-white"
            >
              Reply
            </button>

            <button className="hover:text-white">Share</button>
            
            <button className="hover:text-red-400 text-red-400">Report</button>
          </div>

          {/* Reply Form */}
          {showReplyForm && depth < maxDepth && (
            <CommentReplyForm
              postId={comment.postId}
              parentId={comment.id}
              onSuccess={() => setShowReplyForm(false)}
              onCancel={() => setShowReplyForm(false)}
            />
          )}

          {/* Nested Replies */}
          {replies && replies.length > 0 && (
            <div className="mt-2">
              <div className="text-sm text-gray-500 pl-4">
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </div>
              {/* Note: Need to fetch individual comment data for each reply ID */}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Reply Form Component
interface CommentReplyFormProps {
  postId: bigint;
  parentId: bigint;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function CommentReplyForm({ postId, parentId, onSuccess, onCancel }: CommentReplyFormProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // This would call the contract
      // await createComment(postId, parentId, content);
      
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setContent('');
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to post reply');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 mb-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What are your thoughts?"
        className="textarea-field h-24 text-sm"
        maxLength={10000}
      />
      
      {error && (
        <p className="text-red-400 text-xs mt-1">{error}</p>
      )}
      
      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary text-sm py-1 px-3"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="btn-primary text-sm py-1 px-3"
        >
          {isSubmitting ? 'Posting...' : 'Reply'}
        </button>
      </div>
    </form>
  );
}

// Comment Section for Post
interface CommentSectionProps {
  postId: bigint;
  comments?: CommentData[];
}

export function CommentSection({ postId, comments = [] }: CommentSectionProps) {
  const { isConnected } = useWeb3();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      // This would call the contract
      // await createComment(postId, 0, newComment);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      setNewComment('');
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4">
      {/* Comment Input */}
      {isConnected && (
        <form onSubmit={handleSubmitComment} className="mb-6">
          <p className="text-sm text-gray-400 mb-2">Comment as you</p>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="What are your thoughts?"
            className="textarea-field h-24"
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="btn-primary"
            >
              {isSubmitting ? 'Posting...' : 'Comment'}
            </button>
          </div>
        </form>
      )}

      {/* Comments List */}
      <div className="space-y-2">
        {comments.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            No comments yet. Be the first to share your thoughts!
          </p>
        ) : (
          comments.map((comment) => (
            <Comment key={comment.id.toString()} comment={comment} />
          ))
        )}
      </div>
    </div>
  );
}
