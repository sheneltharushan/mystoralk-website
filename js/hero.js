const clamp = (value, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);

export function initHero() {
  const hero = document.getElementById("hero-section");
  const wordmark = document.getElementById("hero-wordmark");
  const video = document.getElementById("hero-video");
  if (!hero || !wordmark) return;

  document.body.classList.add("has-home-hero");
  video?.play().catch(() => {
    // The poster remains as a complete visual fallback if autoplay is blocked.
  });

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let cleanupTransition = null;

  const connectWordmarkTransition = () => {
    const navBrand = document.getElementById("nav-brand");
    if (!navBrand) return;
    cleanupTransition?.();
    cleanupTransition = createWordmarkTransition({
      hero,
      wordmark,
      navBrand,
      reducedMotion,
    });
  };

  if (document.getElementById("nav-brand")) {
    connectWordmarkTransition();
  } else {
    window.addEventListener("mystora:navbar-ready", connectWordmarkTransition, {
      once: true,
    });
  }

  if (reducedMotion.matches && video) {
    video.pause();
  }
}

function createWordmarkTransition({ hero, wordmark, navBrand, reducedMotion }) {
  const supportingElements = [
    document.getElementById("hero-tagline"),
    document.querySelector(".mystora-hero__scroll"),
  ].filter(Boolean);

  let metrics = null;
  let frameRequested = false;

  const measure = () => {
    const previousTransform = wordmark.style.transform;
    const previousOpacity = wordmark.style.opacity;
    wordmark.style.transform = "none";
    wordmark.style.opacity = "1";

    const start = wordmark.getBoundingClientRect();
    const target = navBrand.getBoundingClientRect();
    metrics = {
      startCenterX: start.left + start.width / 2,
      startPageCenterY: start.top + window.scrollY + start.height / 2,
      targetCenterX: target.left + target.width / 2,
      targetCenterY: target.top + target.height / 2,
      targetScale: target.width / Math.max(start.width, 1),
      transitionStart: Math.min(110, hero.offsetHeight * 0.12),
      transferDistance: Math.max(320, hero.offsetHeight * 0.78),
    };

    wordmark.style.transform = previousTransform;
    wordmark.style.opacity = previousOpacity;
  };

  const render = () => {
    frameRequested = false;
    if (!metrics) measure();

    const progress = clamp(
      (window.scrollY - metrics.transitionStart) /
        (metrics.transferDistance - metrics.transitionStart),
    );
    const eased = reducedMotion.matches ? progress : easeOutCubic(progress);
    const naturalCenterY = metrics.startPageCenterY - window.scrollY;
    const translateX = (metrics.targetCenterX - metrics.startCenterX) * eased;
    const translateY = (metrics.targetCenterY - naturalCenterY) * eased;
    const scale = 1 + (metrics.targetScale - 1) * eased;
    const handoff = clamp((progress - 0.78) / 0.18);
    const supportingOpacity = 1 - clamp(progress / 0.42);

    wordmark.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    wordmark.style.opacity = String(1 - handoff);
    wordmark.style.visibility = progress >= 0.98 ? "hidden" : "visible";

    navBrand.classList.toggle("is-visible", handoff > 0.02);
    navBrand.style.opacity = String(handoff);
    navBrand.setAttribute("aria-hidden", String(handoff <= 0.02));

    supportingElements.forEach((element) => {
      element.style.opacity = String(supportingOpacity);
      element.style.transform = `translate3d(0, ${-18 * progress}px, 0)`;
      element.style.pointerEvents = supportingOpacity < 0.15 ? "none" : "";
    });
  };

  const requestRender = () => {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(render);
  };

  const handleResize = () => {
    metrics = null;
    requestRender();
  };

  measure();
  render();
  window.addEventListener("scroll", requestRender, { passive: true });
  window.addEventListener("resize", handleResize);

  return () => {
    window.removeEventListener("scroll", requestRender);
    window.removeEventListener("resize", handleResize);
  };
}
