import { useAuth } from '../auth/AuthProvider';

type Status = 'pending' | 'rejected' | 'missing';

const COPY: Record<Status, { title: string; body: string }> = {
  pending: {
    title: 'Your account is awaiting approval',
    body:
      'An administrator needs to approve your request and assign your role before you can get into ' +
      'Planstin OE Planner. There is nothing else to do — check back later, or ask your admin to look ' +
      'for your name in the approval queue.',
  },
  rejected: {
    title: 'Access request declined',
    body: 'Your account request was not approved. Contact your administrator if you think this is a mistake.',
  },
  missing: {
    title: "We couldn't find your account",
    body:
      "You're signed in, but there's no roster record for this account. Contact an administrator to " +
      'get set up.',
  },
};

export default function PendingApproval({ status }: { status: Status }) {
  const { user, signOut } = useAuth();
  const copy = COPY[status];

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 380, textAlign: 'center' }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: 'var(--color-accent)',
            margin: '0 auto 22px',
          }}
        />
        <div style={{ font: '600 21px/1.3 var(--font-heading)', letterSpacing: '-.02em' }}>
          {copy.title}
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--color-muted)', lineHeight: 1.55, marginTop: 10 }}>
          {copy.body}
        </p>
        {user?.email && (
          <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
            Signed in as <strong style={{ color: 'var(--color-text)' }}>{user.email}</strong>
          </p>
        )}
        <button className="btn btn-secondary" style={{ marginTop: 18 }} onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
