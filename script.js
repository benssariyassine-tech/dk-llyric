/* ============================================
   dk.llyric Editor — Final v1.0
   ============================================ */
const PX_PER_SEC = 30;
const LONG_PRESS_MS = 2000;
const MIN_TIMELINE_SEC = 15;

const state = {
  audioUrl: null,
  audioDuration: 0,
  audioStart: 0,
  audioEnd: 0,
  currentTime: 0,
  isPlaying: false,
  songName: 'راجع',
  artistName: 'عمرو دياب',
  lyrics: [
    { text: 'راجع بتقولي اللي ما بينا', start: 0, duration: 4, glass: false },
    { text: 'راجع', start: 5, duration: 3, glass: false }
  ],
  selectedType: null,
  selectedIndex: -1,
  activeSegment: -1,
  font: { family: 'Cairo', size: 24, weight: 800, color: '#ffffff' }
};

let currentTab = null;
let _playheadRAF = null;
let _lastRAFTime = 0;
let _resize = null;
let _move = null;
let _longPressTimer = null;

/* ============================================
   Init
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  initAudioUpload();
  initAudioSegmentListeners();
  renderAll();
  applyFont();
  setupPlayheadDrag();
  setupFontControls();

  // ⏱️ ضع المؤشر في 0s بعد الرندر
  requestAnimationFrame(() => {
    state.currentTime = 0;
    setPlayheadPosition(0);
    updateTimeDisplay();
  });
});

function renderAll() {
  renderRuler();
  renderTimeline();
  renderLyricsList();
}

/* ============================================
   Tabs
   ============================================ */
function openTab(tabName, btnEl) {
  if (currentTab === tabName) { closeSheet(); return; }
  currentTab = tabName;
  document.querySelectorAll('.editor-nav-item').forEach(el => el.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  document.querySelectorAll('.sheet-content').forEach(el => el.classList.remove('active'));
  const target = document.querySelector(`[data-sheet="${tabName}"]`);
  if (target) target.classList.add('active');
  document.getElementById('bottomSheet').classList.add('open');
  document.getElementById('sheetBackdrop').classList.add('open');
  if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
}
function closeSheet() {
  currentTab = null;
  document.querySelectorAll('.editor-nav-item').forEach(el => el.classList.remove('active'));
  const bs = document.getElementById('bottomSheet');
  const sb = document.getElementById('sheetBackdrop');
  if (bs) bs.classList.remove('open');
  if (sb) sb.classList.remove('open');
}

/* ============================================
   Audio Upload
   ============================================ */
function initAudioUpload() {
  const input = document.getElementById('audioInput');
  if (!input) return;
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    state.audioUrl = URL.createObjectURL(file);
    const player = document.getElementById('audioPlayer');
    player.src = state.audioUrl;
    player.onloadedmetadata = () => {
      state.audioDuration = player.duration;
      state.audioStart = 0;
      state.audioEnd = player.duration;
      updateAudioSegment();
      updateTimeDisplay();
      renderAll();
      setPlayheadPosition(0);
    };
    document.getElementById('audioUploadBtn').classList.add('hidden');
    document.getElementById('audioPreview').classList.remove('hidden');
    document.getElementById('audioPreviewName').textContent = file.name;
    document.getElementById('audioPreviewMeta').textContent = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
  });
}

function updateAudioSegment() {
  const seg = document.getElementById('audioSegment');
  if (!seg) return;
  seg.classList.remove('hidden');
  document.getElementById('audioAddBtn').classList.add('hidden');
  seg.style.left = (state.audioStart * PX_PER_SEC) + 'px';
  seg.style.width = ((state.audioEnd - state.audioStart) * PX_PER_SEC) + 'px';
}

function removeAudio() {
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = null;
  state.audioDuration = 0;
  const player = document.getElementById('audioPlayer');
  player.src = '';
  document.getElementById('audioUploadBtn').classList.remove('hidden');
  document.getElementById('audioPreview').classList.add('hidden');
  document.getElementById('audioSegment').classList.add('hidden');
  document.getElementById('audioAddBtn').classList.remove('hidden');
  updateTimeDisplay();
  renderAll();
  setPlayheadPosition(0);
}

function openAudioPicker() {
  document.getElementById('audioInput').click();
}

