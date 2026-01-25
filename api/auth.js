import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import mongoose from "mongoose";
import dotenv from "dotenv";

import { MongoClient } from "mongodb";

dotenv.config();



const client = new MongoClient(process.env.MONGODB_URI);

// Top level await is fine in ESM (this file uses imports)
await client.connect();
const db = client.db('financeflow');

export const auth = betterAuth({
    database: mongodbAdapter(db),
    secret: process.env.BETTER_AUTH_SECRET,
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
