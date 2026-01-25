# FinanceFlow

FinanceFlow is a comprehensive personal finance management application designed to help users track their income, expenses, budgets, goals, and investments. It features an AI-powered financial advisor to provide personalized insights and recommendations.

## Features

- **Dashboard**: Get a high-level overview of your financial health with interactive charts and summaries.
- **Transactions**: Track all your income and expenses in one place.
- **Budgets**: Set and manage monthly budgets for different categories.
- **Goals**: Create and track progress towards your financial goals.
- **Investments**: Monitor your investment portfolio and performance.
- **AI Advisor**: Chat with an AI-powered financial assistant for personalized advice and insights.
- **Document Upload**: Upload financial documents (like statements) for easy parsing and record-keeping.
- **Secure Authentication**: Robust user authentication and profile management including onboarding flow.

## Tech Stack

### Frontend
- **React** (v19)
- **TypeScript**
- **Vite**
- **Tailwind CSS** - For styling
- **Recharts** - For data visualization
- **Lucide React** - For icons
- **Better Auth** - For authentication

### Backend
- **Node.js**
- **Express.js**
- **MongoDB** with **Mongoose**
- **Better Auth** (Server-side)
- **Google Gemini API** (`@google/genai`) - For AI features

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- MongoDB (Local or Atlas)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd financeFlow
    ```

2.  **Install dependencies (Root/Frontend):**
    ```bash
    npm install
    ```

3.  **Install dependencies (Server):**
    ```bash
    cd server
    npm install
    cd ..
    ```

### Configuration

1.  **Environment Variables:**
    Create a `.env` file in the `server` directory and configure the following:
    ```env
    PORT=3000
    MONGODB_URI=mongodb://localhost:27017/financeflow
    GEMINI_API_KEY=your_gemini_api_key
    BETTER_AUTH_SECRET=your_auth_secret
    BETTER_AUTH_URL=http://localhost:3000
    ```
    *(Adjust values as per your setup)*

2.  **Frontend Config:**
    Ensure the frontend is pointing to the correct backend URL (default is usually sufficient for local dev).

### Running the Application

1.  **Start the Backend Server:**
    Open a terminal and run:
    ```bash
    cd server
    npm run dev
    ```

2.  **Start the Frontend:**
    Open a new terminal window/tab and run:
    ```bash
    npm run dev
    ```

3.  **Access the App:**
    Open your browser and navigate to the URL shown in the Vite output (typically `http://localhost:5173`).

## License

This project is licensed under the ISC License.