function initAudioSegmentListeners() {
  const audioSeg = document.getElementById('audioSegment');
  if (!audioSeg) return;

  audioSeg.addEventListener('click', (e) => {
    if (e.target.classList.contains('seg-handle')) return;
    selectAudio();
  });

  const hL = document.createElement('div');
  hL.className = 'seg-handle handle-left';
  hL.addEventListener('mousedown', e => startResize(e, 0, 'left'));
  hL.addEventListener('touchstart', e => startResize(e, 0, 'left'), { passive: false });
  audioSeg.appendChild(hL);

  const hR = document.createElement('div');
  hR.className = 'seg-handle handle-right';
  hR.addEventListener('mousedown', e => startResize(e, 0, 'right'));
  hR.addEventListener('touchstart', e => startResize(e, 0, 'right'), { passive: false });
  audioSeg.appendChild(hR);
}

/* ============================================
   Lyrics
   ============================================ */
function addLyricLine() {
  const startAt = Math.round(state.currentTime * 10) / 10;
  state.lyrics.push({ text: '', start: startAt, duration: 3, glass: false });
  renderAll();
}
function removeLyricLine(index) {
  if (state.lyrics.length <= 1) return;
  state.lyrics.splice(index, 1);
  renderAll();
}
function updateLyricText(index, text) {
  state.lyrics[index].text = text;
  renderTimeline();
}
function renderLyricsList() {
  const container = document.getElementById('lyricsList');
  if (!container) return;
  container.innerHTML = '';
  state.lyrics.forEach((lyric, index) => {
    const row = document.createElement('div');
    row.className = 'lyric-row';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'lyric-text-input';
    inp.placeholder = 'السطر ' + (index + 1);
    inp.value = lyric.text;
    inp.addEventListener('input', e => updateLyricText(index, e.target.value));
    const btn = document.createElement('button');
    btn.className = 'lyric-remove-btn';
    btn.textContent = '×';
    btn.onclick = () => removeLyricLine(index);
    row.appendChild(inp);
    row.appendChild(btn);
    container.appendChild(row);
  });
}

/* ============================================
   Timeline Duration (Dynamic)
   ============================================ */
function getTimelineDuration() {
  const lastLyricEnd = state.lyrics.reduce((m, l) => Math.max(m, l.start + l.duration), 0);
  if (state.audioUrl && state.audioDuration > 0) {
    return Math.max(state.audioEnd, lastLyricEnd, MIN_TIMELINE_SEC);
  }
  return Math.max(lastLyricEnd, MIN_TIMELINE_SEC);
}

/* ============================================
   Ruler
   ============================================ */
function renderRuler() {
  const ruler = document.getElementById('timelineRuler');
  if (!ruler) return;
  const total = getTimelineDuration();
  ruler.innerHTML = '';
  ruler.style.width = (total * PX_PER_SEC) + 'px';
  for (let s = 0; s <= total; s++) {
    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    tick.style.left = (s * PX_PER_SEC) + 'px';
    tick.innerHTML = `<span>${s}s</span><i></i>`;
    ruler.appendChild(tick);
  }
}

/* ============================================
   Timeline Tracks
   ============================================ */
function renderTimeline() {
  const trackText = document.getElementById('trackText');
  if (!trackText) return;
  const total = getTimelineDuration();
  trackText.innerHTML = '';
  trackText.style.width = (total * PX_PER_SEC) + 'px';

  state.lyrics.forEach((lyric, index) => {
    const seg = document.createElement('div');
    seg.className = 'text-segment';
    if (state.selectedType === 'text' && state.selectedIndex === index) seg.classList.add('selected');
    if (lyric.glass) seg.classList.add('glass');
    seg.style.left = (lyric.start * PX_PER_SEC) + 'px';
    seg.style.width = (lyric.duration * PX_PER_SEC) + 'px';
    seg.textContent = lyric.text || `السطر ${index + 1}`;
    seg.dataset.index = index;

    const hL = document.createElement('div');
    hL.className = 'seg-handle handle-left';
    hL.addEventListener('mousedown', e => startResize(e, index, 'left'));
    hL.addEventListener('touchstart', e => startResize(e, index, 'left'), { passive: false });
    seg.appendChild(hL);

    const hR = document.createElement('div');
    hR.className = 'seg-handle handle-right';
    hR.addEventListener('mousedown', e => startResize(e, index, 'right'));
    hR.addEventListener('touchstart', e => startResize(e, index, 'right'), { passive: false });
    seg.appendChild(hR);

    seg.addEventListener('click', (e) => {
      if (e.target.classList.contains('seg-handle')) return;
      selectText(index);
    });

    seg.addEventListener('mousedown', e => {
      if (e.target.classList.contains('seg-handle')) return;
      startLongPress(e, index, seg);
    });
    seg.addEventListener('touchstart', e => {
      if (e.target.classList.contains('seg-handle')) return;
      startLongPress(e, index, seg);
    }, { passive: true });

    trackText.appendChild(seg);
  });
}

