/* ==========================================================================
   SAFETY PERFORMANCE BOARD - LOGIC (AUTOMATIC TIME RUNNER & SYNCED INPUTS)
   Features: State Management, Dynamic Digit Slot Generation, Clock, Admin Console, QR
   ========================================================================== */

// Default Configuration State
const DEFAULT_STATE = {
  targetDays: 730,
  bestRecord: 472,
  lastDate: "2025-03-02", // YYYY-MM-DD (Acts as tracking start date / opening date when neverAccident is true)
  neverAccident: true,    // Enabled by default: never had an accident
  qrUrl: "" // Empty string defaults to window.location.href
};

// Current Application State
let appState = {};
let isAdminMode = false;
let lastCheckedDay = new Date().getDate(); // Tracks day changes for midnight update

// Initialize Dashboard
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  recalculateAccidentFreeDays();
  initClockAndMidnightCheck();
  checkAdminMode();
  updateUI();
  setupEventListeners();
});

// Load state from LocalStorage or load defaults
// Load state from URL parameters (for synced QR scanning) or LocalStorage, or load defaults
function loadState() {
  // 1. Try loading from URL parameters first (e.g. from QR code scan)
  const urlParams = new URLSearchParams(window.location.search);
  const paramLastDate = urlParams.get("lastDate");
  const paramTarget = urlParams.get("target");
  const paramBest = urlParams.get("best");
  const paramNever = urlParams.get("never");
  
  if (paramLastDate || paramTarget || paramBest || paramNever !== null) {
    appState = { ...DEFAULT_STATE };
    if (paramLastDate) appState.lastDate = paramLastDate;
    if (paramTarget) appState.targetDays = parseInt(paramTarget, 10) || DEFAULT_STATE.targetDays;
    if (paramBest) appState.bestRecord = parseInt(paramBest, 10) || DEFAULT_STATE.bestRecord;
    if (paramNever !== null) appState.neverAccident = paramNever === "true";
    
    // Save these parameters to localStorage so they persist on the scanning device
    saveState();
    return;
  }

  // 2. Fallback to LocalStorage
  const saved = localStorage.getItem("hotel_safety_board_twin_state_v3");
  if (saved) {
    try {
      appState = JSON.parse(saved);
      appState = { ...DEFAULT_STATE, ...appState };
    } catch (e) {
      console.error("Failed to parse saved state, resetting to defaults", e);
      appState = { ...DEFAULT_STATE };
    }
  } else {
    appState = { ...DEFAULT_STATE };
  }
}

// Save state to LocalStorage
function saveState() {
  localStorage.setItem("hotel_safety_board_twin_state_v3", JSON.stringify(appState));
}

// Calculate accident-free days based on today's date and lastDate
function recalculateAccidentFreeDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lastAcc = new Date(appState.lastDate);
  lastAcc.setHours(0, 0, 0, 0);
  
  const diffTime = today - lastAcc;
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  appState.accidentFree = diffDays;
  
  // If current operational streak exceeds the best record, auto-update best record
  if (appState.accidentFree > appState.bestRecord) {
    appState.bestRecord = appState.accidentFree;
    saveState();
  }
}

// Check if dashboard is loaded in Admin Mode
function checkAdminMode() {
  const urlParams = new URLSearchParams(window.location.search);
  isAdminMode = urlParams.has("admin") || urlParams.has("edit") || urlParams.get("mode") === "admin";
  
  const btnSettings = document.getElementById("open-settings");
  const logoTrigger = document.getElementById("logo-admin-trigger");
  
  if (btnSettings) {
    if (isAdminMode) {
      btnSettings.classList.remove("hidden-admin");
    } else {
      btnSettings.classList.add("hidden-admin");
    }
  }

  if (logoTrigger) {
    if (isAdminMode) {
      logoTrigger.style.cursor = "pointer";
      logoTrigger.title = "Double-click to toggle Admin Controls / ดับเบิ้ลคลิกเพื่อเปิด-ปิดปุ่มแก้ไข";
    } else {
      logoTrigger.style.cursor = "default";
      logoTrigger.title = "";
    }
  }
}

// Initialize clock and setup automatic midnight check
function initClockAndMidnightCheck() {
  const timeEl = document.getElementById("header-time");
  const dateEl = document.getElementById("header-date");
  
  function updateTime() {
    const now = new Date();
    
    // 1. Time display formatting (HH:MM:SS AM/PM)
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; 
    const hoursStr = String(hours).padStart(2, "0");
    
    if (timeEl) {
      timeEl.textContent = `${hoursStr}:${minutes}:${seconds} ${ampm}`;
    }
    
    // 2. Date display formatting (Thai locale)
    if (dateEl) {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('th-TH', options);
    }

    // 3. Midnight Check: If day shifts, automatically recalculate days without manual reload
    const currentDay = now.getDate();
    if (currentDay !== lastCheckedDay) {
      lastCheckedDay = currentDay;
      recalculateAccidentFreeDays();
      updateUI();
    }
  }
  
  updateTime();
  setInterval(updateTime, 1000);
}

