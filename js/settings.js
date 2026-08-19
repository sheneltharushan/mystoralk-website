import { getSupabaseClient } from "./supabase.js";

let settingsPromise;

export function loadPublicSettings() {
  if (!settingsPromise) settingsPromise = fetchPublicSettings();
  return settingsPromise;
}

async function fetchPublicSettings() {
  try {
    const { data, error } = await getSupabaseClient()
      .from("site_settings")
      .select("key,value")
      .eq("public", true);
    if (error) throw error;
    return new Map((data || []).map((item) => [item.key, item.value]));
  } catch {
    return new Map();
  }
}

export async function initPublicSettings(root = document) {
  const settings = await loadPublicSettings();
  applyPublicSettings(settings, root);
  window.addEventListener("mystora:navbar-ready", () => applyPublicSettings(settings, document));
  return settings;
}

function applyPublicSettings(settings, root) {
  root.querySelectorAll("[data-setting-href]").forEach((link) => {
    const key = link.dataset.settingHref;
    const value = key === "whatsapp_url"
      ? buildWhatsAppUrl(settings.get("whatsapp_phone"))
      : safeExternalUrl(settings.get(key));
    if (value) link.href = value;
  });

  root.querySelectorAll("[data-setting-text]").forEach((element) => {
    const value = settings.get(element.dataset.settingText);
    if (typeof value === "string" && value.trim()) element.textContent = value.trim();
  });
}

function buildWhatsAppUrl(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 20) return "";
  const message = encodeURIComponent("Hi Mystora, I need some help choosing a fragrance.");
  return `https://wa.me/${digits}?text=${message}`;
}

function safeExternalUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}
