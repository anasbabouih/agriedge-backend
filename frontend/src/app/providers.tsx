'use client';

import { ApolloLink } from "@apollo/client";
import {
  ApolloNextAppProvider,
  NextSSRInMemoryCache,
  NextSSRApolloClient,
  SSRMultipartLink,
} from "@apollo/experimental-nextjs-app-support/ssr";
import { setContext } from '@apollo/client/link/context';
import { createUploadLink } from 'apollo-upload-client';

function getBackendUrl() {
  if (process.env.BACKEND_INTERNAL_URL) {
    const baseUrl = process.env.BACKEND_INTERNAL_URL.replace(/\/+$/, '');
    return `${baseUrl}/graphql/`;
  }

  if (typeof window === 'undefined') {
    console.error(
      "\x1b[31m%s\x1b[0m",
      "[AgriEdge Config Warning] 'BACKEND_INTERNAL_URL' environment variable is not defined! " +
      "Falling back to http://localhost:8000/graphql/. Please configure BACKEND_INTERNAL_URL in your Vercel Project Environment Variables."
    );
  }

  // Fallback for local development and build-time static generation
  return 'http://localhost:8000/graphql/';
}

function makeClient() {
  const uri = typeof window === 'undefined' 
    ? getBackendUrl()
    : '/api/graphql';

  const httpLink = createUploadLink({
    uri: uri,
    headers: {
      'apollo-require-preflight': 'true',
    }
  });

  const authLink = setContext((_, { headers }) => {
    let token = null;
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('token');
    }
    return {
      headers: {
        ...headers,
        authorization: token ? `JWT ${token}` : "",
      }
    }
  });

  return new NextSSRApolloClient({
    cache: new NextSSRInMemoryCache(),
    link:
      typeof window === "undefined"
        ? ApolloLink.from([
            new SSRMultipartLink({
              stripDefer: true,
            }),
            authLink.concat(httpLink),
          ])
        : authLink.concat(httpLink),
  });
}

import { ToastProvider } from '@/components/Toast';

export function Providers({ children }: React.PropsWithChildren) {
  return (
    <ApolloNextAppProvider makeClient={makeClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ApolloNextAppProvider>
  );
}
