import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    deadline: { type: Date, required: true },
    category: {
        type: String,
        enum: ['Retirement', 'Debt', 'Education', 'Health', 'Purchase', 'Emergency Fund', 'Other'],
        required: true
    },
    aiAdvice: String
}, { timestamps: true });

goalSchema.index({ userId: 1, deadline: 1 });

export default mongoose.model('Goal', goalSchema);
