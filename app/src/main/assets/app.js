import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  pdfInput: $('#pdfInput'), fileMeta: $('#fileMeta'), fileName: $('#fileName'), pageCount: $('#pageCount'),
  chunkCount: $('#chunkCount'), durationEstimate: $('#durationEstimate'), voiceSelect: $('#voiceSelect'),
  rateSelect: $('#rateSelect'), modeSelect: $('#modeSelect'), sleepSelect: $('#sleepSelect'),
  prevBtn: $('#prevBtn'), nextBtn: $('#nextBtn'), backBtn: $('#backBtn'), forwardBtn: $('#forwardBtn'),
  playBtn: $('#playBtn'), stopBtn: $('#stopBtn'), progress: $('#progress'), progressText: $('#progressText'),
  resetProgressBtn: $('#resetProgressBtn'), sectionTitle: $('#sectionTitle'), currentChapter: $('#currentChapter'),
  pageBadge: $('#pageBadge'), textDisplay: $('#textDisplay'), appStatus: $('#appStatus'), sleepStatus: $('#sleepStatus'),
  percentProgress: $('#percentProgress'), currentPageStat: $('#currentPageStat'), remainingTime: $('#remainingTime'),
  libraryList: $('#libraryList'), chapterList: $('#chapterList'), bookmarkList: $('#bookmarkList'),
  clearLibraryBtn: $('#clearLibraryBtn'), rescanChaptersBtn: $('#rescanChaptersBtn'), exportNotesBtn: $('#exportNotesBtn'),
  searchInput: $('#searchInput'), searchBtn: $('#searchBtn'), searchResults: $('#searchResults'),
  searchResultsList: $('#searchResultsList'), closeSearchBtn: $('#closeSearchBtn'), bookmarkBtn: $('#bookmarkBtn'),
  copyBtn: $('#copyBtn'), fullscreenBtn: $('#fullscreenBtn'), themeBtn: $('#themeBtn'), mobileMenuBtn: $('#mobileMenuBtn'),
  sidebar: $('#sidebar'), floatingPlayer: $('#floatingPlayer'), floatingTitle: $('#floatingTitle'), floatingMeta: $('#floatingMeta'),
  floatingPrev: $('#floatingPrev'), floatingPlay: $('#floatingPlay'), floatingNext: $('#floatingNext'),
  fontMinusBtn: $('#fontMinusBtn'), fontPlusBtn: $('#fontPlusBtn'), fontSizeLabel: $('#fontSizeLabel'),
  noteDialog: $('#noteDialog'), notePreview: $('#notePreview'), noteInput: $('#noteInput'), saveNoteBtn: $('#saveNoteBtn')
};

const state = {
  book: null,
  currentIndex: 0,
  isPlaying: false,
  voices: [],
  chapters: [],
  bookmarks: [],
  sleepTimer: null,
  sleepDeadline: null,
  sleepChapterEndIndex: null,
  fontSize: Number(localStorage.getItem('reader-font-size') || 22)
};

const LIBRARY_KEY = 'cantonese-reader-library-v2';
const THEME_KEY = 'cantonese-reader-theme-v2';

