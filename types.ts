
export interface FinancialProfile {
  monthlyIncome: number;
  currency: string;
  savingsGoal: string; // e.g. "Buy a house", "Retire early"
  riskTolerance: 'Low' | 'Medium' | 'High';
  financialFocus: 'Debt Repayment' | 'Savings' | 'Investing' | 'Budgeting';
  occupation?: string;
  age?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  financialProfile?: FinancialProfile;
  hasCompletedOnboarding?: boolean;
}

export enum TransactionCategory {
  Dining = 'Dining',
  Groceries = 'Groceries',
  Transportation = 'Transportation',
  Entertainment = 'Entertainment',
  Shopping = 'Shopping',
  Utilites = 'Utilities',
  Housing = 'Housing',
  Insurance = 'Insurance',
  Health = 'Health',
  Loans = 'Loans',
  Education = 'Education',
  Travel = 'Travel',
  Bills = 'Bills',
  Income = 'Income',
  Healthcare = 'Healthcare',
  Other = 'Other'
}

export interface Transaction {
  id: string;
  userId: string;
  date: string;
  merchant: string;
  amount: number;
  category: TransactionCategory | string;
  description?: string;
  isRecurring?: boolean;
}

export interface Budget {
  id: string;
  userId: string;
  category: string;
  limit: number;
  period: 'monthly' | 'weekly';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  category: 'Retirement' | 'Debt' | 'Education' | 'Health' | 'Purchase' | 'Emergency Fund' | 'Other';
  aiAdvice?: string;
}

export interface Bill {
  id: string;
  userId: string;
  name: string; // e.g. "Chase Credit Card"
  amount: number;
  dueDate: string;
  isPaid: boolean;
  category: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'alert' | 'info' | 'success';
  date: string;
  isRead: boolean;
}

export interface PortfolioHolding {
  symbol: string;
  description: string;
  quantity: number;
  marketValue: number;
  allocation?: string;
}

export interface PortfolioAnalysis {
  holdings: PortfolioHolding[];
  totalValue: number;
  benchmarkComparison: string;
  riskAssessment: string;
  aiComments: string;
}