/* ============================================
   Selection + Menu
   ============================================ */
function selectText(index) {
  state.selectedType = 'text';
  state.selectedIndex = index;
  renderTimeline();
  showCapcutMenu('text');
  if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) {}
}
function selectAudio() {
  state.selectedType = 'audio';
  state.selectedIndex = -1;
  renderTimeline();
  renderAudioSelection();
  showCapcutMenu('audio');
  if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) {}
}
function renderAudioSelection() {
  const seg = document.getElementById('audioSegment');
  if (!seg) return;
  seg.classList.toggle('selected', state.selectedType === 'audio');
}
function clearSelection() {
  state.selectedType = null;
  state.selectedIndex = -1;
  renderTimeline();
  renderAudioSelection();
  hideCapcutMenu();
}

function showCapcutMenu(type) {
  const menu = document.getElementById('capcutMenu');
  if (!menu) return;
  menu.classList.add('open');
  document.body.classList.add('menu-open');

  if (type === 'audio') {
    menu.querySelectorAll('.cm-item').forEach(item => {
      const svg = item.querySelector('svg');
      if (!svg) return;
      const svgData = svg.outerHTML;
      if (svgData.includes('M11 4H4') || svgData.includes('rx="4"')) {
        item.style.display = 'none';
      } else {
        item.style.display = '';
      }
    });
  } else {
    menu.querySelectorAll('.cm-item').forEach(item => item.style.display = '');
  }
}
function hideCapcutMenu() {
  const menu = document.getElementById('capcutMenu');
  if (menu) menu.classList.remove('open');
  document.body.classList.remove('menu-open');
}

function cmAction(action) {
  if (action === 'delete') {
    if (state.selectedType === 'text') removeLyricLine(state.selectedIndex);
    else if (state.selectedType === 'audio') removeAudio();
    clearSelection();
    hideCapcutMenu();
  } else if (action === 'copy' || action === 'duplicate') {
    if (state.selectedType === 'text') {
      const src = state.lyrics[state.selectedIndex];
      const newLine = {
        text: src.text,
        start: src.start + src.duration,
        duration: src.duration,
        glass: src.glass
      };
      state.lyrics.splice(state.selectedIndex + 1, 0, newLine);
      renderAll();
    }
    hideCapcutMenu();
  } else if (action === 'glass') {
    if (state.selectedType === 'text') {
      state.lyrics[state.selectedIndex].glass = !state.lyrics[state.selectedIndex].glass;
      renderTimeline();
      renderLyricFromPlayhead(state.selectedIndex);
    }
    hideCapcutMenu();
  } else if (action === 'edit') {
    hideCapcutMenu();
    openTab('text', document.querySelector('.editor-nav-item[data-tab="text"]'));
  } else if (action === 'split') {
    if (state.selectedType === 'text') {
      const idx = state.selectedIndex;
      const l = state.lyrics[idx];
      const splitAt = state.currentTime;
      if (splitAt > l.start && splitAt < l.start + l.duration) {
        const first = { ...l, duration: splitAt - l.start };
        const second = { ...l, start: splitAt, duration: l.start + l.duration - splitAt };
        state.lyrics.splice(idx, 1, first, second);
        renderAll();
      }
    }
    hideCapcutMenu();
  }
}

/* ============================================
   Resize Handles
   ============================================ */
