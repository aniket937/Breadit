'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useWeb3 } from '@/context/Web3Context';
import { Header } from '@/components/Header';
import { useIsRegistered, useCreatePost, useSubredditList, useSubredditByName } from '@/hooks/useContracts';
import { uploadMedia, isValidCID } from '@/utils/ipfs';

type PostType = 'text' | 'media' | 'meme';

export default function SubmitPage() {
  const router = useRouter();
  const { subreddit: defaultSubreddit } = router.query;
  const { address, isConnected } = useWeb3();
  const { data: isRegistered } = useIsRegistered(address || undefined);
  const { createTextPost, createMediaPost, isPending, error } = useCreatePost();
  const { data: subreddits } = useSubredditList();

  const [postType, setPostType] = useState<PostType>('text');
  const [subreddit, setSubreddit] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Set default subreddit from URL
  useEffect(() => {
    if (defaultSubreddit && typeof defaultSubreddit === 'string') {
      setSubreddit(defaultSubreddit);
    }
  }, [defaultSubreddit]);

  // Character limits
  const TITLE_MAX = 300;
  const BODY_MAX = 30000;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setUploadError('File too large. Maximum size is 10MB.');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, MP4, WebM');
      return;
    }

    setMediaFile(file);
    setUploadError('');

    // Create preview
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subreddit || !title.trim()) {
      return;
    }

    try {
      // Get subreddit ID (in real app, look up by name)
      const subredditId = 1n; // Placeholder

      if (postType === 'text') {
        await createTextPost(subredditId, title.trim(), body.trim());
      } else {
        if (!mediaFile) {
          setUploadError('Please select a file to upload');
          return;
        }

        setIsUploading(true);
        setUploadError('');

        try {
          const result = await uploadMedia(mediaFile);
          
          await createMediaPost(
            subredditId,
            title.trim(),
            result.cid,
            result.mimeType,
            postType === 'meme'
          );
        } catch (err) {
          setUploadError('Failed to upload to IPFS. Please try again.');
          setIsUploading(false);
          return;
        }

        setIsUploading(false);
      }

      // Redirect to subreddit
      router.push(`/r/${subreddit}`);
    } catch (err) {
      console.error('Failed to create post:', err);
    }
  };

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="container mx-auto max-w-2xl px-4 py-12">
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">🔗</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Connect Your Wallet
            </h1>
            <p className="text-gray-600">
              Please connect your wallet to create a post.
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
        <main className="container mx-auto max-w-2xl px-4 py-12">
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Registration Required
            </h1>
            <p className="text-gray-600 mb-6">
              You need to register before you can create posts.
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
      
      <main className="container mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Create a Post</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Community Selector */}
          <div className="card">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Choose a community
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">r/</span>
              <input
                type="text"
                value={subreddit}
                onChange={(e) => setSubreddit(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="community_name"
                className="input-field pl-8"
                required
              />
            </div>
          </div>

          {/* Post Type Tabs */}
          <div className="card">
            <div className="flex border-b mb-4">
              {(['text', 'media', 'meme'] as PostType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPostType(type)}
                  className={`flex-1 py-3 text-center font-medium capitalize transition-all ${
                    postType === type
                      ? 'text-bread-600 border-b-2 border-bread-500'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {type === 'text' && '📝 '}
                  {type === 'media' && '🖼️ '}
                  {type === 'meme' && '😂 '}
                  {type}
                </button>
              ))}
            </div>

            {/* Title */}
            <div className="mb-4">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                placeholder="Title"
                className="input-field text-lg font-medium"
                required
              />
              <div className="text-right text-xs text-gray-400 mt-1">
                {title.length}/{TITLE_MAX}
              </div>
            </div>

            {/* Text Body */}
            {postType === 'text' && (
              <div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
                  placeholder="Text (optional)"
                  rows={8}
                  className="input-field resize-none"
                />
                <div className="text-right text-xs text-gray-400 mt-1">
                  {body.length}/{BODY_MAX}
                </div>
              </div>
            )}

            {/* Media Upload */}
            {(postType === 'media' || postType === 'meme') && (
              <div>
                {!mediaPreview ? (
                  <label className="block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-bread-400 transition-colors">
                    <div className="text-4xl mb-2">
                      {postType === 'meme' ? '😂' : '📤'}
                    </div>
                    <p className="text-gray-600 mb-1">
                      Click to upload {postType === 'meme' ? 'a meme' : 'media'}
                    </p>
                    <p className="text-xs text-gray-400">
                      JPEG, PNG, GIF, WebP, MP4, WebM (max 10MB)
                    </p>
                    <input
                      type="file"
                      accept="image/*,video/mp4,video/webm"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative">
                    {mediaFile?.type.startsWith('image/') ? (
                      <img
                        src={mediaPreview}
                        alt="Preview"
                        className="max-h-96 mx-auto rounded-lg"
                      />
                    ) : (
                      <video
                        src={mediaPreview}
                        controls
                        className="max-h-96 mx-auto rounded-lg"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setMediaFile(null);
                        setMediaPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {uploadError && (
                  <p className="text-red-600 text-sm mt-2">{uploadError}</p>
                )}
              </div>
            )}
          </div>

          {/* IPFS Notice */}
          {(postType === 'media' || postType === 'meme') && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <div className="text-blue-500">ℹ️</div>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">IPFS Storage</p>
                  <p>
                    Your media will be uploaded to IPFS (decentralized storage).
                    Only the content identifier (CID) is stored on-chain.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Gas Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="text-yellow-500">⛽</div>
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">On-chain Transaction</p>
                <p>
                  Creating a post requires a blockchain transaction.
                  {postType === 'text' && ' Text is stored directly on-chain.'}
                </p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                {error.message || 'Failed to create post. Please try again.'}
              </p>
            </div>
          )}

          {/* Submit Button */}
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
              disabled={isPending || isUploading || !title.trim() || !subreddit}
              className={`flex-1 py-3 rounded-full font-semibold text-white transition-all shadow-md hover:shadow-lg ${
                isPending || isUploading || !title.trim() || !subreddit
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-bread-500 to-bread-600 hover:from-bread-600 hover:to-bread-700'
              }`}
            >
              {isPending ? 'Posting...' : isUploading ? 'Uploading...' : 'Post'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
