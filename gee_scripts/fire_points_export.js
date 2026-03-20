/**
 * fire_points_export.js
 * 
 * Purpose: Export real historical fire detections (NASA FIRMS) for Zimbabwe.
 * Instructions:
 * 1. Open Google Earth Engine Code Editor (code.earthengine.google.com).
 * 2. Paste this script.
 * 3. Click 'Run'.
 * 4. Go to the 'Tasks' tab and 'Run' the export.
 * 5. Download the 'real_fires_zimbabwe.geojson' from your Google Drive.
 * 6. Replace 'data/fires.geojson' in your project with this file.
 */

// 1. Define Area of Interest (Zimbabwe Provinces)
var provinces = ee.FeatureCollection('FAO/GAUL/2015/level1')
  .filter(ee.Filter.eq('ADM0_NAME', 'Zimbabwe'));

var geometry = provinces.geometry();

// 2. Load FIRMS Dataset (MODIS & VIIRS)
var dataset = ee.ImageCollection('FIRMS')
  .filterBounds(geometry)
  .filterDate('2025-06-01', '2026-03-20');

// 3. Convert ImageCollection to FeatureCollection (Point Detections)
var firePoints = dataset.map(function(img) {
  // Select a temperature band to identify fire pixels
  var t21 = img.select('T21');
  var mask = t21.gt(0); 
  
  // reduceToVectors requires an integer band as the first input to define groups
  // We use the mask itself cast to integer (1 = fire)
  var labeledImg = mask.toInt().rename('fire_label').addBands(img);
  
  return labeledImg.updateMask(mask).reduceToVectors({
    geometry: geometry,
    scale: 1000,
    geometryType: 'centroid',
    labelProperty: 'fire_label',
    reducer: ee.Reducer.first()
  });
}).flatten();

// 4. Spatial Join: Assign Province Name to Each Fire Point
var firePointsWithProvinces = firePoints.map(function(feature) {
  var point = feature.geometry();
  
  // Find which province contains this point
  var parentProv = provinces.filterBounds(point).first();
  var provName = ee.String(ee.Algorithms.If(parentProv, parentProv.get('ADM1_NAME'), 'UNKNOWN'));
  
  // Capture properties from the GEE image
  var confRaw = feature.get('confidence'); 
  var satellite = ee.String(feature.get('satellite'));
  
  // Use ee.Algorithms.ObjectType to safely check type on server-side
  var confType = ee.Algorithms.ObjectType(confRaw);
  
  var confStr = ee.String(ee.Algorithms.If(
    ee.Algorithms.IsEqual(confType, 'String'),
    // If it's a string (H/N/L)
    ee.Algorithms.If(ee.String(confRaw).equals('H'), 'high', 
      ee.Algorithms.If(ee.String(confRaw).equals('L'), 'low', 'nominal')),
    // If it's a number (0-2 for VIIRS, 0-100 for MODIS)
    // Robust check for VIIRS platforms (Suomi NPP, NOAA-20, NOAA-21)
    ee.Algorithms.If(
      ee.Filter.or(
        ee.Filter.stringContains('satellite', 'VIIRS'),
        ee.Filter.stringContains('satellite', 'Suomi'),
        ee.Filter.stringContains('satellite', 'NOAA')
      ).apply(feature),
      ee.Algorithms.If(ee.Number(confRaw).eq(2), 'high', 
        ee.Algorithms.If(ee.Number(confRaw).eq(0), 'low', 'nominal')),
      ee.Algorithms.If(ee.Number(confRaw).gte(80), 'high',
        ee.Algorithms.If(ee.Number(confRaw).lt(40), 'low', 'nominal'))
    )
  ));

  return ee.Feature(point, {
    'province': provName,
    'confidence': confStr,
    'datetime': ee.Date(feature.get('system:time_start')).format("YYYY-MM-dd'T'HH:mm:ss'Z'"),
    'satellite': feature.get('satellite'),
    'frp': feature.get('frp')
  });
});

// 5. Export to Google Drive
Export.table.toDrive({
  collection: firePointsWithProvinces,
  description: 'fire_points_export_zimbabwe',
  fileFormat: 'GeoJSON',
  fileNamePrefix: 'real_fires_zimbabwe'
});

print('Processing ' + firePointsWithProvinces.size().getInfo() + ' potential fire detections...');
Map.centerObject(geometry, 6);
Map.addLayer(firePointsWithProvinces.draw({color: 'red', pointRadius: 1}), {}, 'Fire Detections');
