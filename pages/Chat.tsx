import React, { useState, useEffect, useRef } from 'react';
import { chatWithAdvisor, searchFinancialTopic } from '../services/geminiService';
import { transactionService, budgetService, authService } from '../services/localStorageService';
import { ChatMessage, Transaction, Budget, User } from '../types';
import { Send, User as UserIcon, Bot, Loader2, Globe, ExternalLink } from 'lucide-react';

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      text: "Hello! I'm FinFlow AI. I can help you analyze your spending, give budget advice, or find the latest financial news. How can I help you today?",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [sources, setSources] = useState<any[]>([]);
  const [contextData, setContextData] = useState<{transactions: Transaction[], budgets: Budget[], userProfile?: any} | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load financial context for the AI
    const loadContext = async () => {
        const user = authService.getCurrentUser();
        if (user) {
            const txs = await transactionService.getAll(user.id);
            const bgs = await budgetService.getAll(user.id);
            // Include user profile in context
            setContextData({ 
                transactions: txs, 
                budgets: bgs,
                userProfile: user.financialProfile
            });
        }
    };
    loadContext();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setSources([]);

    try {
      let responseText = '';
      let searchSources: any[] = [];

      if (useSearch) {
          // Use search grounding for news/external info
          const result = await searchFinancialTopic(userMsg.text);
          responseText = result.text;
          searchSources = result.sources;
          setSources(searchSources);
      } else {
          // Use context-aware chat
          // Convert internal message format to history format for Gemini
          const history = messages.map(m => ({ role: m.role, text: m.text }));
          
          // Pass the contextData (transactions/budgets/profile) to the service
          responseText = await chatWithAdvisor(history, userMsg.text, contextData);
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'model',
          text: "Sorry, I encountered an error. Please try again.",
          timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                {msg.role === 'user' ? <UserIcon size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
              </div>
              <div className={`p-4 rounded-2xl shadow-sm text-sm whitespace-pre-wrap ${
                msg.role === 'user' 
                  ? 'bg-emerald-600 text-white rounded-tr-none' 
                  : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
              }`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {loading && (
           <div className="flex justify-start">
             <div className="flex gap-3 max-w-[80%]">
               <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                 <Loader2 size={16} className="text-white animate-spin" />
               </div>
               <div className="p-4 rounded-2xl bg-white border border-gray-100 rounded-tl-none shadow-sm text-sm text-gray-500 italic">
                 Thinking...
               </div>
             </div>
           </div>
        )}
      </div>
      
      {/* Grounding Sources Area */}
      {sources.length > 0 && (
          <div className="p-3 bg-blue-50 border-t border-blue-100 text-xs overflow-x-auto whitespace-nowrap flex gap-2">
              <span className="font-bold text-blue-800 flex items-center gap-1"><Globe size={12}/> Sources:</span>
              {sources.map((source, idx) => (
                  source.web?.uri ? (
                    <a key={idx} href={source.web.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline bg-white px-2 py-1 rounded border border-blue-200">
                        {source.web.title || "Source"} <ExternalLink size={10} />
                    </a>
                  ) : null
              ))}
          </div>
      )}

      <div className="p-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSend} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                    <input 
                        type="checkbox" 
                        checked={useSearch} 
                        onChange={e => setUseSearch(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500" 
                    />
                    <Globe size={14} />
                    Enable Google Search (for recent news)
                </label>
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={useSearch ? "Ask about market trends, news..." : "Ask for advice on your spending..."}
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    disabled={loading}
                />
                <button 
                    type="submit" 
                    disabled={!input.trim() || loading}
                    className="bg-emerald-600 text-white p-3 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Send size={20} />
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}