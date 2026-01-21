'use client';

import { useState, FormEvent } from 'react';
import { useWeb3 } from '@/context/Web3Context';
import { useCreatePost, useIsRegistered, useRegisterUser } from '@/hooks/useContracts';
import { PROTOCOL_CONSTANTS } from '@/config/contracts';

interface CreatePostFormProps {
  subredditId: bigint;
  onSuccess?: (postId: bigint) => void;
}

type PostTab = 'text' | 'media' | 'meme';

export function CreatePostForm({ subredditId, onSuccess }: CreatePostFormProps) {
  const { address, isConnected } = useWeb3();
  const { data: isRegistered } = useIsRegistered(address || undefined);
  const { registerUser, isPending: isRegistering } = useRegisterUser();
  const { createTextPost, createMediaPost, isPending: isCreating } = useCreatePost();

  const [activeTab, setActiveTab] = useState<PostTab>('text');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ipfsCid, setIpfsCid] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    try {
      const username = `user_${Date.now()}`;
      await registerUser(username);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // For production, integrate with Pinata/Web3.Storage/IPFS node
      // This is a placeholder that shows how it would work
      const formData = new FormData();
      formData.append('file', file);

      // Placeholder: In real implementation, upload to IPFS
      // const response = await fetch(IPFS_CONFIG.uploadEndpoint, {
      //   method: 'POST',
      //   headers: { Authorization: `Bearer ${PINATA_JWT}` },
      //   body: formData,
      // });
      // const data = await response.json();
      // setIpfsCid(data.IpfsHash);

      // For demo, generate a fake CID
      setIpfsCid(`Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`);
      setError('Note: IPFS upload requires configuration. Using placeholder CID.');
    } catch (err: any) {
      setError('Failed to upload file: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (title.length > PROTOCOL_CONSTANTS.MAX_TITLE_LENGTH) {
      setError(`Title too long. Max ${PROTOCOL_CONSTANTS.MAX_TITLE_LENGTH} characters.`);
      return;
    }

    try {
      let postId: bigint;

      if (activeTab === 'text') {
        if (!body.trim()) {
          setError('Body is required for text posts');
          return;
        }
        if (body.length > PROTOCOL_CONSTANTS.MAX_BODY_LENGTH) {
          setError(`Body too long. Max ${PROTOCOL_CONSTANTS.MAX_BODY_LENGTH} characters.`);
          return;
        }
        postId = await createTextPost(subredditId, title, body);
      } else {
        if (!ipfsCid) {
          setError('Please upload an image/video');
          return;
        }
        const mimeType = activeTab === 'meme' ? 'image/gif' : 'image/png';
        postId = await createMediaPost(subredditId, title, ipfsCid, mimeType, activeTab === 'meme');
      }

      // Reset form
      setTitle('');
      setBody('');
      setIpfsCid('');
      
      if (onSuccess) {
        onSuccess(postId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create post');
    }
  };

  if (!isConnected) {
    return (
      <div className="card p-6 text-center">
        <p className="text-gray-400 mb-4">Connect your wallet to create posts</p>
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <div className="card p-6 text-center">
        <p className="text-gray-400 mb-4">Register your account to start posting</p>
        <button
          onClick={handleRegister}
          disabled={isRegistering}
          className="btn-primary"
        >
          {isRegistering ? 'Registering...' : 'Register Account'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['text', 'media', 'meme'] as PostTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 px-4 font-medium capitalize transition-all ${
              activeTab === tab
                ? 'bg-gray-50 text-bread-600 border-b-2 border-bread-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab === 'text' && '📝 '}
            {tab === 'media' && '🖼️ '}
            {tab === 'meme' && '😂 '}
            {tab}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="input-field"
          maxLength={PROTOCOL_CONSTANTS.MAX_TITLE_LENGTH}
        />

        {/* Body (text posts) */}
        {activeTab === 'text' && (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Text (optional)"
            className="textarea-field h-32"
            maxLength={PROTOCOL_CONSTANTS.MAX_BODY_LENGTH}
          />
        )}

        {/* Media Upload */}
        {(activeTab === 'media' || activeTab === 'meme') && (
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-bread-400 transition-colors">
            {ipfsCid ? (
              <div>
                <p className="text-bread-500 mb-2">✓ File uploaded</p>
                <p className="text-xs text-gray-400 break-all">CID: {ipfsCid}</p>
                <button
                  type="button"
                  onClick={() => setIpfsCid('')}
                  className="mt-2 text-red-400 text-sm hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-400 mb-4">
                  {activeTab === 'meme' ? 'Upload your meme (image/gif)' : 'Upload image or video'}
                </p>
                <label className="btn-secondary cursor-pointer">
                  {uploading ? 'Uploading...' : 'Choose File'}
                  <input
                    type="file"
                    accept={activeTab === 'meme' ? 'image/*,.gif' : 'image/*,video/*'}
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded p-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setTitle('');
              setBody('');
              setIpfsCid('');
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isCreating || uploading}
            className="btn-primary"
          >
            {isCreating ? 'Creating...' : 'Post'}
          </button>
        </div>

        {/* Gas info */}
        <p className="text-xs text-gray-500 text-center">
          {activeTab === 'text' 
            ? 'Text content is stored fully on-chain. Larger posts cost more gas.'
            : 'Media is stored on IPFS. Only the reference is on-chain.'}
        </p>
      </div>
    </form>
  );
}
