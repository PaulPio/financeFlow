import mongoose from 'mongoose';

const billSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    isPaid: { type: Boolean, default: false },
    category: String
}, { timestamps: true });

billSchema.index({ userId: 1, dueDate: 1 });

export default mongoose.model('Bill', billSchema);
