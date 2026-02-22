import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  category: { type: String, required: true },
  limit: { type: Number, required: true },
  period: { type: String, default: 'monthly' },
}, { timestamps: true });

budgetSchema.index({ userId: 1, category: 1 }, { unique: true });

export default mongoose.model('Budget', budgetSchema);