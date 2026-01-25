import React, { useState, useEffect } from 'react';
import { transactionService, authService } from '../services/localStorageService';
import { authClient } from '../lib/auth-client';
import { Transaction, TransactionCategory } from '../types';
import { Trash2, Search, Filter, Calendar as CalendarIcon } from 'lucide-react';

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filtered, setFiltered] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Income' | 'Expense'>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const { data: session } = authClient.useSession();

  const fetchTransactions = async () => {
    const user = authService.getCurrentUser();
    if (user) {
      const data = await transactionService.getAll(user.id);
      setTransactions(data);
      setFiltered(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, [session?.user?.id]);

  useEffect(() => {
    let result = transactions;

    if (search) {
      result = result.filter(t =>
        t.merchant.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (categoryFilter !== 'All') {
      result = result.filter(t => t.category === categoryFilter);
    }

    if (typeFilter !== 'All') {
      if (typeFilter === 'Income') {
        result = result.filter(t => t.category === 'Income');
      } else {
        result = result.filter(t => t.category !== 'Income');
      }
    }

    if (startDate) {
      result = result.filter(t => new Date(t.date) >= new Date(startDate));
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter(t => new Date(t.date) <= end);
    }

    setFiltered(result);
  }, [search, categoryFilter, typeFilter, transactions, startDate, endDate]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      await transactionService.delete(id);
      fetchTransactions();
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Transactions</h2>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900 placeholder-gray-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-gray-300 rounded-lg">
            <CalendarIcon size={16} className="text-gray-400" />
            <input
              type="date"
              className="bg-transparent border-none text-sm focus:ring-0 text-gray-700"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              className="bg-transparent border-none text-sm focus:ring-0 text-gray-700"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="relative flex-1 sm:flex-none">
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg appearance-none w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="All">All Types</option>
              <option value="Income">Income Only</option>
              <option value="Expense">Expenses Only</option>
            </select>
          </div>
          <div className="relative flex-1 sm:flex-none">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg appearance-none w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              {Object.values(TransactionCategory).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Merchant</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No transactions found.</td></tr>
              ) : (
                filtered.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(t.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{t.merchant}</div>
                      <div className="text-xs text-gray-500">{t.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        {t.category}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${t.category === 'Income' ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {t.category === 'Income' ? '+' : ''}${t.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-red-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}