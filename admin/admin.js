import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "/js/config.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  client: null,
  session: null,
  profile: null,
  activeView: "dashboard",
  products: [],
  collections: [],
  memberships: [],
  orders: [],
  settings: [],
  activity: [],
  media: [],
  confirmResolver: null,
  recoveryMode: new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery",
};

const VIEW_META = {
  dashboard: ["Overview", "Dashboard"],
  products: ["Catalogue", "Products"],
  collections: ["Storefront curation", "Collections"],
  orders: ["WhatsApp enquiries", "Orders"],
  media: ["Product imagery", "Media library"],
  settings: ["Configuration", "Settings"],
  activity: ["Immutable history", "Activity"],
};

const ORDER_STATUSES = ["new", "contacted", "confirmed", "preparing", "dispatched", "completed", "cancelled"];
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function createElement(tag, options = {}, children = []) {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = String(options.text);
  Object.entries(options.attributes || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) element.setAttribute(key, String(value));
  });
  Object.entries(options.dataset || {}).forEach(([key, value]) => {
    element.dataset[key] = String(value);
  });
  (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => element.append(child));
  return element;
}

function clear(element) {
  element?.replaceChildren();
}

function setFormStatus(element, message = "", tone = "") {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-error", tone === "error");
  element.classList.toggle("is-success", tone === "success");
}

let globalStatusTimer;
function notify(message, tone = "success") {
  const status = $("#global-status");
  status.textContent = message;
  status.hidden = false;
  status.classList.toggle("is-error", tone === "error");
  clearTimeout(globalStatusTimer);
  globalStatusTimer = setTimeout(() => { status.hidden = true; }, 4500);
}

function humanize(value = "") {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function formatLkr(value) {
  const amount = Number(value || 0);
  return `LKR ${amount.toLocaleString("en-LK")}`;
}

function formatDate(value, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-LK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function safeImageUrl(value) {
  if (!value) return "/assets/img/logo.png";
  try {
    const url = new URL(value, window.location.origin);
    const allowed = url.origin === window.location.origin ||
      (url.protocol === "https:" && url.hostname === "nphpncgggkwckfhyzlwt.supabase.co");
    return allowed ? url.href : "/assets/img/logo.png";
  } catch {
    return "/assets/img/logo.png";
  }
}

function errorMessage(error, fallback = "Something went wrong. Please try again.") {
  const code = String(error?.code || "");
  if (code === "23505") return "That slug is already in use.";
  if (code === "23514") return "One or more values are not valid.";
  if (code === "42501") return "Your staff role does not allow this action.";
  if (code === "PGRST116") return "This record is no longer available.";
  return fallback;
}

function isManager() {
  return ["owner", "manager"].includes(state.profile?.role);
}

function setBusy(form, busy) {
  $$('button[type="submit"]', form).forEach((button) => {
    button.disabled = busy;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = "Saving…";
    } else if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  });
}

async function waitForSupabase() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (window.supabase?.createClient) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error("Admin authentication could not be loaded.");
}

async function initialize() {
  bindStaticEvents();
  try {
    await waitForSupabase();
    state.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "mystora-admin-session",
      },
    });
    if (state.recoveryMode) showPasswordRecoveryForm();

    state.client.auth.onAuthStateChange((event, session) => {
      state.session = session;
      if (event === "PASSWORD_RECOVERY") {
        state.recoveryMode = true;
        showPasswordRecoveryForm();
      }
    });

    const { data, error } = await state.client.auth.getSession();
    if (error) throw error;
    if (data.session) {
      if (state.recoveryMode) showPasswordRecoveryForm();
      else await enterAdmin(data.session);
    } else if (state.recoveryMode) {
      setFormStatus($("#auth-status"), "This recovery link is invalid or has expired. Request a new email and try again.", "error");
    }
  } catch {
    setFormStatus($("#auth-status"), "The admin service is unavailable. Please refresh and try again.", "error");
  }
}

