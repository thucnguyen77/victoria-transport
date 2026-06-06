
const map = L.map('map', {
    zoomSnap: 0.25
}
).setView([-37.814, 144.963], 13); // Melbourne CBD coordinates

const tiles = L.tileLayer('https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const LeafIcon = L.Icon.extend({
    options: {
        iconSize: [16, 16]
    }
});

function getIconUrl(mode) {
    switch (mode) {
        case 'prod': return 'img/Melbourne_tram_logo.svg';
        case 'test': return 'img/Melbourne_tram_logo_test.svg';
        default: return '';
    }
}

function forEachFeature(feature, layer) {
    var popupContent = `<b>${feature.properties.vehicleId}</b><br>Trip ID: ${feature.properties.tripId}<br>Start time: ${feature.properties.startTime}<br>Timestamp: ${feature.properties.timestamp}
    ${feature.properties.gtfsRoute ? '<br>Route: ' + feature.properties.gtfsRoute?.route_long_name + ' (' + feature.properties.gtfsRoute?.route_short_name + ')' : ''}${feature.properties.gtfsRoute ?
            '<br>Headsign: ' + feature.properties.gtfsTrip?.trip_headsign +
            '<br>Direction ID: ' + feature.properties.gtfsTrip?.direction_id : ''}`;
    layer.bindPopup(popupContent, { autoClose: false });
};

var geojsonTram = L.geoJSON(null, {
    onEachFeature: forEachFeature,
    pointToLayer: function (feature, latlng) {
        const vehicleIcon = new LeafIcon({ iconUrl: getIconUrl('prod') });
        return L.marker(latlng, { icon: vehicleIcon });
    }
});

var geojsonTest = L.geoJSON(null, {
    onEachFeature: forEachFeature,
    pointToLayer: function (feature, latlng) {
        const vehicleIcon = new LeafIcon({ iconUrl: getIconUrl('test') });
        return L.marker(latlng, { icon: vehicleIcon });
    }
});

function forEachShapeFeature(feature, layer) {
    var popupContent = '<h1><b>' + feature.properties.gtfsRoute?.route_short_name + ': ' + feature.properties.gtfsRoute.route_long_name + '</b></h1>' +
        '<br> ' + feature.properties.shapeId;
    layer.bindPopup(popupContent);
};

function featureStyle(feature) {
    return {
        color: (feature.properties.gtfsRoute?.route_color) ? '#' + feature.properties.gtfsRoute.route_color : '#3388ff',
    };
}

var geojsonShape = L.geoJSON(null, {
    onEachFeature: forEachShapeFeature,
    style: featureStyle
});

// Convert an array of GTFS objects to GeoJSON "Features" array (https://tools.ietf.org/html/rfc7946#section-3.2)
const gtfsArrayToGeojsonFeatures = (gtfsArray) => {
    return gtfsArray
        .sort((a, b) => a.vehicle.timestamp - b.vehicle.timestamp)
        .map((gtfsObject) => {
            // console.log("gtfsObject", gtfsObject);
            const gtfsTrip = gtfsTrips.find(t => t.trip_id === gtfsObject.vehicle.trip.trip_id);
            if (gtfsTrip) {
                console.log("GTFS trip found for trip_id:", gtfsObject.vehicle.trip.trip_id);
            }
            return {
                type: "Feature",
                properties: {
                    // Depending on your data source, the properties available on "gtfsObject" may be different:
                    vehicleId: (gtfsObject.vehicle.vehicle ? gtfsObject.vehicle.vehicle.id + (gtfsObject.vehicle.vehicle.label ? ' (' + gtfsObject.vehicle.vehicle.label + ')' : '') : ''),
                    tripId: gtfsObject.vehicle.trip ? gtfsObject.vehicle.trip.trip_id : '',
                    startTime: gtfsObject.vehicle.trip ? gtfsObject.vehicle.trip.start_time : '',
                    vehicle: gtfsObject.vehicle.vehicle,
                    timestamp: new Date(gtfsObject.vehicle.timestamp * 1000).toLocaleString(),
                    gtfsTrip: gtfsTrip,
                    gtfsRoute: gtfsRoutes.find(r => r.route_id === gtfsTrip?.route_id)
                    //gtfsShape: gtfsShapes.find(s => s.shape_id === gtfsTrip?.shape_id)
                },
                geometry: {
                    type: "Point",
                    coordinates: [
                        gtfsObject.vehicle.position.longitude,
                        gtfsObject.vehicle.position.latitude
                    ]
                }
            };
        });
};

