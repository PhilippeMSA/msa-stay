/**
 * Renders homepage city cards, growing section, and contact city options from API.
 */
(function () {
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pipelineTotal(cities) {
    return cities.reduce(function (sum, c) {
      return sum + (Number(c.upcomingCount) || 0);
    }, 0);
  }

  async function init() {
    const grid = document.getElementById("home-city-grid");
    const upcoming = document.getElementById("home-upcoming-grid");
    const contactCity = document.getElementById("contact-city");

    try {
      const res = await fetch("/api/cities", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load cities");
      const data = await res.json();
      const cities = data.cities || [];

      const live = cities.filter(function (c) {
        return c.status === "live";
      });
      const growing = cities.filter(function (c) {
        return (
          c.status === "upcoming" ||
          (Number(c.upcomingCount) || 0) > 0
        );
      });

      if (grid) {
        if (!live.length) {
          grid.innerHTML = "<p>No live cities yet.</p>";
        } else {
          grid.innerHTML = live
            .map(function (c) {
              const style = c.coverUrl
                ? ' style="background-image: url(&quot;' +
                  c.coverUrl +
                  '&quot;); background-size: cover; background-position: center;"'
                : "";
              return (
                '<a class="city-card-link" href="' +
                escapeHtml(c.listingPage) +
                '" aria-label="View properties in ' +
                escapeHtml(c.name) +
                '">' +
                '<article class="city-card">' +
                '<div class="city-visual"' +
                style +
                ">" +
                '<span class="badge">Available</span>' +
                '<span class="city-label">' +
                escapeHtml(c.name) +
                "</span></div>" +
                '<div class="city-body">' +
                "<h3>MSA Stay " +
                escapeHtml(c.name) +
                "</h3>" +
                "<p>" +
                escapeHtml(
                  c.description ||
                    "Business accommodations for company stays in " +
                      c.name +
                      "."
                ) +
                "</p></div></article></a>"
              );
            })
            .join("");
        }
      }

      if (upcoming) {
        if (!growing.length) {
          upcoming.innerHTML = "<p>More locations coming soon.</p>";
        } else {
          upcoming.innerHTML = growing
            .map(function (c) {
              const count =
                Number(c.upcomingCount) > 0
                  ? "+" + c.upcomingCount
                  : "New";
              const body =
                Number(c.upcomingCount) > 0
                  ? c.upcomingCount +
                    " more apartment" +
                    (c.upcomingCount === 1 ? "" : "s") +
                    " expanding our " +
                    c.name +
                    " offering."
                  : c.description ||
                    "A new MSA Stay location in " + c.name + ".";
              return (
                '<article class="upcoming-card">' +
                '<p class="count">' +
                escapeHtml(String(count)) +
                "</p>" +
                "<h3>" +
                escapeHtml(c.name) +
                "</h3>" +
                "<p>" +
                escapeHtml(body) +
                "</p></article>"
              );
            })
            .join("");
        }
      }

      const pipelineEl = document.querySelector(
        ".hero-stats li:nth-child(3) > span:first-child"
      );
      if (pipelineEl) {
        const total = pipelineTotal(cities);
        if (total > 0) pipelineEl.textContent = "+" + total;
      }

      if (contactCity) {
        const selectLabel =
          contactCity.querySelector('option[value=""]') ||
          contactCity.options[0];
        contactCity.innerHTML = "";
        if (selectLabel) contactCity.appendChild(selectLabel);
        else {
          const opt = document.createElement("option");
          opt.value = "";
          opt.textContent = "Select a city";
          contactCity.appendChild(opt);
        }
        cities
          .filter(function (c) {
            return c.status !== "hidden";
          })
          .forEach(function (c) {
            const opt = document.createElement("option");
            opt.value = c.name;
            opt.textContent =
              c.name + (c.status === "upcoming" ? " (coming soon)" : "");
            contactCity.appendChild(opt);
          });
      }

      const footer = document.querySelector("[data-i18n='footerCities']");
      if (footer && live.length) {
        footer.textContent =
          "Business accommodations · " +
          live
            .map(function (c) {
              return c.name;
            })
            .join(" · ");
      }

      const citiesLede = document.querySelector("[data-i18n='citiesLede']");
      if (citiesLede && live.length) {
        citiesLede.textContent =
          "Fully equipped homes for company stays in " +
          live
            .map(function (c) {
              return c.name;
            })
            .join(", ")
            .replace(/, ([^,]*)$/, " and $1") +
          ".";
      }
    } catch (err) {
      if (grid) grid.innerHTML = "<p>Could not load cities.</p>";
      if (upcoming) upcoming.innerHTML = "";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
