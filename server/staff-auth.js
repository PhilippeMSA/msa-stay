const crypto = require("crypto");

const SESSION_COOKIE = "msa_staff_session";
const SESSION_DAYS = 30;
const AVAILABILITY_STATUSES = ["booked", "blocked", "hold"];

const AVAILABILITY_STATUS_LABELS = {
  booked: "Reservation",
  blocked: "Blocked",
  hold: "Hold",
};

const DAY_TASK_TYPES = [
  "check",
  "bed_change",
  "towels_change",
  "clean_up",
  "check_in",
  "check_out",
];

const DAY_TASK_LABELS = {
  check: "Check",
  bed_change: "Bed change",
  towels_change: "Towels change",
  clean_up: "Clean up",
  check_in: "Check in",
  check_out: "Check out",
};

/** Tasks that apply on every reservation day by default / as extras */
const DAILY_TASK_TYPES = ["check", "bed_change", "towels_change", "clean_up"];
/** Extra tasks typically for the first / last day */
const CHECK_IN_TASK_TYPES = ["check_in"];
const CHECK_OUT_TASK_TYPES = ["check_out"];

function getStaffInviteCode() {
  return String(process.env.STAFF_INVITE_CODE || "").trim();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return "scrypt$" + salt + "$" + hash;
}

function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const expected = parts[2];
  const actual = crypto.scryptSync(String(password), salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(actual, "hex")
    );
  } catch (_) {
    return false;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    out[key] = decodeURIComponent(value);
  });
  return out;
}

function sessionCookieHeader(token, maxAgeSeconds) {
  const parts = [
    SESSION_COOKIE + "=" + encodeURIComponent(token),
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (maxAgeSeconds != null) parts.push("Max-Age=" + maxAgeSeconds);
  return parts.join("; ");
}

function clearSessionCookieHeader() {
  return SESSION_COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase();
  if (value === "admin" || value === "owner") return "admin";
  if (value === "manager") return "manager";
  return "staff";
}

function canEditOps(user) {
  const role = user && normalizeRole(user.role);
  return role === "manager" || role === "admin";
}

function isAdmin(user) {
  return !!(user && normalizeRole(user.role) === "admin");
}

function mapStaffUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: normalizeRole(row.role),
    active: !!row.active,
    createdAt: row.created_at,
  };
}

function countStaffUsers(db) {
  return db.prepare(`SELECT COUNT(*) AS c FROM staff_users`).get().c;
}

function countManagers(db) {
  return db
    .prepare(
      `SELECT COUNT(*) AS c FROM staff_users WHERE role = 'manager' AND active = 1`
    )
    .get().c;
}

function countAdmins(db) {
  return db
    .prepare(
      `SELECT COUNT(*) AS c FROM staff_users WHERE role = 'admin' AND active = 1`
    )
    .get().c;
}

function listStaffUsers(db) {
  return db
    .prepare(
      `SELECT * FROM staff_users
       ORDER BY
         CASE
           WHEN role = 'admin' THEN 0
           WHEN role = 'manager' THEN 1
           ELSE 2
         END,
         active DESC,
         name ASC,
         email ASC`
    )
    .all()
    .map(mapStaffUser);
}

function setStaffUserRole(db, userId, role, actor) {
  const actorUser = mapStaffUser(
    typeof actor === "object" && actor && actor.id != null
      ? getStaffUserById(db, actor.id) || actor
      : getStaffUserById(db, actor)
  );
  if (!actorUser || !canEditOps(actorUser)) {
    throw new Error("Managers only");
  }

  const nextRole = normalizeRole(role);
  const target = getStaffUserById(db, userId);
  if (!target) {
    throw new Error("User not found");
  }
  if (!target.active && nextRole !== normalizeRole(target.role)) {
    throw new Error("Reactivate the user before changing their role");
  }

  const currentRole = normalizeRole(target.role);
  if (currentRole === nextRole) {
    return mapStaffUser(target);
  }

  if (!isAdmin(actorUser)) {
    if (currentRole === "admin" || nextRole === "admin") {
      throw new Error("Only an admin can change admin roles");
    }
    if (nextRole !== "manager" && nextRole !== "staff") {
      throw new Error("Invalid role");
    }
  }

  if (currentRole === "admin" && nextRole !== "admin") {
    if (countAdmins(db) <= 1) {
      throw new Error("You need at least one admin");
    }
  }

  if (
    currentRole === "manager" &&
    nextRole === "staff" &&
    countManagers(db) <= 1 &&
    countAdmins(db) === 0
  ) {
    throw new Error("You need at least one manager");
  }

  db.prepare(
    `UPDATE staff_users SET role = ?, updated_at = ? WHERE id = ?`
  ).run(nextRole, new Date().toISOString(), userId);

  return mapStaffUser(getStaffUserById(db, userId));
}

