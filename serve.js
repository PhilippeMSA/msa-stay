const http = require("http");
const fs = require("fs");
const path = require("path");
const { loadEnv, getOrsApiKey } = require("./server/env");

loadEnv(__dirname);

const {
  getDb,
  getProperty,
  listProperties,
  listAmenities,
  listServices,
  listPaidServices,
  createProperty,
  updateProperty,
  deleteProperty,
  createAmenity,
  updateAmenity,
  removeAmenity,
  createService,
  updateService,
  removeService,
  createPaidService,
  updatePaidService,
  removePaidService,
  setPropertyImages,
  setPropertyCoordinates,
  bulkAssignPropertyExtras,
  propertyGeocodeQuery,
  listPropertiesWithCoordinates,
  listPropertiesMissingCoordinates,
  listCities,
  getCity,
  createCity,
  updateCity,
  deleteCity,
  mapAmenityRow,
  mapServiceRow,
  mapPaidServiceRow,
  AMENITY_CATEGORY_ORDER,
  SERVICE_CATEGORY_ORDER,
  PAID_SERVICE_CATEGORY_ORDER,
  PRICING_TYPES,
} = require("./server/db");
const ors = require("./server/ors");
const staffAuth = require("./server/staff-auth");

const root = __dirname;
const db = getDb();

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const rateBuckets = new Map();

function clientIp(req) {
  return (
    (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "local"
  );
}

function rateLimit(req, key, limit, windowMs) {
  const id = key + ":" + clientIp(req);
  const now = Date.now();
  let bucket = rateBuckets.get(id);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(id, bucket);
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

function sendJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function propertyImageDir(property) {
  if (!property.citySlug || !property.street || !property.folder) return null;
  return path.join(
    root,
    "properties",
    property.citySlug,
    property.street,
    property.folder,
    "images"
  );
}

function listDiskImages(property) {
  const dir = propertyImageDir(property);
  if (!dir || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort((a, b) => {
      const am = /^main\./i.test(a) ? 0 : 1;
      const bm = /^main\./i.test(b) ? 0 : 1;
      return am - bm || a.localeCompare(b);
    });
}

function ensureImageDir(property) {
  const dir = propertyImageDir(property);
  if (!dir) return null;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"] || "";
    const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
    if (!match) return reject(new Error("Missing multipart boundary"));
    const boundary = match[1] || match[2];
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const buf = Buffer.concat(chunks);
      const parts = [];
      const sep = Buffer.from("--" + boundary);
      let start = buf.indexOf(sep) + sep.length;
      while (start < buf.length) {
        if (buf[start] === 45 && buf[start + 1] === 45) break; // --
        if (buf[start] === 13 && buf[start + 1] === 10) start += 2;
        const next = buf.indexOf(sep, start);
        if (next === -1) break;
        let part = buf.slice(start, next - 2); // trim \r\n
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd !== -1) {
          const headers = part.slice(0, headerEnd).toString("utf8");
          const body = part.slice(headerEnd + 4);
          const nameMatch = /name="([^"]+)"/i.exec(headers);
          const fileMatch = /filename="([^"]*)"/i.exec(headers);
          parts.push({
            name: nameMatch ? nameMatch[1] : "",
            filename: fileMatch ? path.basename(fileMatch[1]) : null,
            data: body,
          });
        }
        start = next + sep.length;
      }
      resolve(parts);
    });
    req.on("error", reject);
  });
}

