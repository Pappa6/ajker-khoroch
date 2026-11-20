package com.pappa6.ajkerkhoroch;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Ajker Khoroch (আজকের খরচ) for Android.
 *
 * The whole app is the same web page as the website, shipped inside the APK and served to the
 * WebView from the APK itself. The app has NO internet permission: nothing the user enters can
 * leave the phone. The only other apps it talks to are the ones the user picks: a UPI app
 * (PhonePe, Google Pay, Paytm, BHIM, a bank's app...) to make a payment, the voice-typing app,
 * the file picker, and the share sheet.
 */
public class MainActivity extends Activity {
    static final String HOST = "app.ajkerkhoroch.local";
    static final String ORIGIN = "https://" + HOST;
    static final int RC_PAY = 11, RC_FILE = 12, RC_VOICE = 13, RC_CAM = 14, RC_NOTIF = 15;

    WebView web;
    ValueCallback<Uri[]> fileCallback;
    PermissionRequest pendingCamera;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setTextZoom(100);
        WebView.setWebContentsDebuggingEnabled(false);
        web.addJavascriptInterface(new Bridge(), "AKNative");
        web.setWebViewClient(new LocalClient());
        web.setWebChromeClient(new Chrome());
        if (state != null) web.restoreState(state);
        else web.loadUrl(ORIGIN + "/index.html");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onResume() {
        super.onResume();
        js("window.akOnResume&&window.akOnResume()");
    }

    @Override
    public void onBackPressed() {
        js("(window.akBack&&window.akBack())?'1':'0'", v -> {
            if (!"\"1\"".equals(v)) MainActivity.super.onBackPressed();
        });
    }

    void js(String code) { js(code, null); }

    void js(String code, ValueCallback<String> cb) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, cb); });
    }

    /** Serves the app's own files from the APK; every other web address is refused. */
    class LocalClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (HOST.equals(u.getHost()) && "https".equals(u.getScheme())) {
                String path = u.getPath();
                if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
                if (path.contains("..")) return blocked();
                try {
                    InputStream in = getAssets().open("www" + path);
                    WebResourceResponse r = new WebResourceResponse(mime(path), mime(path).startsWith("text/") || path.endsWith(".js") ? "utf-8" : null, in);
                    Map<String, String> h = new HashMap<>();
                    h.put("Cache-Control", "no-store");
                    r.setResponseHeaders(h);
                    return r;
                } catch (IOException e) {
                    return notFound();
                }
            }
            return blocked();
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (HOST.equals(u.getHost())) return false;
            openOutside(u);
            return true;
        }
    }

    static WebResourceResponse blocked() {
        WebResourceResponse r = new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
        r.setStatusCodeAndReasonPhrase(403, "Blocked");
        return r;
    }

    static WebResourceResponse notFound() {
        WebResourceResponse r = new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
        r.setStatusCodeAndReasonPhrase(404, "Not found");
        return r;
    }

    static String mime(String p) {
        p = p.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        return "application/octet-stream";
    }

    /** Links to other sites (WhatsApp, insurance sites...) open in the phone's own apps, never inside this app. */
    void openOutside(Uri u) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, u);
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(i);
        } catch (ActivityNotFoundException ignored) { }
    }

    class Chrome extends WebChromeClient {
        @Override
        public void onPermissionRequest(PermissionRequest req) {
            runOnUiThread(() -> {
                boolean wantsCam = false;
                for (String r : req.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantsCam = true;
                if (!wantsCam || !ORIGIN.equals(req.getOrigin().toString().replaceAll("/$", ""))) { req.deny(); return; }
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    req.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                } else {
                    pendingCamera = req;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, RC_CAM);
                }
            });
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = cb;
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                    "application/pdf", "text/csv", "text/comma-separated-values", "text/plain",
                    "application/vnd.ms-excel",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "application/octet-stream"});
            try {
                startActivityForResult(Intent.createChooser(i, "স্টেটমেন্ট বেছে নিন"), RC_FILE);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                cb.onReceiveValue(null);
                return false;
            }
            return true;
        }
    }

    @Override
    public void onRequestPermissionsResult(int rc, String[] perms, int[] res) {
        if (rc == RC_CAM && pendingCamera != null) {
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED)
                pendingCamera.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else {
                pendingCamera.deny();
                js("window.akCameraDenied&&window.akCameraDenied()");
            }
            pendingCamera = null;
        }
    }

    @Override
    protected void onActivityResult(int rc, int result, Intent data) {
        super.onActivityResult(rc, result, data);
        if (rc == RC_FILE) {
            if (fileCallback != null) {
                Uri[] r = null;
                if (result == RESULT_OK && data != null && data.getData() != null) r = new Uri[]{data.getData()};
                fileCallback.onReceiveValue(r);
                fileCallback = null;
            }
        } else if (rc == RC_PAY) {
            JSONObject o = new JSONObject();
            try {
                o.put("resultCode", result);
                String resp = null;
                JSONObject extras = new JSONObject();
                if (data != null) {
                    resp = data.getStringExtra("response");
                    Bundle b = data.getExtras();
                    if (b != null) for (String k : b.keySet()) {
                        Object v = b.get(k);
                        if (v instanceof String || v instanceof Number || v instanceof Boolean) extras.put(k, String.valueOf(v));
                    }
                }
                o.put("response", resp == null ? "" : resp);
                o.put("extras", extras);
            } catch (Exception ignored) { }
            js("window.akPayResult&&window.akPayResult(" + JSONObject.quote(o.toString()) + ")");
        } else if (rc == RC_VOICE) {
            String text = "";
            if (result == RESULT_OK && data != null) {
                ArrayList<String> l = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                if (l != null && !l.isEmpty()) text = l.get(0);
            }
            js("window.akVoiceResult&&window.akVoiceResult(" + JSONObject.quote(text) + ")");
        }
    }

    /** UPI apps on this phone (PhonePe, Google Pay, Paytm, BHIM, bank apps...). */
    List<ResolveInfo> upiApps() {
        Intent probe = new Intent(Intent.ACTION_VIEW, Uri.parse("upi://pay"));
        return getPackageManager().queryIntentActivities(probe, 0);
    }

    /** What the web page may ask the phone to do. Nothing here reads or sends the user's records. */
    class Bridge {
        @JavascriptInterface
        public String upiApps() {
            JSONArray a = new JSONArray();
            PackageManager pm = getPackageManager();
            for (ResolveInfo ri : MainActivity.this.upiApps()) {
                try {
                    JSONObject o = new JSONObject();
                    o.put("pkg", ri.activityInfo.packageName);
                    o.put("label", String.valueOf(ri.loadLabel(pm)));
                    a.put(o);
                } catch (Exception ignored) { }
            }
            return a.toString();
        }

        /** Opens the chosen UPI app with the payment filled in. The PIN is typed only inside that app. */
        @JavascriptInterface
        public boolean pay(String uri, String pkg) {
            if (uri == null || !uri.startsWith("upi://pay?")) return false;
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
                if (pkg != null && !pkg.isEmpty()) i.setPackage(pkg);
                try {
                    if (pkg == null || pkg.isEmpty()) startActivityForResult(Intent.createChooser(i, "কোন অ্যাপে পেমেন্ট করবেন?"), RC_PAY);
                    else startActivityForResult(i, RC_PAY);
                } catch (ActivityNotFoundException e) {
                    js("window.akPayResult&&window.akPayResult(" + JSONObject.quote("{\"error\":\"noapp\"}") + ")");
                }
            });
            return true;
        }

        @JavascriptInterface
        public boolean listen(String lang) {
            runOnUiThread(() -> {
                Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang == null || lang.isEmpty() ? "bn-IN" : lang);
                i.putExtra(RecognizerIntent.EXTRA_PROMPT, "bn-IN".equals(lang) ? "বলুন, যেমন: ১০০ টাকা দুধ নগদ" : "Speak, e.g. 100 rupees milk cash");
                try { startActivityForResult(i, RC_VOICE); }
                catch (ActivityNotFoundException e) { js("window.akVoiceResult&&window.akVoiceResult(null)"); }
            });
            return true;
        }

        @JavascriptInterface
        public void share(String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text);
                try { startActivity(Intent.createChooser(i, "কোথায় পাঠাবেন?")); } catch (ActivityNotFoundException ignored) { }
            });
        }

        @JavascriptInterface
        public boolean copy(String text) {
            try {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                cm.setPrimaryClip(ClipData.newPlainText("আজকের খরচ", text));
                return true;
            } catch (Exception e) { return false; }
        }

        /** A gentle reminder later (for spends whose purpose is still to be told). */
        @JavascriptInterface
        public void remind(int minutes, String title, String body) {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, RC_NOTIF);
                Intent i = new Intent(MainActivity.this, ReminderReceiver.class);
                i.putExtra("title", title);
                i.putExtra("body", body);
                PendingIntent pi = PendingIntent.getBroadcast(MainActivity.this, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                am.set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + Math.max(1, minutes) * 60_000L, pi);
            });
        }

        @JavascriptInterface
        public void cancelRemind() {
            runOnUiThread(() -> {
                Intent i = new Intent(MainActivity.this, ReminderReceiver.class);
                PendingIntent pi = PendingIntent.getBroadcast(MainActivity.this, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                ((AlarmManager) getSystemService(Context.ALARM_SERVICE)).cancel(pi);
            });
        }

        @JavascriptInterface
        public String version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
            catch (Exception e) { return ""; }
        }
    }
}
