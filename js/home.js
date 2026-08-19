import { renderSkeletons, renderStatus } from "./dom.js";
import { createHomeProductCard } from "./products.js";
import { getSupabaseClient } from "./supabase.js";

const CARD_FIELDS =
  "id, slug, name, image_url, hover_image_url, price, price_50ml, created_at";

export function initHomePage() {
  const featuredRail = document.getElementById("featured-rail");
  if (featuredRail) {
    setupProductRail(featuredRail);
    loadHomepageCatalog(featuredRail);
  }
}

async function loadHomepageCatalog(featuredRail) {
  if (featuredRail) renderSkeletons(featuredRail, 5);

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("products")
      .select(CARD_FIELDS)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;

    if (!data?.length) {
      renderStatus(featuredRail, {
        message: "New fragrances are being prepared.",
        tone: "dark",
        preserveLayout: true,
      });
      return;
    }

    if (featuredRail) {
      featuredRail.replaceChildren(...data.map(createHomeProductCard));
      featuredRail.dispatchEvent(new Event("rail:updated"));
    }
  } catch {
    console.error("Could not load homepage fragrances.");
    renderStatus(featuredRail, {
      message: "We could not load these fragrances. Please check your connection.",
      onRetry: () => loadHomepageCatalog(featuredRail),
      tone: "dark",
      preserveLayout: true,
    });
  }
}

function setupProductRail(rail) {
  const section = rail.closest("section");
  const previous = section?.querySelector("[data-rail-prev]");
  const next = section?.querySelector("[data-rail-next]");
  const progress = section?.querySelector("[data-rail-progress]");

  const update = () => {
    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const position = maxScroll ? rail.scrollLeft / maxScroll : 0;
    const visibleRatio = Math.min(1, rail.clientWidth / Math.max(rail.scrollWidth, 1));
    const thumbWidth = Math.max(0.16, visibleRatio);
    const travel = 1 - thumbWidth;

    if (progress) {
      progress.style.width = `${thumbWidth * 100}%`;
      progress.style.transform = `translateX(${position * travel * 100 / thumbWidth}%)`;
    }
    if (previous) previous.disabled = rail.scrollLeft <= 2;
    if (next) next.disabled = rail.scrollLeft >= maxScroll - 2;
  };

  const move = (direction) => {
    const card = rail.querySelector(":scope > *");
    const gap = Number.parseFloat(getComputedStyle(rail).gap) || 0;
    const distance = card ? card.getBoundingClientRect().width + gap : rail.clientWidth * 0.8;
    rail.scrollBy({ left: distance * direction, behavior: "smooth" });
  };

  previous?.addEventListener("click", () => move(-1));
  next?.addEventListener("click", () => move(1));
  rail.addEventListener("scroll", update, { passive: true });
  rail.addEventListener("rail:updated", update);
  window.addEventListener("resize", update, { passive: true });
  requestAnimationFrame(update);
}
