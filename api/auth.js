import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import mongoose from "mongoose";
import dotenv from "dotenv";

import { MongoClient } from "mongodb";

dotenv.config();



console.log("[Auth] Booting initialization...");

if (!process.env.MONGODB_URI) {
    console.error("[Auth] Missing MONGODB_URI");
    throw new Error("MONGODB_URI is missing in environment variables");
}
if (!process.env.BETTER_AUTH_SECRET) {
    console.error("[Auth] Missing BETTER_AUTH_SECRET");
    throw new Error("BETTER_AUTH_SECRET is missing in environment variables");
}

const mongoUri = process.env.MONGODB_URI.trim();
const client = new MongoClient(mongoUri);

try {
    console.log("[Auth] Connecting to MongoDB...");
    await client.connect();
    console.log("[Auth] Connected successfully");
} catch (e) {
    console.error("[Auth] MongoDB connection failed:", e.message);
    // Don't throw here, let the adapter try or fail gracefully
}

const db = client.db('financeflow');

const getBaseURL = () => {
    let url = process.env.BETTER_AUTH_URL;
    if (url) {
        if (!url.endsWith('/api/auth')) {
            url = `${url}/api/auth`;
        }
        console.log("[Auth] Using BETTER_AUTH_URL:", url);
        return url;
    }
    if (process.env.VERCEL_URL) {
        const vUrl = `https://${process.env.VERCEL_URL}/api/auth`;
        console.log("[Auth] Detected VERCEL_URL:", vUrl);
        return vUrl;
    }
    console.log("[Auth] Defaulting to localhost baseURL");
    return "http://localhost:3000/api/auth";
};

const finalBaseURL = getBaseURL();
console.log("[Auth] Initialization Summary:", {
    hasSecret: !!process.env.BETTER_AUTH_SECRET,
    baseURL: finalBaseURL,
    googleConfigured: !!(process.env.VITE_GOOGLE_CLIENT_ID && process.env.VITE_GOOGLE_CLIENT_SECRET)
});

export const auth = betterAuth({
    database: mongodbAdapter(db),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: finalBaseURL,
    emailAndPassword: {
        enabled: true
    },
    socialProviders: {
        google: {
            clientId: process.env.VITE_GOOGLE_CLIENT_ID,
            clientSecret: process.env.VITE_GOOGLE_CLIENT_SECRET,
        }
    },
    user: {
        additionalFields: {
            hasCompletedOnboarding: {
                type: "boolean",
                required: false,
                defaultValue: false
            }
        }
    },
    trustedOrigins: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5000",
        "http://localhost:5173",
        "https://finance-flow-lac.vercel.app",
        "https://finance-flow-git-vercel-paulpios-projects.vercel.app"
    ]
});
