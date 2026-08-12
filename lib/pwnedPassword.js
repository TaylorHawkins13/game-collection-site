// Free stand-in for Supabase's "Leaked password protection" (Auth > Providers),
// which is Pro-plan-and-above only. Checks a password against Have I Been Pwned's
// Pwned Passwords database using the k-anonymity range API: only the first 5 hex
// characters of the password's SHA-1 hash are ever sent over the network, so the
// real password (or even a usable fragment of its hash) never leaves this server.
// See https://haveibeenpwned.com/API/v3#PwnedPasswords
//
// Fails OPEN on any network/API problem — a HIBP outage should never block someone
// from signing up. Only an explicit "yes, this password is known-breached" result
// blocks anything.

import crypto from 'crypto';

export async function checkPasswordPwned(password) {
  if (!password) return { pwned: false, count: 0 };

  const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return { pwned: false, count: 0, unknown: true };

    const body = await res.text();
    for (const line of body.split('\n')) {
      const [lineSuffix, countStr] = line.trim().split(':');
      if (lineSuffix === suffix) {
        const count = parseInt(countStr, 10) || 0;
        return { pwned: count > 0, count };
      }
    }
    return { pwned: false, count: 0 };
  } catch (err) {
    console.error('Pwned password check failed (failing open)', err);
    return { pwned: false, count: 0, unknown: true };
  }
}
