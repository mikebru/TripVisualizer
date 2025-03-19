// Global variables
let sheetData = [];
let headers = [];
let calendar;
let map;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize view buttons
    document.getElementById('table-view-btn').addEventListener('click', () => switchView('table-view'));
    document.getElementById('calendar-view-btn').addEventListener('click', () => switchView('calendar-view'));
    document.getElementById('map-view-btn').addEventListener('click', () => switchView('map-view'));

    // Initialize load button
    document.getElementById('load-sheet').addEventListener('click', loadSheetData);

    // Pre-fill the example sheet URL
    document.getElementById('sheet-url').value = 'https://docs.google.com/spreadsheets/d/1o1mMCHTnh4zUg4S1tzjUFGMnyZji3nU6sa2hAtawNtk/edit?usp=sharing';
});

// Load data from Google Sheet
async function loadSheetData() {
    const sheetUrl = document.getElementById('sheet-url').value.trim();
    
    if (!sheetUrl) {
        showError('Please enter a Google Sheet URL');
        return;
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
        headers = rows[0];
        sheetData = rows.slice(1).map(row => {
            const item = {};
            headers.forEach((header, index) => {
                item[header] = row[index] || '';
            });
            return item;
        });

        // Initialize views with data
        initTableView();
        initCalendarView();
        initMapView();

        // Switch to table view
        switchView('table-view');
        
        console.log('Data loaded successfully', sheetData);
    } catch (error) {
        showError('Error loading sheet data: ' + error.message);
        console.error('Error loading sheet data:', error);
    } finally {
        showLoading(false);
    }
}

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
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = row[header] || '';
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

// Initialize calendar view
function initCalendarView() {
    const calendarEl = document.getElementById('calendar');
    
    // Find date columns (look for columns with 'date', 'start', or 'end' in the name)
    const dateColumns = headers.filter(header => 
        header.toLowerCase().includes('date') || 
        header.toLowerCase().includes('start') || 
        header.toLowerCase().includes('end'));
    
    // Find name column (prioritize exact 'Name' match, then fallback to similar columns)
    const nameColumn = headers.find(header => header === 'Name') || 
                      headers.find(header => 
                          header.toLowerCase() === 'name' || 
                          header.toLowerCase().includes('name') || 
                          header.toLowerCase().includes('title') || 
                          header.toLowerCase().includes('event') || 
                          header.toLowerCase().includes('description')) || 
                      headers[0];
    
    // Find location column
    const locationColumn = headers.find(header => 
        header.toLowerCase().includes('location') || 
        header.toLowerCase().includes('place') || 
        header.toLowerCase().includes('venue')) || '';
    
    // Create calendar events
    const events = [];
    
    sheetData.forEach(row => {
        // Try to find start and end dates
        let startDate = null;
        let endDate = null;
        
        for (const dateCol of dateColumns) {
            const dateValue = row[dateCol];
            if (!dateValue) continue;
            
            const parsedDate = new Date(dateValue);
            if (!isNaN(parsedDate.getTime())) {
                if (!startDate) {
                    startDate = parsedDate;
                } else if (!endDate) {
                    endDate = parsedDate;
                    break;
                }
            }
        }
        
        // If we have at least a start date, create an event
        if (startDate) {
            const event = {
                title: row[nameColumn] || 'Untitled Event',
                start: startDate.toISOString(),
            };
            
            if (endDate) {
                event.end = endDate.toISOString();
            }
            
            if (locationColumn && row[locationColumn]) {
                event.location = row[locationColumn];
                event.extendedProps = { location: row[locationColumn] };
            }
            
            events.push(event);
        }
    });
    
    // Initialize or update calendar
    if (calendar) {
        calendar.removeAllEvents();
        calendar.addEventSource(events);
        
        // Go to the first event date if events exist
        if (events.length > 0) {
            const firstEventDate = new Date(events[0].start);
            calendar.gotoDate(firstEventDate);
        }
    } else {
        // Find initial date (use first event date if available)
        let initialDate = new Date(); // Default to today
        if (events.length > 0) {
            initialDate = new Date(events[0].start);
        }
        
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            initialDate: initialDate,
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,listMonth'
            },
            events: events,
            eventTimeFormat: {
                hour: 'numeric',
                minute: '2-digit',
                meridiem: 'short'
            },
            eventDidMount: function(info) {
                if (info.event.extendedProps.location) {
                    info.el.title = `Location: ${info.event.extendedProps.location}`;
                }
            }
        });
    }
    
    // Render calendar
    calendar.render();
}

