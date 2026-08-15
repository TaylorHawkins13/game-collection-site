'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';

// Landing page for the link app/forgot-password/page.js sends via
// supabase.auth.resetPasswordForEmail(). Wrapped in Suspense at the bottom
// of this file because it reads useSearchParams() — required so this page
// doesn't fail Next's static-render check even though in practice it's
// always visited with real query params from an email link.
function ResetPasswordForm() {
  const [checking, setChecking] = useState(true);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    // Supabase's reset-password link can land here two different ways
    // depending on the project's auth flow setting: the newer PKCE flow
    // appends a `?code=` query param that has to be exchanged for a real
    // session explicitly (exchangeCodeForSession); the older implicit
    // flow puts the session tokens straight in the URL hash, which the
    // browser client already picks up on its own on init
    // (detectSessionInUrl, on by default) before this effect even runs.
    // Handling both here means this works regardless of which one the
    // Supabase project actually has configured, without needing to know
    // in advance.
    async function establishSession() {
      const code = searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeError) {
          setInvalidLink(true);
          setChecking(false);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setInvalidLink(!session);
      setChecking(false);
    }

    establishSession();

    // Covers the implicit-flow case where the hash is still being parsed
    // when getSession() above first runs — this fires once that finishes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session && !cancelled) {
        setInvalidLink(false);
        setChecking(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords don’t match.');
      return;
    }

    setSubmitting(true);

    // Same free Have I Been Pwned check the signup form runs (see
    // app/signup/page.js, lib/pwnedPassword.js) — a reset is exactly the
    // moment someone might reuse a password that's already been exposed
    // elsewhere, so it's worth checking here too, not just at signup.
    // Fails open, same as signup: a check that itself fails shouldn't
    // block someone from actually resetting their password.
    try {
      const pwnedRes = await fetch('/api/check-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (pwnedRes.ok) {
        const { pwned, count } = await pwnedRes.json();
        if (pwned) {
          setSubmitting(false);
          setError(
            `That password has appeared in ${count.toLocaleString()} known data breaches — pick a different one to keep your account safe.`
          );
          return;
        }
      }
    } catch {
      // Network hiccup checking the password — don't block the reset over it.
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 1500);
  }

  if (checking) {
    return (
      <main className="container">
        <div className="form-card">
          <h1>Reset your password</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            Checking your link…
          </p>
        </div>
      </main>
    );
  }

  if (invalidLink) {
    return (
      <main className="container">
        <div className="form-card">
          <h1>Link expired</h1>
          <p className="sub">
            This password reset link is invalid or has expired — they only last a little while. Request a new one
            below.
          </p>
          <Link
            href="/forgot-password"
            className="btn-primary"
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            Get a new link
          </Link>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="container">
        <div className="form-card">
          <h1>Password updated</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            Taking you to your dashboard…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <form className="form-card" onSubmit={handleSubmit}>
        <h1>Set a new password</h1>
        <p className="sub">Choose a new password for your account.</p>

        <div className="field">
          <label>New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
        <div className="field">
          <label>Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>

        {error && <div className="error-text">{error}</div>}

        <button className="btn-primary" type="submit" disabled={submitting} style={{ width: '100%', marginTop: 8 }}>
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
