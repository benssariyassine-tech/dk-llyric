/* ============================================
   dk.llyric Editor v5 — CapCut Style
   ============================================ */
const PX_PER_SEC = 30;
const LONG_PRESS_MS = 2000;
const MIN_TIMELINE_SEC = 30;

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
    { text: 'راجع بتقولي اللي ما بينا', start: 1, duration: 4, glass: false },
    { text: 'راجع', start: 6, duration: 3, glass: false }
  ],
  selectedType: null, // 'text' | 'audio'
  selectedIndex: -1,
  font: { family: 'Cairo', size: 24, weight: 800, color: '#ffffff' },
  coverUrl: null, bgUrl: null
};

let currentTab = null;
let _playheadLoop = null;
let _resize = null;
let _move = null;
let _longPressTimer = null;

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initAudioUpload();
  renderRuler();
  renderTimeline();
  applyFont();
  setupPlayheadDrag();
  setupFontControls();
  updateTimeDisplay();
});

/* ============================================
   🎛️ Tabs
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
}
function closeSheet() {
  currentTab = null;
  document.querySelectorAll('.editor-nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('bottomSheet').classList.remove('open');
  document.getElementById('sheetBackvokedrop').classList.remove('open');
}

/* ============================================
   🎵 Audio
   ============================================ */
function initAudioUpload() {
  const input = document.getElementById('audioInput');
  if (!input) return;
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (state.audioUrl) URL.reObjectURL(state.audioUrl);
    state.audioUrl = URL.createObjectURL(file);
    const player = document.getElementById('audioPlayer');
    player.src = state.audioUrl;
    player.onloadedmetadata = () => {
      state.audioDuration = player.duration;
      state.audioStart = 0;
      state.audioEnd = player.duration;
      updateAudioSegment();
      updateTimeDisplay();
      renderRuler();
      renderTimeline();
    };
    document.getElementById('audioUploadBtn').classList.add('hidden');
    document.getElementById('audioPreview').classList.remove('hidden');
    document.getElementById('audioPreviewName').textContent = file.name;
    document.getElementById('audioPreviewMeta').textContent = (file.size/(1024*1024)).toFixed(1) + ' MB';
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
  renderRuler();
  renderTimeline();
}
function openAudioPicker() { document.getElementById('audioInput').click(); }

/* ============================================
   ✍️ Lyrics
   ============================================ */