function bindStaticEvents() {
  $("#login-form").addEventListener("submit", handleLogin);
  $("#reset-password-button").addEventListener("click", handlePasswordResetRequest);
  $("#sign-out-button").addEventListener("click", handleSignOut);
  $("#sidebar-toggle").addEventListener("click", toggleSidebar);
  $("#global-add-button").addEventListener("click", () => openProductDialog());
  $("#product-form").addEventListener("submit", saveProduct);
  $("#collection-form").addEventListener("submit", saveCollection);
  $("#order-form").addEventListener("submit", saveOrder);
  $("#settings-form").addEventListener("submit", saveSettings);
  $("#media-upload").addEventListener("change", uploadMedia);
  $("#product-search").addEventListener("input", renderProducts);
  $("#product-category-filter").addEventListener("change", renderProducts);
  $("#product-status-filter").addEventListener("change", renderProducts);
  $("#order-search").addEventListener("input", renderOrders);
  $("#order-status-filter").addEventListener("change", renderOrders);
  $("#confirm-cancel").addEventListener("click", () => resolveConfirmation(false));
  $("#confirm-accept").addEventListener("click", () => resolveConfirmation(true));

  $("#product-form [name='name']").addEventListener("input", (event) => {
    const form = event.currentTarget.form;
    if (!form.elements.id.value && !form.elements.slug.dataset.edited) {
      form.elements.slug.value = slugify(event.currentTarget.value);
    }
  });
  $("#product-form [name='slug']").addEventListener("input", (event) => {
    event.currentTarget.dataset.edited = event.currentTarget.value ? "true" : "";
  });
  $("#collection-form [name='name']").addEventListener("input", (event) => {
    const form = event.currentTarget.form;
    if (!form.elements.id.value && !form.elements.slug.dataset.edited) {
      form.elements.slug.value = slugify(event.currentTarget.value);
    }
  });
  $("#collection-form [name='slug']").addEventListener("input", (event) => {
    event.currentTarget.dataset.edited = event.currentTarget.value ? "true" : "";
  });
  $("#order-product").addEventListener("change", syncOrderProduct);

  document.addEventListener("click", handleDelegatedClick);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#confirm-overlay").hidden) resolveConfirmation(false);
  });
  $$('[data-close-dialog]').forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));
  $$('dialog').forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  }));
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  setBusy(form, true);
  setFormStatus($("#auth-status"), "Checking your credentials…");
  try {
    const { data, error } = await state.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await enterAdmin(data.session);
  } catch {
    setFormStatus($("#auth-status"), "The email, password, or staff access is not valid.", "error");
  } finally {
    setBusy(form, false);
  }
}

async function enterAdmin(session) {
  state.session = session;
  const { data: profile, error } = await state.client
    .from("admin_users")
    .select("user_id, display_name, role, active")
    .eq("user_id", session.user.id)
    .eq("active", true)
    .maybeSingle();

  if (error || !profile) {
    await state.client.auth.signOut({ scope: "local" });
    state.session = null;
    setFormStatus($("#auth-status"), "This account has not been granted Mystora staff access.", "error");
    return;
  }

  state.profile = profile;
  $("#auth-screen").hidden = true;
  $("#admin-app").hidden = false;
  const displayName = profile.display_name || session.user.email || "Mystora staff";
  $("#staff-name").textContent = displayName;
  $("#staff-role").textContent = humanize(profile.role);
  $("#staff-initial").textContent = displayName.charAt(0).toUpperCase();
  await loadAllData();
}

async function handleSignOut() {
  await state.client?.auth.signOut({ scope: "local" });
  state.session = null;
  state.profile = null;
  $("#admin-app").hidden = true;
  $("#auth-screen").hidden = false;
  $("#login-form").reset();
  setFormStatus($("#auth-status"), "Signed out securely.", "success");
}