// Helper to format a number into visual digit card slots
function formatNumberToSlots(number, padLength = 3) {
  const numStr = String(number).padStart(padLength, "0");
  let html = "";
  for (let i = 0; i < numStr.length; i++) {
    html += `<span class="digit-box">${numStr[i]}</span>`;
  }
  return html;
}

// Helper to format a calendar date into slot cards in Thai Buddhist Era (DD/MM/YY)
function formatDateToSlots(dateString) {
  if (appState.neverAccident) {
    let html = "";
    html += `<span class="digit-box">-</span>`;
    html += `<span class="digit-box">-</span>`;
    html += `<span class="digit-separator">/</span>`;
    html += `<span class="digit-box">-</span>`;
    html += `<span class="digit-box">-</span>`;
    html += `<span class="digit-separator">/</span>`;
    html += `<span class="digit-box">-</span>`;
    html += `<span class="digit-box">-</span>`;
    return html;
  }

  const d = new Date(dateString);
  let day = String(d.getDate()).padStart(2, "0");
  let month = String(d.getMonth() + 1).padStart(2, "0");
  let yearVal = d.getFullYear();
  
  const thYear = yearVal + 543;
  const yearStr = String(thYear).substring(2, 4);
  
  let html = "";
  html += `<span class="digit-box">${day[0]}</span>`;
  html += `<span class="digit-box">${day[1]}</span>`;
  html += `<span class="digit-separator">/</span>`;
  html += `<span class="digit-box">${month[0]}</span>`;
  html += `<span class="digit-box">${month[1]}</span>`;
  html += `<span class="digit-separator">/</span>`;
  html += `<span class="digit-box">${yearStr[0]}</span>`;
  html += `<span class="digit-box">${yearStr[1]}</span>`;
  
  return html;
}

// Helper to toggle date input label text based on neverAccident value
function toggleDateInputLabel(isNeverAccident) {
  const labelEl = document.getElementById("label-last-date");
  if (labelEl) {
    if (isNeverAccident) {
      labelEl.textContent = "วันที่เริ่มบันทึก/วันเปิดทำการ (Start Tracking / Opening Date)";
    } else {
      labelEl.textContent = "วันที่เกิดอุบัติเหตุล่าสุด (Last Accident Date)";
    }
  }
}


// Render values into Whiteboard UI
function updateUI() {
  // 1. Render Date Digit Slots (DD/MM/YY BE)
  const slotsLastAccident = document.getElementById("slots-last-accident");
  if (slotsLastAccident) {
    slotsLastAccident.innerHTML = formatDateToSlots(appState.lastDate);
  }

  // 2. Render Counters
  const slotsAccidentFree = document.getElementById("slots-accident-free");
  if (slotsAccidentFree) {
    slotsAccidentFree.innerHTML = formatNumberToSlots(appState.accidentFree);
  }

  const slotsTarget = document.getElementById("slots-target");
  if (slotsTarget) {
    slotsTarget.innerHTML = formatNumberToSlots(appState.targetDays);
  }

  const slotsBestRecord = document.getElementById("slots-best-record");
  if (slotsBestRecord) {
    slotsBestRecord.innerHTML = formatNumberToSlots(appState.bestRecord);
  }
}

