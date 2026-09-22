(function () {
  const form = document.getElementById("workplace-form");
  const input = document.getElementById("workplace-query");
  const list = document.getElementById("workplace-suggestions");
  const status = document.getElementById("workplace-status");
  const results = document.getElementById("workplace-results");
  if (!form || !input || !list || !status || !results) return;

  let suggestions = [];
  let activeIndex = -1;
  let selectedPlace = null;
  let debounceTimer = null;
  let abortController = null;
  let lastSearchKey = "";

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(message, type) {
    status.textContent = message || "";
    status.className =
      "workplace-status" + (type ? " workplace-status--" + type : "");
  }

  function selectedMode() {
    const checked = form.querySelector('input[name="mode"]:checked');
    return checked ? checked.value : "car";
  }

  function closeSuggestions() {
    list.hidden = true;
    list.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  }

  function openSuggestions() {
    if (!suggestions.length) {
      closeSuggestions();
      return;
    }
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    list.innerHTML = suggestions
      .map(function (item, index) {
        return (
          '<li role="option" id="workplace-opt-' +
          index +
          '" data-index="' +
          index +
          '"' +
          (index === activeIndex ? ' aria-selected="true" class="is-active"' : "") +
          ">" +
          escapeHtml(item.label) +
          "</li>"
        );
      })
      .join("");
  }

  function highlightOption(index) {
    activeIndex = index;
    Array.prototype.forEach.call(list.children, function (li, i) {
      const on = i === activeIndex;
      li.classList.toggle("is-active", on);
      li.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (activeIndex >= 0) {
      input.setAttribute(
        "aria-activedescendant",
        "workplace-opt-" + activeIndex
      );
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  async function fetchSuggestions(query) {
    if (abortController) abortController.abort();
    abortController = new AbortController();
    try {
      const res = await fetch(
        "/api/workplace/autocomplete?q=" + encodeURIComponent(query),
        { signal: abortController.signal }
      );
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        suggestions = [];
        closeSuggestions();
        if (res.status === 503) {
          setStatus(
            data.error ||
              "Workplace search is not configured yet. Please try again later.",
            "err"
          );
        }
        return;
      }
      suggestions = data.suggestions || [];
      activeIndex = suggestions.length ? 0 : -1;
      if (!suggestions.length && query.length >= 3) {
        setStatus(
          "No matching addresses yet — keep typing or try a fuller address.",
          ""
        );
      } else if (suggestions.length) {
        setStatus("");
      }
      openSuggestions();
      if (activeIndex >= 0) highlightOption(activeIndex);
    } catch (err) {
      if (err.name === "AbortError") return;
      suggestions = [];
      closeSuggestions();
    }
  }

  function scheduleSuggest() {
    selectedPlace = null;
    const q = input.value.trim();
    clearTimeout(debounceTimer);
    if (q.length < 2) {
      suggestions = [];
      closeSuggestions();
      setStatus("");
      return;
    }
    debounceTimer = setTimeout(function () {
      fetchSuggestions(q);
    }, 280);
  }

  async function runSearch(place) {
    if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) {
      setStatus(
        "Pick an address from the suggestions to see nearby accommodations.",
        "err"
      );
      return;
    }

    const mode = selectedMode();
    const key = place.lat + "," + place.lng + "|" + mode;
    if (key === lastSearchKey && results.childElementCount) return;
    lastSearchKey = key;

    closeSuggestions();
    input.value = place.label || input.value;
    setStatus("Calculating travel times…");
    results.innerHTML =
      '<p class="workplace-loading">Finding the closest MSA Stay homes…</p>';

    try {
      const res = await fetch("/api/workplace/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: place.lat,
          lng: place.lng,
          label: place.label || "",
          mode: mode,
        }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        results.innerHTML = "";
        setStatus(
          data.error ||
            "We couldn't calculate the travel time right now. Please try again.",
          "err"
        );
        return;
      }

      const listResults = data.results || [];
      if (data.message) setStatus(data.message, data.approximate ? "warn" : "");
      else setStatus("");

      if (!listResults.length) {
        results.innerHTML =
          '<p class="workplace-empty">' +
          escapeHtml(
            data.message ||
              "No accommodations with location data are available yet."
          ) +
          "</p>";
        return;
      }

      results.innerHTML = listResults
        .map(function (item, index) {
          const closest =
            index === 0
              ? '<p class="workplace-closest">Closest to your workplace</p>'
              : "";
          const cover = item.coverUrl
            ? 'style="background-image:url(&quot;' +
              escapeHtml(item.coverUrl) +
              '&quot;)"'
            : "";
          const visualClass = item.coverUrl
            ? "workplace-card-visual"
            : "workplace-card-visual workplace-card-visual--empty";
          const distance =
            item.distanceKm != null ? item.distanceKm + " km" : "Distance n/a";
          const time = item.durationLabel
            ? "approximately " +
              item.durationLabel +
              " " +
              (item.modeLabel || "")
            : data.approximate
              ? "travel time unavailable"
              : "";
          const meta = [distance, time].filter(Boolean).join(" · ");
          const guests =
            item.basics && item.basics.maxGuests != null
              ? "Max " + item.basics.maxGuests + " guests"
              : "";
          const beds =
            item.basics && item.basics.bedrooms != null
              ? item.basics.bedrooms === 1
                ? "1 bedroom"
                : item.basics.bedrooms + " bedrooms"
              : "";
          const tags = [guests, beds, item.city]
            .filter(Boolean)
            .map(function (t) {
              return "<li>" + escapeHtml(t) + "</li>";
            })
            .join("");

          return (
            '<article class="workplace-card' +
            (index === 0 ? " workplace-card--closest" : "") +
            '">' +
            closest +
            '<div class="workplace-card-layout">' +
            '<div class="' +
            visualClass +
            '" ' +
            cover +
            ' role="img" aria-label="' +
            escapeHtml(item.name) +
            '"></div>' +
            '<div class="workplace-card-body">' +
            "<h3>" +
            escapeHtml(item.name) +
            "</h3>" +
            '<p class="workplace-meta">' +
            escapeHtml(meta) +
            "</p>" +
            (tags ? '<ul class="tags">' + tags + "</ul>" : "") +
            '<a class="btn btn-primary" href="' +
            escapeHtml(item.href) +
            '">View accommodation</a>' +
            "</div></div></article>"
          );
        })
        .join("");
    } catch (err) {
      results.innerHTML = "";
      setStatus(
        "We couldn't calculate the travel time right now. Please try again.",
        "err"
      );
    }
  }

  function chooseSuggestion(index) {
    const place = suggestions[index];
    if (!place) return;
    selectedPlace = place;
    input.value = place.label;
    closeSuggestions();
    runSearch(place);
  }

  input.addEventListener("input", scheduleSuggest);

  input.addEventListener("keydown", function (event) {
    if (list.hidden && event.key !== "Enter") return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!suggestions.length) return;
      highlightOption(
        activeIndex < suggestions.length - 1 ? activeIndex + 1 : 0
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!suggestions.length) return;
      highlightOption(
        activeIndex > 0 ? activeIndex - 1 : suggestions.length - 1
      );
    } else if (event.key === "Enter") {
      if (!list.hidden && activeIndex >= 0) {
        event.preventDefault();
        chooseSuggestion(activeIndex);
      } else if (selectedPlace) {
        event.preventDefault();
        runSearch(selectedPlace);
      } else {
        event.preventDefault();
        setStatus(
          "Pick an address from the suggestions to see nearby accommodations.",
          "err"
        );
      }
    } else if (event.key === "Escape") {
      closeSuggestions();
    }
  });

  list.addEventListener("mousedown", function (event) {
    const li = event.target.closest("[data-index]");
    if (!li) return;
    event.preventDefault();
    chooseSuggestion(Number(li.getAttribute("data-index")));
  });

  form.addEventListener("change", function (event) {
    if (event.target.name === "mode" && selectedPlace) {
      lastSearchKey = "";
      runSearch(selectedPlace);
    }
  });

  document.addEventListener("click", function (event) {
    if (!form.contains(event.target)) closeSuggestions();
  });

  fetch("/api/workplace/status")
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (!data.configured) {
        setStatus(
          "Workplace distance search will be available once mapping is configured.",
          "warn"
        );
      } else if (!data.propertiesWithCoordinates) {
        setStatus(
          "Accommodations are being prepared for distance search. You can still browse cities below.",
          "warn"
        );
      }
    })
    .catch(function () {});
})();
