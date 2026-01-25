import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/localStorageService';
import { authClient, signIn } from '../lib/auth-client';
import { Wallet, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Better Auth Session Hook
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  // Session Bridge: If Better Auth has a session (e.g. from Google), sync it to legacy authService
  useEffect(() => {
    const syncSession = async () => {
      if (session?.user?.email) {
        // Check if we already have a local user to avoid loops or redundant calls, 
        // though authService.login is safe to call repeatedly (it returns user)
        const currentUser = authService.getCurrentUser();
        if (!currentUser || currentUser.email !== session.user.email) {
          const user = await authService.login(session.user.email);
          if (user.hasCompletedOnboarding) {
            navigate('/');
          } else {
            navigate('/onboarding');
          }
        } else {
          // If already synced, just ensure we are in the right place
          if (currentUser.hasCompletedOnboarding) {
            navigate('/');
          }
        }
      }
    };
    if (session) {
      syncSession();
    }
  }, [session, navigate]);


  const handleLoginSuccess = (user: any) => {
    setLoading(false);
    if (user.hasCompletedOnboarding) {
      navigate('/');
    } else {
      // Explicitly send to onboarding if not done
      navigate('/onboarding');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const user = await authService.login(email);
    handleLoginSuccess(user);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    await signIn.social({
      provider: "google",
      callbackURL: window.location.href // Return to login page to trigger the bridge useEffect
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wallet className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">FinFlow</h1>
          <p className="text-gray-500 mt-2">AI-Powered Financial Clarity</p>
        </div>

        <div className="space-y-6">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />}
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                id="email"
                required
                placeholder="demo@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white text-gray-900 placeholder-gray-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center justify-center"
            >
              {loading ? 'Signing in...' : 'Sign In / Register'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}