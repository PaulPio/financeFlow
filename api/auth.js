import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import dotenv from "dotenv";
import { connectDB, mongoose } from "./db.js";

dotenv.config();

if (!process.env.BETTER_AUTH_SECRET) {
    console.error("[Auth] Missing BETTER_AUTH_SECRET");
    throw new Error("BETTER_AUTH_SECRET is missing in environment variables");
}

const getBaseURL = () => {
    let url = process.env.BETTER_AUTH_URL;
    if (url) {
        url = url.replace(/\/$/, "");
        if (!url.endsWith('/api/auth')) {
            url = `${url}/api/auth`;
        }
        console.log("[Auth] Using BETTER_AUTH_URL:", url);
        return url;
    }
    if (process.env.VERCEL_URL) {
        const vUrl = `https://${process.env.VERCEL_URL.replace(/\/$/, "")}/api/auth`;
        console.log("[Auth] Detected VERCEL_URL:", vUrl);
        return vUrl;
    }
    const port = process.env.PORT || 5000;
    console.log(`[Auth] Defaulting to localhost baseURL with port ${port}`);
    return `http://localhost:${port}/api/auth`;
};

const finalBaseURL = getBaseURL();
console.log("[Auth] Initialization Summary:", {
    hasSecret: !!process.env.BETTER_AUTH_SECRET,
    baseURL: finalBaseURL,
    googleConfigured: !!(process.env.VITE_GOOGLE_CLIENT_ID && process.env.VITE_GOOGLE_CLIENT_SECRET)
});

let _auth = null;

export async function getAuth() {
    if (_auth && mongoose.connection.readyState === 1) return _auth;

    await connectDB();
    const db = mongoose.connection.db;

    _auth = betterAuth({
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
                enabled: !!(process.env.VITE_GOOGLE_CLIENT_ID && process.env.VITE_GOOGLE_CLIENT_SECRET),
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

    return _auth;
}
