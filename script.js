let map, geojsonLayer, geojsonCapital, targetCountry;
const maxDistance = 10000; // Maximum distance in km for color scaling
let guessCount = 0;
let totalGuesses = 0;
let gamesPlayed = 0;

function initMap() {
  map = L.map("map", {
    // interactive: false,
    // dragging: false,
    boxZoom: false,
    scrollWheelZoom: false,
    zoomControl: false,
    doubleClickZoom: false,
  }).setView([0, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
}

function loadCountries() {
  fetch(
    "https://raw.githubusercontent.com/Stefie/geojson-world/refs/heads/master/capitals.geojson"
  )
    .then((response) => response.json())
    .then((data) => {
      geojsonCapital = data;
    });

  fetch(
    "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson"
  )
    .then((response) => response.json())
    .then((data) => {
      geojsonLayer = L.geoJSON(data, {
        style: defaultStyle,
        onEachFeature: onEachFeature,
      }).addTo(map);
      startNewGame();
    });
}

function defaultStyle(feature) {
  return {
    fillColor: "#cccccc",
    weight: 1,
    opacity: 1,
    color: "white",
    fillOpacity: 1,
  };
}

function onEachFeature(feature, layer) {
  layer.on("click", function () {
    makeGuess(feature.properties.ADMIN);
  });
}

function getRandomCountry() {
  const countries = geojsonLayer.toGeoJSON().features;
  while (!isValidCountry) {
    const target =
      countries[Math.floor(Math.random() * countries.length)].properties;
    const foundCapital = geojsonCapital.features.find(
      (o) => o.properties.iso3 === target.ISO_A3
    );
    if (foundCapital) {
      targetCountry = target.ADMIN;
      isValidCountry = true;
    }
  }
}

function startNewGame() {
  geojsonLayer.setStyle(defaultStyle);
  isValidCountry = false;
  getRandomCountry();
  document.getElementById(
    "hint"
  ).textContent = `Hint: The target country starts with "${targetCountry[0]}"`;
  document.getElementById("result").textContent = "";
  document.getElementById("prev-country").textContent = "";
  guessCount = 0;
  updateScore();
}

function giveUp() {
  geojsonLayer.setStyle(defaultStyle);
  document.getElementById(
    "prev-country"
  ).textContent = `The previous game's country is "${targetCountry}"`;
  isValidCountry = false;
  getRandomCountry();
  document.getElementById(
    "hint"
  ).textContent = `Hint: The target country starts with "${targetCountry[0]}"`;
  document.getElementById("result").textContent = "";
  guessCount = 0;
  updateScore();
}

function makeGuess(countryName = "") {
  if (!countryName) {
    countryName = document.getElementById("country-input").value;
  }
  const guessedFeature = geojsonLayer
    .toGeoJSON()
    .features.find(
      (f) => f.properties.ADMIN.toLowerCase() === countryName.toLowerCase()
    );

  if (!guessedFeature) {
    document.getElementById("result").textContent =
      "Country not found. Try again.";
    return;
  }

  guessCount++;
  totalGuesses++;

  const targetFeature = geojsonLayer
    .toGeoJSON()
    .features.find((f) => f.properties.ADMIN === targetCountry);
  const distance = getCapitalDistance(guessedFeature, targetFeature);
  const color = getColor(distance);

  geojsonLayer.eachLayer((layer) => {
    if (layer.feature.properties.ADMIN === guessedFeature.properties.ADMIN) {
      layer.setStyle({ fillColor: color, fillOpacity: 1 });
    }
  });

  if (guessedFeature.properties.ADMIN === targetCountry) {
    document.getElementById(
      "result"
    ).textContent = `Correct! You found ${targetCountry} in ${guessCount} guesses!`;
    gamesPlayed++;
    updateScore();
  } else {
    document.getElementById("result").textContent = `Not quite. This is ${
      guessedFeature.properties.ADMIN
    }. The distance is about ${Math.round(distance)} km. Try again!`;
  }
  document.getElementById("country-input").value = "";
}

function getCapitalDistance(feature1, feature2) {
  const country1 = feature1.properties.ISO_A3;
  const country2 = feature2.properties.ISO_A3;
  const capital1 = geojsonCapital.features.find(
    (o) => o.properties.iso3 === country1
  );
  const capital2 = geojsonCapital.features.find(
    (o) => o.properties.iso3 === country2
  );
  const capitalCoordinate1 = capital1.geometry.coordinates;
  const capitalCoordinate2 = capital2.geometry.coordinates;
  return calculateHaversineDistance(
    capitalCoordinate1[1],
    capitalCoordinate1[0],
    capitalCoordinate2[1],
    capitalCoordinate2[0]
  );
}

function getDistance(feature1, feature2) {
  const centroid1 = calculateCentroid(feature1.geometry);
  const centroid2 = calculateCentroid(feature2.geometry);
  return calculateHaversineDistance(
    centroid1[1],
    centroid1[0],
    centroid2[1],
    centroid2[0]
  );
}

function calculateCentroid(geometry) {
  if (geometry.type === "Polygon") {
    return calculatePolygonCentroid(geometry.coordinates[0]);
  } else if (geometry.type === "MultiPolygon") {
    return calculatePolygonCentroid(geometry.coordinates[0][0]);
  }
  return [0, 0];
}

function calculatePolygonCentroid(coords) {
  let area = 0,
    cx = 0,
    cy = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    const a = x1 * y2 - x2 * y1;
    area += a;
    cx += (x1 + x2) * a;
    cy += (y1 + y2) * a;
  }
  area /= 2;
  cx = cx / (6 * area);
  cy = cy / (6 * area);
  return [cx, cy];
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getColor(distance) {
  const ratio = Math.min(distance / maxDistance, 1);
  const r = Math.floor(255 * (1 - ratio));
  const b = Math.floor(255 * ratio);
  return `rgb(${r}, 0, ${b})`;
}

function updateScore() {
  const avgGuesses = totalGuesses / (gamesPlayed || 1);
  document.getElementById(
    "score"
  ).textContent = `Games played: ${gamesPlayed} | Average guesses: ${avgGuesses.toFixed(
    2
  )}`;
}

initMap();
loadCountries();

document.onkeydown = function (evt) {
  var keyCode = evt ? (evt.which ? evt.which : evt.keyCode) : event.keyCode;
  if (keyCode == 13) {
    makeGuess();
  }
};
