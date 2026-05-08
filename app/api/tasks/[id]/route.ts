import { NextRequest, NextResponse } from 'next/server';
import { getProjectById, getUserById, normalizePriority, normalizeStatus, readDatabase, taskToPublic, writeDatabase } from '../../../../lib/db';
import { getRequestUser } from '../../../../lib/request';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const database = await readDatabase();
  const { id } = await params;
  const task = database.tasks.find((candidate) => candidate.id === id);
  if (!task) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
  }

  const project = await getProjectById(task.projectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const isAdmin = user.role === 'admin';
  const isAssignee = task.assigneeId === user.id;
  const isProjectMember = project.memberIds.includes(user.id);

  if (!isAdmin && !isAssignee && !isProjectMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    dueDate?: string;
    assigneeId?: string | null;
  };

  if (body.title !== undefined && isAdmin) {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: 'Task title cannot be empty.' }, { status: 400 });
    }
    task.title = title;
  }

  if (body.description !== undefined && isAdmin) {
    const description = body.description.trim();
    if (!description) {
      return NextResponse.json({ error: 'Task description cannot be empty.' }, { status: 400 });
    }
    task.description = description;
  }

  if (body.status !== undefined) {
    const status = normalizeStatus(body.status);
    if (!status) {
      return NextResponse.json({ error: 'Invalid task status.' }, { status: 400 });
    }

    if (!isAdmin && !isAssignee) {
      return NextResponse.json({ error: 'Only the assignee or an admin can change status.' }, { status: 403 });
    }

    task.status = status;
  }

  if (body.priority !== undefined && isAdmin) {
    const priority = normalizePriority(body.priority);
    if (!priority) {
      return NextResponse.json({ error: 'Invalid priority.' }, { status: 400 });
    }
    task.priority = priority;
  }

  if (body.dueDate !== undefined && isAdmin) {
    const dueDate = body.dueDate.trim();
    if (!dueDate) {
      return NextResponse.json({ error: 'Due date cannot be empty.' }, { status: 400 });
    }
    task.dueDate = dueDate;
  }

  if (body.assigneeId !== undefined && isAdmin) {
    if (body.assigneeId) {
      const candidate = await getUserById(body.assigneeId);
      if (!candidate || !project.memberIds.includes(candidate.id)) {
        return NextResponse.json({ error: 'Assignee must be a project member.' }, { status: 400 });
      }
      task.assigneeId = candidate.id;
    } else {
      task.assigneeId = null;
    }
  }

  task.updatedAt = new Date().toISOString();
  await writeDatabase(database);
  return NextResponse.json({ task: taskToPublic(task, database.users) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can delete tasks.' }, { status: 403 });
  }

  const database = await readDatabase();
  const { id } = await params;
  database.tasks = database.tasks.filter((task) => task.id !== id);
  await writeDatabase(database);
  return NextResponse.json({ ok: true });
}