'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [checkEmail, setCheckEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim().toLowerCase();
    if (!USERNAME_RE.test(cleanUsername)) {
      setError('Username must be 3-20 characters: lowercase letters, numbers, underscores only.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);

    // Free stand-in for Supabase's "Leaked password protection" (that toggle is
    // Pro-plan-only) — checks against Have I Been Pwned's breach database via a
    // server route so the password itself never leaves the server as plaintext.
    // Fails open: if the check itself fails, signup proceeds rather than blocking
    // on a third-party outage.
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
      // Network hiccup checking the password — don't block signup over it.
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: cleanUsername } },
    });
    setSubmitting(false);

    if (signUpError) {
      if (signUpError.message?.toLowerCase().includes('duplicate') || signUpError.status === 422) {
        setError('That username or email is already taken.');
      } else {
        setError(signUpError.message);
      }
      return;
    }

    // Fire-and-forget — the account is already created in Supabase above,
    // so a blocked/failed request here should never hold up the redirect
    // or the "check your email" screen.
    fetch('/api/notify-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername, email }),
    }).catch(() => {});

    if (data.session) {
      router.push('/dashboard');
      router.refresh();
    } else {
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <main className="container">
        <div className="form-card">
          <h1>Check your email</h1>
          <p className="sub">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
            account, then come back and log in.
          </p>
          <Link href="/login" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <form className="form-card" onSubmit={handleSubmit}>
        <h1>Create your shelf</h1>
        <p className="sub">Free forever. Takes about a minute.</p>

        <div className="field">
          <label htmlFor="signup-username">Username</label>
          <input
            id="signup-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. link_owns_switch"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="signup-email">Email</label>
          <input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>

        {error && <div className="error-text">{error}</div>}

        <button className="btn-primary" type="submit" disabled={submitting} style={{ width: '100%', marginTop: 8 }}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>

        <p className="sub" style={{ marginTop: 16, marginBottom: 0 }}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
}
