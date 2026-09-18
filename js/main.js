const filters = document.querySelectorAll(".filter");
const properties = document.querySelectorAll(".property");

filters.forEach((button) => {
  button.addEventListener("click", () => {
    const city = button.dataset.filter;

    filters.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");

    properties.forEach((card) => {
      const show = city === "all" || card.dataset.city === city;
      card.classList.toggle("is-hidden", !show);
    });
  });
});
