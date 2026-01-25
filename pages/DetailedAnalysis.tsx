import React, { useState, useEffect } from 'react';
import { generateContent } from '../services/geminiService';
import { transactionService, authService } from '../services/localStorageService';
import { Transaction } from '../types';
import { Brain, TrendingUp, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DetailedAnalysis() {
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    useEffect(() => {
        const loadData = async () => {
            const user = authService.getCurrentUser();
            if (user) {
                const txs = await transactionService.getAll(user.id);
                setTransactions(txs);

                // Only analyze if we have data
                if (txs.length > 0) {
                    try {
                        const prompt = `
                        Analyze these financial transactions in extreme detail:
                        ${JSON.stringify(txs.slice(0, 50))} 
                        
                        Provide a "Deep Scan" report with:
                        1. Spending anomalies (unusual amounts or frequencies).
                        2. Detailed categorization breakdown.
                        3. Forecast for next month based on patterns.
                        4. Specific opportunities for savings (e.g. "You spent $X on coffee, reducing this by 20% saves $Y").
                        
                        Format as HTML with Tailwind classes for a beautiful presentation. 
                        Use sections like <div class="bg-white p-6 rounded-xl shadow-sm mb-6">...</div>
                    `;
                        const result = await generateContent(prompt);
                        const cleanResult = result.replace(/```html/g, '').replace(/```/g, '');
                        setAnalysis(cleanResult);
                    } catch (e) {
                        console.error("Analysis failed", e);
                        setAnalysis("<p>Unable to generate analysis at this time.</p>");
                    }
                } else {
                    setAnalysis("<p>No transactions found to analyze.</p>");
                }
            }
            setLoading(false);
        };
        loadData();
    }, []);

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="mb-8">
                <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-emerald-600 mb-4 transition-colors">
                    <ArrowLeft size={20} />
                    Back to Dashboard
                </Link>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <Brain className="text-purple-600" size={32} />
                    Deep Scan Analysis
                </h1>
                <p className="text-gray-500 mt-2">Powered by Gemini AI, this report dives deep into your spending patterns to uncover hidden insights.</p>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                    <p className="text-gray-500 animate-pulse">Crunching the numbers with AI...</p>
                </div>
            ) : (
                <div className="prose prose-purple max-w-none">
                    {/* Safe render of HTML content from Gemini */}
                    <div dangerouslySetInnerHTML={{ __html: analysis || '' }} />

                    {!analysis && !loading && (
                        <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-200 flex items-start gap-3">
                            <AlertCircle className="text-yellow-600 shrink-0 mt-1" />
                            <div>
                                <h3 className="font-bold text-yellow-800">Analysis Unavailable</h3>
                                <p className="text-yellow-700">We couldn't generate the insights right now. Please populate your transactions and try again.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
