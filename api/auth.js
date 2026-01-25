import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import mongoose from "mongoose";
import dotenv from "dotenv";

import { MongoClient } from "mongodb";

dotenv.config();



if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in environment variables");
}
if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is missing in environment variables");
}

const client = new MongoClient(process.env.MONGODB_URI);

try {
    // Top level await is fine in ESM (this file uses imports)
    await client.connect();
    console.log("Connected to MongoDB for Better Auth");
} catch (e) {
    console.error("Failed to connect to MongoDB in auth.js", e);
    throw e;
}

const db = client.db('financeflow');

const getBaseURL = () => {
    if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/auth`;
    return "http://localhost:3000/api/auth";
};

export const auth = betterAuth({
    database: mongodbAdapter(db),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: getBaseURL(),
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
