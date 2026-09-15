/**
 * Progressive fallback geocoding using Nominatim
 */
export async function progressiveGeocode(address, city, country, userAgent = 'ScanMenu Africa') {
    const cleanAddress = address ? address.trim() : "";
    const cleanCity = city ? city.trim() : "";
    const cleanCountry = country ? country.trim() : "";

    const attempts = [];
    attempts.push(cleanAddress);

    let attempt2 = cleanAddress;
    if (cleanCity && !cleanAddress.toLowerCase().includes(cleanCity.toLowerCase())) {
        attempt2 += (attempt2 ? ", " : "") + cleanCity;
    }
    attempts.push(attempt2);

    let attempt3 = cleanAddress;
    if (cleanCity && !cleanAddress.toLowerCase().includes(cleanCity.toLowerCase())) {
        attempt3 += (attempt3 ? ", " : "") + cleanCity;
    }
    if (cleanCountry && !attempt3.toLowerCase().includes(cleanCountry.toLowerCase())) {
        attempt3 += (attempt3 ? ", " : "") + cleanCountry;
    }
    attempts.push(attempt3);

    let attempt4 = "";
    if (cleanCity) attempt4 += cleanCity;
    if (cleanCountry) attempt4 += (attempt4 ? ", " : "") + cleanCountry;
    attempts.push(attempt4);
    attempts.push(cleanCountry);

    const uniqueAttempts = [...new Set(attempts.filter(a => a !== ""))];

    for (const query of uniqueAttempts) {
        console.log("--- Geocoding Attempt ---");
        console.log("Query string:", query);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        console.log("Request URL:", url);

        try {
            const response = await fetch(url, {
                headers: {
                    'Accept-Language': 'en',
                    'User-Agent': userAgent
                }
            });
            const data = await response.json();
            console.log("Response length:", data.length);

            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                console.log("Selected coordinates:", lat, lon);
                return { lat, lon };
            }
        } catch (error) {
            console.error("Geocoding error for query '" + query + "':", error);
        }
    }

    return null;
}
