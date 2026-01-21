'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useWeb3 } from '@/context/Web3Context';
import { Header } from '@/components/Header';
import { useIsRegistered, useCreateSubreddit } from '@/hooks/useContracts';
import { PROTOCOL_CONSTANTS } from '@/config/contracts';

export default function CreateCommunityPage() {
  const router = useRouter();
  const { address, isConnected } = useWeb3();
  const { data: isRegistered } = useIsRegistered(address || undefined);
  const { createSubreddit, isPending, error } = useCreateSubreddit();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minKarmaToPost, setMinKarmaToPost] = useState(1);
  const [minKarmaToComment, setMinKarmaToComment] = useState(0);
  const [postCooldown, setPostCooldown] = useState(60);
  const [validationError, setValidationError] = useState('');

  // Name validation
  const validateName = useCallback((value: string) => {
    if (value.length < 3) {
      return 'Community name must be at least 3 characters';
    }
    if (value.length > 21) {
      return 'Community name must be 21 characters or less';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return 'Only letters, numbers, and underscores allowed';
    }
    return '';
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    setValidationError(validateName(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateName(name);
    if (error) {
      setValidationError(error);
      return;
    }

    try {
      await createSubreddit(
        name,
        description,
        minKarmaToPost,
        minKarmaToComment,
        postCooldown
      );

      router.push(`/r/${name}`);
    } catch (err) {
      console.error('Failed to create community:', err);
    }
  };

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="container mx-auto max-w-xl px-4 py-12">
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">🔗</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Connect Your Wallet
            </h1>
            <p className="text-gray-600">
              Please connect your wallet to create a community.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Not registered
  if (!isRegistered) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="container mx-auto max-w-xl px-4 py-12">
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Registration Required
            </h1>
            <p className="text-gray-600 mb-6">
              You need to register before you can create a community.
            </p>
            <a href="/register" className="btn-primary inline-block">
              Register Now
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      
      <main className="container mx-auto max-w-xl px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Create a Community</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="card">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">r/</span>
              <input
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="community_name"
                className={`input-field pl-8 ${
                  validationError ? 'border-red-500' : ''
                }`}
                maxLength={21}
                required
              />
            </div>
            {validationError && (
              <p className="text-red-600 text-sm mt-1">{validationError}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Community names cannot be changed after creation.
            </p>
          </div>

          {/* Description */}
          <div className="card">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="What is this community about?"
              rows={4}
              className="input-field resize-none"
            />
            <div className="text-right text-xs text-gray-400 mt-1">
              {description.length}/500
            </div>
          </div>

          {/* Settings */}
          <div className="card">
            <h3 className="font-medium text-gray-800 mb-4">Community Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Minimum Karma to Post
                </label>
                <input
                  type="number"
                  value={minKarmaToPost}
                  onChange={(e) => setMinKarmaToPost(Math.max(0, parseInt(e.target.value) || 0))}
                  min={0}
                  className="input-field w-32"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Users need at least this much karma to create posts
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Minimum Karma to Comment
                </label>
                <input
                  type="number"
                  value={minKarmaToComment}
                  onChange={(e) => setMinKarmaToComment(Math.max(0, parseInt(e.target.value) || 0))}
                  min={0}
                  className="input-field w-32"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Post Cooldown (seconds)
                </label>
                <input
                  type="number"
                  value={postCooldown}
                  onChange={(e) => setPostCooldown(Math.max(0, parseInt(e.target.value) || 0))}
                  min={0}
                  max={86400}
                  className="input-field w-32"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Time users must wait between posts (0-86400 seconds)
                </p>
              </div>
            </div>
          </div>

          {/* Cost Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="text-yellow-500">💰</div>
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Creation Cost</p>
                <p>
                  Creating a community costs <strong>{PROTOCOL_CONSTANTS.SUBREDDIT_CREATION_COST} MON</strong>.
                  This is sent to the community treasury.
                </p>
              </div>
            </div>
          </div>

          {/* Governance Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="text-blue-500">🏛️</div>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">DAO Governance</p>
                <p>
                  You will be the initial moderator. The community can elect
                  additional moderators and change rules through governance proposals.
                </p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                {error.message || 'Failed to create community. Please try again.'}
              </p>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !!validationError || !name}
              className={`flex-1 py-3 rounded-full font-semibold text-white transition-all shadow-md hover:shadow-lg ${
                isPending || !!validationError || !name
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-bread-500 to-bread-600 hover:from-bread-600 hover:to-bread-700'
              }`}
            >
              {isPending ? 'Creating...' : `Create Community (${PROTOCOL_CONSTANTS.SUBREDDIT_CREATION_COST} MON)`}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