async function handlePasswordResetRequest() {
  const email = $("#login-email").value.trim();
  if (!email || !$("#login-email").checkValidity()) {
    setFormStatus($("#auth-status"), "Enter your staff email address first.", "error");
    $("#login-email").focus();
    return;
  }
  const { error } = await state.client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/admin/`,
  });
  setFormStatus(
    $("#auth-status"),
    error ? "The reset email could not be sent." : "If this is a staff account, a reset link has been sent.",
    error ? "error" : "success",
  );
}

function showPasswordRecoveryForm() {
  const form = $("#login-form");
  if (form.dataset.mode === "recovery") return;
  form.dataset.mode = "recovery";
  clear(form);
  $("#auth-title").textContent = "Choose a new password.";
  $(".auth-intro").textContent = "Create a secure password for your Mystora staff account.";
  $("#reset-password-button").hidden = true;
  const password = createElement("input", {
    attributes: { type: "password", name: "new_password", autocomplete: "new-password", minlength: "12", maxlength: "128", required: "" },
  });
  form.append(
    createElement("label", {}, [createElement("span", { text: "New password" }), password]),
    createElement("button", { className: "button button--primary", text: "Set new password", attributes: { type: "submit" } }),
  );
  form.removeEventListener("submit", handleLogin);
  form.addEventListener("submit", handlePasswordUpdate);
  password.focus();
}

async function handlePasswordUpdate(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  setBusy(form, true);
  const password = form.elements.new_password.value;
  const { error } = await state.client.auth.updateUser({ password });
  setBusy(form, false);
  if (error) {
    setFormStatus($("#auth-status"), "The password could not be updated. Request a new recovery email and try again.", "error");
    return;
  }

  state.recoveryMode = false;
  setFormStatus($("#auth-status"), "Password updated. Opening your workspace…", "success");
  window.location.replace(`${window.location.pathname}${window.location.search}`);
}

async function loadAllData() {
  notify("Refreshing the atelier…");
  const results = await Promise.allSettled([
    loadProducts(), loadCollections(), loadOrders(), loadSettings(), loadActivity(), loadMedia(),
  ]);
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) notify("Some admin data could not be loaded.", "error");
  renderAll();
}

async function loadProducts() {
  const { data, error } = await state.client.from("products").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  state.products = data || [];
}

async function loadCollections() {
  const [collections, memberships] = await Promise.all([
    state.client.from("collections").select("*").order("sort_order", { ascending: true }),
    state.client.from("collection_products").select("collection_id,product_id,position").order("position", { ascending: true }),
  ]);
  if (collections.error) throw collections.error;
  if (memberships.error) throw memberships.error;
  state.collections = collections.data || [];
  state.memberships = memberships.data || [];
}

async function loadOrders() {
  const { data, error } = await state.client.from("orders").select("*").order("updated_at", { ascending: false }).limit(500);
  if (error) throw error;
  state.orders = data || [];
}

async function loadSettings() {
  const { data, error } = await state.client.from("site_settings").select("key,value,public,description,updated_at");
  if (error) throw error;
  state.settings = data || [];
}

async function loadActivity() {
  const { data, error } = await state.client
    .from("audit_logs")
    .select("id,actor_id,action,entity_type,entity_id,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  state.activity = data || [];
}

async function loadMedia() {
  const { data, error } = await state.client.storage.from("images").list("products", {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw error;
  state.media = (data || []).filter((item) => item.name && item.id);
}

function renderAll() {
  renderDashboard();
  renderProducts();
  renderCollections();
  renderOrders();
  renderMedia();
  renderSettings();
  renderActivity();
  fillOrderProducts();
}

function renderDashboard() {
  const activeProducts = state.products.filter((product) => product.active).length;
  const draftProducts = state.products.length - activeProducts;
  const openOrders = state.orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length;
  const internalLowStock = state.products.filter((product) => Number(product.stock || 0) <= 2).length;
  const metrics = [
    ["Published products", activeProducts, `${draftProducts} draft${draftProducts === 1 ? "" : "s"}`],
    ["Open enquiries", openOrders, `${state.orders.length} recorded total`],
    ["Collections", state.collections.filter((item) => item.active).length, `${state.memberships.length} placements`],
    ["Internal low stock", internalLowStock, "Not displayed publicly"],
  ];
  const metricGrid = $("#dashboard-metrics");
  clear(metricGrid);
  metrics.forEach(([label, value, note]) => {
    metricGrid.append(createElement("article", { className: "metric-card" }, [
      createElement("span", { text: label }),
      createElement("strong", { text: value }),
      createElement("small", { text: note }),
    ]));
  });

  renderDataRows($("#dashboard-orders"), state.orders.slice(0, 5).map((order) => ({
    title: order.customer_name || "Unnamed customer",
    subtitle: order.items || order.phone || "Manual enquiry",
    value: humanize(order.status || "new"),
  })), "No enquiries have been recorded.");

  renderDataRows($("#dashboard-collections"), state.collections.slice(0, 5).map((collection) => ({
    title: collection.name,
    subtitle: collection.active ? "Visible" : "Hidden",
    value: `${state.memberships.filter((item) => item.collection_id === collection.id).length} products`,
  })), "No collections available.");

  renderDataRows($("#dashboard-activity"), state.activity.slice(0, 6).map((item) => ({
    title: `${humanize(item.action)} ${humanize(item.entity_type)}`,
    subtitle: item.entity_id ? `Record ${item.entity_id}` : "Administrative change",
    value: formatDate(item.created_at, true),
  })), "No administrative changes recorded yet.");
}

function renderDataRows(container, items, emptyMessage) {
  clear(container);
  if (!items.length) {
    container.append(createElement("p", { className: "empty-state", text: emptyMessage }));
    return;
  }
  items.forEach((item) => container.append(createElement("div", { className: "data-row" }, [
    createElement("div", {}, [createElement("strong", { text: item.title }), createElement("small", { text: item.subtitle })]),
    createElement("span", { className: "data-row__value", text: item.value }),
  ])));
}

function renderProducts() {
  const query = $("#product-search").value.trim().toLowerCase();
  const category = $("#product-category-filter").value;
  const status = $("#product-status-filter").value;
  const categories = [...new Set(state.products.map((product) => product.category).filter(Boolean))].sort();
  const categorySelect = $("#product-category-filter");
  const previous = categorySelect.value;
  clear(categorySelect);
  categorySelect.append(createElement("option", { text: "All categories", attributes: { value: "" } }));
  categories.forEach((value) => categorySelect.append(createElement("option", { text: humanize(value), attributes: { value } })));
  categorySelect.value = previous;

  const filtered = state.products.filter((product) => {
    const haystack = `${product.name || ""} ${product.slug || ""}`.toLowerCase();
    const statusMatch = !status ||
      (status === "active" && product.active) ||
      (status === "draft" && !product.active) ||
      (status === "featured" && product.is_featured);
    return (!query || haystack.includes(query)) && (!category || product.category === category) && statusMatch;
  });

  const body = $("#products-table-body");
  clear(body);
  filtered.forEach((product) => {
    const availableSizes = ["10ml", "50ml", "100ml"].filter((size) => product[`price_${size}`] !== null && product[`price_${size}`] !== undefined);
    const image = createElement("img", { attributes: { src: safeImageUrl(product.image_url), alt: "", loading: "lazy" } });
    const statusPill = createElement("span", {
      className: `status-pill ${product.active ? "status-pill--active" : ""}`,
      text: product.active ? "Published" : "Draft",
    });
    const actions = createElement("div", { className: "row-actions" }, [
      actionButton("Edit", "edit-product", product.id, "✎"),
      ...(isManager() ? [actionButton("Delete", "delete-product", product.id, "×")] : []),
    ]);
    body.append(createElement("tr", {}, [
      createElement("td", {}, [createElement("div", { className: "product-cell" }, [image, createElement("div", {}, [createElement("strong", { text: product.name }), createElement("small", { text: product.slug })])])]),
      createElement("td", { text: humanize(product.category || "Uncategorised") }),
      createElement("td", { text: availableSizes.length ? availableSizes.join(" · ") : "—" }),
      createElement("td", { text: Number(product.stock || 0) }),
      createElement("td", {}, [statusPill, ...(product.is_featured ? [createElement("span", { className: "status-pill status-pill--featured", text: "Featured" })] : [])]),
      createElement("td", {}, [actions]),
    ]));
  });
  $("#products-empty").hidden = filtered.length > 0;
}

function actionButton(label, action, id, text) {
  return createElement("button", {
    className: "row-action",
    text,
    attributes: { type: "button", title: label, "aria-label": label },
    dataset: { action, id },
  });
}

function openProductDialog(product = null) {
  const form = $("#product-form");
  form.reset();
  form.elements.id.value = product?.id || "";
  form.elements.name.value = product?.name || "";
  form.elements.slug.value = product?.slug || "";
  form.elements.slug.dataset.edited = product?.slug ? "true" : "";
  form.elements.category.value = product?.category || "clone";
  form.elements.description.value = product?.description || "";
  ["price_10ml", "price_50ml", "price_100ml", "image_url", "hover_image_url", "image_10ml", "image_50ml", "image_100ml", "promo_image"].forEach((key) => {
    form.elements[key].value = product?.[key] ?? "";
  });
  form.elements.stock.value = product?.stock ?? 0;
  form.elements.active.checked = product ? Boolean(product.active) : true;
  form.elements.is_featured.checked = Boolean(product?.is_featured);
  $("#product-dialog-title").textContent = product ? "Edit product" : "Add product";
  setFormStatus($("#product-form-status"));
  $("#product-dialog").showModal();
  form.elements.name.focus();
}

async function saveProduct(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const id = numberOrNull(form.elements.id.value);
  const price50 = numberOrNull(form.elements.price_50ml.value);
  const payload = {
    name: form.elements.name.value.trim(),
    slug: slugify(form.elements.slug.value),
    category: form.elements.category.value.trim().toLowerCase(),
    description: form.elements.description.value.trim() || null,
    price_10ml: numberOrNull(form.elements.price_10ml.value),
    price_50ml: price50,
    price_100ml: numberOrNull(form.elements.price_100ml.value),
    price: price50,
    image_url: form.elements.image_url.value.trim() || null,
    hover_image_url: form.elements.hover_image_url.value.trim() || null,
    image_10ml: form.elements.image_10ml.value.trim() || null,
    image_50ml: form.elements.image_50ml.value.trim() || null,
    image_100ml: form.elements.image_100ml.value.trim() || null,
    promo_image: form.elements.promo_image.value.trim() || null,
    stock: numberOrNull(form.elements.stock.value) ?? 0,
    active: form.elements.active.checked,
    is_featured: form.elements.is_featured.checked,
    updated_by: state.session.user.id,
  };
  if (!payload.slug || !payload.name || !payload.category) {
    setFormStatus($("#product-form-status"), "Name, slug, and category are required.", "error");
    return;
  }
  setBusy(form, true);
  const request = id
    ? state.client.from("products").update(payload).eq("id", id).select().single()
    : state.client.from("products").insert(payload).select().single();
  const { data, error } = await request;
  setBusy(form, false);
  if (error) {
    setFormStatus($("#product-form-status"), errorMessage(error, "The product could not be saved."), "error");
    return;
  }
  if (id) state.products = state.products.map((product) => product.id === id ? data : product);
  else state.products.unshift(data);
  $("#product-dialog").close();
  renderAll();
  notify(id ? "Product updated." : "Product added.");
  loadActivity().then(() => { renderActivity(); renderDashboard(); }).catch(() => {});
}

async function deleteProduct(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product || !isManager()) return;
  const confirmed = await confirmAction("Delete this product?", `${product.name} will be permanently removed from the catalogue and every collection.`);
  if (!confirmed) return;
  const { error } = await state.client.from("products").delete().eq("id", id);
  if (error) return notify(errorMessage(error, "The product could not be deleted."), "error");
  state.products = state.products.filter((item) => item.id !== id);
  state.memberships = state.memberships.filter((item) => item.product_id !== id);
  renderAll();
  notify("Product removed.");
}

function renderCollections() {
  const grid = $("#collections-grid");
  clear(grid);
  state.collections.forEach((collection, index) => {
    const count = state.memberships.filter((item) => item.collection_id === collection.id).length;
    grid.append(createElement("article", { className: "collection-card" }, [
      createElement("span", { className: "collection-card__index", text: String(index + 1).padStart(2, "0") }),
      createElement("h3", { text: collection.name }),
      createElement("p", { text: collection.description || "A curated Mystora collection." }),
      createElement("div", { className: "collection-card__footer" }, [
        createElement("span", { text: `${count} products · ${collection.active ? "Visible" : "Hidden"}` }),
        actionButton("Edit collection", "edit-collection", collection.id, "✎"),
      ]),
    ]));
  });
  if (!state.collections.length) grid.append(createElement("p", { className: "empty-state", text: "Create the first storefront collection." }));
}

function openCollectionDialog(collection = null) {
  const form = $("#collection-form");
  form.reset();
  form.elements.id.value = collection?.id || "";
  form.elements.name.value = collection?.name || "";
  form.elements.slug.value = collection?.slug || "";
  form.elements.slug.dataset.edited = collection?.slug ? "true" : "";
  form.elements.description.value = collection?.description || "";
  form.elements.sort_order.value = collection?.sort_order ?? state.collections.length * 10 + 10;
  form.elements.active.checked = collection ? Boolean(collection.active) : true;
  $("#collection-dialog-title").textContent = collection ? "Edit collection" : "New collection";
  const selected = new Map(
    state.memberships
      .filter((item) => item.collection_id === collection?.id)
      .map((item) => [item.product_id, item.position]),
  );
  const picker = $("#collection-product-picker");
  clear(picker);
  state.products.forEach((product) => {
    const checkbox = createElement("input", { attributes: { type: "checkbox", value: product.id, name: "collection_product" } });
    checkbox.checked = selected.has(product.id);
    const position = createElement("input", { attributes: { type: "number", min: "0", step: "1", value: selected.get(product.id) ?? 0, "aria-label": `Position for ${product.name}` } });
    picker.append(createElement("label", { className: "picker-row" }, [checkbox, createElement("span", { text: product.name }), position]));
  });
  setFormStatus($("#collection-form-status"));
  $("#collection-dialog").showModal();
  form.elements.name.focus();
}

async function saveCollection(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  setBusy(form, true);
  const id = numberOrNull(form.elements.id.value);
  const payload = {
    name: form.elements.name.value.trim(),
    slug: slugify(form.elements.slug.value),
    description: form.elements.description.value.trim(),
    sort_order: numberOrNull(form.elements.sort_order.value) ?? 0,
    active: form.elements.active.checked,
    updated_by: state.session.user.id,
  };
  const request = id
    ? state.client.from("collections").update(payload).eq("id", id).select().single()
    : state.client.from("collections").insert(payload).select().single();
  const { data: saved, error } = await request;
  if (error) {
    setBusy(form, false);
    setFormStatus($("#collection-form-status"), errorMessage(error, "The collection could not be saved."), "error");
    return;
  }

  const selectedRows = $$(".picker-row", $("#collection-product-picker"))
    .filter((row) => $('input[type="checkbox"]', row).checked)
    .map((row, index) => ({
      collection_id: saved.id,
      product_id: Number($('input[type="checkbox"]', row).value),
      position: numberOrNull($('input[type="number"]', row).value) ?? index,
    }));

  const removal = await state.client.from("collection_products").delete().eq("collection_id", saved.id);
  if (removal.error) {
    setBusy(form, false);
    setFormStatus($("#collection-form-status"), "The collection was saved, but its products could not be updated.", "error");
    return;
  }
  if (selectedRows.length) {
    const insertion = await state.client.from("collection_products").insert(selectedRows);
    if (insertion.error) {
      setBusy(form, false);
      setFormStatus($("#collection-form-status"), "The collection was saved, but its products could not be added.", "error");
      return;
    }
  }
  setBusy(form, false);
  await loadCollections();
  $("#collection-dialog").close();
  renderCollections();
  renderDashboard();
  notify("Collection saved.");
  loadActivity().then(() => renderActivity()).catch(() => {});
}

function renderOrders() {
  const query = $("#order-search").value.trim().toLowerCase();
  const status = $("#order-status-filter").value;
  const filtered = state.orders.filter((order) => {
    const haystack = `${order.customer_name || ""} ${order.phone || ""} ${order.items || ""}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!status || order.status === status);
  });
  const body = $("#orders-table-body");
  clear(body);
  filtered.forEach((order) => {
    body.append(createElement("tr", {}, [
      createElement("td", { text: `#${String(order.id).padStart(4, "0")}` }),
      createElement("td", {}, [createElement("strong", { text: order.customer_name || "Unnamed" }), createElement("small", { text: order.phone || "No phone" })]),
      createElement("td", { text: order.items || "Custom item" }),
      createElement("td", { text: formatLkr(order.total) }),
      createElement("td", {}, [createElement("span", { className: `status-pill status-pill--${order.status}`, text: humanize(order.status || "new") })]),
      createElement("td", { text: formatDate(order.updated_at || order.created_at, true) }),
      createElement("td", {}, [createElement("div", { className: "row-actions" }, [actionButton("Edit order", "edit-order", order.id, "✎"), ...(isManager() ? [actionButton("Delete order", "delete-order", order.id, "×")] : [])])]),
    ]));
  });
  $("#orders-empty").hidden = filtered.length > 0;
}

