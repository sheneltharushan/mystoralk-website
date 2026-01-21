console.log("Initializing Mystora Script...");

// ----------------------------------------------------
// 0) GLOBALS
// ----------------------------------------------------
let supabaseClient;

let currentProductData = null;
let selectedSize = "50ml";

const SIZE_CONFIG = {
  "10ml": { priceKey: "price_10ml", imageKey: "image_10ml" },
  "50ml": { priceKey: "price_50ml", imageKey: "image_50ml" },
  "100ml": { priceKey: "price_100ml", imageKey: "image_100ml" },
};

// Lenis global (so ScrollTrigger can sync)
let lenisInstance = null;

// ----------------------------------------------------
// 0.1) SLUG HELPERS
// ----------------------------------------------------
function getProductLink(product) {
  if (product?.slug)
    return `/product/?slug=${encodeURIComponent(product.slug)}`;
  return `/product/?id=${product.id}`;
}

// ----------------------------------------------------
// 1) SUPABASE CONFIG
// ----------------------------------------------------
const supabaseUrl = "https://nphpncgggkwckfhyzlwt.supabase.co";
const supabaseKey = "sb_publishable_ksOjpbLF5jsxMJjgxXnc9g_RCEDwdiL";

try {
  if (typeof window.supabase === "undefined") {
    throw new Error("Supabase script is missing in HTML!");
  }
  supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
  console.log("Supabase connected!");
} catch (err) {
  console.error("⚠️ SUPABASE FAILED:", err.message);
}

// ----------------------------------------------------
// 2) DOM READY BOOTSTRAP
// ----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initLenis(); // important: must run before hero ScrollTrigger setup

  loadNavbar();

  loadFeaturedProducts();
  loadSpecialProducts();

  initHeroVideoScroll();

  initProductPage();
  initShopPage();
});

// ----------------------------------------------------
// 3) LENIS (with ScrollTrigger sync)
// ----------------------------------------------------
function initLenis() {
  if (typeof Lenis === "undefined") return;

  lenisInstance = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true,
  });

  function raf(time) {
    lenisInstance.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // If GSAP/ScrollTrigger exists, sync them
  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);

    // Update ScrollTrigger on Lenis scroll
    lenisInstance.on("scroll", ScrollTrigger.update);

    // Ensure GSAP ticker drives Lenis too (helps with pin/scrub smoothness)
    gsap.ticker.add((time) => {
      lenisInstance.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // Optional: if you use a custom scroll container, you'd add scrollerProxy here.
    // For most Lenis setups, this is enough.
  }
}

// ----------------------------------------------------
// HERO WEBP SEQUENCE SCROLL (001.webp ... 192.webp) in /assets/frames/
// ----------------------------------------------------

const HERO_FRAME_COUNT = 192;

// ✅ your filenames: 001.webp, 002.webp ... 192.webp
function heroFrameSrc(i) {
  const n = String(i + 1).padStart(3, "0"); // 001..192
  return `/assets/frames/${n}.webp`;
}

