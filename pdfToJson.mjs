import fs from "fs";
import PDFParser from "pdf2json";
const pdfParser = new PDFParser();

// TEST PDF PATH
const testPdf = 'TESTPACKINGLIST.pdf';

pdfParser.on("pdfParser_dataError", (errData) =>
    console.error("Error parsing PDF: ", errData.parserError)
);
// on("pdfParser_dataReady") is called when the parser finishes parsing the PDF
pdfParser.on("pdfParser_dataReady", (pdfData) => {
    
    console.log("raw data ==>", pdfData);
    extractJSON(pdfData);
    extractRawText(pdfData);
    extractFieldTypes(pdfData);
});

pdfParser.loadPDF(testPdf);

// Extracting text manually
function extractRawText(pdfData) {
    const textArray = pdfData.Pages.flatMap(page =>
        page.Texts.map(textItem => decodeURIComponent(textItem.R[0].T))
    );
    
    const textContent = textArray.join(" ");
    fs.writeFileSync("output.txt", textContent, "utf8");
    console.log("Extracted text saved to a .txt file");
}

// Save full JSON for debugging purposes
function extractJSON(pdfData) {
    fs.writeFileSync("debug.json", JSON.stringify(pdfData, null, 2));
    console.log("JSON saved for debugging");
}

function extractFieldTypes(pdfData) {
    // not working
    fs.writeFileSync("fields.json", JSON.stringify(pdfParser.getAllFieldsTypes()), () => {
        console.log("Field types saved to fields.json");
    });
}
