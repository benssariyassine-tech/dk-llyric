/* ============================================
   🎯 dk.llyric — Editor Logic v3 (Smooth + Fade)
   ============================================ */

const PX_PER_SEC = 30; // سرعة أكبر = سحب أسرع
const LONG_PRESS_MS = 400;

const state = {
  audioUrl: null,
  audioDuration: 0,
  currentTime: 0,
  isPlaying: false,
  isLooping: false,
  songName: 'راجع',
  artistName: 'عمرو دياب',
  lyrics: [
    { text: 'راجع بتقولي اللي ما بينا', start: 0, duration: 4 },
    { text: 'راجع', start: 4, duration: 3 }
  ],
  activeSegment: -1,
  font: { family: 'Cairo', size: 24, weight: 800, color: '#ffffff', anim: 'fadeUp' },
  audioEffects: {
    fadeIn: { enabled: false, duration: 1 },
    fadeOut: { enabled: false, duration: 1 },
    speed: 1,
    reverb: 0
  }
};

let currentTab = null;
let _resize = null;
let _move = null;
let _longPressTimer = null;

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initAudioUpload();
  renderRuler();
  renderTimeline();
  renderPreview();
  applyFont();
  initLyricDrag();
  setupPlayheadDrag();
  initFontControls();
  initAudioEffects();
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
      updateTimeDisplay();
      renderRuler();
      renderTimeline();
    };
    document.getElementById('audioUploadBtn').classList.add('hidden');
    document.getElementById('audioPreview').classList.remove('hidden');
    document.getElementById('audioPreviewName').textContent = file.name;
    document.getElementById('audioPreviewMeta').textContent = (file.size/(1024*1024)).toFixed(1) + ' MB';
    document.getElementById('audioSegment').classList.remove('hidden');
    document.getElementById('audioAddBtn').classList.add('hidden');
  });
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
}
function openAudioPicker() { document.getElementById('audioInput').click(); }

/* ============================================
   🎚️ Audio Effects
   ============================================ */
function initAudioEffects() {
  // Fade In
  const fadeInItem = document.getElementById('fadeInItem');
  if (fadeInItem) {
    fadeInItem.addEventListener('click', () => {
      state.audioEffects.fadeIn.enabled = !state.audioEffects.fadeIn.enabled;
      fadeInItem.classList.toggle('active', state.audioEffects.fadeIn.enabled);
      applyAudioFade();
    });
  }
  const fadeInSlider = document.getElementById('fadeInSlider');
  if (fadeInSlider) {
    fadeInSlider.addEventListener('input', (e) => {
      state.audioEffects.fadeIn.duration = parseFloat(e.target.value);
      document.getElementById('fadeInVal').textContent = e.target.value + 's';
      applyAudioFade();
    });
  }
  // Fade Out
  const fadeOutItem = document.getElementById('fadeOutItem');
  if (fadeOutItem) {
    fadeOutItem.addEventListener('click', () => {
      state.audioEffects.fadeOut.enabled = !state.audioEffects.fadeOut.enabled;
      fadeOutItem.classList.toggle('active', state.audioEffects.fadeOut.enabled);
      applyAudioFade();
    });
  }
  const fadeOutSlider = document.getElementById('fadeOutSlider');
  if (fadeOutSlider) {
    fadeOutSlider.addEventListener('input', (e) => {
      state.audioEffects.fadeOut.duration = parseFloat(e.target.value);
      document.getElementById('fadeOutVal').textContent = e.target.value + 's';
      applyAudioFade();
    });
  }
  // Audio cards
  document.querySelectorAll('.audio-effect-card').forEach(card => {
    card.addEventListener('click', () => {
      const effect = card.dataset.effect;
      if (effect === 'speed') {
        const speeds = [1, 0.75, 1.25, 1.5];
        const cur = speeds.indexOf(state.audioEffects.speed);
        state.audioEffects.speed = speeds[(cur + 1) % speeds.length];
        card.querySelector('.audio-effect-desc').textContent = state.audioEffects.speed + 'x';
      } else if (effect === 'reverb') {
        state.audioEffects.reverb = state.audioEffects.reverb > 0 ? 0 : 0.3;
        card.classList.toggle('active', state.audioEffects.reverb > 0);
        card.querySelector('.audio-effect-desc').textContent = state.audioEffects.reverb > 0 ? 'ON' : 'OFF';
      }
      applyAudioEffects();
    });
  });
}

function applyAudioFade() {
  // في المرحلة الجاية راح نطبقوها على الملف الصوتي
  console.log('Fade In:', state.audioEffects.fadeIn, 'Fade Out:', state.audioEffects.fadeOut);
}
function applyAudioEffects() {
  console.log('Audio Effects:', state.audioEffects);
}

/* ============================================
   ✍️ Lyrics
   ============================================ */
