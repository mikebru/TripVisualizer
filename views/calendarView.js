import { headers, sheetData, setCalendar } from '../main.js';
import { showDetailPopup } from '../utils/ui.js';

// Initialize calendar view
function initCalendarView() {
    const calendarEl = document.getElementById('calendar');
    
    // Find date columns
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
    const events = sheetData.map(row => {
        // Try to find start and end dates
        let startDate = null;
        let endDate = null;
        
        if (dateColumns.length >= 2) {
            // If we have multiple date columns, use the first two
            startDate = new Date(row[dateColumns[0]]);
            endDate = new Date(row[dateColumns[1]]);
        } else if (dateColumns.length === 1) {
            // If we only have one date column, use it for both start and end
            startDate = new Date(row[dateColumns[0]]);
            endDate = new Date(row[dateColumns[0]]);
        }
        
        // If no valid dates found, skip this event
        if (!startDate || isNaN(startDate.getTime())) {
            return null;
        }
        
        // Create event object
        const event = {
            title: row[nameColumn] || 'Untitled',
            start: startDate,
            end: endDate || startDate,
            extendedProps: {
                location: row[locationColumn] || '',
                rowData: row
            }
        };
        
        return event;
    }).filter(event => event !== null);
    
    // Initialize or update calendar
    const calendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        initialDate: events.length > 0 ? events[0].start : new Date(),
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: events,
        eventClick: function(info) {
            showDetailPopup(info.event.extendedProps.rowData, headers);
        },
        eventDidMount: function(info) {
            // Add tooltip with location
            if (info.event.extendedProps.location) {
                info.el.title = info.event.extendedProps.location;
            }
        }
    });
    
    // Store calendar instance
    setCalendar(calendarInstance);
    
    // Render calendar
    calendarInstance.render();
}

export { initCalendarView }; 