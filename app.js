const APP_VERSION = "v1.0.2";
const STORAGE_KEY = "assetPriceLensState";
const FX_API_URL = "https://open.er-api.com/v6/latest/USD";

const defaults = {
  productPrice: "",
  productCurrency: "TWD",
  decimalMode: "2",
  manualFx: false,
  prices: {
    price0050: 180,
    priceVT: 120,
    priceEWL: 50
  },
  fx: {
    usdTwd: "",
    eurTwd: "",
    source: "",
    fetchedAt: "",
    rateDate: ""
  },
  installmentMonths: "",
  current0050: "",
  target0050: ""
};

const els = {
  appVersion: document.querySelector("#appVersion"),
  productPrice: document.querySelector("#productPrice"),
  convertedPrice: document.querySelector("#convertedPrice"),
  fxStatus: document.querySelector("#fxStatus"),
  updateRatesBtn: document.querySelector("#updateRatesBtn"),
  shares0050: document.querySelector("#shares0050"),
  sharesVT: document.querySelector("#sharesVT"),
  sharesEWL: document.querySelector("#sharesEWL"),
  price0050: document.querySelector("#price0050"),
  priceVT: document.querySelector("#priceVT"),
  priceEWL: document.querySelector("#priceEWL"),
  manualFxMode: document.querySelector("#manualFxMode"),
  usdTwd: document.querySelector("#usdTwd"),
  eurTwd: document.querySelector("#eurTwd"),
  decimalMode: document.querySelector("#decimalMode"),
  installmentMonths: document.querySelector("#installmentMonths"),
  monthlyPayment: document.querySelector("#monthlyPayment"),
  monthlyShares: document.querySelector("#monthlyShares"),
  current0050: document.querySelector("#current0050"),
  target0050: document.querySelector("#target0050"),
  sharesRemaining: document.querySelector("#sharesRemaining"),
  purchaseDelay: document.querySelector("#purchaseDelay"),
  resetBtn: document.querySelector("#resetBtn"),
  reloadAppBtn: document.querySelector("#reloadAppBtn"),
  currencyButtons: [...document.querySelectorAll("[data-currency]")]
};

let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return mergeState(defaults, saved || {});
  } catch {
    return structuredClone(defaults);
  }
}

function mergeState(base, saved) {
  return {
    ...structuredClone(base),
    ...saved,
    prices: { ...base.prices, ...(saved.prices || {}) },
    fx: { ...base.fx, ...(saved.fx || {}) }
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function numberValue(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function formatCurrency(value, currency = "TWD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "TWD" ? 0 : 2
  }).format(Number.isFinite(value) ? value : 0);
}

function formatShares(value) {
  const decimals = Number(state.decimalMode);
  const safeValue = Number.isFinite(value) ? value : 0;
  if (decimals === 0) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0
    }).format(Math.floor(safeValue));
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(safeValue);
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function readableDateTime(value) {
  if (!value) return "unknown time";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function isFxFromToday() {
  return state.fx.fetchedAt && todayKey(new Date(state.fx.fetchedAt)) === todayKey();
}

function hasSavedFx() {
  return numberValue(state.fx.usdTwd) && numberValue(state.fx.eurTwd);
}

function syncInputs() {
  els.appVersion.textContent = APP_VERSION;
  els.productPrice.value = state.productPrice;
  els.price0050.value = state.prices.price0050;
  els.priceVT.value = state.prices.priceVT;
  els.priceEWL.value = state.prices.priceEWL;
  els.manualFxMode.checked = Boolean(state.manualFx);
  els.usdTwd.value = state.fx.usdTwd;
  els.eurTwd.value = state.fx.eurTwd;
  els.updateRatesBtn.disabled = Boolean(state.manualFx);
  els.decimalMode.value = state.decimalMode;
  els.installmentMonths.value = state.installmentMonths;
  els.current0050.value = state.current0050;
  els.target0050.value = state.target0050;
  updateCurrencyButtons();
  updateFxStatus();
  calculate();
}

function updateCurrencyButtons() {
  els.currencyButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.currency === state.productCurrency);
  });
}

function updateFxStatus(mode = "") {
  if (state.manualFx) {
    els.fxStatus.textContent = hasSavedFx()
      ? "Manual FX mode: using entered FX rates"
      : "Manual FX mode: please enter USD/TWD and EUR/TWD";
    return;
  }

  if (!hasSavedFx()) {
    els.fxStatus.textContent = "No saved FX rate: please enter manually";
    return;
  }

  const savedAt = readableDateTime(state.fx.fetchedAt);
  if (!navigator.onLine) {
    els.fxStatus.textContent = `Offline: using saved FX rate from ${savedAt}`;
    return;
  }

  if (mode === "api-failed") {
    els.fxStatus.textContent = `API unavailable: using saved FX rate from ${savedAt}`;
    return;
  }

  els.fxStatus.textContent = "Online: using latest daily FX rate";
}

