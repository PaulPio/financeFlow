import React, { useState, useRef, useEffect } from 'react';
import { transactionService, authService, billService } from '../services/localStorageService';
import { categorizeTransaction, analyzeReceipt, mapCsvHeaders, parseEmailReceipt, parseBankStatement, analyzePortfolioPDF } from '../services/geminiService';
import { initGmailApi, handleGmailLogin, fetchRecentEmails } from '../services/gmailService';
import { extractTextFromPdf } from '../services/pdfService';
import { TransactionCategory, PortfolioAnalysis } from '../types';
import { UploadCloud, Check, AlertCircle, FileText, Camera, Loader2, Mail, RefreshCw, File, PieChart, TrendingUp, Shield } from 'lucide-react';

export default function Upload() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [statementInfo, setStatementInfo] = useState<any>(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<PortfolioAnalysis | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [tab, setTab] = useState<'csv' | 'receipt' | 'gmail' | 'pdf' | 'portfolio'>('csv');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [gmailConnected, setGmailConnected] = useState(false);

  useEffect(() => {
    if (tab === 'gmail') {
        initGmailApi()
            .then(() => console.log("Gmail API Ready"))
            .catch(err => console.warn("Gmail API Init Failed", err));
    }
  }, [tab]);

  // --- CSV Logic ---
  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
      setParsedData([]); 
    }
  };

  const processCsv = async () => {
    if (!csvFile) return;
    setLoading(true);
    setProgress('Reading file...');

    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim().length > 0);

        if (lines.length < 2) {
            alert("File appears to be empty or invalid.");
            setLoading(false);
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        setProgress('Analyzing CSV headers with AI...');
        const mapping = await mapCsvHeaders(headers);

        const transactions = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, '')); 
            
            const maxIndex = Math.max(mapping.dateIndex, mapping.merchantIndex, mapping.amountIndex);
            if (parts.length <= maxIndex) continue;

            const rawDate = mapping.dateIndex !== -1 ? parts[mapping.dateIndex] : '';
            const merchant = mapping.merchantIndex !== -1 ? parts[mapping.merchantIndex] : 'Unknown';
            let amount = mapping.amountIndex !== -1 ? Math.abs(parseFloat(parts[mapping.amountIndex])) : 0;
            const description = mapping.descriptionIndex !== -1 ? parts[mapping.descriptionIndex] : '';
            const rawCategory = mapping.categoryIndex !== -1 ? parts[mapping.categoryIndex] : '';

            if (isNaN(amount)) continue;

            let date = rawDate;
            const parsedDate = new Date(rawDate);
            if (!isNaN(parsedDate.getTime())) {
                date = parsedDate.toISOString();
            } else {
                const dateParts = rawDate.split('/');
                if (dateParts.length === 3) {
                     const fixDate = new Date(`${dateParts[1]}/${dateParts[0]}/${dateParts[2]}`);
                     if (!isNaN(fixDate.getTime())) {
                         date = fixDate.toISOString();
                     }
                }
            }

            transactions.push({ date, merchant, amount, description, rawCategory });
        }

        setProgress(`Categorizing ${transactions.length} transactions...`);
        
        const processed = [];
        for (const t of transactions) {
            let category = 'Other';
            if (t.rawCategory) {
                const match = Object.values(TransactionCategory).find(
                    c => c.toLowerCase() === t.rawCategory.toLowerCase()
                );
                if (match) {
                    category = match;
                } else {
                    category = await categorizeTransaction(t.merchant, t.amount, t.rawCategory);
                }
            } else {
                category = await categorizeTransaction(t.merchant, t.amount, t.description);
            }

            processed.push({ 
                date: t.date,
                merchant: t.merchant,
                amount: t.amount,
                description: t.description,
                category 
            });
        }

        setParsedData(processed);
        setLoading(false);
        setProgress('Review transactions below');
    };
    reader.readAsText(csvFile);
  };

  // --- Bank Statement PDF Logic ---
  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setPdfFile(e.target.files[0]);
          setParsedData([]);
          setStatementInfo(null);
      }
  };

  const processPdf = async () => {
      if (!pdfFile) return;
      setLoading(true);
      setProgress('Extracting text from PDF...');

      try {
          // 1. Extract Text
          const text = await extractTextFromPdf(pdfFile);
          
          setProgress('AI is analyzing bank statement...');
          // 2. Parse with Gemini
          const result = await parseBankStatement(text);

          setParsedData(result.transactions || []);
          setStatementInfo(result.statementInfo);
          setLoading(false);
          setProgress('Statement analyzed. Please review.');

      } catch (e) {
          console.error(e);
          setLoading(false);
          alert("Failed to parse PDF. Please ensure it is a valid text-based PDF statement.");
      }
  };

  // --- Portfolio PDF Logic ---
  const handlePortfolioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setPortfolioFile(e.target.files[0]);
          setPortfolioAnalysis(null);
      }
  };

  const processPortfolio = async () => {
      if (!portfolioFile) return;
      setLoading(true);
      setProgress('Analyzing Portfolio PDF (Extracting text)...');
      
      try {
          const text = await extractTextFromPdf(portfolioFile);
          setProgress('AI is benchmarking your portfolio against industry standards...');
          const analysis = await analyzePortfolioPDF(text);
          
          if (analysis) {
              setPortfolioAnalysis(analysis);
          } else {
              alert("Could not extract portfolio data.");
          }
      } catch (e) {
          console.error(e);
          alert("Error analyzing portfolio.");
      } finally {
          setLoading(false);
      }
  };

  // --- Receipt Logic ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
              setReceiptImage(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const processReceipt = async () => {
      if (!receiptImage) return;
      setLoading(true);
      setProgress('Analyzing receipt with Gemini Vision...');
      
      try {
          const base64Data = receiptImage.split(',')[1];
          const data = await analyzeReceipt(base64Data);
          
          setParsedData([{
              date: data.date || new Date().toISOString().split('T')[0],
              merchant: data.merchant || 'Unknown Merchant',
              amount: typeof data.amount === 'number' ? data.amount : 0,
              category: data.category || 'Other',
              description: 'Scanned Receipt'
          }]);
          
          setLoading(false);
          setProgress('Receipt analyzed. Please review.');
      } catch (e) {
          console.error(e);
          setLoading(false);
          alert("Failed to analyze receipt. Please try again.");
      }
  };

  // --- Gmail Logic ---
  const handleConnectGmail = async () => {
      try {
          await handleGmailLogin();
          setGmailConnected(true);
          handleScanGmail();
      } catch (err) {
          console.error(err);
          alert("Failed to login to Google.");
      }
  };

  const handleScanGmail = async () => {
      setLoading(true);
      setProgress('Scanning last 30 days of emails...');
      try {
          const emails = await fetchRecentEmails(30);
          setProgress(`Found ${emails.length} potential receipts. Analyzing...`);
          
          const receipts = [];
          for (let i = 0; i < emails.length; i++) {
              const email = emails[i];
              setProgress(`Analyzing email ${i+1}/${emails.length}: ${email.subject.substring(0, 20)}...`);
              const result = await parseEmailReceipt(email.body);
              if (result) receipts.push(result);
          }
          
          if (receipts.length === 0) alert("No clear receipts found.");
          setParsedData(receipts);

      } catch (err) {
          console.error(err);
          alert("Error fetching emails.");
      } finally {
          setLoading(false);
      }
  };

  const saveTransactions = async () => {
      const user = authService.getCurrentUser();
      if (!user) return;
      
      setLoading(true);
      
      // Save Transactions
      if (parsedData.length > 0) {
          await transactionService.addBatch(parsedData.map(t => ({
              ...t,
              userId: user.id
          })));
      }

      // Save Bill Info if detected from PDF
      if (statementInfo && statementInfo.dueDate && statementInfo.amountDue) {
          await billService.add({
              userId: user.id,
              name: `${statementInfo.institution || 'Bank'} Statement`,
              amount: statementInfo.amountDue,
              dueDate: statementInfo.dueDate,
              isPaid: false,
              category: 'Credit Card'
          });
          alert(`Imported ${parsedData.length} transactions AND set a bill reminder for ${statementInfo.dueDate}!`);
      } else {
          alert(`Imported ${parsedData.length} transactions successfully!`);
      }

      setLoading(false);
      setParsedData([]);
      setStatementInfo(null);
      setCsvFile(null);
      setPdfFile(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex gap-4 border-b border-gray-200 overflow-x-auto">
          {['csv', 'pdf', 'portfolio', 'receipt', 'gmail'].map((t) => (
             <button 
                key={t}
                className={`pb-3 px-4 font-medium capitalize whitespace-nowrap ${tab === t ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500'}`}
                onClick={() => { 
                    setTab(t as any); 
                    setParsedData([]); 
                    setStatementInfo(null);
                    setPortfolioAnalysis(null); 
                }}
             >
                 {t === 'pdf' ? 'Bank Stmt (PDF)' : t === 'portfolio' ? 'Portfolio (PDF)' : t === 'csv' ? 'Bulk CSV' : t === 'receipt' ? 'Scan Receipt' : 'Connect Gmail'}
             </button>
          ))}
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        
        {/* CSV Mode */}
        {tab === 'csv' && (
            <div className="text-center space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">Upload Transaction CSV</h3>
                    <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvChange} />
                </div>
                {csvFile && (
                    <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                        <span className="flex items-center gap-2"><FileText size={16} /> {csvFile.name}</span>
                        <button onClick={processCsv} disabled={loading} className="bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50">
                            {loading ? 'Processing...' : 'Start AI Import'}
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* Bank Statement PDF Mode */}
        {tab === 'pdf' && (
            <div className="text-center space-y-4">
                <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-8 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => pdfInputRef.current?.click()}>
                    <File className="mx-auto h-12 w-12 text-slate-400 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">Upload Bank Statement (PDF)</h3>
                    <p className="text-sm text-gray-500">Extracts transactions & payment due dates</p>
                    <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfChange} />
                </div>
                {pdfFile && (
                    <div className="flex items-center justify-between bg-purple-50 p-3 rounded-lg text-sm text-purple-700">
                        <span className="flex items-center gap-2"><File size={16} /> {pdfFile.name}</span>
                        <button onClick={processPdf} disabled={loading} className="bg-purple-600 text-white px-4 py-1.5 rounded-md hover:bg-purple-700 disabled:opacity-50">
                            {loading ? 'Analyzing...' : 'Analyze PDF'}
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* Portfolio PDF Mode (New) */}
        {tab === 'portfolio' && (
            <div className="text-center space-y-4">
                {!portfolioAnalysis && (
                    <>
                        <div className="bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-xl p-8 hover:bg-emerald-100 transition-colors cursor-pointer" onClick={() => portfolioInputRef.current?.click()}>
                            <TrendingUp className="mx-auto h-12 w-12 text-emerald-500 mb-3" />
                            <h3 className="text-lg font-medium text-gray-900">Upload Investment Portfolio (PDF)</h3>
                            <p className="text-sm text-gray-500">Benchmark comparison & AI risk analysis</p>
                            <input ref={portfolioInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePortfolioChange} />
                        </div>
                        {portfolioFile && (
                            <div className="flex items-center justify-between bg-emerald-100 p-3 rounded-lg text-sm text-emerald-800">
                                <span className="flex items-center gap-2"><File size={16} /> {portfolioFile.name}</span>
                                <button onClick={processPortfolio} disabled={loading} className="bg-emerald-700 text-white px-4 py-1.5 rounded-md hover:bg-emerald-800 disabled:opacity-50">
                                    {loading ? 'Benchmarking...' : 'Analyze Portfolio'}
                                </button>
                            </div>
                        )}
                    </>
                )}
                
                {portfolioAnalysis && (
                    <div className="text-left animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">Portfolio Analysis</h3>
                            <button onClick={() => { setPortfolioAnalysis(null); setPortfolioFile(null); }} className="text-sm text-gray-500 hover:text-gray-900 underline">Analyze another</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <p className="text-sm text-gray-500">Total Market Value</p>
                                <p className="text-2xl font-bold text-slate-900">${portfolioAnalysis.totalValue.toLocaleString()}</p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <p className="text-sm text-gray-500">Risk Assessment</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Shield size={20} className={portfolioAnalysis.riskAssessment.includes('High') ? 'text-red-500' : 'text-emerald-500'} />
                                    <span className="font-bold text-slate-900">{portfolioAnalysis.riskAssessment}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                                <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><PieChart size={18} className="text-purple-600"/> Benchmark Comparison</h4>
                                <p className="text-sm text-gray-600 leading-relaxed">{portfolioAnalysis.benchmarkComparison}</p>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg shadow-sm">
                                <h4 className="font-bold text-emerald-900 mb-2 flex items-center gap-2"><TrendingUp size={18} /> AI Insights</h4>
                                <p className="text-sm text-emerald-800 leading-relaxed">{portfolioAnalysis.aiComments}</p>
                            </div>
                        </div>

                        <h4 className="font-bold text-gray-700 mb-3">Holdings Detected</h4>
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-3">Symbol</th>
                                        <th className="p-3">Description</th>
                                        <th className="p-3 text-right">Qty</th>
                                        <th className="p-3 text-right">Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {portfolioAnalysis.holdings.map((h, idx) => (
                                        <tr key={idx}>
                                            <td className="p-3 font-bold">{h.symbol}</td>
                                            <td className="p-3">{h.description}</td>
                                            <td className="p-3 text-right">{h.quantity}</td>
                                            <td className="p-3 text-right">${h.marketValue.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Receipt Mode */}
        {tab === 'receipt' && (
            <div className="text-center space-y-4">
                 <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => cameraInputRef.current?.click()}>
                    <Camera className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">Upload or Take Photo</h3>
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                </div>
                {receiptImage && (
                    <div className="space-y-4">
                        <img src={receiptImage} alt="Receipt Preview" className="max-h-64 mx-auto rounded-lg shadow-md" />
                        <button onClick={processReceipt} disabled={loading} className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                             {loading ? 'Analyzing...' : 'Analyze Receipt'}
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* Gmail Mode */}
        {tab === 'gmail' && (
            <div className="text-center space-y-6">
                <div className="bg-gradient-to-br from-red-50 to-orange-50 p-8 rounded-xl border border-red-100">
                    <Mail className="mx-auto h-12 w-12 text-red-500 mb-3" />
                    <h3 className="text-lg font-bold text-gray-900">Scan Inbox for Receipts</h3>
                    {!gmailConnected ? (
                        <button onClick={handleConnectGmail} className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-bold flex items-center gap-2 mx-auto">
                            <Mail size={18} /> Sign in with Google
                        </button>
                    ) : (
                        <button onClick={handleScanGmail} disabled={loading} className="bg-slate-900 text-white px-6 py-3 rounded-lg hover:bg-slate-800 font-bold flex items-center gap-2 mx-auto disabled:opacity-70">
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> {loading ? "Scanning..." : "Scan Now"}
                        </button>
                    )}
                </div>
            </div>
        )}

        {loading && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Loader2 className="animate-spin h-8 w-8 text-emerald-500 mb-2" />
                <p>{progress}</p>
            </div>
        )}

        {/* Statement Info Card */}
        {statementInfo && (
            <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-purple-600 mt-1" />
                <div>
                    <h4 className="font-bold text-purple-900">Bill Detected</h4>
                    <p className="text-sm text-purple-800">
                        We found a <strong>{statementInfo.institution}</strong> bill of <strong>${statementInfo.amountDue}</strong> due on <strong>{statementInfo.dueDate}</strong>.
                    </p>
                    <p className="text-xs text-purple-600 mt-1">This will be added to your bill reminders automatically upon import.</p>
                </div>
            </div>
        )}

        {/* Review Table (For Transactions) */}
        {parsedData.length > 0 && !loading && tab !== 'portfolio' && (
            <div className="mt-8">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Check className="text-emerald-500" size={20} />
                    Review & Import
                </h3>
                <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">Merchant</th>
                                <th className="p-3">Category</th>
                                <th className="p-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {parsedData.map((t, idx) => (
                                <tr key={idx}>
                                    <td className="p-3">{t.date}</td>
                                    <td className="p-3 font-medium">{t.merchant}</td>
                                    <td className="p-3"><span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs">{t.category}</span></td>
                                    <td className="p-3 text-right">${t.amount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 flex justify-end">
                    <button onClick={saveTransactions} className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 font-medium shadow-sm">
                        Confirm Import ({parsedData.length})
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}