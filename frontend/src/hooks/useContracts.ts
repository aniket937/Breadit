'use client';

import { useCallback, useState, useEffect } from 'react';
import { ethers, parseEther, toUtf8Bytes, toUtf8String, hexlify, zeroPadBytes } from 'ethers';
import { useWeb3 } from '@/context/Web3Context';
import { PROTOCOL_CONSTANTS } from '@/config/contracts';

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

function stringToBytes32(str: string): string {
  const bytes = toUtf8Bytes(str.slice(0, 31));
  return zeroPadBytes(bytes, 32);
}

function bytes32ToString(bytes32: string): string {
  try {
    return toUtf8String(bytes32).replace(/\0/g, '');
  } catch {
    return '';
  }
}

function bytesToString(bytes: string): string {
  try {
    return toUtf8String(bytes);
  } catch {
    return '';
  }
}

// ═══════════════════════════════════════════════════════════
// USER REGISTRY HOOKS
// ═══════════════════════════════════════════════════════════

/**
 * Check if a wallet is registered
 */
export function useIsRegistered(address?: string) {
  const { contracts } = useWeb3();
  const [data, setData] = useState<boolean | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!contracts.userRegistry || !address) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await contracts.userRegistry!.isRegistered(address);
        setData(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [contracts.userRegistry, address]);

  const refetch = useCallback(async () => {
    if (!contracts.userRegistry || !address) return;
    try {
      const result = await contracts.userRegistry.isRegistered(address);
      setData(result);
    } catch (err) {
      setError(err as Error);
    }
  }, [contracts.userRegistry, address]);

  return { data, isLoading, error, refetch };
}

/**
 * Get user profile
 */
export function useUserProfile(address?: string) {
  const { contracts } = useWeb3();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!contracts.userRegistry || !address) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await contracts.userRegistry!.getUser(address);
        setData({
          wallet: result.wallet,
          username: bytes32ToString(result.username),
          karma: result.karma,
          createdAt: result.createdAt,
          lastPostTime: result.lastPostTime,
          lastCommentTime: result.lastCommentTime,
          totalPosts: result.totalPosts,
          totalComments: result.totalComments,
          isBanned: result.isBanned,
        });
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [contracts.userRegistry, address]);

  return { data, isLoading, error };
}

/**
 * Register a new user
 */
