/* ============================================
   🎯 dk.llyric — Editor v4 (Freedom + iOS Style)
   ============================================ */

const PX_PER_SEC = 30;
const LONG_PRESS_MS = 500;

const state = {
  audioUrl: null,
  audioDuration: 0,
  audioTrim: { start: 0, end: 0 },
  currentTime: 0,
  isPlaying: false,
  songName: 'راجع',
  artistName: 'عمرو دياب',
  lyrics: [
    { text: 'راجع بتقولي اللي ما بينا', start: 0, duration: 4, glass: false },
    { text: 'راجع', start: 4, duration: 3, glass: false }
  ],
  activeSegment: -1,
  font: { family: 'Cairo', size: 24, weight: 800, color: '#ffffff', anim: 'fadeUp' },
  coverUrl: null,
  bgUrl: null,
  bgBlur: 60
};

let currentTab = null;
let _playheadLoop = null;
let _resize = null;
let _move = null;
let _longPressTimer = null;
let _timelineDrag = null;

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  playEntryAnimation();
  initAudioUpload();
  renderRuler();
  renderTimeline();
  renderPreview();
  applyFont();
  setupPlayheadDrag();
  setupTimelineScroll();
  initFontControls();
});

/* ============================================
   🎬 Entry Animation
   ============================================ */
