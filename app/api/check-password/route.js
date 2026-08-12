import { NextResponse } from 'next/server';
import { checkPasswordPwned } from '@/lib/pwnedPassword';

// Called from the signup form before account creation. Never logs the raw
// password — only the pwned/count result comes back to the client.
export async function POST(request) {
  let password;
  try {
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  if (typeof password !== 'string' || password.length === 0) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const result = await checkPasswordPwned(password);
  return NextResponse.json(result);
}
