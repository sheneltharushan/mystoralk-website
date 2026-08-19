import { createElement, createImage, formatLkr } from "./dom.js";
import { getCardPrice, getProductLink } from "./products.js";
import { getSupabaseClient } from "./supabase.js";

const SEARCH_FIELDS =
  "id, slug, name, category, description, image_url, price, price_10ml, price_50ml, price_100ml, stock, is_featured";

export function initGlobalSearch(container) {
  const trigger = container.querySelector("#searchBtn");
  const overlay = container.querySelector("#searchOverlay");
  const input = container.querySelector("#globalSearchInput");
  const form = container.querySelector("#globalSearchForm");
  const results = container.querySelector("#globalSearchResults");
  const status = container.querySelector("#globalSearchStatus");
  const viewAll = container.querySelector("#globalSearchAll");
  if (!trigger || !overlay || !input || !form || !results || !status || !viewAll) {
    return;
  }

  let debounceTimer = null;
  let requestSequence = 0;
  let featuredLoaded = false;

  const closeSearch = ({ restoreFocus = false } = {}) => {
    if (!overlay.classList.contains("is-open")) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    trigger.setAttribute("aria-expanded", "false");
    notifyOverlayChange();
    if (restoreFocus) trigger.focus();
  };

  const openSearch = () => {
    window.dispatchEvent(new CustomEvent("mystora:close-menu"));
    window.dispatchEvent(new CustomEvent("mystora:close-coming-soon"));
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    trigger.setAttribute("aria-expanded", "true");
    notifyOverlayChange();
    window.setTimeout(() => input.focus(), 160);

    if (!featuredLoaded && !input.value.trim()) {
      featuredLoaded = true;
      loadFeatured({ results, status });
    }
  };

  trigger.addEventListener("click", () => {
    if (overlay.classList.contains("is-open")) {
      closeSearch({ restoreFocus: true });
    } else {
      openSearch();
    }
  });
  overlay.querySelectorAll("[data-search-close]").forEach((button) => {
    button.addEventListener("click", () => closeSearch({ restoreFocus: true }));
  });
  window.addEventListener("mystora:close-search", () => closeSearch());
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay.classList.contains("is-open")) {
      closeSearch({ restoreFocus: true });
      return;
    }

    const target = event.target;
    const isEditing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable;
    const isSearchShortcut =
      (!isEditing && event.key === "/") ||
      ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k");
    if (isSearchShortcut) {
      event.preventDefault();
      openSearch();
      return;
    }

    if (event.key === "Tab" && overlay.classList.contains("is-open")) {
      trapFocus(event, overlay);
    }
  });

  input.addEventListener("input", () => {
    window.clearTimeout(debounceTimer);
    requestSequence += 1;
    const requestId = requestSequence;
    const query = normalizeQuery(input.value);
    viewAll.href = query ? `/search/?q=${encodeURIComponent(query)}` : "/search/";
    viewAll.textContent = query ? `View all results for “${query}”` : "View all fragrances";

    if (query.length < 2) {
      status.textContent = query
        ? "Enter at least two characters."
        : "Start typing to explore the collection.";
      results.replaceChildren();
      return;
    }

    status.textContent = "Searching the collection…";
    debounceTimer = window.setTimeout(() => {
      searchProducts(query, {
        results,
        status,
        isCurrent: () => requestId === requestSequence,
      });
    }, 220);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = normalizeQuery(input.value);
    window.location.href = query
      ? `/search/?q=${encodeURIComponent(query)}`
      : "/search/";
  });
}

async function loadFeatured({ results, status }) {
  status.textContent = "Featured fragrances";
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("products")
      .select(SEARCH_FIELDS)
      .eq("active", true)
      .eq("is_featured", true)
      .limit(4);
    if (error) throw error;
    renderResults(results, data || []);
  } catch {
    console.error("Featured search products could not be loaded.");
    status.textContent = "Search is ready. Enter a fragrance name.";
  }
}

async function searchProducts(query, { results, status, isCurrent }) {
  try {
    const client = getSupabaseClient();
    const safeQuery = query
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    if (!safeQuery) {
      status.textContent = "Enter letters or numbers to search.";
      renderEmpty(results, "Please enter a fragrance name.");
      return;
    }
    const { data, error } = await client
      .from("products")
      .select(SEARCH_FIELDS)
      .eq("active", true)
      .or(
        `name.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%,category.ilike.%${safeQuery}%`,
      )
      .limit(8);
    if (error) throw error;
    if (!isCurrent()) return;

    const products = data || [];
    status.textContent = `${products.length} ${products.length === 1 ? "fragrance" : "fragrances"} found`;
    renderResults(results, products, query);
  } catch {
    if (!isCurrent()) return;
    console.error("Global search failed.");
    status.textContent = "Search is temporarily unavailable. Please try again.";
    renderEmpty(results, "We couldn't search the collection right now.");
  }
}

function renderResults(container, products, query = "") {
  if (!products.length) {
    renderEmpty(container, `No fragrances found${query ? ` for “${query}”` : ""}.`);
    return;
  }
  container.replaceChildren(...products.map(createSearchResult));
}

function createSearchResult(product) {
  const link = createElement("a", {
    className: "search-result",
    attributes: { href: getProductLink(product) },
  });
  const image = createImage(
    product.image_url,
    product.name || "Mystora fragrance",
    "",
  );
  const copy = createElement("div", { className: "search-result__copy" });
  copy.append(
    createElement("h3", { text: product.name || "Mystora fragrance" }),
    createElement("p", {
      text: `${product.category || "Fragrance"} · ${formatLkr(getCardPrice(product))}`,
    }),
  );
  link.append(image, copy);
  return link;
}

function renderEmpty(container, message) {
  container.replaceChildren(
    createElement("p", { className: "search-result__empty", text: message }),
  );
}

function normalizeQuery(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function notifyOverlayChange() {
  window.dispatchEvent(new CustomEvent("mystora:overlay-change"));
}

function trapFocus(event, container) {
  const focusable = [...container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.getClientRects().length > 0);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
