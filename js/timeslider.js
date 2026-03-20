/**
 * timeslider.js — Seasonal time slider + animation playback
 */

const SEASON_START = new Date('2025-07-01');
const SEASON_END   = new Date('2026-03-20');
const TOTAL_DAYS   = Math.floor((SEASON_END - SEASON_START) / 86400000);

let _currentDay  = TOTAL_DAYS;
let _animTimer   = null;
let _isPlaying   = false;

function dayToDate(day) {
  const d = new Date(SEASON_START);
  d.setDate(d.getDate() + day);
  return d;
}

function formatSliderDate(d) {
  return d.toLocaleDateString('en-ZW', { day: '2-digit', month: 'short', year: 'numeric' });
}

function updateSliderUI(day) {
  const slider = document.getElementById('map-time-slider');
  if (slider) {
    slider.value = day;
    const pct = (day / TOTAL_DAYS * 100).toFixed(1);
    slider.style.setProperty('--pct', pct + '%');
  }

  const dateEl = document.getElementById('scrubber-date');
  const date = dayToDate(day);
  if (dateEl) dateEl.textContent = formatSliderDate(date);

  const sideEl = document.getElementById('sidebar-slider-value');
  if (sideEl) sideEl.textContent = formatSliderDate(date);
}

function applySliderDay(day) {
  _currentDay = day;
  const cutoff = dayToDate(day);
  const isoStr = cutoff.toISOString();

  // Filter fires to show only those up to this date
  const all = FiltersModule.getAllFires();
  const state = FiltersModule.getState();

  const filtered = all.filter(f => {
    const p = f.properties;
    const dt = new Date(p.datetime);
    if (dt > cutoff) return false;
    if (!state.confidence.includes(p.confidence)) return false;
    if (state.province !== 'all' && p.province !== state.province) return false;
    if (state.landcover !== 'all' && p.landcover !== state.landcover) return false;
    if (state.nearPark && p.near_park === 'none') return false;
    return true;
  });

  MapModule.renderFires(filtered);
  ChartsModule.update(filtered);
  updateSliderUI(day);
}

function play() {
  if (_isPlaying) return;
  _isPlaying = true;
  const playBtn = document.getElementById('btn-play-slider');
  if (playBtn) { playBtn.textContent = '⏸ Pause'; }

  // Start from beginning if at end
  if (_currentDay >= TOTAL_DAYS) _currentDay = 0;

  _animTimer = setInterval(() => {
    _currentDay += 7;
    if (_currentDay >= TOTAL_DAYS) {
      _currentDay = TOTAL_DAYS;
      pause();
    }
    applySliderDay(_currentDay);
  }, 250);
}

function pause() {
  _isPlaying = false;
  clearInterval(_animTimer);
  const playBtn = document.getElementById('btn-play-slider');
  if (playBtn) { playBtn.textContent = '▶ Play'; }
}

function reset() {
  pause();
  _currentDay = TOTAL_DAYS;
  updateSliderUI(_currentDay);
}

function initTimeSlider() {
  const slider = document.getElementById('map-time-slider');
  if (!slider) return;

  slider.min  = 0;
  slider.max  = TOTAL_DAYS;
  slider.value = TOTAL_DAYS;
  updateSliderUI(TOTAL_DAYS);

  slider.addEventListener('input', () => {
    if (_isPlaying) pause();
    applySliderDay(parseInt(slider.value));
  });

  const playBtn = document.getElementById('btn-play-slider');
  if (playBtn) playBtn.addEventListener('click', () => _isPlaying ? pause() : play());

  const resetBtn = document.getElementById('btn-reset-slider');
  if (resetBtn) resetBtn.addEventListener('click', reset);

  // Sidebar slider (mirrors map scrubber)
  const sideSlider = document.getElementById('sidebar-time-slider');
  if (sideSlider) {
    sideSlider.min = 0; sideSlider.max = TOTAL_DAYS; sideSlider.value = TOTAL_DAYS;
    sideSlider.addEventListener('input', () => {
      if (_isPlaying) pause();
      slider.value = sideSlider.value;
      applySliderDay(parseInt(sideSlider.value));
    });
  }
}

window.TimeSliderModule = { initTimeSlider, reset, play, pause };
