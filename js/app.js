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

// ── Sidebar collapse ─────────────────────────────────────────
function initSidebarToggle() {
  const sidebar  = document.getElementById('sidebar');
  const panel    = document.getElementById('analytics-panel');
  const btnLeft  = document.getElementById('btn-toggle-sidebar');
  const btnRight = document.getElementById('btn-toggle-panel');

  btnLeft?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    btnLeft.classList.toggle('active');
  });
  btnRight?.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    btnRight.classList.toggle('active');
    // Trigger Leaflet map resize
    setTimeout(() => MapModule.map.invalidateSize(), 320);
  });

  // Mobile toggles
  btnLeft?.addEventListener('dblclick', () => {
    sidebar.classList.toggle('open');
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
      fetch('data/parks.geojson'),
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

    // Init filter module — pass provincial GeoJSON for dropdown
    FiltersModule.initFilters(firesGJ.features, provGJ);
    TimeSliderModule.initTimeSlider();

    // Init charts
    ChartsModule.initWeeklyChart(firesGJ.features);
    ChartsModule.initBurnedChart(burnedGJ.features);
    ChartsModule.initConfChart(firesGJ.features);

    // Setup layer toggles (fires/burned/admin/districts/wards/parks)
    MapModule.setupLayerToggles();

    // Wards are loaded lazily on first toggle-on
    initWardsToggle();

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
