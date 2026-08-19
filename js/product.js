import { SIZE_CONFIG, WHATSAPP_PHONE } from "./config.js";
import {
  createElement,
  createImage,
  formatLkr,
  renderSkeletons,
  renderStatus,
} from "./dom.js";
import { createProductCard } from "./products.js";
import { getSupabaseClient } from "./supabase.js";
import { loadPublicSettings } from "./settings.js";

const PRODUCT_FIELDS = [
  "id", "slug", "name", "category", "description", "price",
  "price_10ml", "price_50ml", "price_100ml", "image_url",
  "hover_image_url", "image_10ml", "image_50ml", "image_100ml",
  "promo_image", "stock", "is_featured",
].join(", ");

const SIZE_LABELS = {
  "10ml": "10 ml · Discover",
  "50ml": "50 ml · Signature",
  "100ml": "100 ml · Full size",
};

const CATEGORY_LABELS = {
  clone: "Inspired fragrances",
  special: "Special collection",
  original: "Mystora originals",
};

let currentProduct = null;
let selectedSize = "50ml";
let whatsappPhone = WHATSAPP_PHONE;

export function initProductPage() {
  if (!document.getElementById("product-name")) return;

  setupGallerySwipe();
  loadPublicSettings().then((settings) => {
    const configuredPhone = String(settings.get("whatsapp_phone") || "").replace(/\D/g, "");
    if (configuredPhone.length >= 8 && configuredPhone.length <= 20) {
      whatsappPhone = configuredPhone;
      updateWhatsAppLink();
    }
  });
  document.querySelectorAll(".size-btn").forEach((button) => {
    button.addEventListener("click", () => updateSize(button.dataset.size));
  });

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const id = params.get("id");
  const requestedSize = params.get("size");
  if (requestedSize && SIZE_CONFIG[requestedSize]) selectedSize = requestedSize;

  if (!slug && !id) {
    showProductError("No fragrance was selected.");
    return;
  }
  fetchProduct({ slug, id });
}

function setupGallerySwipe() {
  const stage = document.querySelector(".product-gallery__stage");
  if (!stage) return;

  let startX = 0;
  let startY = 0;
  stage.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
    },
    { passive: true },
  );
  stage.addEventListener(
    "touchend",
    (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      const distanceX = touch.clientX - startX;
      const distanceY = touch.clientY - startY;
      const isHorizontalSwipe =
        Math.abs(distanceX) >= 45 && Math.abs(distanceX) > Math.abs(distanceY) * 1.2;
      if (!isHorizontalSwipe) return;
      navigateGallery(distanceX < 0 ? 1 : -1);
    },
    { passive: true },
  );
}

function navigateGallery(direction) {
  const thumbnails = [...document.querySelectorAll(".product-gallery__thumb")];
  if (thumbnails.length < 2) return;
  const activeIndex = Math.max(
    0,
    thumbnails.findIndex((button) => button.classList.contains("is-active")),
  );
  const nextIndex = (activeIndex + direction + thumbnails.length) % thumbnails.length;
  thumbnails[nextIndex].click();
}

async function fetchProduct({ slug, id }) {
  setProductLoading();
  try {
    const client = getSupabaseClient();
    let query = client.from("products").select(PRODUCT_FIELDS).eq("active", true);
    query = slug ? query.eq("slug", slug) : query.eq("id", id);
    const { data, error } = await query.single();
    if (error || !data) throw error || new Error("Product not found");
    hydrateProduct(data);
  } catch {
    console.error("Product could not be loaded.");
    showProductError(
      "This fragrance could not be loaded. Please check your connection.",
      () => fetchProduct({ slug, id }),
    );
  }
}

function setProductLoading() {
  setText("product-name", "Loading fragrance…");
  const image = document.getElementById("main-product-image");
  if (image) {
    image.removeAttribute("src");
    image.classList.remove("is-loaded");
  }
  setOrderButtonState(false);
  removeProductStatus();
}

