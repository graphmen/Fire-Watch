/**
 * app.js — Entry point: loads all data, initialises all modules
 */

// ── Toast system (global) ────────────────────────────────────
window.showToast = function(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', danger: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '🔔'}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.4s ease forwards';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
};

// ── Clock ────────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('topbar-clock');
  if (!el) return;
  function tick() {
    el.textContent = new Date().toLocaleString('en-ZW', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }) + ' CAT';
  }
  tick();
  setInterval(tick, 1000);
}

// -- Sidebar / panel: mobile drawer + desktop collapse
function initSidebarToggle() {
  const sidebar  = document.getElementById('sidebar');
  const panel    = document.getElementById('analytics-panel');
  const btnLeft  = document.getElementById('btn-toggle-sidebar');
  const btnRight = document.getElementById('btn-toggle-panel');

  // Inject backdrop element for mobile drawers
  let backdrop = document.getElementById('mobile-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'mobile-backdrop';
    backdrop.className = 'mobile-backdrop';
    document.body.appendChild(backdrop);
  }

  const isMobileLeft  = () => window.innerWidth <= 700;
  const isMobileRight = () => window.innerWidth <= 900;
  const showBackdrop  = () => backdrop.classList.add('visible');
  const hideBackdrop  = () => backdrop.classList.remove('visible');

  function openSidebar() {
    if (isMobileLeft()) {
      sidebar.classList.add('open');
      panel.classList.remove('open');
      showBackdrop();
    } else {
      sidebar.classList.remove('collapsed');
    }
  }
  function closeSidebar() {
    if (isMobileLeft()) sidebar.classList.remove('open');
    else sidebar.classList.add('collapsed');
  }
  function sidebarIsOpen() {
    return isMobileLeft() ? sidebar.classList.contains('open')
                          : !sidebar.classList.contains('collapsed');
  }

  function openPanel() {
    if (isMobileRight()) {
      panel.classList.add('open');
      sidebar.classList.remove('open');
      showBackdrop();
    } else {
      panel.classList.remove('collapsed');
      setTimeout(() => MapModule.map.invalidateSize(), 320);
    }
  }
  function closePanel() {
    if (isMobileRight()) panel.classList.remove('open');
    else panel.classList.add('collapsed');
  }
  function panelIsOpen() {
    return isMobileRight() ? panel.classList.contains('open')
                           : !panel.classList.contains('collapsed');
  }

  // Left sidebar toggle
  btnLeft?.addEventListener('click', () => {
    if (sidebarIsOpen()) { closeSidebar(); hideBackdrop(); }
    else openSidebar();
    btnLeft.classList.toggle('active', sidebarIsOpen());
  });

  // Right analytics panel toggle
  btnRight?.addEventListener('click', () => {
    if (panelIsOpen()) { closePanel(); hideBackdrop(); }
    else openPanel();
    btnRight.classList.toggle('active', panelIsOpen());
  });

  // Backdrop tap closes whichever drawer is open
  backdrop.addEventListener('click', () => {
    closeSidebar(); closePanel(); hideBackdrop();
    btnLeft?.classList.remove('active');
    btnRight?.classList.remove('active');
  });

  // On resize: reset mobile-only classes when screen grows to desktop
  window.addEventListener('resize', () => {
    if (!isMobileLeft()) sidebar.classList.remove('open');
    if (!isMobileRight()) panel.classList.remove('open');
    if (!isMobileLeft() && !isMobileRight()) hideBackdrop();
  });
}

// ── Section accordion ────────────────────────────────────────
function initAccordions() {
  document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const arrow   = header.querySelector('.section-toggle');
      if (content) {
        const isOpen = content.style.display !== 'none';
        content.style.display = isOpen ? 'none' : '';
        if (arrow) arrow.classList.toggle('open', !isOpen);
      }
    });
  });
}

// ── Panel tabs ───────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const group = tab.closest('.panel-tabs');
      const panel = tab.closest('.analytics-panel') || tab.closest('.panel-body');

      group.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.toggle('active', c.id === `tab-${target}`);
      });
    });
  });
}

// ── Basemap (positioned top-right of map) ───────────────────
function positionBasemapSwitcher() {
  // Already in DOM, positioned via CSS
}

// ── Lazy ward loader (28MB file — only fetch on first toggle) ────────
let _wardsLoaded = false;
let _wardsLoading = false;

function initWardsToggle() {
  const btn = document.getElementById('toggle-wards');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const isNowOn = btn.classList.contains('on');
    if (!isNowOn || _wardsLoaded || _wardsLoading) return;

    // First time turning on — fetch the large file
    _wardsLoading = true;
    btn.style.opacity = '0.6';
    btn.title = 'Loading wards…';

    try {
      const resp = await fetch('data/Wards.geojson');
      const gj   = await resp.json();
      MapModule.renderWards(gj);
      _wardsLoaded = true;
      showToast('📍 Wards Loaded', `${gj.features.length} ward boundaries rendered`, 'success');
    } catch (e) {
      console.error('Ward load error:', e);
      showToast('Ward Error', 'Could not load Wards.geojson', 'danger');
    } finally {
      _wardsLoading = false;
      btn.style.opacity = '';
      btn.title = '';
    }
  }, { capture: true });  // capture phase so we intercept before MapModule toggle
}

