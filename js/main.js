import { initFooterNewsletter, initSmoothScroll, loadNavbar } from "./core.js";

function safelyInitialize(name, initializer) {
  try {
    const result = initializer();
    if (result instanceof Promise) {
      result.catch(() => console.error(`${name} failed.`));
    }
  } catch {
    console.error(`${name} failed.`);
  }
}

safelyInitialize("Smooth scrolling", initSmoothScroll);
safelyInitialize("Navigation", loadNavbar);
safelyInitialize("Footer newsletter", initFooterNewsletter);

if (document.getElementById("featured-rail")) {
  safelyInitialize("Homepage", async () => {
    const { initHomePage } = await import("./home.js");
    initHomePage();
  });
}

if (document.getElementById("hero-section")) {
  safelyInitialize("Hero", async () => {
    const { initHero } = await import("./hero.js");
    initHero();
  });
}

if (document.getElementById("product-name")) {
  safelyInitialize("Product page", async () => {
    const { initProductPage } = await import("./product.js");
    initProductPage();
  });
}

if (document.body.dataset.catalogPage === "shop") {
  safelyInitialize("Shop", async () => {
    const { initShopPage } = await import("./shop.js");
    initShopPage();
  });
} else if (document.getElementById("search-page-grid")) {
  safelyInitialize("Search results", async () => {
    const { initSearchPage } = await import("./search-page.js");
    initSearchPage();
  });
}