function initHeroVideoScroll() {
  const section = document.getElementById("hero-section");
  const text = document.getElementById("hero-text-container");
  if (!section) return;

  // Hide <video> if it still exists
  const oldVideo = document.getElementById("hero-video");
  if (oldVideo) oldVideo.style.display = "none";

  // Put this inside initHeroVideoScroll(), after you have "section"
  const wrap =
    section.querySelector(".w-full.h-full.relative") ||
    section.querySelector(".w-full.h-full") ||
    section;

  let indicator = document.getElementById("scroll-indicator");

  // Create if missing
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "scroll-indicator";
    indicator.className =
      "absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none text-white";
    wrap.appendChild(indicator);
  }

  // ALWAYS replace content (fixes the “box” issue)
  indicator.innerHTML = `
  <span class="text-[10px] tracking-[0.35em] uppercase">SCROLL</span>

  <svg width="26" height="26" viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 5v10" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <path d="M7 12l5 5 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

  // Optional: bounce animation (works even if Tailwind animate-bounce fails)
  const svg = indicator.querySelector("svg");
  if (svg) {
    svg.animate(
      [
        { transform: "translateY(0px)" },
        { transform: "translateY(8px)" },
        { transform: "translateY(0px)" },
      ],
      { duration: 1200, iterations: Infinity }
    );
  }

  // Find or create canvas
  let canvas = document.getElementById("hero-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "hero-canvas";
    canvas.className =
      "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full object-cover z-0 opacity-0";
    wrap.appendChild(canvas);
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const frames = new Array(HERO_FRAME_COUNT);
  const loaded = new Array(HERO_FRAME_COUNT).fill(false);
  let currentFrameIndex = 0;

  function resizeCanvasToDisplaySize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();

    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
  }

  function drawCover(img) {
    const rect = canvas.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;

    ctx.clearRect(0, 0, cw, ch);

    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    let scale = Math.max(cw / iw, ch / ih);

    // smaller bottle on mobile
    if (window.innerWidth < 768) scale *= 0.88;

    const dw = iw * scale;
    const dh = ih * scale;

    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
  }

  let rafPending = false;
  function renderFrame(i) {
    const idx = Math.max(0, Math.min(HERO_FRAME_COUNT - 1, i | 0));
    currentFrameIndex = idx;

    const img = frames[idx];
    if (!img || !loaded[idx]) return;

    if (rafPending) return;
    rafPending = true;

    requestAnimationFrame(() => {
      rafPending = false;
      resizeCanvasToDisplaySize();
      drawCover(img);
    });
  }

  function preload() {
    for (let i = 0; i < HERO_FRAME_COUNT; i++) {
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.src = heroFrameSrc(i);

      img.onload = () => {
        loaded[i] = true;
        if (i === 0) renderFrame(0);
        if (i === currentFrameIndex) renderFrame(currentFrameIndex);
      };

      frames[i] = img;
    }
  }

  preload();

  // Initial state
  if (typeof gsap !== "undefined") {
    gsap.set(canvas, { opacity: 0 });
    if (text) gsap.set(text, { opacity: 1, y: 0 });
    if (indicator) gsap.set(indicator, { opacity: 1, y: 0 });
  } else {
    canvas.style.opacity = "0";
    if (text) text.style.opacity = "1";
    if (indicator) indicator.style.opacity = "1";
  }

  // Fallback (no GSAP)
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    canvas.style.opacity = "1";
    if (text) text.style.opacity = "0";

    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const total = window.innerHeight * 4;
      const progress = Math.min(1, Math.max(0, (0 - rect.top) / total));
      renderFrame(Math.round(progress * (HERO_FRAME_COUNT - 1)));

      if (indicator) indicator.style.opacity = window.scrollY > 40 ? "0" : "1";
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => renderFrame(currentFrameIndex));
    onScroll();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Kill old triggers for THIS section only
  ScrollTrigger.getAll().forEach((t) => {
    if (t && t.trigger === section) t.kill();
  });

  const playhead = { frame: 0 };

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: "+=400%",
      scrub: 1,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onRefresh: () => renderFrame(currentFrameIndex),
    },
  });

  // ✅ Fade scroll indicator away quickly at the start of scroll
  if (indicator) {
    tl.to(
      indicator,
      { opacity: 0, y: 10, duration: 0.6, ease: "power1.out" },
      0
    );
  }

  // Phase A: text out + canvas in
  if (text) {
    tl.to(text, { opacity: 0, y: -50, duration: 1, ease: "power2.inOut" }, 0);
  }

  tl.to(canvas, { opacity: 1, duration: 1, ease: "power2.inOut" }, 0);

  // Phase B: scrub frames
  tl.to(playhead, {
    frame: HERO_FRAME_COUNT - 1,
    duration: 8,
    ease: "none",
    onUpdate: () => renderFrame(Math.round(playhead.frame)),
  });

  window.addEventListener("resize", () => {
    ScrollTrigger.refresh();
    renderFrame(currentFrameIndex);
  });
}

// ----------------------------------------------------
// 5) NAVBAR LOADER (updated for folder routes)
// ----------------------------------------------------
async function loadNavbar() {
  const container = document.getElementById("navbar-container");
  if (!container) return;

  try {
    const response = await fetch("/navbar.html");
    const html = await response.text();
    container.innerHTML = html;

    initNavbarMobile(container);

    const currentPath = window.location.pathname;
    const normalize = (p) => (p.endsWith("/") ? p : p + "/");

    const links = container.querySelectorAll("a");
    links.forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("/")) return;

      if (normalize(href) === normalize(currentPath)) {
        link.classList.add("opacity-50", "pointer-events-none");
      }
    });
  } catch (error) {
    console.error("Error loading navbar:", error);
  }
}

function initNavbarMobile(container) {
  const btn = container.querySelector("#menuBtn");
  const menu = container.querySelector("#mobileMenu");
  if (!btn || !menu) return;

  const closeMenu = () => {
    menu.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");
    btn.textContent = "☰";
  };

  const toggleMenu = (e) => {
    if (e) e.stopPropagation();

    const isOpen = !menu.classList.contains("hidden");
    if (isOpen) closeMenu();
    else {
      menu.classList.remove("hidden");
      btn.setAttribute("aria-expanded", "true");
      btn.textContent = "✕";
    }
  };

  btn.onclick = toggleMenu;

  menu.querySelectorAll("a").forEach((a) => {
    a.onclick = closeMenu;
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) closeMenu();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 768) closeMenu();
  });
}

// ----------------------------------------------------
// 6) FEATURED PRODUCTS
// ----------------------------------------------------
async function loadFeaturedProducts() {
  const grid = document.getElementById("featured-grid");
  if (!grid || !supabaseClient) return;

  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("is_featured", true)
    .eq("active", true)
    .limit(4);

  if (error) {
    console.error("Error fetching featured:", error);
    return;
  }

  grid.innerHTML = "";

  products.forEach((product) => {
    const hoverImage = product.hover_image_url || product.image_url;
    const displayPrice = Number(product.price_50ml ?? product.price ?? 0);

    const card = document.createElement("div");
    card.className = "group cursor-pointer";
    card.onclick = () => (window.location.href = getProductLink(product));

    card.innerHTML = `
      <div class="relative w-full aspect-[3/4] overflow-hidden bg-gray-900 mb-5">
        <img src="${
          product.image_url
        }" class="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-100 group-hover:opacity-0">
        <img src="${hoverImage}" class="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-0 group-hover:opacity-100">

        <div class="absolute bottom-0 left-0 w-full bg-white text-black text-center py-3 translate-y-full transition-transform duration-500 group-hover:translate-y-0">
          <span class="text-[10px] font-bold uppercase tracking-widest">View Product</span>
        </div>
      </div>

      <div class="text-white">
        <h3 class="font-brand text-xl tracking-wide mb-1">${product.name}</h3>
        <p class="text-xs text-gray-400 uppercase tracking-widest mb-3">LKR ${displayPrice.toLocaleString()}</p>

        <a href="${getProductLink(
          product
        )}" onclick="event.stopPropagation()" class="inline-block text-[10px] uppercase tracking-[0.2em] border-b border-white pb-1 hover:text-gray-400 hover:border-gray-400 transition-colors">
          Order Now
        </a>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ----------------------------------------------------
