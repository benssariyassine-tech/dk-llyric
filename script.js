/* ============================================
   🎯 dk.llyric — Editor Logic (CapCut Style)
   ============================================ */

const state = {
  coverUrl: null,
  coverName: '',
  audioUrl: null,
  audioName: '',
  songName: 'اسم الأغنية',
  artistName: 'اسم الفنان',
  lyrics: [
    { text: 'راجع بتقولي اللي ما بينا', time: 3 }
  ]
};

let currentTab = null;

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initCoverUpload();
  initAudioUpload();
  initTextInputs();
  renderLyrics();
  renderPreview();
});

/* ============================================
   🎛️ Tabs (Bottom Nav)
   ============================================ */
function openTab(tabName, btnEl) {
  // إلا نفس التاب مفتوح → سد الـ sheet
  if (currentTab === tabName) {
    closeSheet();
    return;
  }
  
  currentTab = tabName;
  
  // حدّث الـ nav
  document.querySelectorAll('.editor-nav-item').forEach(el => el.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  
  // بدّل محتوى الـ sheet
  document.querySelectorAll('.sheet-content').forEach(el => el.classList.remove('active'));
  const target = document.querySelector(`[data-sheet="${tabName}"]`);
  if (target) target.classList.add('active');
  
  // افتح الـ sheet
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
   📸 صورة الغلاف
   ============================================ */
function initCoverUpload() {
  const input = document.getElementById('coverInput');
  if (!input) return;
  
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      alert('الصورة كبيرة بزاف (الأقصى 5MB)');
      return;
    }
    
    if (state.coverUrl) URL.revokeObjectURL(state.coverUrl);
    state.coverUrl = URL.createObjectURL(file);
    state.coverName = file.name;
    
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
  state.coverName = '';
  
  document.getElementById('coverUploadBtn').classList.remove('hidden');
  document.getElementById('coverPreview').classList.add('hidden');
  document.getElementById('coverInput').value = '';
  
  renderPreview();
  updateAmbient();
}

/* ============================================
   🎵 الأغنية
   ============================================ */
function initAudioUpload() {
  const input = document.getElementById('audioInput');
  if (!input) return;
  
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 30 * 1024 * 1024) {
      alert('الملف كبير بزاف (الأقصى 30MB)');
      return;
    }
    
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
   ✏️ المعلومات
   ============================================ */
function initTextInputs() {
  const songInput = document.getElementById('songNameInput');
  const artistInput = document.getElementById('artistNameInput');
  
  if (songInput) {
    songInput.addEventListener('input', (e) => {
      state.songName = e.target.value || 'اسم الأغنية';
      renderPreview();
    });
  }
  
  if (artistInput) {
    artistInput.addEventListener('input', (e) => {
      state.artistName = e.target.value || 'اسم الفنان';
      renderPreview();
    });
  }
}

/* ============================================
   📝 الكلمات
   ============================================ */
function addLyricLine() {
  state.lyrics.push({ text: '', time: 0 });
  renderLyrics();
}

function removeLyricLine(index) {
  if (state.lyrics.length <= 1) {
    alert('خاصك على الأقل سطر واحد');
    return;
  }
  state.lyrics.splice(index, 1);
  renderLyrics();
  renderPreview();
}

function updateLyricText(index, text) {
  state.lyrics[index].text = text;
  renderPreview();
}

function updateLyricTime(index, time) {
  state.lyrics[index].time = parseFloat(time) || 0;
}

function renderLyrics() {
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
    
    const timeInput = document.createElement('input');
    timeInput.type = 'number';
    timeInput.className = 'lyric-time-input';
    timeInput.placeholder = 'ثانية';
    timeInput.min = '0';
    timeInput.step = '0.1';
    timeInput.value = lyric.time;
    timeInput.addEventListener('input', (e) => updateLyricTime(index, e.target.value));
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'lyric-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => removeLyricLine(index);
    
    row.appendChild(textInput);
    row.appendChild(timeInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });
}

/* ============================================
   👁️ المعاينة
   ============================================ */
function renderPreview() {
  const songEl = document.getElementById('previewSong');
  const artistEl = document.getElementById('previewArtist');
  const cover = document.getElementById('previewCover');
  const lyricEl = document.getElementById('previewLyric');
  
  if (songEl) songEl.textContent = state.songName;
  if (artistEl) artistEl.textContent = state.artistName;
  
  if (cover) {
    cover.src = state.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&q=80';
  }
  
  if (lyricEl) {
    const firstLyric = state.lyrics.find(l => l.text.trim() !== '');
    lyricEl.textContent = firstLyric ? firstLyric.text : 'اكتب الكلمات من القائمة السفلية';
  }
}

/* ============================================
   🌫️ الخلفية
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
   📥 تصدير (مؤقتاً رسالة)
   ============================================ */
function exportVideo() {
  alert('التصدير راح يكون متاح في المرحلة القادمة! 🎬');
}
