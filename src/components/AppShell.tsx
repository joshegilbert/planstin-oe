import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useData } from '../data/DataProvider';
import { useUi } from '../ui/UiProvider';
import { USING_DEMO_DATA } from '../lib/supabase';
import { addDays, sow, todayIso, ISO, D } from '../lib/dates';
import { ROLE_LABELS } from '../lib/constants';
import BookingPopover from './overlays/BookingPopover';
import CapacityPopover from './overlays/CapacityPopover';
import SchedulerDrawer from './overlays/SchedulerDrawer';
import DraftDialog from './overlays/DraftDialog';

const TABS: Array<[string, string]> = [
  ['/calendar', 'Calendar'],
  ['/board', 'Capacity'],
  ['/groups', 'Groups'],
];

export default function AppShell() {
  const { user, signOut } = useAuth();
  const { me } = useData();
  const ui = useUi();
  const nav = useNavigate();
  const loc = useLocation();

  // Keyboard shortcuts: T today, W week, M month, arrows page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      const k = (e.key || '').toLowerCase();
      if (k === 't') ui.setAnchor(sow(todayIso()));
      else if (k === 'w') ui.setView('week');
      else if (k === 'm') ui.setView('month');
      else if (e.key === 'ArrowLeft') page(-1);
      else if (e.key === 'ArrowRight') page(1);
      else if (e.key === 'Escape') {
        ui.setPop(null);
        ui.setDraft(null);
        ui.setCapPop(null);
      }
    }
    function page(n: number) {
      ui.setAnchor((a) => {
        if (ui.view === 'month') {
          const d = D(addDays(a, 10));
          return sow(ISO(new Date(d.getFullYear(), d.getMonth() + n, 1)));
        }
        return addDays(a, 7 * n * (ui.view === 'week' ? 1 : 2));
      });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  const meLabel = me ? `${me.name} · ${me.role ? ROLE_LABELS[me.role] : ''}` : user?.email ?? '';
  const tabs = me?.isAdmin ? [...TABS, ['/admin', 'Admin'] as [string, string]] : TABS;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 26,
          padding: '0 22px',
          height: 58,
          borderBottom: '1px solid var(--color-divider)',
          position: 'sticky',
          top: 0,
          background: 'rgba(255,255,255,.86)',
          backdropFilter: 'saturate(180%) blur(14px)',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ font: '600 15.5px/1 var(--font-heading)', letterSpacing: '-.02em' }}>
            Planstin <span style={{ color: 'var(--color-muted)', fontWeight: 500 }}>OE</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {tabs.map(([to, label]) => {
            const on = loc.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                onClick={() => ui.setPop(null)}
                style={{
                  border: 0,
                  borderBottom: `2px solid ${on ? 'var(--color-accent)' : 'transparent'}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '19px 13px 17px',
                  font: '600 12px/1 var(--font-heading)',
                  letterSpacing: '.04em',
                  textDecoration: 'none',
                  color: on ? 'var(--color-text)' : 'color-mix(in srgb,var(--color-text) 55%,transparent)',
                }}
              >
                {label}
              </NavLink>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: 'color-mix(in srgb,var(--color-text) 60%,transparent)' }}>
          {meLabel}
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => {
            void signOut().then(() => nav('/signin'));
          }}
          style={{ fontSize: 12 }}
        >
          Sign out
        </button>
      </div>

      {USING_DEMO_DATA && (
        <div className="demo-banner">
          <strong style={{ fontWeight: 600 }}>Demo data</strong>
          <span>
            No Supabase project is connected. Everything you change is kept in this browser only — set
            VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to go live.
          </span>
        </div>
      )}

      <Outlet />

      <BookingPopover />
      <CapacityPopover />
      <SchedulerDrawer />
      <DraftDialog />
    </div>
  );
}