function playEntryAnimation() {
  const layer = document.getElementById('entryLayer');
  if (!layer) return;
  setTimeout(() => {
    layer.classList.add('open');
    setTimeout(() => {
      layer.classList.add('hide');
      setTimeout(() => layer.remove(), 600);
    }, 800);
  }, 200);
}

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
  if (navigator.vibrate) try { navigator.vibrate(8); } catch(e) {}
}
function closeSheet() {
  currentTab = null;
  document.querySelectorAll('.editor-nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('bottomSheet').classList.remove('open');
  document.getElementById('sheetBackdrop').classList.remove('open');
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
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    state.audioUrl = URL.createObjectURL(file);
    const player = document.getElementById('audioPlayer');
    player.src = state.audioUrl;
    player.onloadedmetadata = () => {
      state.audioDuration = player.duration;
      state.audioTrim = { start: 0, end: player.duration };
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
  const trim = state.audioTrim;
  const dur = (trim.end - trim.start) || state.audioDuration;
  seg.style.left = (trim.start * PX_PER_SEC) + 'px';
  seg.style.width = (dur * PX_PER_SEC) + 'px';
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
}
function openAudioPicker() { document.getElementById('audioInput').click(); }

/* ============================================
   ✍️ Lyrics
   ============================================ */
function addLyricLine() {
  const startAt = Math.round(state.currentTime * 10) / 10;
  state.lyrics.push({ text: '', start: startAt, duration: 3, glass: false });
  state.activeSegment = state.lyrics.length - 1;
  renderLyricsList();
  renderTimeline();
  renderLyricFromPlayhead(state.activeSegment);
  scrollTimelineToLyric(state.activeSegment);
}
function removeLyricLine(index) {
  if (state.lyrics.length <= 1) return;
  state.lyrics.splice(index, 1);
  renderLyricsList();
  renderTimeline();
  renderPreview();
}
function updateLyricText(index, text) {
  state.lyrics[index].text = text;
  renderTimeline();
  if (index === state.activeSegment) renderLyricFromPlayhead(index);
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
    inp.addEventListener('focus', () => {
      state.activeSegment = index;
      renderTimeline();
      renderLyricFromPlayhead(index);
    });
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
   🎞️ Timeline
   ============================================ */
function renderRuler() {
  const ruler = document.getElementById('timelineRuler');
  if (!ruler) return;
  ruler.innerHTML = '';
  const totalSec = Math.max(state.audioDuration || 15, 15);
  ruler.style.width = (totalSec * PX_PER_SEC + 60) + 'px';
  for (let s = 0; s <= totalSec; s++) {
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
  const totalSec = Math.max(state.audioDuration || 15, 15);
  trackText.innerHTML = '';
  trackText.style.width = (totalSec * PX_PER_SEC + 60) + 'px';
  trackText.style.height = '46px';
  trackText.style.position = 'relative';

  state.lyrics.forEach((lyric, index) => {
    const seg = document.createElement('div');
    seg.className = 'text-segment' + (index === state.activeSegment ? ' active' : '') + (lyric.glass ? ' glass' : '');
    seg.style.position = 'absolute';
    seg.style.left = (lyric.start * PX_PER_SEC) + 'px';
    seg.style.width = (lyric.duration * PX_PER_SEC) + 'px';
    seg.textContent = lyric.text || `السطر ${index + 1}`;
    seg.dataset.index = index;

    // مقبض يسار
    const hL = document.createElement('div');
    hL.className = 'seg-handle left';
    hL.addEventListener('mousedown', e => startResize(e, index, 'left'));
    hL.addEventListener('touchstart', e => startResize(e, index, 'left'), { passive: false });
    seg.appendChild(hL);

    // مقبض يمين
    const hR = document.createElement('div');
    hR.className = 'seg-handle right';
    hR.addEventListener('mousedown', e => startResize(e, index, 'right'));
    hR.addEventListener('touchstart', e => startResize(e, index, 'right'), { passive: false });
    seg.appendChild(hR);

    // ضغطة مطولة → menu
    const lp = (e) => {
      if (e.target.classList.contains('seg-handle')) return;
      startLongPress(e, index, seg);
    };
    seg.addEventListener('mousedown', lp);
    seg.addEventListener('touchstart', lp, { passive: true });

    // ضغطة قصيرة → تحديد فقط
    seg.addEventListener('click', (e) => {
      if (e.target.classList.contains('seg-handle')) return;
      state.activeSegment = index;
      renderTimeline();
      renderLyricFromPlayhead(index);
    });

    trackText.appendChild(seg);
  });
}

function scrollTimelineToLyric(index) {
  const viewport = document.getElementById('timelineViewport');
  if (!viewport) return;
  const segLeft = state.lyrics[index].start * PX_PER_SEC;
  const segWidth = state.lyrics[index].duration * PX_PER_SEC;
  viewport.scrollTo({
    left: Math.max(0, segLeft - viewport.clientWidth / 2 + segWidth / 2),
    behavior: 'smooth'
  });
}

/* ============================================
   🎯 Resize handles
   ============================================ */
function startResize(e, index, side) {
  e.preventDefault();
  e.stopPropagation();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  _resize = {
    active: true, index, side, startX: clientX,
    startDur: state.lyrics[index].duration,
    startStart: state.lyrics[index].start
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
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const dx = clientX - _resize.startX;
  const deltaSec = dx / PX_PER_SEC;

  if (_resize.side === 'right') {
    const d = Math.max(0.5, Math.min(30, _resize.startDur + deltaSec));
    state.lyrics[_resize.index].duration = Math.round(d * 10) / 10;
  } else {
    const s = Math.max(0, _resize.startStart + deltaSec);
    const d = Math.max(0.5, _resize.startDur - deltaSec);
    state.lyrics[_resize.index].start = Math.round(s * 10) / 10;
    state.lyrics[_resize.index].duration = Math.round(d * 10) / 10;
  }
  renderTimeline();
}
function onResizeEnd() {
  if (_resize) _resize.active = false;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  document.removeEventListener('touchmove', onResizeMove);
  document.removeEventListener('touchend', onResizeEnd);
}

/* ============================================
   👆 Long Press (Move + Menu)
   ============================================ */
let _lpStart = { x: 0, y: 0 };
function startLongPress(e, index, segEl) {
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  _lpStart = { x: cx, y: cy, index, segEl, moved: false };

  // إذا تحرك المستخدم بزاف قبل Long Press → نلغيه
  const cancelIfMoved = (ev) => {
    const mx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const my = ev.touches ? ev.touches[0].clientY : ev.clientY;
    if (Math.abs(mx - _lpStart.x) > 8 || Math.abs(my - _lpStart.y) > 8) {
      _lpStart.moved = true;
      clearTimeout(_longPressTimer);
      _longPressTimer = null;
    }
  };

  _longPressTimer = setTimeout(() => {
    if (_lpStart.moved) return;
    // نجح Long Press → افتح Menu
    state.activeSegment = index;
    renderTimeline();
    renderLyricFromPlayhead(index);
    openWordMenu(index);
    if (navigator.vibrate) try { navigator.vibrate(20); } catch(e) {}
  }, LONG_PRESS_MS);

  if (e.touches) {
    document.addEventListener('touchmove', cancelIfMoved, { once: true });
    document.addEventListener('touchend', () => {
      clearTimeout(_longPressTimer);
    }, { once: true });
  } else {
    document.addEventListener('mousemove', cancelIfMoved, { once: true });
    document.addEventListener('mouseup', () => {
      clearTimeout(_longPressTimer);
    }, { once: true });
  }
}

/* ============================================
   📋 Word Menu (Bottom Sheet)
   ============================================ */
function openWordMenu(index) {
  document.getElementById('wordMenuBackdrop').classList.add('open');
  document.getElementById('wordMenuSheet').classList.add('open');
  document.getElementById('wordDurationBox').style.display = 'none';
  // حط القيم
  const range = document.getElementById('wordDurationRange');
  range.value = state.lyrics[index].duration;
  document.getElementById('wordDurationVal').textContent = state.lyrics[index].duration.toFixed(1);
}
function closeWordMenu() {
  document.getElementById('wordMenuBackdrop').classList.remove('open');
  document.getElementById('wordMenuSheet').classList.remove('open');
}

function wordAction(action) {
  const idx = state.activeSegment;
  if (idx < 0 || !state.lyrics[idx]) return;

  if (action === 'delete') {
    removeLyricLine(idx);
    closeWordMenu();
  } else if (action === 'copy' || action === 'duplicate') {
    const src = state.lyrics[idx];
    const newLine = {
      text: src.text + (action === 'duplicate' ? ' (نسخة)' : ''),
      start: src.start + src.duration,
      duration: src.duration,
      glass: src.glass
    };
    state.lyrics.splice(idx + 1, 0, newLine);
    renderTimeline();
    renderLyricsList();
    closeWordMenu();
  } else if (action === 'glass') {
    state.lyrics[idx].glass = !state.lyrics[idx].glass;
    renderTimeline();
    renderLyricFromPlayhead(idx);
    closeWordMenu();
  } else if (action === 'duration') {
    document.getElementById('wordDurationBox').style.display = 'block';
  } else if (action === 'edit') {
    closeWordMenu();
    openTab('text', document.querySelector('.editor-nav-item[data-tab="text"]'));
  }
}

// Duration slider
const wdRange = document.getElementById('wordDurationRange');
if (wdRange) {
  wdRange.addEventListener('input', (e) => {
    const idx = state.activeSegment;
    if (idx < 0) return;
    state.lyrics[idx].duration = parseFloat(e.target.value);
    document.getElementById('wordDurationVal').textContent = state.lyrics[idx].duration.toFixed(1);
    renderTimeline();
  });
}

/* ============================================
   ▶️ Playhead + Timeline scroll
   ============================================ */
function setupPlayheadDrag() {
  const playhead = document.getElementById('playhead');
  const viewport = document.getElementById('timelineViewport');
  if (!playhead || !viewport) return;

  let dragging = false;

  const setFromX = (clientX) => {
    const rect = viewport.getBoundingClientRect();
    const scrollLeft = viewport.scrollLeft;
    const x = Math.max(0, clientX - rect.left + scrollLeft);
    const sec = x / PX_PER_SEC;
    state.currentTime = sec;
    playhead.style.left = x + 'px';
    updateTimeDisplay();
    syncPlayheadToLyric();
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

  // فقط على المؤشر — باش ما يخربش السحب في الـ Timeline
  playhead.addEventListener('mousedown', onDown);
  playhead.addEventListener('touchstart', onDown, { passive: false });
}

function setupTimelineScroll() {
  const viewport = document.getElementById('timelineViewport');
  if (!viewport) return;
  // المسح الأفقي في الـ Timeline طبيعي بـ overflow-x: auto
}

function syncPlayheadToLyric() {
  const t = state.currentTime;
  let idx = -1;
  for (let i = 0; i < state.lyrics.length; i++) {
    const l = state.lyrics[i];
    if (t >= l.start && t < l.start + l.duration) { idx = i; break; }
  }
  if (idx !== state.activeSegment) {
    state.activeSegment = idx;
    renderTimeline();
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
   ▶️ Play / Pause
   ============================================ */
function togglePlay() {
  const player = document.getElementById('audioPlayer');
  if (state.isPlaying) {
    if (player && state.audioUrl) player.pause();
    state.isPlaying = false;
    stopPlayheadLoop();
  } else {
    if (player && state.audioUrl) {
      player.currentTime = state.currentTime;
      player.play().catch(e => console.warn(e));
    }
    state.isPlaying = true;
    startPlayheadLoop();
  }
  updatePlayIcon();
}

function startPlayheadLoop() {
  if (_playheadLoop) clearInterval(_playheadLoop);
  const startTime = Date.now();
  const startCurrent = state.currentTime;
  _playheadLoop = setInterval(() => {
    const player = document.getElementById('audioPlayer');
    if (player && state.audioUrl && !player.paused && !player.ended) {
      state.currentTime = player.currentTime;
    } else if (state.audioUrl && player && player.ended) {
      state.isPlaying = false;
      updatePlayIcon();
      stopPlayheadLoop();
      return;
    } else {
      const elapsed = (Date.now() - startTime) / 1000;
      state.currentTime = startCurrent + elapsed;
      const maxEnd = state.lyrics.reduce((m, l) => Math.max(m, l.start + l.duration), 0);
      if (state.currentTime > maxEnd) {
        state.isPlaying = false;
        updatePlayIcon();
        stopPlayheadLoop();
        return;
      }
    }
    const x = state.currentTime * PX_PER_SEC;
    const playhead = document.getElementById('playhead');
    if (playhead) playhead.style.left = x + 'px';
    updateTimeDisplay();
    syncPlayheadToLyric();
  }, 50);
}
function stopPlayheadLoop() {
  if (_playheadLoop) { clearInterval(_playheadLoop); _playheadLoop = null; }
}

function updatePlayIcon() {
  const icon = document.getElementById('playIcon');
  if (!icon) return;
  icon.innerHTML = state.isPlaying
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
   👁️ Preview
   ============================================ */
function renderPreview() {
  const songEl = document.getElementById('previewSong');
  const artistEl = document.getElementById('previewArtist');
  if (songEl) songEl.textContent = state.songName;
  if (artistEl) artistEl.textContent = state.artistName;
  const a = state.lyrics[state.activeSegment];
  if (a) {
    const lyricEl = document.getElementById('previewLyric');
    if (lyricEl) lyricEl.textContent = a.text || 'اكتب الكلمات';
  }
}

function selectLyricInPreview() {
  document.getElementById('lyricElement').classList.toggle('selected');
}
function selectCover() {
  document.getElementById('previewCover').classList.toggle('selected');
}
function selectBackground() {
  document.getElementById('bgLayer').classList.toggle('selected');
}
function openCoverPicker() {
  alert('اختيار صورة الغلاف — راح نزيدوها في المرحلة B');
}
function openBackgroundPicker() {
  alert('اختيار الخلفية — راح نزيدوها في المرحلة B');
}

/* ============================================
   🔤 Font
   ============================================ */
function initFontControls() {
  document.querySelectorAll('.font-family-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.font-family-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.font.family = btn.dataset.font;
      applyFont();
    });
  });
  const range = document.getElementById('fontSizeRange');
  if (range) range.addEventListener('input', (e) => {
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
  document.querySelectorAll('.effect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.effect-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.font.anim = btn.dataset.anim;
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
   🎵 Audio Trim
   ============================================ */
function openAudioTrim() {
  if (!state.audioUrl) return;
  document.getElementById('audioTrimSheet').classList.add('open');
  document.getElementById('sheetBackdrop').classList.add('open');
  document.getElementById('trimStartVal').textContent = state.audioTrim.start.toFixed(1);
  document.getElementById('trimEndVal').textContent = state.audioTrim.end.toFixed(1);
}
function closeAudioTrim() {
  document.getElementById('audioTrimSheet').classList.remove('open');
  document.getElementById('sheetBackdrop').classList.remove('open');
}
function applyAudioTrim() {
  updateAudioSegment();
  closeAudioTrim();
}

/* ============================================
   🚪 Misc
   ============================================ */
function closeEditor() {
  if (confirm('إغلاق المشروع؟ كل التعديلات راح تروح.')) {
    window.location.href = 'index.html';
  }
}
function exportVideo() { alert('التصدير راح يتوفر قريباً! 🎬'); }
function undoAction() {}
function redoAction() {}
