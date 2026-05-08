'use client';

import AppShell from '../../components/AppShell';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import type { PublicProject, PublicUser } from '../../lib/types';

interface ProjectListPayload {
  user: PublicUser;
  projects: PublicProject[];
}

export default function ProjectsPage() {
  const [data, setData] = useState<ProjectListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadProjects() {
      const response = await fetch('/api/projects');
      if (response.status === 401) {
        return;
      }

      const payload = (await response.json()) as ProjectListPayload;
      setData(payload);
      setLoading(false);
    }

    loadProjects();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, dueDate })
    });

    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? 'Unable to create project.');
      return;
    }

    setName('');
    setDescription('');
    setDueDate('');
    const refresh = await fetch('/api/projects');
    setData(await refresh.json());
  }

  if (loading || !data) {
    return (
      <AppShell>
        <div className="panel">Loading projects...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="section-title">Projects</div>
            <p className="page-subtitle">Create, view, and open the live project boards.</p>
          </div>
        </div>

        {data.user.role === 'admin' ? (
          <form className="form" onSubmit={handleCreate}>
            <div className="split">
              <label className="field-label">
                Project name
                <input className="field" value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
              <label className="field-label">
                Due date
                <input className="field" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
            </div>
            <label className="field-label">
              Description
              <textarea className="field textarea" value={description} onChange={(event) => setDescription(event.target.value)} required />
            </label>
            {message ? <div className="notice error">{message}</div> : null}
            <button className="button" type="submit">
              Create project
            </button>
          </form>
        ) : (
          <div className="notice">Members can view their assigned projects and open task boards.</div>
        )}
      </section>

      <section className="panel">
        <div className="project-grid">
          {data.projects.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-header">
                <div>
                  <h3 className="project-name">{project.name}</h3>
                  <p className="card-subtitle">{project.description}</p>
                </div>
                <span className={`status-chip ${project.overdue ? 'status-overdue' : 'status-done'}`}>
                  {project.overdue ? 'Delayed' : 'Active'}
                </span>
              </div>
              <p className="meta">
                {project.taskCount} tasks • {project.memberCount} members • due {project.dueDate}
              </p>
              <div className="actions" style={{ marginTop: 12 }}>
                <Link href={`/projects/${project.id}`} className="button-secondary">
                  Open board
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}