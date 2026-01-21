console.log("Initializing Mystora Script...");

// ----------------------------------------------------
// 0) GLOBALS
// ----------------------------------------------------
let supabaseClient;

let currentProductData = null;
let selectedSize = "50ml";

// Hero globals
let heroCanvas = null;
let heroContext = null;
let heroImages = [];
let heroSequence = { frame: 0 };
let heroTl = null;

const HERO_FRAME_COUNT = 192;

const SIZE_CONFIG = {
  "10ml": { priceKey: "price_10ml", imageKey: "image_10ml" },
  "50ml": { priceKey: "price_50ml", imageKey: "image_50ml" },
  "100ml": { priceKey: "price_100ml", imageKey: "image_100ml" },
};

// ----------------------------------------------------
// 0.1) SLUG HELPERS
// ----------------------------------------------------
function getProductLink(product) {
  // Prefer slug, fallback to id
  if (product?.slug)
    return `product.html?slug=${encodeURIComponent(product.slug)}`;
  return `product.html?id=${product.id}`;
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
  initLenis();

  loadNavbar();

  // Index page sections (they silently return if elements are missing)
  loadFeaturedProducts();
  loadSpecialProducts();

  // Hero animation (silently returns if canvas missing)
  initHeroAnimation();

  // Product page logic (silently returns if not product page)
  initProductPage();

  // Shop page logic (silently returns if not shop page)
  initShopPage();
});

// ----------------------------------------------------
// 3) LENIS
// ----------------------------------------------------
function initLenis() {
  if (typeof Lenis === "undefined") return;

  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

// ----------------------------------------------------
// 4) HERO
// ----------------------------------------------------
function initHeroAnimation() {
  heroCanvas = document.getElementById("hero-canvas");
  if (!heroCanvas) return;

  heroContext = heroCanvas.getContext("2d");
  if (!heroContext) return;

  heroCanvas.width = 1920;
  heroCanvas.height = 1080;

  heroImages = [];
  heroSequence = { frame: 0 };

  const currentFrame = (index) =>
    `assets/frames/${(index + 1).toString().padStart(3, "0")}.png`;

  for (let i = 0; i < HERO_FRAME_COUNT; i++) {
    const img = new Image();
    img.src = currentFrame(i);
    if (i === 0) img.onload = heroRender;
    heroImages.push(img);
  }

  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    window.addEventListener("resize", heroRender);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  if (document.querySelector("#hero-text-container")) {
    gsap.set("#hero-text-container", { opacity: 1, y: 0 });
  }
  gsap.set("#hero-canvas", { opacity: 0 });

  heroTl = gsap.timeline({
    scrollTrigger: {
      trigger: "#hero-section",
      start: "top top",
      end: "+=400%",
      scrub: 1,
      pin: true,
      anticipatePin: 1,
    },
  });

  heroTl.to("#hero-text-container", {
    opacity: 0,
    y: -50,
    duration: 1,
    ease: "power2.inOut",
  });

  heroTl.to(
    "#hero-canvas",
    { opacity: 1, duration: 1, ease: "power2.inOut" },
    "-=0.5"
  );

  heroTl.to(heroSequence, {
    frame: HERO_FRAME_COUNT - 1,
    snap: "frame",
    ease: "none",
    duration: 8,
    onUpdate: heroRender,
  });

  window.addEventListener("resize", heroRender);
}

function heroRender() {
  if (!heroCanvas || !heroContext) return;

  const safeFrame = Math.max(
    0,
    Math.min(heroSequence.frame, HERO_FRAME_COUNT - 1)
  );
  const img = heroImages[safeFrame];
  if (!img || !img.complete) return;

  heroContext.clearRect(0, 0, heroCanvas.width, heroCanvas.height);

  const hRatio = heroCanvas.width / img.width;
  const vRatio = heroCanvas.height / img.height;
  const ratio = Math.max(hRatio, vRatio);

  const centerShiftX = (heroCanvas.width - img.width * ratio) / 2;
  const centerShiftY = (heroCanvas.height - img.height * ratio) / 2;

  heroContext.drawImage(
    img,
    0,
    0,
    img.width,
    img.height,
    centerShiftX,
    centerShiftY,
    img.width * ratio,
    img.height * ratio
  );
}

// ----------------------------------------------------
// 5) NAVBAR LOADER
// ----------------------------------------------------
async function loadNavbar() {
  const container = document.getElementById("navbar-container");
  if (!container) return;

  try {
    const response = await fetch("navbar.html");
    const html = await response.text();
    container.innerHTML = html;

    // init mobile menu AFTER the HTML is inserted
    initNavbarMobile(container);

    const currentPath =
      window.location.pathname.split("/").pop() || "index.html";
    const links = container.querySelectorAll("a");
    links.forEach((link) => {
      if (link.getAttribute("href") === currentPath) {
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

  const toggleMenu = () => {
    const isOpen = !menu.classList.contains("hidden");
    if (isOpen) closeMenu();
    else {
      menu.classList.remove("hidden");
      btn.setAttribute("aria-expanded", "true");
      btn.textContent = "✕";
    }
  };

  // prevent double listeners if loadNavbar is called again
  btn.onclick = toggleMenu;

  // close when clicking a menu link
  menu.querySelectorAll("a").forEach((a) => {
    a.onclick = closeMenu;
  });

  // close when clicking outside
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) closeMenu();
  });

  // close when resizing to desktop
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

// Thumbnails: sizes switch variant, promo only switches image
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

// Size buttons call this
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

// Similar products
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
// 11) SHOP PAGE (shop.html)
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
