import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { transactionService, authService, portfolioService } from '../services/localStorageService';
import { generateInvestmentAdvice } from '../services/geminiService';
import { Transaction, TransactionCategory, FinancialProfile, PortfolioAnalysis } from '../types';
import { TrendingUp, DollarSign, Sparkles, Loader2, Shield, PieChart, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Investments() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userProfile, setUserProfile] = useState<FinancialProfile | undefined>(undefined);
  const [portfolio, setPortfolio] = useState<PortfolioAnalysis | null>(null);
  
  // State for calculator
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlySpent, setMonthlySpent] = useState(0);
  const [investAmount, setInvestAmount] = useState(0);
  const [rateOfReturn, setRateOfReturn] = useState(7); // Default 7%
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const user = authService.getCurrentUser();
      if (user) {
        setUserProfile(user.financialProfile);
        const allTx = await transactionService.getAll(user.id);
        const savedPortfolio = await portfolioService.get(user.id);
        setPortfolio(savedPortfolio);
        
        // Filter for current month to estimate monthly surplus
        const now = new Date();
        const currentMonthTx = allTx.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const income = currentMonthTx
            .filter(t => t.category === TransactionCategory.Income)
            .reduce((sum, t) => sum + t.amount, 0);

        const expenses = currentMonthTx
            .filter(t => t.category !== TransactionCategory.Income)
            .reduce((sum, t) => sum + t.amount, 0);

        setTransactions(allTx);
        setMonthlyIncome(income);
        setMonthlySpent(expenses);
        
        // Set default investment amount to the surplus (or 0 if negative)
        const surplus = Math.max(0, income - expenses);
        setInvestAmount(surplus);

        // Set rate based on risk tolerance if available
        if (user.financialProfile?.riskTolerance === 'High') setRateOfReturn(10);
        if (user.financialProfile?.riskTolerance === 'Low') setRateOfReturn(4);

        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch AI advice when investAmount stabilizes (debounced slightly via effect dependency)
  useEffect(() => {
    if (investAmount > 0 && !loading) {
        setLoadingAdvice(true);
        const timer = setTimeout(() => {
            generateInvestmentAdvice(investAmount, userProfile)
                .then(setAiAdvice)
                .catch(console.error)
                .finally(() => setLoadingAdvice(false));
        }, 800);
        return () => clearTimeout(timer);
    }
  }, [investAmount, loading, userProfile]);

  const surplus = monthlyIncome - monthlySpent;
  const isSurplusPositive = surplus > 0;

  // Generate Chart Data
  const generateChartData = () => {
    const data = [];
    let currentInvested = 0;
    let currentCash = 0;
    const monthlyRate = rateOfReturn / 100 / 12;

    for (let year = 0; year <= 10; year++) {
        data.push({
            year: `Year ${year}`,
            invested: Math.round(currentInvested),
            cash: Math.round(currentCash)
        });

        // Add 12 months of contributions + growth
        for (let m = 0; m < 12; m++) {
            currentCash += investAmount;
            currentInvested = (currentInvested + investAmount) * (1 + monthlyRate);
        }
    }
    return data;
  };

  const chartData = generateChartData();

  if (loading) return <div className="flex justify-center p-12">Loading investment data...</div>;

  return (
    <div className="space-y-6 pb-20">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
               <TrendingUp className="text-emerald-500" />
               Investments
           </h2>
           <p className="text-gray-500">Track your portfolio and plan your future wealth.</p>
        </div>

        {/* --- EXISTING PORTFOLIO SECTION --- */}
        {portfolio ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                         <h3 className="text-lg font-bold text-gray-900">Current Portfolio</h3>
                         <p className="text-sm text-gray-500">Last updated via upload</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500">Total Value</p>
                        <p className="text-3xl font-bold text-slate-900">${portfolio.totalValue.toLocaleString()}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                     <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                        <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2"><PieChart size={18}/> Allocation Analysis</h4>
                        <p className="text-sm text-purple-800 leading-relaxed">{portfolio.benchmarkComparison}</p>
                     </div>
                     <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><Shield size={18}/> Risk & Strategy</h4>
                        <p className="text-sm text-blue-800 leading-relaxed">{portfolio.aiComments}</p>
                        <p className="text-xs font-bold mt-2 text-blue-700 uppercase">Risk Level: {portfolio.riskAssessment}</p>
                     </div>
                </div>

                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 font-semibold text-gray-600">Symbol</th>
                                <th className="p-3 font-semibold text-gray-600">Description</th>
                                <th className="p-3 font-semibold text-gray-600 text-right">Qty</th>
                                <th className="p-3 font-semibold text-gray-600 text-right">Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {portfolio.holdings.map((h, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="p-3 font-bold text-slate-800">{h.symbol}</td>
                                    <td className="p-3 text-gray-600">{h.description}</td>
                                    <td className="p-3 text-right text-gray-600">{h.quantity}</td>
                                    <td className="p-3 text-right font-medium text-emerald-600">${h.marketValue.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="mt-4 flex justify-end">
                    <button 
                        onClick={() => navigate('/upload', { state: { activeTab: 'portfolio' } })}
                        className="text-sm text-emerald-600 font-medium hover:underline"
                    >
                        Update Portfolio
                    </button>
                </div>
            </div>
        ) : (
            <div className="bg-slate-900 text-white rounded-xl p-8 text-center">
                 <h3 className="text-xl font-bold mb-2">Connect Your Portfolio</h3>
                 <p className="text-slate-300 mb-4 max-w-md mx-auto">
                     Upload a PDF statement from your brokerage (Robinhood, Fidelity, etc.) to get AI-powered analysis of your holdings.
                 </p>
                 <button 
                    onClick={() => navigate('/upload', { state: { activeTab: 'portfolio' } })} 
                    className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg transition-colors cursor-pointer"
                 >
                     Upload Portfolio PDF
                 </button>
            </div>
        )}


        <h3 className="text-xl font-bold text-gray-800 mt-8">Surplus Growth Projector</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Calculator Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1 space-y-6">
                <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Monthly Income</span>
                        <span className="font-medium text-emerald-600">+${monthlyIncome.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Monthly Expenses</span>
                        <span className="font-medium text-red-500">-${monthlySpent.toFixed(0)}</span>
                    </div>
                    <div className="pt-4 border-t border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-gray-700">Net Surplus</span>
                            <span className={`text-xl font-bold ${isSurplusPositive ? 'text-emerald-600' : 'text-gray-400'}`}>
                                ${surplus.toFixed(0)}
                            </span>
                        </div>
                        {!isSurplusPositive && (
                            <p className="text-xs text-red-500 bg-red-50 p-2 rounded">
                                You are currently spending more than you earn. Focus on budgeting first!
                            </p>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Monthly Investment</label>
                    <div className="flex items-center gap-2">
                        <DollarSign size={16} className="text-gray-400" />
                        <input 
                            type="number" 
                            value={investAmount}
                            onChange={(e) => setInvestAmount(Number(e.target.value))}
                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-gray-900"
                        />
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max={Math.max(surplus * 1.5, 1000)} // Allow going a bit over surplus for testing
                        value={investAmount}
                        onChange={(e) => setInvestAmount(Number(e.target.value))}
                        className="w-full accent-emerald-500"
                    />
                </div>

                <div className="space-y-2">
                     <div className="flex justify-between">
                        <label className="text-sm font-medium text-gray-700">Est. Annual Return</label>
                        <span className="text-sm font-bold text-emerald-600">{rateOfReturn}%</span>
                     </div>
                     <div className="flex gap-2 text-xs">
                         <button onClick={() => setRateOfReturn(4)} className={`px-2 py-1 rounded border ${rateOfReturn === 4 ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50'}`}>Conservative</button>
                         <button onClick={() => setRateOfReturn(7)} className={`px-2 py-1 rounded border ${rateOfReturn === 7 ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50'}`}>Moderate</button>
                         <button onClick={() => setRateOfReturn(10)} className={`px-2 py-1 rounded border ${rateOfReturn === 10 ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50'}`}>Aggressive</button>
                     </div>
                </div>

                <div className="bg-emerald-900 text-white p-4 rounded-xl text-center">
                    <p className="text-sm opacity-80 mb-1">Projected Value in 10 Years</p>
                    <p className="text-3xl font-bold">${chartData[chartData.length-1].invested.toLocaleString()}</p>
                    <p className="text-xs text-emerald-300 mt-2">vs ${chartData[chartData.length-1].cash.toLocaleString()} in cash</p>
                </div>
            </div>

            {/* Chart Area */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2 flex flex-col">
                <h3 className="text-lg font-bold text-gray-800 mb-6">Growth Projection</h3>
                <div className="flex-1 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="year" />
                            <YAxis tickFormatter={(val) => `$${val/1000}k`} />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <RechartsTooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '']} />
                            <Area 
                                type="monotone" 
                                dataKey="invested" 
                                stroke="#10b981" 
                                fillOpacity={1} 
                                fill="url(#colorInvested)" 
                                name="Investment Portfolio"
                            />
                            <Area 
                                type="monotone" 
                                dataKey="cash" 
                                stroke="#94a3b8" 
                                fillOpacity={1} 
                                fill="url(#colorCash)" 
                                name="Cash Savings"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* AI Advice Section */}
                <div className="mt-8 bg-indigo-50 border border-indigo-100 rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Sparkles size={100} className="text-indigo-600" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                             <Sparkles size={18} className="text-indigo-600" />
                             <h4 className="font-bold text-indigo-900">AI Strategy Tip</h4>
                        </div>
                        {loadingAdvice ? (
                            <div className="flex items-center gap-2 text-indigo-500 text-sm italic">
                                <Loader2 size={16} className="animate-spin" />
                                Analyzing your surplus...
                            </div>
                        ) : (
                            <p className="text-indigo-800 text-sm leading-relaxed">
                                {aiAdvice || "Enter an investment amount to get personalized advice."}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}