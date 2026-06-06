let gtfsRoutes = new Array();
let gtfsTrips = new Array();
let gtfsShapes = new Array();

function parseCsv(csvText) {
    const [headerLine, ...rows] = csvText.split('\n');
    const headers = headerLine.split(',');

    return rows.map(row => {
        const values = row.split(',');
        return headers.reduce((obj, header, index) => {
            obj[header.trim()] = values[index]?.trim().replace(/"/g, "") || '';
            return obj;
        }, {});
    });
}

function gtfsShapeArrayToGeojsonFeatures(gtfsShapeArray) {
    const shapeById = Map.groupBy(gtfsShapeArray, (shape) => shape.shape_id);
    console.log(shapeById);

    return Array.from(shapeById.entries()).map(([shapeId, shapePoints]) => {
        const coordinates = shapePoints
            .sort((a, b) => parseFloat(a.shape_pt_sequence) - parseFloat(b.shape_pt_sequence))
            .map(point => [parseFloat(point.shape_pt_lon), parseFloat(point.shape_pt_lat)]);
        return {
            type: "Feature",
            properties: {
                shapeId: shapeId
            },
            geometry: {
                type: "LineString",
                coordinates: coordinates
            }
        };
    });

}

async function downloadAndUnzip(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    const reader = new zip.ZipReader(new zip.BlobReader(blob));
    const entries = await reader.getEntries();

    for (const entry of entries) {
        //console.log(`File: ${entry.filename}, Size: ${entry.uncompressedSize} bytes`);
        if (entry.filename.endsWith("3/google_transit.zip")) {
            console.log(`Found tram GTFS: ${entry.filename}`);

            // 2. Extract nested ZIP into a Blob in memory
            const nestedZipBlob = await entry.getData(new zip.BlobWriter());

            // 3. Create a new reader for the nested content
            const nestedReader = new zip.ZipReader(new zip.BlobReader(nestedZipBlob));
            const nestedEntries = await nestedReader.getEntries();

            for (const nestedEntry of nestedEntries) {
                //console.log(`-- Content inside ${entry.filename}: ${nestedEntry.filename}`);
                if (nestedEntry.filename.endsWith("routes.txt")) {
                    const routesText = await nestedEntry.getData(new zip.TextWriter());
                    gtfsRoutes = parseCsv(routesText);
                    console.log("Parsed routes.txt:", gtfsRoutes.length, "records. First record:", gtfsRoutes[0]);
                }
                if (nestedEntry.filename.endsWith("trips.txt")) {
                    const tripsText = await nestedEntry.getData(new zip.TextWriter());
                    gtfsTrips = parseCsv(tripsText);
                    console.log("Parsed trips.txt:", gtfsTrips.length, "records. First record:", gtfsTrips[0]);
                }
                if (nestedEntry.filename.endsWith("shapes.txt")) {
                    const shapesText = await nestedEntry.getData(new zip.TextWriter());
                    gtfsShapes = gtfsShapeArrayToGeojsonFeatures(parseCsv(shapesText));
                    console.log("Parsed shapes.txt:", gtfsShapes.length, "records. First record:", gtfsShapes[0]);
                }
            }
            await nestedReader.close();
        }
    }
    await reader.close();
}

const gtfsUrl = 'https://opendata.transport.vic.gov.au/dataset/3f4e292e-7f8a-4ffe-831f-1953be0fe448/resource/fb152201-859f-4882-9206-b768060b50ad/download/gtfs.zip';
//const gtfsUrl = 'data/gtfs.zip';
downloadAndUnzip(gtfsUrl).catch(console.error);