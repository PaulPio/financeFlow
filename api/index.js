import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
// removed jwt and bcryptjs imports

import User from './models/User.js';
import Transaction from './models/Transaction.js';
import Budget from './models/Budget.js';

dotenv.config();

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"];

    // Check if origin is in allowed list or is a vercel deployment
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

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/financeflow';
// Append database name if not present in URI, though usually strictly URI is preferred. 
// Assuming URI connects to cluster, we select DB.
mongoose.connect(MONGODB_URI, { dbName: 'financeflow' })
  .then(() => console.log('Successfully connected to MongoDB: financeflow'))
  .catch(err => console.error('MongoDB connection error:', err));

// removed JWT_SECRET definition

// Middleware
// Middleware
const authenticateToken = async (req, res, next) => {
  try {
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
    console.error("Auth Middleware Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// --- Routes ---

import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";

// Auth
// Auth
// Auth
// Auth
// Explicitly handle OPTIONS for auth routes to ensure CORS headers are sent
app.options("/api/auth/*", (req, res) => {
  res.sendStatus(200);
});

// Auth
app.all("/api/auth/*", async (req, res) => {
  try {
    return await toNodeHandler(auth)(req, res);
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(500).json({ message: "Auth Error", error: error.message });
  }
});

// Manual Auth routes removed in favor of Better Auth
// logic handled by app.all("/api/auth/*")

// Transactions
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id }).sort({ date: -1 });
    res.json(transactions.map(t => ({ ...t.toObject(), id: t._id })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const transaction = new Transaction({ ...req.body, userId: req.user.id });
    console.log('Saving transaction to MongoDB:', transaction);
    await transaction.save();
    res.json({ ...transaction.toObject(), id: transaction._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions/batch', authenticateToken, async (req, res) => {
  try {
    const transactions = req.body.map(t => ({ ...t, userId: req.user.id }));
    const result = await Transaction.insertMany(transactions);
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

// Budgets
app.get('/api/budgets', authenticateToken, async (req, res) => {
  try {
    const budgets = await Budget.find({ userId: req.user.id });

    // Calculate spent for current month for each budget
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const transactions = await Transaction.find({
      userId: req.user.id,
      date: { $gte: startOfMonth },
      category: { $ne: 'Income' } // Don't count income as spent
    });

    const budgetsWithSpent = budgets.map(budget => {
      const spent = transactions
        .filter(t => t.category === budget.category)
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        ...budget.toObject(),
        id: budget._id,
        spent
      };
    });

    res.json(budgetsWithSpent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/budgets', authenticateToken, async (req, res) => {
  try {
    // Check if exists
    if (req.body.id) {
      // Update
      const updated = await Budget.findOneAndUpdate(
        { _id: req.body.id, userId: req.user.id },
        req.body,
        { new: true }
      );
      return res.json({ ...updated.toObject(), id: updated._id });
    }

    const exists = await Budget.findOne({ userId: req.user.id, category: req.body.category });
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
// Listen if running locally or if PORT is specifically set
if (process.env.NODE_ENV !== 'production' || process.env.PORT) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;