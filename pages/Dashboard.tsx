import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { transactionService, budgetService, authService, billService, portfolioService } from '../services/localStorageService';
import { authClient } from '../lib/auth-client';
import { generateInsights } from '../services/geminiService';
import { Transaction, Budget, TransactionCategory, Bill } from '../types';
import { ArrowUpRight, ArrowDownRight, DollarSign, Wallet, Sparkles, Lightbulb, TrendingUp, ArrowRight, CalendarClock, CheckCircle, Loader2, ChevronDown, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-gray-100/50 hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 group">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
        <h3 className="text-3xl font-bold mt-2 text-gray-800 brand-font">{value}</h3>
      </div>
      <div className={`p-4 rounded-2xl shadow-lg border border-white/20 ${color} group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
    {trend !== undefined && (
      <div className="mt-6 flex items-center text-sm font-bold">
        <div className={`flex items-center px-2 py-0.5 rounded-lg ${trend > 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
          {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          <span className="ml-0.5">{Math.abs(trend)}%</span>
        </div>
        <span className="text-gray-400 ml-2 font-medium">vs last month</span>
      </div>
    )}
  </div>
);

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const { data: session } = authClient.useSession();

  // Month Selection State
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const user = authService.getCurrentUser();
      if (user) {
        // Fetch specific month's transactions
        const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
        const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString();

        // Update transactionService.getAll to support params? 
        // For now, reuse it and filter client-side, OR I should have added a filter to the service.
        // Let's add the filter to the service call in the next step, but here I'll fetch ALL and filter for simplicity or update the service.
        const allTx = await transactionService.getAll(user.id);
        const filteredTx = allTx.filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === (selectedMonth - 1) && d.getFullYear() === selectedYear;
        });

        const bgs = await budgetService.getAll(user.id, selectedMonth, selectedYear);
        const bls = await billService.getAll(user.id);

        setTransactions(filteredTx);
        setBudgets(bgs);
        setBills(bls);
        setLoading(false);

        // Generate Insights after data load
        if (filteredTx.length > 0) {
          setLoadingInsights(true);
          generateInsights(filteredTx, bgs)
            .then(res => setInsights(res))
            .catch(err => console.error(err))
            .finally(() => setLoadingInsights(false));
        }
      } else {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedMonth, selectedYear, session?.user?.id]);

  const handlePayBill = async (id: string) => {
    await billService.markAsPaid(id);
    const user = authService.getCurrentUser();
    if (user) {
      const updatedBills = await billService.getAll(user.id);
      setBills(updatedBills);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <Loader2 className="animate-spin text-emerald-500" size={32} />
      <p className="text-gray-500 font-medium text-sm">Synchronizing with database...</p>
    </div>
  );

  // Calculate totals
  const totalIncome = transactions
    .filter(t => t.category === TransactionCategory.Income)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.category !== TransactionCategory.Income)
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpenses;
  const surplus = totalIncome - totalExpenses;

  // Pie Chart Data
  const expensesByCategory = transactions
    .filter(t => t.category !== TransactionCategory.Income)
    .reduce((acc, t) => {
      const cat = t.category as string;
      acc[cat] = (acc[cat] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  // Simplify Pie Chart Data: Top 3 + Other
  const sortedCategories = Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => (b as number) - (a as number));

  const top3 = sortedCategories.slice(0, 3);
  const others = sortedCategories.slice(3);

  const pieData = top3.map(([name, value]) => ({ name, value }));
  if (others.length > 0) {
    const othersValue = others.reduce((sum: number, [, value]) => sum + (value as number), 0);
    pieData.push({ name: 'Other', value: othersValue });
  }

  // Filter Upcoming Bills (Not paid, and due date is close or future)
  const upcomingBills = bills.filter(b => !b.isPaid).slice(0, 3);

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight brand-font">Financial Overview</h2>
          <p className="text-gray-500 font-medium mt-1">Personalized wealth insights for <span className="text-slate-900 font-bold">{session?.user?.name || 'you'}</span></p>
        </div>

        <div className="flex items-center gap-1 bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl border border-gray-200/50 shadow-sm">
          <div className="flex items-center px-3 py-2 bg-white rounded-xl shadow-sm border border-gray-100">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer p-0 pr-6"
            >
              {months.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center px-3 py-2 bg-white rounded-xl shadow-sm border border-gray-100">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer p-0 pr-6"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Balance"
          value={`$${balance.toLocaleString()}`}
          icon={Wallet}
          color="bg-blue-500"
        />
        <StatCard
          title="Income"
          value={`$${totalIncome.toLocaleString()}`}
          icon={ArrowUpRight}
          color="bg-emerald-500"
          trend={12}
        />
        <StatCard
          title="Expenses"
          value={`$${totalExpenses.toLocaleString()}`}
          icon={ArrowDownRight}
          color="bg-rose-500"
          trend={-5}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Insights Section */}
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-3xl p-1 shadow-2xl shadow-indigo-200 relative overflow-hidden group">
          <div className="bg-white/95 backdrop-blur-xl h-full rounded-[1.4rem] p-8 flex flex-col justify-between relative z-10">
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <Sparkles className="text-indigo-600" size={24} />
                  </div>
                  <h3 className="font-bold text-2xl text-indigo-950 brand-font">Intelligent Insights</h3>
                </div>
                <div className="hidden md:flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-full">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Live Analysis</span>
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse ml-1"></div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {loadingInsights ? (
                  <div className="col-span-2 flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                    <p className="text-indigo-400 text-sm font-bold uppercase tracking-wider">Scanning Patterns...</p>
                  </div>
                ) : insights.length > 0 ? (
                  insights.slice(0, 2).map((insight, idx) => (
                    <div key={idx} className="bg-gradient-to-br from-slate-50 to-white p-5 rounded-2xl border border-slate-100 shadow-sm flex gap-4 hover:border-indigo-200/50 transition-colors group/card">
                      <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 group-hover/card:scale-110 transition-transform">
                        <Lightbulb className="text-amber-500 flex-shrink-0" size={20} />
                      </div>
                      <p className="text-sm leading-relaxed text-slate-700 font-medium">{insight}</p>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-slate-400 text-sm font-medium italic">Feed the AI with more transactions to unlock insights.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400 font-medium italic">AI advice is for informational purposes only.</p>
              <button className="text-indigo-600 text-sm font-bold flex items-center gap-2 hover:gap-3 transition-all">
                View Deep Scan <ArrowRight size={16} />
              </button>
            </div>
          </div>
          {/* Enhanced Decorative Elements */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-[100px] -mr-40 -mt-40 group-hover:scale-110 transition-transform duration-700"></div>
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-400/10 rounded-full blur-[100px] -ml-20 -mb-20"></div>
        </div>

        {/* Investment Teaser Card */}
        <div className="lg:col-span-1 bg-white/80 backdrop-blur-md rounded-3xl shadow-sm border border-gray-100/50 p-8 flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-50 rounded-xl group-hover:rotate-12 transition-transform">
                <TrendingUp className="text-emerald-500" size={24} />
              </div>
              <h3 className="font-bold text-xl text-gray-800 brand-font">Investment Alpha</h3>
            </div>
            {surplus > 0 ? (
              <div className="space-y-4">
                <p className="text-slate-500 text-sm leading-relaxed">
                  You discovered a <span className="font-bold text-emerald-600">${surplus.toFixed(0)}</span> surplus. Ready to multiply it?
                </p>
                <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-4 border border-emerald-100/50 shadow-inner">
                  <p className="text-xs text-emerald-800 font-medium">
                    Compounded at 8%, this could grow to <span className="text-lg font-bold block mt-1">${(surplus * 1.08).toFixed(0)}</span> in just 12 months.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm leading-relaxed">
                Unlock specialized investment strategies by optimizing your current budget.
              </p>
            )}
          </div>
          <Link
            to="/investments"
            className="mt-8 w-full bg-slate-900 text-white py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 shadow-lg shadow-slate-200 hover:shadow-emerald-200 transition-all active:scale-95"
          >
            Optimized Portfolio
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Bills */}
        <div className="lg:col-span-1 bg-white/70 backdrop-blur-md rounded-3xl shadow-sm border border-gray-100/50 p-8 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-800 brand-font flex items-center gap-2">
              <CalendarClock size={22} className="text-purple-500" />
              Payables
            </h3>
            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-full uppercase tracking-widest">Upcoming</span>
          </div>
          <div className="space-y-4">
            {upcomingBills.length > 0 ? (
              upcomingBills.map(bill => (
                <div key={bill.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-50 hover:border-purple-100 transition-all group/bill shadow-sm hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                      <Receipt size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{bill.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">Due {new Date(bill.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900">${bill.amount}</span>
                    <button
                      onClick={() => handlePayBill(bill.id)}
                      className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all transform hover:scale-110 active:scale-95"
                      title="Mark Paid"
                    >
                      <CheckCircle size={18} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-sm font-medium italic">No pending bills discovered.</p>
                <Link to="/upload" className="text-purple-600 font-bold text-xs hover:underline mt-2 inline-block">Upload Invoice</Link>
              </div>
            )}
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="lg:col-span-1 bg-white/70 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-gray-100/50 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-800 brand-font">Spend Mix</h3>
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="h-64 w-full relative">
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={8}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="focus:outline-none" />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                      formatter={(value: number) => `$${value.toFixed(2)}`}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-4 text-center pointer-events-none">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Total</p>
                  <p className="text-lg font-extrabold text-gray-800 brand-font mt-1">${totalExpenses.toLocaleString()}</p>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Receipt size={32} className="opacity-20" />
                <p className="text-xs font-medium italic">No allocation data yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Budget Progress */}
        <div className="lg:col-span-1 bg-white/70 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-gray-100/50 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-800 brand-font">Watchlist</h3>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="space-y-6">
            {budgets.map(budget => {
              const spent = expensesByCategory[budget.category] || 0;
              const percentage = Math.min((spent / budget.limit) * 100, 100);
              const isOver = spent > budget.limit;

              return (
                <div key={budget.id} className="group/item">
                  <div className="flex justify-between text-xs font-bold mb-2 uppercase tracking-tight">
                    <span className="text-gray-500 font-bold">{budget.category}</span>
                    <span className={isOver ? "text-red-600" : "text-slate-900"}>
                      ${spent.toLocaleString()} / <span className="text-gray-400">${budget.limit.toLocaleString()}</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-gray-50 shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out relative ${isOver ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'}`}
                      style={{ width: `${percentage}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                </div>
              )
            })}
            {budgets.length === 0 && (
              <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-sm font-medium italic">No tracking targets set.</p>
                <Link to="/budgets" className="text-emerald-600 font-bold text-xs hover:underline mt-2 inline-block">Setup Budgets</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-gray-100/50 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-gray-800 brand-font">Recent Flow</h3>
          <Link to="/transactions" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-xl transition-colors">
            View All Stream
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-400 text-[10px] font-bold uppercase tracking-widest border-b border-gray-100">
                <th className="pb-4 font-bold">Date</th>
                <th className="pb-4 font-bold">Entity</th>
                <th className="pb-4 font-bold">Category</th>
                <th className="pb-4 font-bold text-right">Value</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {transactions.slice(0, 5).map(t => (
                <tr key={t.id} className="border-b border-gray-50 last:border-0 group/row hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 text-gray-500 font-medium">{new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                  <td className="py-4 font-bold text-gray-800 tracking-tight">{t.merchant}</td>
                  <td className="py-4">
                    <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 group-hover/row:bg-white group-hover/row:shadow-sm transition-all uppercase tracking-wider">{t.category}</span>
                  </td>
                  <td className={`py-4 text-right font-bold tabular-nums ${t.category === 'Income' ? 'text-emerald-500' : 'text-gray-800'}`}>
                    <div className="inline-flex items-center gap-1">
                      {t.category === 'Income' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} className="opacity-30" />}
                      <span>${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 border-dashed">
                      <Wallet size={24} className="text-slate-300" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium italic">Your transaction history is currently empty.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}