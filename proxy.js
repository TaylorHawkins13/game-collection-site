import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Refreshes the Supabase auth session on every request so server components
// always see an up-to-date logged-in/logged-out state.
//
// Renamed from middleware.js/middleware() to proxy.js/proxy() for the
// Next.js 16 upgrade — the `middleware` filename/export are deprecated in
// favor of `proxy` (same file, same job, new name/location in the request
// lifecycle terminology). Nothing here used the edge runtime, so the
// rename is the whole change; see CHANGELOG.md for the full upgrade notes.
export async function proxy(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
