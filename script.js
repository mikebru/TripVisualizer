// Global variables
let sheetData = [];
let headers = [];
let calendar;
let map;
let pathLayer = null;
let showPath = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize view buttons
    document.getElementById('table-view-btn').addEventListener('click', () => switchView('table-view'));
    document.getElementById('calendar-view-btn').addEventListener('click', () => switchView('calendar-view'));
    document.getElementById('map-view-btn').addEventListener('click', () => switchView('map-view'));

    // Initialize load button
    document.getElementById('load-sheet').addEventListener('click', loadSheetData);

    // Initialize path toggle
    const pathToggle = document.getElementById('show-path-toggle');
    if (pathToggle) {
        pathToggle.addEventListener('change', function() {
            showPath = this.checked;
            
            // Simulate a refresh similar to hitting the "Load Data" button
            // This ensures all markers and paths are properly redrawn
            if (showPath) {
                // Clear and redraw the map view
                initMapView();
            } else {
                // Just update the travel path (remove it)
                updateTravelPath();
            }
        });
    }

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
    
    sheetData.forEach((row, index) => {
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
                // Store the row index and all data for the event
                extendedProps: { 
                    rowIndex: index,
                    allData: row,
                    location: row[locationColumn] || ''
                }
            };
            
            if (endDate) {
                event.end = endDate.toISOString();
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
            },
            eventClick: function(info) {
                showDetailPopup(info.event.extendedProps.allData);
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
    
    // Find date column for path ordering
    const dateColumn = headers.find(header => 
        header.toLowerCase() === 'date' || 
        header.toLowerCase().includes('date')) || '';
    
    // Initialize map if not already created
    if (!map) {
        // Start with a more zoomed-in view (zoom level 4 instead of 2)
        map = L.map(mapEl).setView([20, 0], 4);
        
        // Use Carto's Voyager tiles which have English labels
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);
    } else {
        // Clear existing markers and path layer, but preserve the base tile layer
        map.eachLayer(layer => {
            // Only remove marker and path layers, not the base tile layer
            if (!(layer instanceof L.TileLayer)) {
                map.removeLayer(layer);
            }
        });
        
        console.log("Layers after clearing:", map._layers);
        
        // Reset path layer
        pathLayer = null;
        
        // Reset view to ensure proper rendering
        map.invalidateSize();
    }
    
    // Add markers for locations from the table data
    const markers = [];
    const geocodingPromises = [];
    
    // Get visible rows from the table (if we want to filter based on table visibility in the future)
    // For now, we'll use all sheetData
    let visibleData = sheetData;
    
    // Sort data by date if date column exists
    if (dateColumn) {
        visibleData = [...sheetData].sort((a, b) => {
            const dateA = new Date(a[dateColumn]);
            const dateB = new Date(b[dateColumn]);
            
            // Handle invalid dates
            if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
            if (isNaN(dateA.getTime())) return 1;
            if (isNaN(dateB.getTime())) return -1;
            
            return dateA - dateB;
        });
    }
    
    visibleData.forEach((row, index) => {
        let lat = null;
        let lng = null;
        let title = row[nameColumn] || 'Untitled';
        let location = row[locationColumn] || '';
        let info = infoColumn ? row[infoColumn] || '' : '';
        
        // Add the sequence number (index + 1) to the row data
        row._sequenceNumber = index + 1;
        
        // Try to get coordinates from lat/lng columns
        if (latColumn && lngColumn && row[latColumn] && row[lngColumn]) {
            lat = parseFloat(row[latColumn]);
            lng = parseFloat(row[lngColumn]);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                const marker = createMarker(lat, lng, title, location, info, row);
                markers.push(marker);
            }
        } 
        // If no coordinates but location exists, use geocoding
        else if (location) {
            // Create a promise for geocoding this location
            const promise = geocodeLocation(location, title, info, row)
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
    
    // Wait for all geocoding to complete, then fit bounds and draw path if needed
    if (geocodingPromises.length > 0) {
        // Use Promise.allSettled instead of Promise.all to handle both fulfilled and rejected promises
        Promise.allSettled(geocodingPromises).then(() => {
            console.log("All geocoding completed, markers:", markers.length);
            
            // Store marker coordinates in the original data for easier path creation
            visibleData.forEach((row, index) => {
                if (row[locationColumn]) {
                    // Find the marker that corresponds to this location
                    for (const marker of markers) {
                        const popupContent = marker._popup ? marker._popup.getContent() : '';
                        if (popupContent && popupContent.includes(row[locationColumn])) {
                            const latlng = marker.getLatLng();
                            // Store coordinates directly in the row data
                            row._geocodedLat = latlng.lat;
                            row._geocodedLng = latlng.lng;
                            break;
                        }
                    }
                }
            });
            
            fitMapToMarkers(markers);
            // Draw travel path if toggle is checked
            if (showPath) {
                // Use a small timeout to ensure all DOM updates are complete
                setTimeout(() => {
                    updateTravelPath();
                }, 100);
            }
        });
    } else if (markers.length > 0) {
        // If we have markers from lat/lng, fit the map immediately and draw path if needed
        fitMapToMarkers(markers);
        // Draw travel path if toggle is checked
        if (showPath) {
            // Use a small timeout to ensure all DOM updates are complete
            setTimeout(() => {
                updateTravelPath();
            }, 100);
        }
    }
}

// Create a marker with popup and tooltip
function createMarker(lat, lng, title, location, info, rowData) {
    // Create popup content with selected important fields for mobile-friendly display
    let popupContent = `<div class="marker-popup"><h3>${title}</h3>`;
    
    // For mobile-friendly display, show only the most important fields in the popup
    if (rowData) {
        // Determine which fields to show in the popup
        const importantFields = ['Date', 'Location', 'Day Type'];
        
        // Add important fields first
        importantFields.forEach(field => {
            if (rowData[field] && rowData[field].trim() !== '') {
                popupContent += `<p><strong>${field}:</strong> ${rowData[field]}</p>`;
            }
        });
        
        // Add a few more fields that might be important but aren't in the predefined list
        Object.entries(rowData).forEach(([key, value]) => {
            // Skip internal properties (starting with underscore) and ensure value is a string
            if (!importantFields.includes(key) && 
                !key.startsWith('_') && // Skip internal properties like _geocodedLat
                value && typeof value === 'string' && value.trim() !== '' && 
                !key.toLowerCase().includes('notes') && // Skip notes fields which can be long
                popupContent.split('<p>').length < 6) { // Limit to 5 fields total for mobile
                popupContent += `<p><strong>${key}:</strong> ${value}</p>`;
            }
        });
    } else {
        // Fallback to basic info if rowData not provided
        if (location) popupContent += `<p><strong>Location:</strong> ${location}</p>`;
        if (info) popupContent += `<p>${info}</p>`;
    }
    
    popupContent += `</div>`;
    
    // Create a custom icon with the sequence number if available
    let marker;
    
    if (rowData && rowData._sequenceNumber) {
        // Create a custom numbered icon
        const sequenceNumber = rowData._sequenceNumber;
        
        // Create a custom div icon with the sequence number
        const numberedIcon = L.divIcon({
            className: 'numbered-marker',
            html: `<div class="marker-number">${sequenceNumber}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        marker = L.marker([lat, lng], { 
            icon: numberedIcon,
            zIndexOffset: 1000 // Higher z-index to ensure visibility on mobile
        });
    } else {
        // Use default marker if no sequence number
        marker = L.marker([lat, lng], {
            zIndexOffset: 1000 // Higher z-index to ensure visibility on mobile
        });
    }
    
    // Add the marker to the map
    marker.addTo(map)
        .bindPopup(popupContent, {
            maxWidth: 300, // Limit popup width for mobile
            autoPan: true, // Ensure popup is visible when opened
            closeButton: true // Always show close button for mobile
        })
        .bindTooltip(title, {
            permanent: false,
            direction: 'top',
            opacity: 0.9
        });
    
    return marker;
}

// Cache for geocoded locations to avoid duplicate requests
const geocodeCache = {};

// Helper function to add delay between API requests
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Geocode a location string to coordinates
async function geocodeLocation(locationStr, title, info, rowData) {
    try {
        // Check cache first to avoid duplicate requests
        const cacheKey = locationStr.toLowerCase().trim();
        if (geocodeCache[cacheKey]) {
            console.log(`Using cached coordinates for: ${locationStr}`);
            const { lat, lng, displayName } = geocodeCache[cacheKey];
            
            // Store coordinates in the row data for easier path creation
            if (rowData) {
                rowData._geocodedLat = lat;
                rowData._geocodedLng = lng;
            }
            
            return createMarker(lat, lng, title, displayName, info, rowData);
        }
        
        // Improve geocoding by adding context for landmarks and specific locations
        let searchQuery = locationStr;
        
        // If the location appears to be a landmark or specific place (like a museum),
        // add geographic context to improve geocoding accuracy
        if (!searchQuery.toLowerCase().includes('japan') && 
            !searchQuery.toLowerCase().includes('tokyo') && 
            (searchQuery.toLowerCase().includes('museum') || 
             searchQuery.toLowerCase().includes('temple') || 
             searchQuery.toLowerCase().includes('shrine') || 
             searchQuery.toLowerCase().includes('park') || 
             searchQuery.toLowerCase().includes('station'))) {
            // Add "Tokyo, Japan" context for better geocoding results
            searchQuery = `${searchQuery}, Tokyo, Japan`;
            console.log(`Enhanced search query to: ${searchQuery}`);
        }
        
        // For other locations, use Nominatim geocoding with improved parameters
        const encodedLocation = encodeURIComponent(searchQuery);
        
        // Add a delay before making the request to respect rate limits
        // Nominatim has a usage policy of max 1 request per second
        await delay(1100); // Slightly over 1 second to be safe
        
        // Use a CORS proxy to avoid CORS issues
        // We'll use a public CORS proxy service
        const corsProxy = 'https://corsproxy.io/?';
        
        // Use improved parameters:
        // - language parameter for English results
        // - countrycodes=jp to prioritize Japanese locations
        // - limit=1 to get the most relevant result
        // - addressdetails=1 to get detailed address information
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedLocation}&limit=1&accept-language=en&countrycodes=jp&addressdetails=1`;
        const response = await fetch(corsProxy + encodeURIComponent(nominatimUrl), {
            headers: {
                // Add a user agent as requested by Nominatim usage policy
                'User-Agent': 'TripVisualizer/1.0'
            }
        });
        
        if (!response.ok) {
            // Handle rate limiting specifically
            if (response.status === 429) {
                console.warn(`Rate limit exceeded for geocoding: ${locationStr}. Using fallback coordinates.`);
                // Use a fallback approach - for example, use a default location or skip this marker
                // For now, we'll use a slightly offset Tokyo coordinate to at least show something on the map
                const fallbackLat = 35.6762 + (Math.random() * 0.02 - 0.01); // Random offset around Tokyo
                const fallbackLng = 139.6503 + (Math.random() * 0.02 - 0.01);
                
                if (rowData) {
                    rowData._geocodedLat = fallbackLat;
                    rowData._geocodedLng = fallbackLng;
                }
                
                return createMarker(fallbackLat, fallbackLng, title, locationStr + " (approx.)", info, rowData);
            }
            throw new Error(`Geocoding failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            const result = data[0];
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);
            
            // Extract a cleaner display name
            let displayName = locationStr;
            if (result.display_name) {
                // Try to get a cleaner name by using the first part or the name field
                displayName = result.name || result.display_name.split(',')[0] || locationStr;
            }
            
            // Store in cache for future use
            geocodeCache[cacheKey] = { lat, lng, displayName };
            
            // Store coordinates in the row data for easier path creation
            if (rowData) {
                rowData._geocodedLat = lat;
                rowData._geocodedLng = lng;
            }
            
            return createMarker(lat, lng, title, displayName, info, rowData);
        }
        
        // If the first attempt failed, try a more general search
        if (data.length === 0 && !searchQuery.includes('Japan')) {
            console.log('First geocoding attempt failed, trying with more general context...');
            
            // Add another delay before the second request
            await delay(1100);
            
            const fallbackQuery = encodeURIComponent(`${locationStr}, Japan`);
            const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${fallbackQuery}&limit=1&accept-language=en`;
            const fallbackResponse = await fetch(corsProxy + encodeURIComponent(fallbackUrl), {
                headers: {
                    'User-Agent': 'TripVisualizer/1.0'
                }
            });
            
            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                
                if (fallbackData && fallbackData.length > 0) {
                    const result = fallbackData[0];
                    const lat = parseFloat(result.lat);
                    const lng = parseFloat(result.lon);
                    
                    const displayName = result.name || result.display_name.split(',')[0] || locationStr;
                    
                    // Store in cache for future use
                    geocodeCache[cacheKey] = { lat, lng, displayName };
                    
                    // Store coordinates in the row data for easier path creation
                    if (rowData) {
                        rowData._geocodedLat = lat;
                        rowData._geocodedLng = lng;
                    }
                    
                    return createMarker(lat, lng, title, displayName, info, rowData);
                }
            }
        }
        
        // If all geocoding attempts failed, use a fallback approach
        console.warn(`Could not geocode: ${locationStr}. Using fallback coordinates.`);
        // Use a fallback approach with a random position in Japan
        const fallbackLat = 35.6762 + (Math.random() * 0.1 - 0.05);
        const fallbackLng = 139.6503 + (Math.random() * 0.1 - 0.05);
        
        if (rowData) {
            rowData._geocodedLat = fallbackLat;
            rowData._geocodedLng = fallbackLng;
        }
        
        return createMarker(fallbackLat, fallbackLng, title, locationStr + " (approx.)", info, rowData);
        
    } catch (error) {
        console.error('Geocoding error:', error);
        
        // Even on error, provide a fallback marker
        const fallbackLat = 35.6762 + (Math.random() * 0.1 - 0.05); // Random offset around Tokyo
        const fallbackLng = 139.6503 + (Math.random() * 0.1 - 0.05);
        
        if (rowData) {
            rowData._geocodedLat = fallbackLat;
            rowData._geocodedLng = fallbackLng;
        }
        
        return createMarker(fallbackLat, fallbackLng, title, locationStr + " (error)", info, rowData);
    }
}

// Fit map to show all markers with improved zoom for mobile
function fitMapToMarkers(markers) {
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        
        // Check if we're on a mobile device (rough estimate based on screen width)
        const isMobile = window.innerWidth < 768;
        
        // Use appropriate padding based on device
        const padding = isMobile ? 0.02 : 0.05;
        
        // Fit bounds with appropriate padding
        map.fitBounds(group.getBounds().pad(padding));
        
        // If there's only one marker, set a higher zoom level
        if (markers.length === 1) {
            // Get the current zoom and increase it
            // Use a higher zoom level on mobile for better visibility
            const currentZoom = map.getZoom();
            const zoomIncrease = isMobile ? 3 : 2;
            const maxZoom = isMobile ? 16 : 15;
            map.setZoom(Math.min(currentZoom + zoomIncrease, maxZoom));
        }
    }
}

// Switch between views with improved mobile handling
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
                // Use a small timeout to ensure the view is visible first
                setTimeout(() => {
                    calendar.updateSize();
                }, 50);
            }
            break;
        case 'map-view':
            buttonId = 'map-view-btn';
            // Refresh map if it exists
            if (map) {
                // Use a longer timeout for mobile devices to ensure proper rendering
                const isMobile = window.innerWidth < 768;
                const timeoutDelay = isMobile ? 300 : 100; // Longer delay on mobile
                
                setTimeout(() => {
                    // This is crucial for mobile - invalidateSize forces the map to recalculate dimensions
                    map.invalidateSize(true);
                    
                    // If we have markers, make sure they're visible
                    // This ensures the map is properly zoomed when switching to map view
                    if (map._loaded) {
                        // Find all markers on the map
                        const markers = [];
                        map.eachLayer(layer => {
                            if (layer instanceof L.Marker) {
                                markers.push(layer);
                            }
                        });
                        
                        console.log(`Found ${markers.length} markers on map`);
                        
                        // Fit bounds if we have markers
                        if (markers.length > 0) {
                            // Check if we're on a mobile device
                            const padding = isMobile ? 0.02 : 0.05;
                            
                            const group = new L.featureGroup(markers);
                            map.fitBounds(group.getBounds().pad(padding));
                            
                            // On mobile, zoom out slightly to ensure all markers are visible
                            if (isMobile && markers.length > 1) {
                                setTimeout(() => {
                                    const currentZoom = map.getZoom();
                                    map.setZoom(currentZoom - 0.5);
                                }, 100);
                            }
                            
                            // Update travel path if toggle is checked
                            if (showPath) {
                                updateTravelPath();
                            }
                        }
                    }
                }, timeoutDelay); // Delay to ensure the view is fully rendered
            }
            break;
    }
    
    if (buttonId) {
        document.getElementById(buttonId).classList.add('active');
    }
    
    // Scroll to top when switching views (helpful on mobile)
    window.scrollTo(0, 0);
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

// Update the travel path on the map
function updateTravelPath() {
    console.log("updateTravelPath called, showPath =", showPath);
    
    // Remove existing path layer if it exists
    if (pathLayer) {
        console.log("Removing existing path layer");
        
        // Remove zoom event listeners from arrow markers to prevent memory leaks
        pathLayer.eachLayer(layer => {
            if (layer.zoomHandler) {
                map.off('zoomend', layer.zoomHandler);
            }
        });
        
        map.removeLayer(pathLayer);
        pathLayer = null;
    }
    
    // If path toggle is not checked, just return
    if (!showPath) {
        console.log("Path toggle is not checked, returning");
        return;
    }
    
    // Find date column for ordering
    const dateColumn = headers.find(header => 
        header.toLowerCase() === 'date' || 
        header.toLowerCase().includes('date')) || '';
    
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
    
    // If we don't have date or location information, we can't draw a path
    if (!dateColumn || (!locationColumn && (!latColumn || !lngColumn))) {
        console.warn('Cannot draw travel path: missing date or location columns');
        return;
    }
    
    // Get all locations with coordinates and dates
    const locationsWithCoords = [];
    
    // Collect all markers from the map
    const markers = [];
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            markers.push(layer);
        }
    });
    
    console.log(`Found ${markers.length} markers for path drawing`);
    
    // First, create a map of sequence numbers to markers for more reliable matching
    const markersBySequence = {};
    markers.forEach(marker => {
        // Try to extract the sequence number from the marker's icon
        if (marker.options.icon && marker.options.icon.options.html) {
            const html = marker.options.icon.options.html;
            const match = html.match(/<div class="marker-number">(\d+)<\/div>/);
            if (match && match[1]) {
                const sequenceNumber = parseInt(match[1]);
                if (!isNaN(sequenceNumber)) {
                    markersBySequence[sequenceNumber] = marker;
                }
            }
        }
    });
    
    // Match markers with data rows
    sheetData.forEach(row => {
        // Skip rows without date
        if (!row[dateColumn]) return;
        
        const date = new Date(row[dateColumn]);
        if (isNaN(date.getTime())) return; // Skip invalid dates
        
        // Try to find coordinates
        let lat = null;
        let lng = null;
        
        // First try to get coordinates from lat/lng columns
        if (latColumn && lngColumn && row[latColumn] && row[lngColumn]) {
            lat = parseFloat(row[latColumn]);
            lng = parseFloat(row[lngColumn]);
        }
        // Then try to use stored geocoded coordinates
        else if (row._geocodedLat && row._geocodedLng) {
            lat = row._geocodedLat;
            lng = row._geocodedLng;
        }
        // Try to find by sequence number
        else if (row._sequenceNumber && markersBySequence[row._sequenceNumber]) {
            const marker = markersBySequence[row._sequenceNumber];
            const markerLatLng = marker.getLatLng();
            lat = markerLatLng.lat;
            lng = markerLatLng.lng;
        }
        // Otherwise, try to find a marker for this location
        else if (locationColumn && row[locationColumn]) {
            const location = row[locationColumn];
            
            // Find a marker that might match this location
            // This is approximate since we don't have a direct link between markers and data rows
            for (const marker of markers) {
                const markerLatLng = marker.getLatLng();
                
                // Check if the marker's popup contains this location
                // This is a heuristic and might not be 100% accurate
                const popupContent = marker._popup ? marker._popup.getContent() : '';
                if (popupContent && popupContent.includes(location)) {
                    lat = markerLatLng.lat;
                    lng = markerLatLng.lng;
                    break;
                }
            }
        }
        
        // If we have coordinates, add to our list
        if (!isNaN(lat) && !isNaN(lng)) {
            locationsWithCoords.push({
                date: date,
                latlng: [lat, lng],
                sequenceNumber: row._sequenceNumber || 0
            });
        }
    });
    
    // Sort locations by date and then by sequence number as a backup
    locationsWithCoords.sort((a, b) => {
        const dateCompare = a.date - b.date;
        if (dateCompare !== 0) return dateCompare;
        return a.sequenceNumber - b.sequenceNumber;
    });
    
    console.log("Locations with coordinates:", locationsWithCoords);
    
    // If we have at least 2 locations, draw the path
    if (locationsWithCoords.length >= 2) {
        console.log("Drawing path between", locationsWithCoords.length, "locations");
        
        // Validate all locations have valid latlng arrays before proceeding
        const validLocations = locationsWithCoords.filter(loc => 
            loc && loc.latlng && Array.isArray(loc.latlng) && 
            loc.latlng.length >= 2 && 
            !isNaN(loc.latlng[0]) && !isNaN(loc.latlng[1])
        );
        
        console.log("Valid locations for path:", validLocations.length);
        
        if (validLocations.length < 2) {
            console.warn("Not enough valid locations to draw a path");
            return;
        }
        
        // Create a feature group for the path
        pathLayer = L.featureGroup().addTo(map);
        
        // Add markers for each point in the path to ensure all points are visible
        // This is especially important for points at the same location
        validLocations.forEach((loc, index) => {
            // Add a small, semi-transparent circle marker at each point
            // This ensures all points are represented, even if they're at the same location
            const pointMarker = L.circleMarker(loc.latlng, {
                radius: 3,
                fillColor: '#3498db',
                color: '#2980b9',
                weight: 1,
                opacity: 0.7,
                fillOpacity: 0.5,
                interactive: false // Non-interactive to avoid interfering with clicks
            }).addTo(pathLayer);
            
            // Add a label with the sequence number if available
            if (loc.sequenceNumber) {
                // Create a small label with the sequence number
                const labelIcon = L.divIcon({
                    className: 'path-point-label',
                    html: `<div class="path-point-number">${loc.sequenceNumber}</div>`,
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                });
                
                // Add the label marker
                L.marker(loc.latlng, {
                    icon: labelIcon,
                    interactive: false,
                    zIndexOffset: 1000
                }).addTo(pathLayer);
            }
        });
        
        // Draw lines between consecutive points
        for (let i = 0; i < validLocations.length - 1; i++) {
            const from = validLocations[i].latlng;
            const to = validLocations[i + 1].latlng;
            
            // Double-check coordinates before creating the polyline
            if (from && to) {
                // Check if points are at the same location
                const sameLocation = from[0] === to[0] && from[1] === to[1];
                
                if (!sameLocation) {
                    // Create a polyline with dashed line
                    const line = L.polyline([from, to], {
                        color: '#3498db',
                        weight: 3,
                        opacity: 0.7,
                        dashArray: '5, 5'
                    }).addTo(pathLayer);
                    
                    console.log("Added line from", from, "to", to);
                    
                    // Add arrow indicator
                    const arrowHead = createArrowHead(from, to);
                    arrowHead.addTo(pathLayer);
                } else {
                    console.log(`Points ${i+1} and ${i+2} are at the same location:`, from);
                }
            } else {
                console.error("Invalid coordinates for line:", from, to);
            }
        }
    }
}

