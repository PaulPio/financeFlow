import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import User from './models/User.js';
import Transaction from './models/Transaction.js';
import Budget from './models/Budget.js';
import { getAuth } from "./auth.js";
import { toNodeHandler } from "better-auth/node";

dotenv.config();

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowedOrigins = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"];

    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes(".vercel.app")) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// Middleware
const authenticateToken = async (req, res, next) => {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({
      headers: req.headers
    });

    if (!session) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = session.user;
    req.session = session.session;
    next();
  } catch (error) {
    console.error("Auth Middleware Error [Critical]:", {
      message: error.message,
      stack: error.stack,
      headers: req.headers
    });
    res.status(500).json({
      message: "Internal Server Error in Auth Middleware",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// --- Routes ---

// Auth
app.use("/api/auth", async (req, res) => {
  console.log(`[Auth Request] ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const auth = await getAuth();
    return await toNodeHandler(auth)(req, res);
  } catch (error) {
    console.error("[Auth Handler Error]:", error);
    res.status(500).json({
      message: "Authentication error",
      error: process.env.NODE_ENV === 'development' ? (error?.message || String(error)) : undefined
    });
  }
});

import Goal from './models/Goal.js';
import Portfolio from './models/Portfolio.js';
import Bill from './models/Bill.js';

// Transactions
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = { userId: req.user.id };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query).sort({ date: -1 }).lean();
    res.json(transactions.map(t => ({ ...t, id: t._id })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
  console.log("[API] Received POST /api/transactions request");
  try {
    const transaction = new Transaction({ ...req.body, userId: req.user.id });
    await transaction.save();
    console.log("[API] Transaction successfully saved to MongoDB:", transaction._id);
    res.json({ ...transaction.toObject(), id: transaction._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/batch', authenticateToken, async (req, res) => {
  try {
    const transactions = req.body.map(t => ({ ...t, userId: req.user.id }));
    const result = await Transaction.insertMany(transactions, { ordered: false });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', authenticateToken, async (req, res) => {
  try {
    await Transaction.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Goals
app.get('/api/goals', authenticateToken, async (req, res) => {
  try {
    const goals = await Goal.find({ userId: req.user.id }).sort({ deadline: 1 }).lean();
    res.json(goals.map(g => ({ ...g, id: g._id })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/goals', authenticateToken, async (req, res) => {
  try {
    const { id, ...data } = req.body;
    if (id) {
      const { userId, ...updateData } = data;
      const updated = await Goal.findOneAndUpdate(
        { _id: id, userId: req.user.id },
        updateData,
        { new: true }
      );
      if (!updated) return res.status(404).json({ error: 'Goal not found' });
      return res.json({ ...updated.toObject(), id: updated._id });
    }
    const goal = new Goal({ ...data, userId: req.user.id });
    await goal.save();
    res.json({ ...goal.toObject(), id: goal._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/goals/:id', authenticateToken, async (req, res) => {
  try {
    await Goal.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Portfolio
app.get('/api/portfolio', authenticateToken, async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ userId: req.user.id }).lean();
    if (!portfolio) return res.json(null);
    res.json({ ...portfolio, id: portfolio._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/portfolio', authenticateToken, async (req, res) => {
  try {
    const { id, userId, ...updateData } = req.body;
    const portfolio = await Portfolio.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updateData },
      { upsert: true, new: true }
    );
    res.json({ ...portfolio.toObject(), id: portfolio._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bills
app.get('/api/bills', authenticateToken, async (req, res) => {
  try {
    const bills = await Bill.find({ userId: req.user.id }).sort({ dueDate: 1 }).lean();
    res.json(bills.map(b => ({ ...b, id: b._id })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bills', authenticateToken, async (req, res) => {
  try {
    const { id, ...data } = req.body;
    if (id) {
      const { userId, ...updateData } = data;
      const updated = await Bill.findOneAndUpdate(
        { _id: id, userId: req.user.id },
        updateData,
        { new: true }
      );
      if (!updated) return res.status(404).json({ error: 'Bill not found' });
      return res.json({ ...updated.toObject(), id: updated._id });
    }
    const bill = new Bill({ ...data, userId: req.user.id });
    await bill.save();
    res.json({ ...bill.toObject(), id: bill._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bills/:id/pay', authenticateToken, async (req, res) => {
  try {
    await Bill.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isPaid: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Budgets
app.get('/api/budgets', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    let startDate, endDate;

    if (month && year) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Run budgets fetch and spending aggregation in parallel
    const [budgets, spentByCategory] = await Promise.all([
      Budget.find({ userId: req.user.id }).lean(),
      Transaction.aggregate([
        {
          $match: {
            userId: req.user.id,
            date: { $gte: startDate, $lte: endDate },
            category: { $ne: 'Income' }
          }
        },
        {
          $group: {
            _id: '$category',
            total: { $sum: '$amount' }
          }
        }
      ])
    ]);

    const spentMap = Object.fromEntries(spentByCategory.map(s => [s._id, s.total]));

    const budgetsWithSpent = budgets.map(budget => ({
      ...budget,
      id: budget._id,
      spent: spentMap[budget.category] ?? 0
    }));

    res.json(budgetsWithSpent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/budgets', authenticateToken, async (req, res) => {
  try {
    if (req.body.id) {
      const { userId, ...updateData } = req.body;
      const updated = await Budget.findOneAndUpdate(
        { _id: req.body.id, userId: req.user.id },
        updateData,
        { new: true }
      );
      if (!updated) return res.status(404).json({ error: 'Budget not found' });
      return res.json({ ...updated.toObject(), id: updated._id });
    }

    const exists = await Budget.findOne({ userId: req.user.id, category: req.body.category }).lean();
    if (exists) return res.status(400).json({ message: 'Budget already exists' });

    const budget = new Budget({ ...req.body, userId: req.user.id });
    await budget.save();
    res.json({ ...budget.toObject(), id: budget._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/budgets/:id', authenticateToken, async (req, res) => {
  try {
    await Budget.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production' || process.env.PORT) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
