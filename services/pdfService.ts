import * as pdfjsLib from 'pdfjs-dist';

// Robust extraction of the library object
const lib = (pdfjsLib as any).default || pdfjsLib;

// Explicitly set worker version to match the imported library version (3.11.174)
// This is critical for pdfjs-dist to work in browser environments without a bundler
const WORKER_VERSION = '3.11.174';
const WORKER_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${WORKER_VERSION}/pdf.worker.min.js`;

try {
    // Check if GlobalWorkerOptions exists before assignment
    if (lib && lib.GlobalWorkerOptions) {
        lib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
    } else {
        console.warn("PDF.js GlobalWorkerOptions not found. Worker might not be configured.");
    }
} catch (e) {
    console.error("Failed to configure PDF worker:", e);
}

export const extractTextFromPdf = async (file: File): Promise<string> => {
    try {
        const arrayBuffer = await file.arrayBuffer();

        // Safety check
        if (!lib || !lib.getDocument) {
            throw new Error("PDF.js library did not load correctly. Please refresh and try again.");
        }

        const loadingTask = lib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 5); // Limit pages for performance

        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            
            fullText += `--- Page ${i} ---\n${pageText}\n\n`;
        }

        return fullText;
    } catch (error) {
        console.error("PDF Extraction Error:", error);
        throw new Error("Failed to read PDF file. It might be password protected or corrupted.");
    }
};