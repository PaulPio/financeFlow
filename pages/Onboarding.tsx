import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/localStorageService';
import { FinancialProfile } from '../types';
import { ArrowRight, Check, DollarSign, Briefcase, Target, ShieldAlert, Sparkles } from 'lucide-react';

const steps = [
    { id: 1, title: 'Welcome' },
    { id: 2, title: 'Income' },
    { id: 3, title: 'Occupation' },
    { id: 4, title: 'Focus' },
    { id: 5, title: 'Risk' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [profile, setProfile] = useState<FinancialProfile>({
    monthlyIncome: 0,
    currency: 'USD',
    savingsGoal: '',
    riskTolerance: 'Medium',
    financialFocus: 'Budgeting',
    occupation: ''
  });

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(curr => curr + 1);
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = () => {
    // Save profile and mark as complete
    authService.updateUser({
      financialProfile: profile,
      hasCompletedOnboarding: true
    });
    navigate('/');
  };

  const updateProfile = (key: keyof FinancialProfile, value: any) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  // Render content based on step
  const renderContent = () => {
    switch(currentStep) {
      case 1:
        return (
          <div className="text-center space-y-6 animate-fadeIn">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Welcome to FinFlow</h2>
            <p className="text-lg text-gray-600 max-w-md mx-auto">
              To give you the best AI-powered financial advice, I need to learn a little bit about you. This will take less than a minute.
            </p>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6 animate-fadeIn">
             <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="text-emerald-500" /> 
                Income & Currency
             </h2>
             <p className="text-gray-600">What is your approximate monthly take-home income?</p>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Amount</label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input 
                        type="number" 
                        className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-lg bg-white text-gray-900 placeholder-gray-400"
                        placeholder="4000"
                        value={profile.monthlyIncome || ''}
                        onChange={(e) => updateProfile('monthlyIncome', Number(e.target.value))}
                        autoFocus
                    />
                </div>
             </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6 animate-fadeIn">
             <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Briefcase className="text-emerald-500" />
                Occupation
             </h2>
             <p className="text-gray-600">What do you do for a living?</p>
             <div>
                <input 
                    type="text" 
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-lg bg-white text-gray-900 placeholder-gray-400"
                    placeholder="e.g. Software Engineer, Teacher, Student"
                    value={profile.occupation}
                    onChange={(e) => updateProfile('occupation', e.target.value)}
                    autoFocus
                />
             </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6 animate-fadeIn">
             <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Target className="text-emerald-500" />
                Goals & Focus
             </h2>
             
             <div>
                <p className="text-gray-600 mb-3">What is your primary financial focus right now?</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {['Budgeting', 'Debt Repayment', 'Savings', 'Investing'].map(opt => (
                        <button
                            key={opt}
                            onClick={() => updateProfile('financialFocus', opt)}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${profile.financialFocus === opt ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50'}`}
                        >
                            <span className="font-medium">{opt}</span>
                        </button>
                    ))}
                </div>
             </div>

             <div>
                <p className="text-gray-600 mb-2">Do you have a specific savings goal?</p>
                <input 
                    type="text" 
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-gray-900 placeholder-gray-400"
                    placeholder="e.g. Buy a house in 5 years"
                    value={profile.savingsGoal}
                    onChange={(e) => updateProfile('savingsGoal', e.target.value)}
                />
             </div>
          </div>
        );
      case 5:
        return (
           <div className="space-y-6 animate-fadeIn">
             <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ShieldAlert className="text-emerald-500" />
                Risk Tolerance
             </h2>
             <p className="text-gray-600">When it comes to your finances, how would you describe your risk tolerance?</p>
             
             <div className="space-y-3">
                {[
                    { val: 'Low', label: 'Conservative', desc: 'I prefer safety and stability over high returns.' },
                    { val: 'Medium', label: 'Moderate', desc: 'I want a balance of growth and safety.' },
                    { val: 'High', label: 'Aggressive', desc: 'I am willing to take risks for higher potential returns.' }
                ].map((opt) => (
                    <button
                        key={opt.val}
                        onClick={() => updateProfile('riskTolerance', opt.val)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${profile.riskTolerance === opt.val ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}
                    >
                        <div>
                            <p className={`font-bold ${profile.riskTolerance === opt.val ? 'text-emerald-900' : 'text-gray-900'}`}>{opt.label}</p>
                            <p className="text-sm text-gray-500">{opt.desc}</p>
                        </div>
                        {profile.riskTolerance === opt.val && <Check className="text-emerald-600" />}
                    </button>
                ))}
             </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        {/* Progress Bar */}
        <div className="w-full max-w-lg mb-8">
             <div className="flex justify-between mb-2 px-1">
                 {steps.map(s => (
                     <div key={s.id} className={`w-full h-1.5 rounded-full mx-1 transition-colors ${s.id <= currentStep ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                 ))}
             </div>
        </div>

        <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-8 min-h-[400px] flex flex-col">
            <div className="flex-1">
                {renderContent()}
            </div>

            <div className="pt-8 mt-4 border-t border-gray-100 flex justify-between items-center">
                {currentStep > 1 ? (
                    <button 
                        onClick={() => setCurrentStep(c => c - 1)}
                        className="text-gray-500 hover:text-gray-800 font-medium px-4 py-2"
                    >
                        Back
                    </button>
                ) : (
                    <div></div> // Spacer
                )}
                
                <button 
                    onClick={handleNext}
                    className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
                >
                    {currentStep === steps.length ? 'Finish Setup' : 'Continue'}
                    <ArrowRight size={18} />
                </button>
            </div>
        </div>
    </div>
  );
}