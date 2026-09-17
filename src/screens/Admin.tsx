import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { APP_DATA_KEY, useData } from '../data/DataProvider';
import {
  approveSpecialist,
  rejectSpecialist,
  setSpecialistAdmin,
  setSpecialistRole,
} from '../data/repository';
import type { Person, Role } from '../types';
import { ROLE_LABELS, ROLES } from '../lib/constants';

function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value as Role)}>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

export default function AdminScreen() {
  const { data, me } = useData();
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: APP_DATA_KEY });

  const approve = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => approveSpecialist(id, role),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (id: string) => rejectSpecialist(id),
    onSuccess: invalidate,
  });
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => setSpecialistRole(id, role),
    onSuccess: invalidate,
  });
  const changeAdmin = useMutation({
    mutationFn: ({ id, isAdmin }: { id: string; isAdmin: boolean }) => setSpecialistAdmin(id, isAdmin),
    onSuccess: invalidate,
  });

  const requests = data.people.filter((p) => p.accountStatus !== 'active');
  const team = data.people.filter((p) => p.accountStatus === 'active');

  const busy =
    approve.isPending || reject.isPending || changeRole.isPending || changeAdmin.isPending;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 920 }}>
      <h6 style={{ marginBottom: 4 }}>Admin</h6>
      <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 28 }}>
        Approve access requests and manage who can sign in.
      </p>

      <section style={{ marginBottom: 36 }}>
        <div style={{ font: '600 13px/1 var(--font-heading)', marginBottom: 12 }}>
          Requests {requests.length > 0 && <span style={{ color: 'var(--color-muted)' }}>({requests.length})</span>}
        </div>
        {requests.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>No pending or declined requests.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.map((p) => (
                <RequestRow
                  key={p.id}
                  person={p}
                  busy={busy}
                  onApprove={(role) => approve.mutate({ id: p.id, role })}
                  onReject={() => reject.mutate(p.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <div style={{ font: '600 13px/1 var(--font-heading)', marginBottom: 12 }}>
          Team {team.length > 0 && <span style={{ color: 'var(--color-muted)' }}>({team.length})</span>}
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Admin</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {team.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td style={{ color: 'var(--color-muted)' }}>{p.email ?? '—'}</td>
                <td>
                  <RolePicker
                    value={p.role ?? 'Specialist'}
                    onChange={(role) => changeRole.mutate({ id: p.id, role })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={p.isAdmin}
                    disabled={busy || p.id === me?.id}
                    title={p.id === me?.id ? "You can't change your own admin flag here" : undefined}
                    onChange={(e) => changeAdmin.mutate({ id: p.id, isAdmin: e.target.checked })}
                  />
                </td>
                <td>
                  <button
                    className="btn btn-ghost"
                    disabled={busy || p.id === me?.id}
                    title={p.id === me?.id ? "You can't revoke your own access" : undefined}
                    onClick={() => reject.mutate(p.id)}
                  >
                    Revoke access
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function RequestRow({
  person,
  busy,
  onApprove,
  onReject,
}: {
  person: Person;
  busy: boolean;
  onApprove: (role: Role) => void;
  onReject: () => void;
}) {
  const [role, setRole] = useState<Role>(person.role ?? 'Specialist');
  return (
    <tr>
      <td>{person.name}</td>
      <td style={{ color: 'var(--color-muted)' }}>{person.email ?? '—'}</td>
      <td>
        <span
          style={{
            fontSize: 11.5,
            padding: '2px 8px',
            borderRadius: 999,
            background:
              person.accountStatus === 'pending' ? 'var(--color-accent-100)' : 'var(--color-divider)',
            color: person.accountStatus === 'pending' ? 'var(--color-accent-900)' : 'var(--color-muted)',
          }}
        >
          {person.accountStatus === 'pending' ? 'Pending' : 'Declined'}
        </span>
      </td>
      <td>
        <RolePicker value={role} onChange={setRole} />
      </td>
      <td style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary" disabled={busy} onClick={() => onApprove(role)}>
          Approve
        </button>
        {person.accountStatus === 'pending' && (
          <button className="btn btn-ghost" disabled={busy} onClick={onReject}>
            Reject
          </button>
        )}
      </td>
    </tr>
  );
}
