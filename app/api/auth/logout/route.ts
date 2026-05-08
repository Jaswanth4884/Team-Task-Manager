import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '../../../../lib/db';

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value;
  if (sessionId) {
    await deleteSession(sessionId);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('session', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}