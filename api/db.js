import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in environment variables');
}

// Cache the connection across module reloads (important for serverless)
let cached = global.mongooseCache;
if (!cached) {
    cached = global.mongooseCache = { conn: null, promise: null };
}

export async function connectDB() {
    if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;

    // Reset stale state if the connection has dropped
    if (mongoose.connection.readyState !== 1) {
        cached.conn = null;
        cached.promise = null;
    }

    if (!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI.trim(), {
            dbName: 'financeflow',
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        }).catch(err => {
            cached.promise = null;
            cached.conn = null;
            throw err;
        });
    }

    cached.conn = await cached.promise;
    return cached.conn;
}

export { mongoose };