function addLyricLine() {
  const lastEnd = state.lyrics.reduce((max, l) => Math.max(max, l.start + l.duration), 0);
  state.lyrics.push({ text: '', start: lastEnd, duration: 3 });
  renderLyricsList();
  renderTimeline();
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
  if (index === state.activeSegment) renderPreview();
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
    inp.addEventListener('focus', () => { state.activeSegment = index; renderTimeline(); renderPreview(); });
    const btn = document.createElement('button');
    btn.className = 'lyric-remove-btn';
    btn.textContent = '×';
    btn.onclick = () => removeLyricLine(index);
    row.appendChild(inp);
    row.appendChild(btn);
    container.appendChild(row);
  });
}

function renderRuler() {
  const ruler = document.getElementById('timelineRuler');
  if (!ruler) return;
  ruler.innerHTML = '';
  ruler.style.position = 'relative';
  ruler.style.height = '20px';
  const totalSec = Math.max(state.audioDuration || 30, 10);
  for (let s = 0; s <= totalSec; s++) {
    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    tick.style.position = 'absolute';
    tick.style.left = (s * PX_PER_SEC) + 'px';
    tick.style.transform = 'translateX(-50%)';
    tick.innerHTML = `<span>${s}s</span><i></i>`;
    ruler.appendChild(tick);
  }
  ruler.style.width = (totalSec * PX_PER_SEC + 40) + 'px';
  ruler.style.minWidth = '100%';
}

function renderTimeline() {
  const trackText = document.getElementById('trackText');
  if (!trackText) return;
  trackText.style.position = 'relative';
  trackText.style.height = '46px';
  const totalSec = Math.max(state.audioDuration || 30, 10);
  trackText.style.width = (totalSec * PX_PER_SEC + 40) + 'px';
  trackText.innerHTML = '';

  state.lyrics.forEach((lyric, index) => {
    const seg = document.createElement('div');
    seg.className = 'text-segment' + (index === state.activeSegment ? ' active' : '');
    seg.style.position = 'absolute';
    seg.style.left = (lyric.start * PX_PER_SEC) + 'px';
    seg.style.width = (lyric.duration * PX_PER_SEC) + 'px';
    seg.style.marginLeft = '0';
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

    // Long Press للتحريك
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
   🎯 Resize (يمين / يسار)
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
  document.body.style.userSelect = 'none';
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
  // ✅ LTR: drag right = +
  const dx = clientX - _resize.startX;
  const deltaSec = dx / PX_PER_SEC;

  if (_resize.side === 'right') {
    // المقبض اليمين: كي نسحبو لليمين، المدة تزيد
    const d = Math.max(0.5, Math.min(30, _resize.startDur + deltaSec));
    state.lyrics[_resize.index].duration = Math.round(d * 10) / 10;
  } else {
    // المقبض اليسار: كي نسحبو لليمين، البداية تزيد والمدة تنقص
    const s = Math.max(0, _resize.startStart + deltaSec);
    const d = Math.max(0.5, _resize.startDur - deltaSec);
    state.lyrics[_resize.index].start = Math.round(s * 10) / 10;
    state.lyrics[_resize.index].duration = Math.round(d * 10) / 10;
  }
  renderTimeline();
}
function onResizeEnd() {
  if (_resize) _resize.active = false;
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  document.removeEventListener('touchmove', onResizeMove);
  document.removeEventListener('touchend', onResizeEnd);
}

/* ============================================
   👆 Long Press + Move (نقل السطر كامل)
   ============================================ */
function startLongPress(e, index, segEl) {
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  _longPressTimer = setTimeout(() => {
    // Long press نجح
    segEl.classList.add('long-pressing');
    if (navigator.vibrate) try { navigator.vibrate(15); } catch(e) {}

    // ابدأ Move
    _move = {
      active: true, index, startX: clientX, startY: clientY,
      startStart: state.lyrics[index].start, segEl,
      longPressDetected: true
    };
    document.body.style.userSelect = 'none';
    if (e.touches) {
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onMoveEnd);
    } else {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onMoveEnd);
    }
  }, LONG_PRESS_MS);

  // إذا المستخدم حرك قبل ما يكمل Long Press → نلغيه
  const cancelLongPress = () => {
    clearTimeout(_longPressTimer);
    _longPressTimer = null;
  };
  if (e.touches) {
    document.addEventListener('touchmove', cancelLongPress, { once: true });
  }
  document.addEventListener('mouseup', cancelLongPress, { once: true });
}

function onMove(e) {
  if (!_move || !_move.active) return;
  e.preventDefault();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const dx = clientX - _move.startX;
  const deltaSec = dx / PX_PER_SEC;
  const newStart = Math.max(0, _move.startStart + deltaSec);
  state.lyrics[_move.index].start = Math.round(newStart * 10) / 10;
  renderTimeline();
  // حافظ على التحديد
  const segs = document.querySelectorAll('.text-segment');
  if (segs[_move.index]) segs[_move.index].classList.add('long-pressing');
}

function onMoveEnd() {
  if (_move) {
    if (_move.segEl) _move.segEl.classList.remove('long-pressing');
    _move.active = false;
  }
  _move = null;
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', onMove);
  document.removeEventListener('mouseup', onMoveEnd);
  document.removeEventListener('touchmove', onMove);
  document.removeEventListener('touchend', onMoveEnd);
}

