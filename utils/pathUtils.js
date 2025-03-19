import { map, pathLayer, showPath } from '../main.js';
import { sheetData, headers } from '../main.js';

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
        
        // If we have coordinates, add to our list
        if (!isNaN(lat) && !isNaN(lng)) {
            locationsWithCoords.push({
                date: date,
                latlng: [lat, lng]
            });
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
                    locationsWithCoords.push({
                        date: date,
                        latlng: [markerLatLng.lat, markerLatLng.lng]
                    });
                    break;
                }
            }
        }
    });
    
    // Sort locations by date
    locationsWithCoords.sort((a, b) => a.date - b.date);
    
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
        
        // Draw lines between consecutive points
        for (let i = 0; i < validLocations.length - 1; i++) {
            const from = validLocations[i].latlng;
            const to = validLocations[i + 1].latlng;
            
            // Double-check coordinates before creating the polyline
            if (from && to) {
                
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
                console.error("Invalid coordinates for line:", from, to);
            }
        }
    }
}

export { updateTravelPath, createArrowHead }; 