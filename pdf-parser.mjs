// Refactor of pdfToJson.mjs using javascript classes.
// Chose to go with a JavaScript class to encapsulate all the logic/configurations in one place. Also makes it more reusable and easier to maintain.

import fs from "fs";
import PDFParser from "pdf2json";

class PackingListParser {
    constructor() {
        this.pdfParser = new PDFParser();
        this.TOLERANCE = 0.1; // Small tolerance value to handle floating-point imprecision. Ex. If one yCoordinate for one of the values on a row is 8.022 vs. 8.023

        // Each header (column) for every part
        this.EXPECTED_HEADERS = [
            'Seq', 'Part No', 'Part Desc', 'Qty', 'Case No', 
            'Order No', 'Ref Order#', 'Car Rental', 'Remark', 'Vin #'
        ];
    }

    // Method to find the table within the PDF
    findTableStart(page) {
        let tableStartY = null; // Stores the y Coordinate for the header row of the table

        // Looks for "Seq" in the table's headers signifying the start of the table. (Seq is the name of the first header in every packing list)
        page.Texts.forEach(text => {
            // Each text object in the extract JSON has an "R" array, which contains the actual text content --> the text itself, as well as other information such as the style index, font weight etc. "R" stats for runs of text. So forEach run...
            text.R.forEach(run => {
                // Each "run" contains "T" which is the actual text itself. Converting to lowercase and decoding just to limit the chances of bugs.
                const textContent = decodeURIComponent(run.T).toLowerCase();
                if (textContent === 'seq') {
                    tableStartY = text.y; // Stores teh start position of the table
                }
            });
        });

        return tableStartY;
    }

    // Method for finding and organizing table column headers. Looks for all text elements on the same Y coordinate as the table start
    getHeaders(page, tableStartY) {
        const headers = []; // Stores teh header names within the table

        page.Texts.forEach(text => {
            // Check if text is within the header row within +- 0.1
            if (Math.abs(text.y - tableStartY) < this.TOLERANCE) {
                // Stores each columns name and xPosition
                headers.push({
                    text: decodeURIComponent(text.R[0].T),
                    xPos: text.x
                });
            }
        });

        // Sort the headers based on the xPosition from left to right (smallest xcoordinate to biggest)
        return headers.sort((a, b) => a.xPos - b.xPos);
    }

    // Method to verify all expected headers are present.
    validateHeaders(headers) {
        // Extracts only the text, not the xPos. Creates a new array called headerTexts only storing the text
        const headerTexts = headers.map(header => header.text);
        // Looks for any missing expected headers
        const missingHeaders = this.EXPECTED_HEADERS.filter(
            expected => !headerTexts.includes(expected)
        );

        // If there is a missing header...
        if (missingHeaders.length > 0) {
            // Stops program and prints error message stating which headers are missing
            throw new Error(`Missing expected headers: ${missingHeaders.join(', ')}`);
        }

        // There are no missing headers. Every EXPECTED_HEADER is present in the headerTexts array.
        return true;
    }
}