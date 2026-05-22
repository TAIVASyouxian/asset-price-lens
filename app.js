const APP_VERSION = "v1.0.18";
const STORAGE_KEY = "assetPriceLensState";
const ACCESS_GRANTED_KEY = "accessGranted";
const SKIP_BOOT_KEY = "skipBootAnimation";
const ACCESS_CODE = "TAIVAS-GJ";
const FX_API_URL = "https://open.er-api.com/v6/latest/USD";
const MANUAL_FX_COOLDOWN_MS = 5 * 60 * 1000;

/*
Product boundary lock:
- 資產尺 is a private personal-use estimation PWA and consumer-side asset-value
  sensing tool for estimating the opportunity cost of a purchase.
- Always describe it as: 消費前的資產價值感測工具.
- Design principle: it is primarily for the owner's own workflow and enjoyment;
  it may feel customized, slightly sci-fi, and like a private control center. It
  does not need to look like a generic finance app or appeal to everyone.
  Core vibe: 自己看自己爽，但邊界清楚。
- It is not a brokerage app, stock trading app, investment advisory app,
  buy/sell signal tool, real-time financial quote system, replacement for bank /
  broker / exchange / official market data, or enterprise financial decision
  system.
- FX rates may auto-update only as daily/reference rates for estimation.
- Asset prices, including 0050, 台積電, VT, EWL, and future custom assets, must
  remain manually entered by the user.
- Do not auto-fetch or scrape stock, ETF, quote, brokerage, exchange, or market
  data. Do not add trading APIs, buy/sell recommendations, portfolio advice,
  investment scoring, official financial data redistribution, or paid advisory
  functions unless the user explicitly changes this product boundary later.
- Prefer wording such as 約相當於, 估算, 參考, 資產價值感, 消費前感測,
  機會成本, 手動輸入, 參考匯率.
*/

const defaults = {
  productPrice: "",
  productCurrency: "TWD",
  decimalMode: "2",
  manualFx: false,
  autoDailyFxUpdate: true,
  lastManualFxUpdateAt: "",
  prices: {
    price_0050_twd: 180,
    price_tsmc_twd: "",
    price_vt_usd: 120,
    price_ewl_usd: 50
  },
  fx: {
    usdTwd: "",
    eurTwd: "",
    chfTwd: "",
    source: "",
    fetchedAt: "",
    rateDate: ""
  },
  assetPricesUpdatedAt: "",
  installmentMonths: "",
  current0050: "",
  target0050: ""
};

const els = {
  accessGate: document.querySelector("#accessGate"),
  bootScreen: document.querySelector("#bootScreen"),
  appShell: document.querySelector("#appShell"),
  accessCode: document.querySelector("#accessCode"),
  accessSubmit: document.querySelector("#accessSubmit"),
  accessError: document.querySelector("#accessError"),
  accessProgress: document.querySelector("#accessProgress"),
  bootTitle: document.querySelector("#bootTitle"),
  bootBadges: [...document.querySelectorAll("[data-boot-badge]")],
  bootLines: [
    document.querySelector("#bootLine1"),
    document.querySelector("#bootLine2"),
    document.querySelector("#bootLine3"),
    document.querySelector("#bootLine4")
  ],
  appVersion: document.querySelector("#appVersion"),
  productPrice: document.querySelector("#productPrice"),
  convertedPrice: document.querySelector("#convertedPrice"),
  fxStatus: document.querySelector("#fxStatus"),
  updateRatesBtn: document.querySelector("#updateRatesBtn"),
  shares0050: document.querySelector("#shares0050"),
  sharesVT: document.querySelector("#sharesVT"),
  sharesEWL: document.querySelector("#sharesEWL"),
  sharesTSMC: document.querySelector("#sharesTSMC"),
  sharesTSMCNote: document.querySelector("#sharesTSMCNote"),
  price0050: document.querySelector("#price0050"),
  priceTSMC: document.querySelector("#priceTSMC"),
  priceVT: document.querySelector("#priceVT"),
  priceEWL: document.querySelector("#priceEWL"),
  lastAssetPriceUpdate: document.querySelector("#lastAssetPriceUpdate"),
  manualFxMode: document.querySelector("#manualFxMode"),
  autoDailyFxUpdate: document.querySelector("#autoDailyFxUpdate"),
  usdTwd: document.querySelector("#usdTwd"),
  eurTwd: document.querySelector("#eurTwd"),
  chfTwd: document.querySelector("#chfTwd"),
  lastFxUpdate: document.querySelector("#lastFxUpdate"),
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
  clearAccessBtn: document.querySelector("#clearAccessBtn"),
  skipBootAnimation: document.querySelector("#skipBootAnimation"),
  currencyButtons: [...document.querySelectorAll("[data-currency]")]
};

