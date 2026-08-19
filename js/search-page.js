import { renderSkeletons, renderStatus } from "./dom.js";
import { createProductCard, getCardPrice } from "./products.js";
import { getSupabaseClient } from "./supabase.js";

const PRODUCT_FIELDS = [
  "id",
  "slug",
  "name",
  "category",
  "description",
  "image_url",
  "hover_image_url",
  "price",
  "price_10ml",
  "price_50ml",
  "price_100ml",
  "stock",
  "is_featured",
  "created_at",
].join(", ");

const PRICE_LABELS = {
  "under-3000": "Under LKR 3,000",
  "3000-7000": "LKR 3,000–7,000",
  "7000-10000": "LKR 7,000–10,000",
  "over-10000": "Over LKR 10,000",
};

const CATEGORY_LABELS = {
  special: "Special collection",
  clone: "Inspired fragrances",
  original: "Mystora originals",
};

let allProducts = [];
let state;
let pageMode = "search";

export function initSearchPage({ mode = "search" } = {}) {
  const grid = document.getElementById("search-page-grid");
  if (!grid) return;

  pageMode = mode;
  state = createStateFromUrl();
  syncControlsFromState();
  bindSearchControls();
  updateFilterCount();
  fetchProducts();
}

async function fetchProducts() {
  const grid = document.getElementById("search-page-grid");
  if (!grid) return;

  renderSkeletons(grid, 8);
  setResultCount("Loading the collection…");

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("products")
      .select(PRODUCT_FIELDS)
      .eq("active", true);
    if (error) throw error;

    allProducts = data || [];
    updateCategoryCounts();
    applySearch({ updateUrl: false });
  } catch {
    console.error("Search results could not be loaded.");
    setResultCount("Search unavailable");
    renderStatus(grid, {
      message: "We could not load the fragrance collection. Please check your connection.",
      onRetry: fetchProducts,
      preserveLayout: true,
    });
  }
}

function bindSearchControls() {
  const form = document.getElementById("search-page-form");
  const input = document.getElementById("search-page-input");
  const sort = document.getElementById("search-sort");
  const filters = document.getElementById("search-filters");
  const clearFilters = document.getElementById("search-clear-filters");
  let debounceTimer;

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.q = normalizeQuery(input?.value);
    applySearch();
  });

  input?.addEventListener("input", () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      state.q = normalizeQuery(input.value);
      applySearch();
    }, 180);
  });

  filters?.addEventListener("change", () => {
    state = { ...state, ...readFilterState() };
    applySearch();
  });

  sort?.addEventListener("change", () => {
    state.sort = sort.value;
    applySearch();
  });

  clearFilters?.addEventListener("click", () => {
    clearFilterControls();
    state = { ...state, ...readFilterState() };
    applySearch();
  });

  document.querySelectorAll("[data-clear-search]").forEach((button) => {
    button.addEventListener("click", () => {
      clearFilterControls();
      if (input) input.value = "";
      const defaultSort = pageMode === "shop" ? "newest" : "relevance";
      state = { ...readFilterState(), q: "", sort: defaultSort };
      if (sort) sort.value = defaultSort;
      applySearch();
      input?.focus();
    });
  });

  document.querySelectorAll("[data-query]").forEach((button) => {
    button.addEventListener("click", () => {
      const query = normalizeQuery(button.dataset.query);
      if (input) input.value = query;
      state.q = query;
      applySearch();
    });
  });

  document.getElementById("search-active-filters")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter-type]");
    if (!button) return;
    removeFilter(button.dataset.filterType, button.dataset.filterValue);
  });

  bindMobileFilters();
  window.addEventListener("popstate", () => {
    state = createStateFromUrl();
    syncControlsFromState();
    applySearch({ updateUrl: false });
  });
}

function bindMobileFilters() {
  const panel = document.getElementById("search-filters");
  const toggle = document.getElementById("search-filter-toggle");
  const close = document.getElementById("search-filter-close");
  const backdrop = document.getElementById("search-filter-backdrop");
  if (!panel || !toggle) return;

  const closePanel = () => {
    panel.classList.remove("is-open");
    backdrop?.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("search-filters-open");
  };
  const openPanel = () => {
    panel.classList.add("is-open");
    backdrop?.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("search-filters-open");
    panel.querySelector("input, button")?.focus();
  };

  toggle.addEventListener("click", openPanel);
  close?.addEventListener("click", closePanel);
  backdrop?.addEventListener("click", closePanel);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel.classList.contains("is-open")) {
      closePanel();
      toggle.focus();
    }
  });
}

