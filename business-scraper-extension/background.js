// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Enable side panel on Google Maps pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes("google.com/maps")) {
    chrome.sidePanel.setOptions({
      tabId,
      path: "sidepanel.html",
      enabled: true,
    });
  }
});

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractData") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            func: extractBusinessData,
          },
          (results) => {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError.message });
            } else if (results && results[0]) {
              sendResponse({ data: results[0].result });
            } else {
              sendResponse({ error: "No data extracted" });
            }
          }
        );
      }
    });
    return true; // Keep message channel open for async response
  }

  if (message.action === "extractSearchResults") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            func: extractSearchResultsList,
          },
          (results) => {
            if (chrome.runtime.lastError) {
              sendResponse({ error: chrome.runtime.lastError.message });
            } else if (results && results[0]) {
              sendResponse({ data: results[0].result });
            } else {
              sendResponse({ error: "No results found" });
            }
          }
        );
      }
    });
    return true;
  }
});

// --- Content script functions injected into the page ---

function extractBusinessData() {
  const getText = (selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return "";
  };

  const getAttr = (selectors, attr) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.getAttribute(attr)) return el.getAttribute(attr);
    }
    return "";
  };

  // Business Name
  const name =
    getText(['h1.DUwDvf', 'h1[data-attrid="title"]', 'div.tAiQdd h1']) ||
    getText(["h1"]);

  // Address
  const address = (() => {
    const addressBtn = document.querySelector(
      'button[data-item-id="address"]'
    );
    if (addressBtn) return addressBtn.textContent.trim();
    const addrEl = document.querySelector('[data-item-id="address"]');
    if (addrEl) return addrEl.textContent.trim();
    // Fallback: look for aria-label containing address
    const allButtons = document.querySelectorAll("button[aria-label]");
    for (const btn of allButtons) {
      const label = btn.getAttribute("aria-label") || "";
      if (label.toLowerCase().includes("address:"))
        return label.replace(/^address:\s*/i, "");
    }
    return "";
  })();

  // Phone
  const phone = (() => {
    const phoneBtn = document.querySelector(
      'button[data-item-id^="phone:"]'
    );
    if (phoneBtn) return phoneBtn.textContent.trim();
    const allButtons = document.querySelectorAll("button[aria-label]");
    for (const btn of allButtons) {
      const label = btn.getAttribute("aria-label") || "";
      if (label.toLowerCase().includes("phone:"))
        return label.replace(/^phone:\s*/i, "");
    }
    return "";
  })();

  // Website
  const website = (() => {
    const websiteLink = document.querySelector(
      'a[data-item-id="authority"]'
    );
    if (websiteLink) return websiteLink.getAttribute("href") || "";
    const allLinks = document.querySelectorAll("a[aria-label]");
    for (const link of allLinks) {
      const label = link.getAttribute("aria-label") || "";
      if (label.toLowerCase().includes("website"))
        return link.getAttribute("href") || "";
    }
    return "";
  })();

  // Rating
  const rating = (() => {
    const ratingEl = document.querySelector("div.F7nice span[aria-hidden]");
    if (ratingEl) return ratingEl.textContent.trim();
    const roleImg = document.querySelector('span[role="img"]');
    if (roleImg) {
      const label = roleImg.getAttribute("aria-label") || "";
      const match = label.match(/([\d.]+)\s*star/i);
      if (match) return match[1];
    }
    return "";
  })();

  // Review Count
  const reviewCount = (() => {
    const reviewEl = document.querySelector("div.F7nice span[aria-label]");
    if (reviewEl) {
      const label = reviewEl.getAttribute("aria-label") || "";
      const match = label.match(/([\d,]+)\s*review/i);
      if (match) return match[1].replace(/,/g, "");
    }
    // Fallback
    const spans = document.querySelectorAll("span");
    for (const span of spans) {
      const text = span.textContent.trim();
      const match = text.match(/\(([\d,]+)\)/);
      if (match && span.closest(".F7nice")) return match[1].replace(/,/g, "");
    }
    return "";
  })();

  // Business Category
  const category = (() => {
    const catBtn = document.querySelector("button.DkEaL");
    if (catBtn) return catBtn.textContent.trim();
    const catEl = document.querySelector('span.DkEaL, [jsaction*="category"]');
    if (catEl) return catEl.textContent.trim();
    return "";
  })();

  // Business Hours
  const hours = (() => {
    const hoursTable = document.querySelector(
      'table.eK4R0e, div[aria-label*="hours"], table[class*="hour"]'
    );
    if (hoursTable) {
      const rows = hoursTable.querySelectorAll("tr");
      const schedule = {};
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 2) {
          schedule[cells[0].textContent.trim()] =
            cells[1].textContent.trim();
        }
      });
      if (Object.keys(schedule).length > 0) return schedule;
    }
    // Try aria-label on hours section
    const hoursEl = document.querySelector('[data-item-id*="oh"]');
    if (hoursEl) {
      const ariaLabel = hoursEl.getAttribute("aria-label");
      if (ariaLabel) return ariaLabel;
    }
    // Try the hours info row
    const openEl = document.querySelector(".o0Svhf, .ZDu9vd");
    if (openEl) return openEl.textContent.trim();
    return "";
  })();

  // Price Level
  const priceLevel = (() => {
    const priceEl = document.querySelector(
      'span[aria-label*="Price"], span.mgr77e'
    );
    if (priceEl) return priceEl.textContent.trim();
    return "";
  })();

  // Plus Code / Coordinates from URL
  const coordinates = (() => {
    const url = window.location.href;
    const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: match[1], lng: match[2] };
    return { lat: "", lng: "" };
  })();

  // About / Description
  const description = (() => {
    const aboutSection = document.querySelector(
      'div[aria-label*="About"] div.PbZDve, div.WeS02d'
    );
    if (aboutSection) return aboutSection.textContent.trim();
    return "";
  })();

  // Amenities / Highlights
  const amenities = (() => {
    const items = [];
    const amenityEls = document.querySelectorAll(
      'div[aria-label*="Amenities"] li, div[aria-label*="Service options"] span.elJzDe'
    );
    amenityEls.forEach((el) => {
      const text = el.textContent.trim();
      if (text) items.push(text);
    });
    // Also try service options chips
    const serviceChips = document.querySelectorAll("div.E0DTEd");
    serviceChips.forEach((chip) => {
      const text = chip.textContent.trim();
      if (text && !items.includes(text)) items.push(text);
    });
    return items;
  })();

  // Popular Times summary (if available)
  const popularTimes = (() => {
    const liveEl = document.querySelector(".dpoVLd");
    if (liveEl) return liveEl.textContent.trim();
    return "";
  })();

  // Photos count
  const photosCount = (() => {
    const photoBtn = document.querySelector('button[aria-label*="photo"]');
    if (photoBtn) {
      const label = photoBtn.getAttribute("aria-label") || "";
      const match = label.match(/([\d,]+)/);
      if (match) return match[1].replace(/,/g, "");
    }
    return "";
  })();

  // Google Maps URL
  const mapsUrl = window.location.href;

  // Place ID from URL if available
  const placeId = (() => {
    const url = window.location.href;
    const match = url.match(/place_id[=:]([^&/]+)/);
    if (match) return match[1];
    return "";
  })();

  return {
    name,
    address,
    phone,
    website,
    rating,
    reviewCount,
    category,
    priceLevel,
    hours,
    coordinates,
    description,
    amenities,
    popularTimes,
    photosCount,
    placeId,
    mapsUrl,
    extractedAt: new Date().toISOString(),
  };
}

function extractSearchResultsList() {
  const results = [];
  // Google Maps search results feed
  const feedItems = document.querySelectorAll('div[role="feed"] > div > div > a');

  if (feedItems.length === 0) {
    // Alternative selector
    const altItems = document.querySelectorAll("a.hfpxzc");
    altItems.forEach((item) => {
      const label = item.getAttribute("aria-label") || "";
      const href = item.getAttribute("href") || "";
      if (label) {
        results.push({ name: label, url: href });
      }
    });
  } else {
    feedItems.forEach((item) => {
      const label = item.getAttribute("aria-label") || "";
      const href = item.getAttribute("href") || "";
      if (label) {
        results.push({ name: label, url: href });
      }
    });
  }

  return results;
}
