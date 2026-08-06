'use client';

import { useEffect } from 'react';

// Registers public/sw.js — silently a no-op in browsers without service
// worker support (older Safari versions, some in-app browsers), and in
// dev it's fine for this to register too since the SW deliberately never
// touches API/Supabase requests. Renders nothing; this is purely a side
// effect, same pattern as ToastListener/TrophyToastListener.
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failing (unsupported browser, blocked by an
      // extension, etc.) shouldn't be user-facing — the site works
      // completely fine without it, just without install/offline support.
    });
  }, []);

  return null;
}
