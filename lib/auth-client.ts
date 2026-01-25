import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
    baseURL: "http://localhost:5000" // Server URL, check if it's 3000 or 5000
    // vite.config.ts proxies /api to 5000. Login usually hits server directly or via proxy?
    // Better Auth client usually hits the base URL for auth endpoints.
    // If we use http://localhost:5000, we bypass Vite proxy but it works.
    // If we use /api (via proxy), better-auth might expect /api/auth.
    // server mounts at /api/auth. 
    // BaseURL should be the root of the server, e.g. http://localhost:5000
    // The client will append /api/auth if configured or default to /api/auth?
    // Defaults to baseURL + /api/auth. 
    // My server mounts at /api/auth. So baseURL should be http://localhost:5000.
})

export const { signIn, signUp, useSession } = authClient;
