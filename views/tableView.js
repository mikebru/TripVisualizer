import { headers, sheetData } from '../main.js';
import { showDetailPopup } from '../utils/ui.js';

// Initialize table view
function initTableView() {
    const tableHeader = document.getElementById('table-header');
    const tableBody = document.getElementById('table-body');
    
    // Clear existing content
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';
    
    // Add headers
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        tableHeader.appendChild(th);
    });
    
    // Add data rows
    sheetData.forEach(row => {
        const tr = document.createElement('tr');
        tr.addEventListener('click', () => showDetailPopup(row, headers));
        
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = row[header] || '';
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

export { initTableView }; 