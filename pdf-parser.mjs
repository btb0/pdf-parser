// Refactor of pdfToJson.mjs using javascript classes.
// Chose to go with a JavaScript class to encapsulate all the logic/configurations in one place. Also makes it more reusable and easier to maintain.

import fs from "fs";
import PDFParser from "pdf2json";

class PackingListParser {
    constructor() {
        // this.pdfParser = new PDFParser();  CURRENTLY COMMENTED OUT AS THE PDF PARSER INSTANCE IS BEING CREATED IN THE parsePdf METHOD INSTEAD
        this.TOLERANCE = 0.1; // Small tolerance value to handle floating-point imprecision. Ex. If one yCoordinate for one of the values on a row is 8.022 vs. 8.023

        // Each header (column) for every part
        this.EXPECTED_HEADERS = [
            'Seq', 'Part No', 'Part Desc', 'Qty', 'Case No', 
            'Order No', 'Ref Order#', 'Car Rental', 'Remark', 'VIN #'
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
                    tableStartY = text.y; // Stores the start position of the table
                }
            });
        });

        return tableStartY;
    }

    // Method for finding and organizing table column headers. Looks for all text elements on the same Y coordinate as the table start
    getHeaders(page, tableStartY) {
        const headers = []; // Stores the header names within the table

        page.Texts.forEach(text => {
            // Check if text is in the header row by checking if the Y posistion is within +- 0.1
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

    // Extract Table Row Data
    async getRows(page, tableStartY, headers) {
        const tableRows = []; // Stores each row in an array as JavaScript objects. One object = one part
        let currentRow = {}; // Stores the text for the current row being iterated through
        let lastRowY = null; // Stores Y coordinate for the last detected row
        
        // Sort all text elements by top to bottom and then within each row left to right
        const sortedTexts = page.Texts.sort((a, b) => {
            // Rounds y position to 2 decimal places
            const aY = Math.round(a.y * 100) / 100;
            const bY = Math.round(b.y * 100) / 100;

            // Check if text is on different rows / y coordinates. (if the difference is greater than the tolerance value)
            if (Math.abs(aY - bY) > this.TOLERANCE) {
                // New row detected. Sort by Y coordinate
                return aY - bY;
            } else {
                // Both texts are on the same row for the same part. so sort by X coordinate
                return a.x - b.x;
            }
        });

        console.log('header positions:')
        headers.forEach(header => console.log(`${header.text}: ${header.xPos}`))

        // Process each sorted text element
        for (const text of sortedTexts) {
            // If text is above header row (before the table starts), skip to the next text element
            if (text.y <= tableStartY) continue;

            const textValue = decodeURIComponent(text.R[0].T);
            // Round to two decimal places
            const yPos = Math.round(text.y * 100) / 100;

            //TODO : DELETE THESE FEW ROWS FOR DEBUGGING PURPOSES
            const xPos = text.x;
            console.log(`Text: ${textValue}: xPos=${xPos} -- yPos=${yPos}`)

            // Check if text belongs to a new row (if it is a new part number)
            // "If last row = null (if the table has not started yet) |OR| if the yCoordinate difference is larger than the tolerance value, start a new row"
            if (lastRowY === null || Math.abs(yPos - lastRowY) > this.TOLERANCE) {
                // If currentRow already has data saved to it, start a new row for the new part detected
                if (Object.keys(currentRow).length > 0) {
                    // Save the row before starting a new one
                    // Spread operator is used to essentially create a copy as otherwise it would store a reference that would be overwritten each time the loop iterates.
                    tableRows.push({...currentRow});
                }
                currentRow = {}; // Reset currentRow for new row data
                lastRowY = yPos; // Save previous row's Y position/coordinate
            }

            // Check which column / header the text belongs to by finding the closest header based on the X coordinate
            let closestHeader = null;
            let minDistance = Infinity; // Start with Infinity so that the first calculated distance is always smaller which ensures that minDistance is always updated on the first iteration

            // Loop through each header to compare it's x position with the text's X position. For each header in the headers array..
            for (const header of headers) {
                // Distance = absolute difference (value remaining after subtracting) of the text's X position minus the header's X position
                const distance = Math.abs(text.x - header.xPos);
                // If the distance is less than the last saved distance...
                if (distance < minDistance) {
                    minDistance = distance; // Update minDistance to the new smallest distance
                    closestHeader = header; // Save the current header as the closest one to this text being iterated through in sortedTexts
                }
            }

            // If a matching header is found...
            if (closestHeader) {
                // Using bracket notation, store the text content in the currentRow Object using the header text as the key, and the text as the key.
                currentRow[closestHeader.text] = textValue;
            }
        }

        // Save the last row after the loop ends
        if (Object.keys(currentRow).length > 0) {
            tableRows.push({...currentRow});
        }

        // Return processed/parsed rows
        return tableRows;
    }

    // Main PDF Parsing method
    // jsonOutputPath being initialized to null to make saving to a file optional.
    parsePDF(filePathPdf, jsonOutputPath = null) {
        return new Promise((resolve, reject) => {
            // Create a new parser instance for each operation to avoid event handler conflicts
            const parser = new PDFParser();

            // Error --> Parsing Failed
            parser.on('pdfParser_dataError', errData => {
                console.error('Error parsing PDF: ', errData.parserError);
                reject(errData.parserError);
            });

            // Successfully Parsed PDF!
            parser.on('pdfParser_dataReady', async pdfData => {
                try {
                    // Process the parsed data
                    const allParts = await this.processParsedData(pdfData);

                    // Todo: Maybe delete
                    // Save results to provided output path
                    if (jsonOutputPath) {
                        this.saveData(allParts, jsonOutputPath);
                    }

                    // Resolve the promise with the parsed data
                    resolve(allParts);

                } catch (err) {
                    console.error("Error processing PDF data", err);
                    reject(err);
                }
            });

            // Start parsing
            console.log(`PARSING: ${filePathPdf}`);
            parser.loadPDF(filePathPdf);
        });
    }

    // Process Parsed PDF data
    async processParsedData(pdfData) {
        console.log('PDF Parsed Successfully!!');
        const allParts = []; // Stores every parsed part (each row is a part saved to a JS Object)

        // Process Every Page in Packing List
        for (let i = 0; i < pdfData.Pages.length; i++) {
            console.log(`Currently processing page ${i + 1}/${pdfData.Pages.length}`);
            const page = pdfData.Pages[i]; // current page being iterated through

            // Find where table starts on page / if table exists
            const tableStartY = this.findTableStart(page);

            // If table does not exist on page
            if (tableStartY === null) {
                console.warn(`No table found on page ${i + 1}. Skipping to next page.`);
                continue;
            }

            // Get & Validate Headers
            const headers = this.getHeaders(page, tableStartY);
            try {
                this.validateHeaders(headers);
            } catch (err) {
                console.warn(`Header validation failed on page ${i + 1}: ${err.message}`);
                continue; // Todo : fix this / handle this error better
            }

            // Parse rows on the current page
            const parts = await this.getRows(page, tableStartY, headers);
            // Add parts from this page to the overall collection of all parts
            allParts.push(...parts);
            
            console.log(`Found ${parts.length} parts on page ${i + 1}`);
        }

        // Return all processed parts data
        return this.validateFormatting(allParts);
    }

    // Validate each part object -> Make sure all part Objects have the same 
    // TODO: Review
    validateFormatting(allParts) {
        return allParts.map(part => {
            // Create a new object with all EXPECTED_FIELDS initialized as empty strings for their values
            const partFormat = {};
            // Inititalize all EXPECTED_FIELDS to ensure consistency in the structure
            this.EXPECTED_HEADERS.forEach(header => {
                partFormat[header] = '';
            });
            // console.log(this.EXPECTED_HEADERS);
            // console.log(partFormat);

            // Copy over the actual existing values using bracket notation
            Object.keys(part).forEach(key => {
                partFormat[key] = part[key];
            });

            return partFormat;
        });
    }

    // Save the parsed results to a JSON file
    saveData(allParts, jsonOutputPath) {
        try {
            // Write to file
            fs.writeFileSync(jsonOutputPath, JSON.stringify(allParts, null, 2));
            console.log(`Successfully saved ${allParts.length} parts to ${jsonOutputPath}!`);
        } catch (err) {
            console.error('Error saving results', err);
            throw err;
        }
    }
}

async function main() {
    const parser = new PackingListParser();
    await parser.parsePDF('TESTPACKINGLIST.pdf', 'testytest.json');
}

main().catch(console.error);