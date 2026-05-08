import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getProjectsForUser, projectMetrics, readDatabase, toPublicUser, writeDatabase } from '../../../lib/db';
import { getRequestUser } from '../../../lib/request';

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const database = await readDatabase();
  const projects = await Promise.all((await getProjectsForUser(user)).map((project) => projectMetrics(project, database.users)));
  return NextResponse.json({ user: toPublicUser(user), projects });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can create projects.' }, { status: 403 });
  }

  const body = (await request.json()) as { name?: string; description?: string; dueDate?: string };
  const name = body.name?.trim();
  const description = body.description?.trim();
  const dueDate = body.dueDate?.trim() || new Date().toISOString().slice(0, 10);

  if (!name || !description) {
    return NextResponse.json({ error: 'Project name and description are required.' }, { status: 400 });
  }

  const database = await readDatabase();
  database.projects.unshift({
    id: randomUUID(),
    name,
    description,
    ownerId: user.id,
    dueDate,
    memberIds: [user.id],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  await writeDatabase(database);

  return NextResponse.json({ ok: true });
}