// --- State ---
let currentData = null;
let savedBusinesses = [];

// --- DOM Elements ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  loadSaved();
  setupTabs();
  setupSingleTab();
  setupBulkTab();
  setupSavedTab();
});

// --- Tabs ---
function setupTabs() {
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      $$(".tab-content").forEach((c) => c.classList.add("hidden"));
      tab.classList.add("active");
      $(`#tab-${tab.dataset.tab}`).classList.remove("hidden");
    });
  });
}

// --- Single Business ---
function setupSingleTab() {
  $("#extractBtn").addEventListener("click", extractSingle);
  $("#saveBtn").addEventListener("click", saveCurrent);
  $("#copyBtn").addEventListener("click", copyCurrent);
  $("#csvBtn").addEventListener("click", () => {
    if (currentData) downloadCSV([currentData], currentData.name || "business");
  });
}

function extractSingle() {
  $("#loading").classList.remove("hidden");
  $("#error").classList.add("hidden");
  $("#resultCard").classList.add("hidden");

  chrome.runtime.sendMessage({ action: "extractData" }, (response) => {
    $("#loading").classList.add("hidden");

    if (chrome.runtime.lastError) {
      showError(
        "error",
        "Could not connect to page. Make sure you're on Google Maps."
      );
      return;
    }

    if (response && response.error) {
      showError("error", response.error);
      return;
    }

    if (response && response.data) {
      currentData = response.data;
      renderResult(response.data);
    } else {
      showError(
        "error",
        "No business data found. Make sure a business is selected on Google Maps."
      );
    }
  });
}

function renderResult(data) {
  const card = $("#resultCard");

  $("#bizName").textContent = data.name || "Unknown Business";
  $("#bizCategory").textContent = data.category || "";
  if (!data.category) $("#bizCategory").classList.add("hidden");
  else $("#bizCategory").classList.remove("hidden");

  $("#bizRating").textContent = data.rating || "-";
  $("#bizReviews").textContent = data.reviewCount
    ? `(${data.reviewCount})`
    : "";

  setField("addressRow", "bizAddress", data.address);
  setField("phoneRow", "bizPhone", data.phone);

  if (data.website) {
    $("#websiteRow").classList.remove("hidden");
    const websiteEl = $("#bizWebsite");
    websiteEl.textContent = cleanUrl(data.website);
    websiteEl.href = data.website;
  } else {
    $("#websiteRow").classList.add("hidden");
  }

  // Hours
  if (data.hours) {
    $("#hoursRow").classList.remove("hidden");
    if (typeof data.hours === "object" && !Array.isArray(data.hours)) {
      const hoursStr = Object.entries(data.hours)
        .map(([day, time]) => `${day}: ${time}`)
        .join("\n");
      $("#bizHours").textContent = hoursStr;
      $("#bizHours").style.whiteSpace = "pre-line";
    } else {
      $("#bizHours").textContent = String(data.hours);
    }
  } else {
    $("#hoursRow").classList.add("hidden");
  }

  setField("priceRow", "bizPrice", data.priceLevel);

  if (data.coordinates && (data.coordinates.lat || data.coordinates.lng)) {
    $("#coordsRow").classList.remove("hidden");
    $("#bizCoords").textContent = `${data.coordinates.lat}, ${data.coordinates.lng}`;
  } else {
    $("#coordsRow").classList.add("hidden");
  }

  setField("descRow", "bizDesc", data.description);

  // Amenities
  if (data.amenities && data.amenities.length > 0) {
    $("#amenitiesRow").classList.remove("hidden");
    const container = $("#bizAmenities");
    container.innerHTML = "";
    data.amenities.forEach((item) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = item;
      container.appendChild(tag);
    });
  } else {
    $("#amenitiesRow").classList.add("hidden");
  }

  card.classList.remove("hidden");
}

function setField(rowId, valueId, value) {
  if (value) {
    $(`#${rowId}`).classList.remove("hidden");
    $(`#${valueId}`).textContent = value;
  } else {
    $(`#${rowId}`).classList.add("hidden");
  }
}

function cleanUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace("www.", "");
  } catch {
    return url;
  }
}

// --- Save / Copy / CSV ---
function saveCurrent() {
  if (!currentData) return;

  const exists = savedBusinesses.some(
    (b) => b.name === currentData.name && b.address === currentData.address
  );

  if (exists) {
    showToast("Already saved!");
    return;
  }

  savedBusinesses.push({ ...currentData });
  persistSaved();
  showToast("Saved!");
}

function copyCurrent() {
  if (!currentData) return;
  const text = formatForCopy(currentData);
  navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard!"));
}

function formatForCopy(data) {
  const lines = [];
  if (data.name) lines.push(`Business: ${data.name}`);
  if (data.category) lines.push(`Category: ${data.category}`);
  if (data.rating) lines.push(`Rating: ${data.rating} (${data.reviewCount || 0} reviews)`);
  if (data.address) lines.push(`Address: ${data.address}`);
  if (data.phone) lines.push(`Phone: ${data.phone}`);
  if (data.website) lines.push(`Website: ${data.website}`);
  if (data.priceLevel) lines.push(`Price: ${data.priceLevel}`);
  if (data.description) lines.push(`About: ${data.description}`);
  if (data.amenities && data.amenities.length)
    lines.push(`Services: ${data.amenities.join(", ")}`);
  if (data.hours) {
    if (typeof data.hours === "object") {
      lines.push(
        `Hours:\n${Object.entries(data.hours)
          .map(([d, t]) => `  ${d}: ${t}`)
          .join("\n")}`
      );
    } else {
      lines.push(`Hours: ${data.hours}`);
    }
  }
  if (data.mapsUrl) lines.push(`Google Maps: ${data.mapsUrl}`);
  return lines.join("\n");
}