function fillOrderProducts() {
  const select = $("#order-product");
  const previous = select.value;
  clear(select);
  select.append(createElement("option", { text: "Custom item", attributes: { value: "" } }));
  state.products.forEach((product) => select.append(createElement("option", { text: product.name, attributes: { value: product.id } })));
  select.value = previous;
}

function openOrderDialog(order = null) {
  const form = $("#order-form");
  form.reset();
  form.elements.id.value = order?.id || "";
  ["customer_name", "phone", "email", "items", "address", "admin_notes"].forEach((key) => { form.elements[key].value = order?.[key] || ""; });
  form.elements.status.value = ORDER_STATUSES.includes(order?.status) ? order.status : "new";
  form.elements.product_id.value = order?.product_id || "";
  form.elements.size.value = order?.size || "";
  form.elements.total.value = order?.total ?? "";
  form.elements.source.value = order?.source || "manual";
  $("#order-dialog-title").textContent = order ? `Order #${String(order.id).padStart(4, "0")}` : "Record order";
  setFormStatus($("#order-form-status"));
  $("#order-dialog").showModal();
  form.elements.customer_name.focus();
}

function syncOrderProduct() {
  const form = $("#order-form");
  const product = state.products.find((item) => item.id === Number(form.elements.product_id.value));
  if (!product) return;
  if (!form.elements.items.value) form.elements.items.value = product.name;
  const size = form.elements.size.value || "50ml";
  const price = product[`price_${size}`] ?? product.price;
  if (!form.elements.total.value && price !== null) form.elements.total.value = price;
}

