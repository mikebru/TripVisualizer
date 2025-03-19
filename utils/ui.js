// Show/hide loading indicator
function showLoading(show) {
    const views = document.querySelectorAll('.view');
    
    if (show) {
        views.forEach(view => {
            view.classList.add('loading');
        });
    } else {
        views.forEach(view => {
            view.classList.remove('loading');
        });
    }
}

// Show error message
function showError(message) {
    // Remove any existing error messages
    const existingErrors = document.querySelectorAll('.error-message');
    existingErrors.forEach(el => el.remove());
    
    // Create and show new error message
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.textContent = message;
    
    // Insert after header
    const header = document.querySelector('header');
    header.parentNode.insertBefore(errorEl, header.nextSibling);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorEl.remove();
    }, 5000);
}

// Show detailed popup with all information from a row
function showDetailPopup(rowData, headers) {
    // Remove any existing detail popups
    const existingPopups = document.querySelectorAll('.detail-popup-overlay');
    existingPopups.forEach(el => el.remove());
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'detail-popup-overlay';
    
    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'detail-popup';
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'detail-popup-close';
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', () => {
        overlay.remove();
    });
    
    // Create title
    const title = document.createElement('h2');
    const nameColumn = headers.find(header => header === 'Name') || 
                      headers.find(header => 
                          header.toLowerCase() === 'name' || 
                          header.toLowerCase().includes('name') || 
                          header.toLowerCase().includes('title')) || 
                      headers[0];
    title.textContent = rowData[nameColumn] || 'Details';
    
    // Create content
    const content = document.createElement('div');
    content.className = 'detail-popup-content';
    
    // Add all fields from the row data
    Object.entries(rowData).forEach(([key, value]) => {
        // Skip internal properties (starting with underscore)
        if (!key.startsWith('_') && value) {
            // Convert value to string if it's not already
            const stringValue = typeof value === 'string' ? value : String(value);
            
            if (stringValue.trim() !== '') {
                const field = document.createElement('div');
                field.className = 'detail-field';
                
                const label = document.createElement('strong');
                label.textContent = key + ': ';
                
                const valueEl = document.createElement('span');
                valueEl.textContent = stringValue;
                
                field.appendChild(label);
                field.appendChild(valueEl);
                content.appendChild(field);
            }
        }
    });
    
    // Assemble popup
    popup.appendChild(closeButton);
    popup.appendChild(title);
    popup.appendChild(content);
    overlay.appendChild(popup);
    
    // Add to document
    document.body.appendChild(overlay);
    
    // Add event listener to close when clicking outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

export { showLoading, showError, showDetailPopup }; 