export function useRegisterUser() {
  const { contracts } = useWeb3();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const registerUser = useCallback(
    async (username: string) => {
      if (!contracts.userRegistry) throw new Error('Contract not initialized');

      setIsPending(true);
      setError(null);
      setIsSuccess(false);

      try {
        const usernameBytes = stringToBytes32(username);
        const tx = await contracts.userRegistry.registerUser(usernameBytes);
        await tx.wait();
        setIsSuccess(true);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [contracts.userRegistry]
  );

  return { registerUser, isPending, isSuccess, error };
}

/**
 * Get user karma
 */
export function useUserKarma(address?: string) {
  const { contracts } = useWeb3();
  const [data, setData] = useState<bigint | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!contracts.userRegistry || !address) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await contracts.userRegistry!.getUserKarma(address);
        setData(result);
      } catch (err) {
        console.error('Failed to fetch karma:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [contracts.userRegistry, address]);

  return { data, isLoading };
}

// ═══════════════════════════════════════════════════════════
// SUBREDDIT DAO HOOKS
// ═══════════════════════════════════════════════════════════

/**
 * Get subreddit info by ID
 */
export function useSubreddit(subredditId: bigint) {
  const { contracts } = useWeb3();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!contracts.subredditDAO || !subredditId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await contracts.subredditDAO!.getSubreddit(subredditId);
        setData({
          id: result.id,
          name: bytes32ToString(result.name),
          description: bytesToString(result.description),
          creator: result.creator,
          createdAt: result.createdAt,
          minKarmaToPost: result.minKarmaToPost,
          minKarmaToComment: result.minKarmaToComment,
          minKarmaToVote: result.minKarmaToVote,
          postCooldown: result.postCooldown,
          commentCooldown: result.commentCooldown,
          isActive: result.isActive,
        });
      } catch (err) {
        console.error('Failed to fetch subreddit:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [contracts.subredditDAO, subredditId]);

  return { data, isLoading };
}

/**
 * Get subreddit by name
 */
export function useSubredditByName(name: string) {
  const { contracts } = useWeb3();
  const [subredditId, setSubredditId] = useState<bigint | null>(null);

  useEffect(() => {
    if (!contracts.subredditDAO || !name) return;

    const fetchId = async () => {
      try {
        const nameBytes = stringToBytes32(name);
        const id = await contracts.subredditDAO!.getSubredditIdByName(nameBytes);
        setSubredditId(id);
      } catch (err) {
        console.error('Failed to fetch subreddit ID:', err);
      }
    };

    fetchId();
  }, [contracts.subredditDAO, name]);

  return useSubreddit(subredditId || 0n);
}

/**
 * Get list of subreddits
 */
export function useSubredditList() {
  const { contracts } = useWeb3();
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!contracts.subredditDAO) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const count = await contracts.subredditDAO!.subredditCount;
        const subreddits = Array.from({ length: Number(count) }, (_, i) => ({
          id: BigInt(i + 1),
          name: `subreddit_${i + 1}`,
          memberCount: 0,
        }));
        setData(subreddits);
      } catch (err) {
        console.error('Failed to fetch subreddit list:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [contracts.subredditDAO]);

  return { data, isLoading };
}

/**
 * Get member count for a subreddit
 */
export function useSubredditMemberCount(subredditId: bigint) {
  const { contracts } = useWeb3();
  const [data, setData] = useState<bigint | undefined>(undefined);

  useEffect(() => {
    if (!contracts.subredditDAO || !subredditId) return;

    const fetchData = async () => {
      try {
        const count = await contracts.subredditDAO!.memberCount(subredditId);
        setData(count);
      } catch (err) {
        console.error('Failed to fetch member count:', err);
      }
    };

    fetchData();
  }, [contracts.subredditDAO, subredditId]);

  return { data };
}

/**
 * Check if user is member of subreddit
 */
export function useIsMember(address?: string, subredditId?: bigint) {
  const { contracts } = useWeb3();
  const [data, setData] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!contracts.subredditDAO || !address || !subredditId) return;

    const fetchData = async () => {
      try {
        const result = await contracts.subredditDAO!.isMember(address, subredditId);
        setData(result);
      } catch (err) {
        console.error('Failed to check membership:', err);
      }
    };

    fetchData();
  }, [contracts.subredditDAO, address, subredditId]);

  return { data };
}

/**
 * Create a new subreddit
 */
