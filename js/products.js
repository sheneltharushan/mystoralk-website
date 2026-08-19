import { createElement, createImage, formatLkr } from "./dom.js";

export function getProductLink(product, { size = "" } = {}) {
  const params = new URLSearchParams();
  if (product?.slug) {
    params.set("slug", product.slug);
  } else {
    params.set("id", product?.id || "");
  }
  if (size) params.set("size", size);
  return `/product/?${params.toString()}`;
}

export function getCardPrice(product) {
  return Number(product?.price_50ml ?? product?.price ?? 0);
}

export function createProductCard(product, { light = false, displaySize = "" } = {}) {
  const link = getProductLink(product, { size: displaySize });
  const sizePrices = {
    "10ml": Number(product?.price_10ml || 0),
    "50ml": Number(product?.price_50ml || 0),
    "100ml": Number(product?.price_100ml || 0),
  };
  const displayPrice = sizePrices[displaySize] || getCardPrice(product);
  const priceLabel = displaySize
    ? `${formatLkr(displayPrice)} · ${displaySize.toUpperCase()}`
    : formatLkr(displayPrice);
  const card = createElement("article", { className: "group" });
  const imageLink = createElement("a", {
    className:
      "relative block w-full aspect-[3/4] overflow-hidden mb-5 " +
      (light ? "bg-gray-100" : "bg-neutral-900 border border-neutral-800"),
    attributes: { href: link, "aria-label": `View ${product?.name || "product"}` },
  });

  const primaryImage = createImage(
    product?.image_url,
    product?.name || "Mystora fragrance",
    "absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-100 group-hover:opacity-0",
  );
  const hoverImage = createImage(
    product?.hover_image_url || product?.image_url,
    "",
    "absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-0 group-hover:opacity-100",
  );
  hoverImage.setAttribute("aria-hidden", "true");

  const action = createElement("span", {
    className:
      "absolute bottom-0 left-0 w-full text-center py-3 translate-y-full transition-transform duration-500 group-hover:translate-y-0 " +
      (light ? "bg-black text-white" : "bg-white text-black"),
  });
  action.append(
    createElement("span", {
      className: "text-[10px] font-bold uppercase tracking-widest",
      text: "View Product",
    }),
  );
  imageLink.append(primaryImage, hoverImage, action);

  const details = createElement("div", {
    className: light ? "text-mystora-black text-center" : "text-white",
  });
  const titleLink = createElement("a", {
    className: "hover:opacity-60 transition-opacity",
    attributes: { href: link },
  });
  titleLink.append(
    createElement("h3", {
      className: light
        ? "font-brand text-2xl tracking-wide mb-2"
        : "font-brand text-lg md:text-xl tracking-wide mb-1",
      text: product?.name || "Unnamed fragrance",
    }),
  );
  details.append(
    titleLink,
    createElement("p", {
      className: light
        ? "text-xs text-gray-500 uppercase tracking-widest mb-4"
        : "text-[10px] md:text-xs text-gray-400 uppercase tracking-widest mb-3",
      text: priceLabel,
    }),
  );

  const orderLink = createElement("a", {
    className:
      "inline-block text-[10px] uppercase tracking-[0.2em] border-b pb-1 transition-opacity hover:opacity-50 " +
      (light ? "border-black" : "border-white"),
    text: "Order Now",
    attributes: { href: link },
  });
  details.append(orderLink);
  card.append(imageLink, details);
  return card;
}

export function createHomeProductCard(product) {
  const card = createProductCard(product);
  card.className = `${card.className} home-product-card`;
  return card;
}
