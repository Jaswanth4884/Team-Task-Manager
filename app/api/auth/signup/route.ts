import { NextRequest, NextResponse } from 'next/server';
import { createSession, createUser, getUserByEmail, toPublicUser } from '../../../../lib/db';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'member';
  };

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();
  const role = body.role === 'admin' ? 'admin' : 'member';

  if (!name || !email || !password || password.length < 8) {
    return NextResponse.json({ error: 'Please complete the form with a valid password.' }, { status: 400 });
  }

  if (await getUserByEmail(email)) {
    return NextResponse.json({ error: 'That email is already registered.' }, { status: 409 });
  }

  const user = await createUser({ name, email, password, role });
  const session = await createSession(user.id);
  const response = NextResponse.json({ user: toPublicUser(user) });
  response.cookies.set('session', session.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
  return response;
}