function setStaffUserActive(db, userId, active, actor) {
  const actorUser = mapStaffUser(
    typeof actor === "object" && actor && actor.id != null
      ? getStaffUserById(db, actor.id) || actor
      : getStaffUserById(db, actor)
  );
  if (!isAdmin(actorUser)) {
    throw new Error("Admins only");
  }

  const target = getStaffUserById(db, userId);
  if (!target) {
    throw new Error("User not found");
  }

  const nextActive = !!active;
  if (!!target.active === nextActive) {
    return mapStaffUser(target);
  }

  if (!nextActive) {
    if (normalizeRole(target.role) === "admin" && countAdmins(db) <= 1) {
      throw new Error("You need at least one active admin");
    }
    if (Number(userId) === Number(actorUser.id)) {
      throw new Error("You cannot deactivate your own account");
    }
  }

  db.prepare(
    `UPDATE staff_users SET active = ?, updated_at = ? WHERE id = ?`
  ).run(nextActive ? 1 : 0, new Date().toISOString(), userId);

  if (!nextActive) {
    db.prepare(`DELETE FROM staff_sessions WHERE user_id = ?`).run(userId);
  }

  return mapStaffUser(getStaffUserById(db, userId));
}

function resetStaffUserPassword(db, userId, password, actor) {
  const actorUser = mapStaffUser(
    typeof actor === "object" && actor && actor.id != null
      ? getStaffUserById(db, actor.id) || actor
      : getStaffUserById(db, actor)
  );
  if (!isAdmin(actorUser)) {
    throw new Error("Admins only");
  }

  const target = getStaffUserById(db, userId);
  if (!target) {
    throw new Error("User not found");
  }

  const nextPassword = String(password || "");
  if (nextPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  db.prepare(
    `UPDATE staff_users SET password_hash = ?, updated_at = ? WHERE id = ?`
  ).run(hashPassword(nextPassword), new Date().toISOString(), userId);

  db.prepare(`DELETE FROM staff_sessions WHERE user_id = ?`).run(userId);

  return mapStaffUser(target);
}

function getStaffUserByEmail(db, email) {
  return db
    .prepare(`SELECT * FROM staff_users WHERE email = ? COLLATE NOCASE`)
    .get(String(email || "").trim());
}

function getStaffUserById(db, id) {
  return db.prepare(`SELECT * FROM staff_users WHERE id = ?`).get(id);
}

function createStaffUser(db, input = {}) {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  const name = String(input.name || "").trim();
  const password = String(input.password || "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address");
  }
  if (!name || name.length < 2) {
    throw new Error("Enter your name");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const inviteRequired = getStaffInviteCode();
  if (inviteRequired) {
    const provided = String(input.inviteCode || "").trim();
    if (provided !== inviteRequired) {
      throw new Error("Invalid invite code");
    }
  }

  const existingCount = countStaffUsers(db);
  const role = existingCount === 0 ? "admin" : "staff";
  const now = new Date().toISOString();

  try {
    const info = db
      .prepare(
        `INSERT INTO staff_users
          (email, name, password_hash, role, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`
      )
      .run(email, name, hashPassword(password), role, now, now);
    return mapStaffUser(getStaffUserById(db, info.lastInsertRowid));
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      throw new Error("An account with that email already exists");
    }
    throw err;
  }
}