/* ============================================
   ▶️ Playhead
   ============================================ */
function setupPlayheadDrag() {
  const playhead = document.getElementById('playhead');
  const timelineScroll = document.getElementById('timelineScroll');
  if (!playhead || !timelineScroll) return;
  let dragging = false;
  const setFromX = (clientX) => {
    const rect = timelineScroll.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const sec = x / PX_PER_SEC;
    state.currentTime = sec;
    playhead.style.left = x + 'px';
    playhead.style.transform = 'translateX(0)';
    updateTimeDisplay();
    syncPlayheadToLyric();
  };
  playhead.addEventListener('mousedown', e => { dragging = true; setFromX(e.clientX); });
  playhead.addEventListener('touchstart', e => { dragging = true; setFromX(e.touches[0].clientX); }, { passive: true });
  document.addEventListener('mousemove', e => { if (dragging) setFromX(e.clientX); });
  document.addEventListener('touchmove', e => { if (dragging) setFromX(e.touches[0].clientX); }, { passive: true });
  document.addEventListener('mouseup', () => dragging = false);
  document.addEventListener('touchend', () => dragging = false);
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
    renderPreview();
  }
}

/* ============================================
   ▶️ Play / Pause / Loop
   ============================================ */
function togglePlay() {
  if (!state.audioUrl) { alert('ارفع أغنية أول'); return; }
  const player = document.getElementById('audioPlayer');
  if (state.isPlaying) {
    player.pause();
    state.isPlaying = false;
  } else {
    player.currentTime = state.currentTime;
    player.playbackRate = state.audioEffects.speed || 1;
    player.play();
    state.isPlaying = true;
  }
  updatePlayIcon();
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

setInterval(() => {
  const player = document.getElementById('audioPlayer');
  if (player && !player.paused && !player.ended) {
    state.currentTime = player.currentTime;
    const x = state.currentTime * PX_PER_SEC;
    const playhead = document.getElementById('playhead');
    if (playhead) { playhead.style.left = x + 'px'; playhead.style.transform = 'translateX(0)'; }
    updateTimeDisplay();
    syncPlayheadToLyric();
  }
  if (player && player.ended && state.isPlaying) {
    state.isPlaying = false;
    updatePlayIcon();
  }
}, 100);

/* ============================================
   👁️ Preview
   ============================================ */
function renderPreview() {
  const songEl = document.getElementById('previewSong');
  const artistEl = document.getElementById('previewArtist');
  const lyricEl = document.getElementById('previewLyric');
  const cover = document.getElementById('previewCover');
  if (songEl) songEl.textContent = state.songName;
  if (artistEl) artistEl.textContent = state.artistName;
  if (cover) cover.src = state.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&q=80';
  if (lyricEl) {
    const a = state.lyrics[state.activeSegment];
    lyricEl.textContent = (a && a.text) ? a.text : (state.lyrics[0].text || 'اكتب الكلمات');
    const el = document.getElementById('lyricElement');
    if (el) {
      el.style.animation = 'none';
      void el.offsetWidth;
      if (state.font.anim === 'fadeUp') el.style.animation = 'lyricFadeUp 0.5s ease';
      else if (state.font.anim === 'fadeIn') el.style.animation = 'lyricFadeIn 0.5s ease';
    }
  }
}

/* ============================================
   🎯 Lyric Drag (في المعاينة)
   ============================================ */
function initLyricDrag() {
  const el = document.getElementById('lyricElement');
  if (!el) return;
  let start = { x: 0, y: 0 };
  const onDown = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    start.x = touch.clientX; start.y = touch.clientY;
    el.classList.add('dragging');
    selectLyric();
    const onMove = (ev) => {
      const t = ev.touches ? ev.touches[0] : ev;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const onUp = () => {
      el.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchend', onUp);
    };
    if (e.touches) {
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    } else {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
    e.preventDefault();
  };
  el.addEventListener('mousedown', onDown);
  el.addEventListener('touchstart', onDown, { passive: false });
}
function selectLyric() {
  document.getElementById('lyricElement').classList.add('selected');
}
document.addEventListener('click', (e) => {
  const el = document.getElementById('lyricElement');
  if (el && !el.contains(e.target)) el.classList.remove('selected');
});

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
   🚪 Close / Export
   ============================================ */
function closeEditor() {
  if (confirm('هل تريد إغلاق المشروع؟ كل التعديلات راح تروح.')) {
    window.location.href = 'index.html';
  }
}
function exportVideo() { alert('التصدير راح يتوفر قريباً! 🎬'); }
function undoAction() { console.log('Undo'); }
function redoAction() { console.log('Redo'); }

/* Animations */
const style = document.createElement('style');
style.textContent = `
@keyframes lyricFadeUp {
  from { opacity: 0; transform: translateY(15px); filter: blur(6px); }
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}
@keyframes lyricFadeIn {
  from { opacity: 0; filter: blur(6px); }
  to { opacity: 1; filter: blur(0); }
}
`;
document.head.appendChild(style);
