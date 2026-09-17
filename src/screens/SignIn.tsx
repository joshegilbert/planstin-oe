import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { USING_DEMO_DATA } from '../lib/supabase';

type Mode = 'password' | 'signup';

export default function SignIn() {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'password') {
        await signInWithPassword(email.trim(), password);
      } else {
        const { needsConfirmation } = await signUpWithPassword(email.trim(), password, name.trim());
        if (needsConfirmation) setConfirm(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const tabStyle = (on: boolean) => ({
    border: 0,
    background: 'transparent',
    cursor: 'pointer',
    padding: '0 0 9px',
    font: '600 13px/1 var(--font-heading)',
    color: on ? 'var(--color-text)' : 'var(--color-muted)',
    borderBottom: `2px solid ${on ? 'var(--color-accent)' : 'transparent'}`,
  });

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <div
        style={{
          padding: '64px 56px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid var(--color-divider)',
          background: '#fff',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: 'var(--color-accent)',
                display: 'block',
              }}
            />
            <span style={{ font: '600 17px/1 var(--font-heading)', letterSpacing: '-.02em' }}>
              Planstin
            </span>
          </div>
          <h1 style={{ margin: '18px 0 0', fontSize: 56, lineHeight: 0.98, letterSpacing: '-.03em' }}>
            Open
            <br />
            Enrollment
            <br />
            Planner
          </h1>
          <hr className="hr" style={{ margin: '28px 0' }} />
          <p
            style={{
              maxWidth: '30ch',
              fontSize: 15,
              color: 'color-mix(in srgb,var(--color-text) 62%,transparent)',
            }}
          >
            Specialist capacity, OE windows and eNav deadlines in one shared view. Sign in with your
            Planstin email to see whose groups are whose.
          </p>
        </div>
        <div style={{ fontSize: 11, color: 'color-mix(in srgb,var(--color-text) 50%,transparent)' }}>
          Edits are stamped with your name.
        </div>
      </div>

      <div style={{ padding: '64px 56px', display: 'flex', flexDirection: 'column' }}>
        <h6 style={{ marginBottom: 14 }}>Sign in</h6>

        {confirm ? (
          <div style={{ maxWidth: 380 }}>
            <div style={{ font: '600 21px/1.2 var(--font-heading)', letterSpacing: '-.02em' }}>
              Confirm your address
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.5 }}>
              Your request is submitted. Click the confirmation link we emailed to{' '}
              <strong style={{ color: 'var(--color-text)' }}>{email}</strong>, then sign in — an
              administrator will still need to approve your account and assign your role before you can
              get in.
            </p>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setConfirm(false);
                setMode('password');
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ maxWidth: 380 }}>
            <div
              style={{
                display: 'flex',
                gap: 20,
                borderBottom: '1px solid var(--color-divider)',
                marginBottom: 22,
              }}
            >
              <button
                type="button"
                style={tabStyle(mode === 'password')}
                onClick={() => setMode('password')}
              >
                Sign in
              </button>
              <button
                type="button"
                style={tabStyle(mode === 'signup')}
                onClick={() => setMode('signup')}
              >
                Create account
              </button>
            </div>

            {mode === 'signup' && (
              <div className="field" style={{ marginBottom: 14 }}>
                <label htmlFor="signin-name">Full name</label>
                <input
                  id="signin-name"
                  className="input"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor="signin-email">Work email</label>
              <input
                id="signin-email"
                className="input"
                type="email"
                required
                autoComplete="email"
                placeholder="you@planstin.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor="signin-password">Password</label>
              <input
                id="signin-password"
                className="input"
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div
                style={{
                  border: '1px solid var(--color-accent-300)',
                  background: 'var(--color-accent-100)',
                  color: 'var(--color-accent-900)',
                  borderRadius: 11,
                  padding: '10px 13px',
                  fontSize: 12.5,
                  marginBottom: 14,
                }}
              >
                {error}
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Working…' : mode === 'password' ? 'Sign in' : 'Create account'}
            </button>

            {mode === 'signup' && (
              <p style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 18, lineHeight: 1.5 }}>
                An administrator reviews every new request and assigns your role before you can sign in.
              </p>
            )}

            {USING_DEMO_DATA && (
              <p
                style={{
                  fontSize: 11.5,
                  color: 'var(--color-accent-900)',
                  background: 'var(--color-accent-100)',
                  border: '1px solid var(--color-accent-200)',
                  borderRadius: 11,
                  padding: '10px 13px',
                  marginTop: 18,
                  lineHeight: 1.5,
                }}
              >
                Supabase is not configured, so this is a local demo sign-in — any email gets you in.
                Try <strong>dana@planstin.com</strong> or <strong>sarah@planstin.com</strong> to land on
                that person&rsquo;s view.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
