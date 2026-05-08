'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@ethara.ai');
  const [password, setPassword] = useState('Admin123!');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function readResponsePayload(response: Response) {
    const text = await response.text();
    return text ? (JSON.parse(text) as { error?: string }) : {};
  }

  useEffect(() => {
    fetch('/api/me')
      .then((response) => {
        if (response.ok) {
          router.replace('/dashboard');
        }
      })
      .catch(() => undefined);
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const payload = await readResponsePayload(response);
    setLoading(false);

    if (!response.ok) {
      setMessage(payload.error ?? 'Unable to log in.');
      return;
    }

    router.replace('/dashboard');
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card form" onSubmit={handleSubmit}>
        <div className="auth-header">
          <div>
            <div className="auth-logo">ET</div>
            <p className="eyebrow" style={{ marginTop: 16 }}>
              Secure access
            </p>
            <h1 className="page-title" style={{ fontSize: '2.1rem', marginTop: 10 }}>
              Log in to Ethara
            </h1>
            <p className="lead">Use the seeded admin account or sign up as a new member.</p>
          </div>
        </div>

        {message ? <div className="notice error">{message}</div> : null}

        <label className="field-label">
          Email
          <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>

        <label className="field-label">
          Password
          <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>

        <button className="button" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <div className="notice">
          Demo admin: <strong>admin@ethara.ai</strong> / <strong>Admin123!</strong>
          <br />
          Demo member: <strong>member@ethara.ai</strong> / <strong>Member123!</strong>
        </div>

        <p className="muted">
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </form>
    </div>
  );
}