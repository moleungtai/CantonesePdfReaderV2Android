package com.cantonese.pdfreader;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.util.HashMap;
import java.util.Locale;

public class MainActivity extends Activity implements TextToSpeech.OnInitListener {
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private static final int FILE_CHOOSER = 1001;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        tts = new TextToSpeech(this, this);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new AndroidTTSBridge(), "AndroidTTS");
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/pdf");
                startActivityForResult(intent, FILE_CHOOSER);
                return true;
            }
        });
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int result = tts.setLanguage(new Locale("zh", "HK"));
            ttsReady = result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED;
            if (!ttsReady) {
                tts.setLanguage(Locale.TRADITIONAL_CHINESE);
                ttsReady = true;
            }
            tts.setOnUtteranceProgressListener(new android.speech.tts.UtteranceProgressListener() {
                @Override public void onStart(String utteranceId) {
                    runOnUiThread(() -> webView.evaluateJavascript("window.__androidTTSStarted && window.__androidTTSStarted()", null));
                }
                @Override public void onDone(String utteranceId) {
                    runOnUiThread(() -> webView.evaluateJavascript("window.__androidTTSFinished && window.__androidTTSFinished()", null));
                }
                @Override public void onError(String utteranceId) {
                    runOnUiThread(() -> webView.evaluateJavascript("window.__androidTTSError && window.__androidTTSError()", null));
                }
            });
        }
    }

    public class AndroidTTSBridge {
        @JavascriptInterface public boolean isAvailable() { return ttsReady; }

        @JavascriptInterface public void speak(String text, float rate) {
            runOnUiThread(() -> {
                if (!ttsReady || text == null || text.trim().isEmpty()) return;
                tts.stop();
                tts.setSpeechRate(Math.max(0.5f, Math.min(2.0f, rate)));
                Bundle params = new Bundle();
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, "cantonese-reader");
            });
        }

        @JavascriptInterface public void stop() {
            runOnUiThread(() -> { if (tts != null) tts.stop(); });
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) result = new Uri[]{data.getData()};
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        }
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