function authenticateStaffUser(db, email, password) {
  const row = getStaffUserByEmail(db, email);
  if (!row || !row.active) {
    throw new Error("Invalid email or password");
  }
  if (!verifyPassword(password, row.password_hash)) {
    throw new Error("Invalid email or password");
  }
  return mapStaffUser(row);
}

function createStaffSession(db, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare(
    `INSERT INTO staff_sessions (token, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(token, userId, expires.toISOString(), now.toISOString());
  return {
    token,
    expiresAt: expires.toISOString(),
    maxAgeSeconds: SESSION_DAYS * 24 * 60 * 60,
  };
}

function destroyStaffSession(db, token) {
  if (!token) return;
  db.prepare(`DELETE FROM staff_sessions WHERE token = ?`).run(token);
}

function cleanupExpiredSessions(db) {
  db.prepare(`DELETE FROM staff_sessions WHERE expires_at < ?`).run(
    new Date().toISOString()
  );
}

function getSessionUser(db, req) {
  cleanupExpiredSessions(db);
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM staff_sessions s
       JOIN staff_users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at >= ? AND u.active = 1`
    )
    .get(token, new Date().toISOString());
  if (!row) return null;
  return { user: mapStaffUser(row), token };
}

function requireStaff(db, req, res, sendJson) {
  const session = getSessionUser(db, req);
  if (!session) {
    sendJson(res, 401, { error: "Please sign in" });
    return null;
  }
  return session;
}

function requireManager(db, req, res, sendJson) {
  const session = requireStaff(db, req, res, sendJson);
  if (!session) return null;
  if (!canEditOps(session.user)) {
    sendJson(res, 403, { error: "Managers only" });
    return null;
  }
  return session;
}

function requireAdmin(db, req, res, sendJson) {
  const session = requireStaff(db, req, res, sendJson);
  if (!session) return null;
  if (!isAdmin(session.user)) {
    sendJson(res, 403, { error: "Admins only" });
    return null;
  }
  return session;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const parts = String(value).split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return (
    !Number.isNaN(d.getTime()) &&
    d.getFullYear() === parts[0] &&
    d.getMonth() === parts[1] - 1 &&
    d.getDate() === parts[2]
  );
}

function normalizeAvailabilityStatus(status) {
  let value = String(status || "booked")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  // Older task-as-status values become reservations
  if (
    [
      "cleaning",
      "clean_up",
      "check",
      "check_in",
      "check_out",
      "bed_change",
      "towels_change",
    ].indexOf(value) !== -1
  ) {
    value = "booked";
  }
  return AVAILABILITY_STATUSES.indexOf(value) !== -1 ? value : "booked";
}

function availabilityStatusLabel(status) {
  const normalized = normalizeAvailabilityStatus(status);
  return AVAILABILITY_STATUS_LABELS[normalized] || normalized;
}

function normalizeDayTaskType(type) {
  let value = String(type || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (value === "cleaning") value = "clean_up";
  return DAY_TASK_TYPES.indexOf(value) !== -1 ? value : null;
}

function dayTaskLabel(type) {
  const normalized = normalizeDayTaskType(type);
  return normalized ? DAY_TASK_LABELS[normalized] : String(type || "");
}

function eachDateInclusive(startDate, endDate) {
  const dates = [];
  const start = new Date(
    Number(startDate.slice(0, 4)),
    Number(startDate.slice(5, 7)) - 1,
    Number(startDate.slice(8, 10))
  );
  const end = new Date(
    Number(endDate.slice(0, 4)),
    Number(endDate.slice(5, 7)) - 1,
    Number(endDate.slice(8, 10))
  );
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(y + "-" + m + "-" + day);
  }
  return dates;
}

function parseGuestCount(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Guests must be a number 0 or higher");
  }
  return Math.floor(n);
}

function listDayTasksForBlock(db, blockId) {
  return db
    .prepare(
      `SELECT t.*, u.name AS assignee_name
       FROM availability_day_tasks t
       LEFT JOIN staff_users u ON u.id = t.assignee_id
       WHERE t.block_id = ?
       ORDER BY t.task_date ASC, t.task_type ASC`
    )
    .all(blockId)
    .map((row) => mapDayTaskRow(row));
}

function mapDayTaskRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    blockId: row.block_id,
    date: row.task_date,
    type: row.task_type,
    typeLabel: dayTaskLabel(row.task_type),
    completed: !!row.completed,
    assigneeId: row.assignee_id != null ? Number(row.assignee_id) : null,
    assigneeName: row.assignee_name || null,
    propertyId: row.property_id || null,
    propertyName: row.property_name || null,
    city: row.city || null,
    guestCount:
      row.guest_count == null || row.guest_count === ""
        ? null
        : Number(row.guest_count),
    reservationNote: row.reservation_note || null,
    reservationStart: row.start_date || null,
    reservationEnd: row.end_date || null,
  };
}

function ensureDefaultChecks(db, blockId, startDate, endDate) {
  const dates = eachDateInclusive(startDate, endDate);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO availability_day_tasks
      (block_id, task_date, task_type, completed, assignee_id)
     VALUES (?, ?, 'check', 0, NULL)`
  );
  const delOutside = db.prepare(
    `DELETE FROM availability_day_tasks
     WHERE block_id = ? AND (task_date < ? OR task_date > ?)`
  );
  const tx = db.transaction(() => {
    delOutside.run(blockId, startDate, endDate);
    dates.forEach((date) => insert.run(blockId, date));
  });
  tx();
}

function setDayTasksForBlock(db, blockId, tasks) {
  const block = db
    .prepare(`SELECT * FROM availability_blocks WHERE id = ?`)
    .get(blockId);
  if (!block) throw new Error("Reservation not found");

  const dates = eachDateInclusive(block.start_date, block.end_date);
  const allowedDates = new Set(dates);
  const planned = {};

  (tasks || []).forEach((task) => {
    const type = normalizeDayTaskType(task.type || task.taskType);
    const date = String(task.date || task.taskDate || "").trim();
    if (!type || !allowedDates.has(date)) return;
    let assigneeId = null;
    if (task.assigneeId != null && task.assigneeId !== "") {
      const id = Number(task.assigneeId);
      if (Number.isFinite(id)) {
        const user = getStaffUserById(db, id);
        if (user && user.active) assigneeId = id;
      }
    }
    planned[date + "|" + type] = {
      completed: task.completed ? 1 : 0,
      assigneeId: assigneeId,
    };
  });

  dates.forEach((date) => {
    const key = date + "|check";
    if (planned[key] == null) {
      planned[key] = { completed: 0, assigneeId: null };
    }
  });

  const clear = db.prepare(
    `DELETE FROM availability_day_tasks WHERE block_id = ?`
  );
  const insert = db.prepare(
    `INSERT INTO availability_day_tasks
      (block_id, task_date, task_type, completed, assignee_id)
     VALUES (?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    clear.run(blockId);
    Object.keys(planned).forEach((key) => {
      const parts = key.split("|");
      const item = planned[key];
      insert.run(
        blockId,
        parts[0],
        parts[1],
        item.completed,
        item.assigneeId
      );
    });
  });
  tx();
  return listDayTasksForBlock(db, blockId);
}

function listMySchedule(db, userId, filters = {}) {
  const from = filters.from || new Date().toISOString().slice(0, 10);
  let to = filters.to;
  if (!to) {
    const d = new Date(from + "T00:00:00");
    d.setDate(d.getDate() + 14);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    to = y + "-" + m + "-" + day;
  }
  return db
    .prepare(
      `SELECT t.*,
              b.property_id, b.guest_count, b.note AS reservation_note,
              b.start_date, b.end_date,
              p.name AS property_name, p.city,
              u.name AS assignee_name
       FROM availability_day_tasks t
       JOIN availability_blocks b ON b.id = t.block_id
       JOIN properties p ON p.id = b.property_id
       LEFT JOIN staff_users u ON u.id = t.assignee_id
       WHERE t.assignee_id = ?
         AND t.task_date >= ?
         AND t.task_date <= ?
       ORDER BY t.task_date ASC, p.city ASC, p.name ASC, t.task_type ASC`
    )
    .all(userId, from, to)
    .map(mapDayTaskRow);
}

