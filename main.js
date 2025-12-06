const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const NodeID3 = require('node-id3');

// LOGGING SETUP
const { spawn } = require('child_process');
const logFile = path.join(app.getPath('downloads'), 'musicyt-debug.log');
const log = (msg) => {
  try { fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`); } catch (e) { }
};

log(`App initiating. Packaged: ${app.isPackaged}`);

// BINARY PATH SETUP
let ytdlpBinaryPath;
let ffmpegPath; // Keep variable name compatible with usage below

if (app.isPackaged) {
  const unpackedRoot = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules');
  ytdlpBinaryPath = path.join(unpackedRoot, 'yt-dlp-exec', 'bin', 'yt-dlp.exe');
  ffmpegPath = path.join(unpackedRoot, '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe');

  log(`Packaged YTDLP: ${ytdlpBinaryPath} [Exists: ${fs.existsSync(ytdlpBinaryPath)}]`);
  log(`Packaged FFMPEG: ${ffmpegPath} [Exists: ${fs.existsSync(ffmpegPath)}]`);

  // Set Environment Variables for libraries
  process.env.YT_DLP_BINARY = ytdlpBinaryPath;
  process.env.YOUTUBE_DL_BINARY = ytdlpBinaryPath;
} else {
  // Dev mode
  ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
  // Fix: Explicitly get path for dev mode
  // Fix: Explicitly set correct path for dev mode
  ytdlpBinaryPath = path.join(__dirname, 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');
}

// Require libraries AFTER setting env
// Custom YTDLP Wrapper to bypass library path issues
const dargs = (options) => {
  const args = [];
  for (const [key, value] of Object.entries(options)) {
    if (value === false || value === undefined || value === null) continue;
    const flag = '--' + key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
    if (value === true) args.push(flag);
    else {
      args.push(flag);
      args.push(value.toString());
    }
  }
  return args;
};

const ytdlpWrapper = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const bin = ytdlpBinaryPath || require('yt-dlp-exec').path;
    const args = [url, ...dargs(options)];
    log(`[Wrapper] Spawning: ${bin} ${args.join(' ')}`);

    const child = spawn(bin, args);
    let stdoutChunks = [];
    let stderrChunks = [];

    child.stdout.on('data', chunk => stdoutChunks.push(chunk));
    child.stderr.on('data', chunk => stderrChunks.push(chunk));

    child.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString();
      const stderr = Buffer.concat(stderrChunks).toString();

      if (code === 0) {
        try {
          if (options.dumpSingleJson) resolve(JSON.parse(stdout));
          else resolve(stdout);
        } catch (e) { resolve(stdout); }
      } else {
        log(`[Wrapper] Error: ${stderr}`);
        reject(new Error(stderr || 'Process failed'));
      }
    });

    child.on('error', err => {
      log(`[Wrapper] Spawn Error: ${err.message}`);
      reject(err);
    });
  });
};

ytdlpWrapper.exec = (url, options = {}) => {
  const bin = ytdlpBinaryPath || require('yt-dlp-exec').path;
  const args = [url, ...dargs(options)];
  log(`[Wrapper-Exec] Spawning: ${bin} ${args.join(' ')}`);

  const child = spawn(bin, args);

  // Make it awaitable
  const promise = new Promise((resolve, reject) => {
    child.on('close', code => {
      if (code === 0) resolve(); else reject(new Error(`Exit code ${code}`));
    });
    child.on('error', reject);
  });

  Object.assign(child, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise)
  });

  return child;
};

const ytdlp = ytdlpWrapper;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    resizable: false
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Download thumbnail
async function downloadThumbnail(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(outputPath);
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => { });
      reject(err);
    });
  });
}

// Rename files based on ID3 tags
async function renameFilesFromTags(videoDir) {
  try {
    const files = fs.readdirSync(videoDir);
    log(`[Rename] Scanning ${files.length} files in ${videoDir}`);

    for (const file of files) {
      if (path.extname(file).toLowerCase() === '.mp3') {
        const filePath = path.join(videoDir, file);
        const tags = NodeID3.read(filePath);

        if (tags && tags.title) {
          const safeTitle = tags.title.replace(/[^\w\s-]/gi, '').trim();
          const newFileName = `${safeTitle}.mp3`;
          const newFilePath = path.join(videoDir, newFileName);

          if (filePath !== newFilePath) {
            try {
              if (fs.existsSync(newFilePath)) {
                // Handle duplicates
                let counter = 1;
                let tempPath = newFilePath;
                while (fs.existsSync(tempPath)) {
                  tempPath = path.join(videoDir, `${safeTitle} (${counter}).mp3`);
                  counter++;
                }
                fs.renameSync(filePath, tempPath);
                log(`[Rename] Renamed (duplicate): ${file} -> ${path.basename(tempPath)}`);
              } else {
                fs.renameSync(filePath, newFilePath);
                log(`[Rename] Renamed: ${file} -> ${newFileName}`);
              }
            } catch (err) {
              log(`[Rename] Error renaming ${file}: ${err.message}`);
            }
          }
        }
      }
    }
  } catch (error) {
    log(`[Rename] Main error: ${error.message}`);
  }
}

// Handle download request
// Handle download request
ipcMain.on('start-download', async (event, { url, format, isPlaylist }) => {
  console.log('Download request:', { url, format, isPlaylist });
  if (isPlaylist) {
    await handlePlaylistDownload(event, url, format);
  } else {
    await handleSingleDownload(event, url, format);
  }
});

// Handle single video download
async function handleSingleDownload(event, url, format) {
  let tempVideoPath = null;
  let tempAudioPath = null;
  let thumbnailPath = null;

  try {
    event.reply('download-status', 'Fetching video information...');

    // Get video info
    const info = await ytdlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificate: true,
      preferFreeFormats: true
    });

    const title = info.title.replace(/[^\w\s-]/gi, '').trim();
    const artist = info.uploader || 'Unknown Artist';
    const thumbnail = info.thumbnail;

    // Select save location
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `${title}.${format}`,
      filters: [
        { name: format.toUpperCase(), extensions: [format] }
      ]
    });

    if (!filePath) {
      event.reply('download-cancelled');
      return;
    }

    const tempDir = app.getPath('temp');
    tempVideoPath = null; // Not used for MP4 anymore
    tempAudioPath = path.join(tempDir, `temp_audio_${Date.now()}.m4a`);
    thumbnailPath = path.join(tempDir, `thumbnail_${Date.now()}.jpg`);

    if (format === 'mp4') {
      // Download MP4 (video + audio)
      event.reply('download-status', 'Downloading video...');

      // Use a simpler output format without template
      const simpleOutputPath = filePath;

      const ytdlpProcess = ytdlp.exec(url, {
        output: simpleOutputPath,
        format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
        mergeOutputFormat: 'mp4',
        ffmpegLocation: ffmpegPath
      });

      // Parse progress from stdout
      ytdlpProcess.stdout.on('data', (data) => {
        const output = data.toString();
        // Match pattern like "[download] 28.9% of 881.15KiB"
        const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)%/);
        if (progressMatch) {
          const percent = Math.round(parseFloat(progressMatch[1]));
          event.reply('download-progress', percent);
        }
      });

      await ytdlpProcess;

      event.reply('download-status', 'Processing video...');
      event.reply('download-complete', filePath);

    } else if (format === 'mp3') {
      // Download MP3 (audio only with metadata)
      event.reply('download-status', 'Downloading audio...');

      await ytdlp(url, {
        output: tempAudioPath,
        format: 'bestaudio[ext=m4a]/bestaudio',
        extractAudio: true,
        audioFormat: 'm4a',
        ffmpegLocation: ffmpegPath
      });

      // Download thumbnail
      event.reply('download-status', 'Downloading cover art...');
      try {
        await downloadThumbnail(thumbnail, thumbnailPath);
      } catch (err) {
        console.log('Could not download thumbnail:', err.message);
      }

      event.reply('download-status', 'Converting to MP3 and adding metadata...');

      // Convert to MP3 with ffmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(tempAudioPath)
          .toFormat('mp3')
          .audioBitrate('320k')
          .on('progress', (progress) => {
            if (progress.percent) {
              event.reply('download-progress', Math.round(progress.percent));
            }
          })
          .on('end', resolve)
          .on('error', reject)
          .save(filePath);
      });

      // Add metadata and cover art
      event.reply('download-status', 'Adding metadata and cover art...');

      const tags = {
        title: info.title,
        artist: artist,
        album: info.album || 'YouTube Download',
        year: new Date(info.upload_date || Date.now()).getFullYear().toString(),
        comment: {
          language: 'eng',
          text: `Downloaded from: ${url}`
        }
      };

      // Add cover art if thumbnail was downloaded
      if (fs.existsSync(thumbnailPath)) {
        tags.image = {
          mime: 'image/jpeg',
          type: {
            id: 3,
            name: 'front cover'
          },
          description: 'Cover',
          imageBuffer: fs.readFileSync(thumbnailPath)
        };
      }

      const success = NodeID3.write(tags, filePath);

      if (!success) {
        console.log('Warning: Could not write all metadata');
      }

      event.reply('download-complete', filePath);
    }

  } catch (error) {
    console.error('Download error:', error);
    log(`Error downloading: ${error.message}`);
    log(`Stack: ${error.stack}`);

    // Provide user-friendly error messages
    let userMessage = 'An error occurred during download';

    if (error.message && error.message.includes('Unsupported URL')) {
      userMessage = 'Invalid YouTube URL. Please check the link and try again.';
    } else if (error.message && error.message.includes('Video unavailable')) {
      userMessage = 'This video is unavailable or private.';
    } else if (error.message && error.message.includes('Private video')) {
      userMessage = 'This video is private and cannot be downloaded.';
    } else if (error.message && (error.message.includes('network') || error.message.includes('timeout'))) {
      userMessage = 'Network error. Please check your connection and try again.';
    } else if (error.message && error.message.includes('Sign in to confirm')) {
      userMessage = 'Age-restricted video. Unable to download without authentication.';
    }

    event.reply('download-error', userMessage);
  } finally {
    // Cleanup temp files
    [tempAudioPath, thumbnailPath].forEach(file => {
      if (file && fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (err) {
          console.log('Could not delete temp file:', file);
        }
      }
    });
  }
}


// Handle playlist download
async function handlePlaylistDownload(event, url, format) {
  try {
    event.reply('download-status', 'Fetching playlist information...');

    // Get playlist info
    const playlistInfo = await ytdlp(url, {
      flatPlaylist: true,
      dumpSingleJson: true,
      noWarnings: true
    });

    const videos = playlistInfo.entries || [];
    const playlistTitle = playlistInfo.title || 'Playlist';

    if (videos.length === 0) {
      event.reply('download-error', 'No videos found in playlist');
      return;
    }

    // Send playlist info to renderer
    event.reply('playlist-info', {
      title: playlistTitle,
      count: videos.length
    });

    // Select folder for playlist downloads
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: `Select folder for "${playlistTitle}"`
    });

    if (!filePaths || filePaths.length === 0) {
      event.reply('download-cancelled');
      return;
    }

    const outputFolder = filePaths[0];
    log(`Playlist download to: ${outputFolder}`);

    // Download each video
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < videos.length; i++) {
      const videoEntry = videos[i];
      const videoUrl = `https://www.youtube.com/watch?v=${videoEntry.id}`;

      // Fetch full video info
      event.reply('download-status', `Fetching info for ${i + 1}/${videos.length}...`);
      const video = await ytdlp(videoUrl, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificate: true
      });
      const videoTitle = (video.title || `Video ${i + 1}`).replace(/[^\\w\\s-]/gi, '').trim();

      try {
        event.reply('download-status', `Downloading ${i + 1}/${videos.length}: ${videoTitle}`);
        // Also send specific playlist item event if renderer supports it (optional)
        event.reply('playlist-item', {
          title: video.title || `Video ${i + 1}`,
          current: i + 1,
          total: videos.length
        });

        const outputPath = path.join(outputFolder, `${videoTitle}.${format}`);

        if (format === 'mp4') {
          // Download MP4
          await ytdlp(videoUrl, {
            output: outputPath,
            format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
            mergeOutputFormat: 'mp4',
            embedMetadata: true,
            embedThumbnail: true,
            ffmpegLocation: ffmpegPath
          });

        } else if (format === 'mp3') {
          // Download MP3 with metadata
          const tempDir = app.getPath('temp');
          const tempAudioPath = path.join(tempDir, `temp_audio_${Date.now()}.m4a`);
          const thumbnailPath = path.join(tempDir, `thumbnail_${Date.now()}.jpg`);

          try {
            await ytdlp(videoUrl, {
              output: tempAudioPath,
              format: 'bestaudio[ext=m4a]/bestaudio',
              extractAudio: true,
              audioFormat: 'm4a',
              ffmpegLocation: ffmpegPath
            });

            // Download thumbnail
            if (video.thumbnail) {
              try {
                await downloadThumbnail(video.thumbnail, thumbnailPath);
              } catch (err) {
                log(`Thumbnail download failed: ${err.message}`);
              }
            }

            // Convert to MP3
            await new Promise((resolve, reject) => {
              ffmpeg(tempAudioPath)
                .toFormat('mp3')
                .audioBitrate('320k')
                .on('end', resolve)
                .on('error', reject)
                .save(outputPath);
            });

            // Add metadata
            const tags = {
              title: video.title,
              artist: video.uploader || 'Unknown Artist',
              album: playlistTitle,
              year: video.upload_date ? video.upload_date.substring(0, 4) : new Date().getFullYear().toString()
            };

            if (fs.existsSync(thumbnailPath)) {
              tags.image = {
                mime: 'image/jpeg',
                type: { id: 3, name: 'front cover' },
                description: 'Cover',
                imageBuffer: fs.readFileSync(thumbnailPath)
              };
            }

            NodeID3.write(tags, outputPath);

            // Cleanup
            [tempAudioPath, thumbnailPath].forEach(file => {
              if (file && fs.existsSync(file)) {
                try { fs.unlinkSync(file); } catch (e) { }
              }
            });

          } catch (err) {
            log(`MP3 conversion error: ${err.message}`);
            throw err;
          }
        }

        successCount++;
        log(`Downloaded ${i + 1}/${videos.length}: ${videoTitle}`);

      } catch (error) {
        failCount++;
        log(`Failed to download video ${i + 1}: ${error.message}`);
        // Continue with next video
      }
    }

    // Rename files to match tags
    event.reply('download-status', 'Verifying filenames...');
    await renameFilesFromTags(outputFolder);

    // Send completion message
    const summary = `Playlist download complete! ${successCount} succeeded, ${failCount} failed.`;
    event.reply('download-complete', outputFolder);
    event.reply('download-status', summary);

  } catch (error) {
    log(`Playlist download error: ${error.message}`);
    log(`Stack: ${error.stack}`);
    event.reply('download-error', 'Failed to download playlist: ' + error.message);
  }
}