async function fetchVehiclePositionData(url, apiKey) {
    try {
        const response = await fetch(url, {
            headers: { 'KeyId': apiKey }
        });
        if (!response.ok) {
            console.error('API request failed:', response.status, response.statusText);

            document.getElementById('refresh-status').textContent = 'Error: ' + response.status + ' ' + response.statusText;
            return null;
        }
        const bufferRes = await response.arrayBuffer();
        const pbf = new Pbf(new Uint8Array(bufferRes));
        const gtfsr = FeedMessage.read(pbf);
        console.log("Vehicle positions found: ", gtfsr.entity.length);

        const responseData = gtfsr; //await response.json();
        const featureCollection = {
            type: 'FeatureCollection',
            features: gtfsArrayToGeojsonFeatures(responseData.entity)
        };
        return featureCollection;
    } catch (error) {
        console.error('Error fetching vehicle positions:', error);

        document.getElementById('refresh-status').textContent = 'Error: ' + error.message;
        return null;
    }
}

function updateVehiclePositions(featureCollection, layer) {
    layer.clearLayers();
    layer.addData(featureCollection);
    if (!map.hasLayer(layer)) {
        layer.addTo(map);
    }
}

function updateShapesOnMap(features, layer) {
    layer.clearLayers();
    const uniqueShapeIds = [...new Set(features.map(f => ({
        shapeId: f.properties.gtfsTrip?.shape_id,
        gtfsRoute: f.properties.gtfsRoute
    })))].filter(s => s.shapeId);

    console.log("Unique shape IDs in current data:", uniqueShapeIds.length);

    let shapeFeatures = gtfsShapes.filter(s => {
        return uniqueShapeIds.some(u => u.shapeId === s.properties.shapeId);
    });
    console.log("Unique shape features:", shapeFeatures.length);

    shapeFeatures.forEach(f => {
        uniqueShapeIds.find(s => s.shapeId === f.properties.shapeId && (f.properties.gtfsRoute = s.gtfsRoute));
    });
    const featureCollection = {
        type: 'FeatureCollection',
        features: shapeFeatures
    };
    layer.addData(featureCollection);
    if (!map.hasLayer(layer)) {
        layer.addTo(map);
    }
}

function updateFeaturesTable(features, tbodyId, countElementId) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';
    document.getElementById(countElementId).textContent = features.length ? '(' + features.length + ')' : '(No data)';
    const cellClass = 'px-2 py-1 border-b border-gray-100 whitespace-nowrap';
    features.forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        const p = f.properties;
        const tr = document.createElement('tr');
        tr.className = 'even:bg-white odd:bg-gray-50 hover:bg-green-50 transition-colors cursor-pointer';
        [p.timestamp, p.vehicleId, p.tripId, p.startTime, lat.toFixed(5), lon.toFixed(5)].forEach((val) => {
            const td = document.createElement('td');
            td.className = cellClass;
            td.textContent = val ?? '';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

async function refreshData() {
    const apiKeyTram = document.getElementById('tram-api-key-input').value.trim();
    if (!apiKeyTram) {
        document.getElementById('refresh-status').textContent = 'Error: API key is required.';
        return;
    }
    const urlTram = "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/tram/vehicle-positions";
    var dataTram = await fetchVehiclePositionData(urlTram, apiKeyTram);

    if (dataTram) {
        updateVehiclePositions(dataTram, geojsonTram);
        updateShapesOnMap(dataTram.features, geojsonShape);
        updateFeaturesTable(dataTram.features, 'tram-features-tbody', 'tram-features-count');
        document.getElementById('refresh-status').textContent = 'Refreshed at: ' + new Date().toLocaleTimeString();
    }
}

// Refresh interval management
let refreshInterval = null;

function getRefreshMs() {
    const val = parseFloat(document.getElementById('refresh-interval-input').value);
    return (isFinite(val) && val >= 1 ? val : 3) * 1000;
}

function startRefresh() {
    if (refreshInterval) return;
    const apiKey = document.getElementById('tram-api-key-input').value.trim();
    if (!apiKey) {
        document.getElementById('refresh-status').textContent = 'Error: API key is required.';
        return;
    }
    refreshData();
    refreshInterval = setInterval(refreshData, getRefreshMs());
    const btn = document.getElementById('btn-toggle');
    btn.innerHTML = '&#9646;&#9646; Stop';
    btn.classList.remove('bg-[#78be20]');
    btn.classList.add('bg-red-500');
    document.getElementById('refresh-status').textContent = 'Refresh started: ' + new Date().toLocaleTimeString();
}

function stopRefresh() {
    if (!refreshInterval) return;
    clearInterval(refreshInterval);
    refreshInterval = null;
    const btn = document.getElementById('btn-toggle');
    btn.innerHTML = '&#9654; Start';
    btn.classList.remove('bg-red-500');
    btn.classList.add('bg-[#78be20]');
    document.getElementById('refresh-status').textContent = 'Refresh stopped: ' + new Date().toLocaleTimeString();
}

document.getElementById('btn-toggle').addEventListener('click', () => {
    if (refreshInterval) stopRefresh(); else startRefresh();
});

document.getElementById('refresh-interval-input').addEventListener('change', startRefresh);

// Start automatically on load
//startRefresh();
