const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "msa_stay.sqlite");

const AMENITY_CATEGORY_ORDER = [
  "General",
  "Bedroom",
  "Bathroom",
  "Kitchen",
  "Technology",
  "Dining",
  "Outdoor",
  "Parking",
  "Safety",
  "Other",
];

const SERVICE_CATEGORY_ORDER = [
  "Check-in & support",
  "Cleaning",
  "Convenience",
  "Business",
  "Other",
];

const PAID_SERVICE_CATEGORY_ORDER = [
  "Check-in / check-out",
  "Cleaning",
  "Parking",
  "Business",
  "Other",
];

const PRICING_TYPES = [
  "per_stay",
  "per_night",
  "per_person",
  "per_person_per_night",
  "per_hour",
  "per_item",
  "custom",
];

const MASTER_AMENITIES = [
  ["General", "Wi-Fi", "wifi"],
  ["General", "Heating", "flame"],
  ["General", "Air conditioning", "snowflake"],
  ["General", "Workspace", "briefcase"],
  ["General", "Private entrance", "door-open"],
  ["General", "Self check-in", "key"],
  ["General", "Soundproofing", "volume-x"],
  ["General", "Elevator", "arrow-up-down"],
  ["Bedroom", "Bed linen", "bed"],
  ["Bedroom", "Double bed", "bed-double"],
  ["Bedroom", "Single bed", "bed-single"],
  ["Bedroom", "Sofa bed", "sofa"],
  ["Bedroom", "Wardrobe", "cabinet"],
  ["Bedroom", "Clothes rack", "hanger"],
  ["Bedroom", "Blackout curtains", "blinds"],
  ["Bedroom", "Bedside table", "lamp"],
  ["Bedroom", "Extra pillows", "pillow"],
  ["Bedroom", "Baby cot", "baby"],
  ["Bathroom", "Private bathroom", "bath"],
  ["Bathroom", "Shower", "shower-head"],
  ["Bathroom", "Bathtub", "bath"],
  ["Bathroom", "Toilet", "toilet"],
  ["Bathroom", "Toilet paper", "scroll"],
  ["Bathroom", "Towels", "shirt"],
  ["Bathroom", "Hairdryer", "wind"],
  ["Bathroom", "Soap / toiletries", "droplet"],
  ["Bathroom", "Shampoo", "droplet"],
  ["Bathroom", "Iron", "iron"],
  ["Bathroom", "Ironing board", "panel-top"],
  ["Kitchen", "Kitchen", "utensils"],
  ["Kitchen", "Kitchenette", "cooking-pot"],
  ["Kitchen", "Stovetop / hob", "flame"],
  ["Kitchen", "Oven", "oven"],
  ["Kitchen", "Microwave", "microwave"],
  ["Kitchen", "Refrigerator", "refrigerator"],
  ["Kitchen", "Dishwasher", "sparkles"],
  ["Kitchen", "Washing machine", "washing-machine"],
  ["Kitchen", "Coffee machine", "coffee"],
  ["Kitchen", "Kettle", "cup-soda"],
  ["Kitchen", "Toaster", "toast"],
  ["Kitchen", "Cookware", "utensils-crossed"],
  ["Kitchen", "Plates & cutlery", "utensils"],
  ["Kitchen", "Glasses", "glass-water"],
  ["Technology", "TV", "tv"],
  ["Technology", "Smart TV", "monitor"],
  ["Technology", "Streaming services", "play"],
  ["Technology", "USB charging", "usb"],
  ["Technology", "Ethernet / wired internet", "cable"],
  ["Dining", "Dining area", "utensils"],
  ["Dining", "Dining table", "table"],
  ["Outdoor", "Garden access", "trees"],
  ["Outdoor", "Terrace", "sun"],
  ["Outdoor", "Balcony", "building"],
  ["Outdoor", "Outdoor furniture", "armchair"],
  ["Outdoor", "BBQ", "flame"],
  ["Outdoor", "Bicycle storage", "bike"],
  ["Outdoor", "Bicycle", "bike"],
  ["Parking", "Parking", "parking-square"],
  ["Parking", "Private parking", "car"],
  ["Safety", "Smoke detector", "siren"],
  ["Safety", "Fire extinguisher", "fire-extinguisher"],
  ["Safety", "First-aid kit", "cross"],
];

const MASTER_SERVICES = [
  ["Check-in & support", "Self check-in"],
  ["Check-in & support", "Guest support"],
  ["Check-in & support", "Local recommendations"],
  ["Check-in & support", "Maintenance support"],
  ["Check-in & support", "Long-stay support"],
  ["Cleaning", "Weekly cleaning"],
  ["Cleaning", "Bed linen change"],
  ["Cleaning", "Towel change"],
  ["Convenience", "Luggage storage"],
  ["Convenience", "Laundry service"],
  ["Convenience", "Grocery delivery"],
  ["Convenience", "Bicycle rental"],
  ["Convenience", "Taxi arrangement"],
  ["Convenience", "Airport transfer"],
  ["Business", "Business accommodation"],
  ["Business", "Invoice available"],
  ["Business", "Company billing"],
  ["Business", "Printing service"],
  ["Business", "Long-term stay support"],
];

