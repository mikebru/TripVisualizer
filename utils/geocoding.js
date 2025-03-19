import { map } from '../main.js';
import { showDetailPopup } from './ui.js';

// Create a marker with popup and tooltip
function createMarker(lat, lng, title, location, info, rowData, headers) {
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
    
    const marker = L.marker([lat, lng])
        .addTo(map)
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
    
    // Add click handler to show detail popup
    marker.on('click', () => {
        showDetailPopup(rowData, headers);
    });
    
    return marker;
}

// Geocode a location string to coordinates
async function geocodeLocation(locationStr, title, info, rowData, headers) {
    try {
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
        
        // Use improved parameters:
        // - language parameter for English results
        // - countrycodes=jp to prioritize Japanese locations
        // - limit=1 to get the most relevant result
        // - addressdetails=1 to get detailed address information
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedLocation}&limit=1&accept-language=en&countrycodes=jp&addressdetails=1`);
        
        if (!response.ok) {
            throw new Error(`Geocoding failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Geocoding response:', data); // Debug log
        
        if (data && data.length > 0) {
            const result = data[0];
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);
            
            // Store coordinates in the row data for easier path creation
            if (rowData) {
                rowData._geocodedLat = lat;
                rowData._geocodedLng = lng;
            }
            
            // Extract a cleaner display name
            let displayName = locationStr;
            if (result.display_name) {
                // Try to get a cleaner name by using the first part or the name field
                displayName = result.name || result.display_name.split(',')[0] || locationStr;
            }
            
            return createMarker(lat, lng, title, displayName, info, rowData, headers);
        }
        
        // If the first attempt failed, try a more general search
        if (data.length === 0 && !searchQuery.includes('Japan')) {
            console.log('First geocoding attempt failed, trying with more general context...');
            const fallbackQuery = encodeURIComponent(`${locationStr}, Japan`);
            const fallbackResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${fallbackQuery}&limit=1&accept-language=en`);
            
            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                console.log('Fallback geocoding response:', fallbackData);
                
                if (fallbackData && fallbackData.length > 0) {
                    const result = fallbackData[0];
                    const lat = parseFloat(result.lat);
                    const lng = parseFloat(result.lon);
                    
                    // Store coordinates in the row data for easier path creation
                    if (rowData) {
                        rowData._geocodedLat = lat;
                        rowData._geocodedLng = lng;
                    }
                    
                    const displayName = result.name || result.display_name.split(',')[0] || locationStr;
                    
                    return createMarker(lat, lng, title, displayName, info, rowData, headers);
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

export { createMarker, geocodeLocation }; 