function applySearch({ updateUrl = true } = {}) {
  const products = sortProducts(
    allProducts.filter(matchesSearch).filter(matchesFilters),
  );

  if (updateUrl) updateUrlFromState();
  updateSearchCopy(products.length);
  renderActiveFilters();
  updateFilterCount();
  renderProducts(products);
}

function matchesSearch(product) {
  if (!state.q) return true;
  const searchable = normalize([
    product.name,
    product.category,
    product.description,
    product.slug,
  ].filter(Boolean).join(" "));
  return normalize(state.q).split(" ").every((token) => searchable.includes(token));
}

function matchesFilters(product) {
  if (state.categories.length && !state.categories.includes(normalize(product.category))) {
    return false;
  }

  if (state.sizes.length && !state.sizes.some((size) => getSizePrice(product, size) > 0)) {
    return false;
  }

  if (state.availability && Number(product.stock || 0) <= 0) return false;
  if (state.featured && !product.is_featured) return false;

  const price = getFilterPrice(product);
  const priceMatches = {
    any: true,
    "under-3000": price < 3000,
    "3000-7000": price >= 3000 && price <= 7000,
    "7000-10000": price > 7000 && price <= 10000,
    "over-10000": price > 10000,
  };
  return priceMatches[state.price] ?? true;
}

function sortProducts(products) {
  const result = [...products];
  const sorters = {
    relevance: (a, b) => relevanceScore(a) - relevanceScore(b),
    newest: (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
    "price-asc": (a, b) => getFilterPrice(a) - getFilterPrice(b),
    "price-desc": (a, b) => getFilterPrice(b) - getFilterPrice(a),
    "name-asc": (a, b) => normalize(a.name).localeCompare(normalize(b.name)),
  };
  return result.sort(sorters[state.sort] || sorters.relevance);
}

function relevanceScore(product) {
  if (!state.q) return -new Date(product.created_at || 0).getTime();
  const query = normalize(state.q);
  const name = normalize(product.name);
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  return 3;
}

function renderProducts(products) {
  const grid = document.getElementById("search-page-grid");
  const empty = document.getElementById("search-page-empty");
  if (!grid || !empty) return;

  const displaySize = state.sizes.length === 1 ? state.sizes[0] : "";
  grid.replaceChildren(
    ...products.map((product) => createProductCard(product, { displaySize })),
  );
  grid.hidden = products.length === 0;
  empty.hidden = products.length !== 0;
}

function updateSearchCopy(count) {
  const input = document.getElementById("search-page-input");
  const heading = document.getElementById("results-heading");
  const summary = document.getElementById("search-query-summary");
  if (input && document.activeElement !== input) input.value = state.q;

  setResultCount(`${count} ${count === 1 ? "fragrance" : "fragrances"}`);
  const catalogLabel = getCatalogLabel();
  if (heading) {
    heading.textContent = state.q
      ? `Results for “${state.q}”`
      : catalogLabel;
  }
  if (summary) summary.textContent = state.q || catalogLabel;
  if (pageMode === "shop") {
    document.title = state.q
      ? `${state.q} — Shop | Mystora`
      : `${catalogLabel} | Mystora`;
  } else {
    document.title = state.q
      ? `${state.q} — Search | Mystora`
      : "Search Fragrances | Mystora";
  }
}

function getCatalogLabel() {
  if (state.categories.length === 1) {
    return CATEGORY_LABELS[state.categories[0]] || "Selected collection";
  }
  if (state.sizes.length === 1) {
    return state.sizes[0] === "10ml"
      ? "10 ml decants"
      : `${state.sizes[0].toUpperCase()} fragrances`;
  }
  if (state.featured) return "Featured selection";
  return "All fragrances";
}

function setResultCount(text) {
  const element = document.getElementById("search-results-count");
  if (element) element.textContent = text;
}

function updateCategoryCounts() {
  Object.keys(CATEGORY_LABELS).forEach((category) => {
    const count = allProducts.filter((product) => normalize(product.category) === category).length;
    const element = document.querySelector(`[data-category-count="${category}"]`);
    if (element) element.textContent = count;
  });
}

function renderActiveFilters() {
  const container = document.getElementById("search-active-filters");
  if (!container) return;
  const chips = [];

  state.categories.forEach((value) => chips.push(createFilterChip("category", value, CATEGORY_LABELS[value] || value)));
  state.sizes.forEach((value) => chips.push(createFilterChip("size", value, value.toUpperCase())));
  if (state.price !== "any") chips.push(createFilterChip("price", state.price, PRICE_LABELS[state.price]));
  if (state.availability) chips.push(createFilterChip("availability", "in-stock", "In stock"));
  if (state.featured) chips.push(createFilterChip("featured", "1", "Featured"));

  container.replaceChildren(...chips);
  container.hidden = chips.length === 0;
}

function createFilterChip(type, value, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.filterType = type;
  button.dataset.filterValue = value;
  button.setAttribute("aria-label", `Remove ${label} filter`);
  button.textContent = `${label} ×`;
  return button;
}

function removeFilter(type, value) {
  if (type === "category") state.categories = state.categories.filter((item) => item !== value);
  if (type === "size") state.sizes = state.sizes.filter((item) => item !== value);
  if (type === "price") state.price = "any";
  if (type === "availability") state.availability = false;
  if (type === "featured") state.featured = false;
  syncControlsFromState();
  applySearch();
}

function createStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    q: normalizeQuery(params.get("q")),
    categories: parseList(params.get("category")),
    sizes: parseList(params.get("size")),
    price: params.get("price") || "any",
    availability: params.get("availability") === "in-stock",
    featured: params.get("featured") === "1",
    sort: params.get("sort") || (pageMode === "shop" ? "newest" : "relevance"),
  };
}

