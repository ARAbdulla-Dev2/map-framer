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
    window.addEventListener('resize', function() {
        watermark.style.fontSize = (window.innerWidth < 768) ? '24px' : '48px';
    });
});

// Data storage
var cityData = {};
var districtData = {};
var cityAliases = {};

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

// Normalize names
function normalizeName(name) {
    if (!name) return '';
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\d+$/, '');
}

// Fetch district data
function fetchDistrictData() {
    return fetch('https://raw.githubusercontent.com/aslamanver/srilanka-cities/refs/heads/master/districts.sql')
        .then(res => res.text())
        .then(data => {
            const matches = data.match(/INSERT INTO `districts`[^;]+;/g) || [];
            matches.forEach(match => {
                [...match.matchAll(/\(([^)]+)\)/g)].forEach(v => {
                    const values = v[1].split(',').map(val => val.trim().replace(/^'(.*)'$/, '$1'));
                    const district = {
                        id: parseInt(values[0]),
                        province_id: parseInt(values[1]),
                        name_en: values[2] === 'NULL' ? null : values[2],
                        name_si: values[3] === 'NULL' ? null : values[3],
                        name_ta: values[4] === 'NULL' ? null : values[4]
                    };
                    if (district.name_en) {
                        districtData[district.id] = district;
                        districtData[district.name_en.toLowerCase()] = district;
                    }
                });
            });
        }).catch(console.error);
}

// Fetch city data
function fetchCityData() {
    return fetch('https://raw.githubusercontent.com/aslamanver/srilanka-cities/refs/heads/master/cities.sql')
        .then(res => res.text())
        .then(data => {
            const matches = data.match(/INSERT INTO `cities`[^;]+;/g) || [];
            matches.forEach(match => {
                [...match.matchAll(/\(([^)]+)\)/g)].forEach(v => {
                    const values = v[1].split(',').map(val => val.trim().replace(/^'(.*)'$/, '$1'));
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
                    if (city.name_en && city.latitude && city.longitude) {
                        cityData[city.name_en] = { coords: [city.latitude, city.longitude], data: city };
                        const norm = normalizeName(city.name_en);
                        if (!cityAliases[norm]) cityAliases[norm] = city.name_en;
                        if (city.sub_name_en) {
                            const subNorm = normalizeName(city.sub_name_en);
                            if (!cityAliases[subNorm]) cityAliases[subNorm] = city.name_en;
                        }
                    }
                });
            });

            if (!cityData['Colombo'] && cityData['Colombo 1']) {
                cityData['Colombo'] = cityData['Colombo 1'];
                cityAliases['colombo'] = 'Colombo';
            }
        }).catch(() => {
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

// Find best match for a city
function findBestCityMatch(name) {
    if (!name) return null;
    const parts = name.split('-');
    const city = normalizeName(parts[1] || parts[0]);
    const district = normalizeName(parts[0]);

    const exact = Object.entries(cityData).find(([key]) => normalizeName(key) === city);
    if (exact) return exact[1];

    const partial = Object.entries(cityData).find(([key]) => normalizeName(key).includes(city));
    if (partial) return partial[1];

    if (cityAliases[city]) return cityData[cityAliases[city]];

    const districtMatch = Object.values(districtData).find(d => normalizeName(d.name_en) === district);
    if (districtMatch) {
        const foundCity = Object.values(cityData).find(c => c.data.district_id === districtMatch.id);
        if (foundCity) return foundCity;
    }

    const fallback = Object.entries(cityData).find(([key]) => normalizeName(key) === normalizeName(name));
    if (fallback) return fallback[1];

    return Object.values(cityData).find(c => normalizeName(c.data.name_en).includes(normalizeName(name))) || null;
}

// Handle URL hash
function processHash() {
    document.getElementById('loading').style.display = 'block';

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

    const parts = hash.split('&');
    let startCity = null, endCity = null;
    const cities = [];

    parts.forEach(part => {
        if (part.startsWith('start;')) startCity = part.substring(6);
        else if (part.startsWith('end;')) endCity = part.substring(4);
        else if (part) cities.push(part);
    });

    const points = [];

    if (startCity) {
        const match = findBestCityMatch(startCity);
        if (match) {
            const coord = L.latLng(match.coords);
            L.marker(coord, { icon: customIcons.start }).addTo(map).bindPopup(`<b>Start:</b> ${startCity}<br>Postcode: ${match.data.postcode || 'N/A'}`);
            points.push(coord);
        }
    }

    cities.forEach(city => {
        const match = findBestCityMatch(city);
        if (match) {
            const coord = L.latLng(match.coords);
            L.marker(coord, { icon: customIcons.default }).addTo(map).bindPopup(`<b>${city}</b><br>Postcode: ${match.data.postcode || 'N/A'}`);
            points.push(coord);
        }
    });

    if (endCity) {
        const match = findBestCityMatch(endCity);
        if (match) {
            const coord = L.latLng(match.coords);
            L.marker(coord, { icon: customIcons.end }).addTo(map).bindPopup(`<b>End:</b> ${endCity}<br>Postcode: ${match.data.postcode || 'N/A'}`);
            points.push(coord);
        }
    }

    if (points.length > 1) {
        L.polyline(points, { color: '#3388ff', weight: 2, opacity: 0.7 }).addTo(map);
        map.fitBounds(new L.LatLngBounds(points), { padding: [50, 50] });
    }

    document.getElementById('loading').style.display = 'none';
}

// Init
Promise.all([fetchDistrictData(), fetchCityData()]).then(() => {
    processHash();
    window.addEventListener('hashchange', processHash);
});
