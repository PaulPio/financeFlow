import React, { useState, useEffect } from 'react';
import { budgetService, authService } from '../services/localStorageService';
import { Budget, TransactionCategory } from '../types';
import { Plus, Trash2, RefreshCw, Loader2 } from 'lucide-react';

// Define type with spent included
interface BudgetWithSpent extends Budget {
    spent: number;
}

export default function Budgets() {
    const [budgets, setBudgets] = useState<BudgetWithSpent[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        category: TransactionCategory.Dining,
        limit: 500,
        period: 'monthly' as 'monthly' | 'weekly'
    });

    const fetchData = async () => {
        setLoading(true);
        const user = authService.getCurrentUser();
        if (user) {
            let bgs = await budgetService.getAll(user.id);

            // Seed default budgets if none exist
            if (bgs.length === 0) {
                const defaults = [
                    { category: TransactionCategory.Housing, limit: 1500, period: 'monthly' },
                    { category: TransactionCategory.Groceries, limit: 600, period: 'monthly' },
                    { category: TransactionCategory.Entertainment, limit: 300, period: 'monthly' },
                    { category: TransactionCategory.Insurance, limit: 200, period: 'monthly' },
                    { category: TransactionCategory.Dining, limit: 400, period: 'monthly' },
                    { category: TransactionCategory.Transportation, limit: 350, period: 'monthly' }
                ];

                for (const d of defaults) {
                    await budgetService.save({ ...d, userId: user.id } as any);
                }
                // Re-fetch after seeding
                bgs = await budgetService.getAll(user.id);
            }

            setBudgets(bgs);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const user = authService.getCurrentUser();
        if (user) {
            // Check if budget for category already exists
            const exists = budgets.find(b => b.category === formData.category);
            if (exists) {
                alert(`A budget for ${formData.category} already exists. Please delete it first or edit it.`);
                return;
            }

            setSaving(true);
            await budgetService.save({ ...formData, userId: user.id });
            setSaving(false);
            setIsModalOpen(false);
            fetchData();
        }
    };

    // Filter available categories for the dropdown
    const availableCategories = Object.values(TransactionCategory).filter(c =>
        c !== 'Income' && !budgets.find(b => b.category === c)
    );

    const handleDelete = async (id: string) => {
        if (confirm("Delete this budget?")) {
            await budgetService.delete(id);
            fetchData();
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Budgets</h2>
                <div className="flex gap-2">
                    <button
                        onClick={fetchData}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Refresh Data"
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => {
                            const available = Object.values(TransactionCategory).filter(c => c !== 'Income' && !budgets.find(b => b.category === c));
                            if (available.length > 0) {
                                setFormData(prev => ({ ...prev, category: available[0] }));
                            }
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <Plus size={20} />
                        Create Budget
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {budgets.map(budget => {
                    const spent = budget.spent || 0; // Use the value directly from service
                    const progress = Math.min((spent / budget.limit) * 100, 100);
                    const isOver = spent > budget.limit;

                    return (
                        <div key={budget.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative group">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{budget.category}</h3>
                                    <p className="text-xs text-gray-500 uppercase">{budget.period} limit</p>
                                </div>
                                <button
                                    onClick={() => handleDelete(budget.id)}
                                    className="text-gray-300 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <div className="mb-2 flex justify-between items-end">
                                <span className="text-2xl font-bold text-gray-900">${spent.toFixed(0)}</span>
                                <span className="text-sm text-gray-500 mb-1">of ${budget.limit}</span>
                            </div>

                            <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                                <div
                                    className={`h-3 rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : progress > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>

                            <p className={`text-xs ${isOver ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                                {isOver ? `Over budget by $${(spent - budget.limit).toFixed(0)}` : `${(100 - progress).toFixed(0)}% remaining`}
                            </p>
                        </div>
                    );
                })}

                {budgets.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        <p>No budgets set up yet.</p>
                        <button onClick={() => setIsModalOpen(true)} className="text-emerald-600 font-medium hover:underline mt-2">Create your first budget</button>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold mb-4 text-gray-900">New Budget</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900"
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value as TransactionCategory })}
                                >
                                    {Object.values(TransactionCategory).filter(c => c !== 'Income').map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Limit Amount ($)</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900"
                                    value={formData.limit}
                                    onChange={e => setFormData({ ...formData, limit: Number(e.target.value) })}
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 bg-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-70 flex items-center justify-center gap-2"
                                >
                                    {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Create Budget'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}