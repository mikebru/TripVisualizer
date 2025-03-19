# Trip Visualizer

A simple and dynamic web application that allows users to visualize data from Google Sheets in multiple formats: table, calendar, and map views.

## Features

- **Google Sheets Integration**: Load data directly from any Google Sheet by providing its URL
- **Multiple Visualization Options**:
  - **Table View**: See all your data in a clean, sortable table format
  - **Calendar View**: Visualize events with dates in a calendar interface
  - **Map View**: See locations plotted on an interactive map with automatic geocoding

## How to Use

> **Important Note**: Due to security restrictions with the Google Sheets API, this application must be run from a web server rather than directly opening the HTML file.

1. **Start a local web server** using one of the following methods:
   
   **Option 1**: Use the included Node.js server:
   ```
   node server.js
   ```
   Then open `http://localhost:3000` in your browser.
   
   **Option 2**: Use Python's built-in HTTP server:
   ```
   # Python 3
   python -m http.server 8000
   ```
   Then open `http://localhost:8000` in your browser.
   
   **Option 3**: Use any other web server of your choice (Apache, Nginx, etc.)
   
2. **Enter a Google Sheet URL** in the input field at the top of the page
   - The sheet must be publicly accessible or shared with "Anyone with the link can view"
   - The sheet should have headers in the first row
   - For best results, include columns with:
     - A "Name" column for event titles (displayed in calendar and map views)
     - Date information (columns with "date", "start", or "end" in the name)
     - Location information (columns with "location", "place", or "address")
     - Optional: latitude and longitude columns for precise map positioning

3. **Click "Load Data"** to fetch and display the data
4. **Switch between views** using the buttons in the navigation bar

## Map Features

- **Automatic Geocoding**: Location names are automatically converted to map coordinates
- **English Display**: Location names are displayed in English
- **Interactive Markers**: 
  - Hover over markers to see the event name
  - Click on markers to see detailed information
- **Auto-Zoom**: Map automatically zooms to show all markers

## Example Google Sheet

An example Google Sheet is pre-filled in the application:
[https://docs.google.com/spreadsheets/d/1o1mMCHTnh4zUg4S1tzjUFGMnyZji3nU6sa2hAtawNtk/edit?usp=sharing](https://docs.google.com/spreadsheets/d/1o1mMCHTnh4zUg4S1tzjUFGMnyZji3nU6sa2hAtawNtk/edit?usp=sharing)

This sheet contains sample trip data with:
- Destination names
- Start and end dates
- Locations
- Latitude and longitude coordinates

## Technical Details

This application uses:
- CSV export feature of Google Sheets for data retrieval
- FullCalendar for the calendar view
- Leaflet for the map view
- OpenStreetMap Nominatim for geocoding
- Pure JavaScript, HTML, and CSS (no framework dependencies)

## Limitations

- The application currently only loads the first sheet in a Google Sheets document
- Geocoding uses the free OpenStreetMap Nominatim service, which has usage limits
- For heavy usage, consider implementing a more robust geocoding solution

## Privacy Note

This application runs entirely in your browser. No data is sent to any server except Google's servers to retrieve the sheet data and OpenStreetMap's servers for geocoding.
