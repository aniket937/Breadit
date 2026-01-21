'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useWeb3 } from '@/context/Web3Context';
import { Header } from '@/components/Header';
import { useRegisterUser, useIsRegistered } from '@/hooks/useContracts';

export default function RegisterPage() {
  const router = useRouter();
  const { address, isConnected } = useWeb3();
  const { data: isRegistered, refetch } = useIsRegistered(address || undefined);
  const { registerUser, isPending, error } = useRegisterUser();
  
  const [username, setUsername] = useState('');
  const [validationError, setValidationError] = useState('');

  // Username validation
  const validateUsername = useCallback((value: string) => {
    if (value.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (value.length > 20) {
      return 'Username must be 20 characters or less';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    return '';
  }, []);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    setValidationError(validateUsername(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validateUsername(username);
    if (error) {
      setValidationError(error);
      return;
    }

    try {
      await registerUser(username);
      // Wait for transaction and refetch
      await refetch();
      router.push('/');
    } catch (err) {
      console.error('Registration failed:', err);
    }
  };

  // Already registered - redirect
  if (isRegistered) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="container mx-auto max-w-lg px-4 py-12">
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Already Registered!
            </h1>
            <p className="text-gray-600 mb-6">
              Your wallet is already registered on Bread-it.
            </p>
            <a href="/" className="btn-primary inline-block">
              Go to Home
            </a>
          </div>
        </main>
      </div>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="container mx-auto max-w-lg px-4 py-12">
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">🔗</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Connect Your Wallet
            </h1>
            <p className="text-gray-600 mb-6">
              Please connect your wallet to register on Bread-it.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      
      <main className="container mx-auto max-w-lg px-4 py-12">
        <div className="card">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🍞</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Join Bread-it
            </h1>
            <p className="text-gray-600">
              Choose a username that will be stored on-chain forever!
            </p>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label 
                htmlFor="username" 
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  u/
                </span>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="your_username"
                  className={`input-field pl-8 ${
                    validationError ? 'border-red-500 focus:ring-red-500' : ''
                  }`}
                  maxLength={20}
                  disabled={isPending}
                />
              </div>
              {validationError && (
                <p className="mt-2 text-sm text-red-600">{validationError}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                3-20 characters. Letters, numbers, and underscores only.
              </p>
            </div>

            {/* Wallet Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Connected Wallet:</span>
              </p>
              <p className="text-sm font-mono text-gray-800 mt-1 break-all">
                {address}
              </p>
            </div>

            {/* On-chain Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <div className="text-blue-500">ℹ️</div>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">On-chain Registration</p>
                  <p>
                    Your username will be permanently stored on the Monad blockchain.
                    This requires a small gas fee.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  {error.message || 'Registration failed. Please try again.'}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending || !!validationError || !username}
              className={`w-full py-3 rounded-full font-semibold text-white transition-all shadow-md hover:shadow-lg ${
                isPending || !!validationError || !username
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-bread-500 to-bread-600 hover:from-bread-600 hover:to-bread-700'
              }`}
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Registering...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Info Links */}
          <div className="mt-8 pt-6 border-t text-center text-sm text-gray-500">
            <p>
              By registering, you acknowledge that your username and activity
              will be publicly visible on the blockchain.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