let state = loadState();
let bootShownThisLoad = false;

function hasAccess() {
  return localStorage.getItem(ACCESS_GRANTED_KEY) === "true";
}

function skipBootEnabled() {
  return localStorage.getItem(SKIP_BOOT_KEY) === "true";
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setBootContent(mode) {
  const copy = mode === "returning"
    ? {
        title: "資產尺控制台啟動中",
        badges: ["LOCAL ACCESS", "PRIVATE NODE", "ASSET SENSOR ONLINE"],
        lines: ["本機授權確認…", "匯率節點待命…", "資產感測模組同步…", "私人控制台準備完成"]
      }
    : {
        title: "權限通過",
        badges: ["ACCESS GRANTED", "PRIVATE NODE", "LOCAL MODE", "ASSET SENSOR ONLINE"],
        lines: ["私人資產感測模組啟動中…", "匯率節點同步中…", "本機設定載入中…", "資產尺控制台準備完成"]
      };

  els.bootTitle.textContent = copy.title;
  els.bootBadges.forEach((badge, index) => {
    badge.hidden = !copy.badges[index];
    badge.textContent = copy.badges[index] || "";
  });
  els.bootLines.forEach((line, index) => {
    line.textContent = copy.lines[index] || "";
  });
}

function unlockApp() {
  els.accessGate.hidden = true;
  els.bootScreen.hidden = true;
  els.bootScreen.classList.remove("boot-active");
  els.appShell.classList.remove("access-locked");
}

function showBootSequence(mode, onComplete = () => {}) {
  setBootContent(mode);
  bootShownThisLoad = true;
  els.accessGate.hidden = true;
  els.appShell.classList.add("access-locked");
  els.bootScreen.hidden = false;
  els.bootScreen.classList.remove("boot-active");
  void els.bootScreen.offsetWidth;
  els.bootScreen.classList.add("boot-active");

  const duration = prefersReducedMotion() ? 450 : mode === "returning" ? 1400 : 1750;
  window.setTimeout(() => {
    els.bootScreen.hidden = true;
    els.bootScreen.classList.remove("boot-active");
    onComplete();
  }, duration);
}

function renderAccessState() {
  if (!hasAccess()) {
    els.bootScreen.hidden = true;
    els.bootScreen.classList.remove("boot-active");
    els.accessGate.hidden = false;
    els.appShell.classList.add("access-locked");
    window.setTimeout(() => els.accessCode.focus(), 0);
    return;
  }

  if (!skipBootEnabled() && !bootShownThisLoad) {
    showBootSequence("returning", unlockApp);
    return;
  }

  unlockApp();
}

function grantAccess() {
  els.accessError.classList.add("success");
  els.accessError.textContent = "權限通過｜資產感測模組啟動中…";
  els.accessProgress.classList.add("active");

  window.setTimeout(() => {
    showBootSequence("first", () => {
      localStorage.setItem(ACCESS_GRANTED_KEY, "true");
      els.accessError.textContent = "";
      els.accessError.classList.remove("success");
      els.accessProgress.classList.remove("active");
      els.accessCode.value = "";
      unlockApp();
    });
  }, prefersReducedMotion() ? 80 : 220);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return mergeState(defaults, saved || {});
  } catch {
    return structuredClone(defaults);
  }
}