function showProductError(message, onRetry) {
  setText("product-name", "Product unavailable");
  let status = document.getElementById("product-status");
  if (!status) {
    status = createElement("div", { attributes: { id: "product-status" } });
    document.getElementById("product-name")?.insertAdjacentElement("afterend", status);
  }
  renderStatus(status, { message, onRetry });
}

function removeProductStatus() {
  document.getElementById("product-status")?.remove();
}

function getVariant(product, size) {
  const config = SIZE_CONFIG[size] || SIZE_CONFIG["50ml"];
  const price = Number(
    product?.[config.priceKey] ?? product?.price_50ml ?? product?.price ?? 0,
  );
  const image =
    product?.[config.imageKey] || product?.image_50ml || product?.image_url || "";
  return { price, image };
}

function hydrateProduct(product) {
  currentProduct = product;
  removeProductStatus();

  const category = normalize(product.category);
  const categoryLabel = CATEGORY_LABELS[category] || "Mystora collection";
  const description =
    product.description || "Experience the depth of one of Mystora's signature blends.";

  setText("product-name", product.name || "Mystora fragrance");
  setText("breadcrumb-category", categoryLabel);
  setText(
    "product-collection",
    product.is_featured ? categoryLabel + " · Featured" : categoryLabel,
  );
  setText(
    "inspired-by",
    category === "clone"
      ? "A familiar icon, interpreted by Mystora"
      : "An original Mystora composition",
  );
  setText("product-intro", createIntroduction(description));
  setText("product-description", description);
  const collectionLink = document.getElementById("product-collection-link");
  if (collectionLink) {
    collectionLink.href = "/shop/?category=" + encodeURIComponent(category);
  }

  document.querySelectorAll("[data-size-price]").forEach((element) => {
    const size = element.dataset.sizePrice;
    const { price } = getVariant(product, size);
    element.textContent = price > 0 ? formatLkr(price) : "Unavailable";
    element.closest(".size-btn")?.toggleAttribute("disabled", price <= 0);
  });

  document.title = (product.name || "Fragrance") + " | Mystora";
  renderThumbnails(product);
  if (getVariant(product, selectedSize).price <= 0) {
    selectedSize = getFirstAvailableSize(product);
  }
  updateSize(selectedSize, { updateHistory: false });
  fetchSimilar(category, product.id);
}

function createIntroduction(description) {
  const firstParagraph = String(description).split(/\n+/)[0].trim();
  if (firstParagraph.length <= 190) return firstParagraph;
  return firstParagraph.slice(0, 187).trimEnd() + "…";
}

