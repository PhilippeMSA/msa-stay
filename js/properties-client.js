/**
 * Public site data access — loads properties from the MSA Stay API.
 */
(function () {
  // encodeURIComponent leaves ' ! ( ) * unescaped — those break CSS url('...')
  function encodeSegment(value) {
    return encodeURIComponent(String(value || "")).replace(
      /[!'()*]/g,
      function (char) {
        return "%" + char.charCodeAt(0).toString(16).toUpperCase();
      }
    );
  }

  function imageUrl(property, filename) {
    return [
      "properties",
      property.citySlug,
      property.street,
      property.folder,
      "images",
      filename,
    ]
      .map(encodeSegment)
      .join("/");
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  async function getProperty(id) {
    const data = await fetchJson("/api/properties/" + encodeURIComponent(id));
    return data.property || null;
  }

  async function listProperties(filters) {
    const qs =
      filters && filters.citySlug
        ? "?city=" + encodeURIComponent(filters.citySlug)
        : "";
    const data = await fetchJson("/api/properties" + qs);
    return data.properties || [];
  }

  window.msaPropertyImageUrl = imageUrl;
  window.msaFetchProperty = getProperty;
  window.msaFetchProperties = listProperties;
})();