function mergeState(base, saved) {
  const savedPrices = saved.prices || {};
  return {
    ...structuredClone(base),
    ...saved,
    prices: {
      ...base.prices,
      ...savedPrices,
      price_0050_twd: savedPrices.price_0050_twd ?? savedPrices.price0050 ?? base.prices.price_0050_twd,
      price_tsmc_twd: savedPrices.price_tsmc_twd ?? base.prices.price_tsmc_twd,
      price_vt_usd: savedPrices.price_vt_usd ?? savedPrices.priceVT ?? base.prices.price_vt_usd,
      price_ewl_usd: savedPrices.price_ewl_usd ?? savedPrices.priceEWL ?? base.prices.price_ewl_usd
    },
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
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function readableDateTime(value) {
  if (!value) return "未知時間";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知時間";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function hasTodayFx() {
  if (state.fx.rateDate === todayKey()) return true;
  return state.fx.fetchedAt && todayKey(new Date(state.fx.fetchedAt)) === todayKey();
}

function hasSavedFx() {
  return numberValue(state.fx.usdTwd) && numberValue(state.fx.eurTwd) && numberValue(state.fx.chfTwd);
}

function updateLastFxLabel() {
  els.lastFxUpdate.textContent = state.fx.fetchedAt
    ? `上次匯率更新：${readableDateTime(state.fx.fetchedAt)}`
    : "尚未更新匯率";
}

function updateLastAssetPriceLabel() {
  els.lastAssetPriceUpdate.textContent = state.assetPricesUpdatedAt
    ? `上次手動更新資產價格時間：${readableDateTime(state.assetPricesUpdatedAt)}`
    : "尚未手動更新資產價格";
}

function syncInputs() {
  els.appVersion.textContent = APP_VERSION;
  els.productPrice.value = state.productPrice;
  els.price0050.value = state.prices.price_0050_twd;
  els.priceTSMC.value = state.prices.price_tsmc_twd;
  els.priceVT.value = state.prices.price_vt_usd;
  els.priceEWL.value = state.prices.price_ewl_usd;
  els.manualFxMode.checked = Boolean(state.manualFx);
  els.autoDailyFxUpdate.checked = Boolean(state.autoDailyFxUpdate);
  els.skipBootAnimation.checked = skipBootEnabled();
  els.usdTwd.value = state.fx.usdTwd;
  els.eurTwd.value = state.fx.eurTwd;
  els.chfTwd.value = state.fx.chfTwd;
  updateLastFxLabel();
  updateLastAssetPriceLabel();
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
    els.fxStatus.textContent = "手動匯率模式已開啟，不會自動更新參考匯率。";
    return;
  }

  if (!hasSavedFx()) {
    els.fxStatus.textContent = "沒有已儲存參考匯率，請手動輸入。";
    return;
  }

  if (!navigator.onLine) {
    els.fxStatus.textContent = "離線：使用已儲存參考匯率。";
    return;
  }

  if (mode === "api-failed") {
    els.fxStatus.textContent = "匯率來源暫時無法使用：使用已儲存參考匯率。";
    return;
  }

  els.fxStatus.textContent = hasTodayFx() ? "已使用今日參考匯率" : "線上：使用最新每日參考匯率";
}

async function fetchRates(force = false) {
  if (state.manualFx) {
    els.fxStatus.textContent = force ? "請先關閉手動匯率模式。" : "手動匯率模式已開啟，不會自動更新參考匯率。";
    return;
  }

  if (!navigator.onLine) {
    updateFxStatus();
    return;
  }

  if (!force && hasTodayFx() && hasSavedFx()) {
    els.fxStatus.textContent = "已使用今日參考匯率";
    return;
  }

  els.fxStatus.textContent = "參考匯率更新中...";

  try {
    const response = await fetch(FX_API_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("FX request failed");

    const data = await response.json();
    const usdTwd = Number(data?.rates?.TWD);
    const usdEur = Number(data?.rates?.EUR);
    const usdChf = Number(data?.rates?.CHF);
    if (!usdTwd || !usdEur || !usdChf) throw new Error("Required rates missing");

    state.fx = {
      usdTwd: Number(usdTwd.toFixed(4)),
      eurTwd: Number((usdTwd / usdEur).toFixed(4)),
      chfTwd: Number((usdTwd / usdChf).toFixed(4)),
      source: "open.er-api.com",
      fetchedAt: new Date().toISOString(),
      rateDate: todayKey()
    };

    saveState();
    syncInputs();
    els.fxStatus.textContent = "線上：使用最新每日參考匯率";
    return true;
  } catch {
    updateFxStatus(hasSavedFx() ? "api-failed" : "");
    return false;
  }
}

function manualFxCooldownActive() {
  if (!state.lastManualFxUpdateAt) return false;
  const lastManualUpdate = new Date(state.lastManualFxUpdateAt).getTime();
  if (!Number.isFinite(lastManualUpdate)) return false;
  return Date.now() - lastManualUpdate < MANUAL_FX_COOLDOWN_MS;
}

async function requestManualFxUpdate() {
  if (state.manualFx) {
    els.fxStatus.textContent = "請先關閉手動匯率模式。";
    return;
  }

  if (!navigator.onLine) {
    updateFxStatus();
    return;
  }

  if (manualFxCooldownActive()) {
    els.fxStatus.textContent = "剛剛已更新參考匯率，請稍後再試。";
    return;
  }

  state.lastManualFxUpdateAt = new Date().toISOString();
  saveState();
  await fetchRates(true);
}

function shouldAutoUpdateFx() {
  return navigator.onLine && !state.manualFx && state.autoDailyFxUpdate && (!hasTodayFx() || !hasSavedFx());
}

function startFxUpdateFlow() {
  if (shouldAutoUpdateFx()) {
    fetchRates(false);
    return;
  }
  updateFxStatus();
}

function productPriceTwd() {
  const amount = numberValue(state.productPrice);
  if (state.productCurrency === "USD") return amount * numberValue(state.fx.usdTwd);
  if (state.productCurrency === "EUR") return amount * numberValue(state.fx.eurTwd);
  if (state.productCurrency === "CHF") return amount * numberValue(state.fx.chfTwd);
  return amount;
}

function calculate() {
  const priceTwd = productPriceTwd();
  const usdTwd = numberValue(state.fx.usdTwd);
  const price0050 = numberValue(state.prices.price_0050_twd);
  const priceTSMC = numberValue(state.prices.price_tsmc_twd);
  const priceVT = numberValue(state.prices.price_vt_usd) * usdTwd;
  const priceEWL = numberValue(state.prices.price_ewl_usd) * usdTwd;
  const shares0050 = price0050 ? priceTwd / price0050 : 0;
  const sharesTSMC = priceTSMC ? priceTwd / priceTSMC : 0;
  const sharesVT = priceVT ? priceTwd / priceVT : 0;
  const sharesEWL = priceEWL ? priceTwd / priceEWL : 0;

  els.convertedPrice.textContent = formatCurrency(priceTwd, "TWD");
  els.shares0050.textContent = formatShares(shares0050);
  els.sharesVT.textContent = formatShares(sharesVT);
  els.sharesEWL.textContent = formatShares(sharesEWL);
  if (priceTSMC) {
    els.sharesTSMC.textContent = `約相當於 ${formatShares(sharesTSMC)} 股台積電`;
    els.sharesTSMCNote.textContent = "台積電";
  } else {
    els.sharesTSMC.textContent = "請先輸入台積電股價";
    els.sharesTSMCNote.textContent = "台積電股價";
  }

  const months = Math.max(0, Math.floor(numberValue(state.installmentMonths)));
  const monthly = months ? priceTwd / months : 0;
  els.monthlyPayment.textContent = formatCurrency(monthly, "TWD");
  els.monthlyShares.textContent = `${formatShares(price0050 ? monthly / price0050 : 0)} 股 0050`;

  const current = numberValue(state.current0050);
  const target = numberValue(state.target0050);
  const remaining = Math.max(target - current, 0);
  els.sharesRemaining.textContent = `剩餘 ${formatShares(remaining)} 股`;
  els.purchaseDelay.textContent = `本次消費約相當於 ${formatShares(shares0050)} 股 0050`;
}

function bindInput(input, update) {
  input.addEventListener("input", () => {
    update(input.value);
    saveState();
    updateFxStatus();
    updateLastFxLabel();
    calculate();
  });
}

function bindAssetPriceInput(input, update) {
  input.addEventListener("input", () => {
    update(input.value);
    state.assetPricesUpdatedAt = new Date().toISOString();
    saveState();
    updateLastAssetPriceLabel();
    updateFxStatus();
    calculate();
  });
}

function bindEvents() {
  els.accessSubmit.addEventListener("click", () => {
    if (els.accessCode.value.trim() === ACCESS_CODE) {
      grantAccess();
      return;
    }
    els.accessError.classList.remove("success");
    els.accessError.textContent = "權限拒絕：測試碼錯誤";
  });

  els.accessCode.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      els.accessSubmit.click();
    }
  });

  bindInput(els.productPrice, (value) => { state.productPrice = value; });
  bindAssetPriceInput(els.price0050, (value) => { state.prices.price_0050_twd = value; });
  bindAssetPriceInput(els.priceTSMC, (value) => { state.prices.price_tsmc_twd = value; });
  bindAssetPriceInput(els.priceVT, (value) => { state.prices.price_vt_usd = value; });
  bindAssetPriceInput(els.priceEWL, (value) => { state.prices.price_ewl_usd = value; });
  els.manualFxMode.addEventListener("change", () => {
    state.manualFx = els.manualFxMode.checked;
    if (state.manualFx && hasSavedFx()) {
      state.fx.source = "manual";
      state.fx.fetchedAt = state.fx.fetchedAt || new Date().toISOString();
      state.fx.rateDate = state.fx.rateDate || todayKey();
    }
    saveState();
    syncInputs();
    if (!state.manualFx) startFxUpdateFlow();
  });
  els.autoDailyFxUpdate.addEventListener("change", () => {
    state.autoDailyFxUpdate = els.autoDailyFxUpdate.checked;
    saveState();
    startFxUpdateFlow();
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
  bindInput(els.chfTwd, (value) => {
    state.fx.chfTwd = value;
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

  els.updateRatesBtn.addEventListener("click", () => requestManualFxUpdate());

  els.resetBtn.addEventListener("click", () => {
    if (!confirm("確定要重設所有已儲存資料？")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    syncInputs();
  });

  els.skipBootAnimation.addEventListener("change", () => {
    localStorage.setItem(SKIP_BOOT_KEY, els.skipBootAnimation.checked ? "true" : "false");
  });

  els.clearAccessBtn.addEventListener("click", () => {
    localStorage.removeItem(ACCESS_GRANTED_KEY);
    renderAccessState();
  });

  els.reloadAppBtn.addEventListener("click", async () => {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.includes("asset-price-lens"))
          .map((name) => caches.delete(name))
      );
    }
    const url = new URL(window.location.href);
    url.searchParams.set("refresh", Date.now().toString());
    window.location.replace(url.toString());
  });

  window.addEventListener("online", () => startFxUpdateFlow());
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
renderAccessState();
startFxUpdateFlow();
registerServiceWorker();
