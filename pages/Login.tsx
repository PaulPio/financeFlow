import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/localStorageService';
import { Wallet } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await authService.login(email);
    setLoading(false);
    navigate('/');
  };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  React.useEffect(() => {
    /* global google */
    if (window.google && process.env.GOOGLE_CLIENT_ID) {
      window.google.accounts.id.initialize({
        client_id: process.env.GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse
      });
      window.google.accounts.id.renderButton(
        document.getElementById("googleIconDiv"),
        { theme: "outline", size: "large", width: "100%" }
      );
    }
  }, []);

  const handleGoogleCredentialResponse = async (response: any) => {
    // Determine user email from JWT without verifying signature (backend should verify)
    // For demo/MVP, we just extract it.
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      if (payload.email) {
        setLoading(true);
        await authService.login(payload.email);
        setLoading(false);
        navigate('/');
      }
    } catch (e) {
      console.error("Error parsing Google token", e);
    }
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
          <div id="googleIconDiv" className="w-full flex justify-center"></div>

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