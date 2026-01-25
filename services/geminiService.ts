import { GoogleGenAI, Type } from "@google/genai";
import { TransactionCategory, Transaction, Budget, Goal, FinancialProfile, PortfolioAnalysis } from "../types";

// Initialize Gemini
// Note: In a real production app, API keys should not be exposed in client-side code.
let ai: GoogleGenAI;

const getAi = () => {
  if (!ai) {
    // Vite uses literal string replacement for these variables.
    // We try multiple standard names to ensure the key is picked up.
    // @ts-ignore - process.env might not be defined in Browser but Vite's 'define' handles it
    const apiKey = import.meta.env.VITE_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || '';

    if (!apiKey) {
      console.error("CRITICAL: Gemini API Key is missing! AI features will not work.");
      console.info("Please check if VITE_API_KEY is set in your .env file and restart the dev server.");
    }

    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

// 1. Categorize Transaction (Fast - Flash Lite)
export const categorizeTransaction = async (merchant: string, amount: number, description?: string): Promise<string> => {
  try {
    const prompt = `
      Categorize this financial transaction into one of these exact categories: 
      ${Object.values(TransactionCategory).join(', ')}.
      
      Transaction Details:
      Merchant: ${merchant}
      Amount: ${amount}
      Description: ${description || 'N/A'}
      
      Return ONLY the category name. Default to 'Other' if unclear.
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
    });

    const text = response.text?.trim();
    return text || 'Other';
  } catch (error) {
    console.error("Gemini Categorization Error:", error);
    return 'Other';
  }
};

// 2. Chat with Financial Advisor (Reasoning - Pro)
export const chatWithAdvisor = async (
  history: { role: 'user' | 'model', text: string }[],
  newMessage: string,
  context?: { transactions: Transaction[], budgets: Budget[], userProfile?: FinancialProfile }
) => {
  try {
    let systemInstruction = "You are an expert personal finance advisor named FinFlow AI. Be helpful, concise, and friendly. Use data visualization text descriptions if helpful.";

    // Inject user data into the system prompt if available
    if (context) {
      const txSummary = context.transactions.slice(0, 100).map(t =>
        `${new Date(t.date).toISOString().split('T')[0]}: ${t.merchant} ($${t.amount}, ${t.category})`
      ).join('\n');

      const budgetSummary = context.budgets.map(b =>
        `${b.category} Budget: Limit $${b.limit} (${b.period})`
      ).join('\n');

      let profileContext = "";
      if (context.userProfile) {
        profileContext = `
            USER PROFILE:
            - Occupation: ${context.userProfile.occupation || 'Not specified'}
            - Monthly Income: $${context.userProfile.monthlyIncome}
            - Financial Focus: ${context.userProfile.financialFocus}
            - Risk Tolerance: ${context.userProfile.riskTolerance}
            - Primary Goal: ${context.userProfile.savingsGoal}
            
            Tailor your advice to support the user's financial focus (${context.userProfile.financialFocus}) and risk tolerance.
            `;
      }

      systemInstruction += `
        
        ${profileContext}

        CONTEXT - FINANCIAL DATA:
        The following is the user's recent financial data. Use this to answer their questions accurately.
        
        Active Budgets:
        ${budgetSummary}

        Recent Transactions (Last 100):
        ${txSummary}

        If the user asks about spending totals, calculate them from this list.
        `;
    }

    const chat = getAi().chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: systemInstruction,
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }))
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text;
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "I'm having trouble connecting to my financial brain right now. Please try again.";
  }
};

// 3. Search for Financial News/Info (Grounding - Flash + Search)
export const searchFinancialTopic = async (query: string): Promise<{ text: string, sources: any[] }> => {
  try {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: query,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    return {
      text: response.text || "No results found.",
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Gemini Search Error", error);
    return { text: "Search currently unavailable.", sources: [] };
  }
}

// 4. Analyze Receipt Image (Vision - Pro)
export const analyzeReceipt = async (base64Image: string): Promise<any> => {
  try {
    // Schema for structured receipt data
    const response = await getAi().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          },
          {
            text: "Analyze this receipt. Extract the merchant name, total date, and suggest a category. Return valid JSON."
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchant: { type: Type.STRING },
            date: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    throw new Error("No JSON returned");

  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw error;
  }
};

// 5. Map CSV Headers (Reasoning - Pro)
export const mapCsvHeaders = async (headers: string[]): Promise<{
  dateIndex: number;
  merchantIndex: number;
  amountIndex: number;
  descriptionIndex: number;
  categoryIndex: number;
}> => {
  try {
    const prompt = `
      Map these CSV headers to the target fields.
      Headers: ${JSON.stringify(headers)}
      
      Target Fields:
      - dateIndex: Index of column containing transaction date (e.g., Date, Time, Timestamp)
      - merchantIndex: Index of column containing merchant/payee name (e.g., Merchant, Description, Payee)
      - amountIndex: Index of column containing transaction amount (e.g., Amount, Debit, Value)
      - descriptionIndex: Index of column containing extra details (e.g., Memo, Description, Notes). Optional.
      - categoryIndex: Index of column containing category (e.g., Category, Type, Tag). Optional.

      Return the integer index (0-based) for each field. Use -1 if a field is not found.
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dateIndex: { type: Type.INTEGER },
            merchantIndex: { type: Type.INTEGER },
            amountIndex: { type: Type.INTEGER },
            descriptionIndex: { type: Type.INTEGER },
            categoryIndex: { type: Type.INTEGER },
          }
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    return { dateIndex: 0, merchantIndex: 1, amountIndex: 2, descriptionIndex: 3, categoryIndex: -1 };

  } catch (error) {
    console.error("Gemini Header Mapping Error:", error);
    return { dateIndex: 0, merchantIndex: 1, amountIndex: 2, descriptionIndex: 3, categoryIndex: -1 };
  }
};

// 6. Generate Insights (Analysis - Flash)
export const generateInsights = async (transactions: Transaction[], budgets: Budget[]): Promise<string[]> => {
  try {
    // Simplify data to save tokens and fit context
    const txSummary = transactions.slice(0, 50).map(t => `${t.date.split('T')[0]}: ${t.merchant} (${t.category}) - $${t.amount}`).join('\n');
    const budgetSummary = budgets.map(b => `${b.category}: Limit $${b.limit}`).join('\n');

    const prompt = `
      Act as a personal finance data analyst.
      Analyze the following transaction history and budget settings.
      Provide exactly 3 short, high-impact, actionable insights or compliments for the user.
      Focus on: spending anomalies, top spending categories, budget adherence, or saving opportunities.
      
      Transactions (Last 50):
      ${txSummary}
      
      Budgets:
      ${budgetSummary}
      
      Output Format:
      Return ONLY a JSON array of strings. Example: ["You spent 20% less on dining this week!", "Consider lowering your entertainment budget."]
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const text = response.text;
    if (text) return JSON.parse(text);
    return [];
  } catch (error) {
    console.error("Gemini Insights Error:", error);
    return ["Track your expenses daily to stay on top of your finances.", "Set up a savings goal for your next big purchase.", "Review your subscription services for potential savings."];
  }
};

// 7. Generate Goal Strategy (Reasoning - Pro)
export const generateGoalStrategy = async (goal: Goal, transactions: Transaction[]): Promise<string> => {
  try {
    const monthlyIncome = transactions
      .filter(t => t.category === 'Income')
      .reduce((sum, t) => sum + t.amount, 0) / 3; // Approx average over last ~3 months if available, simplifying for demo

    const monthlyExpense = transactions
      .filter(t => t.category !== 'Income')
      .reduce((sum, t) => sum + t.amount, 0) / 3;

    const discretionary = monthlyIncome - monthlyExpense;

    const prompt = `
            Act as a strategic financial planner. 
            The user wants to achieve this goal:
            Goal Name: ${goal.name}
            Category: ${goal.category}
            Target Amount: $${goal.targetAmount}
            Current Saved: $${goal.currentAmount}
            Deadline: ${goal.deadline}

            Context:
            Estimated Monthly Disposable Income: $${discretionary.toFixed(2)} (Income - Expenses)

            Provide a 3-step action plan to achieve this goal by the deadline. 
            Be specific about how much to save monthly. 
            If the goal is unrealistic given the disposable income, suggest an adjustment.
            
            Keep the response concise (under 100 words).
        `;

    const response = await getAi().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });

    return response.text || "Could not generate a plan at this time.";
  } catch (e) {
    console.error("Gemini Goal Strategy Error:", e);
    return "Focus on consistent monthly savings to reach your target.";
  }
}

// 8. Parse Natural Language Goal Input (Reasoning)
export const parseGoalInput = async (input: string): Promise<{
  name: string;
  targetAmount: number;
  deadline: string;
  category: string;
}> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const prompt = `
            Extract financial goal details from the following user text.
            User Text: "${input}"
            
            Current Date: ${today}

            Rules:
            1. name: A short, descriptive title.
            2. targetAmount: The target dollar amount. If not specified, estimate a typical cost for this type of goal (e.g., Vacation = 2000, Car = 15000) or set to 0 if unknown.
            3. deadline: Format YYYY-MM-DD. Calculate based on text (e.g., "next year" = +1 year, "in 6 months" = +6 months). Default to 1 year from now if not specified.
            4. category: One of ['Retirement', 'Debt', 'Education', 'Health', 'Purchase', 'Emergency Fund', 'Other'].

            Return JSON.
        `;

    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview', // Good balance of speed/reasoning for extraction
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            targetAmount: { type: Type.NUMBER },
            deadline: { type: Type.STRING },
            category: { type: Type.STRING },
          }
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    throw new Error("Failed to parse goal");
  } catch (error) {
    console.error("Gemini Parse Goal Error:", error);
    // Fallback default
    return {
      name: "New Goal",
      targetAmount: 0,
      deadline: new Date(Date.now() + 31536000000).toISOString().split('T')[0], // +1 year
      category: "Other"
    };
  }
};

// 9. Generate Investment Advice (Invest Your Surplus)
export const generateInvestmentAdvice = async (surplus: number, profile?: FinancialProfile): Promise<string> => {
  try {
    const prompt = `
            The user has a calculated monthly budget surplus of $${surplus.toFixed(2)}.
            
            User Profile:
            Risk Tolerance: ${profile?.riskTolerance || 'Medium'}
            Financial Focus: ${profile?.financialFocus || 'General'}
            Age/Occupation: ${profile?.occupation || 'Unknown'}

            Provide a specific, motivating investment tip (under 60 words).
            Suggest how they could allocate this specific $${surplus} (e.g., S&P 500 ETF, High Yield Savings, paying debt).
            Mention the power of compounding.
        `;

    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || `Investing $${surplus} monthly can grow significantly over time thanks to compound interest. Consider a diversified index fund!`;
  } catch (e) {
    console.error("Gemini Investment Advice Error:", e);
    return `Great job having a surplus of $${surplus}! Investing this consistently is the key to building long-term wealth.`;
  }
};

// 10. Parse Email Receipt (Gmail Integration)
export const parseEmailReceipt = async (emailBody: string): Promise<any> => {
  try {
    const prompt = `
      Analyze the following email text and extract transaction details.
      Email Body: "${emailBody.substring(0, 8000).replace(/"/g, "'")}"

      Extract:
      1. Merchant Name (e.g. Amazon, Uber, Apple)
      2. Date (ISO Format YYYY-MM-DD). If year is missing, assume current year.
      3. Total Amount (Number only)
      4. Suggested Category (one of: Dining, Groceries, Transportation, Entertainment, Shopping, Bills, Healthcare, Housing, Utilities, Insurance, Loans, Education, Travel, Other)
      5. Description (Short summary, e.g. "Amazon Order #123")

      Return JSON only: { "merchant": string, "date": string, "amount": number, "category": string, "description": string }
      If it is clearly not a receipt, invoice, or order confirmation, return null.
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    console.error("Gemini Email Parse Error", e);
    return null;
  }
};

