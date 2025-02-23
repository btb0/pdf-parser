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
    const pages = pdfData.Pages; // Each page in the PDF
    const tableRows = []; // Stores all the extracted row Data in a JSON object --> each row/object represents one part number.

    const TOLERANCE = 0.1; // Small tolerance value to handle floating-point imprecision. Ex. If one yCoordinate for one of the values on a row is 8.022 vs. 8.023

    // Looping through each page
    pages.forEach(page => {
        let tableStartY; // Stores the Y coordinate for the header row of the table
        let headers = []; // Stores the header names within the table
        let currentRow = []; // Stores the text for the current row being iterated through
        let lastRowY = null; // Stores Y coordinate of the last detected row

        // Looks for "Seq" in the tables headers (at the top left of each packing list) signifying the start of the table
        page.Texts.forEach(text => {
            // Each text object in the extracted JSON has an "R" array, which contains the actual text content --> the text itself, as well as other information such as 
            // style index, font weight etc. "R" stands for runs of text. So forEach run...
            text.R.forEach(run => {
                // Each "run" contains "T" which is the actual text itself. Converting to lowercase and decoding just to limit chances of bugs
                if (decodeURIComponent(run.T).toLowerCase() === "seq") {
                    tableStartY = text.y; // Stores the start position of the table
                }
            });
        });
        console.log("Table starts at y = " , tableStartY);
        
        // Extract Column header names
        page.Texts.forEach(text => {
            if (Math.abs(text.y - tableStartY) < TOLERANCE) { // "If it's the header row" "within +- 0.1"
                text.R.forEach(run => {
                    headers.push(decodeURIComponent(run.T)); // Store column name in "headers" array
                });
            }
        });
        console.log("Header column names: ", headers);

        // Extract Table Row Data
        page.Texts.forEach(text => {
            const textValue = decodeURIComponent(text.R[0].T);
            const yCoord = Math.round(text.y * 100) / 100; // Rounds to 2 decimal places

            // If Text is above header row (before the table starts), return.
            if (text.y <= tableStartY) return;

            // Check if text belongs to a new row (if its a new part number)
            // "If last row = null (if the table hasnt started yet) |OR| If the yCoordinate for the text is larger than the tolerance value (0.1), start a new row"
            if (lastRowY === null || Math.abs(yCoord - lastRowY) > TOLERANCE) {
                // New row(part) detected
                if (currentRow.length > 0) { // If the currentRow variable already has data saved to it (for an old part's row), start a new row for the new part detected
                    // Save the currentRow before starting a new one
                    tableRows.push(currentRow);
                }
                currentRow = []; // Reset currentRow for new row data
                lastRowY = yCoord; // Save previous rows yCoordinate
            }
            
            // TODO: Add case to check if sequence number exits --> so backorder parts are not added

            currentRow.push(textValue); // Save text to the current row
        });

        // Save last row after the loop ends
        if (currentRow.length > 0) {
            tableRows.push(currentRow);
        }
    });

    fs.writeFileSync("rows.json", JSON.stringify(tableRows, null, 2));
    console.log("Table rows saved to rows.json");

    // console.log("raw data ==>", pdfData);
    extractJSON(pdfData);
    extractRawText(pdfData);
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