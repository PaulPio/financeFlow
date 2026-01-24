import * as pdfjsLib from 'pdfjs-dist';

// Define the worker src.
// We access .default if available to handle the ESM module structure correctly
// Using cdnjs is more reliable for web workers than esm.sh regarding importScripts and CORS
const lib = (pdfjsLib as any).default || pdfjsLib;

if (lib.GlobalWorkerOptions) {
    lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export const extractTextFromPdf = async (file: File): Promise<string> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        // Use the 'lib' reference which we ensured points to the correct object
        const loadingTask = lib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        
        // Limit to first 5 pages to avoid massive prompts, usually statement summary is on page 1-2
        const maxPages = Math.min(pdf.numPages, 5); 

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
        throw new Error("Failed to read PDF file. Please ensure it is a valid PDF and not password protected.");
    }
};