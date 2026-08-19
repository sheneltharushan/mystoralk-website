import { createElement } from "./dom.js";

let lenisInstance = null;

export function initSmoothScroll() {
  window.addEventListener("mystora:overlay-change", syncOverlayScrollState);
  if (typeof window.Lenis === "undefined") return;

  lenisInstance = new window.Lenis({
    duration: 1.2,
    easing: (time) => Math.min(1, 1.001 - Math.pow(2, -10 * time)),
    smoothWheel: true,
  });

  const raf = (time) => {
    lenisInstance.raf(time);
    window.requestAnimationFrame(raf);
  };
  window.requestAnimationFrame(raf);

  if (window.ScrollTrigger) {
    lenisInstance.on("scroll", window.ScrollTrigger.update);
  }

}

export function initFooterNewsletter() {
  const form = document.getElementById("footer-signup");
  const status = document.getElementById("footer-signup-status");
  if (!form || !status || form.dataset.initialized === "true") return;

  form.dataset.initialized = "true";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    status.textContent = "Thanks. Mystora email notes are coming soon.";
    form.reset();
  });
}

export async function loadNavbar() {
  const container = document.getElementById("navbar-container");
  if (!container) return;

  try {
    let response = await fetch("/navbar.partial");
    if (!response.ok) {
      response = await fetch("/navbar.html");
    }
    if (!response.ok) {
      throw new Error(`Navigation request failed: ${response.status}`);
    }

    const fragment = document
      .createRange()
      .createContextualFragment(await response.text());
    container.replaceChildren(fragment);

    markCurrentNavLink(container);
    initNavigationState(container);

    window.dispatchEvent(new CustomEvent("mystora:navbar-ready"));

    try {
      const { initGlobalSearch } = await import("./search.js");
      initGlobalSearch(container);
    } catch {
      console.error("Search could not be initialized.");
    }
  } catch {
    console.error("Navigation could not be loaded.");
    renderFallbackNavbar(container);
  }
}

function markCurrentNavLink(container) {
  const normalize = (path) => {
    const value = path.endsWith("/") ? path : `${path}/`;
    return value.replace(/\/index\.html\/$/, "/");
  };
  const currentPath = normalize(window.location.pathname);

  container.querySelectorAll("a[href^='/']").forEach((link) => {
    const targetPath = normalize(new URL(link.href).pathname);
    if (targetPath === currentPath) {
      link.setAttribute("aria-current", "page");
    }
  });
}

function initNavigationState(container) {
  const header = container.querySelector("#site-header");
  const menuButton = container.querySelector("#menuBtn");
  const drawer = container.querySelector("#navDrawer");
  if (!header || !menuButton || !drawer) return;

  const hero = document.getElementById("hero-section");
  let ticking = false;

  const updateHeader = () => {
    ticking = false;
    const glassThreshold = hero
      ? Math.max(80, hero.offsetHeight - header.offsetHeight)
      : 0;
    header.classList.toggle("is-glass", !hero || window.scrollY >= glassThreshold);
  };

  const requestHeaderUpdate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateHeader);
  };

  const closeMenu = ({ restoreFocus = false } = {}) => {
    if (!drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation menu");
    notifyOverlayChange();
    if (restoreFocus) menuButton.focus();
  };

  const openMenu = () => {
    window.dispatchEvent(new CustomEvent("mystora:close-search"));
    window.dispatchEvent(new CustomEvent("mystora:close-coming-soon"));
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    menuButton.setAttribute("aria-expanded", "true");
    menuButton.setAttribute("aria-label", "Close navigation menu");
    notifyOverlayChange();
    drawer
      .querySelector("[data-menu-close]:not(.nav-drawer__backdrop)")
      ?.focus();
  };

  menuButton.addEventListener("click", () => {
    if (drawer.classList.contains("is-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });
  drawer.querySelectorAll("[data-menu-close]").forEach((button) => {
    button.addEventListener("click", () => closeMenu({ restoreFocus: true }));
  });
  drawer.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeMenu());
  });
  window.addEventListener("mystora:close-menu", () => closeMenu());
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer.classList.contains("is-open")) {
      closeMenu({ restoreFocus: true });
    }
  });
  window.addEventListener("scroll", requestHeaderUpdate, { passive: true });
  window.addEventListener("resize", requestHeaderUpdate);
  initComingSoonPanel(container);
  updateHeader();
}