// 7) SPECIAL PRODUCTS
// ----------------------------------------------------
async function loadSpecialProducts() {
  const grid = document.getElementById("special-grid");
  if (!grid || !supabaseClient) return;

  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("category", "special")
    .eq("active", true)
    .limit(3);

  if (error) {
    console.error("Error fetching specials:", error);
    return;
  }

  grid.innerHTML = "";

  products.forEach((product) => {
    const hoverImage = product.hover_image_url || product.image_url;
    const displayPrice = Number(product.price_50ml ?? product.price ?? 0);

    const card = document.createElement("div");
    card.className = "group cursor-pointer";
    card.onclick = () => (window.location.href = getProductLink(product));

    card.innerHTML = `
      <div class="relative w-full aspect-[3/4] overflow-hidden bg-gray-100 mb-5">
        <img src="${
          product.image_url
        }" class="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-100 group-hover:opacity-0">
        <img src="${hoverImage}" class="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-0 group-hover:opacity-100">

        <div class="absolute bottom-0 left-0 w-full bg-black text-white text-center py-3 translate-y-full transition-transform duration-500 group-hover:translate-y-0">
          <span class="text-[10px] font-bold uppercase tracking-widest">View Product</span>
        </div>
      </div>

      <div class="text-mystora-black text-center">
        <h3 class="font-brand text-2xl tracking-wide mb-2">${product.name}</h3>
        <p class="text-xs text-gray-500 uppercase tracking-widest mb-4">LKR ${displayPrice.toLocaleString()}</p>

        <a href="${getProductLink(
          product
        )}" onclick="event.stopPropagation()" class="inline-block text-[10px] uppercase tracking-[0.2em] border-b border-black pb-1 hover:opacity-50 transition-opacity">
          Order Now
        </a>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ----------------------------------------------------
// 8) PRODUCT PAGE INIT (slug first, fallback to id)
// ----------------------------------------------------
function initProductPage() {
  const productNameEl = document.getElementById("product-name");
  if (!productNameEl) return;

  const params = new URLSearchParams(window.location.search);

  const slug = params.get("slug");
  if (slug) {
    fetchProductBySlug(slug);
    return;
  }

  const id = params.get("id");
  if (!id) return;

  fetchProductDetails(id);
}

// ----------------------------------------------------
// 9) VARIANT HELPERS
// ----------------------------------------------------
function getVariant(product, size) {
  const cfg = SIZE_CONFIG[size] || SIZE_CONFIG["50ml"];

  const price = Number(
    product?.[cfg.priceKey] ?? product?.price_50ml ?? product?.price ?? 0
  );

  const image =
    product?.[cfg.imageKey] ?? product?.image_50ml ?? product?.image_url ?? "";

  return { price, image };
}

function applyVariantToUI(product, size) {
  const { price, image } = getVariant(product, size);

  const priceEl = document.getElementById("product-price");
  if (priceEl) priceEl.innerText = `LKR ${price.toLocaleString()}`;

  const mainImg = document.getElementById("main-product-image");
  if (mainImg && image) {
    mainImg.src = image;
    mainImg.classList.remove("opacity-0");
  }
}

// ----------------------------------------------------
// 10) PRODUCT DETAILS
// ----------------------------------------------------
async function fetchProductDetails(id) {
  if (!supabaseClient) return;

  const { data: product, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("active", true)
    .eq("id", id)
    .single();

  if (error || !product) {
    console.error("Product fetch error:", error);
    return;
  }

  hydrateProductUI(product);
}

async function fetchProductBySlug(slug) {
  if (!supabaseClient) return;

  const { data: product, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("active", true)
    .eq("slug", slug)
    .single();

  if (error || !product) {
    console.error("Product fetch error:", error);
    return;
  }

  hydrateProductUI(product);
}

function hydrateProductUI(product) {
  currentProductData = product;

  const elName = document.getElementById("product-name");
  const elCat = document.getElementById("breadcrumb-category");
  const elInspired = document.getElementById("inspired-by");
  const elDesc = document.getElementById("product-description");

  if (elName) elName.innerText = product.name;
  if (elCat) elCat.innerText = product.category;

  if (elInspired) {
    elInspired.innerText =
      product.category === "clone"
        ? "Inspired by Luxery Scent"
        : "Mystora Original";
  }

  if (elDesc) {
    elDesc.innerText =
      product.description || "Experience the depth of Mystora's finest blends.";
  }

  selectedSize = "50ml";
  applyVariantToUI(product, selectedSize);

  renderThumbnails(product);
  updateWhatsAppLink();
  fetchSimilar(product.category, product.id);
}

function renderThumbnails(product) {
  const thumbList = document.getElementById("thumbnail-list");
  if (!thumbList) return;

  thumbList.innerHTML = "";

  const gallery = [
    { size: "10ml", url: product.image_10ml, type: "size" },
    {
      size: "50ml",
      url: product.image_50ml || product.image_url,
      type: "size",
    },
    { size: "100ml", url: product.image_100ml, type: "size" },
    { size: "Promo", url: product.promo_image, type: "promo" },
  ].filter((x) => x.url);

  gallery.forEach((item) => {
    const img = document.createElement("img");
    img.src = item.url;
    img.className =
      "w-20 h-24 object-cover cursor-pointer border border-neutral-800 hover:border-white transition-all";

    img.onclick = () => {
      if (item.type === "promo") {
        const mainImg = document.getElementById("main-product-image");
        if (mainImg) mainImg.src = item.url;
        return;
      }
      updateSize(item.size);
    };

    thumbList.appendChild(img);
  });
}

function updateSize(size) {
  selectedSize = size;

  document.querySelectorAll(".size-btn").forEach((btn) => {
    const isActive = btn.innerText.trim().toLowerCase() === size.toLowerCase();
    btn.className = isActive
      ? "size-btn border border-white bg-white text-black px-8 py-3 text-[10px] uppercase tracking-widest transition-all"
      : "size-btn border border-neutral-700 px-8 py-3 text-[10px] uppercase tracking-widest hover:border-white transition-all";
  });

  if (!currentProductData) return;

  applyVariantToUI(currentProductData, selectedSize);
  updateWhatsAppLink();
}

function updateWhatsAppLink() {
  if (!currentProductData) return;

  const btn = document.getElementById("whatsapp-order-btn");
  if (!btn) return;

  const phone = "94701436936";
  const text = encodeURIComponent(
    `Hi Mystora, I would like to order ${currentProductData.name} (${selectedSize}).`
  );

  btn.href = `https://wa.me/${phone}?text=${text}`;
}

async function fetchSimilar(category, currentId) {
  if (!supabaseClient) return;

  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("active", true)
    .eq("category", category)
    .neq("id", currentId)
    .limit(4);

  if (error) {
    console.error("Similar fetch error:", error);
    return;
  }

  const grid = document.getElementById("similar-grid");
  if (!grid) return;

  grid.innerHTML = "";

  (products || []).forEach((product) => {
    const displayPrice = Number(product.price_50ml ?? product.price ?? 0);

    const card = document.createElement("div");
    card.className = "group cursor-pointer";
    card.onclick = () => (window.location.href = getProductLink(product));

    card.innerHTML = `
      <div class="aspect-[3/4] bg-neutral-900 mb-4 overflow-hidden border border-neutral-800">
        <img src="${
          product.image_url
        }" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700">
      </div>
      <h3 class="font-brand text-lg">${product.name}</h3>
      <p class="text-[10px] uppercase tracking-widest text-gray-500">LKR ${displayPrice.toLocaleString()}</p>
    `;

    grid.appendChild(card);
  });
}

// ----------------------------------------------------
// 11) SHOP PAGE (/shop/)
// ----------------------------------------------------
let shopAllProducts = [];
let shopViewProducts = [];

function initShopPage() {
  const grid = document.getElementById("shop-grid");
  if (!grid) return;

  const searchEl = document.getElementById("shop-search");
  const categoryEl = document.getElementById("shop-category");
  const sortEl = document.getElementById("shop-sort");
  const clearBtn = document.getElementById("shop-clear");

  if (!searchEl || !categoryEl || !sortEl || !clearBtn) return;

  fetchShopProducts();

  let t = null;
  searchEl.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(applyShopFilters, 150);
  });

  categoryEl.addEventListener("change", applyShopFilters);
  sortEl.addEventListener("change", applyShopFilters);

  clearBtn.addEventListener("click", () => {
    searchEl.value = "";
    categoryEl.value = "all";
    sortEl.value = "newest";
    applyShopFilters();
  });
}

