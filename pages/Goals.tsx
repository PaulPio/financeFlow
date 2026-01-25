import React, { useState, useEffect } from 'react';
import { goalService, authService, transactionService } from '../services/localStorageService';
import { generateGoalStrategy, parseGoalInput } from '../services/geminiService';
import { Goal } from '../types';
import { Target, Plus, Trash2, Calendar, TrendingUp, Sparkles, Loader2, Send, ArrowRight } from 'lucide-react';

export default function Goals() {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [planningGoalId, setPlanningGoalId] = useState<string | null>(null);
    const [goalPrompt, setGoalPrompt] = useState('');

    const fetchData = async () => {
        const user = authService.getCurrentUser();
        if (user) {
            const data = await goalService.getAll(user.id);
            setGoals(data);
        }
    };

    useEffect(() => {
        fetchData();
        syncFirstGoalWithBalance();
    }, []);

    const syncFirstGoalWithBalance = async () => {
        const user = authService.getCurrentUser();
        if (user) {
            const txs = await transactionService.getAll(user.id);
            const income = txs
                .filter(t => t.category === 'Income')
                .reduce((sum, t) => sum + t.amount, 0);
            const expenses = txs
                .filter(t => t.category !== 'Income')
                .reduce((sum, t) => sum + t.amount, 0);

            const netBalance = Math.max(0, income - expenses);

            // Heuristic: If we have a net balance and the first goal is at 0, sync it.
            // Or if the user hasn't manually edited it recently (simple check: is it 0?)
            const currentGoals = await goalService.getAll(user.id);
            if (currentGoals.length > 0) {
                const targetGoal = currentGoals[0];

                // Only auto-update if it's 0 or vastly different, to avoid overwriting manual progress?
                // User asked for "automatically depending on how balance changes". 
                // Let's safe update: if it's < netBalance (undershooting), bump it up?
                // Or just set it.
                if (targetGoal.currentAmount !== netBalance && netBalance > 0) {
                    // For this demo, let's aggressively sync the first goal to the Net Liquidity
                    // But let's only do it if the goal category implies savings (Emergency, Purchase, etc)
                    await goalService.save({ ...targetGoal, currentAmount: netBalance });
                    setGoals(prev => prev.map(g => g.id === targetGoal.id ? { ...g, currentAmount: netBalance } : g));
                }
            }
        }
    };

    // Handler for analyzing the conversational input and creating the goal immediately
    const handleCreateGoalFromPrompt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!goalPrompt.trim()) return;

        const user = authService.getCurrentUser();
        if (!user) return;

        setAnalyzing(true);
        try {
            // 1. Parse details from text
            const result = await parseGoalInput(goalPrompt);

            // 2. Create the goal object
            const newGoalData = {
                name: result.name,
                targetAmount: result.targetAmount,
                currentAmount: 0,
                deadline: result.deadline,
                category: result.category as Goal['category'],
                userId: user.id
            };

            // 3. Save to storage
            const savedGoal = await goalService.save(newGoalData);

            // 4. Generate AI Strategy immediately
            await handleGeneratePlan(savedGoal);

            closeModal();
        } catch (error) {
            console.error("Failed to analyze goal:", error);
            alert("I couldn't quite catch that. Please try describing your goal again.");
        } finally {
            setAnalyzing(false);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setGoalPrompt('');
        fetchData();
    };

    const handleGeneratePlan = async (goal: Goal) => {
        const user = authService.getCurrentUser();
        if (!user) return;

        setPlanningGoalId(goal.id);
        try {
            // Get transactions for context
            const txs = await transactionService.getAll(user.id);
            const strategy = await generateGoalStrategy(goal, txs);

            await goalService.save({ ...goal, aiAdvice: strategy });
            fetchData(); // Refresh to show new advice
        } catch (e) {
            console.error(e);
        } finally {
            setPlanningGoalId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Delete this goal?")) {
            await goalService.delete(id);
            fetchData();
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Financial Goals</h2>
                    <p className="text-gray-500 text-sm">Plan for your future with AI assistance</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                    <Plus size={20} />
                    New Goal
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {goals.map(goal => {
                    const progress = goal.targetAmount > 0
                        ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                        : 0;
                    const isPlanning = planningGoalId === goal.id;

                    return (
                        <div key={goal.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                            <div className="p-6 pb-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                            <Target size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-800">{goal.name}</h3>
                                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{goal.category}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDelete(goal.id)} className="text-gray-300 hover:text-red-500">
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <p className="text-sm text-gray-500">Current Saved</p>
                                        <p className="text-2xl font-bold text-gray-900">${goal.currentAmount.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-500">Target</p>
                                        <p className="text-lg font-semibold text-gray-700">${goal.targetAmount.toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="w-full bg-gray-100 rounded-full h-3 mb-4">
                                    <div
                                        className="h-3 rounded-full bg-emerald-500 transition-all duration-1000"
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>

                                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                                    <div className="flex items-center gap-1">
                                        <Calendar size={14} />
                                        <span>Deadline: {new Date(goal.deadline).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <TrendingUp size={14} />
                                        <span>{progress.toFixed(0)}% Done</span>
                                    </div>
                                </div>
                            </div>

                            {/* AI Plan Section */}
                            <div className="bg-indigo-50/50 p-4 border-t border-indigo-100 flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles size={16} className="text-indigo-500" />
                                    <h4 className="font-semibold text-indigo-900 text-sm">AI Strategy</h4>
                                </div>

                                {isPlanning ? (
                                    <div className="flex items-center gap-2 text-indigo-400 text-sm italic animate-pulse">
                                        <Loader2 size={14} className="animate-spin" />
                                        Designing your plan...
                                    </div>
                                ) : goal.aiAdvice ? (
                                    <div>
                                        <p className="text-sm text-indigo-800 leading-relaxed whitespace-pre-wrap mb-3">{goal.aiAdvice}</p>
                                        <button
                                            onClick={() => handleGeneratePlan(goal)}
                                            className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                                        >
                                            <TrendingUp size={12} />
                                            Refresh Strategy based on new data
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleGeneratePlan(goal)}
                                        className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                                    >
                                        Generate a plan to reach this goal
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {goals.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200 text-gray-400">
                    <Target size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No goals set yet. Start planning today!</p>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-md w-full overflow-hidden flex flex-col">

                        {/* Modal Header */}
                        <div className="p-6 bg-slate-900 text-white">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Sparkles className="text-emerald-400" />
                                AI Goal Assistant
                            </h3>
                            <p className="text-slate-400 text-sm mt-1">
                                Tell me what you want to achieve, and I'll create a plan.
                            </p>
                        </div>

                        {/* Chat Interface */}
                        <div className="p-6">
                            <form onSubmit={handleCreateGoalFromPrompt}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Describe your financial goal:
                                    </label>
                                    <textarea
                                        className="w-full h-32 border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none bg-white text-gray-900 placeholder-gray-400"
                                        placeholder="e.g., I want to save $5000 for a trip to Japan next summer, or I need to pay off my credit card debt in 12 months."
                                        value={goalPrompt}
                                        onChange={(e) => setGoalPrompt(e.target.value)}
                                        autoFocus
                                    ></textarea>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Tip: You don't need exact numbers. I'll help you estimate if you're unsure.
                                    </p>
                                </div>
                                <div className="flex gap-3 justify-end">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="px-4 py-2 text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={analyzing || !goalPrompt.trim()}
                                        className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 transition-colors"
                                    >
                                        {analyzing ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                Creating Plan...
                                            </>
                                        ) : (
                                            <>
                                                Create Goal
                                                <Sparkles size={18} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}