// 11. Parse Bank Statement PDF (Improved)
export const parseBankStatement = async (pdfText: string): Promise<{
  transactions: { date: string, merchant: string, amount: number, category: string }[],
  statementInfo?: { dueDate?: string, amountDue?: number, institution?: string }
}> => {
  try {
    console.log("[Gemini] Analyzing Bank Statement. Input Text Preview:", pdfText.substring(0, 500));
    const prompt = `
            Analyze the following text extracted from a bank statement or credit card statement PDF.
            
            Input Text:
            "${pdfText.substring(0, 40000).replace(/"/g, "'")}" 

            Tasks:
            1. Extract all individual transactions (Date, Merchant, Amount, Category).
            2. Extract Statement Summary Information (Bill/Payment Info) if available.
               Look for keywords: "Payment Due", "Total Due", "New Balance", "Ending Balance".
               
            Return JSON with:
            - transactions: [{date, merchant, amount, category}]
            - statementInfo: { dueDate (YYYY-MM-DD or null), amountDue (number or 0), institution (string or null) }

            IMPORTANT RULES:
            - Differentiate between CREDIT (Deposits) and DEBIT (Withdrawals/Payments).
            - If a transaction is a CREDIT/DEPOSIT, set the category to "Income".
            - If a transaction is a DEBIT/PAYMENT, infer the category based on the merchant.
            - Ensure amount is always positive number.
        `;

    const response = await getAi().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  merchant: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  category: { type: Type.STRING }
                }
              }
            },
            statementInfo: {
              type: Type.OBJECT,
              properties: {
                dueDate: { type: Type.STRING, nullable: true },
                amountDue: { type: Type.NUMBER, nullable: true },
                institution: { type: Type.STRING, nullable: true }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    console.log("[Gemini] Response:", text ? "Received" : "Empty");
    if (!text) return { transactions: [] };
    return JSON.parse(text);

  } catch (e) {
    console.error("Gemini Statement Parse Error", e);
    return { transactions: [] };
  }
};