async function fetchShopProducts() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("active", true);

  if (error) {
    console.error("Error fetching shop products:", error);
    return;
  }

  shopAllProducts = data || [];
  applyShopFilters();
}

function shopCardPrice(product) {
  return Number(product.price_50ml ?? product.price ?? 0);
}

function shopNormalize(v) {
  return String(v || "")
    .toLowerCase()
    .trim();
}

function shopSort(list, sortVal) {
  const arr = [...list];

  if (sortVal === "newest") {
    arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return arr;
  }
  if (sortVal === "price_asc") {
    arr.sort((a, b) => shopCardPrice(a) - shopCardPrice(b));
    return arr;
  }
  if (sortVal === "price_desc") {
    arr.sort((a, b) => shopCardPrice(b) - shopCardPrice(a));
    return arr;
  }
  if (sortVal === "name_asc") {
    arr.sort((a, b) =>
      shopNormalize(a.name).localeCompare(shopNormalize(b.name))
    );
    return arr;
  }
  if (sortVal === "name_desc") {
    arr.sort((a, b) =>
      shopNormalize(b.name).localeCompare(shopNormalize(a.name))
    );
    return arr;
  }

  return arr;
}

function applyShopFilters() {
  const grid = document.getElementById("shop-grid");
  if (!grid) return;

  const empty = document.getElementById("shop-empty");
  const results = document.getElementById("shop-results");

  const searchVal = shopNormalize(
    document.getElementById("shop-search")?.value
  );
  const categoryVal = shopNormalize(
    document.getElementById("shop-category")?.value
  );
  const sortVal = document.getElementById("shop-sort")?.value || "newest";

  let filtered = [...shopAllProducts];

  if (searchVal) {
    filtered = filtered.filter((p) =>
      shopNormalize(p.name).includes(searchVal)
    );
  }

  if (categoryVal && categoryVal !== "all") {
    filtered = filtered.filter(
      (p) => shopNormalize(p.category) === categoryVal
    );
  }

  filtered = shopSort(filtered, sortVal);

  shopViewProducts = filtered;

  if (results) results.innerText = `${shopViewProducts.length} Results`;

  renderShopGrid(shopViewProducts);

  if (empty) {
    if (shopViewProducts.length === 0) empty.classList.remove("hidden");
    else empty.classList.add("hidden");
  }
}

