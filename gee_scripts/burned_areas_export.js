/**
 * ============================================================
 * Zimbabwe Burn Scar Extraction — MODIS MCD64A1 v6.1
 * 2025/2026 Fire Season (July 2025 – March 2026)
 *
 * BUG FIX: Replaced ee.Feature(geom, {...}) with feat.set({...})
 *   The old approach caused "Expected Geometry, got Feature" errors
 *   because geometry().simplify() resolves as a Feature server-side.
 *   Using feat.simplify().set() keeps everything as Feature objects.
 *
 * HOW TO RUN:
 *   1. Paste into code.earthengine.google.com — click Run
 *   2. Check Console: should show polygon count > 0 with no errors
 *   3. Tasks panel → RUN → wait 10-30 min
 *   4. Download from Google Drive → FireWatch/burned_areas.geojson
 *   5. Replace data/burned_areas.geojson in your project folder
 * ============================================================
 */

// ── 1. Zimbabwe boundary ──────────────────────────────────────────
var zimbabwe = ee.FeatureCollection('FAO/GAUL_SIMPLIFIED_500m/2015/level1')
  .filter(ee.Filter.eq('ADM0_NAME', 'Zimbabwe'));

var provinces = ee.FeatureCollection('FAO/GAUL_SIMPLIFIED_500m/2015/level1')
  .filter(ee.Filter.eq('ADM0_NAME', 'Zimbabwe'));

// ── 2. MODIS MCD64A1 Burned Area ─────────────────────────────────
var mcd64 = ee.ImageCollection('MODIS/061/MCD64A1')
  .filterDate('2025-07-01', '2026-03-31')
  .filterBounds(zimbabwe.geometry())
  .select('BurnDate');

print('Monthly images found:', mcd64.size());

// ── 3. Process each month ─────────────────────────────────────────
var months = ee.List.sequence(7, 12).cat(ee.List.sequence(1, 3));

var allScars = ee.FeatureCollection(
  months.map(function(m) {
    m = ee.Number(m);

    // Year: Jul-Dec = 2025, Jan-Mar = 2026
    var yr     = ee.Number(ee.Algorithms.If(m.gte(7), 2025, 2026));
    var startM = ee.Date.fromYMD(yr, m, 1);
    var endM   = startM.advance(1, 'month');

    var monthImg = ee.Image(mcd64.filterDate(startM, endM).first());
    var hasImg   = mcd64.filterDate(startM, endM).size().gt(0);

    var vectors = ee.Algorithms.If(
      hasImg,

      // Vectorize burned pixels for this month
      monthImg.gt(0)
        .selfMask()
        .clip(zimbabwe.geometry())
        .reduceToVectors({
          geometry      : zimbabwe.geometry(),
          scale         : 500,
          geometryType  : 'polygon',
          eightConnected: true,
          tileScale     : 4,
          maxPixels     : 1e10,
          bestEffort    : true
        })
        // ── KEY FIX: use feat.set() NOT ee.Feature(geom, ...) ──────
        .map(function(feat) {

          // Median BurnDate within this polygon
          var doy = monthImg.reduceRegion({
            reducer   : ee.Reducer.median(),
            geometry  : feat.geometry(),   // .geometry() here is fine for reduceRegion
            scale     : 500,
            bestEffort: true
          }).get('BurnDate');

          var burnDate = ee.Date.fromYMD(yr, 1, 1)
            .advance(ee.Number(doy).subtract(1), 'day')
            .format('YYYY-MM-dd');

          // Area in hectares
          var area_ha = feat.geometry().area(100).divide(10000).round();

          // Province (centroid approach — use .geometry() explicitly)
          var centGeom = feat.centroid({maxError: 100}).geometry();
          var prov     = provinces.filterBounds(centGeom).first();
          var provName = ee.Algorithms.If(
            ee.Algorithms.IsEqual(prov, null),
            'Unknown',
            prov.get('ADM1_NAME')
          );

          // ✅ Use feat.simplify().set() — stays as Feature throughout
          return feat
            .simplify({maxError: 200})
            .set({
              'burn_date' : burnDate,
              'area_ha'   : area_ha,
              'month_str' : startM.format('MMM YYYY'),
              'province'  : provName,
              'source'    : 'MODIS MCD64A1 v6.1',
              'label'     : null   // drop the default 'label'/'burned' prop
            });
        })
        .filter(ee.Filter.gte('area_ha', 50)),   // drop tiny fragments < 50 ha

      ee.FeatureCollection([])   // empty if no image for this month
    );

    return ee.FeatureCollection(vectors);
  })
);

// Flatten monthly collections into one
var burnScars = allScars.flatten();

print('Total burn scar polygons (≥50 ha):', burnScars.size());
print('Sample feature:', burnScars.first());

// ── 4. Map preview ────────────────────────────────────────────────
Map.centerObject(zimbabwe.geometry(), 6);
Map.addLayer(zimbabwe, {color: '1565C0'}, 'Provinces', true, 0.6);
Map.addLayer(burnScars, {color: 'E64A19'}, 'Burn Scars (MODIS)', true, 0.75);

// ── 5. Export to Google Drive ─────────────────────────────────────
// No 'selectors' parameter — keeps geometry in GeoJSON output
Export.table.toDrive({
  collection    : burnScars,
  description   : 'Zimbabwe_BurnScars_2025_2026',
  folder        : 'FireWatch',
  fileNamePrefix: 'burned_areas',
  fileFormat    : 'GeoJSON'
});

print('');
print('✅ EXPORT QUEUED — go to Tasks panel and click RUN');
print('   Download: Google Drive → FireWatch → burned_areas.geojson');
print('   Replace:  data/burned_areas.geojson in your project');
