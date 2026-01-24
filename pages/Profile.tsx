import React, { useState, useEffect } from 'react';
import { authService } from '../services/localStorageService';
import { User } from '../types';
import { User as UserIcon, Shield, Bell, Key, CreditCard, Save, Check } from 'lucide-react';

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'preferences'>('general');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const [formData, setFormData] = useState({
      name: '',
      email: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
  });

  const [toggles, setToggles] = useState({
      emailAlerts: true,
      monthlyReports: true,
      twoFactor: false
  });

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
        setUser(currentUser);
        setFormData(prev => ({ ...prev, name: currentUser.name, email: currentUser.email }));
    }
  }, []);

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
        if (activeTab === 'general') {
            const updated = authService.updateUser({ name: formData.name, email: formData.email });
            if (updated) setUser(updated);
            setSuccessMsg('Profile details updated successfully.');
        } else if (activeTab === 'security') {
            setSuccessMsg('Security settings updated. (Password not actually changed in demo)');
            setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
        }
        
        setLoading(false);
        setTimeout(() => setSuccessMsg(''), 3000);
    }, 800);
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div>
          <h2 className="text-2xl font-bold text-gray-800">Account Settings</h2>
          <p className="text-gray-500 text-sm">Manage your profile, security, and preferences.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar Menu */}
          <div className="w-full md:w-64 flex-shrink-0">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 text-center border-b border-gray-100 bg-gray-50">
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <h3 className="font-bold text-gray-800 truncate">{user.name}</h3>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <nav className="p-2 space-y-1">
                      <button 
                        onClick={() => setActiveTab('general')}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'general' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                          <UserIcon size={18} />
                          General Profile
                      </button>
                      <button 
                        onClick={() => setActiveTab('security')}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'security' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                          <Shield size={18} />
                          Security
                      </button>
                      <button 
                        onClick={() => setActiveTab('preferences')}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'preferences' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                          <Bell size={18} />
                          Preferences
                      </button>
                  </nav>
              </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  {successMsg && (
                      <div className="mb-6 p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2 text-emerald-700 text-sm">
                          <Check size={16} />
                          {successMsg}
                      </div>
                  )}

                  {activeTab === 'general' && (
                      <form onSubmit={handleUpdateProfile} className="space-y-4">
                          <h3 className="text-lg font-bold text-gray-800 mb-4">Profile Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                  <label className="text-sm font-medium text-gray-700">Full Name</label>
                                  <input 
                                    type="text" 
                                    required
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-gray-900"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                  />
                              </div>
                              <div className="space-y-1">
                                  <label className="text-sm font-medium text-gray-700">Email Address</label>
                                  <input 
                                    type="email" 
                                    required
                                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-gray-900"
                                    value={formData.email}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                  />
                              </div>
                          </div>
                          
                          <div className="pt-4 border-t border-gray-100 flex justify-end">
                              <button 
                                type="submit" 
                                disabled={loading}
                                className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 font-medium flex items-center gap-2 disabled:opacity-50"
                              >
                                  <Save size={18} />
                                  {loading ? 'Saving...' : 'Save Changes'}
                              </button>
                          </div>
                      </form>
                  )}

                  {activeTab === 'security' && (
                      <form onSubmit={handleUpdateProfile} className="space-y-6">
                          <div>
                              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                  <Key size={20} className="text-gray-400" />
                                  Change Password
                              </h3>
                              <div className="space-y-3">
                                  <div>
                                      <label className="text-sm font-medium text-gray-700">Current Password</label>
                                      <input 
                                        type="password" 
                                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-gray-900"
                                        placeholder="••••••••"
                                        value={formData.currentPassword}
                                        onChange={e => setFormData({...formData, currentPassword: e.target.value})}
                                      />
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div>
                                          <label className="text-sm font-medium text-gray-700">New Password</label>
                                          <input 
                                            type="password" 
                                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-gray-900"
                                            placeholder="••••••••"
                                            value={formData.newPassword}
                                            onChange={e => setFormData({...formData, newPassword: e.target.value})}
                                          />
                                      </div>
                                      <div>
                                          <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                                          <input 
                                            type="password" 
                                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-gray-900"
                                            placeholder="••••••••"
                                            value={formData.confirmPassword}
                                            onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                                          />
                                      </div>
                                  </div>
                              </div>
                          </div>

                          <div className="pt-6 border-t border-gray-100">
                               <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                  <Shield size={20} className="text-gray-400" />
                                  Two-Factor Authentication
                              </h3>
                              <div className="flex items-center justify-between">
                                  <div>
                                      <p className="font-medium text-gray-900">Enable 2FA</p>
                                      <p className="text-sm text-gray-500">Protect your account with an extra layer of security.</p>
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={() => setToggles({...toggles, twoFactor: !toggles.twoFactor})}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${toggles.twoFactor ? 'bg-emerald-600' : 'bg-gray-200'}`}
                                  >
                                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${toggles.twoFactor ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                              </div>
                          </div>

                          <div className="pt-4 border-t border-gray-100 flex justify-end">
                              <button 
                                type="submit" 
                                disabled={loading}
                                className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 font-medium flex items-center gap-2 disabled:opacity-50"
                              >
                                  <Save size={18} />
                                  Update Security
                              </button>
                          </div>
                      </form>
                  )}

                  {activeTab === 'preferences' && (
                      <div className="space-y-6">
                           <h3 className="text-lg font-bold text-gray-800 mb-4">Notification Preferences</h3>
                           <div className="space-y-4">
                               <div className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-md">
                                            <Bell size={20} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">Email Alerts</p>
                                            <p className="text-xs text-gray-500">Receive alerts when budget exceeded</p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setToggles({...toggles, emailAlerts: !toggles.emailAlerts})}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${toggles.emailAlerts ? 'bg-emerald-600' : 'bg-gray-200'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${toggles.emailAlerts ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                               </div>

                               <div className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-50 text-purple-600 rounded-md">
                                            <CreditCard size={20} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">Monthly Reports</p>
                                            <p className="text-xs text-gray-500">Receive monthly financial summary via email</p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setToggles({...toggles, monthlyReports: !toggles.monthlyReports})}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${toggles.monthlyReports ? 'bg-emerald-600' : 'bg-gray-200'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${toggles.monthlyReports ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                               </div>
                           </div>
                           <p className="text-xs text-center text-gray-400 pt-4">Preferences are auto-saved in this demo.</p>
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
}