import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { transactionService, budgetService, authService, billService, portfolioService } from '../services/localStorageService';
import { generateInsights } from '../services/geminiService';
import { Transaction, Budget, TransactionCategory, Bill } from '../types';
import { ArrowUpRight, ArrowDownRight, DollarSign, Wallet, Sparkles, Lightbulb, TrendingUp, ArrowRight, CalendarClock, CheckCircle, Loader2, ChevronDown, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="text-2xl font-bold mt-1 text-gray-800">{value}</h3>
      </div>
      <div className={`p-3 rounded-full ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
    {trend && (
      <div className="mt-4 flex items-center text-sm">
        <span className={trend > 0 ? "text-green-500 flex items-center" : "text-red-500 flex items-center"}>
          {trend > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {Math.abs(trend)}%
        </span>
        <span className="text-gray-400 ml-2">vs last month</span>
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

        const bgs = await budgetService.getAll(user.id); // Budgets updated to support month in API
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
  }, [selectedMonth, selectedYear]);

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

  const pieData = Object.keys(expensesByCategory).map(cat => ({
    name: cat,
    value: expensesByCategory[cat]
  }));

  // Filter Upcoming Bills (Not paid, and due date is close or future)
  const upcomingBills = bills.filter(b => !b.isPaid).slice(0, 3);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Financial Overview</h2>
          <p className="text-gray-500 font-medium">Welcome back! Here's your financial health.</p>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer pl-2"
          >
            {months.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <div className="h-4 w-px bg-gray-200 mx-1"></div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer pr-2"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown size={14} className="text-gray-400 mr-2" />
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
        <div className="lg:col-span-2 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 shadow-sm border border-indigo-100 text-gray-800 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <Sparkles className="text-indigo-600" size={20} />
              <h3 className="font-bold text-lg text-indigo-900">FinFlow AI Insights</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
              {loadingInsights ? (
                <div className="col-span-2 text-center py-4 text-indigo-400 italic animate-pulse">
                  Analyzing your spending patterns...
                </div>
              ) : insights.length > 0 ? (
                insights.slice(0, 2).map((insight, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm flex gap-3">
                    <Lightbulb className="text-amber-500 flex-shrink-0 mt-1" size={18} />
                    <p className="text-sm leading-relaxed text-gray-700">{insight}</p>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-2 text-indigo-400">
                  Add more transactions to unlock AI insights.
                </div>
              )}
            </div>
          </div>
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -ml-12 -mb-12"></div>
        </div>

        {/* Investment Teaser Card */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="text-emerald-500" size={24} />
              <h3 className="font-bold text-lg text-gray-800">Invest Your Surplus</h3>
            </div>
            {surplus > 0 ? (
              <>
                <p className="text-gray-500 text-sm mb-4">
                  You have a potential surplus of <span className="font-bold text-emerald-600">${surplus.toFixed(0)}</span> this month.
                </p>
                <div className="bg-emerald-50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-emerald-800">
                    If invested at 8%, this could be <span className="font-bold">${(surplus * 1.08).toFixed(0)}</span> in a year!
                  </p>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-sm mb-4">
                Track your budget to find surplus money to invest.
              </p>
            )}
          </div>
          <Link
            to="/investments"
            className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
          >
            Start Investing
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Bills (New) */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CalendarClock size={20} className="text-purple-500" />
            Upcoming Bills
          </h3>
          <div className="space-y-3">
            {upcomingBills.length > 0 ? (
              upcomingBills.map(bill => (
                <div key={bill.id} className="flex items-center justify-between p-3 border border-gray-50 rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-800">{bill.name}</p>
                    <p className="text-xs text-gray-400">Due: {new Date(bill.dueDate).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">${bill.amount}</span>
                    <button onClick={() => handlePayBill(bill.id)} className="text-emerald-500 hover:text-emerald-600" title="Mark Paid">
                      <CheckCircle size={18} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                <p>No upcoming bills found.</p>
                <Link to="/upload" className="text-purple-600 hover:underline">Upload a statement</Link>
              </div>
            )}
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">Spending Breakdown</h3>
          <div className="h-64 w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">No expense data yet</div>
            )}
          </div>
        </div>

        {/* Budget Status */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">Budget Status</h3>
          <div className="space-y-5">
            {budgets.map(budget => {
              const spent = expensesByCategory[budget.category] || 0;
              const percentage = Math.min((spent / budget.limit) * 100, 100);
              const isOver = spent > budget.limit;

              return (
                <div key={budget.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{budget.category}</span>
                    <span className={isOver ? "text-red-500 font-bold" : "text-gray-500"}>
                      ${spent.toFixed(0)} / ${budget.limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${isOver ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
            {budgets.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No budgets set. Go to Budgets page to create one.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 text-sm">
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Merchant</th>
                <th className="pb-3 font-medium">Category</th>
                <th className="pb-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {transactions.slice(0, 5).map(t => (
                <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="py-3 text-gray-600">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="py-3 font-medium text-gray-800">{t.merchant}</td>
                  <td className="py-3">
                    <span className="px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-600">{t.category}</span>
                  </td>
                  <td className={`py-3 text-right font-medium ${t.category === 'Income' ? 'text-emerald-600' : 'text-gray-800'}`}>
                    {t.category === 'Income' ? '+' : ''}${t.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">No transactions recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}