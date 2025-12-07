const { ipcRenderer } = require('electron');

const urlInput = document.getElementById('url');
const playlistCheck = document.getElementById('playlistCheck');
const formatSelect = document.getElementById('format');
const downloadBtn = document.getElementById('downloadBtn');
const spinner = document.getElementById('spinner');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const statusText = document.getElementById('statusText');
const message = document.getElementById('message');

let isDownloading = false;

downloadBtn.addEventListener('click', () => {
  if (isDownloading) return;

  const url = urlInput.value.trim();
  const format = formatSelect.value;

  if (!url) {
    showMessage('Please enter a YouTube URL', 'error');
    return;
  }

  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
    showMessage('Please enter a valid YouTube URL', 'error');
    return;
  }

  const isPlaylist = playlistCheck.checked;
  startDownload(url, format, isPlaylist);
});

function startDownload(url, format, isPlaylist) {
  isDownloading = true;
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Downloading...';
  spinner.style.display = 'block';
  progressContainer.style.display = 'none';
  message.style.display = 'none';

  ipcRenderer.send('start-download', { url, format, isPlaylist });
}

function resetUI() {
  isDownloading = false;
  downloadBtn.disabled = false;
  downloadBtn.textContent = 'Download';
  spinner.style.display = 'none';
  progressContainer.style.display = 'none';
  progressFill.style.width = '0%';
  progressText.textContent = '0%';
  statusText.textContent = 'Processing...';
}

function showMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type}`;
  message.style.display = 'block';
}

ipcRenderer.on('download-status', (event, status) => {
  spinner.style.display = 'none';
  progressContainer.style.display = 'block';
  statusText.textContent = status;
});

ipcRenderer.on('download-progress', (event, percent) => {
  progressFill.style.width = percent + '%';
  progressText.textContent = percent + '%';
});

ipcRenderer.on('download-complete', (event, filePath) => {
  resetUI();
  showMessage(`✓ Download complete! Saved to: ${filePath}`, 'success');
});

ipcRenderer.on('download-error', (event, error) => {
  resetUI();
  showMessage(`✗ Error: ${error}`, 'error');
});

ipcRenderer.on('download-cancelled', () => {
  resetUI();
  showMessage('Download cancelled', 'error');
});

urlInput.addEventListener('input', () => {
  if (message.style.display === 'block') {
    message.style.display = 'none';
  }
});