async function fetchRates(force = false) {
  if (state.manualFx) {
    updateFxStatus();
    return;
  }

  if (!navigator.onLine) {
    updateFxStatus();
    return;
  }

  if (!force && isFxFromToday() && hasSavedFx()) {
    updateFxStatus();
    return;
  }

  els.fxStatus.textContent = "Updating FX rate...";

  try {
    const response = await fetch(FX_API_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("FX request failed");

    const data = await response.json();
    const usdTwd = Number(data?.rates?.TWD);
    const usdEur = Number(data?.rates?.EUR);
    if (!usdTwd || !usdEur) throw new Error("Required rates missing");

    state.fx = {
      usdTwd: Number(usdTwd.toFixed(4)),
      eurTwd: Number((usdTwd / usdEur).toFixed(4)),
      source: "open.er-api.com",
      fetchedAt: new Date().toISOString(),
      rateDate: data.time_last_update_utc || data.time_last_update_unix || todayKey()
    };

    saveState();
    syncInputs();
  } catch {
    updateFxStatus(hasSavedFx() ? "api-failed" : "");
  }
}

function productPriceTwd() {
  const amount = numberValue(state.productPrice);
  if (state.productCurrency === "USD") return amount * numberValue(state.fx.usdTwd);
  if (state.productCurrency === "EUR") return amount * numberValue(state.fx.eurTwd);
  return amount;
}

function calculate() {
  const priceTwd = productPriceTwd();
  const usdTwd = numberValue(state.fx.usdTwd);
  const price0050 = numberValue(state.prices.price0050);
  const priceVT = numberValue(state.prices.priceVT) * usdTwd;
  const priceEWL = numberValue(state.prices.priceEWL) * usdTwd;
  const shares0050 = price0050 ? priceTwd / price0050 : 0;
  const sharesVT = priceVT ? priceTwd / priceVT : 0;
  const sharesEWL = priceEWL ? priceTwd / priceEWL : 0;

  els.convertedPrice.textContent = formatCurrency(priceTwd, "TWD");
  els.shares0050.textContent = formatShares(shares0050);
  els.sharesVT.textContent = formatShares(sharesVT);
  els.sharesEWL.textContent = formatShares(sharesEWL);

  const months = Math.max(0, Math.floor(numberValue(state.installmentMonths)));
  const monthly = months ? priceTwd / months : 0;
  els.monthlyPayment.textContent = formatCurrency(monthly, "TWD");
  els.monthlyShares.textContent = `${formatShares(price0050 ? monthly / price0050 : 0)} shares of 0050`;

  const current = numberValue(state.current0050);
  const target = numberValue(state.target0050);
  const remaining = Math.max(target - current, 0);
  els.sharesRemaining.textContent = `${formatShares(remaining)} remaining`;
  els.purchaseDelay.textContent = `Purchase equals ${formatShares(shares0050)} shares of 0050`;
}

function bindInput(input, update) {
  input.addEventListener("input", () => {
    update(input.value);
    saveState();
    updateFxStatus();
    calculate();
  });
}

function bindEvents() {
  bindInput(els.productPrice, (value) => { state.productPrice = value; });
  bindInput(els.price0050, (value) => { state.prices.price0050 = value; });
  bindInput(els.priceVT, (value) => { state.prices.priceVT = value; });
  bindInput(els.priceEWL, (value) => { state.prices.priceEWL = value; });
  els.manualFxMode.addEventListener("change", () => {
    state.manualFx = els.manualFxMode.checked;
    if (state.manualFx && hasSavedFx()) {
      state.fx.source = "manual";
      state.fx.fetchedAt = state.fx.fetchedAt || new Date().toISOString();
      state.fx.rateDate = state.fx.rateDate || todayKey();
    }
    saveState();
    syncInputs();
    updateFxStatus();
    if (!state.manualFx) fetchRates(false);
  });
  bindInput(els.usdTwd, (value) => {
    state.fx.usdTwd = value;
    state.fx.source = "manual";
    state.fx.fetchedAt = new Date().toISOString();
    state.fx.rateDate = todayKey();
  });
  bindInput(els.eurTwd, (value) => {
    state.fx.eurTwd = value;
    state.fx.source = "manual";
    state.fx.fetchedAt = new Date().toISOString();
    state.fx.rateDate = todayKey();
  });
  bindInput(els.installmentMonths, (value) => { state.installmentMonths = value; });
  bindInput(els.current0050, (value) => { state.current0050 = value; });
  bindInput(els.target0050, (value) => { state.target0050 = value; });

  els.decimalMode.addEventListener("change", () => {
    state.decimalMode = els.decimalMode.value;
    saveState();
    calculate();
  });

  els.currencyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.productCurrency = button.dataset.currency;
      saveState();
      updateCurrencyButtons();
      calculate();
    });
  });

  els.updateRatesBtn.addEventListener("click", () => fetchRates(true));

  els.resetBtn.addEventListener("click", () => {
    if (!confirm("Reset all saved Asset Price Lens values?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    syncInputs();
  });

  els.reloadAppBtn.addEventListener("click", async () => {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
    window.location.reload();
  });

  window.addEventListener("online", () => fetchRates(false));
  window.addEventListener("offline", () => updateFxStatus());
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("service-worker.js");
  } catch {
    // The app still works as a static calculator if service worker registration fails.
  }
}

bindEvents();
syncInputs();
fetchRates(false);
registerServiceWorker();