// ── Main loader ──────────────────────────────────────────────
async function loadData() {
  showLoader(true);
  try {
    const [firesResp, burnedResp, provResp, parksResp, distResp] = await Promise.all([
      fetch('data/fires.geojson'),
      fetch('data/burned_areas.geojson'),
      fetch('data/Provincial.geojson'),
      fetch('data/pparks.geojson'),
      fetch('data/District.geojson')
    ]);

    const [firesGJ, burnedGJ, provGJ, parksGJ, distGJ] = await Promise.all([
      firesResp.json(), burnedResp.json(), provResp.json(), parksResp.json(), distResp.json()
    ]);

    // Render static boundary layers (real boundaries from user's files)
    MapModule.renderProvinces(provGJ);
    MapModule.renderDistricts(distGJ);
    MapModule.renderParks(parksGJ);
    MapModule.renderBurnedAreas(burnedGJ.features);

    // Handle Live NASA FIRMS data if MapKey exists
    const savedKey = localStorage.getItem('firms_map_key');
    if (savedKey) {
      document.getElementById('firms-key').value = savedKey;
      MapModule.updateFirmsWMS(savedKey);
      
      try {
        const liveFires = await FirmsModule.fetchLiveFires(savedKey);
        if (liveFires.length > 0) {
          // Merge live fires into the main dataset and re-process filters/charts
          firesGJ.features.push(...liveFires);
          showToast('📡 Live Sync', `${liveFires.length} real-time FIRMS detections added`, 'info');
        }
      } catch (e) {
        console.warn('NASA FIRMS Live fetch failed:', e);
      }
    }

    // Dynamic Date Range Detection for historical data
    let minDate = '2025-06-01';
    let maxDate = new Date().toISOString().split('T')[0];
    
    if (firesGJ.features.length > 0) {
      const dates = firesGJ.features.map(f => new Date(f.properties.datetime)).filter(d => !isNaN(d));
      if (dates.length > 0) {
        minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
        maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
      }
    }

    // Init modules with dynamic range
    FiltersModule.initFilters(firesGJ.features, provGJ);
    TimeSliderModule.setTimeRange(minDate, maxDate);
    TimeSliderModule.initTimeSlider();

    // Init charts
    ChartsModule.initWeeklyChart(firesGJ.features);
    ChartsModule.initBurnedChart(burnedGJ.features);
    ChartsModule.initConfChart(firesGJ.features);
    ChartsModule.initHistoricalTrendChart();

    // Setup layer toggles (fires/burned/admin/districts/wards/parks)
    MapModule.setupLayerToggles();

    // Setup Historical Burnt Year Dropdown
    initHistoricalYearDropdown();

    // Wards are loaded lazily on first toggle-on
    initWardsToggle();
    initFirmsKey();

    // Export CSV
    document.getElementById('btn-export-csv')?.addEventListener('click', ChartsModule.exportCSV);
    document.getElementById('btn-export-pdf')?.addEventListener('click', () =>
      showToast('PDF Export', 'PDF generation would be triggered via server-side render', 'info')
    );

    showToast('🛡 Data Loaded',
      `${firesGJ.features.length} fires • ${provGJ.features.length} provinces • ${distGJ.features.length} districts • 1,970 wards (toggle to load)`,
      'success');
  } catch (err) {
    console.error('Data load error:', err);
    showToast('Load Error', 'Could not load GeoJSON data. Ensure you serve via a local web server.', 'danger');
  } finally {
    showLoader(false);
  }
}

function initFirmsKey() {
  const btn = document.getElementById('btn-save-key');
  const input = document.getElementById('firms-key');
  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    const key = input.value.trim();
    if (key) {
      localStorage.setItem('firms_map_key', key);
      showToast('Key Saved', 'MapKey configured. Enable a LIVE layer to test.', 'success');
      MapModule.updateFirmsWMS(key);
    } else {
      localStorage.removeItem('firms_map_key');
      MapModule.updateFirmsWMS(null);
      showToast('Key Removed', 'NASA FIRMS Live feeds disabled.', 'info');
    }
  });
}

function initHistoricalYearDropdown() {
  const select = document.getElementById('filter-historical-year');
  if (!select) return;

  // Populate years 2024 down to 2001
  for (let y = 2024; y >= 2001; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    select.appendChild(opt);
  }

  // Listen for changes
  select.addEventListener('change', (e) => {
    const year = e.target.value;
    MapModule.loadHistoricalBurntYear(year);
  });
}

function showLoader(on) {
  const el = document.getElementById('map-loader');
  if (el) el.style.display = on ? 'flex' : 'none';
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  initSidebarToggle();
  initAccordions();
  initTabs();
  AlertsModule.initAlerts();
  loadData();
});
