/**
 * IPFS Utilities for Bread-it
 * 
 * This module handles IPFS uploads and retrieval for media content.
 * Configuration is loaded from environment variables.
 */

import { IPFS_CONFIG } from '@/config/contracts';

// Public IPFS Gateways (for reading content)
export const IPFS_GATEWAYS = [
  IPFS_CONFIG.gateway,
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

// Configuration for different IPFS providers
interface IPFSConfig {
  apiEndpoint: string;
  apiKey?: string;
  gateway: string;
}

// Pinata Configuration (loaded from env)
const PINATA_CONFIG: IPFSConfig = {
  apiEndpoint: IPFS_CONFIG.pinata.uploadEndpoint,
  apiKey: IPFS_CONFIG.pinata.jwt || IPFS_CONFIG.pinata.apiKey,
  gateway: 'https://gateway.pinata.cloud/ipfs/',
};

// NFT.Storage (free tier available)
const NFT_STORAGE_CONFIG: IPFSConfig = {
  apiEndpoint: 'https://api.nft.storage/upload',
  apiKey: process.env.NEXT_PUBLIC_NFT_STORAGE_KEY,
  gateway: 'https://nftstorage.link/ipfs/',
};

// Web3.Storage
const WEB3_STORAGE_CONFIG: IPFSConfig = {
  apiEndpoint: 'https://api.web3.storage/upload',
  apiKey: IPFS_CONFIG.web3Storage.token,
  gateway: 'https://w3s.link/ipfs/',
};

export type IPFSProvider = 'pinata' | 'nft-storage' | 'web3-storage';

/**
 * Get IPFS configuration for a provider
 */
function getConfig(provider: IPFSProvider = 'pinata'): IPFSConfig {
  switch (provider) {
    case 'pinata':
      return PINATA_CONFIG;
    case 'nft-storage':
      return NFT_STORAGE_CONFIG;
    case 'web3-storage':
      return WEB3_STORAGE_CONFIG;
    default:
      return PINATA_CONFIG;
  }
}

/**
 * Upload file to IPFS via Pinata
 */
async function uploadToPinata(file: File): Promise<string> {
  const config = PINATA_CONFIG;
  
  if (!config.apiKey) {
    throw new Error('PINATA_API_KEY not configured');
  }

  const formData = new FormData();
  formData.append('file', file);

  // Add metadata
  const metadata = JSON.stringify({
    name: file.name,
    keyvalues: {
      app: 'bread-it',
      type: file.type,
    },
  });
  formData.append('pinataMetadata', metadata);

  const response = await fetch(config.apiEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Pinata upload failed: ${error.error || response.statusText}`);
  }

  const result = await response.json();
  return result.IpfsHash;
}

/**
 * Upload file to IPFS via NFT.Storage
 */
async function uploadToNFTStorage(file: File): Promise<string> {
  const config = NFT_STORAGE_CONFIG;
  
  if (!config.apiKey) {
    throw new Error('NFT_STORAGE_KEY not configured');
  }

  const response = await fetch(config.apiEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`NFT.Storage upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.value.cid;
}

/**
 * Upload file to IPFS via Web3.Storage
 */
async function uploadToWeb3Storage(file: File): Promise<string> {
  const config = WEB3_STORAGE_CONFIG;
  
  if (!config.apiKey) {
    throw new Error('WEB3_STORAGE_TOKEN not configured');
  }

  const response = await fetch(config.apiEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'X-Name': file.name,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Web3.Storage upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.cid;
}

/**
 * Upload a file to IPFS
 * Returns the CID (Content Identifier) of the uploaded file
 */
export async function uploadToIPFS(
  file: File,
  provider: IPFSProvider = 'pinata'
): Promise<string> {
  // Validate file size (max 10MB for free tiers)
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    throw new Error('File too large. Maximum size is 10MB.');
  }

  // Validate file type
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
  ];
  
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`File type ${file.type} not allowed. Allowed: ${allowedTypes.join(', ')}`);
  }

  switch (provider) {
    case 'pinata':
      return uploadToPinata(file);
    case 'nft-storage':
      return uploadToNFTStorage(file);
    case 'web3-storage':
      return uploadToWeb3Storage(file);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Get the full URL for an IPFS CID
 * Tries multiple gateways for reliability
 */
export function getIPFSUrl(cid: string, gatewayIndex: number = 0): string {
  if (!cid) return '';
  
  // Handle different CID formats
  const cleanCid = cid.startsWith('ipfs://') 
    ? cid.replace('ipfs://', '') 
    : cid;

  const gateway = IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length];
  return `${gateway}${cleanCid}`;
}

