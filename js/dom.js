export function createElement(tagName, options = {}, children = []) {
  const element = document.createElement(tagName);
  const { className, text, attributes = {}, dataset = {} } = options;

  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);

  Object.entries(attributes).forEach(([name, value]) => {
    if (value !== undefined && value !== null) {
      element.setAttribute(name, String(value));
    }
  });

  Object.entries(dataset).forEach(([name, value]) => {
    element.dataset[name] = String(value);
  });

  const childList = Array.isArray(children) ? children : [children];
  childList.filter(Boolean).forEach((child) => element.append(child));
  return element;
}

export function clearElement(element) {
  element.replaceChildren();
}

export function createImage(src, alt, className) {
  return createElement("img", {
    className,
    attributes: {
      src: sanitizeImageSource(src),
      alt: alt || "",
      loading: "lazy",
      decoding: "async",
    },
  });
}

function sanitizeImageSource(value) {
  const fallback = "/assets/img/logo.png";
  if (!value) return fallback;

  try {
    const url = new URL(String(value), window.location.origin);
    const isSameOrigin = url.origin === window.location.origin;
    const isMystoraStorage =
      url.protocol === "https:" &&
      url.hostname === "nphpncgggkwckfhyzlwt.supabase.co";
    return isSameOrigin || isMystoraStorage ? url.href : fallback;
  } catch {
    return fallback;
  }
}

export function renderSkeletons(container, count = 4) {
  clearElement(container);

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < count; index += 1) {
    const skeleton = createElement("div", {
      className: "animate-pulse",
      attributes: { "aria-hidden": "true" },
    });
    skeleton.append(
      createElement("div", {
        className: "aspect-[3/4] bg-neutral-800/70 mb-5",
      }),
      createElement("div", {
        className: "h-5 w-2/3 bg-neutral-800/70 mb-3",
      }),
      createElement("div", {
        className: "h-3 w-1/3 bg-neutral-800/70",
      }),
    );
    fragment.append(skeleton);
  }
  container.append(fragment);
}

export function renderStatus(
  container,
  { message, onRetry, tone = "dark", preserveLayout = false },
) {
  clearElement(container);

  const wrapper = createElement("div", {
    className: [
      preserveLayout ? "col-span-full" : "",
      "border p-8 text-center",
      tone === "light"
        ? "border-neutral-300 bg-neutral-100 text-neutral-700"
        : "border-neutral-800 bg-neutral-900/40 text-gray-400",
    ]
      .filter(Boolean)
      .join(" "),
    attributes: { role: "status" },
  });

  wrapper.append(
    createElement("p", {
      className: "text-sm leading-relaxed",
      text: message,
    }),
  );

  if (onRetry) {
    const button = createElement("button", {
      className:
        "mt-5 border border-current px-5 py-3 text-[10px] uppercase tracking-[0.25em] hover:opacity-60 transition-opacity",
      text: "Try again",
      attributes: { type: "button" },
    });
    button.addEventListener("click", onRetry);
    wrapper.append(button);
  }

  container.append(wrapper);
}

export function formatLkr(value) {
  const amount = Number(value ?? 0);
  return `LKR ${Number.isFinite(amount) ? amount.toLocaleString("en-LK") : "0"}`;
}
