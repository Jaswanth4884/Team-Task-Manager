import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { pool, query } from './postgres';
import {
  DatabaseState,
  Priority,
  Project,
  PublicProject,
  PublicTask,
  Role,
  Session,
  Task,
  TaskStatus,
  User
} from './types';

const dbPath = join(process.cwd(), 'data', 'db.json');
const usingPostgres = Boolean(process.env.DATABASE_URL);

function readLocalDatabase(): DatabaseState {
  if (!existsSync(dbPath)) {
    return seedDatabase();
  }

  try {
    const raw = readFileSync(dbPath, 'utf8');
    const parsed = raw.trim() ? (JSON.parse(raw) as Partial<DatabaseState>) : undefined;
    return {
      users: Array.isArray(parsed?.users) ? parsed.users : [],
      sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
      projects: Array.isArray(parsed?.projects) ? parsed.projects : [],
      tasks: Array.isArray(parsed?.tasks) ? parsed.tasks : []
    };
  } catch {
    return seedDatabase();
  }
}

function writeLocalDatabase(state: DatabaseState) {
  writeFileSync(dbPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function initializeLocalDatabase() {
  if (!existsSync(dbPath)) {
    writeLocalDatabase(seedDatabase());
  }
}

function hashPassword(password: string, salt = randomUUID().replace(/-/g, '').slice(0, 16)) {
  const derivedKey = scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hashValue] = storedHash.split(':');
  const derivedKey = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(hashValue, 'hex');
  return storedBuffer.length === derivedKey.length && timingSafeEqual(storedBuffer, derivedKey);
}

function seedDatabase(): DatabaseState {
  const now = new Date().toISOString();
  const adminId = randomUUID();
  const memberId = randomUUID();

  const users: User[] = [
    {
      id: adminId,
      name: 'Ariana Vale',
      email: 'admin@ethara.ai',
      passwordHash: hashPassword('Admin123!'),
      role: 'admin',
      createdAt: now
    },
    {
      id: memberId,
      name: 'Milan Reed',
      email: 'member@ethara.ai',
      passwordHash: hashPassword('Member123!'),
      role: 'member',
      createdAt: now
    }
  ];

  const projects: Project[] = [
    {
      id: randomUUID(),
      name: 'Ethara Launch',
      description: 'Coordinated delivery plan for the product launch, dashboard, and deployment checklist.',
      ownerId: adminId,
      dueDate: addDays(5),
      memberIds: [adminId, memberId],
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      name: 'Client Onboarding',
      description: 'Member-facing onboarding flows and data validation for new accounts.',
      ownerId: adminId,
      dueDate: addDays(10),
      memberIds: [adminId, memberId],
      createdAt: now,
      updatedAt: now
    }
  ];

  const tasks: Task[] = [
    {
      id: randomUUID(),
      projectId: projects[0].id,
      title: 'Ship signup and login flows',
      description: 'Credential authentication with role-based landing pages.',
      status: 'in-progress',
      priority: 'high',
      assigneeId: memberId,
      dueDate: addDays(1),
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      projectId: projects[0].id,
      title: 'Deploy to Railway',
      description: 'Wire the production build, environment variables, and smoke tests.',
      status: 'todo',
      priority: 'medium',
      assigneeId: adminId,
      dueDate: addDays(-2),
      createdAt: now,
      updatedAt: now
    },
    {
      id: randomUUID(),
      projectId: projects[1].id,
      title: 'Review dashboard metrics',
      description: 'Make overdue items easy to surface for the team.',
      status: 'todo',
      priority: 'low',
      assigneeId: memberId,
      dueDate: addDays(3),
      createdAt: now,
      updatedAt: now
    }
  ];

  return { users, sessions: [], projects, tasks };
}

function addDays(amount: number) {
  const date = new Date();
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function ensureSchema() {
  if (!usingPostgres) {
    await initializeLocalDatabase();
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      role text NOT NULL CHECK (role IN ('admin', 'member')),
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id text PRIMARY KEY,
      name text NOT NULL,
      description text NOT NULL,
      owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      due_date date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id text PRIMARY KEY,
      project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text NOT NULL,
      status text NOT NULL CHECK (status IN ('todo', 'in-progress', 'done')),
      priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
      assignee_id text NULL REFERENCES users(id) ON DELETE SET NULL,
      due_date date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function replaceDatabase(state: DatabaseState) {
  if (!usingPostgres) {
    writeLocalDatabase(state);
    return;
  }

  await initializeDatabase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE sessions, tasks, project_members, projects, users RESTART IDENTITY CASCADE');

    for (const user of state.users) {
      await client.query(
        'INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [user.id, user.name, user.email, user.passwordHash, user.role, user.createdAt]
      );
    }

    for (const project of state.projects) {
      await client.query(
        'INSERT INTO projects (id, name, description, owner_id, due_date, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [project.id, project.name, project.description, project.ownerId, project.dueDate, project.createdAt, project.updatedAt]
      );

      for (const memberId of project.memberIds) {
        await client.query('INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)', [project.id, memberId]);
      }
    }

    for (const task of state.tasks) {
      await client.query(
        'INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, due_date, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [task.id, task.projectId, task.title, task.description, task.status, task.priority, task.assigneeId, task.dueDate, task.createdAt, task.updatedAt]
      );
    }

    for (const session of state.sessions) {
      await client.query('INSERT INTO sessions (id, user_id, created_at) VALUES ($1, $2, $3)', [session.id, session.userId, session.createdAt]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function seedIfEmpty() {
  if (!usingPostgres) {
    await initializeLocalDatabase();
    return;
  }

  const existing = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
  if (Number(existing.rows[0]?.count ?? '0') > 0) {
    return;
  }

  await replaceDatabase(seedDatabase());
}

let schemaPromise: Promise<void> | null = null;

export async function initializeDatabase() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await ensureSchema();
      await seedIfEmpty();
    })();
  }

  await schemaPromise;
}

function toDatabaseState(rows: {
  users: User[];
  sessions: Session[];
  projects: Project[];
  tasks: Task[];
}): DatabaseState {
  return rows;
}

export async function readDatabase(): Promise<DatabaseState> {
  if (!usingPostgres) {
    await initializeLocalDatabase();
    return readLocalDatabase();
  }

  await initializeDatabase();

  const [usersResult, sessionsResult, projectsResult, membershipsResult, tasksResult] = await Promise.all([
    query<{
      id: string;
      name: string;
      email: string;
      password_hash: string;
      role: Role;
      created_at: Date;
    }>('SELECT id, name, email, password_hash, role, created_at FROM users ORDER BY created_at ASC'),
    query<{ id: string; user_id: string; created_at: Date }>('SELECT id, user_id, created_at FROM sessions ORDER BY created_at ASC'),
    query<{
      id: string;
      name: string;
      description: string;
      owner_id: string;
      due_date: string;
      created_at: Date;
      updated_at: Date;
    }>('SELECT id, name, description, owner_id, due_date AS due_date, created_at, updated_at FROM projects ORDER BY created_at ASC'),
    query<{ project_id: string; user_id: string }>('SELECT project_id, user_id FROM project_members'),
    query<{
      id: string;
      project_id: string;
      title: string;
      description: string;
      status: TaskStatus;
      priority: Priority;
      assignee_id: string | null;
      due_date: string;
      created_at: Date;
      updated_at: Date;
    }>('SELECT id, project_id, title, description, status, priority, assignee_id, due_date AS due_date, created_at, updated_at FROM tasks ORDER BY created_at ASC')
  ]);

  const users = usersResult.rows.map((row: {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: Role;
    created_at: Date;
  }) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at.toISOString()
  }));

  const sessions = sessionsResult.rows.map((row: { id: string; user_id: string; created_at: Date }) => ({
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at.toISOString()
  }));

  const memberMap = new Map<string, string[]>();
  for (const row of membershipsResult.rows) {
    const members = memberMap.get(row.project_id) ?? [];
    members.push(row.user_id);
    memberMap.set(row.project_id, members);
  }

  const projects = projectsResult.rows.map((row: {
    id: string;
    name: string;
    description: string;
    owner_id: string;
    due_date: string;
    created_at: Date;
    updated_at: Date;
  }) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.owner_id,
    dueDate: row.due_date,
    memberIds: memberMap.get(row.id) ?? [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }));

  const tasks = tasksResult.rows.map((row: {
    id: string;
    project_id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: Priority;
    assignee_id: string | null;
    due_date: string;
    created_at: Date;
    updated_at: Date;
  }) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id,
    dueDate: row.due_date,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }));

  return toDatabaseState({ users, sessions, projects, tasks });
}