async function saveOrder(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  setBusy(form, true);
  const id = numberOrNull(form.elements.id.value);
  const payload = {
    customer_name: form.elements.customer_name.value.trim(),
    phone: form.elements.phone.value.trim(),
    email: form.elements.email.value.trim() || null,
    product_id: numberOrNull(form.elements.product_id.value),
    size: form.elements.size.value || null,
    items: form.elements.items.value.trim(),
    total: numberOrNull(form.elements.total.value) ?? 0,
    status: form.elements.status.value,
    source: form.elements.source.value,
    address: form.elements.address.value.trim() || null,
    admin_notes: form.elements.admin_notes.value.trim() || null,
    updated_by: state.session.user.id,
  };
  const request = id
    ? state.client.from("orders").update(payload).eq("id", id).select().single()
    : state.client.from("orders").insert(payload).select().single();
  const { data, error } = await request;
  setBusy(form, false);
  if (error) {
    setFormStatus($("#order-form-status"), errorMessage(error, "The order could not be saved."), "error");
    return;
  }
  if (id) state.orders = state.orders.map((order) => order.id === id ? data : order);
  else state.orders.unshift(data);
  $("#order-dialog").close();
  renderOrders();
  renderDashboard();
  notify(id ? "Order updated." : "Order recorded.");
  loadActivity().then(() => renderActivity()).catch(() => {});
}

