async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: options.body
      ? { "Content-Type": "application/json", ...(options.headers || {}) }
      : options.headers,
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function setStatus(el, message, type) {
  if (!el) return;
  el.textContent = message || "";
  el.className = "status" + (type ? " " + type : "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

/** Display dates as DD/MM/YYYY everywhere in the UI. */
function formatDateDMY(value) {
  let date = value;
  if (!(value instanceof Date)) {
    const raw = String(value || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      date = parseISODate(raw);
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
      date = parseDateDMY(raw);
    } else {
      return "";
    }
  }
  if (!date || Number.isNaN(date.getTime())) return "";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return d + "/" + m + "/" + y;
}

function parseISODate(value) {
  const parts = String(value || "").split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

/** Parse DD/MM/YYYY (also accepts D/M/YYYY). Returns Date or null. */
function parseDateDMY(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const d = Number(match[1]);
  const m = Number(match[2]);
  const y = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

function toISODateString(value) {
  if (value instanceof Date) return formatDateISO(value);
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = parseISODate(raw);
    return Number.isNaN(d.getTime()) ? "" : formatDateISO(d);
  }
  const dmy = parseDateDMY(raw);
  return dmy ? formatDateISO(dmy) : "";
}

function eachDateInclusive(startIso, endIso) {
  const dates = [];
  let cur = parseISODate(startIso);
  const end = parseISODate(endIso);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime())) return dates;
  while (cur <= end) {
    dates.push(formatDateISO(cur));
    cur = addDays(cur, 1);
  }
  return dates;
}

function addDays(date, amount) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function datesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && aEnd >= bStart;
}

async function requireAuth(options = {}) {
  const data = await api("/api/staff/me");
  if (!data.user) {
    const next = encodeURIComponent(
      options.redirect || location.pathname + location.search
    );
    location.href = "login.html?next=" + next;
    return null;
  }
  return data;
}

function canEditOps(user) {
  const role = user && user.role;
  return role === "manager" || role === "admin";
}

function isAdmin(user) {
  return !!(user && user.role === "admin");
}

function fillHeader(user) {
  const nav = document.querySelector(".staff-nav");
  if (!nav || !user) return;
  const usersLink = canEditOps(user)
    ? '<a href="users.html">Users</a>'
    : "";
  nav.innerHTML =
    '<a href="calendar.html">Calendar</a>' +
    '<a href="reservations.html">Reservations</a>' +
    '<a href="schedule.html">My schedule</a>' +
    usersLink +
    '<span class="staff-user">' +
    escapeHtml(user.name) +
    ' <span class="role-pill ' +
    escapeHtml(user.role) +
    '">' +
    escapeHtml(user.role) +
    "</span></span>" +
    '<button type="button" class="btn" id="staff-logout">Sign out</button>';
  const btn = document.getElementById("staff-logout");
  if (btn) {
    btn.addEventListener("click", async function () {
      try {
        await api("/api/staff/logout", { method: "POST", body: "{}" });
      } catch (_) {}
      location.href = "login.html";
    });
  }
}

window.MSAStaff = {
  api,
  setStatus,
  escapeHtml,
  formatDateISO,
  formatDateDMY,
  parseISODate,
  parseDateDMY,
  toISODateString,
  eachDateInclusive,
  addDays,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  datesOverlap,
  requireAuth,
  fillHeader,
  canEditOps,
  isAdmin,
};
