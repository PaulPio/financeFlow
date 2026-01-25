// This service handles Google Identity Services (GIS) and Google API Client (GAPI) interaction
// NOTE: You must have REACT_APP_GOOGLE_CLIENT_ID and REACT_APP_GOOGLE_API_KEY in your env
// For hackathon/demo purposes, we default to empty strings which will cause the init to fail gracefully if not set.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const API_KEY = import.meta.env.VITE_API_KEY || ''; // Re-using the same key if it supports Gmail API, else needs specific one
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';

let tokenClient: any;
let mockMode = false;

export const initGmailApi = async () => {
    return new Promise<void>((resolve, reject) => {
        if (!CLIENT_ID) {
            console.warn("Google Client ID is missing. Gmail integration will switch to Mock Mode.");
            mockMode = true;
            resolve();
            return;
        }

        const check = () => {
            if ((window as any).google && (window as any).gapi) {
                try {
                    // GIS - Token Client
                    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                        client_id: CLIENT_ID,
                        scope: SCOPES,
                        callback: '', // defined dynamically later
                    });

                    // GAPI - API Client
                    (window as any).gapi.load('client', async () => {
                        await (window as any).gapi.client.init({
                            apiKey: API_KEY,
                            discoveryDocs: [DISCOVERY_DOC],
                        });
                        resolve();
                    });
                } catch (e) {
                    console.warn("Gmail API Init failed, switching to Mock Mode", e);
                    mockMode = true;
                    resolve();
                }
            } else {
                // If scripts haven't loaded after 5 seconds, fallback to mock to prevent blocking
                setTimeout(check, 100);
            }
        };
        // Add a safety timeout to force mock mode if google scripts are blocked
        setTimeout(() => {
            if (!tokenClient && !mockMode) {
                console.warn("Gmail API scripts timeout. Switching to Mock Mode.");
                mockMode = true;
                resolve();
            }
        }, 5000);

        check();
    });
};

export const handleGmailLogin = async (): Promise<string> => {
    if (mockMode) {
        return Promise.resolve("mock-token-123");
    }

    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            reject("Gmail API not initialized");
            return;
        }

        tokenClient.callback = async (resp: any) => {
            if (resp.error) {
                reject(resp);
            }
            resolve(resp.access_token);
        };

        // Skip prompt if we already have a token (though for implicit flow, we usually re-ask or check expiry)
        // For simplicity, we ask for consent if we don't think we have one, or just request.
        if ((window as any).gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    });
};

export const fetchRecentEmails = async (days = 30) => {
    if (mockMode) {
        // Return realistic mock data for demo purposes
        await new Promise(r => setTimeout(r, 1500)); // Simulate network delay
        return [
            {
                id: 'mock1',
                subject: 'Amazon.com order of "Wireless Mouse"',
                snippet: 'Thank you for your order. Your total is $25.99...',
                body: 'Order Confirmation\nDate: 2024-06-15\nMerchant: Amazon\nTotal: $25.99\nItem: Wireless Mouse\nPayment Method: Visa ending in 1234'
            },
            {
                id: 'mock2',
                subject: 'Your Uber ride receipt',
                snippet: 'Thanks for riding with Uber. Total $14.50',
                body: 'Uber Receipt\nDate: 2024-06-18\nMerchant: Uber\nTotal: $14.50\nCategory: Transportation'
            },
            {
                id: 'mock3',
                subject: 'Starbucks Mobile Order Receipt',
                snippet: 'Here is your receipt for your order at Starbucks...',
                body: 'Starbucks Receipt\nDate: 2024-06-20\nMerchant: Starbucks\nTotal: $8.75\nCategory: Dining'
            }
        ];
    }

    try {
        const date = new Date();
        date.setDate(date.getDate() - days);
        const dateStr = Math.floor(date.getTime() / 1000); // Seconds since epoch

        // Search for receipts
        const response = await (window as any).gapi.client.gmail.users.messages.list({
            'userId': 'me',
            'q': `(subject:receipt OR subject:order OR subject:invoice OR subject:payment) after:${dateStr}`,
            'maxResults': 15
        });

        const messages = response.result.messages || [];
        const emails = [];

        for (const msg of messages) {
            const detail = await (window as any).gapi.client.gmail.users.messages.get({
                'userId': 'me',
                'id': msg.id,
                'format': 'full'
            });

            // Extract body
            let body = '';
            const payload = detail.result.payload;

            // Helper to decode base64url
            const decode = (data: string) => {
                try {
                    return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
                } catch (e) { return ''; }
            };

            if (payload.parts) {
                // Try to find text/plain first, then text/html
                const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
                if (textPart && textPart.body.data) {
                    body = decode(textPart.body.data);
                } else {
                    // If no plain text part, look nested (multipart/alternative)
                    const nestedPart = payload.parts.find((p: any) => p.parts);
                    if (nestedPart) {
                        const nestedText = nestedPart.parts.find((p: any) => p.mimeType === 'text/plain');
                        if (nestedText && nestedText.body.data) {
                            body = decode(nestedText.body.data);
                        }
                    }
                }
            } else if (payload.body.data) {
                body = decode(payload.body.data);
            }

            // Extract Snippet & Subject
            const subject = payload.headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';

            emails.push({
                id: msg.id,
                subject: subject,
                snippet: detail.result.snippet,
                body: body || detail.result.snippet // Fallback to snippet if body decoding fails
            });
        }
        return emails;

    } catch (err) {
        console.error("Gmail Fetch Error", err);
        throw err;
    }
}