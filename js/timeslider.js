let _seasonStart = new Date('2025-07-01');
let _seasonEnd   = new Date('2026-03-20');
let _totalDays   = Math.floor((_seasonEnd - _seasonStart) / 86400000);

let _currentDay  = _totalDays;
let _animTimer   = null;
let _isPlaying   = false;

function setTimeRange(start, end) {
  _seasonStart = new Date(start);
  _seasonEnd   = new Date(end);
  _totalDays   = Math.floor((_seasonEnd - _seasonStart) / 86400000);
  _currentDay  = _totalDays;
  
  // Update HTML labels if they exist
  const lStart = document.getElementById('label-start');
  const lMid   = document.getElementById('label-mid');
  const lEnd   = document.getElementById('label-end');
  
  if (lStart) lStart.textContent = _seasonStart.toLocaleDateString('en-ZW', { month: 'short', year: 'numeric' });
  if (lEnd)   lEnd.textContent   = _seasonEnd.toLocaleDateString('en-ZW', { month: 'short', year: 'numeric' });
  if (lMid) {
    const mid = new Date(_seasonStart.getTime() + (_seasonEnd - _seasonStart) / 2);
    lMid.textContent = mid.toLocaleDateString('en-ZW', { month: 'short', year: 'numeric' });
  }

  // Re-sync UI if slider exists
  const slider = document.getElementById('map-time-slider');
  if (slider) {
    slider.max = _totalDays;
    slider.value = _totalDays;
  }
  
  const sideSlider = document.getElementById('sidebar-time-slider');
  if (sideSlider) {
    sideSlider.max = _totalDays;
    sideSlider.value = _totalDays;
  }
}

function dayToDate(day) {
  const d = new Date(_seasonStart);
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
    const pct = (day / _totalDays * 100).toFixed(1);
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
  if (_currentDay >= _totalDays) _currentDay = 0;

  _animTimer = setInterval(() => {
    _currentDay += 7;
    if (_currentDay >= _totalDays) {
      _currentDay = _totalDays;
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
  slider.max  = _totalDays;
  slider.value = _totalDays;
  updateSliderUI(_totalDays);

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
    sideSlider.min = 0; sideSlider.max = _totalDays; sideSlider.value = _totalDays;
    sideSlider.addEventListener('input', () => {
      if (_isPlaying) pause();
      slider.value = sideSlider.value;
      applySliderDay(parseInt(sideSlider.value));
    });
  }
}

window.TimeSliderModule = { initTimeSlider, reset, play, pause, setTimeRange };
