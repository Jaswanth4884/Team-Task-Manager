import { NextRequest, NextResponse } from 'next/server';
import { toPublicUser } from '../../../lib/db';
import { getRequestUser } from '../../../lib/request';

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ user: toPublicUser(user) });
}