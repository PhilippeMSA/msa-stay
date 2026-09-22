/**
 * Boots a generic city listing page from ?slug=
 */
(async function () {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug") || params.get("city");
  const listings = document.getElementById("city-listings");

  if (!slug) {
    document.getElementById("city-title").textContent = "City not found";
    document.getElementById("city-page-meta").textContent = "";
    if (listings) {
      listings.innerHTML =
        '<section class="section listing-section"><p class="lede">Choose a city from the homepage.</p></section>';
    }
    return;
  }

  try {
    const res = await fetch("/api/cities/" + encodeURIComponent(slug), {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("City not found");
    const data = await res.json();
    const city = data.city;

    document.title = "MSA Stay " + city.name + " — Business accommodations";
    document
      .querySelector('meta[name="description"]')
      .setAttribute(
        "content",
        "Business accommodations in " +
          city.name +
          ". Homes for company stays."
      );

    document.getElementById("city-eyebrow").textContent = city.name;
    document.getElementById("city-title").textContent =
      "Properties in " + city.name;
    document.getElementById("city-lede").textContent =
      city.description ||
      "Business accommodations in " +
        city.name +
        " — ready for company stays, with more units joining soon.";
    document.getElementById("city-enquire-title").textContent =
      "Interested in a " + city.name + " stay?";

    if (listings) {
      listings.setAttribute("data-city-slug", city.slug);
    }

    const citiesRes = await fetch("/api/cities", { cache: "no-store" });
    if (citiesRes.ok) {
      const citiesData = await citiesRes.json();
      const live = (citiesData.cities || [])
        .filter(function (c) {
          return c.status === "live";
        })
        .map(function (c) {
          return c.name;
        });
      const footer = document.getElementById("city-footer-cities");
      if (footer && live.length) {
        footer.textContent =
          "Business accommodations · " + live.join(" · ");
      }
    }
  } catch (err) {
    document.getElementById("city-title").textContent = "City not found";
    document.getElementById("city-page-meta").textContent = "";
  }
})();
