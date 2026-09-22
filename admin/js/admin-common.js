async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: options.body
      ? { "Content-Type": "application/json", ...(options.headers || {}) }
      : options.headers,
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function qs(sel, root = document) {
  return root.querySelector(sel);
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

function adminNav(active) {
  const links = [
    ["index.html", "Properties"],
    ["cities.html", "Cities"],
    ["amenities.html", "Amenities"],
    ["services.html", "Services"],
    ["paid-services.html", "Paid services"],
  ];
  return links
    .map(function (item) {
      const cls = item[0] === active ? ' class="is-active"' : "";
      return "<a" + cls + ' href="' + item[0] + '">' + item[1] + "</a>";
    })
    .join("") + '<a href="../index.html">View site</a>';
}

function fillAdminNav(active) {
  document.querySelectorAll(".admin-nav").forEach(function (nav) {
    nav.innerHTML = adminNav(active);
  });
}

function categoryOptions(categories, selected) {
  return (categories || [])
    .map(function (cat) {
      return (
        '<option value="' +
        escapeHtml(cat) +
        '"' +
        (cat === selected ? " selected" : "") +
        ">" +
        escapeHtml(cat) +
        "</option>"
      );
    })
    .join("");
}

function formatPrice(price, currency, pricingType) {
  if (price == null || price === "") return "Price on request";
  const amount = Number(price);
  if (!Number.isFinite(amount)) return "Price on request";
  const symbol = currency === "EUR" || !currency ? "€" : currency + " ";
  const labels = {
    per_stay: "stay",
    per_night: "night",
    per_person: "person",
    per_person_per_night: "person / night",
    per_hour: "hour",
    per_item: "item",
    custom: "",
  };
  const suffix = labels[pricingType] || "";
  return (
    symbol +
    amount.toFixed(amount % 1 === 0 ? 0 : 2) +
    (suffix ? " / " + suffix : "")
  );
}

/**
 * Compact searchable multi-select picker grouped by category.
 * mountEl: container element
 * options: { items, selectedIds, categories, getMeta?, emptyLabel? }
 */
function createCatalogPicker(mountEl, options) {
  const state = {
    items: options.items || [],
    selected: new Set((options.selectedIds || []).map(Number)),
    categories: options.categories || [],
    query: "",
    category: "",
  };

  mountEl.innerHTML =
    '<div class="picker-toolbar">' +
    '<input type="search" class="picker-search" placeholder="Search…" />' +
    '<select class="picker-category"><option value="">All categories</option></select>' +
    "</div>" +
    '<div class="picker-selected muted"></div>' +
    '<div class="picker-groups"></div>';

  const search = mountEl.querySelector(".picker-search");
  const categorySelect = mountEl.querySelector(".picker-category");
  const selectedEl = mountEl.querySelector(".picker-selected");
  const groupsEl = mountEl.querySelector(".picker-groups");

  categorySelect.innerHTML =
    '<option value="">All categories</option>' +
    state.categories
      .map(function (cat) {
        return (
          '<option value="' + escapeHtml(cat) + '">' + escapeHtml(cat) + "</option>"
        );
      })
      .join("");

  function selectedItems() {
    return state.items.filter(function (item) {
      return state.selected.has(item.id);
    });
  }

  function renderSelected() {
    const selected = selectedItems();
    if (!selected.length) {
      selectedEl.textContent = options.emptyLabel || "None selected yet.";
      return;
    }
    selectedEl.innerHTML =
      "<strong>" +
      selected.length +
      " selected:</strong> " +
      selected
        .map(function (item) {
          return escapeHtml(item.name);
        })
        .join(", ");
  }

  function matches(item) {
    if (state.category && item.category !== state.category) return false;
    if (!state.query) return true;
    const q = state.query.toLowerCase();
    return (
      String(item.name || "")
        .toLowerCase()
        .indexOf(q) !== -1 ||
      String(item.description || "")
        .toLowerCase()
        .indexOf(q) !== -1
    );
  }

  function renderGroups() {
    const byCategory = {};
    state.items.forEach(function (item) {
      if (!item.active && !state.selected.has(item.id)) return;
      if (!matches(item)) return;
      const cat = item.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    });

    const order = state.categories.slice();
    Object.keys(byCategory).forEach(function (cat) {
      if (order.indexOf(cat) === -1) order.push(cat);
    });

    const html = order
      .filter(function (cat) {
        return byCategory[cat] && byCategory[cat].length;
      })
      .map(function (cat) {
        const rows = byCategory[cat]
          .map(function (item) {
            const meta = options.getMeta ? options.getMeta(item) : "";
            const inactive = item.active
              ? ""
              : ' <span class="muted">(inactive)</span>';
            return (
              '<label class="amenity-item picker-item">' +
              '<input type="checkbox" value="' +
              item.id +
              '"' +
              (state.selected.has(item.id) ? " checked" : "") +
              " /> " +
              '<span class="picker-item-label">' +
              escapeHtml(item.name) +
              inactive +
              (meta
                ? ' <span class="picker-meta">' + escapeHtml(meta) + "</span>"
                : "") +
              "</span></label>"
            );
          })
          .join("");
        return (
          '<div class="picker-group"><h3 class="picker-group-title">' +
          escapeHtml(cat) +
          "</h3><div class=\"amenity-grid\">" +
          rows +
          "</div></div>"
        );
      })
      .join("");

    groupsEl.innerHTML = html || '<p class="muted">No matching items.</p>';
  }

  function render() {
    renderSelected();
    renderGroups();
  }

  search.addEventListener("input", function () {
    state.query = search.value.trim();
    renderGroups();
  });

  categorySelect.addEventListener("change", function () {
    state.category = categorySelect.value;
    renderGroups();
  });

  groupsEl.addEventListener("change", function (event) {
    const input = event.target.closest('input[type="checkbox"]');
    if (!input) return;
    const id = Number(input.value);
    if (input.checked) state.selected.add(id);
    else state.selected.delete(id);
    renderSelected();
  });

  render();

  return {
    getSelectedIds: function () {
      return Array.from(state.selected);
    },
    setSelectedIds: function (ids) {
      state.selected = new Set((ids || []).map(Number));
      render();
    },
    setItems: function (items) {
      state.items = items || [];
      render();
    },
  };
}

window.MSAAdmin = {
  api,
  qs,
  setStatus,
  escapeHtml,
  fillAdminNav,
  categoryOptions,
  formatPrice,
  createCatalogPicker,
};
