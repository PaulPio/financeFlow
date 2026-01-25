import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { User, AppNotification } from './types';
import { authService, notificationService } from './services/localStorageService';
import { authClient } from './lib/auth-client';
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  MessageSquareText,
  UploadCloud,
  LogOut,
  Wallet,
  Target,
  Settings,
  TrendingUp,
  Bell
} from 'lucide-react';

// Pages
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Chat from './pages/Chat';
import Upload from './pages/Upload';
import Login from './pages/Login';
import Goals from './pages/Goals';
import Profile from './pages/Profile';
import Onboarding from './pages/Onboarding';
import Investments from './pages/Investments';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  console.log("[App] Rendering Layout, Path:", location.pathname);

  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [forceUpdate, setForceUpdate] = useState(0);

  // Memoize user to avoid infinite re-renders, but depend on forceUpdate
  const user = useMemo(() => {
    const u = authService.getCurrentUser();
    console.log("[App] Local user retrieved:", u?.email || "none", "Completed:", u?.hasCompletedOnboarding);
    return u;
  }, [session?.user?.email, forceUpdate]);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Listen for manual updates (e.g. from Onboarding)
  useEffect(() => {
    const handleUserUpdate = () => {
      console.log("[App] User update event received, refreshing state...");
      setForceUpdate(prev => prev + 1);
    };
    window.addEventListener('user-updated', handleUserUpdate);
    return () => window.removeEventListener('user-updated', handleUserUpdate);
  }, []);

  // Sync session to legacy authService if missing
  useEffect(() => {
    if (session?.user && (!user || user.email !== session.user.email)) {
      console.log("[App] Syncing session to local storage:", session.user.email);
      authService.login(session.user.email);
      setForceUpdate(prev => prev + 1); // Force re-read after sync
    }
  }, [session?.user?.email, user?.email]);

  useEffect(() => {
    const userId = user?.id || session?.user?.id;
    if (!userId) {
      console.log("[App] No userId for notifications yet.");
      return;
    }

    const checkNotifs = async () => {
      try {
        console.log("[App] Checking notifications for:", userId);
        const all = await notificationService.getAll(userId);
        setNotifications(all);
        setUnreadCount(all.filter(n => !n.isRead).length);
      } catch (e) {
        console.error("[App] Notification pull failed", e);
      }
    };
    checkNotifs();
    const interval = setInterval(checkNotifs, 10000);
    return () => clearInterval(interval);
  }, [user?.id, session?.user?.id]);

  if (sessionLoading) {
    console.log("[App] Layout blocked by sessionLoading");
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium">Initializing FinFlow...</p>
      </div>
    );
  }

  if (!session) {
    console.log("[App] No session found, redirecting to /login");
    return <Navigate to="/login" replace />;
  }

  // Safety object for UI rendering
  const navUser = {
    id: session.user.id,
    name: session.user.name || user?.name || "User",
    email: session.user.email,
    // Trust the session first (DB), fall back to local if session field missing/undefined
    hasCompletedOnboarding: (session.user as any).hasCompletedOnboarding ?? user?.hasCompletedOnboarding ?? false
  };

  console.log("[App] navUser stats:", { hasCompletedOnboarding: navUser.hasCompletedOnboarding, db: (session.user as any).hasCompletedOnboarding, local: user?.hasCompletedOnboarding });

  // Redirect logic
  if (!navUser.hasCompletedOnboarding && location.pathname !== '/onboarding') {
    console.log("[App] Redirecting to /onboarding");
    return <Navigate to="/onboarding" replace />;
  }
  if (navUser.hasCompletedOnboarding && location.pathname === '/onboarding') {
    console.log("[App] Redirecting away from onboarding to /");
    return <Navigate to="/" replace />;
  }

  const markAllRead = async () => {
    if (navUser.id) {
      console.log("[App] Marking all read for:", navUser.id);
      await notificationService.markAsRead(navUser.id); // Optimized in service for user-level read
      setUnreadCount(0);
    }
  };

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      authService.logout();
      window.location.href = '/#/login';
    } catch (e) {
      console.error(e);
      authService.logout();
      window.location.href = '/#/login';
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/transactions', label: 'Transactions', icon: Receipt },
    { path: '/budgets', label: 'Budgets', icon: PiggyBank },
    { path: '/goals', label: 'Goals', icon: Target },
    { path: '/investments', label: 'Invest', icon: TrendingUp },
    { path: '/upload', label: 'Upload', icon: UploadCloud },
    { path: '/chat', label: 'AI Advisor', icon: MessageSquareText },
  ];

  return (
    <div className="flex h-screen bg-gray-50 text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full z-10 hidden md:flex">
        <div className="p-6 border-b border-slate-700 flex items-center gap-3">
          <Wallet className="h-8 w-8 text-emerald-400" />
          <h1 className="text-xl font-bold tracking-tight">FinFlow</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <Link
            to="/profile"
            className="flex items-center gap-3 px-4 py-2 mb-2 hover:bg-slate-800 rounded-lg transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold group-hover:bg-slate-600 transition-colors">
              {navUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate group-hover:text-emerald-300 transition-colors">{navUser.name}</p>
              <p className="text-xs text-slate-400 truncate">{navUser.email}</p>
            </div>
            <Settings size={16} className="text-slate-500 group-hover:text-emerald-300" />
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-md transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-slate-900 text-white z-20 h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-6 w-6 text-emerald-400" />
          <span className="font-bold text-lg">FinFlow</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) markAllRead(); }} className="relative p-1">
              <Bell size={20} />
              {unreadCount > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>}
            </button>
          </div>
          <Link to="/profile" className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">
            {navUser.name.charAt(0).toUpperCase()}
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto mt-16 md:mt-0 relative">
        {/* Desktop Notification Bell */}
        <div className="hidden md:flex absolute top-6 right-8 z-30">
          <div className="relative">
            <button
              onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) markAllRead(); }}
              className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 border border-gray-200 relative"
            >
              <Bell size={20} className="text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 transform translate-x-1/4 -translate-y-1/4 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-40">
                <div className="p-3 border-b border-gray-50 flex justify-between items-center">
                  <h3 className="font-bold text-sm text-gray-800">Notifications</h3>
                  <span className="text-xs text-gray-400">Recent alerts</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map(n => (
                      <div key={n.id} className={`p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 ${!n.isRead ? 'bg-blue-50/50' : ''}`}>
                        <p className="text-sm font-medium text-gray-800">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-2 text-right">{new Date(n.date).toLocaleDateString()}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-400 text-xs">No notifications yet</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-3 z-20">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 ${isActive ? 'text-emerald-600' : 'text-gray-500'}`}
            >
              <Icon size={20} />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  );
};

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Layout><Onboarding /></Layout>} />
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/transactions" element={<Layout><Transactions /></Layout>} />
        <Route path="/budgets" element={<Layout><Budgets /></Layout>} />
        <Route path="/goals" element={<Layout><Goals /></Layout>} />
        <Route path="/investments" element={<Layout><Investments /></Layout>} />
        <Route path="/upload" element={<Layout><Upload /></Layout>} />
        <Route path="/chat" element={<Layout><Chat /></Layout>} />
        <Route path="/profile" element={<Layout><Profile /></Layout>} />
      </Routes>
    </HashRouter>
  );
}