// Main entry point for the application
import { loadSheetData } from './dataLoader.js';
import { initTableView } from './views/tableView.js';
import { initCalendarView } from './views/calendarView.js';
import { initMapView } from './views/mapView.js';
import { showLoading, showError } from './utils/ui.js';
import { updateTravelPath } from './utils/pathUtils.js';

// Global variables
let sheetData = [];
let headers = [];
let calendar = null;
let map = null;
let pathLayer = null;
let showPath = false;

// Function to set the calendar instance
function setCalendar(calendarInstance) {
    calendar = calendarInstance;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Set up view buttons
    const viewButtons = document.querySelectorAll('.view-selector button');
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            const view = button.id.replace('-btn', '');
            switchView(view);
        });
    });

    // Set up load button
    const loadButton = document.getElementById('load-sheet');
    loadButton.addEventListener('click', async () => {
        const result = await loadSheetData();
        if (result) {
            // Update global data
            headers = result.headers;
            sheetData = result.data;
            
            // Initialize views with data
            initTableView();
            initCalendarView();
            initMapView();

            // Switch to table view
            switchView('table');
            
            console.log('Data loaded successfully', sheetData);
        }
    });

    // Set up path toggle
    const pathToggle = document.getElementById('show-path-toggle');
    pathToggle.addEventListener('change', (e) => {
        showPath = e.target.checked;
        if (map) {
            updateTravelPath();
        }
    });

    // Pre-fill the example sheet URL
    document.getElementById('sheet-url').value = 'https://docs.google.com/spreadsheets/d/1o1mMCHTnh4zUg4S1tzjUFGMnyZji3nU6sa2hAtawNtk/edit?usp=sharing';
});

// Switch between different views
function switchView(view) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Show selected view
    document.getElementById(`${view}-view`).classList.add('active');
    
    // Update active button
    document.querySelectorAll('.view-selector button').forEach(btn => {
        btn.classList.toggle('active', btn.id === `${view}-btn`);
    });

    // Handle view-specific updates
    switch (view) {
        case 'calendar':
            // Refresh calendar if it exists
            if (calendar) {
                setTimeout(() => {
                    calendar.updateSize();
                }, 50);
            }
            break;
        case 'map':
            // Refresh map if it exists
            if (map) {
                setTimeout(() => {
                    map.invalidateSize(true);
                    
                    if (map._loaded) {
                        const markers = [];
                        map.eachLayer(layer => {
                            if (layer instanceof L.Marker) {
                                markers.push(layer);
                            }
                        });
                        
                        if (markers.length > 0) {
                            const isMobile = window.innerWidth < 768;
                            const padding = isMobile ? 0.02 : 0.05;
                            
                            const group = new L.featureGroup(markers);
                            map.fitBounds(group.getBounds().pad(padding));
                            
                            if (showPath) {
                                updateTravelPath();
                            }
                        }
                    }
                }, 100);
            }
            break;
    }
    
    // Scroll to top when switching views
    window.scrollTo(0, 0);
}

// Export necessary variables and functions
export { sheetData, headers, calendar, map, pathLayer, showPath, switchView, setCalendar }; 