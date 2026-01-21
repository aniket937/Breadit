import '@/styles/globals.css';

import type { AppProps } from 'next/app';
import Head from 'next/head';
import { Providers } from '@/components/Providers';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Bread-it | Decentralized Reddit on Monad</title>
        <meta name="description" content="A fully decentralized Reddit-like platform built on Monad Testnet. No backend, no database - just blockchain and IPFS." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Open Graph / Social */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Bread-it | Decentralized Reddit on Monad" />
        <meta property="og:description" content="A fully decentralized Reddit-like platform built on Monad Testnet" />
        <meta property="og:site_name" content="Bread-it" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Bread-it | Decentralized Reddit on Monad" />
        <meta name="twitter:description" content="A fully decentralized Reddit-like platform built on Monad Testnet" />
      </Head>
      
      <Providers>
        <Component {...pageProps} />
      </Providers>
    </>
  );
}