export async function toPublicUsers(users: User[]) {
  return users.map(toPublicUser);
}

export async function writeDatabase(state: DatabaseState) {
  await replaceDatabase(state);
}

export function toPublicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

export async function getUserByEmail(email: string) {
  if (!usingPostgres) {
    const database = await readDatabase();
    return database.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  await initializeDatabase();
  const result = await query<{
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: Role;
    created_at: Date;
  }>('SELECT id, name, email, password_hash, role, created_at FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
  const row = result.rows[0];
  return row
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        passwordHash: row.password_hash,
        role: row.role,
        createdAt: row.created_at.toISOString()
      }
    : null;
}

export async function getUserById(userId: string) {
  if (!usingPostgres) {
    const database = await readDatabase();
    return database.users.find((user) => user.id === userId) ?? null;
  }

  await initializeDatabase();
  const result = await query<{
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: Role;
    created_at: Date;
  }>('SELECT id, name, email, password_hash, role, created_at FROM users WHERE id = $1 LIMIT 1', [userId]);
  const row = result.rows[0];
  return row
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        passwordHash: row.password_hash,
        role: row.role,
        createdAt: row.created_at.toISOString()
      }
    : null;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role?: Role;
}) {
  if (!usingPostgres) {
    const database = await readDatabase();
    const user: User = {
      id: randomUUID(),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash: hashPassword(input.password),
      role: input.role ?? 'member',
      createdAt: new Date().toISOString()
    };
    database.users.push(user);
    writeLocalDatabase(database);
    return user;
  }

  await initializeDatabase();
  const user: User = {
    id: randomUUID(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash: hashPassword(input.password),
    role: input.role ?? 'member',
    createdAt: new Date().toISOString()
  };
  await query(
    'INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [user.id, user.name, user.email, user.passwordHash, user.role, user.createdAt]
  );
  return user;
}

export async function createSession(userId: string) {
  if (!usingPostgres) {
    const database = await readDatabase();
    const session: Session = {
      id: randomUUID(),
      userId,
      createdAt: new Date().toISOString()
    };
    database.sessions.push(session);
    writeLocalDatabase(database);
    return session;
  }

  await initializeDatabase();
  const session: Session = {
    id: randomUUID(),
    userId,
    createdAt: new Date().toISOString()
  };
  await query('INSERT INTO sessions (id, user_id, created_at) VALUES ($1, $2, $3)', [session.id, session.userId, session.createdAt]);
  return session;
}

export async function getSession(sessionId: string) {
  if (!usingPostgres) {
    const database = await readDatabase();
    return database.sessions.find((session) => session.id === sessionId) ?? null;
  }

  await initializeDatabase();
  const result = await query<{ id: string; user_id: string; created_at: Date }>('SELECT id, user_id, created_at FROM sessions WHERE id = $1 LIMIT 1', [sessionId]);
  const row = result.rows[0];
  return row ? { id: row.id, userId: row.user_id, createdAt: row.created_at.toISOString() } : null;
}

export async function deleteSession(sessionId: string) {
  if (!usingPostgres) {
    const database = await readDatabase();
    database.sessions = database.sessions.filter((session) => session.id !== sessionId);
    writeLocalDatabase(database);
    return;
  }

  await initializeDatabase();
  await query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

export async function getProjectsForUser(user: User) {
  if (!usingPostgres) {
    const database = await readDatabase();
    if (user.role === 'admin') {
      return database.projects;
    }

    return database.projects.filter((project) => project.memberIds.includes(user.id));
  }

  const database = await readDatabase();
  if (user.role === 'admin') {
    return database.projects;
  }

  return database.projects.filter((project) => project.memberIds.includes(user.id));
}

export async function getProjectById(projectId: string) {
  if (!usingPostgres) {
    const database = await readDatabase();
    return database.projects.find((project) => project.id === projectId) ?? null;
  }

  const database = await readDatabase();
  return database.projects.find((project) => project.id === projectId) ?? null;
}

export async function getTasksForProject(projectId: string) {
  if (!usingPostgres) {
    const database = await readDatabase();
    return database.tasks.filter((task) => task.projectId === projectId);
  }

  const database = await readDatabase();
  return database.tasks.filter((task) => task.projectId === projectId);
}

export async function getTasksForUser(user: User) {
  if (!usingPostgres) {
    const projects = await getProjectsForUser(user);
    const projectIds = new Set(projects.map((project) => project.id));
    const database = await readDatabase();
    return database.tasks.filter((task) => projectIds.has(task.projectId));
  }

  const projects = await getProjectsForUser(user);
  const projectIds = new Set(projects.map((project) => project.id));
  const database = await readDatabase();
  return database.tasks.filter((task) => projectIds.has(task.projectId));
}

export function canAccessProject(user: User, project: Project) {
  return user.role === 'admin' || project.memberIds.includes(user.id);
}

export async function projectMetrics(project: Project, users: User[]): Promise<PublicProject> {
  const tasks = await getTasksForProject(project.id);
  const taskCount = tasks.length;
  const completedCount = tasks.filter((task) => task.status === 'done').length;
  const overdue = new Date(project.dueDate).getTime() < startOfDay().getTime() && completedCount < taskCount;
  const ownerName = users.find((user) => user.id === project.ownerId)?.name ?? 'Unknown';

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    ownerId: project.ownerId,
    ownerName,
    dueDate: project.dueDate,
    memberCount: project.memberIds.length,
    taskCount,
    completedCount,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    overdue
  };
}

export function taskToPublic(task: Task, users: User[]): PublicTask {
  const assigneeName = task.assigneeId ? users.find((user) => user.id === task.assigneeId)?.name ?? null : null;
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    assigneeId: task.assigneeId,
    assigneeName,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    overdue: task.status !== 'done' && new Date(task.dueDate).getTime() < startOfDay().getTime()
  };
}

export function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function ensureRoleCanManageProject(user: User, project: Project) {
  return user.role === 'admin' || project.ownerId === user.id;
}

export function normalizeStatus(value: string): TaskStatus | null {
  return value === 'todo' || value === 'in-progress' || value === 'done' ? value : null;
}

export function normalizePriority(value: string): Priority | null {
  return value === 'low' || value === 'medium' || value === 'high' ? value : null;
}

export { hashPassword };