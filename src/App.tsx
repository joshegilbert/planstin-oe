import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { DataProvider, useData } from './data/DataProvider';
import { UiProvider } from './ui/UiProvider';
import AppShell from './components/AppShell';
import SignIn from './screens/SignIn';
import PendingApproval from './screens/PendingApproval';
import CalendarScreen from './screens/Calendar';
import BoardScreen from './screens/Board';
import GroupsScreen from './screens/Groups';
import GroupDetailScreen from './screens/GroupDetail';
import AdminScreen from './screens/Admin';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

function Splash({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        fontSize: 13,
        color: 'var(--color-muted)',
      }}
    >
      {children}
    </div>
  );
}

/** Blocks the app shell until Supabase has told us whether there is a session. */
function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash>Loading…</Splash>;
  if (!user) return <Navigate to="/signin" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

/**
 * Once authenticated, still blocks the app shell until the linked roster row
 * is 'active' — a pending or rejected sign-up sees PendingApproval instead,
 * on every route, no matter what URL they land on.
 */
function RequireActiveAccount() {
  const { me, loading } = useData();
  if (loading) return <Splash>Loading…</Splash>;
  if (!me) return <PendingApproval status="missing" />;
  if (me.accountStatus !== 'active') return <PendingApproval status={me.accountStatus} />;
  return <Outlet />;
}

/** /admin is only for accounts with the admin flag set. */
function RequireAdmin() {
  const { me } = useData();
  if (!me?.isAdmin) return <Navigate to="/calendar" replace />;
  return <Outlet />;
}

/** Signed-in users never need the sign-in screen. */
function PublicOnly() {
  const { user, loading } = useAuth();
  if (loading) return <Splash>Loading…</Splash>;
  if (user) return <Navigate to="/calendar" replace />;
  return <Outlet />;
}

function Routed() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/signin" element={<SignIn />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<RequireActiveAccount />}>
          <Route element={<AppShell />}>
            <Route path="/calendar" element={<CalendarScreen />} />
            <Route path="/board" element={<BoardScreen />} />
            <Route path="/groups" element={<GroupsScreen />} />
            <Route path="/groups/:id" element={<GroupDetailScreen />} />
            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<AdminScreen />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/calendar" replace />} />
      <Route path="*" element={<Navigate to="/calendar" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DataProvider>
          <UiProvider>
            <BrowserRouter>
              <Routed />
            </BrowserRouter>
          </UiProvider>
        </DataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
