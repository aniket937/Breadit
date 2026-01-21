'use client';

import { ReactNode } from 'react';
import { Web3Provider } from '@/context/Web3Context';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return <Web3Provider>{children}</Web3Provider>;
}
