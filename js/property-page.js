(async function () {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const page = document.getElementById("property-page");
  const missing = document.getElementById("property-missing");

  const property = id ? await window.msaFetchProperty(id) : null;

  if (!property) {
    missing.hidden = false;
    return;
  }

  missing.hidden = true;
  page.hidden = false;

  document.title = property.name + " — MSA Stay " + property.city;
  document
    .querySelector('meta[name="description"]')
    .setAttribute(
      "content",
      property.name +
        " in " +
        property.city +
        ". Business accommodation by MSA Stay."
    );

  document.getElementById("property-back").href = property.listingPage;
  document.getElementById("property-city").textContent = property.city;
  document.getElementById("property-name").textContent = property.name;
  document.getElementById("property-address").textContent = property.city;
  document.getElementById("property-description").textContent =
    property.description;

  const statusEl = document.getElementById("property-status");
  if (statusEl) {
    const isUpcoming = property.status === "upcoming";
    statusEl.hidden = false;
    statusEl.textContent = isUpcoming ? "Upcoming" : "Available";
    statusEl.classList.toggle("badge--upcoming", isUpcoming);
  }

  const enquireTitle = document.getElementById("property-enquire-title");
  const enquireBody = document.getElementById("property-enquire-body");
  if (property.status === "upcoming") {
    if (enquireTitle) enquireTitle.textContent = "Interested in this upcoming stay?";
    if (enquireBody) {
      enquireBody.textContent =
        "This apartment is joining soon. Tell us your dates and how many people — we can note early interest for company bookings.";
    }
  }

  const basics = document.getElementById("property-basics");
  const b = property.basics || {};
  const basicRows = [
    ["Maximum guests", b.maxGuests],
    ["Bedrooms", b.bedrooms],
    ["Bed type", b.bedType],
    ["Kitchen", b.kitchen],
  ].filter(function (row) {
    return row[1] != null && row[1] !== "";
  });
  basics.innerHTML = basicRows
    .map(function (pair) {
      return (
        '<div class="basics-item"><dt>' +
        pair[0] +
        "</dt><dd>" +
        pair[1] +
        "</dd></div>"
      );
    })
    .join("");

  const amenitiesEl = document.getElementById("property-amenities");
  const amenityDetails = property.amenityDetails || [];
  const amenityNames = property.amenities || [];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function groupByCategory(items, categoryOrder) {
    const groups = {};
    (items || []).forEach(function (item) {
      const cat = item.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    const order = (categoryOrder || []).slice();
    Object.keys(groups).forEach(function (cat) {
      if (order.indexOf(cat) === -1) order.push(cat);
    });
    return order
      .filter(function (cat) {
        return groups[cat] && groups[cat].length;
      })
      .map(function (cat) {
        return { category: cat, items: groups[cat] };
      });
  }

  function renderGroupedList(container, items, categoryOrder, emptyHtml, itemHtml) {
    const groups = groupByCategory(items, categoryOrder);
    if (!groups.length) {
      container.innerHTML = emptyHtml;
      return false;
    }
    container.innerHTML = groups
      .map(function (group) {
        return (
          '<div class="feature-group">' +
          '<h3 class="feature-group-title">' +
          escapeHtml(group.category) +
          "</h3>" +
          '<ul class="amenities-grid">' +
          group.items.map(itemHtml).join("") +
          "</ul></div>"
        );
      })
      .join("");
    return true;
  }

  const amenityCategoryOrder = [
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

  if (amenityDetails.length) {
    renderGroupedList(
      amenitiesEl,
      amenityDetails,
      amenityCategoryOrder,
      "<p class=\"lede\">No amenities listed yet.</p>",
      function (item) {
        const desc = item.description
          ? '<span class="feature-item-desc">' +
            escapeHtml(item.description) +
            "</span>"
          : "";
        return (
          "<li><span class=\"feature-item-name\">" +
          escapeHtml(item.name) +
          "</span>" +
          desc +
          "</li>"
        );
      }
    );
  } else {
    amenitiesEl.innerHTML = amenityNames.length
      ? '<ul class="amenities-grid">' +
        amenityNames
          .map(function (item) {
            return "<li>" + escapeHtml(item) + "</li>";
          })
          .join("") +
        "</ul>"
      : "<p class=\"lede\">No amenities listed yet.</p>";
  }

  const servicesSection = document.getElementById("property-services-section");
  const servicesEl = document.getElementById("property-services");
  const services = property.services || [];
  if (
    servicesSection &&
    servicesEl &&
    renderGroupedList(
      servicesEl,
      services,
      ["Check-in & support", "Cleaning", "Convenience", "Business", "Other"],
      "",
      function (item) {
        return (
          "<li><span class=\"feature-item-name\">" +
          escapeHtml(item.name) +
          "</span></li>"
        );
      }
    )
  ) {
    servicesSection.hidden = false;
  }

  const paidSection = document.getElementById("property-paid-section");
  const paidEl = document.getElementById("property-paid-services");
  const paidServices = property.paidServices || [];

  function formatPublicPrice(item) {
    const price = item.effectivePrice;
    if (price == null) return "On request";
    const amount = Number(price);
    if (!Number.isFinite(amount)) return "On request";
    const symbol =
      item.currency === "EUR" || !item.currency ? "€" : item.currency + " ";
    const label = item.pricingLabel || "";
    return (
      symbol +
      amount.toFixed(amount % 1 === 0 ? 0 : 2) +
      (label ? " / " + label : "")
    );
  }

  if (
    paidSection &&
    paidEl &&
    renderGroupedList(
      paidEl,
      paidServices,
      ["Check-in / check-out", "Cleaning", "Parking", "Business", "Other"],
      "",
      function (item) {
        return (
          "<li><span class=\"feature-item-name\">" +
          escapeHtml(item.name) +
          '</span><span class="feature-item-price">' +
          escapeHtml(formatPublicPrice(item)) +
          "</span></li>"
        );
      }
    )
  ) {
    paidSection.hidden = false;
  }

  const images = property.images || [];
  const mainImg = document.getElementById("gallery-main-img");
  const thumbs = document.getElementById("gallery-thumbs");

  if (!images.length) {
    mainImg.hidden = true;
    document.querySelector(".gallery-main").classList.add("gallery-main--empty");
    return;
  }

  let active = 0;

  function show(index) {
    active = index;
    const file = images[active];
    mainImg.hidden = false;
    mainImg.src = window.msaPropertyImageUrl(property, file);
    mainImg.alt = property.name + " — photo " + (active + 1);
    thumbs.querySelectorAll("button").forEach(function (btn, i) {
      btn.classList.toggle("is-active", i === active);
    });
  }

  thumbs.innerHTML = images
    .map(function (file, i) {
      const src = window.msaPropertyImageUrl(property, file);
      return (
        '<button type="button" class="gallery-thumb" data-index="' +
        i +
        '" aria-label="Show photo ' +
        (i + 1) +
        '">' +
        '<img src="' +
        src +
        '" alt="" />' +
        "</button>"
      );
    })
    .join("");

  thumbs.addEventListener("click", function (event) {
    const btn = event.target.closest("[data-index]");
    if (!btn) return;
    show(Number(btn.dataset.index));
  });

  show(0);
})();
