/**
 * map.js — Leaflet map initialisation, layer management, rendering
 */

const BASE_LAYERS = {
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org">OpenStreetMap</a> contributors',
    maxZoom: 18
  }),
  light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    maxZoom: 18
  }),
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri — Esri, i-cubed, USDA, USGS',
    maxZoom: 17
  })
};

// ── Map initialisation ────────────────────────────────────────
const map = L.map('map', {
  center: [-19.0, 29.8],
  zoom: 6,
  zoomControl: true,
  layers: [BASE_LAYERS.light]
});

// ── Layer groups ────────────────────────────────────────────
const fireLayer      = L.layerGroup().addTo(map);
const burnedLayer    = L.layerGroup().addTo(map);
const adminLayer     = L.layerGroup().addTo(map);
const districtsLayer = L.layerGroup();   // off by default
const wardsLayer     = L.layerGroup();   // off by default (large dataset)
const parksLayer     = L.layerGroup().addTo(map);

// Canvas renderer for large polygon layers (wards = 1970 features)
const canvasRenderer = L.canvas({ padding: 0.5 });

// ── Basemap switcher ──────────────────────────────────────────
let currentBase = 'light';
function switchBasemap(name) {
  Object.values(BASE_LAYERS).forEach(l => { if (map.hasLayer(l)) map.removeLayer(l); });
  BASE_LAYERS[name].addTo(map);
  BASE_LAYERS[name].bringToBack();
  currentBase = name;
  document.querySelectorAll('.basemap-btn').forEach(b => b.classList.toggle('active', b.dataset.base === name));
}

document.querySelectorAll('.basemap-btn').forEach(btn => {
  btn.addEventListener('click', () => switchBasemap(btn.dataset.base));
});

// ── Province layer (Provincial.geojson — province_n field) ───────────
function renderProvinces(geojson) {
  adminLayer.clearLayers();
  L.geoJSON(geojson, {
    style: {
      color: '#1565C0',
      weight: 2.0,
      fillOpacity: 0.03,
      fillColor: '#1565C0',
      dashArray: '6, 4'
    },
    onEachFeature(feature, layer) {
      const p = feature.properties;
      // province_n is stored in ALL CAPS in the file
      const name = p.province_n
        ? p.province_n.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')
        : 'Unknown';
      const pop = p.population ? (p.population / 1e6).toFixed(2) + 'M' : 'N/A';
      layer.bindTooltip(`<b style="color:#1565C0">${name}</b><br>
        <span style="font-size:10px;color:#556;">Population: ${pop}</span>`,
        { sticky: true, opacity: 0.92 });
      layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.10, weight: 2.8 }));
      layer.on('mouseout',  () => layer.setStyle({ fillOpacity: 0.03, weight: 2.0 }));
    }
  }).addTo(adminLayer);
}

// ── District layer (District.geojson — district_n, province fields) ─────
function renderDistricts(geojson) {
  districtsLayer.clearLayers();
  L.geoJSON(geojson, {
    style: {
      color: '#5C6BC0',
      weight: 1.0,
      fillOpacity: 0.0,
      fillColor: '#5C6BC0',
      dashArray: '3, 5'
    },
    onEachFeature(feature, layer) {
      const p = feature.properties;
      const dname = p.district_n
        ? p.district_n.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')
        : 'Unknown';
      const pname = p.province
        ? p.province.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')
        : '';
      const pop = p.population ? Number(p.population).toLocaleString() : 'N/A';
      layer.bindTooltip(`<b>${dname} District</b><br>
        <span style="font-size:10px;color:#556;">Province: ${pname}<br>Population: ${pop}</span>`,
        { sticky: true, opacity: 0.92 });
      layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.06, weight: 1.5 }));
      layer.on('mouseout',  () => layer.setStyle({ fillOpacity: 0.0,  weight: 1.0 }));
    }
  }).addTo(districtsLayer);
}

// ── Ward layer (Wards.geojson — district, province, wardnumber) ────────
function renderWards(geojson) {
  wardsLayer.clearLayers();
  // Use canvas renderer for 1,970 polygons to maintain performance
  L.geoJSON(geojson, {
    renderer: canvasRenderer,
    style: {
      color: '#9575CD',        // purple outline
      weight: 0.6,
      fillOpacity: 0.0,
      fillColor: '#9575CD',
      dashArray: '2, 4'
    },
    onEachFeature(feature, layer) {
      const p = feature.properties;
      const dname = (p.district || '').split(' ')
        .map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
      const pname = (p.province || '').split(' ')
        .map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
      const la = (p.local_auth || '').split(' ')
        .map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
      layer.bindTooltip(
        `<b>Ward ${p.wardnumber}</b><br>
         <span style="font-size:10px;color:#556;">
           District: ${dname}<br>
           Province: ${pname}<br>
           Local Auth: ${la}
         </span>`,
        { sticky: true, opacity: 0.92 }
      );
      layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.08, weight: 1.2 }));
      layer.on('mouseout',  () => layer.setStyle({ fillOpacity: 0.0,  weight: 0.6 }));
    }
  }).addTo(wardsLayer);
}

