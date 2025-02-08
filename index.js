// node.js module for file system operations
const fs = require ("fs");
// pdf parsing library - extracting text
// const parse = require ("pdf-parse");  MAY NOT NEED ANYMORE

// pdf parsing library *but* it works better with structured data - ie. tables in the packing list
import PDFParser from "pdf2json";

const pdfParser = new PDFParser();

// TEST PDF PATH
const testPdf = 'TESTPACKINGLIST.pdf';

async function extractPartNumbers() {
    try {
        // Read PDF file as binary buffer
        const pdf = fs.readFileSync(testPdf);

        // Extract text from the PDF
        const data = await parse(pdf);

        console.log(data);


    } catch (error) {
        // Missing files or error reading the pdf
        console.error("Error reading PDF:", error)
    }
}

extractPartNumbers();