// Setup Event Listeners
function setupEventListeners() {
  const logoTrigger = document.getElementById("logo-admin-trigger");
  const btnSettings = document.getElementById("open-settings");
  const btnCloseSettings = document.getElementById("close-settings");
  const drawer = document.getElementById("settings-drawer");
  const overlay = document.getElementById("drawer-overlay");
  
  const form = document.getElementById("settings-form");
  const btnReset = document.getElementById("reset-defaults");
  const btnTvMode = document.getElementById("toggle-tv-mode");

  // settings Form Inputs
  const inputAccidentFree = document.getElementById("input-accident-free");
  const inputLastDate = document.getElementById("input-last-date");
  const inputBestRecord = document.getElementById("input-best-record");

  // real-time Input Sync (Connected data fields)
  if (inputAccidentFree) {
    inputAccidentFree.addEventListener("input", function() {
      const days = parseInt(this.value, 10) || 0;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - days);
      
      const yyyy = targetDate.getFullYear();
      const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
      const dd = String(targetDate.getDate()).padStart(2, "0");
      
      inputLastDate.value = `${yyyy}-${mm}-${dd}`;
      
      // Auto-update best record input if days is higher
      const currentBest = parseInt(inputBestRecord.value, 10) || 0;
      if (days > currentBest) {
        inputBestRecord.value = days;
      }
    });
  }

  if (inputLastDate) {
    inputLastDate.addEventListener("input", function() {
      const dateVal = this.value;
      if (dateVal) {
        const enteredDate = new Date(dateVal);
        enteredDate.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const diffTime = today - enteredDate;
        const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        
        inputAccidentFree.value = diffDays;
        
        // Auto-update best record input if days is higher
        const currentBest = parseInt(inputBestRecord.value, 10) || 0;
        if (diffDays > currentBest) {
          inputBestRecord.value = diffDays;
        }
      }
    });
  }

  // Secret Logo Double-Click Trigger: reveals Update Data button
  if (isAdminMode && logoTrigger) {
    logoTrigger.addEventListener("dblclick", () => {
      if (btnSettings) {
        btnSettings.classList.toggle("hidden-admin");
        
        // Brief seal visual scale bump
        logoTrigger.style.transform = "scale(1.15)";
        setTimeout(() => {
          logoTrigger.style.transform = "scale(1)";
        }, 200);
      }
    });
  }

  // Open Drawer
  if (btnSettings) {
    btnSettings.addEventListener("click", () => {
      // Refresh calculations before opening to ensure input fields show exact state
      recalculateAccidentFreeDays();
      
      document.getElementById("input-accident-free").value = appState.accidentFree;
      document.getElementById("input-target-days").value = appState.targetDays;
      document.getElementById("input-best-record").value = appState.bestRecord;
      document.getElementById("input-last-date").value = appState.lastDate;
      
      const neverAccidentCheckbox = document.getElementById("input-never-accident");
      if (neverAccidentCheckbox) {
        neverAccidentCheckbox.checked = !!appState.neverAccident;
        toggleDateInputLabel(neverAccidentCheckbox.checked);
      }
      
      drawer.classList.add("open");
      overlay.classList.add("visible");
    });
  }

  const neverAccidentCheckbox = document.getElementById("input-never-accident");
  if (neverAccidentCheckbox) {
    neverAccidentCheckbox.addEventListener("change", function() {
      toggleDateInputLabel(this.checked);
    });
  }

  // Close Drawer
  const closeDrawer = () => {
    drawer.classList.remove("open");
    overlay.classList.remove("visible");
  };
  
  if (btnCloseSettings) btnCloseSettings.addEventListener("click", closeDrawer);
  if (overlay) overlay.addEventListener("click", closeDrawer);

  // Form Submit
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    // Only save the raw date, target and best record. Accident-free days is derived dynamically.
    appState.lastDate = document.getElementById("input-last-date").value;
    appState.targetDays = parseInt(document.getElementById("input-target-days").value, 10);
    appState.bestRecord = parseInt(document.getElementById("input-best-record").value, 10);
    
    const neverAccidentCheckbox = document.getElementById("input-never-accident");
    if (neverAccidentCheckbox) {
      appState.neverAccident = neverAccidentCheckbox.checked;
    }

    saveState();
    recalculateAccidentFreeDays();
    updateUI();
    closeDrawer();
  });

  // Reset Default Values
  btnReset.addEventListener("click", () => {
    if (confirm("คุณต้องการล้างข้อมูลเพื่อคืนค่าเริ่มต้นโรงงานใช่หรือไม่?")) {
      appState = { ...DEFAULT_STATE };
      saveState();
      recalculateAccidentFreeDays();
      updateUI();
      closeDrawer();
    }
  });

  // TV Mode Toggle
  btnTvMode.addEventListener("click", () => {
    document.body.classList.toggle("tv-mode");
    
    const isTvMode = document.body.classList.contains("tv-mode");
    const textSpan = btnTvMode.querySelector("span");
    
    if (isTvMode) {
      textSpan.textContent = "มุมมองปกติ (Standard View)";
      btnTvMode.classList.remove("btn-outline");
      btnTvMode.classList.add("btn-primary");
      
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn("Fullscreen activation rejected by browser:", err);
        });
      }
    } else {
      textSpan.textContent = "โหมดจอทีวี (TV Mode)";
      btnTvMode.classList.remove("btn-primary");
      btnTvMode.classList.add("btn-outline");
      
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen();
      }
    }
  });

  // Fullscreen Exit Event Listener
  document.addEventListener("fullscreenchange", () => {
    const isTvMode = document.body.classList.contains("tv-mode");
    if (!document.fullscreenElement && isTvMode) {
      document.body.classList.remove("tv-mode");
      const textSpan = btnTvMode.querySelector("span");
      textSpan.textContent = "โหมดจอทีวี (TV Mode)";
      btnTvMode.classList.remove("btn-primary");
      btnTvMode.classList.add("btn-outline");
    }
  });
}
