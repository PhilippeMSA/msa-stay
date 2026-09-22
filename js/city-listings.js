/**
 * Renders city listing pages from the API.
 * One grid + building filter (street kept for grouping only — not shown publicly).
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

  function renderCard(property) {
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

    return (
      '<a class="unit-card-link" href="property.html?id=' +
      encodeURIComponent(property.id) +
      '" data-building="' +
      escapeHtml(buildingKey(property)) +
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

  function applyFilter(root, building) {
    root.querySelectorAll(".unit-card-link").forEach(function (card) {
      const match =
        building === "all" || card.getAttribute("data-building") === building;
      card.hidden = !match;
    });
    root.querySelectorAll(".building-filter button").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-building") === building);
      btn.setAttribute(
        "aria-pressed",
        btn.getAttribute("data-building") === building ? "true" : "false"
      );
    });
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
    if (meta) {
      meta.textContent =
        properties.length +
        " unit" +
        (properties.length === 1 ? "" : "s");
    }

    if (!properties.length) {
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

    let filterHtml = "";
    if (buildings.length > 1) {
      filterHtml =
        '<div class="building-filter" role="group" aria-label="Filter by building">' +
        '<button type="button" class="is-active" data-building="all" aria-pressed="true">All</button>' +
        buildings
          .map(function (key) {
            return (
              '<button type="button" data-building="' +
              escapeHtml(key) +
              '" aria-pressed="false">' +
              escapeHtml(buildingLabels[key]) +
              "</button>"
            );
          })
          .join("") +
        "</div>";
    }

    root.innerHTML =
      '<section class="section listing-section">' +
      filterHtml +
      '<div class="unit-grid">' +
      properties.map(renderCard).join("") +
      "</div></section>";

    if (buildings.length > 1) {
      root.querySelector(".building-filter").addEventListener("click", function (event) {
        const btn = event.target.closest("button[data-building]");
        if (!btn) return;
        applyFilter(root, btn.getAttribute("data-building"));
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