// Initialize map view
function initMapView() {
    const mapEl = document.getElementById('map');
    
    // Find location column
    const locationColumn = headers.find(header => 
        header.toLowerCase().includes('location') || 
        header.toLowerCase().includes('place') || 
        header.toLowerCase().includes('address')) || '';
    
    // Find latitude and longitude columns
    const latColumn = headers.find(header => 
        header.toLowerCase().includes('lat') || 
        header.toLowerCase().includes('latitude')) || '';
    
    const lngColumn = headers.find(header => 
        header.toLowerCase().includes('lng') || 
        header.toLowerCase().includes('lon') || 
        header.toLowerCase().includes('longitude')) || '';
    
    // Find name column (prioritize exact 'Name' match, then fallback to similar columns)
    const nameColumn = headers.find(header => header === 'Name') || 
                      headers.find(header => 
                          header.toLowerCase() === 'name' || 
                          header.toLowerCase().includes('name') || 
                          header.toLowerCase().includes('title') || 
                          header.toLowerCase().includes('event') || 
                          header.toLowerCase().includes('description')) || 
                      headers[0];
    
    // Find information column (for additional details)
    const infoColumn = headers.find(header => 
        header.toLowerCase().includes('info') || 
        header.toLowerCase().includes('description') || 
        header.toLowerCase().includes('details')) || '';
    
    // Initialize map if not already created
    if (!map) {
        map = L.map(mapEl).setView([0, 0], 2);
        
        // Use Stamen's terrain tiles which have English labels
       // L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png', {
       //     attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.',
       //     subdomains: 'abcd',
       //     minZoom: 0,
       //     maxZoom: 18
       // }).addTo(map);
        
        // Alternative: Use Carto's Voyager tiles which have English labels
         L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
             attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
         }).addTo(map);
    } else {
        // Clear existing markers
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });
    }
    
    // Add markers for locations
    const markers = [];
    const geocodingPromises = [];
    
    sheetData.forEach((row, index) => {
        let lat = null;
        let lng = null;
        let title = row[nameColumn] || 'Untitled';
        let location = row[locationColumn] || '';
        let info = infoColumn ? row[infoColumn] || '' : '';
        
        // Try to get coordinates from lat/lng columns
        if (latColumn && lngColumn && row[latColumn] && row[lngColumn]) {
            lat = parseFloat(row[latColumn]);
            lng = parseFloat(row[lngColumn]);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                const marker = createMarker(lat, lng, title, location, info);
                markers.push(marker);
            }
        } 
        // If no coordinates but location exists, use geocoding
        else if (location) {
            // Create a promise for geocoding this location
            const promise = geocodeLocation(location, title, info)
                .then(marker => {
                    if (marker) {
                        markers.push(marker);
                    }
                })
                .catch(error => {
                    console.error(`Error geocoding ${location}:`, error);
                });
            
            geocodingPromises.push(promise);
        }
    });
    
    // Wait for all geocoding to complete, then fit bounds
    if (geocodingPromises.length > 0) {
        Promise.all(geocodingPromises).then(() => {
            fitMapToMarkers(markers);
        });
    } else {
        // If we have markers from lat/lng, fit the map immediately
        fitMapToMarkers(markers);
    }
}

// Create a marker with popup and tooltip
function createMarker(lat, lng, title, location, info) {
    const popupContent = `
        <div class="marker-popup">
            <h3>${title}</h3>
            ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
            ${info ? `<p>${info}</p>` : ''}
        </div>
    `;
    
    const marker = L.marker([lat, lng])
        .addTo(map)
        .bindPopup(popupContent)
        .bindTooltip(title, {
            permanent: false,
            direction: 'top',
            opacity: 0.9
        });
    
    return marker;
}

// Geocode a location string to coordinates
async function geocodeLocation(locationStr, title, info) {
    try {
        // For Tokyo International Airport, use hardcoded English name and coordinates
        if (locationStr.includes('Tokyo') || locationStr.includes('Haneda') || locationStr.includes('HND')) {
            console.log('Using hardcoded data for Tokyo International Airport');
            return createMarker(
                35.5494, // Latitude for Haneda Airport
                139.7798, // Longitude for Haneda Airport
                title,
                'Tokyo International Airport (Haneda Airport)', // English name
                info
            );
        }
        
        // For other locations, use Nominatim geocoding
        const encodedLocation = encodeURIComponent(locationStr);
        // Use language parameter for English results
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedLocation}&limit=1&accept-language=en`);
        
        if (!response.ok) {
            throw new Error(`Geocoding failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Geocoding response:', data); // Debug log
        
        if (data && data.length > 0) {
            const result = data[0];
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);
            
            // Extract English name from the display_name
            // Split by commas and take the first part for a cleaner name
            const displayName = result.display_name.split(',')[0] || locationStr;
            
            return createMarker(lat, lng, title, displayName, info);
        }
        
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

// Fit map to show all markers
function fitMapToMarkers(markers) {
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Switch between views
function switchView(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Show selected view
    document.getElementById(viewId).classList.add('active');
    
    // Update active button
    document.querySelectorAll('.view-selector button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Determine which button to activate
    let buttonId;
    switch (viewId) {
        case 'table-view':
            buttonId = 'table-view-btn';
            break;
        case 'calendar-view':
            buttonId = 'calendar-view-btn';
            // Refresh calendar if it exists
            if (calendar) {
                calendar.updateSize();
            }
            break;
        case 'map-view':
            buttonId = 'map-view-btn';
            // Refresh map if it exists
            if (map) {
                map.invalidateSize();
            }
            break;
    }
    
    if (buttonId) {
        document.getElementById(buttonId).classList.add('active');
    }
}

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