function startResize(e, index, side) {
  e.preventDefault();
  e.stopPropagation();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  _resize = {
    active: true,
    index,
    side,
    startX: cx,
    startDur: state.selectedType === 'audio' ? state.audioEnd : state.lyrics[index].duration,
    startStart: state.selectedType === 'audio' ? state.audioStart : state.lyrics[index].start,
    isAudio: state.selectedType === 'audio'
  };
  if (e.touches) {
    document.addEventListener('touchmove', onResizeMove, { passive: false });
    document.addEventListener('touchend', onResizeEnd);
  } else {
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  }
}
function onResizeMove(e) {
  if (!_resize || !_resize.active) return;
  e.preventDefault();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const dx = cx - _resize.startX;
  const deltaSec = dx / PX_PER_SEC;

  if (_resize.isAudio) {
    if (_resize.side === 'right') {
      const ne = Math.max(state.audioStart + 0.5, Math.min(state.audioDuration, _resize.startDur + deltaSec));
      state.audioEnd = Math.round(ne * 10) / 10;
    } else {
      const ns = Math.max(0, Math.min(state.audioEnd - 0.5, _resize.startStart + deltaSec));
      state.audioStart = Math.round(ns * 10) / 10;
    }
    updateAudioSegment();
  } else {
    if (_resize.side === 'right') {
      const d = Math.max(0.5, Math.min(300, _resize.startDur + deltaSec));
      state.lyrics[_resize.index].duration = Math.round(d * 10) / 10;
    } else {
      const s = Math.max(0, _resize.startStart + deltaSec);
      const d = Math.max(0.5, _resize.startDur - deltaSec);
      state.lyrics[_resize.index].start = Math.round(s * 10) / 10;
      state.lyrics[_resize.index].duration = Math.round(d * 10) / 10;
    }
    renderTimeline();
    renderRuler();
  }
}
function onResizeEnd() {
  if (_resize) _resize.active = false;
  _resize = null;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  document.removeEventListener('touchmove', onResizeMove);
  document.removeEventListener('touchend', onResizeEnd);
}

/* ============================================
   Long Press = Move Block
   ============================================ */
function startLongPress(e, index, segEl) {
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  let cancelled = false;

  const cancelIfMove = (ev) => {
    const mx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const my = ev.touches ? ev.touches[0].clientY : ev.clientY;
    if (Math.abs(mx - cx) > 10 || Math.abs(my - cy) > 10) {
      cancelled = true;
      clearTimeout(_longPressTimer);
    }
  };

  if (e.touches) {
    document.addEventListener('touchmove', cancelIfMove, { passive: true });
    document.addEventListener('touchend', () => { clearTimeout(_longPressTimer); }, { once: true });
  } else {
    document.addEventListener('mousemove', cancelIfMove, { passive: true });
    document.addEventListener('mouseup', () => { clearTimeout(_longPressTimer); }, { once: true });
  }

  _longPressTimer = setTimeout(() => {
    if (cancelled) return;
    selectText(index);
    segEl.classList.add('moving');
    if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}

    _move = {
      active: true,
      index,
      startX: cx,
      startStart: state.lyrics[index].start,
      segEl
    };

    const onMoveFn = (ev) => {
      if (!_move || !_move.active) return;
      const mx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const dx = mx - _move.startX;
      const deltaSec = dx / PX_PER_SEC;
      const ns = Math.max(0, _move.startStart + deltaSec);
      state.lyrics[_move.index].start = Math.round(ns * 10) / 10;
      _move.segEl.style.left = (state.lyrics[_move.index].start * PX_PER_SEC) + 'px';
    };
    const onEndFn = () => {
      if (_move && _move.segEl) _move.segEl.classList.remove('moving');
      _move = null;
      document.removeEventListener('mousemove', onMoveFn);
      document.removeEventListener('mouseup', onEndFn);
      document.removeEventListener('touchmove', onMoveFn);
      document.removeEventListener('touchend', onEndFn);
      renderRuler();
    };
    if (e.touches) {
      document.addEventListener('touchmove', onMoveFn, { passive: false });
      document.addEventListener('touchend', onEndFn);
    } else {
      document.addEventListener('mousemove', onMoveFn);
      document.addEventListener('mouseup', onEndFn);
    }
  }, LONG_PRESS_MS);
}

/* ============================================
   Playhead Position
   ============================================ */
function setPlayheadPosition(sec) {
  const ph = document.getElementById('playhead');
  if (!ph) return;
  const maxEnd = (state.audioUrl && state.audioDuration > 0)
    ? state.audioEnd
    : getTimelineDuration();
  const clampedSec = Math.max(0, Math.min(sec, maxEnd));
  const x = clampedSec * PX_PER_SEC;
  ph.style.transform = `translateX(${x}px)`;
  state.currentTime = clampedSec;
  updateTimeDisplay();
}

