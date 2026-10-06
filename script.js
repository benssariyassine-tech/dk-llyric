/* ============================================
   🎯 dk.llyric — Editor Logic v2 (CapCut Style)
   ============================================ */

const state = {
  coverUrl: null,
  audioUrl: null,
  audioName: '',
  songName: 'اسم الأغنية',
  artistName: 'اسم الفنان',
  lyrics: [
    { text: 'راجع بتقولي اللي ما بينا', duration: 4 },
    { text: 'راجع', duration: 3 }
  ],
  font: {
    family: 'Cairo',
    size: 24,
    weight: 800,
    color: '#ffffff',
    effect: 'shadow'
  },
  activeSegment: 0
};

let currentTab = null;
const PX_PER_SEC = 22; // كم بكسل لكل ثانية في الـ timeline

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initCoverUpload();
  initAudioUpload();
  initTextInputs();
  initFontControls();
  renderLyricsList();
  renderTimeline();
  renderPreview();
  updatePreviewFont();
});

/* ============================================
   🎛️ Tabs
   ============================================ */
function openTab(tabName, btnEl) {
  if (currentTab === tabName) {
    closeSheet();
    return;
  }
  currentTab = tabName;

  document.querySelectorAll('.editor-nav-item').forEach(el => el.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  document.querySelectorAll('.sheet-content').forEach(el => el.classList.remove('active'));
  const target = document.querySelector(`[data-sheet="${tabName}"]`);
  if (target) target.classList.add('active');

  document.getElementById('bottomSheet').classList.add('open');
  document.getElementById('sheetBackdrop').classList.add('open');

  // افتح الـ timeline غير في تاب الكلمات
  if (tabName === 'lyrics') {
    document.getElementById('timelineWrap').classList.add('open');
    document.body.classList.add('timeline-open');
  } else {
    document.getElementById('timelineWrap').classList.remove('open');
    document.body.classList.remove('timeline-open');
  }

  if (navigator.vibrate) try { navigator.vibrate(8); } catch(e) {}
}

function closeSheet() {
  currentTab = null;
  document.querySelectorAll('.editor-nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('bottomSheet').classList.remove('open');
  document.getElementById('sheetBackdrop').classList.remove('open');
  document.getElementById('timelineWrap').classList.remove('open');
  document.body.classList.remove('timeline-open');
}

/* ============================================
   📸 Cover
   ============================================ */
function initCoverUpload() {
  const input = document.getElementById('coverInput');
  if (!input) return;
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('الصورة كبيرة بزاف (5MB max)'); return; }
    if (state.coverUrl) URL.revokeObjectURL(state.coverUrl);
    state.coverUrl = URL.createObjectURL(file);
    showCoverPreview(state.coverUrl, file.name);
    renderPreview();
    updateAmbient();
  });
}
function showCoverPreview(url, name) {
  document.getElementById('coverUploadBtn').classList.add('hidden');
  const preview = document.getElementById('coverPreview');
  preview.classList.remove('hidden');
  document.getElementById('coverPreviewImg').src = url;
  document.getElementById('coverPreviewName').textContent = name;
}
function removeCover() {
  if (state.coverUrl) URL.revokeObjectURL(state.coverUrl);
  state.coverUrl = null;
  document.getElementById('coverUploadBtn').classList.remove('hidden');
  document.getElementById('coverPreview').classList.add('hidden');
  document.getElementById('coverInput').value = '';
  renderPreview();
  updateAmbient();
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
    if (file.size > 30 * 1024 * 1024) { alert('الملف كبير بزاف (30MB max)'); return; }
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    state.audioUrl = URL.createObjectURL(file);
    state.audioName = file.name;
    showAudioPreview(file);
    const player = document.getElementById('audioPlayer');
    player.src = state.audioUrl;
    player.classList.remove('hidden');
  });
}
function showAudioPreview(file) {
  document.getElementById('audioUploadBtn').classList.add('hidden');
  const preview = document.getElementById('audioPreview');
  preview.classList.remove('hidden');
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  document.getElementById('audioPreviewName').textContent = file.name;
  document.getElementById('audioPreviewMeta').textContent = sizeMB + ' MB';
}
function removeAudio() {
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = null;
  state.audioName = '';
  document.getElementById('audioUploadBtn').classList.remove('hidden');
  document.getElementById('audioPreview').classList.add('hidden');
  document.getElementById('audioPlayer').classList.add('hidden');
  document.getElementById('audioInput').value = '';
  document.getElementById('audioPlayer').src = '';
}

/* ============================================
   ✏️ Info
   ============================================ */
function initTextInputs() {
  const songInput = document.getElementById('songNameInput');
  const artistInput = document.getElementById('artistNameInput');
  if (songInput) songInput.addEventListener('input', (e) => {
    state.songName = e.target.value || 'اسم الأغنية';
    renderPreview();
  });
  if (artistInput) artistInput.addEventListener('input', (e) => {
    state.artistName = e.target.value || 'اسم الفنان';
    renderPreview();
  });
}

/* ============================================
   🔤 Font Controls
   ============================================ */
function initFontControls() {
  // Font family
  document.querySelectorAll('.font-family-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.font-family-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.font.family = btn.dataset.font;
      updatePreviewFont();
    });
  });

  // Size slider
  const sizeRange = document.getElementById('fontSizeRange');
  if (sizeRange) {
    sizeRange.addEventListener('input', (e) => {
      state.font.size = parseInt(e.target.value);
      document.getElementById('fontSizeVal').textContent = state.font.size;
      updatePreviewFont();
    });
  }

  // Weight
  document.querySelectorAll('.font-weight-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.font-weight-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.font.weight = parseInt(btn.dataset.weight);
      updatePreviewFont();
    });
  });

  // Color
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.font.color = btn.dataset.color;
      updatePreviewFont();
    });
  });

  // Effect
  document.querySelectorAll('.effect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.effect-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.font.effect = btn.dataset.effect;
      updatePreviewFont();
    });
  });
}

