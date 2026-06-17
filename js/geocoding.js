/**
 * Progressive fallback geocoding using Nominatim
 */
export async function progressiveGeocode(address, city, country, userAgent = 'ScanMenu Africa Melanin Map') {
    const cleanAddress = address ? address.trim() : "";
    const cleanCity = city ? city.trim() : "";
    const cleanCountry = country ? country.trim() : "";

    const attempts = [];

    // Attempt 1: [address]
    attempts.push(cleanAddress);

    // Attempt 2: [address], [city] (if city not already in address)
    let attempt2 = cleanAddress;
    if (cleanCity && !cleanAddress.toLowerCase().includes(cleanCity.toLowerCase())) {
        attempt2 += (attempt2 ? ", " : "") + cleanCity;
    }
    attempts.push(attempt2);

    // Attempt 3: [address], [city], [country] (prevent duplicates)
    let attempt3 = cleanAddress;
    if (cleanCity && !cleanAddress.toLowerCase().includes(cleanCity.toLowerCase())) {
        attempt3 += (attempt3 ? ", " : "") + cleanCity;
    }
    if (cleanCountry && !attempt3.toLowerCase().includes(cleanCountry.toLowerCase())) {
        attempt3 += (attempt3 ? ", " : "") + cleanCountry;
    }
    attempts.push(attempt3);

    // Attempt 4: [city], [country]
    let attempt4 = "";
    if (cleanCity) attempt4 += cleanCity;
    if (cleanCountry) attempt4 += (attempt4 ? ", " : "") + cleanCountry;
    attempts.push(attempt4);

    // Attempt 5: [country]
    attempts.push(cleanCountry);

    // Remove empty attempts and duplicates to be efficient
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
