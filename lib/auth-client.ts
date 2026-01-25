import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
    baseURL: typeof window !== "undefined" ? `${window.location.origin}/api/auth` : (import.meta.env.VITE_BETTER_AUTH_URL || "http://localhost:3000/api/auth")
})

export const { signIn, signUp, useSession } = authClient;