function initComingSoonPanel(container) {
  const overlay = container.querySelector("#comingSoonOverlay");
  const triggers = [...container.querySelectorAll("[data-coming-soon]")];
  const title = container.querySelector("#comingSoonTitle");
  const description = container.querySelector("#comingSoonDescription");
  const number = container.querySelector("#comingSoonNumber");
  const benefits = [...container.querySelectorAll("[data-coming-benefit]")];
  const primary = container.querySelector("#comingSoonPrimary");
  const secondary = container.querySelector("#comingSoonSecondary");
  if (!overlay || !triggers.length || !title || !description || !primary || !secondary) return;

  const whatsappUrl =
    "https://wa.me/94768253595?text=" +
    encodeURIComponent("Hi Mystora, I would like some help placing an order.");
  const content = {
    profile: {
      number: "01",
      title: "Your Mystora profile",
      description:
        "Personal accounts are being prepared for a quieter, more personal way to shop Mystora.",
      benefits: ["Save your favourites", "Keep delivery details ready", "See your order history"],
      primary: { label: "Explore fragrances", href: "/shop/" },
      secondary: { label: "Talk to us", href: whatsappUrl, external: true },
    },
    cart: {
      number: "02",
      title: "Checkout is coming soon",
      description:
        "Online checkout is not live yet. Until then, every order is handled personally through WhatsApp.",
      benefits: ["Choose your bottle size", "Confirm delivery directly", "Get help from a real person"],
      primary: { label: "Order on WhatsApp", href: whatsappUrl, external: true },
      secondary: { label: "Browse fragrances", href: "/shop/" },
    },
  };
  let activeTrigger = null;

  const closePanel = ({ restoreFocus = false } = {}) => {
    if (!overlay.classList.contains("is-open")) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    triggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
    notifyOverlayChange();
    if (restoreFocus) activeTrigger?.focus();
    activeTrigger = null;
  };

  const setAction = (element, action) => {
    const arrow = createElement("span", {
      text: "↗",
      attributes: { "aria-hidden": "true" },
    });
    element.replaceChildren(document.createTextNode(action.label + " "), arrow);
    element.href = action.href;
    if (action.external) {
      element.target = "_blank";
      element.rel = "noopener";
    } else {
      element.removeAttribute("target");
      element.removeAttribute("rel");
    }
  };

  const openPanel = (trigger) => {
    const config = content[trigger.dataset.comingSoon] || content.profile;
    window.dispatchEvent(new CustomEvent("mystora:close-menu"));
    window.dispatchEvent(new CustomEvent("mystora:close-search"));
    activeTrigger = trigger;
    title.textContent = config.title;
    description.textContent = config.description;
    if (number) number.textContent = config.number;
    benefits.forEach((element, index) => {
      element.textContent = config.benefits[index] || "";
    });
    setAction(primary, config.primary);
    setAction(secondary, config.secondary);
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    trigger.setAttribute("aria-expanded", "true");
    notifyOverlayChange();
    window.setTimeout(
      () => overlay.querySelector("[data-coming-close]:not(.coming-soon-overlay__backdrop)")?.focus(),
      120,
    );
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      if (overlay.classList.contains("is-open") && activeTrigger === trigger) {
        closePanel({ restoreFocus: true });
      } else {
        openPanel(trigger);
      }
    });
  });
  overlay.querySelectorAll("[data-coming-close]").forEach((button) => {
    button.addEventListener("click", () => closePanel({ restoreFocus: true }));
  });
  overlay.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closePanel());
  });
  window.addEventListener("mystora:close-coming-soon", () => closePanel());
  window.addEventListener("keydown", (event) => {
    if (!overlay.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      closePanel({ restoreFocus: true });
    } else if (event.key === "Tab") {
      trapPanelFocus(event, overlay);
    }
  });
}

function trapPanelFocus(event, container) {
  const focusable = [...container.querySelectorAll(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function notifyOverlayChange() {
  window.dispatchEvent(new CustomEvent("mystora:overlay-change"));
}

function syncOverlayScrollState() {
  const hasOpenOverlay = Boolean(
    document.querySelector(
      ".nav-drawer.is-open, .search-overlay.is-open, .coming-soon-overlay.is-open",
    ),
  );
  document.documentElement.classList.toggle("mystora-overlay-open", hasOpenOverlay);
  if (hasOpenOverlay) {
    lenisInstance?.stop();
  } else {
    lenisInstance?.start();
  }
}

function renderFallbackNavbar(container) {
  const nav = createElement("nav", {
    className:
      "fixed top-3 left-3 right-3 z-50 h-16 px-6 flex justify-between items-center rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl text-white",
    attributes: { "aria-label": "Main navigation" },
  });
  nav.append(
    createElement("a", {
      className: "font-gotham-black tracking-[0.18em]",
      text: "MYSTORA",
      attributes: { href: "/" },
    }),
    createElement("a", {
      className: "text-xs tracking-[0.15em] uppercase",
      text: "Shop",
      attributes: { href: "/shop/" },
    }),
  );
  container.replaceChildren(nav);
}
