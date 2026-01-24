import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { transactionService, budgetService, authService } from '../services/localStorageService';
import { generateInsights } from '../services/geminiService';
import { Transaction, Budget, TransactionCategory } from '../types';
import { ArrowUpRight, ArrowDownRight, DollarSign, Wallet, Sparkles, Lightbulb } from 'lucide-react';

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
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const user = authService.getCurrentUser();
      if (user) {
        const txs = await transactionService.getAll(user.id);
        const bgs = await budgetService.getAll(user.id);
        setTransactions(txs);
        setBudgets(bgs);
        setLoading(false);

        // Generate Insights after data load
        if (txs.length > 0) {
            setLoadingInsights(true);
            generateInsights(txs, bgs)
                .then(res => setInsights(res))
                .catch(err => console.error(err))
                .finally(() => setLoadingInsights(false));
        }
      } else {
          setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex justify-center p-12">Loading dashboard...</div>;

  // Calculate totals
  const totalIncome = transactions
    .filter(t => t.category === TransactionCategory.Income)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.category !== TransactionCategory.Income)
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpenses;

  // Pie Chart Data
  const expensesByCategory = transactions
    .filter(t => t.category !== TransactionCategory.Income)
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const pieData = Object.keys(expensesByCategory).map(cat => ({
    name: cat,
    value: expensesByCategory[cat]
  }));

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Financial Overview</h2>
           <p className="text-gray-500">Welcome back! Here's your financial health.</p>
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

      {/* AI Insights Section */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-xl p-6 shadow-lg text-white relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4 relative z-10">
              <Sparkles className="text-amber-400" size={20} />
              <h3 className="font-bold text-lg">FinFlow AI Insights</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
              {loadingInsights ? (
                  <div className="col-span-3 text-center py-4 text-slate-300 italic animate-pulse">
                      Analyzing your spending patterns...
                  </div>
              ) : insights.length > 0 ? (
                  insights.map((insight, idx) => (
                      <div key={idx} className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/10 flex gap-3">
                          <Lightbulb className="text-amber-300 flex-shrink-0 mt-1" size={18} />
                          <p className="text-sm leading-relaxed">{insight}</p>
                      </div>
                  ))
              ) : (
                  <div className="col-span-3 text-center py-2 text-slate-400">
                      Add more transactions to unlock AI insights.
                  </div>
              )}
          </div>
          
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -ml-12 -mb-12"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Breakdown */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
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