function getFirstAvailableSize(product) {
  return Object.keys(SIZE_CONFIG).find((size) => getVariant(product, size).price > 0) || "50ml";
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function updateSize(size, { updateHistory = true } = {}) {
  if (!size || !SIZE_CONFIG[size]) return;
  selectedSize = size;

  document.querySelectorAll(".size-btn").forEach((button) => {
    const active = button.dataset.size === size;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  setText("selected-size-label", SIZE_LABELS[size] || size.toUpperCase());

  if (!currentProduct) return;
  const variant = getVariant(currentProduct, size);
  setText("product-price", variant.price > 0 ? formatLkr(variant.price) : "Unavailable");

  if (variant.image) {
    const selector = '#thumbnail-list button[data-size="' + CSS.escape(size) + '"]';
    const matchingThumbnail = document.querySelector(selector);
    showGalleryImage(
      variant.image,
      (currentProduct.name || "Mystora fragrance") + ", " + (SIZE_LABELS[size] || size),
      matchingThumbnail,
    );
  }

  if (updateHistory) updateSelectedSizeInUrl();
  updateWhatsAppLink();
}

function renderThumbnails(product) {
  const list = document.getElementById("thumbnail-list");
  if (!list) return;

  const gallery = [
    { size: "10ml", url: product.image_10ml, label: "10 ml bottle" },
    { size: "50ml", url: product.image_50ml || product.image_url, label: "50 ml bottle" },
    { size: "100ml", url: product.image_100ml, label: "100 ml bottle" },
    { size: "", url: product.promo_image || product.hover_image_url, label: "fragrance campaign image" },
  ].filter((item, index, items) =>
    item.url && items.findIndex((candidate) => candidate.url === item.url) === index,
  );

  setText("gallery-total", String(gallery.length).padStart(2, "0"));
  const thumbnails = gallery.map((item, index) => {
    const button = createElement("button", {
      className: "product-gallery__thumb",
      attributes: {
        type: "button",
        "aria-label": "View " + item.label,
        "aria-pressed": "false",
        "data-index": String(index),
      },
    });
    if (item.size) button.dataset.size = item.size;
    const image = createImage(item.url, "", "");
    image.setAttribute("aria-hidden", "true");
    button.append(image);
    button.addEventListener("click", () => {
      if (item.size) {
        updateSize(item.size);
      } else {
        showGalleryImage(
          item.url,
          (product.name || "Mystora fragrance") + " campaign image",
          button,
        );
      }
    });
    return button;
  });
  list.replaceChildren(...thumbnails);
}

function showGalleryImage(url, alt, activeButton) {
  const image = document.getElementById("main-product-image");
  if (!image || !url) return;

  document.querySelectorAll(".product-gallery__thumb").forEach((button) => {
    const active = button === activeButton;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (activeButton) {
    setText(
      "gallery-current",
      String(Number(activeButton.dataset.index || 0) + 1).padStart(2, "0"),
    );
  }

  image.classList.remove("is-loaded");
  image.onload = () => image.classList.add("is-loaded");
  image.src = url;
  image.alt = alt;
  if (image.complete) image.classList.add("is-loaded");
}

function updateSelectedSizeInUrl() {
  const params = new URLSearchParams(window.location.search);
  params.set("size", selectedSize);
  window.history.replaceState({}, "", window.location.pathname + "?" + params.toString());
}

function updateWhatsAppLink() {
  if (!currentProduct) return;
  const inStock = Number(currentProduct.stock || 0) > 0;
  const button = document.getElementById("whatsapp-order-btn");
  if (!button) return;

  const { price } = getVariant(currentProduct, selectedSize);
  if (!inStock || price <= 0) {
    setOrderButtonState(false);
    return;
  }

  const message = encodeURIComponent(
    "Hi Mystora, I would like to order " +
      currentProduct.name + " (" + selectedSize + ") for " +
      formatLkr(price) + ".",
  );
  button.href = "https://wa.me/" + whatsappPhone + "?text=" + message;
  setOrderButtonState(true);
}

function setOrderButtonState(enabled) {
  const button = document.getElementById("whatsapp-order-btn");
  if (!button) return;
  button.classList.toggle("is-disabled", !enabled);
  button.setAttribute("aria-disabled", String(!enabled));
  button.tabIndex = enabled ? 0 : -1;
  const label = button.querySelector("span");
  if (label) label.textContent = enabled ? "Order via WhatsApp" : "Currently unavailable";
}

async function fetchSimilar(category, currentId) {
  const grid = document.getElementById("similar-grid");
  if (!grid || !category) return;
  renderSkeletons(grid, 4);

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("products")
      .select("id, slug, name, image_url, hover_image_url, price, price_50ml")
      .eq("active", true)
      .eq("category", category)
      .neq("id", currentId)
      .limit(4);
    if (error) throw error;

    if (!data?.length) {
      renderStatus(grid, {
        message: "No similar fragrances are available yet.",
        preserveLayout: true,
      });
      return;
    }
    grid.replaceChildren(...data.map((product) => createProductCard(product)));
  } catch {
    console.error("Similar products could not be loaded.");
    renderStatus(grid, {
      message: "Similar fragrances could not be loaded.",
      onRetry: () => fetchSimilar(category, currentId),
      preserveLayout: true,
    });
  }
}

function normalize(value) {
  return String(value || "").toLocaleLowerCase().trim();
}
