import React, { useState, useRef } from 'react';
import { transactionService, authService } from '../services/localStorageService';
import { categorizeTransaction, analyzeReceipt, mapCsvHeaders } from '../services/geminiService';
import { TransactionCategory } from '../types';
import { UploadCloud, Check, AlertCircle, FileText, Camera, Loader2 } from 'lucide-react';

export default function Upload() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [tab, setTab] = useState<'csv' | 'receipt'>('csv');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // --- CSV Logic ---
  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
      setParsedData([]); // Clear previous
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

        // 1. Extract Headers
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        setProgress('Analyzing CSV headers with AI...');
        
        // 2. Map Columns using AI
        const mapping = await mapCsvHeaders(headers);
        console.log("AI Column Mapping:", mapping);

        const transactions = [];

        // 3. Parse Rows using Mapping
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            // Basic CSV split that handles quoted commas would be better, but keeping it simple/robust for now
            // Splitting by comma and cleaning quotes
            const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, '')); 
            
            // Skip if line doesn't have enough columns for the critical data
            const maxIndex = Math.max(mapping.dateIndex, mapping.merchantIndex, mapping.amountIndex);
            if (parts.length <= maxIndex) continue;

            const rawDate = mapping.dateIndex !== -1 ? parts[mapping.dateIndex] : '';
            const merchant = mapping.merchantIndex !== -1 ? parts[mapping.merchantIndex] : 'Unknown';
            // Ensure amount is positive (absolute value) for the app's logic
            let amount = mapping.amountIndex !== -1 ? Math.abs(parseFloat(parts[mapping.amountIndex])) : 0;
            const description = mapping.descriptionIndex !== -1 ? parts[mapping.descriptionIndex] : '';
            const rawCategory = mapping.categoryIndex !== -1 ? parts[mapping.categoryIndex] : '';

            if (isNaN(amount)) continue;

            // Fix Date Issue: Ensure consistent ISO format
            let date = rawDate;
            const parsedDate = new Date(rawDate);
            
            if (!isNaN(parsedDate.getTime())) {
                date = parsedDate.toISOString();
            } else {
                // Attempt to handle common formats like DD/MM/YYYY
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

            // Use CSV category if available and valid
            if (t.rawCategory) {
                // Try to match against existing categories (case insensitive)
                const match = Object.values(TransactionCategory).find(
                    c => c.toLowerCase() === t.rawCategory.toLowerCase()
                );
                if (match) {
                    category = match;
                } else {
                    // If CSV has a category but it doesn't match our Enum, use AI to map it or categorize fresh
                    category = await categorizeTransaction(t.merchant, t.amount, t.rawCategory);
                }
            } else {
                // No category in CSV, use AI
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

  const saveTransactions = async () => {
      const user = authService.getCurrentUser();
      if (!user) return;
      
      setLoading(true);
      await transactionService.addBatch(parsedData.map(t => ({
          ...t,
          userId: user.id
      })));
      setLoading(false);
      alert('Transactions imported successfully!');
      setParsedData([]);
      setCsvFile(null);
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex gap-4 border-b border-gray-200">
          <button 
            className={`pb-3 px-4 font-medium ${tab === 'csv' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500'}`}
            onClick={() => { setTab('csv'); setParsedData([]); }}
          >
              Bulk CSV Import
          </button>
          <button 
            className={`pb-3 px-4 font-medium ${tab === 'receipt' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500'}`}
            onClick={() => { setTab('receipt'); setParsedData([]); }}
          >
              Scan Receipt
          </button>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        
        {/* CSV Mode */}
        {tab === 'csv' && (
            <div className="text-center space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">Upload Transaction CSV</h3>
                    <p className="text-sm text-gray-500">Click to browse or drag file here</p>
                    <p className="text-xs text-gray-400 mt-2">FinFlow AI will automatically detect columns</p>
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept=".csv" 
                        className="hidden" 
                        onChange={handleCsvChange} 
                    />
                </div>
                
                {csvFile && (
                    <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                        <span className="flex items-center gap-2"><FileText size={16} /> {csvFile.name}</span>
                        <button 
                            onClick={processCsv}
                            disabled={loading}
                            className="bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : 'Start AI Import'}
                        </button>
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
                    <p className="text-sm text-gray-500">Gemini will extract details automatically</p>
                    <input 
                        ref={cameraInputRef}
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        className="hidden" 
                        onChange={handleImageUpload} 
                    />
                </div>

                {receiptImage && (
                    <div className="space-y-4">
                        <img src={receiptImage} alt="Receipt Preview" className="max-h-64 mx-auto rounded-lg shadow-md" />
                        <button 
                             onClick={processReceipt}
                             disabled={loading}
                             className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                             {loading ? 'Analyzing...' : 'Analyze Receipt'}
                        </button>
                    </div>
                )}
            </div>
        )}

        {loading && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Loader2 className="animate-spin h-8 w-8 text-emerald-500 mb-2" />
                <p>{progress}</p>
            </div>
        )}

        {/* Review Table */}
        {parsedData.length > 0 && !loading && (
            <div className="mt-8">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Check className="text-emerald-500" size={20} />
                    Review & Import
                </h3>
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">Merchant</th>
                                <th className="p-3">Category (AI)</th>
                                <th className="p-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {parsedData.map((t, idx) => (
                                <tr key={idx}>
                                    <td className="p-3">{new Date(t.date).toLocaleDateString()}</td>
                                    <td className="p-3 font-medium">{t.merchant}</td>
                                    <td className="p-3">
                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs border border-emerald-100">
                                            {t.category}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">${t.amount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 flex justify-end">
                    <button 
                        onClick={saveTransactions}
                        className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 font-medium shadow-sm"
                    >
                        Confirm Import ({parsedData.length})
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}