// --- CSV ---
function downloadCSV(dataArray, filename) {
  const headers = [
    "Name",
    "Category",
    "Rating",
    "Reviews",
    "Address",
    "Phone",
    "Website",
    "Price Level",
    "Description",
    "Services/Amenities",
    "Hours",
    "Latitude",
    "Longitude",
    "Google Maps URL",
    "Extracted At",
  ];

  const rows = dataArray.map((d) => [
    d.name || "",
    d.category || "",
    d.rating || "",
    d.reviewCount || "",
    d.address || "",
    d.phone || "",
    d.website || "",
    d.priceLevel || "",
    d.description || "",
    (d.amenities || []).join("; "),
    typeof d.hours === "object"
      ? Object.entries(d.hours)
          .map(([day, time]) => `${day}: ${time}`)
          .join(" | ")
      : d.hours || "",
    d.coordinates ? d.coordinates.lat : "",
    d.coordinates ? d.coordinates.lng : "",
    d.mapsUrl || "",
    d.extractedAt || "",
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV downloaded!");
}

// --- Bulk Extract ---
function setupBulkTab() {
  $("#bulkExtractBtn").addEventListener("click", extractBulk);
  $("#bulkCsvBtn").addEventListener("click", () => {
    const items = JSON.parse(
      $("#bulkList").dataset.items || "[]"
    );
    if (items.length) downloadCSV(items, "bulk_businesses");
  });
}

function extractBulk() {
  $("#bulkLoading").classList.remove("hidden");
  $("#bulkError").classList.add("hidden");
  $("#bulkResults").classList.add("hidden");

  chrome.runtime.sendMessage({ action: "extractSearchResults" }, (response) => {
    $("#bulkLoading").classList.add("hidden");

    if (chrome.runtime.lastError) {
      showError(
        "bulkError",
        "Could not connect. Make sure you're on Google Maps search results."
      );
      return;
    }

    if (response && response.error) {
      showError("bulkError", response.error);
      return;
    }

    if (response && response.data && response.data.length > 0) {
      renderBulkResults(response.data);
    } else {
      showError(
        "bulkError",
        "No search results found. Search for businesses on Google Maps first."
      );
    }
  });
}

function renderBulkResults(results) {
  const container = $("#bulkResults");
  const list = $("#bulkList");
  list.innerHTML = "";
  list.dataset.items = JSON.stringify(
    results.map((r) => ({ name: r.name, mapsUrl: r.url }))
  );

  $("#bulkCount").textContent = `${results.length} businesses found`;

  results.forEach((result) => {
    const item = document.createElement("div");
    item.className = "bulk-item";
    item.innerHTML = `
      <span class="bulk-item-name" title="${escapeHtml(result.name)}">${escapeHtml(result.name)}</span>
      <div class="bulk-item-actions">
        <button class="btn-icon" title="Open in Maps">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </button>
      </div>
    `;

    const openBtn = item.querySelector(".btn-icon");
    openBtn.addEventListener("click", () => {
      if (result.url) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) chrome.tabs.update(tabs[0].id, { url: result.url });
        });
      }
    });

    list.appendChild(item);
  });

  container.classList.remove("hidden");
}

// --- Saved Tab ---
function setupSavedTab() {
  $("#exportAllCsvBtn").addEventListener("click", () => {
    if (savedBusinesses.length)
      downloadCSV(savedBusinesses, "all_saved_businesses");
  });

  $("#copyAllBtn").addEventListener("click", () => {
    navigator.clipboard
      .writeText(JSON.stringify(savedBusinesses, null, 2))
      .then(() => showToast("Copied all as JSON!"));
  });

  $("#clearAllBtn").addEventListener("click", () => {
    if (confirm("Remove all saved businesses?")) {
      savedBusinesses = [];
      persistSaved();
      showToast("All cleared");
    }
  });
}

function renderSavedList() {
  const list = $("#savedList");
  list.innerHTML = "";

  if (savedBusinesses.length === 0) {
    $("#savedEmpty").classList.remove("hidden");
    $("#savedActions").classList.add("hidden");
    return;
  }

  $("#savedEmpty").classList.add("hidden");
  $("#savedActions").classList.remove("hidden");

  savedBusinesses.forEach((biz, index) => {
    const item = document.createElement("div");
    item.className = "bulk-item";
    item.innerHTML = `
      <span class="bulk-item-name" title="${escapeHtml(biz.name || "")}">${escapeHtml(biz.name || "Unknown")}</span>
      <div class="bulk-item-actions">
        <button class="btn-icon copy-saved" title="Copy info">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        <button class="btn-icon danger remove-saved" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;

    item.querySelector(".copy-saved").addEventListener("click", () => {
      navigator.clipboard
        .writeText(formatForCopy(biz))
        .then(() => showToast("Copied!"));
    });

    item.querySelector(".remove-saved").addEventListener("click", () => {
      savedBusinesses.splice(index, 1);
      persistSaved();
      showToast("Removed");
    });

    list.appendChild(item);
  });

  $("#savedCount").textContent = savedBusinesses.length;
}

// --- Storage ---
function loadSaved() {
  chrome.storage.local.get("savedBusinesses", (result) => {
    savedBusinesses = result.savedBusinesses || [];
    renderSavedList();
  });
}

function persistSaved() {
  chrome.storage.local.set({ savedBusinesses }, () => {
    renderSavedList();
  });
}

// --- Helpers ---
function showError(elementId, message) {
  const el = $(`#${elementId}`);
  el.textContent = message;
  el.classList.remove("hidden");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2000);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
