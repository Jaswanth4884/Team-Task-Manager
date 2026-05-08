import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { canAccessProject, getProjectById, normalizePriority, readDatabase, taskToPublic, writeDatabase } from '../../../lib/db';
import { getRequestUser } from '../../../lib/request';

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    projectId?: string;
    title?: string;
    description?: string;
    dueDate?: string;
    priority?: string;
    assigneeId?: string | null;
  };

  const projectId = body.projectId?.trim();
  const title = body.title?.trim();
  const description = body.description?.trim();
  const dueDate = body.dueDate?.trim();
  const priority = normalizePriority(body.priority ?? '') ?? 'medium';

  if (!projectId || !title || !description || !dueDate) {
    return NextResponse.json({ error: 'Project, title, description, and due date are required.' }, { status: 400 });
  }

  const database = await readDatabase();
  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (!canAccessProject(user, project)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const assigneeId = body.assigneeId && project.memberIds.includes(body.assigneeId) ? body.assigneeId : null;

  database.tasks.unshift({
    id: randomUUID(),
    projectId,
    title,
    description,
    status: 'todo',
    priority,
    assigneeId,
    dueDate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  await writeDatabase(database);

  return NextResponse.json({ ok: true });
}