async function deleteOrder(id) {
  if (!isManager()) return;
  const order = state.orders.find((item) => item.id === id);
  if (!order) return;
  const confirmed = await confirmAction("Delete this order?", `Order #${String(id).padStart(4, "0")} will be permanently removed. Consider cancelling it instead if you need the history.`);
  if (!confirmed) return;
  const { error } = await state.client.from("orders").delete().eq("id", id);
  if (error) return notify(errorMessage(error, "The order could not be deleted."), "error");
  state.orders = state.orders.filter((item) => item.id !== id);
  renderOrders();
  renderDashboard();
  notify("Order removed.");
}

function renderMedia() {
  const grid = $("#media-grid");
  clear(grid);
  state.media.forEach((item) => {
    const path = `products/${item.name}`;
    const { data } = state.client.storage.from("images").getPublicUrl(path);
    const url = safeImageUrl(data.publicUrl);
    const image = createElement("img", { attributes: { src: url, alt: item.name, loading: "lazy" } });
    grid.append(createElement("article", { className: "media-card" }, [
      image,
      createElement("div", { className: "media-card__body" }, [
        createElement("strong", { text: item.name, attributes: { title: item.name } }),
        createElement("small", { text: item.metadata?.size ? `${(item.metadata.size / 1024 / 1024).toFixed(2)} MB` : "Product image" }),
        createElement("div", { className: "media-card__actions" }, [
          createElement("button", { className: "text-button", text: "Copy URL", attributes: { type: "button" }, dataset: { action: "copy-media", url } }),
          ...(isManager() ? [createElement("button", { className: "text-button", text: "Delete", attributes: { type: "button" }, dataset: { action: "delete-media", path } })] : []),
        ]),
      ]),
    ]));
  });
  $("#media-empty").hidden = state.media.length > 0;
}

