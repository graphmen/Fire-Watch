/**
 * filters.js — Filter panel logic, drives map + chart updates
 */

let _allFires = [];
let _filterState = {
  startDate: '', // Will be set dynamically
  endDate:   '', // Will be set dynamically
  confidence: ['high', 'nominal', 'low'],
  province: 'all',
  landcover: 'all',
  nearPark: false
};

// Populate province dropdown from Provincial.geojson (province_n) or fire data fallback
function populateProvinceDropdown(fires, provincialGJ) {
  let provinces;
  if (provincialGJ && provincialGJ.features) {
    provinces = provincialGJ.features
      .map(f => f.properties.province_n)
      .filter(Boolean)
      .map(n => n.toUpperCase())
      .sort();
  } else {
    // Fallback: derive from fire data
    provinces = [...new Set(fires.map(f => f.properties.province))].sort();
  }
  const sel = document.getElementById('filter-province');
  if (!sel) return;
  sel.innerHTML = '<option value="all">All Provinces</option>';
  provinces.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  });
}

// Populate land cover dropdown
function populateLandCoverDropdown(fires) {
  const covers = [...new Set(fires.map(f => f.properties.landcover))].sort();
  const sel = document.getElementById('filter-landcover');
  if (!sel) return;
  sel.innerHTML = '<option value="all">All Land Cover</option>';
  covers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

// Main filter function
function filterFires() {
  return _allFires.filter(f => {
    const p = f.properties;
    const dt = new Date(p.datetime);
    const start = new Date(_filterState.startDate);
    const end   = new Date(_filterState.endDate + 'T23:59:59Z');

    if (dt < start || dt > end) return false;

    // Handle Confidence Filter with raw value normalization
    const conf = (p.confidence || '').toString().toLowerCase();
    let normalizedConf = 'nominal'; // Default for anything not high/low

    // Handle raw FIRMS values (H/N/L) or numeric (0-100)
    if (conf === 'high' || conf === 'h' || (parseInt(conf) >= 80)) {
      normalizedConf = 'high';
    } else if (conf === 'low' || conf === 'l' || (parseInt(conf) > 0 && parseInt(conf) <= 30)) {
      normalizedConf = 'low';
    }

    if (!_filterState.confidence.includes(normalizedConf)) return false;

    if (_filterState.province !== 'all') {
      const p1 = (p.province || '').toUpperCase();
      const p2 = _filterState.province.toUpperCase();
      if (p1 !== p2) return false;
    }
    if (_filterState.landcover !== 'all' && p.landcover !== _filterState.landcover) return false;
    if (_filterState.nearPark && p.near_park === 'none') return false;
    return true;
  });
}

function filterAndRender() {
  const filtered = filterFires();
  MapModule.renderFires(filtered);
  ChartsModule.update(filtered);
  updateFilterBadge(filtered.length);
}

function updateFilterBadge(count) {
  const el = document.getElementById('filter-badge');
  if (el) el.textContent = count + ' fires';
}

// Initialize Filter Module
function initFilters(fires, provincialGJ) {
  _allFires = fires;
  populateProvinceDropdown(fires, provincialGJ);
  populateLandCoverDropdown(fires);

  // Dynamic Date Range Detection
  if (fires.length > 0) {
    const dates = fires.map(f => new Date(f.properties.datetime)).filter(d => !isNaN(d));
    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      
      _filterState.startDate = minDate.toISOString().split('T')[0];
      _filterState.endDate   = maxDate.toISOString().split('T')[0];

      // Update UI inputs
      // Note: The IDs in the HTML should be 'filter-start-date' and 'filter-end-date'
      // if they are different from 'filter-date-start' and 'filter-date-end'
      const startEl = document.getElementById('filter-date-start') || document.getElementById('filter-start-date');
      const endEl   = document.getElementById('filter-date-end')   || document.getElementById('filter-end-date');
      if (startEl) startEl.value = _filterState.startDate;
      if (endEl)   endEl.value   = _filterState.endDate;
    }
  }

  setupEventListeners();
  filterAndRender(); // Initial render after setup
}

function setupEventListeners() {
  // Date pickers
  const startEl = document.getElementById('filter-date-start');
  const endEl   = document.getElementById('filter-date-end');
  if (startEl) { startEl.addEventListener('change', e => { _filterState.startDate = e.target.value; filterAndRender(); }); }
  if (endEl)   { endEl.addEventListener('change', e => { _filterState.endDate   = e.target.value; filterAndRender(); }); }

  // Confidence checkboxes
  ['high', 'nominal', 'low'].forEach(c => {
    const el = document.getElementById(`conf-${c}`);
    if (el) {
      el.checked = _filterState.confidence.includes(c);
      el.addEventListener('change', () => {
        if (el.checked) {
          if (!_filterState.confidence.includes(c)) _filterState.confidence.push(c);
        } else {
          _filterState.confidence = _filterState.confidence.filter(x => x !== c);
        }
        filterAndRender();
      });
    }
  });

  // Province dropdown
  const provSel = document.getElementById('filter-province');
  if (provSel) provSel.addEventListener('change', e => { _filterState.province = e.target.value; filterAndRender(); });

  // Land cover dropdown
  const lcSel = document.getElementById('filter-landcover');
  if (lcSel) lcSel.addEventListener('change', e => { _filterState.landcover = e.target.value; filterAndRender(); });

  // Protected area toggle
  const parkCb = document.getElementById('filter-near-park');
  if (parkCb) parkCb.addEventListener('change', e => { _filterState.nearPark = e.target.checked; filterAndRender(); });

  // Reset button
  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) resetBtn.addEventListener('click', resetFilters);

  // Satellite filter
  ['VIIRS','MODIS'].forEach(sat => {
    const cb = document.getElementById(`sat-${sat}`);
    if (!cb) return;
    cb.checked = true;
  });

  filterAndRender();
}

function resetFilters() {
  _filterState = { startDate:'2025-07-01', endDate:'2026-03-20', confidence:['high','low'], province:'all', landcover:'all', nearPark:false };
  document.getElementById('filter-date-start').value = _filterState.startDate;
  document.getElementById('filter-date-end').value   = _filterState.endDate;
  ['high','low'].forEach(c => { const cb = document.getElementById(`conf-${c}`); if (cb) cb.checked = true; });
  document.getElementById('filter-province').value  = 'all';
  document.getElementById('filter-landcover').value = 'all';
  const pk = document.getElementById('filter-near-park'); if (pk) pk.checked = false;
  TimeSliderModule.reset();
  filterAndRender();
  showToast('Filters reset', 'All filters cleared', 'info');
}

// Expose
window.FiltersModule = { initFilters, filterFires, filterAndRender, getState: () => _filterState, getAllFires: () => _allFires };