const MASTER_PAID_SERVICES = [
  ["Check-in / check-out", "Early check-in", "per_stay"],
  ["Check-in / check-out", "Late check-out", "per_stay"],
  ["Check-in / check-out", "Early arrival", "per_stay"],
  ["Check-in / check-out", "Late departure", "per_stay"],
  ["Cleaning", "Extra cleaning", "per_item"],
  ["Cleaning", "Mid-stay cleaning", "per_item"],
  ["Cleaning", "Additional towel set", "per_item"],
  ["Cleaning", "Additional bed linen", "per_item"],
  ["Cleaning", "Final cleaning", "per_stay"],
  ["Parking", "Private parking", "per_night"],
  ["Parking", "Additional parking space", "per_night"],
  ["Parking", "Long-term parking", "custom"],
  ["Business", "Extra workspace setup", "per_stay"],
  ["Business", "Printing", "per_item"],
  ["Business", "Company billing", "custom"],
  ["Business", "Weekly cleaning package", "custom"],
  ["Business", "Monthly cleaning package", "custom"],
  ["Business", "Long-term stay package", "custom"],
  ["Other", "Laundry service", "per_item"],
  ["Other", "Bicycle rental", "per_item"],
  ["Other", "Luggage storage", "per_stay"],
  ["Other", "Grocery delivery", "per_item"],
  ["Other", "Airport transfer", "per_item"],
  ["Other", "Baby equipment rental", "per_stay"],
  ["Other", "Pet accommodation", "per_stay"],
];

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS amenities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cities (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      status TEXT NOT NULL DEFAULT 'live',
      description TEXT NOT NULL DEFAULT '',
      upcoming_count INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      city_slug TEXT NOT NULL,
      street TEXT NOT NULL DEFAULT '',
      folder TEXT NOT NULL DEFAULT '',
      listing_page TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'available',
      max_guests INTEGER,
      bedrooms REAL,
      bed_type TEXT,
      kitchen_type TEXT,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS property_amenities (
      property_id TEXT NOT NULL,
      amenity_id INTEGER NOT NULL,
      PRIMARY KEY (property_id, amenity_id),
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
      FOREIGN KEY (amenity_id) REFERENCES amenities(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS property_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      category TEXT NOT NULL DEFAULT 'Other',
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS property_services (
      property_id TEXT NOT NULL,
      service_id INTEGER NOT NULL,
      description_override TEXT,
      PRIMARY KEY (property_id, service_id),
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS paid_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      category TEXT NOT NULL DEFAULT 'Other',
      description TEXT NOT NULL DEFAULT '',
      price REAL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      pricing_type TEXT NOT NULL DEFAULT 'custom',
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS property_paid_services (
      property_id TEXT NOT NULL,
      paid_service_id INTEGER NOT NULL,
      price_override REAL,
      description_override TEXT,
      PRIMARY KEY (property_id, paid_service_id),
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
      FOREIGN KEY (paid_service_id) REFERENCES paid_services(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS staff_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff_sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES staff_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS availability_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'booked',
      note TEXT NOT NULL DEFAULT '',
      guest_count INTEGER,
      created_by INTEGER,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES staff_users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS availability_day_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_id INTEGER NOT NULL,
      task_date TEXT NOT NULL,
      task_type TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      UNIQUE (block_id, task_date, task_type),
      FOREIGN KEY (block_id) REFERENCES availability_blocks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_availability_property_dates
      ON availability_blocks (property_id, start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_availability_day_tasks_block
      ON availability_day_tasks (block_id, task_date);
    CREATE INDEX IF NOT EXISTS idx_staff_sessions_user
      ON staff_sessions (user_id);
  `);

  migrateAmenityColumns(db);
  migratePropertyAmenityColumns(db);
  migratePropertyCoordinates(db);
  migrateAvailabilityGuestCount(db);
  ensureStaffAdmin(db);

  return db;
}

function tableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function ensureColumn(db, table, column, definition) {
  const cols = tableColumns(db, table);
  if (cols.indexOf(column) === -1) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrateAmenityColumns(db) {
  ensureColumn(db, "amenities", "category", `TEXT NOT NULL DEFAULT 'Other'`);
  ensureColumn(db, "amenities", "icon", `TEXT NOT NULL DEFAULT ''`);
  ensureColumn(db, "amenities", "description", `TEXT NOT NULL DEFAULT ''`);
}

function migratePropertyAmenityColumns(db) {
  ensureColumn(db, "property_amenities", "description_override", `TEXT`);
}

function migratePropertyCoordinates(db) {
  ensureColumn(db, "properties", "latitude", `REAL`);
  ensureColumn(db, "properties", "longitude", `REAL`);
}

function migrateAvailabilityGuestCount(db) {
  ensureColumn(db, "availability_blocks", "guest_count", `INTEGER`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS availability_day_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_id INTEGER NOT NULL,
      task_date TEXT NOT NULL,
      task_type TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      UNIQUE (block_id, task_date, task_type),
      FOREIGN KEY (block_id) REFERENCES availability_blocks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_availability_day_tasks_block
      ON availability_day_tasks (block_id, task_date);
  `);
  ensureColumn(db, "availability_day_tasks", "assignee_id", `INTEGER`);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_availability_day_tasks_assignee
      ON availability_day_tasks (assignee_id, task_date);
  `);
}

/** Rename legacy owner→admin, then ensure at least one active admin. */
function ensureStaffAdmin(db) {
  db.prepare(
    `UPDATE staff_users SET role = 'admin', updated_at = ? WHERE role = 'owner'`
  ).run(new Date().toISOString());

  const admins = db
    .prepare(
      `SELECT COUNT(*) AS c FROM staff_users WHERE role = 'admin' AND active = 1`
    )
    .get().c;
  if (admins > 0) return;
  const candidate = db
    .prepare(
      `SELECT id FROM staff_users
       WHERE active = 1
       ORDER BY
         CASE WHEN role = 'manager' THEN 0 ELSE 1 END,
         id ASC
       LIMIT 1`
    )
    .get();
  if (!candidate) return;
  db.prepare(
    `UPDATE staff_users SET role = 'admin', updated_at = ? WHERE id = ?`
  ).run(new Date().toISOString(), candidate.id);
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function citySlugFromName(city) {
  const c = String(city || "").trim().toLowerCase();
  if (c === "knokke" || c === "knokke-heist") return "knokke-heist";
  return slugify(c);
}

function listingPageForCity(citySlug) {
  return "city.html?slug=" + encodeURIComponent(citySlug || "");
}

function categoryRank(orderList, category) {
  const idx = orderList.indexOf(category);
  return idx === -1 ? 999 : idx;
}

function normalizePricingType(value) {
  const v = String(value || "custom").trim();
  if (v === "per_day") return "per_item";
  return PRICING_TYPES.indexOf(v) !== -1 ? v : "custom";
}

function pricingLabel(pricingType) {
  switch (pricingType) {
    case "per_stay":
      return "stay";
    case "per_night":
      return "night";
    case "per_person":
      return "person";
    case "per_person_per_night":
      return "person / night";
    case "per_hour":
      return "hour";
    case "per_item":
      return "item";
    default:
      return "";
  }
}

function mapAmenityRow(a, usageCount) {
  return {
    id: a.id,
    name: a.name,
    category: a.category || "Other",
    icon: a.icon || "",
    description: a.description || "",
    active: !!a.active,
    sortOrder: a.sort_order,
    displayOrder: a.sort_order,
    usageCount: usageCount != null ? usageCount : undefined,
  };
}

function mapServiceRow(s, usageCount) {
  return {
    id: s.id,
    name: s.name,
    category: s.category || "Other",
    description: s.description || "",
    icon: s.icon || "",
    active: !!s.active,
    sortOrder: s.sort_order,
    displayOrder: s.sort_order,
    usageCount: usageCount != null ? usageCount : undefined,
  };
}

function mapPaidServiceRow(s, usageCount) {
  return {
    id: s.id,
    name: s.name,
    category: s.category || "Other",
    description: s.description || "",
    price: s.price == null ? null : Number(s.price),
    currency: s.currency || "EUR",
    pricingType: s.pricing_type || "custom",
    active: !!s.active,
    sortOrder: s.sort_order,
    displayOrder: s.sort_order,
    usageCount: usageCount != null ? usageCount : undefined,
  };
}

function getAmenityNames(db, propertyId) {
  return db
    .prepare(
      `SELECT a.name
       FROM property_amenities pa
       JOIN amenities a ON a.id = pa.amenity_id
       WHERE pa.property_id = ? AND a.active = 1
       ORDER BY a.sort_order ASC, a.name ASC`
    )
    .all(propertyId)
    .map((r) => r.name);
}

function getAmenityIds(db, propertyId) {
  return db
    .prepare(`SELECT amenity_id FROM property_amenities WHERE property_id = ?`)
    .all(propertyId)
    .map((r) => r.amenity_id);
}

function getAmenityDetails(db, propertyId) {
  return db
    .prepare(
      `SELECT a.id, a.name, a.category, a.icon, a.description, a.sort_order,
              pa.description_override
       FROM property_amenities pa
       JOIN amenities a ON a.id = pa.amenity_id
       WHERE pa.property_id = ? AND a.active = 1
       ORDER BY a.sort_order ASC, a.name ASC`
    )
    .all(propertyId)
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category || "Other",
      icon: r.icon || "",
      description: r.description_override || r.description || "",
      descriptionOverride: r.description_override || null,
    }));
}

function getServiceIds(db, propertyId) {
  return db
    .prepare(`SELECT service_id FROM property_services WHERE property_id = ?`)
    .all(propertyId)
    .map((r) => r.service_id);
}

function getServiceDetails(db, propertyId) {
  return db
    .prepare(
      `SELECT s.id, s.name, s.category, s.icon, s.description, s.sort_order,
              ps.description_override
       FROM property_services ps
       JOIN services s ON s.id = ps.service_id
       WHERE ps.property_id = ? AND s.active = 1
       ORDER BY s.sort_order ASC, s.name ASC`
    )
    .all(propertyId)
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category || "Other",
      icon: r.icon || "",
      description: r.description_override || r.description || "",
      descriptionOverride: r.description_override || null,
    }));
}

function getPaidServiceIds(db, propertyId) {
  return db
    .prepare(
      `SELECT paid_service_id FROM property_paid_services WHERE property_id = ?`
    )
    .all(propertyId)
    .map((r) => r.paid_service_id);
}

function getPaidServiceDetails(db, propertyId) {
  return db
    .prepare(
      `SELECT p.id, p.name, p.category, p.description, p.price, p.currency,
              p.pricing_type, p.sort_order,
              pps.price_override, pps.description_override
       FROM property_paid_services pps
       JOIN paid_services p ON p.id = pps.paid_service_id
       WHERE pps.property_id = ? AND p.active = 1
       ORDER BY p.sort_order ASC, p.name ASC`
    )
    .all(propertyId)
    .map((r) => {
      const basePrice = r.price == null ? null : Number(r.price);
      const override =
        r.price_override == null ? null : Number(r.price_override);
      const effectivePrice = override != null ? override : basePrice;
      return {
        id: r.id,
        name: r.name,
        category: r.category || "Other",
        description: r.description_override || r.description || "",
        descriptionOverride: r.description_override || null,
        price: basePrice,
        priceOverride: override,
        effectivePrice,
        currency: r.currency || "EUR",
        pricingType: r.pricing_type || "custom",
        pricingLabel: pricingLabel(r.pricing_type || "custom"),
      };
    });
}

function getImageFilenames(db, propertyId) {
  return db
    .prepare(
      `SELECT filename FROM property_images
       WHERE property_id = ?
       ORDER BY sort_order ASC, id ASC`
    )
    .all(propertyId)
    .map((r) => r.filename);
}

function mapPropertyRow(row, extras = {}) {
  const latitude =
    row.latitude != null && Number.isFinite(Number(row.latitude))
      ? Number(row.latitude)
      : null;
  const longitude =
    row.longitude != null && Number.isFinite(Number(row.longitude))
      ? Number(row.longitude)
      : null;
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    citySlug: row.city_slug,
    street: row.street || "",
    folder: row.folder || "",
    listingPage: listingPageForCity(row.city_slug),
    status: row.status || "available",
    latitude,
    longitude,
    hasCoordinates: latitude != null && longitude != null,
    images: extras.images || [],
    basics: {
      maxGuests: row.max_guests,
      bedrooms: row.bedrooms,
      bedType: row.bed_type,
      kitchen: row.kitchen_type,
    },
    description: row.description || "",
    amenities: extras.amenities || [],
    amenityDetails: extras.amenityDetails || [],
    services: extras.services || [],
    paidServices: extras.paidServices || [],
    amenityIds: extras.amenityIds,
    serviceIds: extras.serviceIds,
    paidServiceIds: extras.paidServiceIds,
  };
}

function getProperty(db, id) {
  const row = db.prepare(`SELECT * FROM properties WHERE id = ?`).get(id);
  if (!row) return null;
  return mapPropertyRow(row, {
    amenities: getAmenityNames(db, id),
    amenityDetails: getAmenityDetails(db, id),
    services: getServiceDetails(db, id),
    paidServices: getPaidServiceDetails(db, id),
    images: getImageFilenames(db, id),
    amenityIds: getAmenityIds(db, id),
    serviceIds: getServiceIds(db, id),
    paidServiceIds: getPaidServiceIds(db, id),
  });
}

function listProperties(db, filters = {}) {
  let sql = `SELECT * FROM properties`;
  const params = [];
  const where = [];
  if (filters.citySlug) {
    where.push(`city_slug = ?`);
    params.push(filters.citySlug);
  }
  if (filters.city) {
    where.push(`city = ?`);
    params.push(filters.city);
  }
  if (where.length) sql += ` WHERE ` + where.join(" AND ");
  sql += ` ORDER BY city ASC, street ASC, name ASC`;
  const rows = db.prepare(sql).all(...params);
  return rows.map((row) =>
    mapPropertyRow(row, {
      amenities: getAmenityNames(db, row.id),
      images: getImageFilenames(db, row.id),
    })
  );
}

function listAmenities(db, { includeInactive = true } = {}) {
  let sql = `SELECT * FROM amenities`;
  if (!includeInactive) sql += ` WHERE active = 1`;
  sql += ` ORDER BY sort_order ASC, name ASC`;
  return db.prepare(sql).all().map((a) =>
    mapAmenityRow(
      a,
      db
        .prepare(`SELECT COUNT(*) AS c FROM property_amenities WHERE amenity_id = ?`)
        .get(a.id).c
    )
  );
}

function listServices(db, { includeInactive = true } = {}) {
  let sql = `SELECT * FROM services`;
  if (!includeInactive) sql += ` WHERE active = 1`;
  sql += ` ORDER BY sort_order ASC, name ASC`;
  return db.prepare(sql).all().map((s) =>
    mapServiceRow(
      s,
      db
        .prepare(`SELECT COUNT(*) AS c FROM property_services WHERE service_id = ?`)
        .get(s.id).c
    )
  );
}

function listPaidServices(db, { includeInactive = true } = {}) {
  let sql = `SELECT * FROM paid_services`;
  if (!includeInactive) sql += ` WHERE active = 1`;
  sql += ` ORDER BY sort_order ASC, name ASC`;
  return db.prepare(sql).all().map((s) =>
    mapPaidServiceRow(
      s,
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM property_paid_services WHERE paid_service_id = ?`
        )
        .get(s.id).c
    )
  );
}

function seedMasterAmenities(db) {
  const byName = db.prepare(
    `SELECT id, name, category, icon, description, sort_order FROM amenities WHERE name = ? COLLATE NOCASE`
  );
  const insert = db.prepare(
    `INSERT INTO amenities (name, category, icon, description, active, sort_order)
     VALUES (?, ?, ?, '', 1, ?)`
  );
  const updateMeta = db.prepare(
    `UPDATE amenities SET category = ?, icon = COALESCE(NULLIF(icon, ''), ?),
     sort_order = CASE WHEN sort_order = 0 THEN ? ELSE sort_order END
     WHERE id = ?`
  );

  const tx = db.transaction(() => {
    MASTER_AMENITIES.forEach((item, index) => {
      const category = item[0];
      const name = item[1];
      const icon = item[2] || "";
      const order = index + 1;
      const existing = byName.get(name);
      if (existing) {
        updateMeta.run(
          existing.category && existing.category !== "Other"
            ? existing.category
            : category,
          icon,
          order,
          existing.id
        );
      } else {
        insert.run(name, category, icon, order);
      }
    });

    // Categorize any leftover amenities that are still "Other"
    const leftovers = db
      .prepare(`SELECT id, name FROM amenities WHERE category = 'Other' OR category IS NULL OR category = ''`)
      .all();
    leftovers.forEach((row) => {
      const master = MASTER_AMENITIES.find(
        (m) => m[1].toLowerCase() === String(row.name).toLowerCase()
      );
      if (master) {
        db.prepare(`UPDATE amenities SET category = ?, icon = COALESCE(NULLIF(icon, ''), ?) WHERE id = ?`).run(
          master[0],
          master[2] || "",
          row.id
        );
      }
    });
  });
  tx();
}

function seedMasterServices(db) {
  const byName = db.prepare(
    `SELECT id FROM services WHERE name = ? COLLATE NOCASE`
  );
  const insert = db.prepare(
    `INSERT INTO services (name, category, description, icon, active, sort_order)
     VALUES (?, ?, '', '', 1, ?)`
  );
  const tx = db.transaction(() => {
    MASTER_SERVICES.forEach((item, index) => {
      if (byName.get(item[1])) return;
      insert.run(item[1], item[0], index + 1);
    });
  });
  tx();
}

function seedMasterPaidServices(db) {
  const byName = db.prepare(
    `SELECT id FROM paid_services WHERE name = ? COLLATE NOCASE`
  );
  const insert = db.prepare(
    `INSERT INTO paid_services
      (name, category, description, price, currency, pricing_type, active, sort_order)
     VALUES (?, ?, '', NULL, 'EUR', ?, 1, ?)`
  );
  const tx = db.transaction(() => {
    MASTER_PAID_SERVICES.forEach((item, index) => {
      if (byName.get(item[1])) return;
      insert.run(item[1], item[0], normalizePricingType(item[2]), index + 1);
    });
  });
  tx();
}

function ensureDefaultAmenities(db) {
  seedMasterAmenities(db);
}

function setPropertyAmenities(db, propertyId, amenityIds) {
  const existingOverrides = db
    .prepare(
      `SELECT amenity_id, description_override FROM property_amenities WHERE property_id = ?`
    )
    .all(propertyId);
  const overrideMap = {};
  existingOverrides.forEach((r) => {
    if (r.description_override != null) {
      overrideMap[r.amenity_id] = r.description_override;
    }
  });

  const del = db.prepare(`DELETE FROM property_amenities WHERE property_id = ?`);
  const ins = db.prepare(
    `INSERT INTO property_amenities (property_id, amenity_id, description_override)
     VALUES (?, ?, ?)`
  );
  const tx = db.transaction(() => {
    del.run(propertyId);
    (amenityIds || []).forEach((aid) => {
      const id = Number(aid);
      if (!Number.isFinite(id)) return;
      const exists = db.prepare(`SELECT id FROM amenities WHERE id = ?`).get(id);
      if (exists) ins.run(propertyId, id, overrideMap[id] || null);
    });
  });
  tx();
}

function setPropertyServices(db, propertyId, serviceIds) {
  const existingOverrides = db
    .prepare(
      `SELECT service_id, description_override FROM property_services WHERE property_id = ?`
    )
    .all(propertyId);
  const overrideMap = {};
  existingOverrides.forEach((r) => {
    if (r.description_override != null) {
      overrideMap[r.service_id] = r.description_override;
    }
  });

  const del = db.prepare(`DELETE FROM property_services WHERE property_id = ?`);
  const ins = db.prepare(
    `INSERT INTO property_services (property_id, service_id, description_override)
     VALUES (?, ?, ?)`
  );
  const tx = db.transaction(() => {
    del.run(propertyId);
    (serviceIds || []).forEach((sid) => {
      const id = Number(sid);
      if (!Number.isFinite(id)) return;
      const exists = db.prepare(`SELECT id FROM services WHERE id = ?`).get(id);
      if (exists) ins.run(propertyId, id, overrideMap[id] || null);
    });
  });
  tx();
}

/**
 * Bulk add or remove amenities / services / paid services across properties.
 * mode: "add" (default) merges ids; "remove" deletes matching links only.
 */
function bulkAssignPropertyExtras(db, input = {}) {
  const propertyIds = Array.from(
    new Set(
      (input.propertyIds || [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  );
  const amenityIds = Array.from(
    new Set(
      (input.amenityIds || [])
        .map(Number)
        .filter((id) => Number.isFinite(id))
    )
  );
  const serviceIds = Array.from(
    new Set(
      (input.serviceIds || [])
        .map(Number)
        .filter((id) => Number.isFinite(id))
    )
  );
  const paidServiceIds = Array.from(
    new Set(
      (input.paidServiceIds || [])
        .map(Number)
        .filter((id) => Number.isFinite(id))
    )
  );
  const mode = input.mode === "remove" ? "remove" : "add";

  if (!propertyIds.length) {
    throw new Error("Select at least one property");
  }
  if (!amenityIds.length && !serviceIds.length && !paidServiceIds.length) {
    throw new Error("Select at least one amenity, service, or paid service");
  }

  const existingProps = db
    .prepare(
      `SELECT id FROM properties WHERE id IN (${propertyIds
        .map(() => "?")
        .join(",")})`
    )
    .all(...propertyIds)
    .map((r) => r.id);
  if (!existingProps.length) {
    throw new Error("No matching properties found");
  }

  const addAmenity = db.prepare(
    `INSERT OR IGNORE INTO property_amenities (property_id, amenity_id)
     VALUES (?, ?)`
  );
  const removeAmenity = db.prepare(
    `DELETE FROM property_amenities
     WHERE property_id = ? AND amenity_id = ?`
  );
  const addService = db.prepare(
    `INSERT OR IGNORE INTO property_services (property_id, service_id)
     VALUES (?, ?)`
  );
  const removeService = db.prepare(
    `DELETE FROM property_services
     WHERE property_id = ? AND service_id = ?`
  );
  const addPaid = db.prepare(
    `INSERT OR IGNORE INTO property_paid_services (property_id, paid_service_id)
     VALUES (?, ?)`
  );
  const removePaid = db.prepare(
    `DELETE FROM property_paid_services
     WHERE property_id = ? AND paid_service_id = ?`
  );

  const validAmenities = amenityIds.filter((id) =>
    db.prepare(`SELECT id FROM amenities WHERE id = ?`).get(id)
  );
  const validServices = serviceIds.filter((id) =>
    db.prepare(`SELECT id FROM services WHERE id = ?`).get(id)
  );
  const validPaid = paidServiceIds.filter((id) =>
    db.prepare(`SELECT id FROM paid_services WHERE id = ?`).get(id)
  );

  let linksTouched = 0;
  const tx = db.transaction(() => {
    existingProps.forEach((propertyId) => {
      validAmenities.forEach((amenityId) => {
        const info =
          mode === "remove"
            ? removeAmenity.run(propertyId, amenityId)
            : addAmenity.run(propertyId, amenityId);
        linksTouched += info.changes || 0;
      });
      validServices.forEach((serviceId) => {
        const info =
          mode === "remove"
            ? removeService.run(propertyId, serviceId)
            : addService.run(propertyId, serviceId);
        linksTouched += info.changes || 0;
      });
      validPaid.forEach((paidId) => {
        const info =
          mode === "remove"
            ? removePaid.run(propertyId, paidId)
            : addPaid.run(propertyId, paidId);
        linksTouched += info.changes || 0;
      });
    });
  });
  tx();

  return {
    mode,
    propertyCount: existingProps.length,
    amenityCount: validAmenities.length,
    serviceCount: validServices.length,
    paidServiceCount: validPaid.length,
    linksTouched,
    propertyIds: existingProps,
  };
}

function setPropertyPaidServices(db, propertyId, paidServiceIds) {
  const existing = db
    .prepare(
      `SELECT paid_service_id, price_override, description_override
       FROM property_paid_services WHERE property_id = ?`
    )
    .all(propertyId);
  const map = {};
  existing.forEach((r) => {
    map[r.paid_service_id] = {
      price_override: r.price_override,
      description_override: r.description_override,
    };
  });

  const del = db.prepare(
    `DELETE FROM property_paid_services WHERE property_id = ?`
  );
  const ins = db.prepare(
    `INSERT INTO property_paid_services
      (property_id, paid_service_id, price_override, description_override)
     VALUES (?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    del.run(propertyId);
    (paidServiceIds || []).forEach((sid) => {
      const id = Number(sid);
      if (!Number.isFinite(id)) return;
      const exists = db
        .prepare(`SELECT id FROM paid_services WHERE id = ?`)
        .get(id);
      if (!exists) return;
      const prev = map[id] || {};
      ins.run(
        propertyId,
        id,
        prev.price_override != null ? prev.price_override : null,
        prev.description_override || null
      );
    });
  });
  tx();
}

function propertyGeocodeQuery(row) {
  const parts = [];
  if (row.street) parts.push(String(row.street).trim());
  if (row.city) parts.push(String(row.city).trim());
  parts.push("Belgium");
  return parts.filter(Boolean).join(", ");
}

function listPropertiesWithCoordinates(db) {
  return listProperties(db).filter((p) => p.hasCoordinates);
}

function listPropertiesMissingCoordinates(db) {
  return listProperties(db).filter((p) => !p.hasCoordinates && (p.street || p.city));
}

function setPropertyCoordinates(db, id, latitude, longitude) {
  const lat = latitude == null || latitude === "" ? null : Number(latitude);
  const lng = longitude == null || longitude === "" ? null : Number(longitude);
  if (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
    throw new Error("Latitude must be between -90 and 90");
  }
  if (lng != null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
    throw new Error("Longitude must be between -180 and 180");
  }
  const existing = db.prepare(`SELECT id FROM properties WHERE id = ?`).get(id);
  if (!existing) return null;
  db.prepare(
    `UPDATE properties SET latitude = ?, longitude = ?, updated_at = ? WHERE id = ?`
  ).run(lat, lng, nowIso(), id);
  return getProperty(db, id);
}

function parseCoordinateInput(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function setPropertyImages(db, propertyId, filenames) {
  const del = db.prepare(`DELETE FROM property_images WHERE property_id = ?`);
  const ins = db.prepare(
    `INSERT INTO property_images (property_id, filename, sort_order) VALUES (?, ?, ?)`
  );
  const tx = db.transaction(() => {
    del.run(propertyId);
    (filenames || []).forEach((filename, i) => {
      if (!filename) return;
      ins.run(propertyId, String(filename), i);
    });
  });
  tx();
}

function createProperty(db, input) {
  let city = String(input.city || "").trim();
  let citySlug = String(input.citySlug || "").trim();

  if (citySlug) {
    const cityRow = db.prepare(`SELECT * FROM cities WHERE slug = ?`).get(citySlug);
    if (cityRow) {
      city = cityRow.name;
      citySlug = cityRow.slug;
    } else {
      citySlug = citySlugFromName(citySlug);
      if (!city) city = citySlug;
    }
  } else if (city) {
    citySlug = citySlugFromName(city);
    const cityRow = db
      .prepare(`SELECT * FROM cities WHERE slug = ? OR name = ? COLLATE NOCASE`)
      .get(citySlug, city);
    if (cityRow) {
      city = cityRow.name;
      citySlug = cityRow.slug;
    }
  }

  if (!city || !citySlug) {
    throw new Error("Select a city for this property");
  }

  let id = String(input.id || "").trim() || slugify(citySlug + "-" + (input.name || "property"));
  if (!id) id = "property-" + Date.now();
  let unique = id;
  let n = 2;
  while (db.prepare(`SELECT id FROM properties WHERE id = ?`).get(unique)) {
    unique = id + "-" + n;
    n += 1;
  }

  const stamp = nowIso();
  db.prepare(
    `INSERT INTO properties (
      id, name, city, city_slug, street, folder, listing_page, status,
      max_guests, bedrooms, bed_type, kitchen_type, description,
      latitude, longitude, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    unique,
    String(input.name || "Untitled").trim(),
    city,
    citySlug,
    String(input.street || "").trim(),
    String(input.folder || input.name || "").trim(),
    listingPageForCity(citySlug),
    input.status === "upcoming" ? "upcoming" : "available",
    input.maxGuests != null ? Number(input.maxGuests) : null,
    input.bedrooms != null ? Number(input.bedrooms) : null,
    input.bedType || null,
    input.kitchenType || null,
    String(input.description || "").trim(),
    parseCoordinateInput(input.latitude),
    parseCoordinateInput(input.longitude),
    stamp,
    stamp
  );

  if (input.amenityIds) setPropertyAmenities(db, unique, input.amenityIds);
  if (input.serviceIds) setPropertyServices(db, unique, input.serviceIds);
  if (input.paidServiceIds) {
    setPropertyPaidServices(db, unique, input.paidServiceIds);
  }
  if (input.images) setPropertyImages(db, unique, input.images);
  return getProperty(db, unique);
}

function updateProperty(db, id, input) {
  const existing = db.prepare(`SELECT * FROM properties WHERE id = ?`).get(id);
  if (!existing) return null;

  let city = input.city != null ? String(input.city).trim() : existing.city;
  let citySlug =
    input.citySlug != null
      ? String(input.citySlug).trim()
      : existing.city_slug;

  if (input.citySlug != null || input.city != null) {
    const cityRow = citySlug
      ? db.prepare(`SELECT * FROM cities WHERE slug = ?`).get(citySlug)
      : db
          .prepare(`SELECT * FROM cities WHERE name = ? COLLATE NOCASE`)
          .get(city);
    if (cityRow) {
      city = cityRow.name;
      citySlug = cityRow.slug;
    } else if (input.city != null && input.citySlug == null) {
      citySlug = citySlugFromName(city);
    }
  }

  const nextLat =
    input.latitude !== undefined
      ? parseCoordinateInput(input.latitude)
      : existing.latitude;
  const nextLng =
    input.longitude !== undefined
      ? parseCoordinateInput(input.longitude)
      : existing.longitude;

  if (nextLat != null && (nextLat < -90 || nextLat > 90)) {
    throw new Error("Latitude must be between -90 and 90");
  }
  if (nextLng != null && (nextLng < -180 || nextLng > 180)) {
    throw new Error("Longitude must be between -180 and 180");
  }

  db.prepare(
    `UPDATE properties SET
      name = ?,
      city = ?,
      city_slug = ?,
      street = ?,
      folder = ?,
      listing_page = ?,
      status = ?,
      max_guests = ?,
      bedrooms = ?,
      bed_type = ?,
      kitchen_type = ?,
      description = ?,
      latitude = ?,
      longitude = ?,
      updated_at = ?
    WHERE id = ?`
  ).run(
    input.name != null ? String(input.name).trim() : existing.name,
    city,
    citySlug,
    input.street != null ? String(input.street).trim() : existing.street,
    input.folder != null ? String(input.folder).trim() : existing.folder,
    listingPageForCity(citySlug),
    input.status != null
      ? input.status === "upcoming"
        ? "upcoming"
        : "available"
      : existing.status,
    input.maxGuests !== undefined
      ? input.maxGuests == null
        ? null
        : Number(input.maxGuests)
      : existing.max_guests,
    input.bedrooms !== undefined
      ? input.bedrooms == null
        ? null
        : Number(input.bedrooms)
      : existing.bedrooms,
    input.bedType !== undefined ? input.bedType : existing.bed_type,
    input.kitchenType !== undefined ? input.kitchenType : existing.kitchen_type,
    input.description !== undefined
      ? String(input.description).trim()
      : existing.description,
    nextLat,
    nextLng,
    nowIso(),
    id
  );

  if (input.amenityIds !== undefined) {
    setPropertyAmenities(db, id, input.amenityIds);
  }
  if (input.serviceIds !== undefined) {
    setPropertyServices(db, id, input.serviceIds);
  }
  if (input.paidServiceIds !== undefined) {
    setPropertyPaidServices(db, id, input.paidServiceIds);
  }
  if (input.images !== undefined) {
    setPropertyImages(db, id, input.images);
  }

  return getProperty(db, id);
}

function deleteProperty(db, id) {
  const info = db.prepare(`DELETE FROM properties WHERE id = ?`).run(id);
  return info.changes > 0;
}

function createAmenity(db, input) {
  const name =
    typeof input === "string"
      ? String(input || "").trim()
      : String((input && input.name) || "").trim();
  if (!name) throw new Error("Amenity name is required");
  const masterMatch = MASTER_AMENITIES.find(
    (m) => m[1].toLowerCase() === name.toLowerCase()
  );
  const category =
    (input && input.category) || (masterMatch && masterMatch[0]) || "Other";
  const icon = (input && input.icon) || "";
  const description = (input && input.description) || "";
  const maxOrder =
    db.prepare(`SELECT MAX(sort_order) AS m FROM amenities`).get().m || 0;
  const sortOrder =
    input && input.sortOrder != null
      ? Number(input.sortOrder)
      : input && input.displayOrder != null
        ? Number(input.displayOrder)
        : maxOrder + 1;
  try {
    const info = db
      .prepare(
        `INSERT INTO amenities (name, category, icon, description, active, sort_order)
         VALUES (?, ?, ?, ?, 1, ?)`
      )
      .run(name, category, icon, description, sortOrder);
    return db.prepare(`SELECT * FROM amenities WHERE id = ?`).get(info.lastInsertRowid);
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      throw new Error("An amenity with that name already exists");
    }
    throw err;
  }
}

function updateAmenity(db, id, input = {}) {
  const existing = db.prepare(`SELECT * FROM amenities WHERE id = ?`).get(id);
  if (!existing) return null;
  const sortOrder =
    input.sortOrder != null
      ? Number(input.sortOrder)
      : input.displayOrder != null
        ? Number(input.displayOrder)
        : existing.sort_order;
  try {
    db.prepare(
      `UPDATE amenities SET name = ?, category = ?, icon = ?, description = ?,
       active = ?, sort_order = ? WHERE id = ?`
    ).run(
      input.name != null ? String(input.name).trim() : existing.name,
      input.category != null ? String(input.category).trim() : existing.category,
      input.icon != null ? String(input.icon).trim() : existing.icon || "",
      input.description != null
        ? String(input.description).trim()
        : existing.description || "",
      input.active != null ? (input.active ? 1 : 0) : existing.active,
      sortOrder,
      id
    );
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      throw new Error("An amenity with that name already exists");
    }
    throw err;
  }
  return db.prepare(`SELECT * FROM amenities WHERE id = ?`).get(id);
}

function removeAmenity(db, id) {
  const usage = db
    .prepare(`SELECT COUNT(*) AS c FROM property_amenities WHERE amenity_id = ?`)
    .get(id).c;
  if (usage > 0) {
    db.prepare(`UPDATE amenities SET active = 0 WHERE id = ?`).run(id);
    return { deactivated: true, deleted: false, usage };
  }
  db.prepare(`DELETE FROM amenities WHERE id = ?`).run(id);
  return { deactivated: false, deleted: true, usage: 0 };
}

function createService(db, input = {}) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Service name is required");
  const maxOrder =
    db.prepare(`SELECT MAX(sort_order) AS m FROM services`).get().m || 0;
  const sortOrder =
    input.sortOrder != null
      ? Number(input.sortOrder)
      : input.displayOrder != null
        ? Number(input.displayOrder)
        : maxOrder + 1;
  try {
    const info = db
      .prepare(
        `INSERT INTO services (name, category, description, icon, active, sort_order)
         VALUES (?, ?, ?, ?, 1, ?)`
      )
      .run(
        name,
        String(input.category || "Other").trim() || "Other",
        String(input.description || "").trim(),
        String(input.icon || "").trim(),
        sortOrder
      );
    return db.prepare(`SELECT * FROM services WHERE id = ?`).get(info.lastInsertRowid);
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      throw new Error("A service with that name already exists");
    }
    throw err;
  }
}

function updateService(db, id, input = {}) {
  const existing = db.prepare(`SELECT * FROM services WHERE id = ?`).get(id);
  if (!existing) return null;
  const sortOrder =
    input.sortOrder != null
      ? Number(input.sortOrder)
      : input.displayOrder != null
        ? Number(input.displayOrder)
        : existing.sort_order;
  try {
    db.prepare(
      `UPDATE services SET name = ?, category = ?, description = ?, icon = ?,
       active = ?, sort_order = ? WHERE id = ?`
    ).run(
      input.name != null ? String(input.name).trim() : existing.name,
      input.category != null ? String(input.category).trim() : existing.category,
      input.description != null
        ? String(input.description).trim()
        : existing.description || "",
      input.icon != null ? String(input.icon).trim() : existing.icon || "",
      input.active != null ? (input.active ? 1 : 0) : existing.active,
      sortOrder,
      id
    );
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      throw new Error("A service with that name already exists");
    }
    throw err;
  }
  return db.prepare(`SELECT * FROM services WHERE id = ?`).get(id);
}

function removeService(db, id) {
  const usage = db
    .prepare(`SELECT COUNT(*) AS c FROM property_services WHERE service_id = ?`)
    .get(id).c;
  if (usage > 0) {
    db.prepare(`UPDATE services SET active = 0 WHERE id = ?`).run(id);
    return { deactivated: true, deleted: false, usage };
  }
  db.prepare(`DELETE FROM services WHERE id = ?`).run(id);
  return { deactivated: false, deleted: true, usage: 0 };
}

function createPaidService(db, input = {}) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Paid service name is required");
  const maxOrder =
    db.prepare(`SELECT MAX(sort_order) AS m FROM paid_services`).get().m || 0;
  const sortOrder =
    input.sortOrder != null
      ? Number(input.sortOrder)
      : input.displayOrder != null
        ? Number(input.displayOrder)
        : maxOrder + 1;
  const price =
    input.price === "" || input.price == null ? null : Number(input.price);
  try {
    const info = db
      .prepare(
        `INSERT INTO paid_services
          (name, category, description, price, currency, pricing_type, active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
      )
      .run(
        name,
        String(input.category || "Other").trim() || "Other",
        String(input.description || "").trim(),
        Number.isFinite(price) ? price : null,
        String(input.currency || "EUR").trim() || "EUR",
        normalizePricingType(input.pricingType),
        sortOrder
      );
    return db
      .prepare(`SELECT * FROM paid_services WHERE id = ?`)
      .get(info.lastInsertRowid);
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      throw new Error("A paid service with that name already exists");
    }
    throw err;
  }
}

function updatePaidService(db, id, input = {}) {
  const existing = db.prepare(`SELECT * FROM paid_services WHERE id = ?`).get(id);
  if (!existing) return null;
  const sortOrder =
    input.sortOrder != null
      ? Number(input.sortOrder)
      : input.displayOrder != null
        ? Number(input.displayOrder)
        : existing.sort_order;
  let price = existing.price;
  if (input.price !== undefined) {
    price =
      input.price === "" || input.price == null ? null : Number(input.price);
    if (price != null && !Number.isFinite(price)) price = existing.price;
  }
  try {
    db.prepare(
      `UPDATE paid_services SET name = ?, category = ?, description = ?, price = ?,
       currency = ?, pricing_type = ?, active = ?, sort_order = ? WHERE id = ?`
    ).run(
      input.name != null ? String(input.name).trim() : existing.name,
      input.category != null ? String(input.category).trim() : existing.category,
      input.description != null
        ? String(input.description).trim()
        : existing.description || "",
      price,
      input.currency != null
        ? String(input.currency).trim() || "EUR"
        : existing.currency || "EUR",
      input.pricingType != null
        ? normalizePricingType(input.pricingType)
        : existing.pricing_type,
      input.active != null ? (input.active ? 1 : 0) : existing.active,
      sortOrder,
      id
    );
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      throw new Error("A paid service with that name already exists");
    }
    throw err;
  }
  return db.prepare(`SELECT * FROM paid_services WHERE id = ?`).get(id);
}

function removePaidService(db, id) {
  const usage = db
    .prepare(
      `SELECT COUNT(*) AS c FROM property_paid_services WHERE paid_service_id = ?`
    )
    .get(id).c;
  if (usage > 0) {
    db.prepare(`UPDATE paid_services SET active = 0 WHERE id = ?`).run(id);
    return { deactivated: true, deleted: false, usage };
  }
  db.prepare(`DELETE FROM paid_services WHERE id = ?`).run(id);
  return { deactivated: false, deleted: true, usage: 0 };
}

function mapCityRow(db, row) {
  const propertyCount = db
    .prepare(`SELECT COUNT(*) AS c FROM properties WHERE city_slug = ?`)
    .get(row.slug).c;
  const cover = db
    .prepare(
      `SELECT p.id, p.city_slug, p.street, p.folder, pi.filename
       FROM properties p
       JOIN property_images pi ON pi.property_id = p.id
       WHERE p.city_slug = ?
       ORDER BY pi.sort_order ASC, pi.id ASC
       LIMIT 1`
    )
    .get(row.slug);

  let coverUrl = "";
  if (cover) {
    coverUrl = [
      "properties",
      cover.city_slug,
      cover.street,
      cover.folder,
      "images",
      cover.filename,
    ]
      .map((part) =>
        encodeURIComponent(String(part || "")).replace(/[!'()*]/g, (c) =>
          "%" + c.charCodeAt(0).toString(16).toUpperCase()
        )
      )
      .join("/");
  }

  return {
    slug: row.slug,
    name: row.name,
    status: row.status,
    description: row.description || "",
    upcomingCount: row.upcoming_count || 0,
    sortOrder: row.sort_order || 0,
    propertyCount,
    coverUrl,
    listingPage: listingPageForCity(row.slug),
  };
}

function listCities(db, { includeHidden = true } = {}) {
  let sql = `SELECT * FROM cities`;
  if (!includeHidden) sql += ` WHERE status != 'hidden'`;
  sql += ` ORDER BY sort_order ASC, name ASC`;
  return db.prepare(sql).all().map((row) => mapCityRow(db, row));
}

function getCity(db, slug) {
  const row = db.prepare(`SELECT * FROM cities WHERE slug = ?`).get(slug);
  if (!row) return null;
  return mapCityRow(db, row);
}

function ensureDefaultCities(db) {
  const count = db.prepare(`SELECT COUNT(*) AS c FROM cities`).get().c;
  if (count > 0) {
    const missing = db
      .prepare(
        `SELECT DISTINCT city, city_slug FROM properties
         WHERE city_slug NOT IN (SELECT slug FROM cities)`
      )
      .all();
    const stamp = nowIso();
    const insert = db.prepare(
      `INSERT OR IGNORE INTO cities (slug, name, status, description, upcoming_count, sort_order, created_at, updated_at)
       VALUES (?, ?, 'live', '', 0, 100, ?, ?)`
    );
    missing.forEach((row) => {
      insert.run(row.city_slug, row.city, stamp, stamp);
    });
    return;
  }

  const stamp = nowIso();
  const defaults = [
    {
      slug: "geel",
      name: "Geel",
      status: "live",
      description:
        "A calm home base in Geel for professionals on assignment. Private living space instead of a hotel corridor.",
      upcoming_count: 5,
      sort_order: 1,
    },
    {
      slug: "moerbeke",
      name: "Moerbeke",
      status: "live",
      description:
        "Residential stay in Moerbeke — practical for company teams who need more than a room for the night.",
      upcoming_count: 7,
      sort_order: 2,
    },
    {
      slug: "mol",
      name: "Mol",
      status: "live",
      description:
        "A practical base in Mol for company teams on assignment — private living space instead of a hotel stay.",
      upcoming_count: 10,
      sort_order: 3,
    },
    {
      slug: "knokke-heist",
      name: "Knokke",
      status: "upcoming",
      description:
        "Business-friendly accommodation in Knokke. A home setting for work trips that last more than a weekend.",
      upcoming_count: 0,
      sort_order: 4,
    },
    {
      slug: "balen",
      name: "Balen",
      status: "upcoming",
      description: "A new MSA Stay location in Balen for companies inland.",
      upcoming_count: 0,
      sort_order: 5,
    },
  ];

  const insert = db.prepare(
    `INSERT INTO cities (slug, name, status, description, upcoming_count, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    defaults.forEach((c) =>
      insert.run(
        c.slug,
        c.name,
        c.status,
        c.description,
        c.upcoming_count,
        c.sort_order,
        stamp,
        stamp
      )
    );
  });
  tx();
}

function createCity(db, input) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("City name is required");
  let slug = String(input.slug || "").trim() || citySlugFromName(name);
  slug = slugify(slug);
  if (!slug) throw new Error("Invalid city slug");
  if (db.prepare(`SELECT slug FROM cities WHERE slug = ?`).get(slug)) {
    throw new Error("A city with that slug already exists");
  }

  const stamp = nowIso();
  const status =
    input.status === "upcoming" || input.status === "hidden"
      ? input.status
      : "live";

  db.prepare(
    `INSERT INTO cities (slug, name, status, description, upcoming_count, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    slug,
    name,
    status,
    String(input.description || "").trim(),
    input.upcomingCount != null ? Number(input.upcomingCount) || 0 : 0,
    input.sortOrder != null ? Number(input.sortOrder) || 0 : 100,
    stamp,
    stamp
  );

  const propsRoot = path.join(__dirname, "..", "properties", slug);
  fs.mkdirSync(propsRoot, { recursive: true });

  return getCity(db, slug);
}

function updateCity(db, slug, input) {
  const existing = db.prepare(`SELECT * FROM cities WHERE slug = ?`).get(slug);
  if (!existing) return null;

  const name =
    input.name != null ? String(input.name).trim() : existing.name;
  const status =
    input.status != null
      ? input.status === "upcoming" || input.status === "hidden"
        ? input.status
        : "live"
      : existing.status;
  const description =
    input.description != null
      ? String(input.description).trim()
      : existing.description;
  const upcomingCount =
    input.upcomingCount !== undefined
      ? Number(input.upcomingCount) || 0
      : existing.upcoming_count;
  const sortOrder =
    input.sortOrder !== undefined
      ? Number(input.sortOrder) || 0
      : existing.sort_order;

  db.prepare(
    `UPDATE cities SET name = ?, status = ?, description = ?, upcoming_count = ?, sort_order = ?, updated_at = ?
     WHERE slug = ?`
  ).run(name, status, description, upcomingCount, sortOrder, nowIso(), slug);

  if (name !== existing.name) {
    db.prepare(`UPDATE properties SET city = ? WHERE city_slug = ?`).run(name, slug);
  }

  return getCity(db, slug);
}

function deleteCity(db, slug) {
  const usage = db
    .prepare(`SELECT COUNT(*) AS c FROM properties WHERE city_slug = ?`)
    .get(slug).c;
  if (usage > 0) {
    db.prepare(`UPDATE cities SET status = 'hidden', updated_at = ? WHERE slug = ?`).run(
      nowIso(),
      slug
    );
    return { deactivated: true, deleted: false, usage };
  }
  db.prepare(`DELETE FROM cities WHERE slug = ?`).run(slug);
  return { deactivated: false, deleted: true, usage: 0 };
}

function getDb() {
  const db = ensureDb();
  ensureDefaultAmenities(db);
  seedMasterServices(db);
  seedMasterPaidServices(db);
  ensureDefaultCities(db);
  return db;
}

module.exports = {
  DB_PATH,
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
  setPropertyAmenities,
  setPropertyServices,
  setPropertyPaidServices,
  bulkAssignPropertyExtras,
  setPropertyImages,
  setPropertyCoordinates,
  propertyGeocodeQuery,
  listPropertiesWithCoordinates,
  listPropertiesMissingCoordinates,
  listCities,
  getCity,
  createCity,
  updateCity,
  deleteCity,
  citySlugFromName,
  listingPageForCity,
  slugify,
  AMENITY_CATEGORY_ORDER,
  SERVICE_CATEGORY_ORDER,
  PAID_SERVICE_CATEGORY_ORDER,
  PRICING_TYPES,
  categoryRank,
  mapAmenityRow,
  mapServiceRow,
  mapPaidServiceRow,
};