function setStatus(text) { els.appStatus.textContent = text; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h) return `${h} 小時 ${m} 分`;
  return `${Math.max(1, m)} 分鐘`;
}
function normalizeText(text) {
  return text.replace(/\s+/g, ' ').replace(/\s+([，。！？；：、])/g, '$1').replace(/([（「『《])\s+/g, '$1').trim();
}
function splitIntoChunks(text, pageNumber, maxChars = 280) {
  const units = text.split(/(?<=[。！？!?；;：:])/).map(v => v.trim()).filter(Boolean);
  const chunks = [];
  let buffer = '';
  for (const unit of units.length ? units : [text]) {
    if ((buffer + unit).length > maxChars && buffer) {
      chunks.push({ pageNumber, text: buffer.trim() });
      buffer = unit;
    } else {
      buffer += `${buffer ? ' ' : ''}${unit}`;
    }
  }
  if (buffer.trim()) chunks.push({ pageNumber, text: buffer.trim() });
  return chunks;
}
function toHongKongCantonese(input) {
  let text = input;
  const rules = [
    [/並沒有/g,'並冇'],[/沒有/g,'冇'],[/不是/g,'唔係'],[/不會/g,'唔會'],[/不能/g,'唔可以'],[/不需要/g,'唔需要'],[/不知道/g,'唔知道'],[/不要/g,'唔好'],
    [/這個/g,'呢個'],[/這些/g,'呢啲'],[/這樣/g,'咁樣'],[/這裡/g,'呢度'],[/那個/g,'嗰個'],[/那些/g,'嗰啲'],[/那裡/g,'嗰度'],
    [/他們/g,'佢哋'],[/她們/g,'佢哋'],[/它們/g,'佢哋'],[/我們/g,'我哋'],[/你們/g,'你哋'],[/他/g,'佢'],[/她/g,'佢'],
    [/為什麼/g,'點解'],[/什麼/g,'乜嘢'],[/怎樣/g,'點樣'],[/怎麼/g,'點樣'],[/哪裡/g,'邊度'],[/現在/g,'而家'],[/今天/g,'今日'],[/明天/g,'聽日'],[/昨天/g,'尋日'],
    [/但是/g,'但係'],[/因此/g,'所以'],[/很多/g,'好多'],[/一些/g,'一啲'],[/正在/g,'正喺'],[/進行中/g,'進行緊'],[/的/g,'嘅'],[/是/g,'係'],[/在/g,'喺'],[/了/g,'咗'],[/和/g,'同'],[/不/g,'唔']
  ];
  for (const [pattern, replacement] of rules) text = text.replace(pattern, replacement);
  return text.replace(/喺於/g,'在於').replace(/唔係咪/g,'係咪').replace(/唔同意唔/g,'不同意');
}
function selectedVoice() {
  return state.voices.find(v => v.voiceURI === els.voiceSelect.value) || state.voices.find(v => /zh[-_]HK/i.test(v.lang)) || null;
}
function bookKey(book = state.book) { return book ? `${book.name}::${book.pages}::${book.fingerprint || ''}` : ''; }
function getProgressKey() { return `reader-progress-v2:${bookKey()}`; }
function getBookmarksKey() { return `reader-bookmarks-v2:${bookKey()}`; }
function getCurrentChunk() { return state.book?.chunks[state.currentIndex] || null; }
function currentText() {
  const item = getCurrentChunk();
  if (!item) return '';
  return els.modeSelect.value === 'colloquial' ? toHongKongCantonese(item.text) : item.text;
}
function estimateSeconds(chars, rate = Number(els.rateSelect.value)) { return chars / (5.3 * Math.max(.5, rate)); }
function totalCharsFrom(index = 0) { return state.book?.chunks.slice(index).reduce((sum, c) => sum + c.text.length, 0) || 0; }