/* ============================================
   Playhead Drag
   ============================================ */
function setupPlayheadDrag() {
  const ph = document.getElementById('playhead');
  const vp = document.getElementById('timelineViewport');
  const content = document.getElementById('timelineContent');
  if (!ph || !vp || !content) return;

  let dragging = false;

  const pxToTime = (clientX) => {
    const rect = content.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, x / PX_PER_SEC);
  };

  const seekTo = (sec) => {
    const maxEnd = (state.audioUrl && state.audioDuration > 0)
      ? state.audioEnd
      : getTimelineDuration();
    sec = Math.max(0, Math.min(sec, maxEnd));
    const player = document.getElementById('audioPlayer');
    if (player && state.audioUrl) {
      try { player.currentTime = sec; } catch (e) {}
    }
    setPlayheadPosition(sec);
    syncPlayheadToLyric();
  };

  const onMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    seekTo(pxToTime(clientX));
  };

  const onUp = () => {
    dragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
  };

  const onDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    seekTo(pxToTime(clientX));
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  };

  const cap = ph.querySelector('.playhead-cap');
  if (cap) {
    cap.addEventListener('mousedown', onDown);
    cap.addEventListener('touchstart', onDown, { passive: false });
  }

  const ruler = document.getElementById('timelineRuler');
  if (ruler) {
    const onRulerTouch = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      seekTo(pxToTime(clientX));
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
    };
    ruler.addEventListener('mousedown', onRulerTouch);
    ruler.addEventListener('touchstart', onRulerTouch, { passive: true });
  }

  vp.addEventListener('click', (e) => {
    if (e.target.closest('.text-segment')) return;
    if (e.target.closest('.audio-segment')) return;
    if (e.target.closest('.seg-handle')) return;
    if (e.target.closest('.playhead-cap')) return;
    if (e.target.closest('.ruler-tick')) return;
    if (e.target.closest('.audio-add-btn')) return;
    const sec = pxToTime(e.clientX);
    seekTo(sec);
  });
}

/* ============================================
   Playhead Loop
   ============================================ */
function startPlayheadLoop() {
  if (_playheadRAF) cancelAnimationFrame(_playheadRAF);
  _lastRAFTime = performance.now();

  const tick = (now) => {
    const dt = (now - _lastRAFTime) / 1000;
    _lastRAFTime = now;

    const player = document.getElementById('audioPlayer');
    const ph = document.getElementById('playhead');

    if (player && state.audioUrl && !player.paused && !player.ended) {
      state.currentTime = player.currentTime;
    } else {
      state.currentTime += dt;
    }

    const maxEnd = (state.audioUrl && state.audioDuration > 0)
      ? state.audioEnd
      : getTimelineDuration();

    if (state.currentTime >= maxEnd) {
      state.currentTime = maxEnd;
      if (ph) ph.style.transform = `translateX(${maxEnd * PX_PER_SEC}px)`;
      updateTimeDisplay();
      syncPlayheadToLyric();
      state.isPlaying = false;
      updatePlayIcon();
      stopPlayheadLoop();
      return;
    }

    if (ph) ph.style.transform = `translateX(${state.currentTime * PX_PER_SEC}px)`;
    updateTimeDisplay();
    syncPlayheadToLyric();

    if (state.audioUrl && player && !player.paused) {
      autoScrollPlayhead();
    }

    _playheadRAF = requestAnimationFrame(tick);
  };

  _playheadRAF = requestAnimationFrame(tick);
}

function stopPlayheadLoop() {
  if (_playheadRAF) {
    cancelAnimationFrame(_playheadRAF);
    _playheadRAF = null;
  }
}

function autoScrollPlayhead() {
  const vp = document.getElementById('timelineViewport');
  if (!vp) return;
  const phX = state.currentTime * PX_PER_SEC;
  const scrollLeft = vp.scrollLeft;
  const viewportWidth = vp.clientWidth;
  const phScreenX = phX - scrollLeft;

  if (phScreenX > viewportWidth - 100) {
    vp.scrollLeft = phX - viewportWidth + 100;
  } else if (phScreenX < 80) {
    vp.scrollLeft = Math.max(0, phX - 80);
  }
}

/* ============================================
   Sync Playhead → Lyric
   ============================================ */
