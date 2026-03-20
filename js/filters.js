/**
 * filters.js — Filter panel logic, drives map + chart updates
 */

let _allFires = [];
let _filterState = {
  startDate: '2025-07-01',
  endDate:   '2026-03-20',
  confidence: ['high', 'low'],
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

function initFilters(allFires, provincialGJ) {
  _allFires = allFires;
  populateProvinceDropdown(allFires, provincialGJ);
  populateLandCoverDropdown(allFires);

  // Date pickers
  const startEl = document.getElementById('filter-date-start');
  const endEl   = document.getElementById('filter-date-end');
  if (startEl) { startEl.value = _filterState.startDate; startEl.addEventListener('change', e => { _filterState.startDate = e.target.value; filterAndRender(); }); }
  if (endEl)   { endEl.value   = _filterState.endDate;   endEl.addEventListener('change', e => { _filterState.endDate   = e.target.value; filterAndRender(); }); }

  // Confidence checkboxes
  ['high', 'low'].forEach(c => {
    const cb = document.getElementById(`conf-${c}`);
    if (!cb) return;
    cb.checked = true;
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!_filterState.confidence.includes(c)) _filterState.confidence.push(c);
      } else {
        _filterState.confidence = _filterState.confidence.filter(x => x !== c);
      }
      filterAndRender();
    });
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
