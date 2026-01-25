import { User, Transaction, Budget, TransactionCategory, Goal, Bill, AppNotification, PortfolioAnalysis } from '../types';

const API_URL = '/api';

// --- Configuration ---
const STORAGE_KEYS = {
    USERS: 'finflow_users',
    TRANSACTIONS: 'finflow_transactions',
    BUDGETS: 'finflow_budgets',
    GOALS: 'finflow_goals',
    BILLS: 'finflow_bills',
    NOTIFICATIONS: 'finflow_notifications',
    TOKEN: 'auth_token',
    CURRENT_USER: 'finflow_user',
    PORTFOLIO: 'finflow_portfolio'
};

const getHeaders = () => {
    // Better Auth uses cookies/session, so we don't need manual Bearer tokens anymore.
    // However, we might still need Content-Type for JSON.
    return {
        'Content-Type': 'application/json',
    };
};

// Helper to seed data if empty, so the demo looks good immediately
const seedDemoData = (userId: string) => {
    const existingTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    const hasTx = existingTx && JSON.parse(existingTx).length > 0;

    if (!hasTx) {
        const today = new Date().toISOString();
        const demoTransactions = [
            { id: '1', userId, date: today, merchant: 'Whole Foods', amount: 120.50, category: 'Groceries', description: 'Weekly grocery run' },
            { id: '2', userId, date: today, merchant: 'Uber', amount: 25.00, category: 'Transportation', description: 'Ride to work' },
            { id: '3', userId, date: today, merchant: 'Netflix', amount: 15.99, category: 'Entertainment', description: 'Monthly sub' },
            { id: '4', userId, date: today, merchant: 'Local Cafe', amount: 12.00, category: 'Dining', description: 'Coffee and bagel' },
            { id: '5', userId, date: today, merchant: 'Salary', amount: 3000.00, category: 'Income', description: 'Monthly paycheck' },
        ];
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(demoTransactions));

        const demoBudgets = [
            { id: '1', userId, category: 'Groceries', limit: 500, period: 'monthly' },
            { id: '2', userId, category: 'Dining', limit: 200, period: 'monthly' },
            { id: '3', userId, category: 'Entertainment', limit: 100, period: 'monthly' },
            { id: '4', userId, category: 'Utilities', limit: 150, period: 'monthly' },
            { id: '5', userId, category: 'Housing', limit: 1200, period: 'monthly' },
            { id: '6', userId, category: 'Insurance', limit: 300, period: 'monthly' },
            { id: '7', userId, category: 'Loans', limit: 400, period: 'monthly' },
        ];
        localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(demoBudgets));

        const demoGoals = [
            { id: '1', userId, name: 'Emergency Fund', targetAmount: 10000, currentAmount: 2500, deadline: '2025-12-31', category: 'Emergency Fund', aiAdvice: 'Great start! To reach your goal by Dec 2025, try to save $400/month.' },
            { id: '2', userId, name: 'Europe Trip', targetAmount: 5000, currentAmount: 1200, deadline: '2024-08-01', category: 'Purchase' }
        ];
        localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(demoGoals));
    }
}

export const authService = {
    login: async (email: string): Promise<User> => {
        const name = email.split('@')[0];

        try {
            // 1. Check if user exists in persistent storage
            const usersRaw = localStorage.getItem(STORAGE_KEYS.USERS);
            const users: User[] = usersRaw ? JSON.parse(usersRaw) : [];

            const existingUser = users.find(u => u.email === email);

            if (existingUser) {
                console.log("[Auth] Found existing user:", existingUser.email);
                localStorage.setItem(STORAGE_KEYS.TOKEN, 'better-auth-session');
                localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(existingUser));
                return existingUser;
            }

            // 2. Create new user if not found
            console.log("[Auth] Creating new user for:", email);
            const newUser: User = {
                id: Date.now().toString(),
                email,
                name,
                hasCompletedOnboarding: false
            };

            // Save to persistent storage
            users.push(newUser);
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

            // Set as current session
            localStorage.setItem(STORAGE_KEYS.TOKEN, 'better-auth-session');
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));

            // Seed data for new user
            seedDemoData(newUser.id);

            return newUser;
        } catch (e) {
            console.warn("Auth sync failed", e);
            return { id: '0', email, name: 'Demo' };
        }
    },

    logout: () => {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    },

    getCurrentUser: (): User | null => {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
            if (!raw || raw === 'undefined') return null;
            return JSON.parse(raw);
        } catch (e) {
            console.error("Failed to parse user", e);
            return null;
        }
    },

    updateUser: (updates: Partial<User>): User | null => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) return null;

        const updatedUser = { ...currentUser, ...updates };

        // Update current session
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));

        // Update persistent storage
        try {
            const usersRaw = localStorage.getItem(STORAGE_KEYS.USERS);
            const users: User[] = usersRaw ? JSON.parse(usersRaw) : [];
            const index = users.findIndex(u => u.id === currentUser.id);

            if (index !== -1) {
                users[index] = updatedUser;
                localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
            }
        } catch (e) {
            console.error("Failed to persist user update", e);
        }

        return updatedUser;
    }
};