export function useCreateSubreddit() {
  const { contracts } = useWeb3();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createSubreddit = useCallback(
    async (
      name: string,
      description: string,
      minKarmaToPost: number = 1,
      minKarmaToComment: number = 0,
      postCooldown: number = 60
    ) => {
      if (!contracts.subredditDAO) throw new Error('Contract not initialized');

      setIsPending(true);
      setError(null);
      setIsSuccess(false);

      try {
        const nameBytes = stringToBytes32(name);
        const descBytes = hexlify(toUtf8Bytes(description));

        const tx = await contracts.subredditDAO.createSubreddit(
          nameBytes,
          descBytes,
          BigInt(minKarmaToPost),
          BigInt(minKarmaToComment),
          BigInt(postCooldown),
          { value: parseEther(PROTOCOL_CONSTANTS.SUBREDDIT_CREATION_COST) }
        );
        await tx.wait();
        setIsSuccess(true);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [contracts.subredditDAO]
  );

  return { createSubreddit, isPending, isSuccess, error };
}

/**
 * Join a subreddit
 */
export function useJoinSubreddit() {
  const { contracts } = useWeb3();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const joinSubreddit = useCallback(
    async (subredditId: bigint) => {
      if (!contracts.subredditDAO) throw new Error('Contract not initialized');

      setIsPending(true);
      setError(null);

      try {
        const tx = await contracts.subredditDAO.joinSubreddit(subredditId);
        await tx.wait();
        setIsSuccess(true);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [contracts.subredditDAO]
  );

  return { joinSubreddit, isPending, isSuccess, error };
}

// ═══════════════════════════════════════════════════════════
// POST MANAGER HOOKS
// ═══════════════════════════════════════════════════════════

/**
 * Get a post by ID
 */
export function usePost(postId: bigint) {
  const { contracts } = useWeb3();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!contracts.postManager || !postId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await contracts.postManager!.getPost(postId);
        setData({
          id: result.id,
          subredditId: result.subredditId,
          author: result.author,
          postType: result.postType,
          title: bytesToString(result.title),
          body: bytesToString(result.body),
          ipfsCid: bytesToString(result.ipfsCid),
          mimeType: bytes32ToString(result.mimeType),
          score: result.score,
          commentCount: result.commentCount,
          createdAt: result.createdAt,
          status: result.status,
        });
      } catch (err) {
        console.error('Failed to fetch post:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [contracts.postManager, postId]);

  return { data, isLoading };
}

/**
 * Get posts for a subreddit
 */
export function useSubredditPosts(subredditId: bigint, offset: number = 0, limit: number = 25) {
  const { contracts } = useWeb3();
  const [data, setData] = useState<bigint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!contracts.postManager || !subredditId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await contracts.postManager!.getSubredditPosts(
          subredditId,
          BigInt(offset),
          BigInt(limit)
        );
        setData(result);
      } catch (err) {
        console.error('Failed to fetch subreddit posts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [contracts.postManager, subredditId, offset, limit]);

  return { data, isLoading };
}

/**
 * Create a post
 */
export function useCreatePost() {
  const { contracts } = useWeb3();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createTextPost = useCallback(
    async (subredditId: bigint, title: string, body: string) => {
      if (!contracts.postManager) throw new Error('Contract not initialized');

      setIsPending(true);
      setError(null);
      setIsSuccess(false);

      try {
        const titleBytes = hexlify(toUtf8Bytes(title));
        const bodyBytes = hexlify(toUtf8Bytes(body));

        const tx = await contracts.postManager.createTextPost(subredditId, titleBytes, bodyBytes);
        await tx.wait();
        setIsSuccess(true);
        return 1n;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [contracts.postManager]
  );

  const createMediaPost = useCallback(
    async (
      subredditId: bigint,
      title: string,
      ipfsCid: string,
      mimeType: string,
      isMeme: boolean
    ) => {
      if (!contracts.postManager) throw new Error('Contract not initialized');

      setIsPending(true);
      setError(null);
      setIsSuccess(false);

      try {
        const titleBytes = hexlify(toUtf8Bytes(title));
        const cidBytes = hexlify(toUtf8Bytes(ipfsCid));
        const mimeBytes = stringToBytes32(mimeType);

        const tx = await contracts.postManager.createMediaPost(
          subredditId,
          titleBytes,
          cidBytes,
          mimeBytes,
          isMeme
        );
        await tx.wait();
        setIsSuccess(true);
        return 1n;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [contracts.postManager]
  );

  return { createTextPost, createMediaPost, isPending, isSuccess, error };
}

/**
 * Get a comment by ID
 */
export function useComment(commentId: bigint) {
  const { contracts } = useWeb3();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!contracts.postManager || !commentId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await contracts.postManager!.getComment(commentId);
        setData({
          id: result.id,
          postId: result.postId,
          parentId: result.parentId,
          author: result.author,
          content: bytesToString(result.content),
          score: result.score,
          createdAt: result.createdAt,
          status: result.status,
        });
      } catch (err) {
        console.error('Failed to fetch comment:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [contracts.postManager, commentId]);

  return { data, isLoading };
}

/**
 * Get top-level comments for a post
 */
export function usePostComments(postId: bigint, offset: number = 0, limit: number = 50) {
  const { contracts } = useWeb3();
  const [data, setData] = useState<bigint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!contracts.postManager || !postId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await contracts.postManager!.getPostComments(
          postId,
          BigInt(offset),
          BigInt(limit)
        );
        setData(result);
      } catch (err) {
        console.error('Failed to fetch comments:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [contracts.postManager, postId, offset, limit]);

  return { data, isLoading };
}

/**
 * Get replies to a comment
 */
export function useCommentReplies(commentId: bigint) {
  const { contracts } = useWeb3();
  const [data, setData] = useState<bigint[]>([]);

  useEffect(() => {
    if (!contracts.postManager || !commentId) return;

    const fetchData = async () => {
      try {
        const result = await contracts.postManager!.getCommentReplies(commentId);
        setData(result);
      } catch (err) {
        console.error('Failed to fetch replies:', err);
      }
    };

    fetchData();
  }, [contracts.postManager, commentId]);

  return { data };
}

// ═══════════════════════════════════════════════════════════
// VOTING HOOKS
// ═══════════════════════════════════════════════════════════

/**
 * Vote on content
 */
export function useVote(contentId: bigint, isPost: boolean) {
  const { address, contracts } = useWeb3();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [userVote, setUserVote] = useState<number | null>(null);

  // Get existing vote
  useEffect(() => {
    if (!contracts.voting || !address || !contentId) return;

    const fetchVote = async () => {
      try {
        const result = await contracts.voting!.getVote(contentId, isPost, address);
        setUserVote(Number(result));
      } catch (err) {
        console.error('Failed to fetch vote:', err);
      }
    };

    fetchVote();
  }, [contracts.voting, contentId, isPost, address]);

  const vote = useCallback(
    async (voteType: 1 | 2) => {
      if (!contracts.voting) throw new Error('Contract not initialized');

      setIsPending(true);
      setError(null);

      try {
        const stake =
          voteType === 1
            ? parseEther(PROTOCOL_CONSTANTS.MIN_UPVOTE_STAKE)
            : parseEther(PROTOCOL_CONSTANTS.MIN_DOWNVOTE_STAKE);

        const tx = await contracts.voting.vote(contentId, isPost, voteType, { value: stake });
        await tx.wait();
        setIsSuccess(true);
        setUserVote(voteType);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [contracts.voting, contentId, isPost]
  );

  return { vote, userVote, isPending, isSuccess, error };
}

/**
 * Get vote counts for content
 */
export function useVoteCounts(contentId: bigint, isPost: boolean) {
  const { contracts } = useWeb3();
  const [data, setData] = useState<{ upvotes: bigint; downvotes: bigint } | null>(null);

  useEffect(() => {
    if (!contracts.voting || !contentId) return;

    const fetchData = async () => {
      try {
        const result = await contracts.voting!.getVoteCounts(contentId, isPost);
        setData({ upvotes: result[0], downvotes: result[1] });
      } catch (err) {
        console.error('Failed to fetch vote counts:', err);
      }
    };

    fetchData();
  }, [contracts.voting, contentId, isPost]);

  return { data };
}

// ═══════════════════════════════════════════════════════════
// MODERATION HOOKS
// ═══════════════════════════════════════════════════════════

/**
 * Report content
 */
export function useReportContent() {
  const { contracts } = useWeb3();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reportContent = useCallback(
    async (contentId: bigint, isPost: boolean, reason: string) => {
      if (!contracts.moderation) throw new Error('Contract not initialized');

      setIsPending(true);
      setError(null);

      try {
        const reasonBytes = hexlify(toUtf8Bytes(reason));
        const tx = await contracts.moderation.reportContent(contentId, isPost, reasonBytes);
        await tx.wait();
        setIsSuccess(true);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [contracts.moderation]
  );

  return { reportContent, isPending, isSuccess, error };
}

/**
 * Get report count for content
 */
export function useReportCount(contentId: bigint, isPost: boolean) {
  const { contracts } = useWeb3();
  const [data, setData] = useState<bigint | undefined>(undefined);

  useEffect(() => {
    if (!contracts.moderation || !contentId) return;

    const fetchData = async () => {
      try {
        const result = await contracts.moderation!.getReportCount(contentId, isPost);
        setData(result);
      } catch (err) {
        console.error('Failed to fetch report count:', err);
      }
    };

    fetchData();
  }, [contracts.moderation, contentId, isPost]);

  return { data };
}