function renderShopGrid(products) {
  const grid = document.getElementById("shop-grid");
  if (!grid) return;

  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.getAll().forEach((t) => {
      const triggerEl = t?.trigger;
      if (triggerEl && triggerEl.closest && triggerEl.closest("#shop-grid")) {
        t.kill();
      }
    });
  }

  grid.innerHTML = "";

  products.forEach((product) => {
    const hoverImage = product.hover_image_url || product.image_url;
    const displayPrice = shopCardPrice(product);

    const card = document.createElement("div");
    card.className = "group cursor-pointer";
    card.onclick = () => (window.location.href = getProductLink(product));

    card.innerHTML = `
      <div class="relative w-full aspect-[3/4] overflow-hidden bg-neutral-900 mb-4 border border-neutral-800">
        <img src="${
          product.image_url
        }" class="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-100 group-hover:opacity-0">
        <img src="${hoverImage}" class="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-0 group-hover:opacity-100">

        <div class="absolute bottom-0 left-0 w-full bg-white text-black text-center py-3 translate-y-full transition-transform duration-500 group-hover:translate-y-0">
          <span class="text-[10px] font-bold uppercase tracking-widest">View Product</span>
        </div>
      </div>

      <div class="text-white">
        <h3 class="font-brand text-lg md:text-xl tracking-wide mb-1">${
          product.name || ""
        }</h3>
        <p class="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest">
          LKR ${displayPrice.toLocaleString()}
        </p>
      </div>
    `;

    card.style.opacity = "0";
    card.style.transform = "translateY(16px)";

    grid.appendChild(card);
  });

  animateShopCards();
}

function animateShopCards() {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    document.querySelectorAll("#shop-grid > div").forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  gsap.utils.toArray("#shop-grid > div").forEach((card) => {
    gsap.to(card, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: "power2.out",
      scrollTrigger: {
        trigger: card,
        start: "top 90%",
      },
    });
  });
}