/**
 * Validate an IPFS CID format
 */
export function isValidCID(cid: string): boolean {
  if (!cid) return false;
  
  const cleanCid = cid.startsWith('ipfs://') 
    ? cid.replace('ipfs://', '') 
    : cid;

  // CIDv0: 46 character base58btc (starts with Qm)
  const cidV0Regex = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
  
  // CIDv1: Variable length base32 (starts with baf)
  const cidV1Regex = /^baf[a-z2-7]{56,}$/;

  return cidV0Regex.test(cleanCid) || cidV1Regex.test(cleanCid);
}

/**
 * Fetch content from IPFS with fallback gateways
 */
export async function fetchFromIPFS(cid: string, timeout: number = 10000): Promise<Response> {
  const errors: Error[] = [];

  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    const url = getIPFSUrl(cid, i);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }
      
      errors.push(new Error(`Gateway ${i} returned ${response.status}`));
    } catch (err) {
      errors.push(err as Error);
    }
  }

  throw new Error(`All IPFS gateways failed: ${errors.map(e => e.message).join(', ')}`);
}

/**
 * Pin an existing CID to a pinning service
 * This ensures content persists even if the original pinner goes offline
 */
export async function pinCID(
  cid: string, 
  provider: IPFSProvider = 'pinata'
): Promise<boolean> {
  if (provider !== 'pinata') {
    throw new Error('Only Pinata supports pinning by CID');
  }

  const config = PINATA_CONFIG;
  if (!config.apiKey) {
    throw new Error('PINATA_API_KEY not configured');
  }

  const response = await fetch('https://api.pinata.cloud/pinning/pinByHash', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      hashToPin: cid,
      pinataMetadata: {
        name: `bread-it-pin-${cid.slice(0, 8)}`,
        keyvalues: {
          app: 'bread-it',
          pinnedAt: new Date().toISOString(),
        },
      },
    }),
  });

  return response.ok;
}

/**
 * Generate a thumbnail for images before upload
 * This helps with performance and reduces bandwidth
 */
export async function generateThumbnail(
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 400,
  quality: number = 0.8
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => resolve(blob),
        'image/webp',
        quality
      );
    };

    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload file with thumbnail generation
 * Returns both the original CID and thumbnail CID
 */
export async function uploadWithThumbnail(
  file: File,
  provider: IPFSProvider = 'pinata'
): Promise<{ cid: string; thumbnailCid?: string }> {
  // Upload original
  const cid = await uploadToIPFS(file, provider);

  // Generate and upload thumbnail for images
  if (file.type.startsWith('image/')) {
    try {
      const thumbnailBlob = await generateThumbnail(file);
      if (thumbnailBlob) {
        const thumbnailFile = new File(
          [thumbnailBlob], 
          `thumb_${file.name}`, 
          { type: 'image/webp' }
        );
        const thumbnailCid = await uploadToIPFS(thumbnailFile, provider);
        return { cid, thumbnailCid };
      }
    } catch (err) {
      console.warn('Thumbnail generation failed:', err);
    }
  }

  return { cid };
}

// Export types
export interface UploadResult {
  cid: string;
  thumbnailCid?: string;
  size: number;
  mimeType: string;
  name: string;
}

/**
 * Full upload workflow with metadata
 */
export async function uploadMedia(
  file: File,
  options: {
    provider?: IPFSProvider;
    generateThumbnail?: boolean;
  } = {}
): Promise<UploadResult> {
  const { provider = 'pinata', generateThumbnail: genThumb = true } = options;

  let cid: string;
  let thumbnailCid: string | undefined;

  if (genThumb && file.type.startsWith('image/')) {
    const result = await uploadWithThumbnail(file, provider);
    cid = result.cid;
    thumbnailCid = result.thumbnailCid;
  } else {
    cid = await uploadToIPFS(file, provider);
  }

  return {
    cid,
    thumbnailCid,
    size: file.size,
    mimeType: file.type,
    name: file.name,
  };
}
