// Initialize map with Sri Lanka view
var map = L.map('map').setView([7.8731, 80.7718], 7);

// Base map layer
var CartoDB_VoyagerLabelsUnder = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', {
    maxZoom: 7,
    minZoom: 7
}).addTo(map);

map.touchZoom.disable();
map.doubleClickZoom.disable();
map.scrollWheelZoom.disable();
map.boxZoom.disable();
map.keyboard.disable();
map.dragging.disable();

// Make watermark rotate slightly for better visibility
document.addEventListener('DOMContentLoaded', function() {
    var watermark = document.getElementById('watermark');
    watermark.style.transform = 'translate(-50%, -50%) rotate(-15deg)';
    
    // Optional: Make watermark responsive
    window.addEventListener('resize', function() {
        if (window.innerWidth < 768) {
            watermark.style.fontSize = '24px';
        } else {
            watermark.style.fontSize = '48px';
        }
    });
});

// City and district data from your database (will be fetched dynamically)
var cityData = {};
var districtData = {};
var cityAliases = {}; // For handling alternative names and simplified matches

// Custom icons
var customIcons = {
    start: L.icon({
        iconUrl: './start-marker.png',
        iconSize: [27, 27],
        iconAnchor: [12, 12]
    }),
    end: L.icon({
        iconUrl: './start-marker.png',
        iconSize: [27, 27],
        iconAnchor: [12, 12]
    }),
    default: L.icon({
        iconUrl: 'https://cdn0.iconfinder.com/data/icons/small-n-flat/24/678111-map-marker-512.png',
        iconSize: [25, 25],
        iconAnchor: [12, 12]
    })
};

// Function to normalize names for matching
function normalizeName(name) {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove special chars
        .replace(/\d+$/, ''); // Remove trailing numbers
}

// Function to fetch district data
function fetchDistrictData() {
    return fetch('https://raw.githubusercontent.com/aslamanver/srilanka-cities/refs/heads/master/districts.sql')
        .then(response => response.text())
        .then(data => {
            // Parse the SQL data to extract district information
            const districtRegex = /INSERT INTO `districts`[^;]+;/g;
            const districtMatches = data.match(districtRegex);
            
            if (districtMatches) {
                districtMatches.forEach(match => {
                    // Extract values from the INSERT statement
                    const valueRegex = /\(([^)]+)\)/g;
                    const valueMatches = match.matchAll(valueRegex);
                    
                    for (const valueMatch of valueMatches) {
                        const values = valueMatch[1].split(',').map(v => v.trim().replace(/^'(.*)'$/, '$1'));
                        
                        // Create district object
                        const district = {
                            id: parseInt(values[0]),
                            province_id: parseInt(values[1]),
                            name_en: values[2] === 'NULL' ? null : values[2],
                            name_si: values[3] === 'NULL' ? null : values[3],
                            name_ta: values[4] === 'NULL' ? null : values[4]
                        };
                        
                        // Add to districtData
                        if (district.name_en) {
                            districtData[district.id] = district;
                            // Also add by name for easier lookup
                            districtData[district.name_en.toLowerCase()] = district;
                        }
                    }
                });
            }
        })
        .catch(error => {
            console.error('Error fetching district data:', error);
        });
}

// Function to find the best matching city or district
function findBestCityMatch(locationName) {
    if (!locationName) return null;
    
    // First try to split the name to separate city and district (format "district-city")
    const parts = locationName.split('-');
    let cityPart = parts[0];
    let districtPart = parts[0]; // Default to first part
    
    if (parts.length > 1) {
        // If we have a hyphen, the first part is district, second is city
        districtPart = parts[0];
        cityPart = parts[1];
    }
    
    const normalizedCity = normalizeName(cityPart);
    const normalizedDistrict = normalizeName(districtPart);
    
    // First try exact city match
    for (const [key, city] of Object.entries(cityData)) {
        if (normalizeName(key) === normalizedCity) {
            return city;
        }
    }
    
    // Try partial city matches
    for (const [key, city] of Object.entries(cityData)) {
        const normalizedKey = normalizeName(key);
        if (normalizedKey.includes(normalizedCity) || normalizedCity.includes(normalizedKey)) {
            return city;
        }
    }
    
    // Try aliases
    if (cityAliases[normalizedCity]) {
        return cityData[cityAliases[normalizedCity]];
    }
    
    // If no city found, try to match the district
    // First try to find district by name
    let matchedDistrict = null;
    for (const [key, district] of Object.entries(districtData)) {
        if (typeof key === 'string' && normalizeName(key) === normalizedDistrict) {
            matchedDistrict = district;
            break;
        }
    }
    
    // If we found a district, try to find any city in that district
    if (matchedDistrict) {
        for (const [key, city] of Object.entries(cityData)) {
            if (city.data.district_id === matchedDistrict.id) {
                return city; // Return the first city we find in this district
            }
        }
        
        // If no cities found in district, try to find a coordinate for the district itself
        // This would require district coordinates in your data
    }
    
    // If still nothing found, try to match the original full name
    const normalizedFull = normalizeName(locationName);
    for (const [key, city] of Object.entries(cityData)) {
        if (normalizeName(key) === normalizedFull) {
            return city;
        }
    }
    
    // Final fallback - try partial match with full name
    for (const [key, city] of Object.entries(cityData)) {
        const normalizedKey = normalizeName(key);
        if (normalizedKey.includes(normalizedFull) || normalizedFull.includes(normalizedKey)) {
            return city;
        }
    }
    
    return null;
}