async function uploadMedia(event) {
  const input = event.currentTarget;
  const files = [...input.files];
  if (!files.length) return;
  const invalid = files.find((file) => !IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES);
  if (invalid) {
    input.value = "";
    return notify(`${invalid.name} must be JPEG, PNG or WebP and no larger than 8 MB.`, "error");
  }
  input.disabled = true;
  let uploaded = 0;
  for (const file of files) {
    const extension = file.name.split(".").pop().toLowerCase();
    const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "image";
    const path = `products/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${base}.${extension}`;
    const { error } = await state.client.storage.from("images").upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });
    if (error) notify(`${file.name} could not be uploaded.`, "error");
    else uploaded += 1;
  }
  input.disabled = false;
  input.value = "";
  await loadMedia().catch(() => {});
  renderMedia();
  if (uploaded) notify(`${uploaded} image${uploaded === 1 ? "" : "s"} uploaded.`);
}

async function deleteMedia(path) {
  if (!isManager()) return;
  const inUse = state.products.some((product) => ["image_url", "hover_image_url", "image_10ml", "image_50ml", "image_100ml", "promo_image"].some((key) => String(product[key] || "").includes(path)));
  if (inUse) return notify("This image is currently used by a product. Replace the product image first.", "error");
  const confirmed = await confirmAction("Delete this image?", "The media file will be permanently removed from storage.");
  if (!confirmed) return;
  const { error } = await state.client.storage.from("images").remove([path]);
  if (error) return notify("The image could not be deleted.", "error");
  await loadMedia().catch(() => {});
  renderMedia();
  notify("Image removed.");
}

function renderSettings() {
  const form = $("#settings-form");
  state.settings.forEach((setting) => {
    if (form.elements[setting.key]) form.elements[setting.key].value = typeof setting.value === "string" ? setting.value : "";
  });
  const writable = isManager();
  $$('input, textarea, button[type="submit"]', form).forEach((control) => { control.disabled = !writable; });
  if (!writable) setFormStatus($("#settings-status"), "Only owners and managers can change storefront settings.");
}

