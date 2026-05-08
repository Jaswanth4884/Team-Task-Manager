'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import type { PublicUser } from '../lib/types';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', hint: 'Overview' },
  { href: '/projects', label: 'Projects', hint: 'Teams + tasks' }
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const response = await fetch('/api/me');
      if (!mounted) {
        return;
      }

      if (response.status === 401) {
        router.replace('/login');
        return;
      }

      const payload = (await response.json()) as { user: PublicUser };
      setUser(payload.user);
      setLoading(false);
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, [router]);

  const initials = useMemo(() => {
    if (!user) {
      return 'ET';
    }

    return user.name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [user]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  if (loading) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="notice">Loading workspace...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">ET</div>
          <div className="brand-copy">
            <h1>Ethara AI</h1>
            <p>Team task manager</p>
          </div>
        </div>

        <div className="nav-group">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`nav-link ${pathname?.startsWith(item.href) ? 'active' : ''}`}>
              <span>
                <strong>{item.label}</strong>
                <br />
                <span className="meta">{item.hint}</span>
              </span>
              <span>→</span>
            </Link>
          ))}
        </div>

        <div className="shell-footer">
          <div className="chip" style={{ marginBottom: 10 }}>
            {user?.role ?? 'member'} access
          </div>
          <div className="meta">
            Signed in as <strong>{user?.name}</strong>
            <br />
            {user?.email}
          </div>
          <button className="button-ghost" style={{ marginTop: 14, width: '100%' }} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="content">
        <div className="hero-top" style={{ marginBottom: 16 }}>
          <div>
            <div className="eyebrow">{user?.role === 'admin' ? 'Admin console' : 'Member workspace'}</div>
            <h2 className="page-title" style={{ fontSize: '1.8rem', marginTop: 10 }}>
              {pathname?.includes('/projects') ? 'Projects and delivery' : 'Operational dashboard'}
            </h2>
          </div>
          <div className="role-chip">
            <span>{initials}</span>
            <span>{user?.name}</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}