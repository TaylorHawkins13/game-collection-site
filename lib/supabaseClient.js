'use client';

import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase client, kept as a singleton.
// Creating a new client on every render spins up a new internal auth
// client each time, which can pile up and cause requests to hang while
// they wait on an internal lock. Reusing one instance avoids that.
let browserClient;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return browserClient;
}