// Create an arrow head to show direction
function createArrowHead(from, to) {
    // Ensure from and to are valid arrays with at least 2 elements
    if (!from || !to || !Array.isArray(from) || !Array.isArray(to) || from.length < 2 || to.length < 2) {
        console.error("Invalid coordinates for arrow head:", from, to);
        return L.marker([0, 0], { opacity: 0 }); // Return an invisible marker as fallback
    }
    
    // Calculate the midpoint of the line
    const midX = (from[1] + to[1]) / 2;
    const midY = (from[0] + to[0]) / 2;
    
    // Calculate the angle of the line in degrees
    // Note: Leaflet uses [lat, lng] format, so we need to swap the coordinates for angle calculation
    const angle = Math.atan2(to[0] - from[0], to[1] - from[1]) * 180 / Math.PI;
    
    // Create a custom divIcon for the arrow
    const createArrowSvg = (size) => {
        // Calculate the arrow points based on size
        const halfSize = size / 2;
        
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow: visible;">
                <polygon points="0,0 ${size},${halfSize} 0,${size}" 
                         transform="rotate(${angle + 90} ${halfSize} ${halfSize})" 
                         style="fill: #3498db; fill-opacity: 0.9; stroke: #2980b9; stroke-width: 1.5;"/>
               </svg>`;
    };
    
    // Initial size based on current zoom
    const initialZoom = map.getZoom();
    const initialSize = Math.max(16, Math.min(32, initialZoom * 2));
    
    // Create the initial icon
    const arrowIcon = L.divIcon({
        html: createArrowSvg(initialSize),
        className: 'path-arrow',
        iconSize: [initialSize, initialSize],
        iconAnchor: [initialSize/2, initialSize/2]
    });
    
    // Create a marker with the arrow icon at the midpoint
    const arrowMarker = L.marker([midY, midX], {
        icon: arrowIcon,
        interactive: false, // Make it non-interactive so it doesn't interfere with clicks
        zIndexOffset: 1000 // Ensure arrows are displayed above the path lines
    });
    
    // Store the angle for later use
    arrowMarker.options.angle = angle;
    
    // Add event listener to update all arrows on zoom
    const zoomHandler = function() {
        const zoom = map.getZoom();
        // Scale arrow size based on zoom level
        const size = Math.max(16, Math.min(32, zoom * 2));
        
        // Update the icon with new size
        const newIcon = L.divIcon({
            html: createArrowSvg(size),
            className: 'path-arrow',
            iconSize: [size, size],
            iconAnchor: [size/2, size/2]
        });
        
        arrowMarker.setIcon(newIcon);
    };
    
    // Store the handler reference so we can remove it later if needed
    arrowMarker.zoomHandler = zoomHandler;
    map.on('zoomend', zoomHandler);
    
    return arrowMarker;
}

// Show detailed popup with all information from a row
function showDetailPopup(rowData) {
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
