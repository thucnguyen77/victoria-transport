# victoria-transport

A collection of tools for exploring Victoria's public transport data using the [Transport Victoria Open Data Portal](https://opendata.transport.vic.gov.au).

## Vehicle Position Visualiser

[`vehicle-position-visualiser/index.html`](vehicle-position-visualiser/index.html)

A single-page, browser-based map that plots real-time vehicle positions for Melbourne's public transport network. It fetches live GTFS-RT data from the Transport Victoria API and renders each vehicle as a map marker using [Leaflet.js](https://leafletjs.com), with a resizable side panel listing vehicle details.

**Supported modes:**
- Metro Train
- Yarra Tram
- V/Line
- Metro Bus

**Usage:**
1. Open `index.html` in a browser.
2. Select a transport mode.
3. Enter your Transport Victoria API key.
4. Set a refresh interval and click **Start**.
