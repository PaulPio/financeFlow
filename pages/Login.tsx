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
            <p className="text-xs text-center text-gray-400">
                (This is a demo. Entering any email will create an account locally.)
            </p>
        </form>
      </div>
    </div>
  );
}