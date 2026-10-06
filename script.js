/* ============================================
   🎯 dk.llyric — CapCut-Style Editor Logic
   ============================================ */

const PX_PER_SEC = 22;
const state = {
  coverUrl: null,
  audioUrl: null,
  audioDuration: 0,
  currentTime: 0,
  isPlaying: false,
  songName: 'راجع',
  artistName: 'عمرو دياب',
  lyrics: [
    { text: 'راجع بتقولي اللي ما بينا', start: 0, duration: 4 },
    { text: 'راجع', start: 4, duration: 3 }
  ],
  activeSegment: -1,
  font: { family: 'Cairo', size: 24, weight: 800, color: '#ffffff', anim: 'fadeUp' }
};

let currentTab = null;
let dragState = { active: false, offsetX: 0, offsetY: 0 };

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
    // أظهر في timeline
    document.getElementById('audioSegment').classList.remove('hidden');
    document.getElementById('audioAddBtn').classList.add('hidden');
    document.getElementById('audioLabel').textContent = 'Imported audio';
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
function openAudioPicker() {
  document.getElementById('audioInput').click();
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

/* ============================================
   🎞️ Timeline
   ============================================ */
function renderRuler() {
  const ruler = document.getElementById('timelineRuler');
  if (!ruler) return;
  ruler.innerHTML = '';
  const totalSec = Math.max(state.audioDuration || 30, 10);
  for (let s = 0; s <= totalSec; s++) {
    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    tick.innerHTML = `<span>${s}s</span><i></i>`;
    ruler.appendChild(tick);
  }
}

function renderTimeline() {
  const trackText = document.getElementById('trackText');
  if (!trackText) return;
  trackText.innerHTML = '';
  state.lyrics.forEach((lyric, index) => {
    const seg = document.createElement('div');
    seg.className = 'text-segment' + (index === state.activeSegment ? ' active' : '');
    seg.style.width = (lyric.duration * PX_PER_SEC) + 'px';
    seg.textContent = lyric.text || `السطر ${index + 1}`;
    seg.dataset.index = index;
    seg.addEventListener('click', () => {
      state.activeSegment = index;
      renderTimeline();
      renderPreview();
    });
    // Handle يمين + يسار
    ['left', 'right'].forEach(side => {
      const handle = document.createElement('div');
      handle.className = `seg-handle ${side}`;
      handle.addEventListener('mousedown', e => startResize(e, index, side));
      handle.addEventListener('touchstart', e => startResize(e, index, side), { passive: false });
      seg.appendChild(handle);
    });
    trackText.appendChild(seg);
  });
}

let _resize = { active: false, index: 0, side: 'right', startX: 0, startDur: 0, startStart: 0 };
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
  if (!_resize.active) return;
  e.preventDefault();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const dx = clientX - _resize.startX;
  const deltaSec = -dx / PX_PER_SEC;
  if (_resize.side === 'right') {
    let d = Math.max(0.5, Math.min(30, _resize.startDur + deltaSec));
    state.lyrics[_resize.index].duration = Math.round(d * 10) / 10;
  } else {
    let s = Math.max(0, _resize.startStart + deltaSec);
    let d = Math.max(0.5, _resize.startDur - deltaSec);
    state.lyrics[_resize.index].start = Math.round(s * 10) / 10;
    state.lyrics[_resize.index].duration = Math.round(d * 10) / 10;
  }
  renderTimeline();
}
function onResizeEnd() {
  _resize.active = false;
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  document.removeEventListener('touchmove', onResizeMove);
  document.removeEventListener('touchend', onResizeEnd);
}

/* ============================================
   ▶️ Playhead Scrub
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
   ▶️ Play/Pause
   ============================================ */
function togglePlay() {
  if (!state.audioUrl) { alert('ارفع أغنية أول'); return; }
  const player = document.getElementById('audioPlayer');
  if (state.isPlaying) {
    player.pause();
    state.isPlaying = false;
  } else {
    player.currentTime = state.currentTime;
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

// audio timeupdate
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
    // أنيميشن fade up
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
   🎯 Lyric Drag
   ============================================ */
function initLyricDrag() {
  const el = document.getElementById('lyricElement');
  if (!el) return;
  let start = { x: 0, y: 0, tx: 0, ty: 0 };
  const onDown = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    start.x = touch.clientX; start.y = touch.clientY;
    start.tx = el.offsetLeft; start.ty = el.offsetTop;
    el.classList.add('dragging');
    selectLyric();
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
    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const onUp = () => {
    el.classList.remove('dragging');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchend', onUp);
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
   🔤 Font Controls
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
   🌫️ Ambient
   ============================================ */
// ملفوف في زر رفع الصورة إذا حبيت

/* ============================================
   🚪 Close / Export
   ============================================ */
function closeEditor() {
  if (confirm('هل تريد إغلاق المشروع؟ كل التعديلات راح تروح.')) {
    window.location.href = 'index.html';
  }
}
function exportVideo() {
  alert('التصدير راح يتوفر قريباً! 🎬');
}
function undoAction() { console.log('Undo'); }
function redoAction() { console.log('Redo'); }

/* ============================================
   🎬 Animations
   ============================================ */
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
