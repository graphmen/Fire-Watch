/**
 * firms.js — NASA FIRMS API & WMS utilities
 */

const FIRMS_BBOX = '25.2,-22.4,33.1,-15.6'; // Zimbabwe approx bounding box

const FIRMS_URLS = {
  WMS_BASE: 'https://firms.modaps.eosdis.nasa.gov/mapserver/wms/time_since_detection_4',
  REST_BASE: 'https://firms.modaps.eosdis.nasa.gov/api/area/csv'
};

/**
 * Get WMS Layer URL
 */
function getWmsUrl(layer, key) {
  if (!key) return null;
  // Format: BASE_URL / MAP_KEY / LAYER_NAME / ?...
  return `${FIRMS_URLS.WMS_BASE}/${key}/${layer}/`;
}

/**
 * Fetch live fire data for the last N days
 */
async function fetchLiveFires(key, days = 1) {
  if (!key) throw new Error('NASA MapKey is required for live data');

  // Sources to fetch
  const sources = ['VIIRS_SNPP_NRT', 'MODIS_NRT'];
  const allFeatures = [];

  for (const src of sources) {
    try {
      const url = `${FIRMS_URLS.REST_BASE}/${key}/${src}/${FIRMS_BBOX}/${days}`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      
      const csv = await resp.text();
      const features = parseFirmsCSV(csv, src);
      allFeatures.push(...features);
    } catch (e) {
      console.error(`Error fetching FIRMS ${src}:`, e);
    }
  }

  return allFeatures;
}

/**
 * Parse FIRMS CSV to GeoJSON-like features
 * Columns: latitude, longitude, bright_ti4, scan, track, acq_date, acq_time, satellite, instrument, confidence, version, bright_ti5, frp, daynight
 */
function parseFirmsCSV(csv, source) {
  const lines = csv.trim().split('\n');
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',');
  const features = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i].split(',');
    if (raw.length < headers.length) continue;

    const data = {};
    headers.forEach((h, idx) => data[h] = raw[idx]);

    // Construct common properties to match our internal fires.geojson
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(data.longitude), parseFloat(data.latitude)]
      },
      properties: {
        id: `FIRMS_${source}_${i}`,
        datetime: `${data.acq_date}T${data.acq_time.padStart(4,'0').replace(/(..)(..)/, '$1:$2:00Z')}`,
        confidence: translateConfidence(data.confidence, source),
        satellite: data.satellite || source.split('_')[0],
        frp: parseFloat(data.frp) || 0,
        province: 'LIVE_NASA_FIRMS', // Will be enriched on client if needed
        isLive: true,
        source: source
      }
    });
  }

  return features;
}

function translateConfidence(conf, source) {
  if (source.includes('VIIRS')) {
    // VIIRS uses n (nominal), h (high), l (low)
    if (conf === 'h') return 'high';
    if (conf === 'l') return 'low';
    return 'nominal';
  } else {
    // MODIS uses 0-100
    const val = parseInt(conf);
    if (val >= 80) return 'high';
    if (val <= 30) return 'low';
    return 'nominal';
  }
}

window.FirmsModule = { getWmsUrl, fetchLiveFires };
