import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: Date, required: true },
  merchant: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  description: String,
}, { timestamps: true });

transactionSchema.index({ userId: 1, date: -1 });
// Supports the budget aggregation query (match on userId + date range + category)
transactionSchema.index({ userId: 1, date: 1, category: 1 });

export default mongoose.model('Transaction', transactionSchema);