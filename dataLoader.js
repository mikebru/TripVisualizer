import { showLoading, showError } from './utils/ui.js';

// Extract sheet ID from URL
function extractSheetId(url) {
    const match = url.match(/[-\w]{25,}/);
    return match ? match[0] : null;
}

// Parse CSV text into array of arrays
function parseCSV(text) {
    const lines = text.split('\n');
    return lines.map(line => {
        // Handle quoted values with commas inside them
        const result = [];
        let inQuote = false;
        let currentValue = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                result.push(currentValue);
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        
        // Add the last value
        result.push(currentValue);
        return result;
    });
}

// Load data from Google Sheet
async function loadSheetData() {
    const sheetUrl = document.getElementById('sheet-url').value.trim();
    
    if (!sheetUrl) {
        showError('Please enter a Google Sheet URL');
        return null;
    }

    // Show loading indicator
    showLoading(true);
    
    try {
        // Extract sheet ID from URL
        const sheetId = extractSheetId(sheetUrl);
        if (!sheetId) {
            throw new Error('Invalid Google Sheet URL');
        }

        // Create CSV export URL
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        
        // Fetch CSV data
        const response = await fetch(csvUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
        }
        
        const csvText = await response.text();
        if (!csvText) {
            throw new Error('No data found in the sheet');
        }
        
        // Parse CSV data
        const rows = parseCSV(csvText);
        if (rows.length === 0) {
            throw new Error('No data found in the sheet');
        }
        
        // Process the data
        const headers = rows[0];
        const data = rows.slice(1).map(row => {
            const item = {};
            headers.forEach((header, index) => {
                item[header] = row[index] || '';
            });
            return item;
        });
        
        return { headers, data };
    } catch (error) {
        showError('Error loading sheet data: ' + error.message);
        console.error('Error loading sheet data:', error);
        return null;
    } finally {
        showLoading(false);
    }
}

export { loadSheetData }; 