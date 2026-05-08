'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function readResponsePayload(response: Response) {
    const text = await response.text();
    return text ? (JSON.parse(text) as { error?: string }) : {};
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });

    const payload = await readResponsePayload(response);
    setLoading(false);

    if (!response.ok) {
      setMessage(payload.error ?? 'Unable to create account.');
      return;
    }

    router.replace('/dashboard');
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card form" onSubmit={handleSubmit}>
        <div>
          <div className="auth-logo">ET</div>
          <p className="eyebrow" style={{ marginTop: 16 }}>
            Create workspace access
          </p>
          <h1 className="page-title" style={{ fontSize: '2.1rem', marginTop: 10 }}>
            Join Ethara
          </h1>
          <p className="lead">Create an account as an admin or member and start working inside the task board.</p>
        </div>

        {message ? <div className="notice error">{message}</div> : null}

        <label className="field-label">
          Full name
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>

        <label className="field-label">
          Email
          <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>

        <div className="split">
          <label className="field-label">
            Password
            <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>

          <label className="field-label">
            Role
            <select className="field" value={role} onChange={(event) => setRole(event.target.value as 'admin' | 'member')}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>

        <button className="button" type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>

        <p className="muted">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}