function setDayTaskCompleted(db, taskId, completed, actor) {
  const row = db
    .prepare(
      `SELECT t.*, u.role AS actor_role
       FROM availability_day_tasks t
       LEFT JOIN staff_users u ON u.id = ?
       WHERE t.id = ?`
    )
    .get(actor && actor.id, taskId);
  if (!row) return null;
  const isElevated = canEditOps(actor);
  const isAssignee = row.assignee_id === (actor && actor.id);
  if (!isElevated && !isAssignee) {
    throw new Error("You can only update tasks assigned to you");
  }
  db.prepare(
    `UPDATE availability_day_tasks SET completed = ? WHERE id = ?`
  ).run(completed ? 1 : 0, taskId);
  return listDayTasksForBlock(db, row.block_id).find((t) => t.id === taskId);
}

function mapAvailabilityBlock(row, db) {
  if (!row) return null;
  const status = normalizeAvailabilityStatus(row.status);
  const block = {
    id: row.id,
    propertyId: row.property_id,
    propertyName: row.property_name || null,
    city: row.city || null,
    citySlug: row.city_slug || null,
    startDate: row.start_date,
    endDate: row.end_date,
    status: status,
    statusLabel: availabilityStatusLabel(status),
    note: row.note || "",
    guestCount:
      row.guest_count == null || row.guest_count === ""
        ? null
        : Number(row.guest_count),
    createdBy: row.created_by || null,
    createdByName: row.created_by_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tasks: [],
  };
  if (db && block.id) {
    if (status === "booked") {
      const existing = listDayTasksForBlock(db, block.id);
      if (!existing.length) {
        ensureDefaultChecks(db, block.id, block.startDate, block.endDate);
      }
    }
    block.tasks = listDayTasksForBlock(db, block.id);
  }
  return block;
}

function listAvailabilityBlocks(db, filters = {}) {
  let sql = `
    SELECT b.*, p.name AS property_name, p.city, p.city_slug,
           u.name AS created_by_name
    FROM availability_blocks b
    JOIN properties p ON p.id = b.property_id
    LEFT JOIN staff_users u ON u.id = b.created_by
    WHERE 1 = 1`;
  const params = [];
  if (filters.propertyId) {
    sql += ` AND b.property_id = ?`;
    params.push(filters.propertyId);
  }
  if (filters.citySlug) {
    sql += ` AND p.city_slug = ?`;
    params.push(filters.citySlug);
  }
  if (filters.from) {
    sql += ` AND b.end_date >= ?`;
    params.push(filters.from);
  }
  if (filters.to) {
    sql += ` AND b.start_date <= ?`;
    params.push(filters.to);
  }
  sql += ` ORDER BY b.start_date ASC, p.city ASC, p.name ASC`;
  return db.prepare(sql).all(...params).map((row) => mapAvailabilityBlock(row, db));
}

function getAvailabilityBlock(db, id) {
  const row = db
    .prepare(
      `SELECT b.*, p.name AS property_name, p.city, p.city_slug,
              u.name AS created_by_name
       FROM availability_blocks b
       JOIN properties p ON p.id = b.property_id
       LEFT JOIN staff_users u ON u.id = b.created_by
       WHERE b.id = ?`
    )
    .get(id);
  return mapAvailabilityBlock(row, db);
}

function createAvailabilityBlock(db, input = {}, userId) {
  const propertyId = String(input.propertyId || "").trim();
  const startDate = String(input.startDate || "").trim();
  const endDate = String(input.endDate || "").trim();
  const status = normalizeAvailabilityStatus(input.status);
  const note = String(input.note || "").trim();
  const guestCount = parseGuestCount(input.guestCount);

  if (!propertyId) throw new Error("Select a property");
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    throw new Error("Use valid start and end dates");
  }
  if (endDate < startDate) {
    throw new Error("End date must be on or after the start date");
  }
  if (status === "booked" && guestCount == null) {
    throw new Error("Enter the number of guests for a reservation");
  }
  const property = db
    .prepare(`SELECT id FROM properties WHERE id = ?`)
    .get(propertyId);
  if (!property) throw new Error("Property not found");

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO availability_blocks
        (property_id, start_date, end_date, status, note, guest_count, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      propertyId,
      startDate,
      endDate,
      status,
      note,
      status === "booked" ? guestCount : null,
      userId || null,
      now,
      now
    );

  const id = info.lastInsertRowid;
  if (status === "booked") {
    ensureDefaultChecks(db, id, startDate, endDate);
    if (Array.isArray(input.tasks) && input.tasks.length) {
      setDayTasksForBlock(db, id, input.tasks);
    }
  }
  return getAvailabilityBlock(db, id);
}

