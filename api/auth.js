import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();


export const auth = betterAuth({
    database: mongodbAdapter(mongoose.connection.useDb('financeflow')), // Ensure we use the correct DB
    emailAndPassword: {
        enabled: true
    },
    socialProviders: {
        google: {
            clientId: process.env.VITE_GOOGLE_CLIENT_ID,
            clientSecret: process.env.VITE_GOOGLE_CLIENT_SECRET,
        }
    },
    trustedOrigins: ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173", "https://finance-flow-lac.vercel.app"],
    user: {
        additionalFields: {
            hasCompletedOnboarding: { type: "boolean", required: false, defaultValue: false },
            financialProfile: { type: "string", required: false }, // Store as string if object not supported, or JSON
        }
    }
});