function updatePreviewFont() {
  const el = document.getElementById('previewLyric');
  if (!el) return;
  el.style.fontFamily = `'${state.font.family}', sans-serif`;
  el.style.fontSize = state.font.size + 'px';
  el.style.fontWeight = state.font.weight;
  el.style.color = state.font.color;

  // Effect
  if (state.font.effect === 'shadow') {
    el.style.textShadow = '0 4px 20px rgba(0,0,0,0.8)';
  } else if (state.font.effect === 'glow') {
    el.style.textShadow = `0 0 20px ${state.font.color}, 0 0 40px ${state.font.color}`;
  } else {
    el.style.textShadow = 'none';
  }
}

/* ============================================
   📝 Lyrics List
   ============================================ */
function addLyricLine() {
  state.lyrics.push({ text: '', duration: 3 });
  renderLyricsList();
  renderTimeline();
}

function removeLyricLine(index) {
  if (state.lyrics.length <= 1) { alert('على الأقل سطر واحد'); return; }
  state.lyrics.splice(index, 1);
  if (state.activeSegment >= state.lyrics.length) state.activeSegment = state.lyrics.length - 1;
  renderLyricsList();
  renderTimeline();
  renderPreview();
}

function updateLyricText(index, text) {
  state.lyrics[index].text = text;
  renderTimeline();
  renderPreview();
}

function renderLyricsList() {
  const container = document.getElementById('lyricsList');
  if (!container) return;
  container.innerHTML = '';

  state.lyrics.forEach((lyric, index) => {
    const row = document.createElement('div');
    row.className = 'lyric-row';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'lyric-text-input';
    textInput.placeholder = 'السطر ' + (index + 1);
    textInput.value = lyric.text;
    textInput.addEventListener('input', (e) => updateLyricText(index, e.target.value));
    textInput.addEventListener('focus', () => {
      state.activeSegment = index;
      renderTimeline();
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'lyric-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => removeLyricLine(index);

    row.appendChild(textInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });
}

/* ============================================
   🎞️ Timeline
   ============================================ */
function renderTimeline() {
  const track = document.getElementById('timelineTrack');
  if (!track) return;

  track.innerHTML = '';
  let totalDuration = 0;

  state.lyrics.forEach((lyric, index) => {
    const seg = document.createElement('div');
    seg.className = 'timeline-segment' + (index === state.activeSegment ? ' active' : '');
    seg.style.width = (lyric.duration * PX_PER_SEC) + 'px';
    seg.textContent = lyric.text || `السطر ${index + 1}`;
    seg.dataset.index = index;

    seg.addEventListener('click', () => {
      state.activeSegment = index;
      renderTimeline();
    });

    // Handle resize
    const handle = document.createElement('div');
    handle.className = 'seg-resize';
    handle.addEventListener('mousedown', (e) => startResize(e, index));
    handle.addEventListener('touchstart', (e) => startResize(e, index), { passive: false });
    seg.appendChild(handle);

    track.appendChild(seg);
    totalDuration += lyric.duration;
  });

  document.getElementById('timelineTotal').textContent = totalDuration.toFixed(1) + 's';
  updatePlayhead();
}

let _resize = { active: false, index: 0, startX: 0, startDuration: 0 };

function startResize(e, index) {
  e.preventDefault();
  e.stopPropagation();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  _resize = { active: true, index, startX: clientX, startDuration: state.lyrics[index].duration };
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
  // في RTL، الحساب مقلوب
  const deltaSec = -dx / PX_PER_SEC;
  let newDur = _resize.startDuration + deltaSec;
  newDur = Math.max(0.5, Math.min(30, newDur));
  state.lyrics[_resize.index].duration = Math.round(newDur * 10) / 10;
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
   ▶️ Playhead (فقط ديكور دابا)
   ============================================ */
function updatePlayhead() {
  const playhead = document.getElementById('timelinePlayhead');
  if (!playhead) return;
  playhead.style.left = '16px';
}

/* ============================================
   👁️ Preview
   ============================================ */
function renderPreview() {
  const songEl = document.getElementById('previewSong');
  const artistEl = document.getElementById('previewArtist');
  const cover = document.getElementById('previewCover');
  const lyricEl = document.getElementById('previewLyric');

  if (songEl) songEl.textContent = state.songName;
  if (artistEl) artistEl.textContent = state.artistName;
  if (cover) cover.src = state.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&q=80';

  if (lyricEl) {
    const active = state.lyrics[state.activeSegment];
    lyricEl.textContent = (active && active.text) ? active.text : 'اكتب الكلمات';
  }
}

/* ============================================
   🌫️ Ambient
   ============================================ */
function updateAmbient() {
  const ambient = document.getElementById('ambientBg');
  if (!ambient) return;
  if (state.coverUrl) {
    ambient.style.setProperty('--ambient-image', `url('${state.coverUrl}')`);
  } else {
    ambient.style.removeProperty('--ambient-image');
  }
}

/* ============================================
   📥 Export (مؤقت)
   ============================================ */
function exportVideo() {
  const total = state.lyrics.reduce((s, l) => s + l.duration, 0).toFixed(1);
  alert(`التصدير راح ياخذ ${total} ثانية.\n\nالتصدير الكامل راح يتوفر في المرحلة القادمة!`);
}