function updateAvailabilityBlock(db, id, input = {}) {
  const existing = db
    .prepare(`SELECT * FROM availability_blocks WHERE id = ?`)
    .get(id);
  if (!existing) return null;

  const propertyId =
    input.propertyId != null
      ? String(input.propertyId).trim()
      : existing.property_id;
  const startDate =
    input.startDate != null
      ? String(input.startDate).trim()
      : existing.start_date;
  const endDate =
    input.endDate != null ? String(input.endDate).trim() : existing.end_date;
  const status =
    input.status != null
      ? normalizeAvailabilityStatus(input.status)
      : normalizeAvailabilityStatus(existing.status);
  const note =
    input.note != null ? String(input.note).trim() : existing.note || "";
  let guestCount =
    input.guestCount !== undefined
      ? parseGuestCount(input.guestCount)
      : existing.guest_count == null
        ? null
        : Number(existing.guest_count);

  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    throw new Error("Use valid start and end dates");
  }
  if (endDate < startDate) {
    throw new Error("End date must be on or after the start date");
  }
  if (status === "booked" && (guestCount == null || guestCount < 0)) {
    throw new Error("Enter the number of guests for a reservation");
  }
  if (status !== "booked") guestCount = null;

  const property = db
    .prepare(`SELECT id FROM properties WHERE id = ?`)
    .get(propertyId);
  if (!property) throw new Error("Property not found");

  db.prepare(
    `UPDATE availability_blocks
     SET property_id = ?, start_date = ?, end_date = ?, status = ?, note = ?,
         guest_count = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    propertyId,
    startDate,
    endDate,
    status,
    note,
    guestCount,
    new Date().toISOString(),
    id
  );

  if (status === "booked") {
    ensureDefaultChecks(db, id, startDate, endDate);
    if (Array.isArray(input.tasks)) {
      setDayTasksForBlock(db, id, input.tasks);
    }
  } else {
    db.prepare(`DELETE FROM availability_day_tasks WHERE block_id = ?`).run(id);
  }

  return getAvailabilityBlock(db, id);
}

function deleteAvailabilityBlock(db, id) {
  const info = db
    .prepare(`DELETE FROM availability_blocks WHERE id = ?`)
    .run(id);
  return info.changes > 0;
}

module.exports = {
  SESSION_COOKIE,
  AVAILABILITY_STATUSES,
  AVAILABILITY_STATUS_LABELS,
  DAY_TASK_TYPES,
  DAY_TASK_LABELS,
  DAILY_TASK_TYPES,
  CHECK_IN_TASK_TYPES,
  CHECK_OUT_TASK_TYPES,
  availabilityStatusLabel,
  dayTaskLabel,
  listMySchedule,
  setDayTaskCompleted,
  getStaffInviteCode,
  mapStaffUser,
  normalizeRole,
  canEditOps,
  isAdmin,
  countStaffUsers,
  countManagers,
  countAdmins,
  listStaffUsers,
  setStaffUserRole,
  setStaffUserActive,
  resetStaffUserPassword,
  createStaffUser,
  authenticateStaffUser,
  createStaffSession,
  destroyStaffSession,
  getSessionUser,
  requireStaff,
  requireManager,
  requireAdmin,
  sessionCookieHeader,
  clearSessionCookieHeader,
  listAvailabilityBlocks,
  getAvailabilityBlock,
  createAvailabilityBlock,
  updateAvailabilityBlock,
  deleteAvailabilityBlock,
};
