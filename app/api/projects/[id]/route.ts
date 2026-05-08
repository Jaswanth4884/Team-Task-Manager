import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { canAccessProject, ensureRoleCanManageProject, getProjectById, getUserByEmail, projectMetrics, readDatabase, taskToPublic, toPublicUser, writeDatabase } from '../../../../lib/db';
import { getRequestUser } from '../../../../lib/request';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (!canAccessProject(user, project)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const database = await readDatabase();
  const members = project.memberIds.map((memberId) => database.users.find((candidate) => candidate.id === memberId)).filter(Boolean).map((member) => toPublicUser(member!));
  const tasks = database.tasks.filter((task) => task.projectId === project.id).map((task) => taskToPublic(task, database.users));

  return NextResponse.json({
    user: toPublicUser(user),
    project: projectMetrics(project, database.users),
    members,
    tasks
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const database = await readDatabase();
  const { id } = await params;
  const project = database.projects.find((candidate) => candidate.id === id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  if (!ensureRoleCanManageProject(user, project)) {
    return NextResponse.json({ error: 'Only the project owner or an admin can change this workspace.' }, { status: 403 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    dueDate?: string;
    addMemberEmail?: string;
  };

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: 'Project name cannot be empty.' }, { status: 400 });
    }
    project.name = name;
  }

  if (body.description !== undefined) {
    const description = body.description.trim();
    if (!description) {
      return NextResponse.json({ error: 'Project description cannot be empty.' }, { status: 400 });
    }
    project.description = description;
  }

  if (body.dueDate !== undefined && body.dueDate.trim()) {
    project.dueDate = body.dueDate.trim();
  }

  if (body.addMemberEmail) {
    const invitedUser = await getUserByEmail(body.addMemberEmail.trim());
    if (!invitedUser) {
      return NextResponse.json({ error: 'No registered user matches that email.' }, { status: 404 });
    }

    if (!project.memberIds.includes(invitedUser.id)) {
      project.memberIds.push(invitedUser.id);
    }
  }

  project.updatedAt = new Date().toISOString();
  await writeDatabase(database);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can delete projects.' }, { status: 403 });
  }

  const database = await readDatabase();
  const { id } = await params;
  database.projects = database.projects.filter((project) => project.id !== id);
  database.tasks = database.tasks.filter((task) => task.projectId !== id);
  await writeDatabase(database);
  return NextResponse.json({ ok: true });
}