function syncControlsFromState() {
  const input = document.getElementById("search-page-input");
  const sort = document.getElementById("search-sort");
  if (input) input.value = state.q;
  if (sort && [...sort.options].some((option) => option.value === state.sort)) sort.value = state.sort;

  document.querySelectorAll('input[name="category"]').forEach((control) => {
    control.checked = state.categories.includes(control.value);
  });
  document.querySelectorAll('input[name="size"]').forEach((control) => {
    control.checked = state.sizes.includes(control.value);
  });
  const price = document.querySelector(`input[name="price"][value="${CSS.escape(state.price)}"]`);
  if (price) price.checked = true;
  const availability = document.querySelector('input[name="availability"]');
  const featured = document.querySelector('input[name="featured"]');
  if (availability) availability.checked = state.availability;
  if (featured) featured.checked = state.featured;
}

function readFilterState() {
  return {
    categories: [...document.querySelectorAll('input[name="category"]:checked')].map((input) => input.value),
    sizes: [...document.querySelectorAll('input[name="size"]:checked')].map((input) => input.value),
    price: document.querySelector('input[name="price"]:checked')?.value || "any",
    availability: Boolean(document.querySelector('input[name="availability"]:checked')),
    featured: Boolean(document.querySelector('input[name="featured"]:checked')),
  };
}

function clearFilterControls() {
  document.querySelectorAll('#search-filters input[type="checkbox"]').forEach((input) => {
    input.checked = false;
  });
  const anyPrice = document.querySelector('input[name="price"][value="any"]');
  if (anyPrice) anyPrice.checked = true;
}

function updateUrlFromState() {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.categories.length) params.set("category", state.categories.join(","));
  if (state.sizes.length) params.set("size", state.sizes.join(","));
  if (state.price !== "any") params.set("price", state.price);
  if (state.availability) params.set("availability", "in-stock");
  if (state.featured) params.set("featured", "1");
  if (state.sort !== "relevance") params.set("sort", state.sort);
  const query = params.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

function updateFilterCount() {
  const count = state.categories.length + state.sizes.length + Number(state.price !== "any") + Number(state.availability) + Number(state.featured);
  const element = document.getElementById("search-filter-count");
  if (element) element.textContent = count;
}

function getFilterPrice(product) {
  if (state.sizes.length === 1) return getSizePrice(product, state.sizes[0]);
  return getCardPrice(product);
}

function getSizePrice(product, size) {
  const fields = { "10ml": "price_10ml", "50ml": "price_50ml", "100ml": "price_100ml" };
  return Number(product?.[fields[size]] || 0);
}

function parseList(value) {
  return String(value || "").split(",").map(normalize).filter(Boolean);
}

function normalizeQuery(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function normalize(value) {
  return String(value || "").toLocaleLowerCase().trim();
}
