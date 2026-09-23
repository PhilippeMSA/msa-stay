const { getOrsApiKey } = require("./env");

const ORS_BASE = "https://api.openrouteservice.org";

const MODE_PROFILES = {
  car: "driving-car",
  bicycle: "cycling-regular",
  walking: "foot-walking",
  foot: "foot-walking",
  // ORS has no transit matrix; bus uses road routing as an estimate.
  bus: "driving-car",
};

function isConfigured() {
  return !!getOrsApiKey();
}

function profileForMode(mode) {
  return MODE_PROFILES[mode] || null;
}

async function orsFetch(urlPath, { method = "GET", body, query } = {}) {
  const key = getOrsApiKey();
  if (!key) {
    const err = new Error("Workplace search is not configured yet.");
    err.code = "NOT_CONFIGURED";
    err.status = 503;
    throw err;
  }

  let url = ORS_BASE + urlPath;
  if (query) {
    const params = new URLSearchParams();
    Object.keys(query).forEach((k) => {
      if (query[k] != null && query[k] !== "") params.set(k, String(query[k]));
    });
    url += "?" + params.toString();
  }

  const headers = {
    Authorization: key,
    Accept: "application/json",
  };
  let payload;
  if (body != null) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch (networkErr) {
    const err = new Error(
      "We couldn't reach the mapping service. Please try again."
    );
    err.code = "NETWORK";
    err.status = 502;
    err.cause = networkErr;
    throw err;
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }

  if (res.status === 429) {
    const err = new Error(
      "Too many location searches right now. Please wait a moment and try again."
    );
    err.code = "RATE_LIMIT";
    err.status = 429;
    throw err;
  }

  if (!res.ok) {
    const message =
      (data && (data.error && data.error.message)) ||
      (data && data.message) ||
      "Mapping request failed.";
    const err = new Error(
      res.status >= 500
        ? "We couldn't calculate travel times right now. Please try again."
        : friendlyGeocodeMessage(message)
    );
    err.code = "ORS_ERROR";
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    err.details = message;
    throw err;
  }

  return data;
}

function friendlyGeocodeMessage(raw) {
  const text = String(raw || "").toLowerCase();
  if (text.includes("not found") || text.includes("unable")) {
    return "Sorry, we couldn't find that location. Try entering the full company address.";
  }
  return "Sorry, we couldn't find that location. Try entering the full company address.";
}

/**
 * Address / place autocomplete (Pelias via OpenRouteService).
 */
async function autocomplete(query, { limit = 6, country = "BE" } = {}) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];

  const data = await orsFetch("/geocode/autocomplete", {
    query: {
      text: q.slice(0, 200),
      size: Math.min(Math.max(Number(limit) || 6, 1), 10),
      "boundary.country": country,
      lang: "en",
    },
  });

  const features = (data && data.features) || [];
  return features
    .map((f) => {
      const coords = f.geometry && f.geometry.coordinates;
      const props = f.properties || {};
      if (!coords || coords.length < 2) return null;
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const label =
        props.label ||
        [props.name, props.street, props.postalcode, props.locality, props.country]
          .filter(Boolean)
          .join(", ");
      return {
        id: props.id || label + "|" + lat + "|" + lng,
        label: label || "Selected location",
        name: props.name || "",
        lat,
        lng,
        locality: props.locality || props.county || "",
        country: props.country || "",
      };
    })
    .filter(Boolean);
}

/**
 * Forward geocode a free-text address to a single point.
 */
async function geocodeAddress(text, { country = "BE" } = {}) {
  const q = String(text || "").trim();
  if (!q) return null;

  const data = await orsFetch("/geocode/search", {
    query: {
      text: q.slice(0, 250),
      size: 1,
      "boundary.country": country,
    },
  });

  const feature = data && data.features && data.features[0];
  if (!feature || !feature.geometry || !feature.geometry.coordinates) {
    return null;
  }
  const [lng, lat] = feature.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const props = feature.properties || {};
  return {
    lat: Number(lat),
    lng: Number(lng),
    label: props.label || q,
  };
}

/**
 * One matrix request: workplace (index 0) → each property.
 * locations: [[lng,lat], ...]
 */
async function routeMatrix(locations, mode) {
  const profile = profileForMode(mode);
  if (!profile) {
    const err = new Error("Choose car, bicycle, foot, or bus.");
    err.code = "BAD_MODE";
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(locations) || locations.length < 2) {
    const err = new Error("No accommodations with coordinates are available yet.");
    err.code = "NO_DESTINATIONS";
    err.status = 400;
    throw err;
  }

  // ORS matrix free tier typically allows small matrices; batch if needed.
  const sources = [0];
  const destinations = [];
  for (let i = 1; i < locations.length; i += 1) destinations.push(i);

  const data = await orsFetch("/v2/matrix/" + profile, {
    method: "POST",
    body: {
      locations,
      sources,
      destinations,
      metrics: ["distance", "duration"],
      units: "m",
    },
  });

  const distances = (data.distances && data.distances[0]) || [];
  const durations = (data.durations && data.durations[0]) || [];

  return destinations.map((destIndex, i) => ({
    propertyIndex: destIndex - 1,
    distanceMeters:
      distances[i] != null && Number.isFinite(Number(distances[i]))
        ? Number(distances[i])
        : null,
    durationSeconds:
      durations[i] != null && Number.isFinite(Number(durations[i]))
        ? Number(durations[i])
        : null,
  }));
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

module.exports = {
  isConfigured,
  profileForMode,
  MODE_PROFILES,
  autocomplete,
  geocodeAddress,
  routeMatrix,
  haversineMeters,
};
