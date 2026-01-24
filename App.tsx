import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { User } from './types';
import { authService } from './services/localStorageService';
import { 
  LayoutDashboard, 
  Receipt, 
  PiggyBank, 
  MessageSquareText, 
  UploadCloud, 
  LogOut,
  Wallet,
  Target,
  Settings
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

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  // Direct read ensures we have the latest data immediately after a navigation event 
  // that was preceded by a synchronous local storage update (like finishing onboarding)
  const user = authService.getCurrentUser();
  
  // State to force re-renders for the polling mechanism
  const [_, setTick] = useState(0);

  useEffect(() => {
    // Poll for changes in local storage to keep UI in sync (e.g. multi-tab or background updates)
    const interval = setInterval(() => {
        setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    authService.logout();
    window.location.reload();
  };

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Force onboarding if not completed
  if (!user.hasCompletedOnboarding && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" />;
  }

  // If completing onboarding, allow rendering children (which is the Onboarding page itself in one case)
  if (location.pathname === '/onboarding') {
      return <>{children}</>;
  }

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/transactions', label: 'Transactions', icon: Receipt },
    { path: '/budgets', label: 'Budgets', icon: PiggyBank },
    { path: '/goals', label: 'Goals', icon: Target },
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
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
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
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate group-hover:text-emerald-300 transition-colors">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
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
        <Link to="/profile" className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">
             {user.name.charAt(0).toUpperCase()}
        </Link>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto mt-16 md:mt-0">
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
        <Route path="/upload" element={<Layout><Upload /></Layout>} />
        <Route path="/chat" element={<Layout><Chat /></Layout>} />
        <Route path="/profile" element={<Layout><Profile /></Layout>} />
      </Routes>
    </HashRouter>
  );
}