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
    } catch (e) {
      console.error("SignOut error:", e);
    } finally {
      authService.logout();
      // Force reload to clear all states
      window.location.assign('/');
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
      <aside className="w-72 bg-slate-900 text-white flex flex-col fixed h-full z-10 hidden md:flex border-r border-slate-800 shadow-2xl">
        <div className="p-8 border-b border-slate-800/50 flex items-center gap-3 group cursor-pointer">
          <div className="p-2 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-all duration-300">
            <Wallet className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-emerald-400 bg-clip-text text-transparent brand-font">FinFlow</h1>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${isActive
                  ? 'bg-emerald-600/90 text-white shadow-lg shadow-emerald-900/20 translate-x-1'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
              >
                <Icon size={20} className={isActive ? 'text-white' : 'group-hover:text-emerald-400 transition-colors'} />
                <span className="font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-800/50">
          <Link
            to="/profile"
            className="flex items-center gap-3 px-4 py-3 mb-4 hover:bg-slate-800/50 rounded-xl transition-all duration-200 group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-sm font-bold border border-slate-600 group-hover:border-emerald-500/50 transition-colors">
              {navUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate group-hover:text-emerald-400 transition-colors">{navUser.name}</p>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">{navUser.email}</p>
            </div>
            <Settings size={16} className="text-slate-600 group-hover:text-emerald-400 transition-all" />
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-slate-900 text-white z-20 h-16 flex items-center justify-between px-6 border-b border-slate-800 shadow-lg">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="p-1.5 bg-emerald-500/10 rounded-lg group-active:scale-95 transition-transform">
            <Wallet className="h-6 w-6 text-emerald-400" />
          </div>
          <span className="font-bold text-xl brand-font bg-gradient-to-r from-white to-emerald-400 bg-clip-text text-transparent">FinFlow</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) markAllRead(); }}
              className="relative p-2 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <Bell size={20} className="text-slate-300" />
              {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-slate-900"></span>}
            </button>
          </div>
          <Link to="/profile" className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-sm font-bold border border-slate-600">
            {navUser.name.charAt(0).toUpperCase()}
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 p-4 md:p-10 overflow-y-auto mt-16 md:mt-0 relative bg-[#f9fafb]">
        {/* Desktop Notification Bell - Repositioned to avoid overlap */}
        <div className="hidden md:flex justify-end mb-6">
          <div className="relative">
            <button
              onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) markAllRead(); }}
              className="p-2.5 bg-white/70 backdrop-blur-md rounded-2xl shadow-sm hover:shadow-md hover:bg-white transition-all border border-gray-200/50 relative group"
            >
              <Bell size={20} className="text-gray-600 group-hover:text-emerald-600 transition-colors" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 transform translate-x-1/3 -translate-y-1/3 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center shadow-lg shadow-emerald-500/20">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 mt-3 w-85 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-40 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-bold text-sm text-gray-800 brand-font">Notifications</h3>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Updates</span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map(n => (
                      <div key={n.id} className={`p-4 border-b border-gray-50 last:border-0 hover:bg-emerald-50/30 transition-colors ${!n.isRead ? 'bg-emerald-50/50' : ''}`}>
                        <div className="flex gap-3">
                          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!n.isRead ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                          <div>
                            <p className="text-sm font-semibold text-gray-800 leading-tight">{n.title}</p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-gray-400 mt-2 font-medium">{new Date(n.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Bell size={20} className="text-gray-300" />
                      </div>
                      <p className="text-gray-400 text-xs font-medium">All caught up!</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto pb-20 md:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 flex justify-around p-3 z-20 pb-safe shadow-[0_-4px_20px_0_rgba(0,0,0,0.03)]">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1.5 px-3 py-1 rounded-xl transition-all ${isActive ? 'text-emerald-600 bg-emerald-50 content-[""]' : 'text-gray-400'}`}
            >
              <Icon size={22} className={isActive ? 'scale-110' : ''} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
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