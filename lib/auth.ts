import { cookies } from 'next/headers';
import { getSession, getUserById, toPublicUser } from './db';

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session')?.value;
  if (!sessionId) {
    return null;
  }

  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }

  const user = await getUserById(session.userId);
  return user ? toPublicUser(user) : null;
}