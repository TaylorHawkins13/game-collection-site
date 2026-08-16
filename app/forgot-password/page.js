'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import { SITE_URL } from '@/lib/siteUrl';

// Companion to app/reset-password/page.js — see that file for the other
// half of this flow. Uses Supabase's own resetPasswordForEmail(), which
// deliberately doesn't reveal whether the address actually has an account
// (no error either way), so this always shows the same "check your email"
// result regardless of what was typed in. That's a real property of the
// Supabase call, not something faked here — a genuine failure (network,
// misconfiguration, or Supabase's own rate limit on repeated requests)
// still surfaces as an error below.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${SITE_URL}/reset-password`,
    });
    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="container">
        <div className="form-card">
          <h1>Check your email</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            If <strong>{email}</strong> has a Shelf Life account, we just sent a link to reset the password. It's
            good for a little while — if it's expired by the time you click it, just come back here and request a
            new one.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <form className="form-card" onSubmit={handleSubmit}>
        <h1>Reset your password</h1>
        <p className="sub">Enter the email on your account and we'll send you a link to set a new password.</p>

        <div className="field">
          <label htmlFor="forgot-password-email">Email</label>
          <input id="forgot-password-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        {error && <div className="error-text">{error}</div>}

        <button className="btn-primary" type="submit" disabled={submitting} style={{ width: '100%', marginTop: 8 }}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>

        <p className="sub" style={{ marginTop: 16, marginBottom: 0 }}>
          <Link href="/login">Back to login</Link>
        </p>
      </form>
    </main>
  );
}