// Function to fetch city data from your database
function fetchCityData() {
    return fetch('https://raw.githubusercontent.com/aslamanver/srilanka-cities/refs/heads/master/cities.sql')
        .then(response => response.text())
        .then(data => {
            // Parse the SQL data to extract city information
            const cityRegex = /INSERT INTO `cities`[^;]+;/g;
            const cityMatches = data.match(cityRegex);
            
            if (cityMatches) {
                cityMatches.forEach(match => {
                    // Extract values from the INSERT statement
                    const valueRegex = /\(([^)]+)\)/g;
                    const valueMatches = match.matchAll(valueRegex);
                    
                    for (const valueMatch of valueMatches) {
                        const values = valueMatch[1].split(',').map(v => v.trim().replace(/^'(.*)'$/, '$1'));
                        
                        // Create city object (adjust indices based on your SQL structure)
                        const city = {
                            id: parseInt(values[0]),
                            district_id: parseInt(values[1]),
                            name_en: values[2] === 'NULL' ? null : values[2],
                            name_si: values[3] === 'NULL' ? null : values[3],
                            name_ta: values[4] === 'NULL' ? null : values[4],
                            sub_name_en: values[5] === 'NULL' ? null : values[5],
                            sub_name_si: values[6] === 'NULL' ? null : values[6],
                            sub_name_ta: values[7] === 'NULL' ? null : values[7],
                            postcode: values[8] === 'NULL' ? null : values[8],
                            latitude: values[9] === 'NULL' ? null : parseFloat(values[9]),
                            longitude: values[10] === 'NULL' ? null : parseFloat(values[10])
                        };
                        
                        // Add to cityData using English name as key
                        if (city.name_en && city.latitude && city.longitude) {
                            cityData[city.name_en] = {
                                coords: [city.latitude, city.longitude],
                                data: city
                            };
                            
                            // Create aliases for better matching
                            const normalized = normalizeName(city.name_en);
                            if (!cityAliases[normalized]) {
                                cityAliases[normalized] = city.name_en;
                            }
                            
                            // Also add sub-name as an alias if it exists
                            if (city.sub_name_en) {
                                const subNormalized = normalizeName(city.sub_name_en);
                                if (!cityAliases[subNormalized]) {
                                    cityAliases[subNormalized] = city.name_en;
                                }
                            }
                        }
                    }
                });
                
                // Add a general "Colombo" entry that points to Colombo 1 (Fort) as default
                if (!cityData['Colombo'] && cityData['Colombo 1']) {
                    cityData['Colombo'] = cityData['Colombo 1'];
                    cityAliases['colombo'] = 'Colombo';
                }
            }
        })
        .catch(error => {
            console.error('Error fetching city data:', error);
            // Fallback to some basic cities if the fetch fails
            cityData = {
                'Colombo': { coords: [6.9271, 79.8612], data: { postcode: '100', district_id: 15 } },
                'Matara': { coords: [5.9483, 80.5353], data: { postcode: '81000', district_id: 21 } },
                'Galle': { coords: [6.0535, 80.2210], data: { postcode: '80000', district_id: 20 } },
                'Kandy': { coords: [7.2906, 80.6337], data: { postcode: '20000', district_id: 12 } },
                'Jaffna': { coords: [9.6615, 80.0255], data: { postcode: '40000', district_id: 22 } },
                'Anuradhapura': { coords: [8.3114, 80.4037], data: { postcode: '50000', district_id: 2 } },
                'Trincomalee': { coords: [8.5922, 81.2357], data: { postcode: '31000', district_id: 7 } },
                'Batticaloa': { coords: [7.7167, 81.7000], data: { postcode: '30000', district_id: 5 } },
                'Negombo': { coords: [7.2086, 79.8358], data: { postcode: '11500', district_id: 15 } },
                'Ratnapura': { coords: [6.6806, 80.4022], data: { postcode: '70000', district_id: 18 } }
            };
        });
}

