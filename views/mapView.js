import { headers, sheetData, map, pathLayer, showPath } from '../main.js';
import { createMarker, geocodeLocation } from '../utils/geocoding.js';
import { updateTravelPath } from '../utils/pathUtils.js';

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
    const visibleData = sheetData;
    
    visibleData.forEach((row, index) => {
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
                const marker = createMarker(lat, lng, title, location, info, row, headers);
                markers.push(marker);
            }
        } 
        // If no coordinates but location exists, use geocoding
        else if (location) {
            // Create a promise for geocoding this location
            const promise = geocodeLocation(location, title, info, row, headers)
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
        Promise.all(geocodingPromises).then(() => {
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
                updateTravelPath();
            }
        });
    } else if (markers.length > 0) {
        // If we have markers from lat/lng, fit the map immediately and draw path if needed
        fitMapToMarkers(markers);
        // Draw travel path if toggle is checked
        if (showPath) {
            updateTravelPath();
        }
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

export { initMapView }; 