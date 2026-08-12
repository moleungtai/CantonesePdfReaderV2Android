香港廣東話 PDF 聽書器 V2 — Android APK 專案

內容：
- 已把最新 Web V2 完整介面嵌入 Android WebView
- Android 原生 TextToSpeech 香港粵語橋接（zh-HK）
- PDF 檔案選擇器
- 章節導航、書籤、搜尋、睡眠計時、進度保存、深淺主題等 V2 功能
- GitHub Actions 自動 Build APK workflow

Android Studio：
1. Open 此資料夾
2. 等 Gradle Sync 完成
3. Build > Build APK(s)
4. APK: app/build/outputs/apk/debug/app-debug.apk

GitHub 免費自動編譯：
1. 把整個資料夾上載到 GitHub repository
2. 打開 Actions > Build Android APK > Run workflow
3. 完成後下載 Artifact: CantonesePdfReader-V2-debug-apk

注意：首次朗讀請確保 Android 系統已安裝/啟用支援粵語（香港）的 TTS voice。
