'use client';

import AppShell from '../../components/AppShell';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PublicProject, PublicTask, PublicUser } from '../../lib/types';

interface DashboardPayload {
  user: PublicUser;
  summary: {
    projectCount: number;
    taskCount: number;
    openCount: number;
    overdueCount: number;
    completionRate: number;
  };
  projects: PublicProject[];
  tasks: PublicTask[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const response = await fetch('/api/dashboard');
      if (response.status === 401) {
        return;
      }

      const payload = (await response.json()) as DashboardPayload;
      setData(payload);
      setLoading(false);
    }

    loadDashboard();
  }, []);

  if (loading || !data) {
    return (
      <AppShell>
        <div className="panel">Loading dashboard...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">Real-time team view</div>
          <h1 className="page-title">Plan projects, assign work, and watch overdue items surface instantly.</h1>
          <p className="lead">
            {data.user.role === 'admin'
              ? 'You can manage every project, assign tasks, and maintain team access.'
              : 'You can see your assigned projects, update task status, and keep delivery moving.'}
          </p>
        </div>
        <div className="hero-actions">
          <Link href="/projects" className="button">
            Open projects
          </Link>
          <div className="notice">
            <strong>{data.summary.overdueCount}</strong> overdue task{data.summary.overdueCount === 1 ? '' : 's'}
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Projects</div>
          <div className="stat-value">{data.summary.projectCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tasks</div>
          <div className="stat-value">{data.summary.taskCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Open work</div>
          <div className="stat-value">{data.summary.openCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completion</div>
          <div className="stat-value">{data.summary.completionRate}%</div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="section-title">Projects</div>
            <p className="page-subtitle">Active workspaces and delivery milestones.</p>
          </div>
          <Link href="/projects" className="button-secondary">
            Manage all projects
          </Link>
        </div>

        <div className="project-grid">
          {data.projects.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-header">
                <div>
                  <h3 className="project-name">{project.name}</h3>
                  <p className="card-subtitle">{project.description}</p>
                </div>
                <span className={`status-chip ${project.overdue ? 'status-overdue' : 'status-done'}`}>
                  {project.overdue ? 'Delayed' : 'On track'}
                </span>
              </div>
              <p className="meta">
                {project.taskCount} tasks • {project.memberCount} members • owner {project.ownerName}
              </p>
              <Link href={`/projects/${project.id}`} className="button-ghost" style={{ marginTop: 12, display: 'inline-flex' }}>
                Open project
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="section-title">Tasks</div>
            <p className="page-subtitle">Most recent tasks across your accessible projects.</p>
          </div>
        </div>

        {data.tasks.length ? (
          <div className="table">
            <div className="table-head">
              <span>Task</span>
              <span>Status</span>
              <span>Due</span>
              <span>Owner</span>
            </div>
            {data.tasks.slice(0, 6).map((task) => (
              <div className="table-row" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <div className="meta">{task.description}</div>
                </div>
                <span className={`status-chip ${task.status === 'done' ? 'status-done' : task.status === 'in-progress' ? 'status-progress' : 'status-todo'} ${task.overdue ? 'status-overdue' : ''}`}>
                  {task.status}
                </span>
                <span className={task.overdue ? 'warning' : ''}>{task.dueDate}</span>
                <span>{task.assigneeName ?? 'Unassigned'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div>
              <h3 className="empty-title">No tasks yet</h3>
              <p className="empty-copy">Create a project to begin assigning work.</p>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}