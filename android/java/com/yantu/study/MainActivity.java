package com.yantu.study;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4101;
    private static final int BACKUP_CREATE_REQUEST = 4102;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingBackupContent;
    private String pendingBackupFileName;

    private final class AndroidBridge {
        @JavascriptInterface
        public void saveBackup(String fileName, String content) {
            pendingBackupFileName = fileName;
            pendingBackupContent = content;
            runOnUiThread(() -> launchBackupSave(fileName));
        }

        @JavascriptInterface
        public String platform() {
            return "android";
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(244, 240, 231));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(244, 240, 231));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params
            ) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception error) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "无法打开文件选择器", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        root.addView(
            webView,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        setContentView(root);
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private void configureSystemBars() {
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(244, 240, 231));
        window.setNavigationBarColor(Color.rgb(244, 240, 231));
        int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        window.getDecorView().setSystemUiVisibility(flags);
    }

    private void launchBackupSave(String fileName) {
        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, fileName);
            startActivityForResult(intent, BACKUP_CREATE_REQUEST);
        } catch (Exception error) {
            Toast.makeText(this, "无法打开备份文件保存位置", Toast.LENGTH_SHORT).show();
            clearPendingBackup();
        }
    }

    private void writeBackup(Uri uri) {
        if (pendingBackupContent == null || pendingBackupFileName == null) return;
        try (OutputStream stream = getContentResolver().openOutputStream(uri, "w")) {
            if (stream == null) throw new IllegalStateException("无法创建输出文件");
            stream.write(pendingBackupContent.getBytes(StandardCharsets.UTF_8));
            stream.flush();
            Toast.makeText(this, "备份已保存", Toast.LENGTH_SHORT).show();
        } catch (Exception error) {
            Toast.makeText(this, "备份保存失败", Toast.LENGTH_SHORT).show();
        } finally {
            clearPendingBackup();
        }
    }

    private void clearPendingBackup() {
        pendingBackupContent = null;
        pendingBackupFileName = null;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback == null) return;
            filePathCallback.onReceiveValue(
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            );
            filePathCallback = null;
            return;
        }
        if (requestCode == BACKUP_CREATE_REQUEST) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                writeBackup(data.getData());
            } else {
                clearPendingBackup();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
        }
        super.onDestroy();
    }
}