async function saveSettings(event) {
  event.preventDefault();
  if (!isManager()) return;
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const phone = form.elements.whatsapp_phone.value.trim();
  if (phone && !/^\d{8,20}$/.test(phone)) {
    setFormStatus($("#settings-status"), "Use an international WhatsApp number containing digits only.", "error");
    return;
  }
  const keys = ["whatsapp_phone", "delivery_note", "announcement", "facebook_url", "instagram_url", "tiktok_url"];
  const rows = keys.map((key) => ({
    key,
    value: form.elements[key].value.trim(),
    public: true,
    updated_by: state.session.user.id,
  }));
  setBusy(form, true);
  const { error } = await state.client.from("site_settings").upsert(rows, { onConflict: "key" });
  setBusy(form, false);
  if (error) {
    setFormStatus($("#settings-status"), errorMessage(error, "Settings could not be saved."), "error");
    return;
  }
  await loadSettings().catch(() => {});
  setFormStatus($("#settings-status"), "Settings saved.", "success");
  notify("Storefront settings updated.");
  loadActivity().then(() => renderActivity()).catch(() => {});
}

function renderActivity() {
  const list = $("#activity-list");
  clear(list);
  state.activity.forEach((item) => {
    const action = humanize(item.action);
    list.append(createElement("article", { className: "activity-item" }, [
      createElement("span", { className: "activity-item__mark", text: action.charAt(0) || "·" }),
      createElement("div", {}, [
        createElement("strong", { text: `${action} ${humanize(item.entity_type)}` }),
        createElement("p", { text: item.entity_id ? `Record ${item.entity_id}` : "Administrative change" }),
      ]),
      createElement("time", { text: formatDate(item.created_at, true), attributes: { datetime: item.created_at } }),
    ]));
  });
  if (!state.activity.length) list.append(createElement("p", { className: "empty-state", text: "Administrative changes will appear here." }));
}

function handleDelegatedClick(event) {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) return switchView(viewButton.dataset.view);
  const goButton = event.target.closest("[data-go]");
  if (goButton) return switchView(goButton.dataset.go);
  const refreshButton = event.target.closest("[data-refresh]");
  if (refreshButton) {
    if (refreshButton.dataset.refresh === "activity") {
      loadActivity().then(() => { renderActivity(); notify("Activity refreshed."); }).catch(() => notify("Activity could not be refreshed.", "error"));
    } else loadAllData();
    return;
  }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const id = Number(action.dataset.id);
  if (action.dataset.action === "add-product") openProductDialog();
  if (action.dataset.action === "edit-product") openProductDialog(state.products.find((item) => item.id === id));
  if (action.dataset.action === "delete-product") deleteProduct(id);
  if (action.dataset.action === "add-collection") openCollectionDialog();
  if (action.dataset.action === "edit-collection") openCollectionDialog(state.collections.find((item) => item.id === id));
  if (action.dataset.action === "add-order") openOrderDialog();
  if (action.dataset.action === "edit-order") openOrderDialog(state.orders.find((item) => item.id === id));
  if (action.dataset.action === "delete-order") deleteOrder(id);
  if (action.dataset.action === "copy-media") navigator.clipboard.writeText(action.dataset.url).then(() => notify("Media URL copied.")).catch(() => notify("The URL could not be copied.", "error"));
  if (action.dataset.action === "delete-media") deleteMedia(action.dataset.path);
}

function switchView(view) {
  if (!VIEW_META[view]) return;
  state.activeView = view;
  $$('[data-panel]').forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === view));
  $$('[data-view]').forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  $("#view-eyebrow").textContent = VIEW_META[view][0];
  $("#view-title").textContent = VIEW_META[view][1];
  $("#global-add-button").hidden = view !== "dashboard" && view !== "products";
  $("#admin-sidebar").classList.remove("is-open");
  $("#sidebar-toggle").setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleSidebar() {
  const sidebar = $("#admin-sidebar");
  const isOpen = sidebar.classList.toggle("is-open");
  $("#sidebar-toggle").setAttribute("aria-expanded", String(isOpen));
}

function confirmAction(title, message) {
  $("#confirm-title").textContent = title;
  $("#confirm-message").textContent = message;
  $("#confirm-overlay").hidden = false;
  $("#confirm-accept").focus();
  return new Promise((resolve) => { state.confirmResolver = resolve; });
}

function resolveConfirmation(value) {
  $("#confirm-overlay").hidden = true;
  state.confirmResolver?.(value);
  state.confirmResolver = null;
}

initialize();
