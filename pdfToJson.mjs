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
    const rawText = pdfParser.getRawTextContent();
    console.log(pdfData);

    // Save full JSON for debugging purposes
    fs.writeFileSync("debug.json", JSON.stringify(pdfData, null, 2));
    console.log('JSON Saved for Debugging');

    // Extracting text manually
    const textArray = pdfData.Pages.flatMap(page =>
        page.Texts.map(textItem => decodeURIComponent(textItem.R[0].T))
    );

    const textContent = textArray.join(" ");
    console.log("Extracted Text: ", textContent);
    fs.writeFileSync("output.txt", textContent, "utf8");
    console.log("Manually extracted text saved to a txt file");

});

pdfParser.loadPDF(testPdf);
