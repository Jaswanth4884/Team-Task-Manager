import { NextRequest, NextResponse } from 'next/server';
import { getProjectsForUser, getTasksForUser, projectMetrics, readDatabase, taskToPublic, toPublicUser } from '../../../lib/db';
import { getRequestUser } from '../../../lib/request';

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const database = await readDatabase();
  const projects = await getProjectsForUser(user);
  const tasks = await getTasksForUser(user);

  const publicProjects = (await Promise.all(projects.map((project) => projectMetrics(project, database.users)))).sort(
    (left, right) => Number(right.overdue) - Number(left.overdue) || right.updatedAt.localeCompare(left.updatedAt)
  );

  const publicTasks = tasks
    .map((task) => taskToPublic(task, database.users))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const completedCount = publicTasks.filter((task) => task.status === 'done').length;
  const openCount = publicTasks.length - completedCount;
  const overdueCount = publicTasks.filter((task) => task.overdue).length;
  const completionRate = publicTasks.length ? Math.round((completedCount / publicTasks.length) * 100) : 0;

  return NextResponse.json({
    user: toPublicUser(user),
    summary: {
      projectCount: publicProjects.length,
      taskCount: publicTasks.length,
      openCount,
      overdueCount,
      completionRate
    },
    projects: publicProjects,
    tasks: publicTasks
  });
}