function syncPlayheadToLyric() {
  const t = state.currentTime;
  let idx = -1;
  for (let i = 0; i < state.lyrics.length; i++) {
    const l = state.lyrics[i];
    if (t >= l.start && t < l.start + l.duration) { idx = i; break; }
  }
  if (idx !== state.activeSegment) {
    state.activeSegment = idx;
    renderLyricFromPlayhead(idx);
  }
}

function renderLyricFromPlayhead(idx) {
  const lyricEl = document.getElementById('previewLyric');
  const el = document.getElementById('lyricElement');
  if (!lyricEl || !el) return;

  if (idx < 0) {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'lyricFadeOut 0.3s ease forwards';
    return;
  }

  lyricEl.textContent = state.lyrics[idx].text || 'اكتب الكلمات';
  el.classList.toggle('glass-mode', !!state.lyrics[idx].glass);
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'lyricFadeIn 0.4s ease';
}

/* ============================================
   Play / Pause
   ============================================ */
function togglePlay() {
  const player = document.getElementById('audioPlayer');
  const maxEnd = (state.audioUrl && state.audioDuration > 0)
    ? state.audioEnd
    : getTimelineDuration();

  if (state.isPlaying) {
    if (player && state.audioUrl) player.pause();
    state.isPlaying = false;
    stopPlayheadLoop();
  } else {
    if (state.currentTime >= maxEnd - 0.1) {
      state.currentTime = 0;
      setPlayheadPosition(0);
      if (player && state.audioUrl) {
        try { player.currentTime = state.audioStart; } catch (e) {}
      }
    }

    if (player && state.audioUrl) {
      try { player.currentTime = state.currentTime; } catch (e) {}
      player.play().catch(e => console.warn('play err:', e));
    }
    state.isPlaying = true;
    startPlayheadLoop();
  }
  updatePlayIcon();
}

function updatePlayIcon() {
  const i = document.getElementById('playIcon');
  if (!i) return;
  i.innerHTML = state.isPlaying
    ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
    : '<polygon points="5 3 19 12 5 21 5 3"/>';
}

function updateTimeDisplay() {
  const el = document.getElementById('timeDisplay');
  if (!el) return;
  const maxEnd = (state.audioUrl && state.audioDuration > 0)
    ? state.audioEnd
    : getTimelineDuration();
  const cur = Math.max(0, Math.min(state.currentTime, maxEnd));
  el.textContent = fmt(cur) + ' / ' + fmt(maxEnd);
}

function fmt(s) {
  s = Math.max(0, Math.floor(s));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/* ============================================
   Font Controls
   ============================================ */
function setupFontControls() {
  document.querySelectorAll('.font-family-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.font-family-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.font.family = btn.dataset.font;
      applyFont();
    });
  });
  const r = document.getElementById('fontSizeRange');
  if (r) r.addEventListener('input', e => {
    state.font.size = parseInt(e.target.value);
    document.getElementById('fontSizeVal').textContent = state.font.size;
    applyFont();
  });
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.font.color = btn.dataset.color;
      applyFont();
    });
  });
}

function applyFont() {
  const el = document.getElementById('previewLyric');
  if (!el) return;
  el.style.fontFamily = `'${state.font.family}', sans-serif`;
  el.style.fontSize = state.font.size + 'px';
  el.style.fontWeight = state.font.weight;
  el.style.color = state.font.color;
  el.style.textShadow = '0 4px 20px rgba(0,0,0,0.6)';
}

/* ============================================
   Tap → Hide Menu
   ============================================ */
document.addEventListener('click', (e) => {
  if (state.selectedType) {
    if (e.target.closest('.capcut-menu')) return;
    if (e.target.closest('.editor-nav')) return;
    if (e.target.closest('.bottom-sheet')) return;
    if (e.target.closest('.sheet-backdrop')) return;
    if (e.target.closest('.text-segment')) return;
    if (e.target.closest('.audio-segment')) return;
    if (e.target.closest('.playhead')) return;
    if (e.target.closest('.playhead-cap')) return;
    clearSelection();
  }
}, true);

/* ============================================
   Misc
   ============================================ */
function closeEditor() {
  if (confirm('إغلاق المشروع؟')) window.location.href = 'index.html';
}
function exportVideo() { alert('التصدير راح يتوفر قريباً!'); }
function undoAction() {}
function redoAction() {}