function saveLibraryEntry() {
  if (!state.book) return;
  const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
  const key = bookKey();
  const progress = state.book.chunks.length > 1 ? state.currentIndex / (state.book.chunks.length - 1) : 0;
  const entry = { key, name: state.book.name, pages: state.book.pages, chunks: state.book.chunks.length, progress, updatedAt: Date.now() };
  const next = [entry, ...library.filter(item => item.key !== key)].slice(0, 20);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
  renderLibrary();
}
function renderLibrary() {
  const library = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]');
  if (!library.length) {
    els.libraryList.innerHTML = '<p class="empty-state">未有書籍。上載 PDF 後會自動記錄。</p>';
    return;
  }
  els.libraryList.innerHTML = library.map(item => `
    <div class="library-item">
      <button data-book-key="${escapeHtml(item.key)}" title="請重新選擇相同 PDF 以載入內容">
        <strong>${escapeHtml(item.name)}</strong>
        <small>${item.pages} 頁 · 上次進度 ${Math.round((item.progress || 0) * 100)}%</small>
        <div class="library-progress"><i style="width:${Math.round((item.progress || 0) * 100)}%"></i></div>
      </button>
    </div>`).join('');
  els.libraryList.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
    setStatus('請重新選擇相同 PDF');
    els.pdfInput.click();
  }));
}
function saveProgress() {
  if (!state.book) return;
  localStorage.setItem(getProgressKey(), String(state.currentIndex));
  saveLibraryEntry();
}
function loadProgress() {
  const saved = Number(localStorage.getItem(getProgressKey()) || 0);
  state.currentIndex = clamp(Number.isFinite(saved) ? saved : 0, 0, Math.max(0, state.book.chunks.length - 1));
}
function saveBookmarks() { if (state.book) localStorage.setItem(getBookmarksKey(), JSON.stringify(state.bookmarks)); }
function loadBookmarks() {
  state.bookmarks = state.book ? JSON.parse(localStorage.getItem(getBookmarksKey()) || '[]') : [];
  renderBookmarks();
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function detectChapters(force = false) {
  if (!state.book) return;
  const patterns = [
    /^(第[一二三四五六七八九十百零〇0-9]+[章節部篇卷].{0,40})/,
    /^(Chapter\s+\d+.{0,40})/i,
    /^([一二三四五六七八九十]+、.{1,35})/,
    /^(序言|前言|導言|引言|結語|後記|附錄|目錄).{0,35}/
  ];
  const found = [];
  state.book.chunks.forEach((chunk, index) => {
    const start = chunk.text.slice(0, 80).trim();
    for (const pattern of patterns) {
      const match = start.match(pattern);
      if (match) {
        const title = match[1] || match[0];
        if (!found.some(ch => ch.title === title && Math.abs(ch.index - index) < 3)) found.push({ title, index, pageNumber: chunk.pageNumber });
        break;
      }
    }
  });
  if (!found.length || force) {
    const step = Math.max(1, Math.floor(state.book.chunks.length / 10));
    if (!found.length) for (let i = 0; i < state.book.chunks.length; i += step) found.push({ title: `第 ${found.length + 1} 部分`, index: i, pageNumber: state.book.chunks[i].pageNumber });
  }
  if (!found.some(ch => ch.index === 0)) found.unshift({ title:'開始', index:0, pageNumber:state.book.chunks[0].pageNumber });
  state.chapters = found;
  renderChapters();
}
function chapterForIndex(index) {
  return [...state.chapters].reverse().find(ch => ch.index <= index) || state.chapters[0] || null;
}
function nextChapterIndex(index) {
  return state.chapters.find(ch => ch.index > index)?.index ?? state.book?.chunks.length ?? 0;
}
function renderChapters() {
  if (!state.chapters.length) {
    els.chapterList.innerHTML = '<p class="empty-state">未偵測到章節。</p>';
    return;
  }
  els.chapterList.innerHTML = state.chapters.map(ch => `
    <div class="chapter-item">
      <button data-index="${ch.index}"><strong>${escapeHtml(ch.title)}</strong><small>第 ${ch.pageNumber} 頁</small></button>
    </div>`).join('');
  els.chapterList.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => jumpTo(Number(btn.dataset.index), true)));
}
function renderBookmarks() {
  if (!state.bookmarks.length) {
    els.bookmarkList.innerHTML = '<p class="empty-state">撳「收藏目前段落」即可保存金句。</p>';
    return;
  }
  els.bookmarkList.innerHTML = state.bookmarks.map((item, idx) => `
    <div class="bookmark-item">
      <strong>第 ${item.pageNumber} 頁 · 第 ${item.index + 1} 段</strong>
      <p>${escapeHtml(item.text.slice(0, 145))}${item.text.length > 145 ? '…' : ''}</p>
      ${item.note ? `<small>筆記：${escapeHtml(item.note)}</small>` : ''}
      <div class="bookmark-actions">
        <button data-jump="${item.index}">前往</button>
        <button data-delete="${idx}">刪除</button>
      </div>
    </div>`).join('');
  els.bookmarkList.querySelectorAll('[data-jump]').forEach(btn => btn.addEventListener('click', () => jumpTo(Number(btn.dataset.jump), true)));
  els.bookmarkList.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => {
    state.bookmarks.splice(Number(btn.dataset.delete), 1); saveBookmarks(); renderBookmarks();
  }));
}

