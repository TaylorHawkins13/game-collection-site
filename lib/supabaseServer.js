import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server-side Supabase client for use in Server Components, Route Handlers,
// and Server Actions. Reads/writes the auth session via cookies.
//
// `cookies()` is an async Request API as of Next.js 15, with the temporary
// synchronous-access compatibility shim removed entirely in Next.js 16 (see
// CHANGELOG.md for the upgrade) — this function is now itself async as a
// result, which is why every call site across the app awaits it.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore
            // because proxy.js (formerly middleware.js) refreshes the
            // session on every request.
          }
        },
      },
    }
  );
}
