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

function makeClient() {
  const uri = typeof window === 'undefined' 
    ? process.env.BACKEND_INTERNAL_URL ? `${process.env.BACKEND_INTERNAL_URL}/graphql/` : 'http://backend:8000/graphql/'
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