function renderParks(geojson) {
  parksLayer.clearLayers();
  L.geoJSON(geojson, {
    style: {
      color: '#2E7D32',
      weight: 2.2,
      fillOpacity: 0.10,
      fillColor: '#2E7D32',
      dashArray: null
    },
    onEachFeature(feature, layer) {
      const p = feature.properties;
      layer.bindTooltip(`🌿 <b>${p.NAME_ENG || p.NAME}</b><br><span style="font-size:10px">${p.DESIG_ENG} &bull; ${p.GIS_AREA ? p.GIS_AREA.toFixed(0) + " ha" : ""} &bull; IUCN: ${p.IUCN_CAT}</span>`, {
        sticky: true, opacity: 0.92
      });
    }
  }).addTo(parksLayer);
}

// ── Burned areas layer ──────────────────────────────────────
function renderBurnedAreas(geojson) {
  burnedLayer.clearLayers();
  L.geoJSON(geojson, {
    style(feature) {
      const age = daysSinceBurn(feature.properties.burn_date);
      // Recent burns = darker orange-red; older = amber/yellow
      const hue = Math.min(45, age / 4);       // 0 = red, 45 = amber
      const opacity = Math.max(0.18, 0.58 - age / 280);
      return {
        color: `hsl(${hue}, 90%, 42%)`,
        weight: 1.5,
        fillColor: `hsl(${hue}, 85%, 52%)`,
        fillOpacity: opacity
      };
    },
    onEachFeature(feature, layer) {
      const p = feature.properties;
      const bdate = p.burn_date || 'Unknown';
      const bmonth = p.month_str || '';
      
      layer.bindPopup(`
        <div class="fire-popup">
          <h4 style="color:var(--burn-orange)">🔥 Burn Scar — ${bmonth}</h4>
          <div class="meta">📍 ${p.province}</div>
          <div class="meta">📅 Burn Date: <b>${bdate}</b></div>
          <div class="meta">📐 Area: <b>${p.area_ha.toLocaleString()} ha</b></div>
          <div class="meta" style="font-size:9px; color:var(--text-muted); margin-top:5px;">Source: ${p.source}</div>
        </div>
      `);
    }
  }).addTo(burnedLayer);
}

function daysSinceBurn(dateStr) {
  if (!dateStr) return 999;
  try {
    const burn = new Date(dateStr);
    const now  = new Date(); // Use actual now
    const diff = now - burn;
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  } catch(e) { return 999; }
}
// ── Fire points layer (EMA Red/Yellow scheme) ───────────────
function renderFires(features) {
  fireLayer.clearLayers();
  features.forEach(f => {
    const p = f.properties;
    const isHigh = p.confidence === 'high';
    // EMA scheme: RED for high confidence, AMBER/YELLOW for low confidence
    const fillColor  = isHigh ? '#D32F2F' : '#F9A825';
    const strokeColor = isHigh ? '#B71C1C' : '#E65100';
    const radius = isHigh ? 7 : 5;

    const circle = L.circleMarker(
      [f.geometry.coordinates[1], f.geometry.coordinates[0]],
      {
        radius,
        color: strokeColor,
        weight: 1.5,
        fillColor,
        fillOpacity: 0.90
      }
    );

    const parkBadge = p.near_park !== 'none'
      ? `<span class="badge" style="background:#E8F5E9;color:#2E7D32;border:1px solid #A5D6A7;margin-top:6px;display:inline-block;">⚠ Near ${p.near_park}</span>`
      : '';

    circle.bindPopup(`
      <div class="fire-popup">
        <h4>🔥 Fire Detection — ${p.id}</h4>
        <div class="meta">📡 Satellite: <b>${p.satellite}</b></div>
        <div class="meta">📅 ${formatDate(p.datetime)}</div>
        <div class="meta">📍 ${p.province}</div>
        <div class="meta">🌿 Land cover: ${p.landcover}</div>
        <div class="meta">⚡ FRP: <b>${p.frp} MW</b></div>
        <span class="badge" style="background:${isHigh ? 'rgba(211,47,47,0.12)' : 'rgba(249,168,37,0.15)'};color:${isHigh ? '#C62828' : '#E65100'};">
          ${isHigh ? '🔴' : '🟡'} ${p.confidence.toUpperCase()} Confidence
        </span>
        ${parkBadge}
      </div>
    `);

    circle.addTo(fireLayer);
  });

  updateFireCount(features.length);
}

function formatDate(isoStr) {
  return new Date(isoStr).toLocaleString('en-ZW', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ── Layer visibility toggles ─────────────────────────────────
function setupLayerToggles() {
  const toggleDefs = [
    { id: 'toggle-fires',     layer: fireLayer,      key: 'fires' },
    { id: 'toggle-burned',    layer: burnedLayer,    key: 'burned' },
    { id: 'toggle-admin',     layer: adminLayer,     key: 'admin' },
    { id: 'toggle-districts', layer: districtsLayer, key: 'districts' },
    { id: 'toggle-wards',     layer: wardsLayer,     key: 'wards' },
    { id: 'toggle-parks',     layer: parksLayer,     key: 'parks' }
  ];
  toggleDefs.forEach(({ id, layer }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => {
      const isOn = el.classList.toggle('on');
      if (isOn) {
        if (!map.hasLayer(layer)) map.addLayer(layer);
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      }
    });
  });
}

function updateFireCount(n) {
  const el = document.getElementById('active-fire-count');
  if (el) el.textContent = n;
}

// ── Scale / attribution positioning fix ─────────────────────
L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

// Expose globally
window.MapModule = { map, renderFires, renderBurnedAreas, renderProvinces, renderDistricts, renderWards, renderParks, setupLayerToggles };