const safeParse = (key: string, fallback: string = '[]') => {
    try {
        const val = localStorage.getItem(key);
        if (!val || val === 'undefined') return JSON.parse(fallback);
        return JSON.parse(val);
    } catch (e) {
        console.error(`Failed to parse ${key}`, e);
        return JSON.parse(fallback);
    }
};

export const transactionService = {
    getAll: async (userId: string): Promise<Transaction[]> => {
        try {
            const res = await fetch(`${API_URL}/transactions`, { headers: getHeaders(), credentials: 'include' });
            if (!res.ok) throw new Error('Fetch failed');
            return await res.json();
        } catch (e) {
            const all = safeParse(STORAGE_KEYS.TRANSACTIONS);
            return all.filter((t: Transaction) => t.userId === userId).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
    },

    add: async (transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
        console.log("[TransactionService] Attempting to save transaction to DB...", transaction);
        try {
            const res = await fetch(`${API_URL}/transactions`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(transaction),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Fetch failed');
            const data = await res.json();
            console.log("[TransactionService] Success! Transaction saved to DB:", data);
            return data;
        } catch (e) {
            console.error("[TransactionService] DB SAVE FAILED. Error details:", e);
            console.warn("[TransactionService] Falling back to Local Storage due to error.");
            const all = safeParse(STORAGE_KEYS.TRANSACTIONS);
            const newTx = { ...transaction, id: Date.now().toString() };
            all.push(newTx);
            localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(all));
            return newTx;
        }
    },

    addBatch: async (transactions: Omit<Transaction, 'id'>[]): Promise<void> => {
        try {
            const res = await fetch(`${API_URL}/transactions/batch`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(transactions),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Fetch failed');
        } catch (e) {
            const all = safeParse(STORAGE_KEYS.TRANSACTIONS);
            const newTxs = transactions.map((t, i) => ({ ...t, id: (Date.now() + i).toString() }));
            all.push(...newTxs);
            localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(all));
        }
    },

    delete: async (id: string): Promise<void> => {
        try {
            const res = await fetch(`${API_URL}/transactions/${id}`, {
                method: 'DELETE',
                headers: getHeaders(),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Fetch failed');
        } catch (e) {
            let all = safeParse(STORAGE_KEYS.TRANSACTIONS);
            all = all.filter((t: Transaction) => t.id !== id);
            localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(all));
        }
    }
};

export const budgetService = {
    getAll: async (userId: string, month?: number, year?: number): Promise<(Budget & { spent: number })[]> => {
        try {
            const params = new URLSearchParams();
            if (month) params.append('month', month.toString());
            if (year) params.append('year', year.toString());
            const url = `${API_URL}/budgets${params.toString() ? '?' + params.toString() : ''}`;

            const res = await fetch(url, { headers: getHeaders(), credentials: 'include' });
            if (!res.ok) throw new Error('Fetch failed');
            return await res.json();
        } catch (e) {
            const budgets = safeParse(STORAGE_KEYS.BUDGETS).filter((b: Budget) => b.userId === userId);
            const transactions = safeParse(STORAGE_KEYS.TRANSACTIONS).filter((t: Transaction) => t.userId === userId);
            return budgets.map((b: Budget) => {
                const spent = transactions
                    .filter((t: Transaction) => t.category === b.category && t.category !== 'Income')
                    .reduce((sum: number, t: Transaction) => sum + (Number(t.amount) || 0), 0);
                return { ...b, spent };
            });
        }
    },

    save: async (budget: Omit<Budget, 'id'> | Budget): Promise<Budget> => {
        try {
            const res = await fetch(`${API_URL}/budgets`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(budget),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Fetch failed');
            return await res.json();
        } catch (e) {
            const all = safeParse(STORAGE_KEYS.BUDGETS);
            const newBudget = { ...budget, id: 'id' in budget ? budget.id : Date.now().toString() };
            const index = all.findIndex((b: any) => b.id === newBudget.id);
            if (index !== -1) all[index] = newBudget; else all.push(newBudget);
            localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(all));
            return newBudget as Budget;
        }
    },

    delete: async (id: string): Promise<void> => {
        try {
            const res = await fetch(`${API_URL}/budgets/${id}`, {
                method: 'DELETE',
                headers: getHeaders(),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Fetch failed');
        } catch (e) {
            let all = safeParse(STORAGE_KEYS.BUDGETS);
            all = all.filter((b: Budget) => b.id !== id);
            localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(all));
        }
    }
};

export const goalService = {
    getAll: async (userId: string): Promise<Goal[]> => {
        try {
            const res = await fetch(`${API_URL}/goals`, { headers: getHeaders(), credentials: 'include' });
            if (!res.ok) throw new Error('Fetch failed');
            return await res.json();
        } catch (e) {
            const all = safeParse(STORAGE_KEYS.GOALS);
            return all.filter((g: Goal) => g.userId === userId);
        }
    },
    save: async (goal: Omit<Goal, 'id'> | Goal): Promise<Goal> => {
        try {
            const res = await fetch(`${API_URL}/goals`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(goal),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Fetch failed');
            return await res.json();
        } catch (e) {
            const all = safeParse(STORAGE_KEYS.GOALS);
            const newGoal = { ...goal, id: 'id' in goal ? goal.id : Date.now().toString() };
            const index = all.findIndex((g: any) => g.id === newGoal.id);
            if (index !== -1) all[index] = newGoal; else all.push(newGoal);
            localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(all));
            return newGoal as Goal;
        }
    },
    delete: async (id: string): Promise<void> => {
        try {
            const res = await fetch(`${API_URL}/goals/${id}`, {
                method: 'DELETE',
                headers: getHeaders(),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Fetch failed');
        } catch (e) {
            let all = safeParse(STORAGE_KEYS.GOALS);
            all = all.filter((g: Goal) => g.id !== id);
            localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(all));
        }
    }
};

export const billService = {
    getAll: async (userId: string): Promise<Bill[]> => {
        try {
            const res = await fetch(`${API_URL}/bills`, { headers: getHeaders(), credentials: 'include' });
            if (!res.ok) throw new Error('Fetch failed');
            return await res.json();
        } catch (e) {
            const all = safeParse(STORAGE_KEYS.BILLS);
            return all.filter((b: Bill) => b.userId === userId).sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        }
    },
    add: async (bill: Omit<Bill, 'id'>): Promise<Bill> => {
        try {
            const res = await fetch(`${API_URL}/bills`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(bill),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Fetch failed');
            return await res.json();
        } catch (e) {
            const all = safeParse(STORAGE_KEYS.BILLS);
            const newBill = { ...bill, id: Date.now().toString() };
            all.push(newBill);
            localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(all));
            return newBill;
        }
    },
    markAsPaid: async (id: string): Promise<void> => {
        try {
            const res = await fetch(`${API_URL}/bills/${id}/pay`, {
                method: 'POST',
                headers: getHeaders(),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Fetch failed');
        } catch (e) {
            const all = safeParse(STORAGE_KEYS.BILLS);
            const index = all.findIndex((b: any) => b.id === id);
            if (index !== -1) {
                all[index].isPaid = true;
                localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(all));
            }
        }
    }
};

export const notificationService = {
    getAll: async (userId: string): Promise<AppNotification[]> => {
        const all = safeParse(STORAGE_KEYS.NOTIFICATIONS);
        return all.filter((n: AppNotification) => n.userId === userId).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    getUnreadCount: async (userId: string): Promise<number> => {
        const all = await notificationService.getAll(userId);
        return all.filter(n => !n.isRead).length;
    },
    add: async (notif: Omit<AppNotification, 'id' | 'date' | 'isRead'>): Promise<AppNotification> => {
        const all = safeParse(STORAGE_KEYS.NOTIFICATIONS);
        const newNotif = { ...notif, id: Date.now().toString(), date: new Date().toISOString(), isRead: false };
        all.push(newNotif);
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all));
        return newNotif;
    },
    markAsRead: async (id: string): Promise<void> => {
        const all = safeParse(STORAGE_KEYS.NOTIFICATIONS);
        const index = all.findIndex((n: any) => n.id === id);
        if (index !== -1) {
            all[index].isRead = true;
            localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all));
        }
    }
};

export const portfolioService = {
    get: async (userId: string): Promise<PortfolioAnalysis | null> => {
        try {
            const res = await fetch(`${API_URL}/portfolio`, { headers: getHeaders(), credentials: 'include' });
            if (!res.ok) throw new Error('Fetch failed');
            return await res.json();
        } catch (e) {
            const data = localStorage.getItem(`${STORAGE_KEYS.PORTFOLIO}_${userId}`);
            if (!data || data === 'undefined') return null;
            try {
                return JSON.parse(data);
            } catch (e) { return null; }
        }
    },
    save: async (userId: string, data: PortfolioAnalysis): Promise<void> => {
        try {
            const res = await fetch(`${API_URL}/portfolio`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data),
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Fetch failed');
        } catch (e) {
            localStorage.setItem(`${STORAGE_KEYS.PORTFOLIO}_${userId}`, JSON.stringify(data));
        }
    }
};