// 12. Analyze Investment Portfolio PDF (Fixed Prompt)
export const analyzePortfolioPDF = async (pdfText: string): Promise<PortfolioAnalysis | null> => {
  try {
    const prompt = `
      Act as a senior financial analyst. Analyze the following text extracted from an investment portfolio statement.

      Input Text (OCR Output):
      "${pdfText.substring(0, 40000).replace(/"/g, "'")}"

      Target Format (Common in Brokerage PDFs like Robinhood):
      "Description Symbol AcctType Qty Price MktValue %"
      
      Example Line:
      "Global X MSCI Argentina ETF ARGT Cash 12.377443 $91.4100 $1,131.42 6.65%"

      Tasks:
      1. Extract Holdings: 
         - Scan for lines matching the pattern [Description] [Symbol] [Type] [Qty] [Price] [Value] [%].
         - Symbol: The Ticker (e.g. ARGT, AAPL). 
         - Description: The name before the symbol.
         - Quantity: The number before price.
         - Market Value: The total value (remove $).
      2. Calculate Total Value: Sum of all holdings market values.
      3. Comparison & Analysis:
         - Compare this portfolio's allocation to a standard S&P 500 or 60/40 benchmark.
         - Comment on diversification.
         - Assess Risk (Low, Medium, High).
    `;

    const response = await getAi().models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            holdings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  symbol: { type: Type.STRING },
                  description: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  marketValue: { type: Type.NUMBER },
                  allocation: { type: Type.STRING, description: "e.g., 'Equity', 'ETF', 'Crypto'" }
                }
              }
            },
            totalValue: { type: Type.NUMBER },
            benchmarkComparison: { type: Type.STRING, description: "Paragraph comparing performance/allocation to benchmarks." },
            riskAssessment: { type: Type.STRING, description: "Short assessment of risk level." },
            aiComments: { type: Type.STRING, description: "3-4 sentences of actionable advice or observation." }
          }
        }
      }
    });

    const text = response.text;
    if (text) return JSON.parse(text);
    return null;

  } catch (error) {
    console.error("Gemini Portfolio Analysis Error:", error);
    return null;
  }
};

// 13. Generic Content Generation (New)
export const generateContent = async (prompt: string): Promise<string> => {
  try {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || '';
  } catch (error) {
    console.error("Gemini Generate Content Error:", error);
    return "Analysis unavailable at this time.";
  }
};