function renderCurrent() {
  const item = getCurrentChunk();
  if (!item) return;
  const chapter = chapterForIndex(state.currentIndex);
  const pct = state.book.chunks.length > 1 ? state.currentIndex / (state.book.chunks.length - 1) : 0;
  els.sectionTitle.textContent = `第 ${state.currentIndex + 1} 段／共 ${state.book.chunks.length} 段`;
  els.currentChapter.textContent = chapter?.title || '未有章節';
  els.pageBadge.textContent = `第 ${item.pageNumber} 頁`;
  els.textDisplay.textContent = currentText();
  els.progress.max = Math.max(0, state.book.chunks.length - 1);
  els.progress.value = state.currentIndex;
  els.progressText.textContent = `第 ${state.currentIndex + 1} 段／共 ${state.book.chunks.length} 段 · PDF 第 ${item.pageNumber} 頁`;
  els.percentProgress.textContent = `${Math.round(pct * 100)}%`;
  els.currentPageStat.textContent = `${item.pageNumber} / ${state.book.pages}`;
  els.remainingTime.textContent = formatDuration(estimateSeconds(totalCharsFrom(state.currentIndex)));
  els.floatingTitle.textContent = state.book.name;
  els.floatingMeta.textContent = `${Math.round(pct * 100)}% · 第 ${item.pageNumber} 頁 · ${chapter?.title || ''}`;
  els.floatingPlayer.hidden = false;
  saveProgress();
}

const isAndroidApp = () => typeof window.AndroidTTS !== 'undefined';

