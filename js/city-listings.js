/**
 * Renders city listing pages from the API.
 * Building filter + sort/filter by guests, bedrooms, kitchen, status.
 * Expects: data-city-slug on #city-listings
 */
(function () {
  function cardTags(property) {
    const basics = property.basics || {};
    const amenities = property.amenities || [];
    const tags = [];

    if (basics.maxGuests != null) {
      tags.push(
        basics.maxGuests === 1
          ? "Max 1 guest"
          : "Max " + basics.maxGuests + " guests"
      );
    }
    if (basics.bedrooms != null) {
      tags.push(
        basics.bedrooms === 1 ? "1 bedroom" : basics.bedrooms + " bedrooms"
      );
    }
    if (basics.kitchen) tags.push(basics.kitchen);
    if (basics.bedType) tags.push(basics.bedType);
    if (amenities.indexOf("Workspace") !== -1) tags.push("Workspace");
    else if (amenities.indexOf("Parking") !== -1) tags.push("Parking");

    if (property.status === "upcoming") tags.unshift("Upcoming");
    return tags.slice(0, 4);
  }

  function shortDescription(text) {
    if (!text) return "";
    const trimmed = text.trim();
    if (trimmed.length <= 140) return trimmed;
    const cut = trimmed.slice(0, 137);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim() + "…";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildingKey(property) {
    return property.street || "__other__";
  }

  function renderCard(property, buildingLabels) {
    const isUpcoming = property.status === "upcoming";
    const cover =
      property.images && property.images.length
        ? window.msaPropertyImageUrl(property, property.images[0])
        : "";
    const visualClass = cover
      ? 'class="unit-visual" style="background-image: url(&quot;' +
        cover +
        '&quot;)"'
      : 'class="unit-visual unit-visual--empty"';
    const badgeClass = isUpcoming ? "badge badge--upcoming" : "badge";
    const badgeText = isUpcoming ? "Upcoming" : "Available";
    const tags = cardTags(property)
      .map(function (t) {
        return "<li>" + escapeHtml(t) + "</li>";
      })
      .join("");
    const key = buildingKey(property);

    return (
      '<a class="unit-card-link" href="property.html?id=' +
      encodeURIComponent(property.id) +
      '" data-building="' +
      escapeHtml(key) +
      '">' +
      '<article class="unit-card' +
      (isUpcoming ? " unit-card--upcoming" : "") +
      '">' +
      "<div " +
      visualClass +
      ' role="img" aria-label="' +
      escapeHtml(property.name) +
      '">' +
      '<span class="' +
      badgeClass +
      '">' +
      badgeText +
      "</span></div>" +
      '<div class="unit-body">' +
      "<h3>" +
      escapeHtml(property.name) +
      "</h3>" +
      '<p class="unit-address">' +
      escapeHtml(property.city) +
      (buildingLabels[key] ? " · " + escapeHtml(buildingLabels[key]) : "") +
      "</p>" +
      "<p>" +
      escapeHtml(shortDescription(property.description)) +
      "</p>" +
      '<ul class="tags">' +
      tags +
      "</ul>" +
      "</div></article></a>"
    );
  }

  function uniqueSorted(values) {
    const out = [];
    values.forEach(function (v) {
      if (v == null || v === "") return;
      if (out.indexOf(v) === -1) out.push(v);
    });
    out.sort(function (a, b) {
      if (typeof a === "number" && typeof b === "number") return a - b;
      return String(a).localeCompare(String(b), undefined, { numeric: true });
    });
    return out;
  }

  function applyFilters(properties, state) {
    return properties.filter(function (p) {
      const basics = p.basics || {};
      const amenities = p.amenities || [];

      if (state.building !== "all" && buildingKey(p) !== state.building) {
        return false;
      }
      if (state.status && p.status !== state.status) return false;
      if (
        state.minGuests !== "" &&
        (basics.maxGuests == null ||
          Number(basics.maxGuests) < Number(state.minGuests))
      ) {
        return false;
      }
      if (
        state.minBedrooms !== "" &&
        (basics.bedrooms == null ||
          Number(basics.bedrooms) < Number(state.minBedrooms))
      ) {
        return false;
      }
      if (state.kitchen && basics.kitchen !== state.kitchen) return false;
      if (state.bedType && basics.bedType !== state.bedType) return false;
      if (state.amenity === "Workspace" && amenities.indexOf("Workspace") === -1) {
        return false;
      }
      if (state.amenity === "Parking" && amenities.indexOf("Parking") === -1) {
        return false;
      }
      return true;
    });
  }

  function sortProperties(list, sortKey) {
    const copy = list.slice();
    copy.sort(function (a, b) {
      const ba = a.basics || {};
      const bb = b.basics || {};
      switch (sortKey) {
        case "guests-desc":
          return (Number(bb.maxGuests) || 0) - (Number(ba.maxGuests) || 0);
        case "guests-asc":
          return (Number(ba.maxGuests) || 0) - (Number(bb.maxGuests) || 0);
        case "bedrooms-desc":
          return (Number(bb.bedrooms) || 0) - (Number(ba.bedrooms) || 0);
        case "bedrooms-asc":
          return (Number(ba.bedrooms) || 0) - (Number(bb.bedrooms) || 0);
        case "name-desc":
          return String(b.name || "").localeCompare(String(a.name || ""));
        case "status":
          if (a.status === b.status) {
            return String(a.name || "").localeCompare(String(b.name || ""));
          }
          return a.status === "available" ? -1 : 1;
        case "name-asc":
        default:
          return String(a.name || "").localeCompare(String(b.name || ""));
      }
    });
    return copy;
  }

  function optionHtml(value, label, selected) {
    return (
      '<option value="' +
      escapeHtml(String(value)) +
      '"' +
      (String(selected) === String(value) ? " selected" : "") +
      ">" +
      escapeHtml(label) +
      "</option>"
    );
  }

  async function init() {
    const root = document.getElementById("city-listings");
    if (!root || !window.msaFetchProperties) return;

    const citySlug =
      root.getAttribute("data-city-slug") ||
      new URLSearchParams(window.location.search).get("slug") ||
      new URLSearchParams(window.location.search).get("city");
    if (citySlug) root.setAttribute("data-city-slug", citySlug);

    const properties = await window.msaFetchProperties(
      citySlug ? { citySlug: citySlug } : {}
    );

    const meta = document.getElementById("city-page-meta");

    if (!properties.length) {
      if (meta) meta.textContent = "0 units";
      root.innerHTML =
        '<section class="section listing-section"><p class="lede">No properties listed for this city yet.</p></section>';
      return;
    }

    const buildings = [];
    properties.forEach(function (p) {
      const key = buildingKey(p);
      if (buildings.indexOf(key) === -1) buildings.push(key);
    });
    buildings.sort(function (a, b) {
      return a.localeCompare(b);
    });

    const buildingLabels = {};
    buildings.forEach(function (key, index) {
      buildingLabels[key] = "Building " + (index + 1);
    });

    const guestOptions = uniqueSorted(
      properties.map(function (p) {
        return p.basics && p.basics.maxGuests != null
          ? Number(p.basics.maxGuests)
          : null;
      })
    );
    const bedroomOptions = uniqueSorted(
      properties.map(function (p) {
        return p.basics && p.basics.bedrooms != null
          ? Number(p.basics.bedrooms)
          : null;
      })
    );
    const kitchenOptions = uniqueSorted(
      properties.map(function (p) {
        return (p.basics && p.basics.kitchen) || "";
      })
    );
    const bedTypeOptions = uniqueSorted(
      properties.map(function (p) {
        return (p.basics && p.basics.bedType) || "";
      })
    );
    const hasWorkspace = properties.some(function (p) {
      return (p.amenities || []).indexOf("Workspace") !== -1;
    });
    const hasParking = properties.some(function (p) {
      return (p.amenities || []).indexOf("Parking") !== -1;
    });
    const hasUpcoming = properties.some(function (p) {
      return p.status === "upcoming";
    });
    const hasAvailable = properties.some(function (p) {
      return p.status !== "upcoming";
    });

    const state = {
      building: "all",
      sort: "name-asc",
      minGuests: "",
      minBedrooms: "",
      kitchen: "",
      bedType: "",
      status: "",
      amenity: "",
    };

    function renderFiltersBar() {
      let buildingHtml = "";
      if (buildings.length > 1) {
        buildingHtml =
          '<div class="building-filter" role="group" aria-label="Filter by building">' +
          '<button type="button" data-building="all" aria-pressed="' +
          (state.building === "all" ? "true" : "false") +
          '"' +
          (state.building === "all" ? ' class="is-active"' : "") +
          ">All</button>" +
          buildings
            .map(function (key) {
              const active = state.building === key;
              return (
                '<button type="button" data-building="' +
                escapeHtml(key) +
                '" aria-pressed="' +
                (active ? "true" : "false") +
                '"' +
                (active ? ' class="is-active"' : "") +
                ">" +
                escapeHtml(buildingLabels[key]) +
                "</button>"
              );
            })
            .join("") +
          "</div>";
      }

      const guestOpts =
        optionHtml("", "Any guests", state.minGuests) +
        guestOptions
          .map(function (n) {
            return optionHtml(
              n,
              n + "+ guest" + (n === 1 ? "" : "s"),
              state.minGuests
            );
          })
          .join("");

      const bedroomOpts =
        optionHtml("", "Any bedrooms", state.minBedrooms) +
        bedroomOptions
          .map(function (n) {
            return optionHtml(
              n,
              n + "+ bedroom" + (n === 1 ? "" : "s"),
              state.minBedrooms
            );
          })
          .join("");

      const kitchenOpts =
        optionHtml("", "Any kitchen", state.kitchen) +
        kitchenOptions
          .map(function (k) {
            return optionHtml(k, k, state.kitchen);
          })
          .join("");

      function filterField(title, selectHtml) {
        return (
          "<label><span class=\"listing-filters-title\">" +
          title +
          "</span>" +
          selectHtml +
          "</label>"
        );
      }

      let bedTypeBlock = "";
      if (bedTypeOptions.length > 1) {
        bedTypeBlock = filterField(
          "Bed type",
          '<select name="bedType" aria-label="Filter by bed type">' +
            optionHtml("", "Any bed type", state.bedType) +
            bedTypeOptions
              .map(function (b) {
                return optionHtml(b, b, state.bedType);
              })
              .join("") +
            "</select>"
        );
      }

      let statusBlock = "";
      if (hasUpcoming && hasAvailable) {
        statusBlock = filterField(
          "Status",
          '<select name="status" aria-label="Filter by status">' +
            optionHtml("", "All statuses", state.status) +
            optionHtml("available", "Available", state.status) +
            optionHtml("upcoming", "Upcoming", state.status) +
            "</select>"
        );
      }

      let amenityBlock = "";
      if (hasWorkspace || hasParking) {
        amenityBlock = filterField(
          "Feature",
          '<select name="amenity" aria-label="Filter by feature">' +
            optionHtml("", "Any feature", state.amenity) +
            (hasWorkspace
              ? optionHtml("Workspace", "Workspace", state.amenity)
              : "") +
            (hasParking ? optionHtml("Parking", "Parking", state.amenity) : "") +
            "</select>"
        );
      }

      return (
        buildingHtml +
        '<form class="listing-filters" id="listing-filters">' +
        filterField(
          "Sort by",
          '<select name="sort" aria-label="Sort listings">' +
            optionHtml("name-asc", "Name A–Z", state.sort) +
            optionHtml("name-desc", "Name Z–A", state.sort) +
            optionHtml("guests-desc", "Guests: high to low", state.sort) +
            optionHtml("guests-asc", "Guests: low to high", state.sort) +
            optionHtml("bedrooms-desc", "Bedrooms: high to low", state.sort) +
            optionHtml("bedrooms-asc", "Bedrooms: low to high", state.sort) +
            optionHtml("status", "Available first", state.sort) +
            "</select>"
        ) +
        filterField(
          "Guests",
          '<select name="minGuests" aria-label="Minimum guests">' +
            guestOpts +
            "</select>"
        ) +
        filterField(
          "Bedrooms",
          '<select name="minBedrooms" aria-label="Minimum bedrooms">' +
            bedroomOpts +
            "</select>"
        ) +
        filterField(
          "Kitchen",
          '<select name="kitchen" aria-label="Filter by kitchen">' +
            kitchenOpts +
            "</select>"
        ) +
        bedTypeBlock +
        statusBlock +
        amenityBlock +
        '<button type="button" class="btn listing-filters-reset" id="listing-filters-reset">Reset</button>' +
        "</form>"
      );
    }

    function updateMeta(count) {
      if (!meta) return;
      meta.textContent =
        count +
        " unit" +
        (count === 1 ? "" : "s") +
        (count !== properties.length
          ? " (of " + properties.length + ")"
          : "");
    }

    function render() {
      const filtered = sortProperties(
        applyFilters(properties, state),
        state.sort
      );
      updateMeta(filtered.length);

      const gridHtml = filtered.length
        ? '<div class="unit-grid">' +
          filtered
            .map(function (p) {
              return renderCard(p, buildingLabels);
            })
            .join("") +
          "</div>"
        : '<p class="listing-empty lede">No properties match these filters.</p>';

      root.innerHTML =
        '<section class="section listing-section">' +
        renderFiltersBar() +
        gridHtml +
        "</section>";

      const form = root.querySelector("#listing-filters");
      if (form) {
        form.addEventListener("change", function (event) {
          const el = event.target;
          if (!el || !el.name) return;
          state[el.name] = el.value;
          render();
        });
      }

      const reset = root.querySelector("#listing-filters-reset");
      if (reset) {
        reset.addEventListener("click", function () {
          state.building = "all";
          state.sort = "name-asc";
          state.minGuests = "";
          state.minBedrooms = "";
          state.kitchen = "";
          state.bedType = "";
          state.status = "";
          state.amenity = "";
          render();
        });
      }

      const buildingFilter = root.querySelector(".building-filter");
      if (buildingFilter) {
        buildingFilter.addEventListener("click", function (event) {
          const btn = event.target.closest("button[data-building]");
          if (!btn) return;
          state.building = btn.getAttribute("data-building");
          render();
        });
      }
    }

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
