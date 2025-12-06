# MusicYT Downloader 🎵

A modern desktop application to download YouTube videos and audio with automatic metadata and cover art embedding.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

## ✨ Features

- 🎥 **Download MP4 videos** - Best quality with audio
- 🎵 **Download MP3 audio** - 320kbps high quality
- 📝 **Automatic metadata** - Title, artist, album, year
- 🖼️ **Album cover art** - Embedded from video thumbnail
- 📊 **Progress tracking** - Real-time download status
- 💻 **Clean UI** - Modern, intuitive interface
- 🚀 **Fast downloads** - Powered by yt-dlp
- 🔄 **Format conversion** - FFmpeg integration

## 🖥️ Screenshots

![App Screenshot]![alt text](image.png)

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) 14 or higher
- Internet connection

## 🚀 Installation

### Download Release (Easiest)

1. Go to [Releases](https://github.com/taherx7/MusicYT-Downloader/releases)
2. Download the latest version
3. Run the installer
4. Launch the app

### Build from Source

1. **Clone the repository:**
```bash
git clone https://github.com/taherx7/MusicYT-Downloader.git
cd MusicYT-Downloader
```

2. **Install dependencies:**
```bash
npm install
```

3. **Run the app:**
```bash
npm start
```

4. **Build executable (optional):**
```bash
npm run build-win    # For Windows
npm run build-mac    # For macOS
npm run build-linux  # For Linux
```

## 📖 Usage

1. Launch the application
2. Paste a YouTube URL
3. Select format:
   - **MP4** - Video with audio
   - **MP3** - Audio only with metadata
4. Click **Download**
5. Choose save location
6. Wait for download to complete

## 🛠️ Technologies Used

- **[Electron](https://www.electronjs.org/)** - Cross-platform desktop framework
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** - YouTube downloader
- **[FFmpeg](https://ffmpeg.org/)** - Audio/video processing
- **[Node-ID3](https://github.com/Zazama/node-id3)** - MP3 metadata tagging
- **HTML/CSS/JavaScript** - User interface

## 📦 Dependencies
```json
{
  "yt-dlp-exec": "Video/audio downloading",
  "fluent-ffmpeg": "Format conversion",
  "node-id3": "MP3 metadata embedding",
  "@ffmpeg-installer/ffmpeg": "FFmpeg binaries"
}
```

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🐛 Known Issues

- Large videos (1GB+) may take time to download
- Some region-restricted videos may not be accessible


## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**taherx7**

- GitHub: [@taherx7](https://github.com/taherx7)
- Repository: [MusicYT-Downloader](https://github.com/taherx7/MusicYT-Downloader)

## ⭐ Show your support

Give a ⭐️ if this project helped you!

## 🙏 Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Powerful YouTube downloader
- [Electron](https://www.electronjs.org/) - Desktop app framework
- [FFmpeg](https://ffmpeg.org/) - Multimedia processing

---

Made with ❤️ by taherx7