function loadVoices() {
  if (isAndroidApp()) {
    state.voices = [];
    els.voiceSelect.innerHTML = '<option value="android">Android 系統香港粵語</option>';
    return;
  }
  state.voices = speechSynthesis.getVoices();
  const hk = state.voices.filter(v => /zh[-_](HK|Hant)|Cantonese|Hong Kong|粵|廣東/i.test(`${v.lang} ${v.name}`));
  const zh = state.voices.filter(v => /^zh/i.test(v.lang));
  const options = hk.length ? hk : (zh.length ? zh : state.voices);
  els.voiceSelect.innerHTML = options.length ? '' : '<option>未找到系統聲線</option>';
  options.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} (${voice.lang})`;
    els.voiceSelect.appendChild(option);
  });
  const hkIndex = options.findIndex(v => /zh[-_]HK|Hong Kong|Cantonese|粵|廣東/i.test(`${v.lang} ${v.name}`));
  if (hkIndex >= 0) els.voiceSelect.selectedIndex = hkIndex;
}
function updatePlayButtons() {
  const paused = !isAndroidApp() && speechSynthesis.paused;
  const text = state.isPlaying ? '⏸ 暫停' : (paused ? '▶ 繼續' : '▶ 播放');
  els.playBtn.textContent = text;
  els.floatingPlay.textContent = state.isPlaying ? '⏸' : '▶';
}
function advanceAfterSpeech() {
  if (!state.isPlaying) return;
  if (state.sleepChapterEndIndex !== null && state.currentIndex + 1 >= state.sleepChapterEndIndex) {
    stopSpeech('已讀完本章'); return;
  }
  if (state.currentIndex < state.book.chunks.length - 1) {
    state.currentIndex += 1; renderCurrent(); setTimeout(speakCurrent, 100);
  } else stopSpeech('全書讀完');
}
window.__androidTTSStarted = () => { state.isPlaying = true; updatePlayButtons(); setStatus('朗讀中'); };
window.__androidTTSFinished = () => advanceAfterSpeech();
window.__androidTTSError = () => stopSpeech('朗讀失敗');

function speakCurrent() {
  if (!state.book?.chunks.length) return;
  if (isAndroidApp()) {
    state.isPlaying = true;
    updatePlayButtons(); setStatus('朗讀中');
    window.AndroidTTS.stop();
    window.AndroidTTS.speak(currentText(), Number(els.rateSelect.value));
    return;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(currentText());
  utterance.lang = 'zh-HK';
  utterance.rate = Number(els.rateSelect.value);
  utterance.pitch = 1;
  const voice = selectedVoice();
  if (voice) utterance.voice = voice;
  utterance.onstart = () => { state.isPlaying = true; updatePlayButtons(); setStatus('朗讀中'); };
  utterance.onend = advanceAfterSpeech;
  utterance.onerror = event => { if (event.error !== 'interrupted' && event.error !== 'canceled') stopSpeech('朗讀失敗'); };
  speechSynthesis.speak(utterance);
}
function togglePlay() {
  if (!state.book?.chunks.length) { setStatus('請先上載 PDF'); return; }
  if (isAndroidApp()) {
    if (state.isPlaying) {
      window.AndroidTTS.stop(); state.isPlaying = false; updatePlayButtons(); setStatus('已暫停');
    } else { state.isPlaying = true; speakCurrent(); }
    return;
  }
  if (speechSynthesis.paused) {
    speechSynthesis.resume(); state.isPlaying = true; updatePlayButtons(); setStatus('朗讀中'); return;
  }
  if (state.isPlaying) {
    speechSynthesis.pause(); state.isPlaying = false; updatePlayButtons(); setStatus('已暫停');
  } else { state.isPlaying = true; speakCurrent(); }
}
function stopSpeech(status = '已停止') {
  if (isAndroidApp()) window.AndroidTTS.stop(); else speechSynthesis.cancel();
  state.isPlaying = false; updatePlayButtons(); setStatus(status);
}
function jumpTo(index, autoplay = false) {
  if (!state.book) return;
  const wasPlaying = state.isPlaying;
  stopSpeech();
  state.currentIndex = clamp(index, 0, state.book.chunks.length - 1);
  renderCurrent();
  if (autoplay || wasPlaying) speakCurrent();
  if (window.innerWidth < 1000) els.sidebar.classList.remove('open');
}
function jumpApprox(seconds) {
  if (!state.book) return;
  const avgChars = 5.3 * Number(els.rateSelect.value) * Math.abs(seconds);
  const direction = Math.sign(seconds);
  let chars = 0;
  let index = state.currentIndex;
  while (chars < avgChars && index + direction >= 0 && index + direction < state.book.chunks.length) {
    index += direction; chars += state.book.chunks[index].text.length;
  }
  jumpTo(index, state.isPlaying);
}

function configureSleepTimer() {
  clearInterval(state.sleepTimer);
  state.sleepTimer = null; state.sleepDeadline = null; state.sleepChapterEndIndex = null; els.sleepStatus.textContent = '';
  const value = els.sleepSelect.value;
  if (value === '0') return;
  if (value === 'chapter') {
    if (!state.book) return;
    state.sleepChapterEndIndex = nextChapterIndex(state.currentIndex);
    els.sleepStatus.textContent = '本章完結後停止';
    return;
  }
  const minutes = Number(value);
  state.sleepDeadline = Date.now() + minutes * 60000;
  const tick = () => {
    const remain = Math.max(0, state.sleepDeadline - Date.now());
    const m = Math.floor(remain / 60000); const s = Math.floor((remain % 60000) / 1000);
    els.sleepStatus.textContent = `睡眠：${m}:${String(s).padStart(2,'0')}`;
    if (remain <= 0) { clearInterval(state.sleepTimer); stopSpeech('睡眠計時已停止'); els.sleepStatus.textContent = ''; els.sleepSelect.value = '0'; }
  };
  tick(); state.sleepTimer = setInterval(tick, 1000);
}

async function readPdf(file) {
  stopSpeech(); setStatus('正在讀取 PDF…'); els.textDisplay.textContent = '正在抽取 PDF 文字，請稍候…';
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const chunks = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    setStatus(`讀取第 ${pageNum}/${pdf.numPages} 頁`);
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text = normalizeText(content.items.map(item => item.str).join(' '));
    if (text) chunks.push(...splitIntoChunks(text, pageNum));
  }
  if (!chunks.length) throw new Error('PDF 內未能抽取文字，可能係掃描圖片 PDF。');
  state.book = { name:file.name, pages:pdf.numPages, chunks, fingerprint:pdf.fingerprints?.[0] || `${file.size}-${file.lastModified}` };
  loadProgress(); loadBookmarks(); detectChapters();
  els.fileName.textContent = file.name; els.pageCount.textContent = String(pdf.numPages); els.chunkCount.textContent = String(chunks.length);
  els.durationEstimate.textContent = formatDuration(estimateSeconds(totalCharsFrom(0)));
  els.fileMeta.hidden = false; renderCurrent(); setStatus('可以開始播放');
}

function searchBook() {
  const query = els.searchInput.value.trim().toLowerCase();
  if (!state.book || !query) return;
  const matches = state.book.chunks.map((chunk, index) => ({chunk,index})).filter(({chunk}) => chunk.text.toLowerCase().includes(query)).slice(0, 100);
  els.searchResults.hidden = false;
  els.searchResultsList.innerHTML = matches.length ? matches.map(({chunk,index}) => {
    const pos = chunk.text.toLowerCase().indexOf(query);
    const excerpt = chunk.text.slice(Math.max(0,pos-45), pos+query.length+90);
    return `<div class="search-result"><button data-index="${index}"><small>第 ${chunk.pageNumber} 頁 · 第 ${index+1} 段</small><p>${escapeHtml(excerpt)}</p></button></div>`;
  }).join('') : '<p class="empty-state">搵唔到相關內容。</p>';
  els.searchResultsList.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => { jumpTo(Number(btn.dataset.index)); els.searchResults.hidden = true; }));
}
function openBookmarkDialog() {
  const chunk = getCurrentChunk(); if (!chunk) return;
  els.notePreview.textContent = chunk.text; els.noteInput.value = ''; els.noteDialog.showModal();
}
function saveCurrentBookmark() {
  const chunk = getCurrentChunk(); if (!chunk) return;
  if (!state.bookmarks.some(item => item.index === state.currentIndex)) {
    state.bookmarks.unshift({ index:state.currentIndex, pageNumber:chunk.pageNumber, text:chunk.text, note:els.noteInput.value.trim(), createdAt:Date.now() });
    saveBookmarks(); renderBookmarks(); setStatus('已收藏目前段落');
  } else setStatus('呢段已經收藏');
}
function exportNotes() {
  if (!state.bookmarks.length || !state.book) return;
  const content = [`# ${state.book.name} — 收藏及筆記`, '', ...state.bookmarks.flatMap(item => [`## 第 ${item.pageNumber} 頁／第 ${item.index+1} 段`, '', item.text, '', item.note ? `筆記：${item.note}` : '', ''])].join('\n');
  const blob = new Blob([content], {type:'text/markdown;charset=utf-8'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`${state.book.name.replace(/\.pdf$/i,'')}-收藏筆記.md`; a.click(); URL.revokeObjectURL(url);
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  els.themeBtn.textContent = theme === 'light' ? '🌙' : '☀️';
}
function setFontSize(size) {
  state.fontSize = clamp(size, 16, 36); document.documentElement.style.setProperty('--reader-font', `${state.fontSize}px`);
  els.fontSizeLabel.textContent = `文字 ${state.fontSize}px`; localStorage.setItem('reader-font-size', String(state.fontSize));
}

els.pdfInput.addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try { await readPdf(file); } catch (error) { console.error(error); setStatus('讀取失敗'); els.textDisplay.textContent = error?.message || '讀取 PDF 時發生錯誤。'; }
});
els.playBtn.addEventListener('click', togglePlay); els.floatingPlay.addEventListener('click', togglePlay);
els.stopBtn.addEventListener('click', () => stopSpeech());
els.prevBtn.addEventListener('click', () => jumpTo(state.currentIndex - 1, state.isPlaying));
els.nextBtn.addEventListener('click', () => jumpTo(state.currentIndex + 1, state.isPlaying));
els.floatingPrev.addEventListener('click', () => jumpTo(state.currentIndex - 1, state.isPlaying));
els.floatingNext.addEventListener('click', () => jumpTo(state.currentIndex + 1, state.isPlaying));
els.backBtn.addEventListener('click', () => jumpApprox(-30)); els.forwardBtn.addEventListener('click', () => jumpApprox(30));
els.progress.addEventListener('input', () => jumpTo(Number(els.progress.value)));
els.modeSelect.addEventListener('change', () => { const playing=state.isPlaying; stopSpeech(); renderCurrent(); if (playing) speakCurrent(); });
els.rateSelect.addEventListener('change', () => { if (state.book) { els.durationEstimate.textContent = formatDuration(estimateSeconds(totalCharsFrom(0))); renderCurrent(); } if (state.isPlaying) { stopSpeech(); speakCurrent(); } });
els.voiceSelect.addEventListener('change', () => { if (state.isPlaying) { stopSpeech(); speakCurrent(); } });
els.sleepSelect.addEventListener('change', configureSleepTimer);
els.resetProgressBtn.addEventListener('click', () => { if (!state.book) return; localStorage.removeItem(getProgressKey()); jumpTo(0); setStatus('進度已清除'); });
els.searchBtn.addEventListener('click', searchBook); els.searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchBook(); });
els.closeSearchBtn.addEventListener('click', () => els.searchResults.hidden = true);
els.bookmarkBtn.addEventListener('click', openBookmarkDialog); els.saveNoteBtn.addEventListener('click', saveCurrentBookmark);
els.copyBtn.addEventListener('click', async () => { if (!currentText()) return; await navigator.clipboard.writeText(currentText()); setStatus('文字已複製'); });
els.exportNotesBtn.addEventListener('click', exportNotes);
els.rescanChaptersBtn.addEventListener('click', () => { detectChapters(true); setStatus('已重新建立目錄'); });
els.clearLibraryBtn.addEventListener('click', () => { if (confirm('清除書櫃記錄？不會刪除你部機入面嘅 PDF。')) { localStorage.removeItem(LIBRARY_KEY); renderLibrary(); } });
els.fullscreenBtn.addEventListener('click', () => { document.body.classList.toggle('focus-mode'); els.fullscreenBtn.textContent = document.body.classList.contains('focus-mode') ? '離開專注模式' : '專注模式'; });
els.themeBtn.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
els.mobileMenuBtn.addEventListener('click', () => els.sidebar.classList.toggle('open'));
els.fontMinusBtn.addEventListener('click', () => setFontSize(state.fontSize - 2)); els.fontPlusBtn.addEventListener('click', () => setFontSize(state.fontSize + 2));
$$('.tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.tab').forEach(t => t.classList.toggle('active', t === tab));
  $$('.side-panel').forEach(panel => panel.classList.toggle('active', panel.id === tab.dataset.panel));
}));
window.addEventListener('beforeunload', () => { if (isAndroidApp()) window.AndroidTTS.stop(); else speechSynthesis.cancel(); });
window.addEventListener('scroll', () => { if (state.book) els.floatingPlayer.hidden = window.scrollY < 400; });

applyTheme(localStorage.getItem(THEME_KEY) || 'dark'); setFontSize(state.fontSize); renderLibrary(); loadVoices();
if (!isAndroidApp()) speechSynthesis.onvoiceschanged = loadVoices;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