function addLyricLine() {
  const startAt = Math.round(state.currentTime * 10) / 10;
  state.lyrics.push({ text: '', start: startAt, duration: 3, glass: false });
  renderLyricsList();
  renderTimeline();
}
function removeLyricLine(index) {
  if (state.lyrics.length <= 1) return;
  state.lyrics.splice(index, 1);
  renderLyricsList();
  renderTimeline();
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
   📏 Timeline
   ============================================ */
function getTimelineDuration() {
  const lastLyricEnd = state.lyrics.reduce((m, l) => Math.max(m, l.start + l.duration), 0);
  return Math.max(state.audioDuration || 0, lastLyricEnd, MIN_TIMELINE_SEC);
}

function renderRuler() {
  const ruler = document.getElementById('timelineRuler');
  if (!ruler) return;
  const total = getTimelineDuration();
  ruler.innerHTML = '';
  ruler.style.width = (total * PX_PER_SEC + 60) + 'px';
  for (let s = 0; s <= total; s++) {
    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    tick.style.left = (s * PX_PER_SEC) + 'px';
    tick.innerHTML = `<span>${s}s</span><i></i>`;
    ruler.appendChild(tick);
  }
}

function renderTimeline() {
  const trackText = document.getElementById('trackText');
  if (!trackText) return;
  const total = getTimelineDuration();
  trackText.innerHTML = '';
  trackText.style.width = (total * PX_PER_SEC + 60) + 'px';

  state.lyrics.forEach((lyric, index) => {
    const seg = document.createElement('div');
    seg.className = 'text-segment';
    if (state.selectedType === 'text' && state.selectedIndex === index) seg.classList.add('selected');
    if (lyric.glass) seg.classList.add('glass');
    seg.style.left = (lyric.start * PX_PER_SEC) + 'px';
    seg.style.width = (lyric.duration * PX_PER_SEC) + 'px';
    seg.textContent = lyric.text || `السطر ${index + 1}`;
    seg.dataset.index = index;

    // المقابض
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

    // Tap = select + menu
    seg.addEventListener('click', (e) => {
      if (e.target.classList.contains('seg-handle')) return;
      selectText(index);
    });

    // Long Press 2s = move mode
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
   🎯 Selection + Menu
   ============================================ */
function selectText(index) {
  state.selectedType = 'text';
  state.selectedIndex = index;
  renderTimeline();
  showCapcutMenu('text');
  if (navigator.vibrate) try { navigator.vibrate(10); } catch(e) {}
}
function selectAudio() {
  state.selectedType = 'audio';
  state.selectedIndex = -1;
  renderTimeline();
  renderAudioSelection();
  showCapcutMenu('audio');
  if (navigator.vibrate) try { navigator.vibrate(10); } catch(e) {}
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
  document.body.classList.add('menu-open'); // ← زيد هذا

  if (type === 'audio') {
    menu.querySelectorAll('.cm-item').forEach(item => {
      const svgData = item.querySelector('svg').outerHTML;
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
  document.body.classList.remove('menu-open'); // ← زيد هذا
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
      renderTimeline();
      renderLyricsList();
    }
    hideCapcutMenu();
  } else if (action === 'glass') {
    if (state.selectedType === 'text') {
      state.lyrics[state.selectedIndex].glass = !state.lyrics[state.selectedIndex].glass;
      renderTimeline();
    }
    hideCapcutMenu();
  } else if (action === 'edit') {
    hideCapcutMenu();
    openTab('text', document.querySelector('.editor-nav-item[data-tab="text"]'));
  } else if (action === 'split') {
    // تقسيم في نقطة المؤشر
    if (state.selectedType === 'text') {
      const idx = state.selectedIndex;
      const l = state.lyrics[idx];
      const splitAt = state.currentTime;
      if (splitAt > l.start && splitAt < l.start + l.duration) {
        const first = { ...l, duration: splitAt - l.start };
        const second = { ...l, start: splitAt, duration: l.start + l.duration - splitAt };
        state.lyrics.splice(idx, 1, first, second);
        renderTimeline();
        renderLyricsList();
      }
    }
    hideCapcutMenu();
  }
}

/* ============================================
   🎯 Resize (Imad + Iqassar)
   ============================================ */
function startResize(e, index, side) {
  e.preventDefault();
  e.stopPropagation();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  _resize = {
    active: true, index, side, startX: cx,
    startDur: state.lyrics[index].duration,
    startStart: state.lyrics[index].start,
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
    // قص الصوت
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
      const d = Math.max(0.5, Math.min(60, _resize.startDur + deltaSec));
      state.lyrics[_resize.index].duration = Math.round(d * 10) / 10;
    } else {
      const s = Math.max(0, _resize.startStart + deltaSec);
      const d = Math.max(0.5, _resize.startDur - deltaSec);
      state.lyrics[_resize.index].start = Math.round(s * 10) / 10;
      state.lyrics[_resize.index].duration = Math.round(d * 10) / 10;
    }
    renderTimeline();
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
   👆 Long Press 2s → Move Block
   ============================================ */
function startLongPress(e, index, segEl) {
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  let moved = false;
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
    // نجح Long Press → Move mode
    selectText(index);
    segEl.classList.add('moving');
    if (navigator.vibrate) try { navigator.vibrate(30); } catch(e) {}

    _move = {
      active: true, index,
      startX: cx,
      startStart: state.lyrics[index].start,
      segEl
    };

    const onMove = (ev) => {
      if (!_move.active) return;
      const mx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const dx = mx - _move.startX;
      const deltaSec = dx / PX_PER_SEC;
      const ns = Math.max(0, _move.startStart + deltaSec);
      state.lyrics[_move.index].start = Math.round(ns * 10) / 10;
      _move.segEl.style.left = (state.lyrics[_move.index].start * PX_PER_SEC) + 'px';
    };
    const onEnd = () => {
      if (_move) _move.segEl.classList.remove('moving');
      _move = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    if (ev._t) {
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    } else {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
    }
  }, LONG_PRESS_MS);
}

/* ============================================
   🎯 Audio Segment: Tap = Select + Menu
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  const audioSeg = document.getElementById('audioSegment');
  if (audioSeg) {
    audioSeg.addEventListener('click', (e) => {
      if (e.target.classList.contains('seg-handle')) return;
      selectAudio();
    });
    // مقابض الصوت
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
});

/* ============================================
   ▶️ Playhead
   ============================================ */
function setupPlayheadDrag() {
  const ph = document.getElementById('playhead');
  const vp = document.getElementById('timelineViewport');
  if (!ph || !vp) return;

  let dragging = false;

  const setFromX = (clientX) => {
    const rect = vp.getBoundingClientRect();
    const sl = vp.scrollLeft;
    const x = Math.max(0, clientX - rect.left + sl - 20);
    state.currentTime = x / PX_PER_SEC;
    ph.style.left = (x + 20) + 'px';
    updateTimeDisplay();
  };

  const onDown = (e) => {
    dragging = true;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    setFromX(cx);
    if (e.touches) {
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    } else {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    setFromX(cx);
  };
  const onUp = () => {
    dragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchend', onUp);
  };

  ph.addEventListener('mousedown', onDown);
  ph.addEventListener('touchstart', onDown, { passive: false });

  // Tap على الـ timeline (ماشي على السطور) = نقل المؤشر
  vp.addEventListener('click', (e) => {
    if (e.target.closest('.text-segment') || e.target.closest('.audio-segment') || e.target.closest('.seg-handle') || e.target === ph || e.target.closest('.playhead')) return;
    setFromX(e.clientX);
  });
}

/* ============================================
   ▶️ Play / Pause
   ============================================ */
function togglePlay() {
  const player = document.getElementById('audioPlayer');
  if (state.isPlaying) {
    if (player && state.audioUrl) player.pause();
    state.isPlaying = false;
    stopLoop();
  } else {
    if (player && state.audioUrl) {
      player.currentTime = state.currentTime;
      player.play().catch(e => console.warn(e));
    }
    state.isPlaying = true;
    startLoop();
  }
  updatePlayIcon();
}

function startLoop() {
  if (_playheadLoop) clearInterval(_playheadLoop);
  const t0 = Date.now();
  const c0 = state.currentTime;
  _playheadLoop = setInterval(() => {
    const player = document.getElementById('audioPlayer');
    if (player && state.audioUrl && !player.paused && !player.ended) {
      state.currentTime = player.currentTime;
    } else if (state.audioUrl && player && player.ended) {
      state.isPlaying = false;
      updatePlayIcon();
      stopLoop();
      return;
    } else {
      state.currentTime = c0 + (Date.now() - t0) / 1000;
      const max = getTimelineDuration();
      if (state.currentTime >= max) {
        state.isPlaying = false;
        updatePlayIcon();
        stopLoop();
        return;
      }
    }
    const ph = document.getElementById('playhead');
    if (ph) ph.style.left = (state.currentTime * PX_PER_SEC + 20) + 'px';
    updateTimeDisplay();
    // مزامنة الكلمة
    const t = state.currentTime;
    const idx = state.lyrics.findIndex(l => t >= l.start && t < l.start + l.duration);
    if (idx >= 0) {
      const lyrEl = document.getElementById('previewLyric');
      if (lyrEl) lyrEl.textContent = state.lyrics[idx].text || 'اكتب الكلمات';
      const el = document.getElementById('lyricElement');
      if (el) {
        el.classList.toggle('glass-mode', !!state.lyrics[idx].glass);
      }
    }
  }, 60);
}
function stopLoop() {
  if (_playheadLoop) { clearInterval(_playheadLoop); _playheadLoop = null; }
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
  el.textContent = fmt(state.currentTime) + ' / ' + fmt(state.audioDuration || 0);
}
function fmt(s) {
  s = Math.max(0, Math.floor(s));
  return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
}

/* ============================================
   🔤 Font
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
   🚪
   ============================================ */
function closeEditor() {
  if (confirm('إغلاق المشروع؟')) window.location.href = 'index.html';
}
function exportVideo() { alert('التصدير راح يتوفر قريباً!'); }
function undoAction() {}
function redoAction() {}
/* ============================================
   🎯 Tap على الشاشة → إخفاء القائمة
   ============================================ */
document.addEventListener('click', (e) => {
  // إذا كاين اختيار
  if (state.selectedType) {
    // كليكي على قائمة CapCut → تجاهل
    if (e.target.closest('.capcut-menu')) return;
    // كليكي على قائمة رئيسية → تجاهل
    if (e.target.closest('.editor-nav')) return;
    // كليكي على Bottom Sheet → تجاهل
    if (e.target.closest('.bottom-sheet')) return;
    if (e.target.closest('.sheet-backdrop')) return;
    // كليكي على كلمة/أغنية → تجاهل (الدالة الخاصة تديرها)
    if (e.target.closest('.text-segment')) return;
    if (e.target.closest('.audio-segment')) return;
    if (e.target.closest('.playhead')) return;
    
    // كليكي في أي مكان آخر → خفي الكل
    clearSelection();
  }
}, true); // ← capture phase باش يشتغل قبل ما ينشر
