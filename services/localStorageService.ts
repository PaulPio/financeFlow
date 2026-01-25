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
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
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
        const password = "demo-password-123";
        const name = email.split('@')[0];

        try {
            // 1. Try Real Backend
            let response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (response.status === 400) {
                // Try register if user not found
                response = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, name })
                });
            }

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
                localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
                return data.user;
            }
            throw new Error('Backend auth failed');
        } catch (e) {
            console.warn("Backend unavailable (Failed to fetch). Switching to Offline/Demo mode using LocalStorage.");

            // Fallback: LocalStorage Auth
            let users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
            let user = users.find(u => u.email === email);

            if (!user) {
                user = { id: Date.now().toString(), email, name };
                users.push(user);
                localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
            }

            localStorage.setItem(STORAGE_KEYS.TOKEN, 'mock-jwt-token');
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));

            // Auto-seed data for new demo users so the app isn't empty
            seedDemoData(user.id);

            return user;
        }
    },

    logout: () => {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    },

    getCurrentUser: (): User | null => {
        const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        return raw ? JSON.parse(raw) : null;
    },

    updateUser: (updates: Partial<User>): User | null => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) return null;

        const updatedUser = { ...currentUser, ...updates };

        // Update in current session
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));

        // Update in users list
        const users: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
        const index = users.findIndex(u => u.id === currentUser.id);
        if (index !== -1) {
            users[index] = updatedUser;
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }

        return updatedUser;
    }
};

export const transactionService = {
    getAll: async (userId: string): Promise<Transaction[]> => {
        try {
            const res = await fetch(`${API_URL}/transactions`, { headers: getHeaders() });
            if (!res.ok) throw new Error('Fetch failed');
            return await res.json();
        } catch (e) {
            // Fallback
            const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]');
            return all
                .filter((t: Transaction) => t.userId === userId)
                .sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
    },

    add: async (transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
        try {
            const res = await fetch(`${API_URL}/transactions`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(transaction)
            });
            if (!res.ok) throw new Error('Fetch failed');
            return await res.json();
        } catch (e) {
            console.warn('Transaction save failed on backend, falling back to local storage:', e);
            // Fallback
            const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]');
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
                body: JSON.stringify(transactions)
            });
            if (!res.ok) throw new Error('Fetch failed');
        } catch (e) {
            // Fallback
            const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]');
            const newTxs = transactions.map((t, i) => ({ ...t, id: (Date.now() + i).toString() }));
            all.push(...newTxs);
            localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(all));
        }
    },

    delete: async (id: string): Promise<void> => {
        try {
            const res = await fetch(`${API_URL}/transactions/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (!res.ok) throw new Error('Fetch failed');
        } catch (e) {
            // Fallback
            let all = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]');
            all = all.filter((t: Transaction) => t.id !== id);
            localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(all));
        }
    }
};

export const budgetService = {
    getAll: async (userId: string): Promise<(Budget & { spent: number })[]> => {
        try {
            const res = await fetch(`${API_URL}/budgets`, { headers: getHeaders() });
            if (!res.ok) throw new Error('Fetch failed');
            return await res.json();
        } catch (e) {
            // Fallback: Logic to mimic backend 'spent' calculation
            const budgets = JSON.parse(localStorage.getItem(STORAGE_KEYS.BUDGETS) || '[]').filter((b: Budget) => b.userId === userId);
            const transactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]').filter((t: Transaction) => t.userId === userId);

            return budgets.map((b: Budget) => {
                const spent = transactions
                    .filter((t: Transaction) => {
                        if (!t.category || t.category === 'Income') return false;
                        const txCat = t.category.trim().toLowerCase();
                        const bgCat = b.category.trim().toLowerCase();
                        return txCat === bgCat;
                    })
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
                body: JSON.stringify(budget)
            });
            if (!res.ok) throw new Error('Fetch failed');
            return await res.json();
        } catch (e) {
            // Fallback
            const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.BUDGETS) || '[]');
            if ('id' in budget) {
                const index = all.findIndex((b: Budget) => b.id === budget.id);
                if (index !== -1) {
                    all[index] = budget;
                    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(all));
                    return budget as Budget;
                }
            }
            const newBudget = { ...budget, id: Date.now().toString() };
            all.push(newBudget);
            localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(all));
            return newBudget as Budget;
        }
    },

    delete: async (id: string): Promise<void> => {
        try {
            const res = await fetch(`${API_URL}/budgets/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (!res.ok) throw new Error('Fetch failed');
        } catch (e) {
            // Fallback
            let all = JSON.parse(localStorage.getItem(STORAGE_KEYS.BUDGETS) || '[]');
            all = all.filter((b: Budget) => b.id !== id);
            localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(all));
        }
    }
};

