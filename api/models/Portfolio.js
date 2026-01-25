import mongoose from 'mongoose';

const portfolioSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    totalValue: { type: Number, required: true },
    holdings: [{
        symbol: String,
        description: String,
        quantity: Number,
        marketValue: Number,
        allocation: String
    }],
    benchmarkComparison: String,
    riskAssessment: String,
    aiComments: String
}, { timestamps: true });

export default mongoose.model('Portfolio', portfolioSchema);
