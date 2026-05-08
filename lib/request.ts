import { NextRequest } from 'next/server';
import { getSession, getUserById } from './db';

export async function getRequestUser(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value;
  if (!sessionId) {
    return null;
  }

  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }

  return getUserById(session.userId);
}