export const goalService = {
    getAll: async (userId: string): Promise<Goal[]> => {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.GOALS) || '[]');
        return all.filter((g: Goal) => g.userId === userId);
    },

    save: async (goal: Omit<Goal, 'id'> | Goal): Promise<Goal> => {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.GOALS) || '[]');

        if ('id' in goal) {
            const index = all.findIndex((g: Goal) => g.id === goal.id);
            if (index !== -1) {
                all[index] = goal;
                localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(all));
                return goal as Goal;
            }
        }

        const newGoal = { ...goal, id: Date.now().toString() };
        all.push(newGoal);
        localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(all));
        return newGoal as Goal;
    },

    delete: async (id: string): Promise<void> => {
        let all = JSON.parse(localStorage.getItem(STORAGE_KEYS.GOALS) || '[]');
        all = all.filter((g: Goal) => g.id !== id);
        localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(all));
    }
};

export const billService = {
    getAll: async (userId: string): Promise<Bill[]> => {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.BILLS) || '[]');
        return all
            .filter((b: Bill) => b.userId === userId)
            .sort((a: Bill, b: Bill) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    },

    add: async (bill: Omit<Bill, 'id'>): Promise<Bill> => {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.BILLS) || '[]');
        const newBill = { ...bill, id: Date.now().toString() };
        all.push(newBill);
        localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(all));

        // Trigger notification
        await notificationService.add({
            userId: bill.userId,
            title: 'New Bill Added',
            message: `${bill.name} is due on ${new Date(bill.dueDate).toLocaleDateString()}`,
            type: 'info'
        });

        // Simulate Email
        console.log(`[EMAIL SENT] To: user@finflow.com | Subject: New Bill Due | Body: You have a payment of $${bill.amount} for ${bill.name} due on ${bill.dueDate}`);

        return newBill;
    },

    markAsPaid: async (id: string): Promise<void> => {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.BILLS) || '[]');
        const index = all.findIndex((b: Bill) => b.id === id);
        if (index !== -1) {
            all[index].isPaid = true;
            localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(all));
        }
    }
};

export const notificationService = {
    getAll: async (userId: string): Promise<AppNotification[]> => {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
        return all
            .filter((n: AppNotification) => n.userId === userId)
            .sort((a: AppNotification, b: AppNotification) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    getUnreadCount: async (userId: string): Promise<number> => {
        const all = await notificationService.getAll(userId);
        return all.filter(n => !n.isRead).length;
    },

    add: async (notif: Omit<AppNotification, 'id' | 'date' | 'isRead'>): Promise<AppNotification> => {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
        const newNotif: AppNotification = {
            ...notif,
            id: Date.now().toString(),
            date: new Date().toISOString(),
            isRead: false
        };
        all.push(newNotif);
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all));
        return newNotif;
    },

    markAsRead: async (id: string): Promise<void> => {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
        const index = all.findIndex((n: AppNotification) => n.id === id);
        if (index !== -1) {
            all[index].isRead = true;
            localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all));
        }
    },

    markAllAsRead: async (userId: string): Promise<void> => {
        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
        const updated = all.map((n: AppNotification) =>
            n.userId === userId ? { ...n, isRead: true } : n
        );
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
    }
};

export const portfolioService = {
    get: async (userId: string): Promise<PortfolioAnalysis | null> => {
        const key = `${STORAGE_KEYS.PORTFOLIO}_${userId}`;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },
    save: async (userId: string, data: PortfolioAnalysis): Promise<void> => {
        const key = `${STORAGE_KEYS.PORTFOLIO}_${userId}`;
        localStorage.setItem(key, JSON.stringify(data));
    }
};