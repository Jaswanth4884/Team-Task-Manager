'use client';

import AppShell from '../../../components/AppShell';
import { FormEvent, useEffect, useMemo, useState, use } from 'react';
import type { PublicTask, PublicUser } from '../../../lib/types';

interface ProjectDetailsPayload {
  user: PublicUser;
  project: {
    id: string;
    name: string;
    description: string;
    dueDate: string;
    ownerId: string;
    ownerName: string;
    memberCount: number;
    taskCount: number;
    completedCount: number;
    overdue: boolean;
  };
  members: PublicUser[];
  tasks: PublicTask[];
}

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ProjectDetailsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [message, setMessage] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    assigneeId: '',
    status: 'todo' as PublicTask['status']
  });

  async function loadProject() {
    const response = await fetch(`/api/projects/${id}`);
    if (response.status === 401) {
      return;
    }

    const payload = (await response.json()) as ProjectDetailsPayload;
    setData(payload);
    setLoading(false);
    setTaskAssigneeId(payload.members[0]?.id ?? '');
  }

  useEffect(() => {
    loadProject();
  }, [id]);

  const canManage = useMemo(() => data?.user.role === 'admin' || data?.project.ownerId === data?.user.id, [data]);

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: id,
        title: taskTitle,
        description: taskDescription,
        dueDate: taskDueDate,
        priority: taskPriority,
        assigneeId: taskAssigneeId || null
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? 'Unable to create task.');
      return;
    }

    setTaskTitle('');
    setTaskDescription('');
    setTaskDueDate('');
    await loadProject();
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const response = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addMemberEmail: memberEmail })
    });

    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? 'Unable to add member.');
      return;
    }

    setMemberEmail('');
    await loadProject();
  }

  function beginEdit(task: PublicTask) {
    setEditingTaskId(task.id);
    setEditDraft({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      priority: task.priority,
      assigneeId: task.assigneeId ?? '',
      status: task.status
    });
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setEditDraft({
      title: '',
      description: '',
      dueDate: '',
      priority: 'medium',
      assigneeId: '',
      status: 'todo'
    });
  }

  async function saveTask(taskId: string) {
    setMessage('');

    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editDraft.title,
        description: editDraft.description,
        dueDate: editDraft.dueDate,
        priority: editDraft.priority,
        assigneeId: editDraft.assigneeId || null,
        status: editDraft.status
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? 'Unable to save task.');
      return;
    }

    cancelEdit();
    await loadProject();
  }

  async function deleteTask(taskId: string) {
    setMessage('');
    const confirmed = window.confirm('Delete this task? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? 'Unable to delete task.');
      return;
    }

    if (editingTaskId === taskId) {
      cancelEdit();
    }
    await loadProject();
  }

  async function updateTask(taskId: string, status: PublicTask['status']) {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (response.ok) {
      await loadProject();
    }
  }

  if (loading || !data) {
    return (
      <AppShell>
        <div className="panel">Loading project board...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">Project workspace</div>
          <h1 className="page-title">{data.project.name}</h1>
          <p className="lead">{data.project.description}</p>
        </div>
        <div className="hero-actions">
          <div className="notice">{data.project.taskCount} tasks</div>
          <div className="notice">{data.project.memberCount} members</div>
          <div className={`status-chip ${data.project.overdue ? 'status-overdue' : 'status-done'}`}>
            {data.project.overdue ? 'At risk' : 'On track'}
          </div>
        </div>
      </section>

      {message ? <div className="notice error" style={{ marginBottom: 18 }}>{message}</div> : null}

      {canManage ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="section-title">Team management</div>
              <p className="page-subtitle">Add a teammate by email to give them access to this project.</p>
            </div>
          </div>
          <form className="split" onSubmit={handleAddMember}>
            <input className="field" type="email" placeholder="member@example.com" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} />
            <button className="button-secondary" type="submit">
              Add member
            </button>
          </form>
        </section>
      ) : null}

      {canManage ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="section-title">New task</div>
              <p className="page-subtitle">Create and assign work to a project member.</p>
            </div>
          </div>
          <form className="form" onSubmit={handleCreateTask}>
            <div className="split">
              <label className="field-label">
                Title
                <input className="field" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} required />
              </label>
              <label className="field-label">
                Due date
                <input className="field" type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} required />
              </label>
            </div>
            <label className="field-label">
              Description
              <textarea className="field textarea" value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} required />
            </label>
            <div className="split">
              <label className="field-label">
                Priority
                <select className="field" value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as 'low' | 'medium' | 'high')}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="field-label">
                Assignee
                <select className="field" value={taskAssigneeId} onChange={(event) => setTaskAssigneeId(event.target.value)}>
                  <option value="">Unassigned</option>
                  {data.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="button" type="submit">
              Create task
            </button>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="section-title">Tasks</div>
            <p className="page-subtitle">Use the status buttons to track progress in real time.</p>
          </div>
        </div>

        <div className="task-grid">
          {data.tasks.map((task) => (
            <article className="task-card" key={task.id}>
              {editingTaskId === task.id ? (
                <div className="task-editor">
                  <div className="task-editor-grid">
                    <label className="field-label">
                      Title
                      <input className="field" value={editDraft.title} onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))} />
                    </label>
                    <label className="field-label">
                      Due date
                      <input className="field" type="date" value={editDraft.dueDate} onChange={(event) => setEditDraft((current) => ({ ...current, dueDate: event.target.value }))} />
                    </label>
                    <label className="field-label task-span-2">
                      Description
                      <textarea className="field textarea" value={editDraft.description} onChange={(event) => setEditDraft((current) => ({ ...current, description: event.target.value }))} />
                    </label>
                    <label className="field-label">
                      Priority
                      <select className="field" value={editDraft.priority} onChange={(event) => setEditDraft((current) => ({ ...current, priority: event.target.value as 'low' | 'medium' | 'high' }))}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                    <label className="field-label">
                      Status
                      <select className="field" value={editDraft.status} onChange={(event) => setEditDraft((current) => ({ ...current, status: event.target.value as PublicTask['status'] }))}>
                        <option value="todo">Todo</option>
                        <option value="in-progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    </label>
                    <label className="field-label task-span-2">
                      Assignee
                      <select className="field" value={editDraft.assigneeId} onChange={(event) => setEditDraft((current) => ({ ...current, assigneeId: event.target.value }))}>
                        <option value="">Unassigned</option>
                        {data.members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="task-editor-actions">
                    <button className="button" type="button" onClick={() => saveTask(task.id)}>
                      Save changes
                    </button>
                    <button className="button-ghost" type="button" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="task-row">
                  <div>
                    <h3 className="task-title">{task.title}</h3>
                    <div className="task-meta">{task.description}</div>
                  </div>
                  <span className={`status-chip ${task.status === 'done' ? 'status-done' : task.status === 'in-progress' ? 'status-progress' : 'status-todo'} ${task.overdue ? 'status-overdue' : ''}`}>
                    {task.status}
                  </span>
                  <div className={task.overdue ? 'warning' : ''}>{task.dueDate}</div>
                  <div>
                    <div className="meta">{task.assigneeName ?? 'Unassigned'}</div>
                    <div className="actions" style={{ marginTop: 8 }}>
                      <button className="button-ghost" onClick={() => updateTask(task.id, 'todo')} type="button">
                        Todo
                      </button>
                      <button className="button-ghost" onClick={() => updateTask(task.id, 'in-progress')} type="button">
                        Doing
                      </button>
                      <button className="button-ghost" onClick={() => updateTask(task.id, 'done')} type="button">
                        Done
                      </button>
                    </div>
                    {canManage ? (
                      <div className="task-management-actions">
                        <button className="button-secondary" type="button" onClick={() => beginEdit(task)}>
                          Edit
                        </button>
                        <button className="button-ghost danger" type="button" onClick={() => deleteTask(task.id)}>
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}