/*
// Function to animate a polyline
function animatePolyline(points) {
    // Create an empty polyline
    var animatedLine = L.polyline([], {
        color: '#3388ff',
        weight: 4,
        dashArray: '10, 10',
        dashOffset: '0'
    }).addTo(map);

    // Create a marker that will move along the line
    var movingMarker = L.marker(points[0], {
        icon: L.divIcon({
            className: 'moving-marker',
            html: '<div class="pulse-icon"></div>',
            iconSize: [20, 20]
        }),
        zIndexOffset: 1000
    }).addTo(map);

    // Variables for animation
    var i = 0;
    var speed = 20; // milliseconds between points
    var segmentDistance = 0;
    var segmentStart = points[0];
    var segmentEnd = points[1];
    var segmentLength = map.distance(segmentStart, segmentEnd);
    var segmentFraction = 0;
    var numPoints = points.length;

    // Style for the moving marker
    var style = document.createElement('style');
    style.innerHTML = `
        .pulse-icon {
            background-color: #3388ff;
            width: 13px;
            height: 13px;
            border-radius: 50%;
            position: relative;
            box-shadow: 0 0 0 0 rgba(51, 136, 255, 1);
            transform: scale(1);
            animation: pulse 2s infinite;
            margin-left:3.35px;
        }
        @keyframes pulse {
            0% {
                transform: scale(0.95);
                box-shadow: 0 0 0 0 rgba(51, 136, 255, 0.7);
            }
            70% {
                transform: scale(1.1);
                box-shadow: 0 0 0 10px rgba(51, 136, 255, 0);
            }
            100% {
                transform: scale(0.95);
                box-shadow: 0 0 0 0 rgba(51, 136, 255, 0);
            }
        }
    `;
    document.head.appendChild(style);

    // Animation function
    function animate() {
        segmentFraction += 0.02;
        
        if (segmentFraction >= 1) {
            segmentFraction = 0;
            i++;
            
            if (i >= numPoints - 1) {
                // Animation complete
                animatedLine.setLatLngs(points);
                return;
            }
            
            segmentStart = points[i];
            segmentEnd = points[i + 1];
            segmentLength = map.distance(segmentStart, segmentEnd);
        }
        
        // Calculate current position
        var currentLat = segmentStart.lat + (segmentEnd.lat - segmentStart.lat) * segmentFraction;
        var currentLng = segmentStart.lng + (segmentEnd.lng - segmentStart.lng) * segmentFraction;
        var currentPoint = L.latLng(currentLat, currentLng);
        
        // Update moving marker position
        movingMarker.setLatLng(currentPoint);
        
        // Update animated line
        var linePoints = points.slice(0, i + 1);
        linePoints.push(currentPoint);
        animatedLine.setLatLngs(linePoints);
        
        // Continue animation
        setTimeout(animate, speed);
    }
    
    // Start animation
    animate();
}
*/

// Process URL hash - updated version with better city matching
function processHash() {
    // Show loading indicator
    document.getElementById('loading').style.display = 'block';
    
    // Clear existing markers and lines
    map.eachLayer(function(layer) {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });
    
    const hash = window.location.hash.substring(1);
    if (!hash) {
        document.getElementById('loading').style.display = 'none';
        return;
    }
    
    // Check for special markers
    const parts = hash.split('&');
    let startCity = null;
    let endCity = null;
    const cities = [];
    
    parts.forEach(part => {
        if (part.startsWith('start;')) {
            startCity = part.substring(6);
        } else if (part.startsWith('end;')) {
            endCity = part.substring(4);
        } else if (part) {
            cities.push(part);
        }
    });
    
    // Add markers and lines
    const points = [];
    
    // Process start city if exists
    if (startCity) {
        const cityMatch = findBestCityMatch(startCity);
        if (cityMatch) {
            const coord = L.latLng(cityMatch.coords);
            L.marker(coord, {icon: customIcons.start})
                .addTo(map)
                .bindPopup(`<b>Start:</b> ${startCity}<br>Postcode: ${cityMatch.data.postcode || 'N/A'}`);
            points.push(coord);
        }
    }
    
    // Process middle cities
    cities.forEach(city => {
        const cityMatch = findBestCityMatch(city);
        if (cityMatch) {
            const coord = L.latLng(cityMatch.coords);
            L.marker(coord, {icon: customIcons.default})
                .addTo(map)
                .bindPopup(`<b>${city}</b><br>Postcode: ${cityMatch.data.postcode || 'N/A'}`);
            points.push(coord);
        }
    });
    
    // Process end city if exists
    if (endCity) {
        const cityMatch = findBestCityMatch(endCity);
        if (cityMatch) {
            const coord = L.latLng(cityMatch.coords);
            L.marker(coord, {icon: customIcons.end})
                .addTo(map)
                .bindPopup(`<b>End:</b> ${endCity}<br>Postcode: ${cityMatch.data.postcode || 'N/A'}`);
            points.push(coord);
        }
    }
    
    // Draw lines if we have multiple points
    if (points.length > 1) {
        // Create a solid line
        L.polyline(points, {
            color: '#3388ff',
            weight: 2,
            opacity: 0.7
        }).addTo(map);
        
        // Start the animation
        animatePolyline(points);
        
        // Adjust view to show all markers
        const bounds = new L.LatLngBounds(points);
        map.fitBounds(bounds, {padding: [50, 50]});
    }
    
    // Hide loading indicator
    document.getElementById('loading').style.display = 'none';
}

// Initialize the map after fetching data
Promise.all([fetchDistrictData(), fetchCityData()]).then(() => {
    // Initial processing
    processHash();
    
    // Listen for hash changes
    window.addEventListener('hashchange', processHash);
});
