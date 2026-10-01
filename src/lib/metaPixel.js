const META_PIXEL_ID = "1109585375341291";
const META_CONSENT_KEY = "clic-med-marketing-consent";

export function getMetaConsent() {
  return window.localStorage.getItem(META_CONSENT_KEY);
}

export function initializeMetaPixel() {
  if (getMetaConsent() !== "granted") return;

  if (!window.fbq) {
    const fbq = function (...args) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);

    fbq("init", META_PIXEL_ID);
    fbq("track", "PageView");
    if (window.location.pathname.replace(/\/+$/, "") === "/conheca") {
      fbq("track", "ViewContent", { content_name: "Landing Page Clic Med" });
    }
  }
}

export function setMetaConsent(value) {
  window.localStorage.setItem(META_CONSENT_KEY, value);
  if (value === "granted") initializeMetaPixel();
}

export function trackMetaEvent(name, parameters = {}) {
  initializeMetaPixel();
  if (window.fbq && getMetaConsent() === "granted") {
    window.fbq("track", name, parameters);
  }
}