function encodePathSegment(value) {
  return encodeURIComponent(String(value || "")).replace(/[!'()*]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function propertyCoverUrl(property) {
  if (!property || !property.images || !property.images.length) return "";
  return [
    "properties",
    property.citySlug,
    property.street,
    property.folder,
    "images",
    property.images[0],
  ]
    .map(encodePathSegment)
    .join("/");
}

function formatTravelSummary(distanceMeters, durationSeconds) {
  const distanceKm =
    distanceMeters != null ? Math.round((distanceMeters / 1000) * 10) / 10 : null;
  let durationLabel = null;
  if (durationSeconds != null) {
    const mins = Math.max(1, Math.round(durationSeconds / 60));
    durationLabel =
      mins < 60
        ? mins + " min"
        : Math.floor(mins / 60) + " h " + (mins % 60) + " min";
  }
  return { distanceKm, durationLabel, distanceMeters, durationSeconds };
}

function modeLabel(mode) {
  if (mode === "bicycle") return "by bicycle";
  if (mode === "walking" || mode === "foot") return "on foot";
  if (mode === "bus") return "by bus";
  return "by car";
}

async function geocodePropertyById(id) {
  const property = getProperty(db, id);
  if (!property) return null;
  const query = propertyGeocodeQuery(property);
  if (!query || query === "Belgium") {
    throw Object.assign(new Error("Add a street and city before looking up coordinates."), {
      status: 400,
    });
  }
  const result = await ors.geocodeAddress(query);
  if (!result) {
    throw Object.assign(
      new Error(
        "Sorry, we couldn't find coordinates for this address. Check the street and city."
      ),
      { status: 404 }
    );
  }
  return setPropertyCoordinates(db, id, result.lat, result.lng);
}

async function handleApi(req, res, urlPath) {
  const method = req.method || "GET";

  try {
    if (method === "GET" && urlPath === "/api/cities") {
      const u = new URL(req.url, "http://127.0.0.1");
      const includeHidden = u.searchParams.get("all") === "1";
      return sendJson(res, 200, {
        cities: listCities(db, { includeHidden }),
      });
    }

    if (method === "GET" && urlPath.startsWith("/api/cities/")) {
      const slug = decodeURIComponent(urlPath.slice("/api/cities/".length));
      const city = getCity(db, slug);
      if (!city) return sendJson(res, 404, { error: "City not found" });
      return sendJson(res, 200, { city });
    }

    if (method === "POST" && urlPath === "/api/cities") {
      const body = await readBody(req);
      const city = createCity(db, body || {});
      return sendJson(res, 201, { city });
    }

    if (method === "PUT" && urlPath.startsWith("/api/cities/")) {
      const slug = decodeURIComponent(urlPath.slice("/api/cities/".length));
      const body = await readBody(req);
      const city = updateCity(db, slug, body || {});
      if (!city) return sendJson(res, 404, { error: "City not found" });
      return sendJson(res, 200, { city });
    }

    if (method === "DELETE" && urlPath.startsWith("/api/cities/")) {
      const slug = decodeURIComponent(urlPath.slice("/api/cities/".length));
      const existing = getCity(db, slug);
      if (!existing) return sendJson(res, 404, { error: "City not found" });
      const result = deleteCity(db, slug);
      return sendJson(res, 200, result);
    }

    if (method === "GET" && urlPath === "/api/properties") {
      const u = new URL(req.url, "http://127.0.0.1");
      const citySlug = u.searchParams.get("city") || u.searchParams.get("citySlug");
      return sendJson(res, 200, {
        properties: listProperties(db, citySlug ? { citySlug } : {}),
      });
    }

    if (method === "POST" && urlPath === "/api/properties/bulk-assign") {
      const body = await readBody(req);
      try {
        const result = bulkAssignPropertyExtras(db, body || {});
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 400, {
          error: err.message || "Bulk assign failed",
        });
      }
    }

    const propertySub = urlPath.match(
      /^\/api\/properties\/([^/]+)\/(disk-images|sync-images|upload|geocode)$/
    );
    if (propertySub) {
      const id = decodeURIComponent(propertySub[1]);
      const action = propertySub[2];
      const property = getProperty(db, id);
      if (!property) return sendJson(res, 404, { error: "Property not found" });

      if (method === "GET" && action === "disk-images") {
        return sendJson(res, 200, { images: listDiskImages(property) });
      }

      if (method === "POST" && action === "sync-images") {
        const images = listDiskImages(property);
        setPropertyImages(db, id, images);
        return sendJson(res, 200, { property: getProperty(db, id) });
      }

      if (method === "POST" && action === "geocode") {
        if (!ors.isConfigured()) {
          return sendJson(res, 503, {
            error:
              "Add OPENROUTESERVICE_API_KEY to .env to look up coordinates.",
          });
        }
        if (!rateLimit(req, "geocode-prop", 20, 60_000)) {
          return sendJson(res, 429, {
            error: "Too many geocode requests. Please wait a moment.",
          });
        }
        try {
          const updated = await geocodePropertyById(id);
          return sendJson(res, 200, { property: updated });
        } catch (err) {
          return sendJson(res, err.status || 400, {
            error: err.message || "Geocode failed",
          });
        }
      }

      if (method === "POST" && action === "upload") {
        if (!property.street || !property.folder) {
          return sendJson(res, 400, {
            error: "Set street and folder before uploading photos",
          });
        }
        const dir = ensureImageDir(property);
        const parts = await parseMultipart(req);
        const saved = [];
        for (const part of parts) {
          if (!part.filename || !part.data || !part.data.length) continue;
          if (!/\.(jpe?g|png|webp)$/i.test(part.filename)) continue;
          const safe = path.basename(part.filename).replace(/[^\w.\- ()]/g, "_");
          fs.writeFileSync(path.join(dir, safe), part.data);
          saved.push(safe);
        }
        const images = listDiskImages(getProperty(db, id));
        setPropertyImages(db, id, images);
        return sendJson(res, 200, { saved, property: getProperty(db, id) });
      }

      return sendJson(res, 405, { error: "Method not allowed" });
    }

    if (method === "GET" && urlPath.startsWith("/api/properties/")) {
      const id = decodeURIComponent(urlPath.slice("/api/properties/".length));
      const property = getProperty(db, id);
      if (!property) return sendJson(res, 404, { error: "Property not found" });
      return sendJson(res, 200, { property });
    }

    if (method === "POST" && urlPath === "/api/properties") {
      const body = await readBody(req);
      const property = createProperty(db, body || {});
      return sendJson(res, 201, { property });
    }

    if (method === "PUT" && urlPath.startsWith("/api/properties/")) {
      const id = decodeURIComponent(urlPath.slice("/api/properties/".length));
      const body = await readBody(req);
      const property = updateProperty(db, id, body || {});
      if (!property) return sendJson(res, 404, { error: "Property not found" });
      return sendJson(res, 200, { property });
    }

    if (method === "DELETE" && urlPath.startsWith("/api/properties/")) {
      const id = decodeURIComponent(urlPath.slice("/api/properties/".length));
      const ok = deleteProperty(db, id);
      if (!ok) return sendJson(res, 404, { error: "Property not found" });
      return sendJson(res, 200, { ok: true });
    }

    if (method === "GET" && urlPath === "/api/workplace/status") {
      const withCoords = listPropertiesWithCoordinates(db).length;
      const total = listProperties(db).length;
      return sendJson(res, 200, {
        configured: ors.isConfigured(),
        modes: ["car", "bicycle", "foot", "bus"],
        propertiesWithCoordinates: withCoords,
        propertiesTotal: total,
      });
    }

    if (method === "GET" && urlPath === "/api/workplace/autocomplete") {
      if (!ors.isConfigured()) {
        return sendJson(res, 503, {
          error:
            "Workplace search is not configured yet. Please try again later.",
          suggestions: [],
        });
      }
      if (!rateLimit(req, "autocomplete", 40, 60_000)) {
        return sendJson(res, 429, {
          error: "Too many searches. Please wait a moment and try again.",
          suggestions: [],
        });
      }
      const u = new URL(req.url, "http://127.0.0.1");
      const q = String(u.searchParams.get("q") || "").trim();
      if (q.length < 2) {
        return sendJson(res, 200, { suggestions: [] });
      }
      if (q.length > 200) {
        return sendJson(res, 400, {
          error: "Search text is too long.",
          suggestions: [],
        });
      }
      try {
        const suggestions = await ors.autocomplete(q, { limit: 6, country: "BE" });
        return sendJson(res, 200, { suggestions });
      } catch (err) {
        return sendJson(res, err.status || 502, {
          error:
            err.message ||
            "Sorry, we couldn't find that location. Try entering the full company address.",
          suggestions: [],
        });
      }
    }

    if (method === "POST" && urlPath === "/api/workplace/search") {
      if (!ors.isConfigured()) {
        return sendJson(res, 503, {
          error:
            "Workplace search is not configured yet. Please try again later.",
        });
      }
      if (!rateLimit(req, "workplace-search", 20, 60_000)) {
        return sendJson(res, 429, {
          error: "Too many searches. Please wait a moment and try again.",
        });
      }

      const body = (await readBody(req)) || {};
      const mode = String(body.mode || "car").trim();
      if (!ors.profileForMode(mode)) {
        return sendJson(res, 400, {
          error: "Choose car, bicycle, foot, or bus.",
        });
      }

      const lat = Number(body.lat);
      const lng = Number(body.lng);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return sendJson(res, 400, {
          error:
            "Sorry, we couldn't use that location. Please pick an address from the suggestions.",
        });
      }

      const properties = listPropertiesWithCoordinates(db);
      if (!properties.length) {
        return sendJson(res, 200, {
          workplace: {
            lat,
            lng,
            label: String(body.label || "").slice(0, 200),
          },
          mode,
          results: [],
          approximate: false,
          message:
            "Accommodations are not ready for distance search yet. Please enquire and we will help you find the closest stay.",
        });
      }

      const locations = [[lng, lat]].concat(
        properties.map((p) => [p.longitude, p.latitude])
      );

      let matrixRows;
      let approximate = false;
      try {
        matrixRows = await ors.routeMatrix(locations, mode);
      } catch (err) {
        if (err.code === "RATE_LIMIT") {
          return sendJson(res, 429, { error: err.message });
        }
        // Degraded: straight-line distance only (no invented travel times)
        approximate = true;
        matrixRows = properties.map((_, index) => {
          const p = properties[index];
          return {
            propertyIndex: index,
            distanceMeters: ors.haversineMeters(
              lat,
              lng,
              p.latitude,
              p.longitude
            ),
            durationSeconds: null,
          };
        });
      }

      const results = matrixRows
        .map((row) => {
          const property = properties[row.propertyIndex];
          if (!property) return null;
          const summary = formatTravelSummary(
            row.distanceMeters,
            row.durationSeconds
          );
          return {
            id: property.id,
            name: property.name,
            city: property.city,
            citySlug: property.citySlug,
            status: property.status,
            description: property.description || "",
            basics: property.basics,
            amenities: property.amenities || [],
            coverUrl: propertyCoverUrl(property),
            href: "property.html?id=" + encodeURIComponent(property.id),
            distanceMeters: summary.distanceMeters,
            distanceKm: summary.distanceKm,
            durationSeconds: summary.durationSeconds,
            durationLabel: summary.durationLabel,
            mode,
            modeLabel: modeLabel(mode),
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          const ad =
            a.durationSeconds != null
              ? a.durationSeconds
              : a.distanceMeters != null
                ? a.distanceMeters
                : Number.POSITIVE_INFINITY;
          const bd =
            b.durationSeconds != null
              ? b.durationSeconds
              : b.distanceMeters != null
                ? b.distanceMeters
                : Number.POSITIVE_INFINITY;
          return ad - bd;
        });

      let resultMessage = null;
      if (mode === "bus") {
        approximate = true;
        resultMessage =
          "Bus times are estimated from road routing and may differ from real schedules.";
      } else if (approximate) {
        resultMessage =
          "We couldn't calculate exact travel times right now. Showing approximate distances instead.";
      }

      return sendJson(res, 200, {
        workplace: {
          lat,
          lng,
          label: String(body.label || "").slice(0, 200),
        },
        mode,
        approximate,
        message: resultMessage,
        results,
      });
    }

    if (method === "POST" && urlPath === "/api/workplace/geocode-missing") {
      if (!ors.isConfigured()) {
        return sendJson(res, 503, {
          error: "Add OPENROUTESERVICE_API_KEY to .env first.",
        });
      }
      if (!rateLimit(req, "geocode-missing", 5, 60_000)) {
        return sendJson(res, 429, {
          error: "Too many batch geocode requests.",
        });
      }
      const missing = listPropertiesMissingCoordinates(db);
      const updated = [];
      const failed = [];
      for (const prop of missing) {
        try {
          const result = await geocodePropertyById(prop.id);
          if (result) updated.push(result.id);
          await new Promise((r) => setTimeout(r, 350));
        } catch (err) {
          failed.push({ id: prop.id, error: err.message });
        }
      }
      return sendJson(res, 200, {
        updated: updated.length,
        failed,
        remaining: listPropertiesMissingCoordinates(db).length,
      });
    }

    if (method === "GET" && urlPath === "/api/amenities") {
      const u = new URL(req.url, "http://127.0.0.1");
      const activeOnly = u.searchParams.get("active") === "1";
      return sendJson(res, 200, {
        amenities: listAmenities(db, { includeInactive: !activeOnly }),
        categories: AMENITY_CATEGORY_ORDER,
      });
    }

    if (method === "POST" && urlPath === "/api/amenities") {
      const body = await readBody(req);
      const row = createAmenity(db, body || {});
      return sendJson(res, 201, { amenity: mapAmenityRow(row) });
    }

    if (method === "PUT" && urlPath.startsWith("/api/amenities/")) {
      const id = Number(urlPath.slice("/api/amenities/".length));
      const body = await readBody(req);
      const row = updateAmenity(db, id, body || {});
      if (!row) return sendJson(res, 404, { error: "Amenity not found" });
      return sendJson(res, 200, { amenity: mapAmenityRow(row) });
    }

    if (method === "DELETE" && urlPath.startsWith("/api/amenities/")) {
      const id = Number(urlPath.slice("/api/amenities/".length));
      const existing = db.prepare(`SELECT id FROM amenities WHERE id = ?`).get(id);
      if (!existing) return sendJson(res, 404, { error: "Amenity not found" });
      const result = removeAmenity(db, id);
      return sendJson(res, 200, result);
    }

    if (method === "GET" && urlPath === "/api/services") {
      const u = new URL(req.url, "http://127.0.0.1");
      const activeOnly = u.searchParams.get("active") === "1";
      return sendJson(res, 200, {
        services: listServices(db, { includeInactive: !activeOnly }),
        categories: SERVICE_CATEGORY_ORDER,
      });
    }

    if (method === "POST" && urlPath === "/api/services") {
      const body = await readBody(req);
      const row = createService(db, body || {});
      return sendJson(res, 201, { service: mapServiceRow(row) });
    }

    if (method === "PUT" && urlPath.startsWith("/api/services/")) {
      const id = Number(urlPath.slice("/api/services/".length));
      const body = await readBody(req);
      const row = updateService(db, id, body || {});
      if (!row) return sendJson(res, 404, { error: "Service not found" });
      return sendJson(res, 200, { service: mapServiceRow(row) });
    }

    if (method === "DELETE" && urlPath.startsWith("/api/services/")) {
      const id = Number(urlPath.slice("/api/services/".length));
      const existing = db.prepare(`SELECT id FROM services WHERE id = ?`).get(id);
      if (!existing) return sendJson(res, 404, { error: "Service not found" });
      const result = removeService(db, id);
      return sendJson(res, 200, result);
    }

    if (method === "GET" && urlPath === "/api/paid-services") {
      const u = new URL(req.url, "http://127.0.0.1");
      const activeOnly = u.searchParams.get("active") === "1";
      return sendJson(res, 200, {
        paidServices: listPaidServices(db, { includeInactive: !activeOnly }),
        categories: PAID_SERVICE_CATEGORY_ORDER,
        pricingTypes: PRICING_TYPES,
      });
    }

    if (method === "POST" && urlPath === "/api/paid-services") {
      const body = await readBody(req);
      const row = createPaidService(db, body || {});
      return sendJson(res, 201, { paidService: mapPaidServiceRow(row) });
    }

    if (method === "PUT" && urlPath.startsWith("/api/paid-services/")) {
      const id = Number(urlPath.slice("/api/paid-services/".length));
      const body = await readBody(req);
      const row = updatePaidService(db, id, body || {});
      if (!row) return sendJson(res, 404, { error: "Paid service not found" });
      return sendJson(res, 200, { paidService: mapPaidServiceRow(row) });
    }

    if (method === "DELETE" && urlPath.startsWith("/api/paid-services/")) {
      const id = Number(urlPath.slice("/api/paid-services/".length));
      const existing = db
        .prepare(`SELECT id FROM paid_services WHERE id = ?`)
        .get(id);
      if (!existing) {
        return sendJson(res, 404, { error: "Paid service not found" });
      }
      const result = removePaidService(db, id);
      return sendJson(res, 200, result);
    }

    // --- Staff auth & availability calendar ---

    if (method === "GET" && urlPath === "/api/staff/me") {
      const session = staffAuth.getSessionUser(db, req);
      return sendJson(res, 200, {
        user: session ? session.user : null,
        inviteRequired: !!staffAuth.getStaffInviteCode(),
        firstUser: staffAuth.countStaffUsers(db) === 0,
        statuses: staffAuth.AVAILABILITY_STATUSES,
        statusLabels: staffAuth.AVAILABILITY_STATUS_LABELS,
        dayTaskTypes: staffAuth.DAY_TASK_TYPES,
        dayTaskLabels: staffAuth.DAY_TASK_LABELS,
        dailyTaskTypes: staffAuth.DAILY_TASK_TYPES,
        checkInTaskTypes: staffAuth.CHECK_IN_TASK_TYPES,
        checkOutTaskTypes: staffAuth.CHECK_OUT_TASK_TYPES,
      });
    }

    if (method === "POST" && urlPath === "/api/staff/register") {
      if (!rateLimit(req, "staff-register", 10, 60_000)) {
        return sendJson(res, 429, { error: "Too many attempts. Try again soon." });
      }
      const body = await readBody(req);
      const user = staffAuth.createStaffUser(db, body || {});
      const session = staffAuth.createStaffSession(db, user.id);
      return sendJson(
        res,
        201,
        { user },
        {
          "Set-Cookie": staffAuth.sessionCookieHeader(
            session.token,
            session.maxAgeSeconds
          ),
        }
      );
    }

    if (method === "POST" && urlPath === "/api/staff/login") {
      if (!rateLimit(req, "staff-login", 20, 60_000)) {
        return sendJson(res, 429, { error: "Too many attempts. Try again soon." });
      }
      const body = await readBody(req);
      const user = staffAuth.authenticateStaffUser(
        db,
        body && body.email,
        body && body.password
      );
      const session = staffAuth.createStaffSession(db, user.id);
      return sendJson(
        res,
        200,
        { user },
        {
          "Set-Cookie": staffAuth.sessionCookieHeader(
            session.token,
            session.maxAgeSeconds
          ),
        }
      );
    }

    if (method === "POST" && urlPath === "/api/staff/logout") {
      const session = staffAuth.getSessionUser(db, req);
      if (session) staffAuth.destroyStaffSession(db, session.token);
      return sendJson(
        res,
        200,
        { ok: true },
        { "Set-Cookie": staffAuth.clearSessionCookieHeader() }
      );
    }

    if (method === "GET" && urlPath === "/api/staff/users") {
      const session = staffAuth.requireManager(db, req, res, sendJson);
      if (!session) return;
      return sendJson(res, 200, {
        users: staffAuth.listStaffUsers(db),
        managerCount: staffAuth.countManagers(db),
        adminCount: staffAuth.countAdmins(db),
        isAdmin: staffAuth.isAdmin(session.user),
      });
    }

    if (method === "PUT" && urlPath.match(/^\/api\/staff\/users\/\d+\/role$/)) {
      const session = staffAuth.requireManager(db, req, res, sendJson);
      if (!session) return;
      const id = Number(urlPath.split("/")[4]);
      const body = await readBody(req);
      try {
        const user = staffAuth.setStaffUserRole(
          db,
          id,
          body && body.role,
          session.user
        );
        return sendJson(res, 200, {
          user,
          managerCount: staffAuth.countManagers(db),
          adminCount: staffAuth.countAdmins(db),
        });
      } catch (err) {
        return sendJson(res, 400, {
          error: err.message || "Could not update role",
        });
      }
    }

    if (method === "PUT" && urlPath.match(/^\/api\/staff\/users\/\d+\/active$/)) {
      const session = staffAuth.requireAdmin(db, req, res, sendJson);
      if (!session) return;
      const id = Number(urlPath.split("/")[4]);
      const body = await readBody(req);
      try {
        const user = staffAuth.setStaffUserActive(
          db,
          id,
          !!(body && body.active),
          session.user
        );
        return sendJson(res, 200, {
          user,
          managerCount: staffAuth.countManagers(db),
          adminCount: staffAuth.countAdmins(db),
        });
      } catch (err) {
        return sendJson(res, 400, {
          error: err.message || "Could not update user",
        });
      }
    }

    if (
      method === "PUT" &&
      urlPath.match(/^\/api\/staff\/users\/\d+\/password$/)
    ) {
      const session = staffAuth.requireAdmin(db, req, res, sendJson);
      if (!session) return;
      const id = Number(urlPath.split("/")[4]);
      const body = await readBody(req);
      try {
        const user = staffAuth.resetStaffUserPassword(
          db,
          id,
          body && body.password,
          session.user
        );
        return sendJson(res, 200, { user, ok: true });
      } catch (err) {
        return sendJson(res, 400, {
          error: err.message || "Could not reset password",
        });
      }
    }

    if (method === "GET" && urlPath === "/api/staff/availability") {
      const session = staffAuth.requireStaff(db, req, res, sendJson);
      if (!session) return;
      const u = new URL(req.url, "http://127.0.0.1");
      const blocks = staffAuth.listAvailabilityBlocks(db, {
        propertyId: u.searchParams.get("propertyId") || "",
        citySlug: u.searchParams.get("city") || u.searchParams.get("citySlug") || "",
        from: u.searchParams.get("from") || "",
        to: u.searchParams.get("to") || "",
      });
      return sendJson(res, 200, {
        blocks,
        canEdit: staffAuth.canEditOps(session.user),
        statuses: staffAuth.AVAILABILITY_STATUSES,
        statusLabels: staffAuth.AVAILABILITY_STATUS_LABELS,
        dayTaskTypes: staffAuth.DAY_TASK_TYPES,
        dayTaskLabels: staffAuth.DAY_TASK_LABELS,
        dailyTaskTypes: staffAuth.DAILY_TASK_TYPES,
        checkInTaskTypes: staffAuth.CHECK_IN_TASK_TYPES,
        checkOutTaskTypes: staffAuth.CHECK_OUT_TASK_TYPES,
        staffUsers:
          staffAuth.canEditOps(session.user)
            ? staffAuth.listStaffUsers(db).filter(function (u) {
                return u.active;
              })
            : [],
      });
    }

    if (method === "GET" && urlPath === "/api/staff/my-schedule") {
      const session = staffAuth.requireStaff(db, req, res, sendJson);
      if (!session) return;
      const u = new URL(req.url, "http://127.0.0.1");
      const tasks = staffAuth.listMySchedule(db, session.user.id, {
        from: u.searchParams.get("from") || "",
        to: u.searchParams.get("to") || "",
      });
      return sendJson(res, 200, {
        tasks,
        from: u.searchParams.get("from") || null,
        to: u.searchParams.get("to") || null,
        user: session.user,
      });
    }

    if (
      method === "PUT" &&
      urlPath.match(/^\/api\/staff\/tasks\/\d+\/complete$/)
    ) {
      const session = staffAuth.requireStaff(db, req, res, sendJson);
      if (!session) return;
      const id = Number(urlPath.split("/")[4]);
      const body = await readBody(req);
      try {
        const task = staffAuth.setDayTaskCompleted(
          db,
          id,
          !!(body && body.completed),
          session.user
        );
        if (!task) return sendJson(res, 404, { error: "Task not found" });
        return sendJson(res, 200, { task });
      } catch (err) {
        return sendJson(res, 403, {
          error: err.message || "Could not update task",
        });
      }
    }

    if (method === "POST" && urlPath === "/api/staff/availability") {
      const session = staffAuth.requireManager(db, req, res, sendJson);
      if (!session) return;
      const body = await readBody(req);
      const block = staffAuth.createAvailabilityBlock(
        db,
        body || {},
        session.user.id
      );
      return sendJson(res, 201, { block });
    }

    if (method === "PUT" && urlPath.startsWith("/api/staff/availability/")) {
      const session = staffAuth.requireManager(db, req, res, sendJson);
      if (!session) return;
      const id = Number(urlPath.slice("/api/staff/availability/".length));
      const body = await readBody(req);
      const block = staffAuth.updateAvailabilityBlock(db, id, body || {});
      if (!block) return sendJson(res, 404, { error: "Block not found" });
      return sendJson(res, 200, { block });
    }

    if (method === "DELETE" && urlPath.startsWith("/api/staff/availability/")) {
      const session = staffAuth.requireManager(db, req, res, sendJson);
      if (!session) return;
      const id = Number(urlPath.slice("/api/staff/availability/".length));
      const ok = staffAuth.deleteAvailabilityBlock(db, id);
      if (!ok) return sendJson(res, 404, { error: "Block not found" });
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: "API route not found" });
  } catch (err) {
    return sendJson(res, 400, { error: err.message || "Request failed" });
  }
}

function serveStatic(req, res, urlPath) {
  const aliases = {
    "/favicon.ico": "/assets/favicon.ico",
    "/apple-touch-icon.png": "/assets/apple-touch-icon.png",
    "/site.webmanifest": "/assets/site.webmanifest",
  };
  const resolvedPath = aliases[urlPath] || urlPath;
  let filePath = path.join(root, resolvedPath === "/" ? "index.html" : resolvedPath);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
      res.end(data);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

  if (urlPath.startsWith("/api/")) {
    await handleApi(req, res, urlPath);
    return;
  }

  serveStatic(req, res, urlPath);
});

const PORT = Number(process.env.PORT) || 8767;
server.listen(PORT, "127.0.0.1", () => {
  console.log("MSA Stay server http://127.0.0.1:" + PORT);
  console.log("Admin: http://127.0.0.1:" + PORT + "/admin/");
  console.log("Staff calendar: http://127.0.0.1:" + PORT + "/staff/");
  if (!getOrsApiKey()) {
    console.log(
      "Workplace search: set OPENROUTESERVICE_API_KEY in .env to enable."
    );
  } else {
    console.log("Workplace search: OpenRouteService configured.");
  }
});
