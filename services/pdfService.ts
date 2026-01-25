import * as pdfjsLib from 'pdfjs-dist';

// Robust extraction of the library object
const lib = (pdfjsLib as any).default || pdfjsLib;

// Explicitly set worker version to match the imported library version (3.11.174)
const WORKER_VERSION = '3.11.174';
const WORKER_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${WORKER_VERSION}/pdf.worker.min.js`;

try {
    // Check if GlobalWorkerOptions exists before assignment
    if (lib && lib.GlobalWorkerOptions) {
        lib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
        console.log("[PDF Service] Worker configured:", WORKER_SRC);
    } else {
        console.warn("[PDF Service] GlobalWorkerOptions not found. Worker might not be configured.");
    }
} catch (e) {
    console.error("[PDF Service] Failed to configure PDF worker:", e);
}

export const extractTextFromPdf = async (file: File): Promise<string> => {
    console.log("[PDF Service] Starting extraction for file:", file.name, "Size:", file.size);
    try {
        const arrayBuffer = await file.arrayBuffer();
        console.log("[PDF Service] ArrayBuffer loaded, bytes:", arrayBuffer.byteLength);

        // Safety check
        if (!lib || !lib.getDocument) {
            console.error("[PDF Service] Library check failed:", { libKeys: Object.keys(lib || {}) });
            throw new Error("PDF.js library did not load correctly. Please refresh and try again.");
        }

        const loadingTask = lib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        console.log("[PDF Service] PDF Loaded. Pages:", pdf.numPages);

        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 5); // Limit pages for performance

        for (let i = 1; i <= maxPages; i++) {
            console.log(`[PDF Service] Processing page ${i}...`);
            const page = await pdf.getPage(i);
            
            // 1. Extract Standard Text Content
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            
            // 2. Extract Form Data (Annotations)
            // Critical for "Fillable" PDFs/Templates where data is in fields, not text
            let formText = '';
            try {
                const annotations = await page.getAnnotations();
                if (annotations && annotations.length > 0) {
                    console.log(`[PDF Service] Page ${i} has ${annotations.length} annotations/fields.`);
                    formText = annotations
                        .map((ann: any) => {
                            // Check for field value (user input) or button value
                            const val = ann.fieldValue || ann.buttonValue;
                            return (typeof val === 'string' || typeof val === 'number') ? String(val) : '';
                        })
                        .filter((val: string) => val.trim().length > 0)
                        .join(' | '); // Use pipe separator to help AI distinguish fields
                    
                    if (formText) {
                        formText = `\n--- FORM DATA (Page ${i}) ---\n${formText}`;
                    }
                }
            } catch (annError) {
                console.warn(`[PDF Service] Failed to extract annotations for page ${i}`, annError);
            }
            
            fullText += `--- Page ${i} ---\n${pageText}\n${formText}\n\n`;
        }

        console.log("[PDF Service] Extraction complete. Total Length:", fullText.length);
        
        // Debug: Log a snippet to see if numbers are there
        console.log("[PDF Service] Snippet:", fullText.substring(0, 500));

        if (fullText.length < 50) console.warn("[PDF Service] Warning: Extracted text is very short.");
        
        return fullText;
    } catch (error) {
        console.error("[PDF Service] PDF Extraction Error:", error);
        throw new Error("Failed to read PDF file. It might be password protected or corrupted.");
    }
};