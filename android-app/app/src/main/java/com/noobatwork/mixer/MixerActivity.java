package com.noobatwork.mixer;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.*;

public final class MixerActivity extends Activity {
    private SharedPreferences preferences;
    private LinearLayout root, toolbar;
    private FrameLayout content;
    private WebView web;
    private TextView problem;
    private String address;
    private boolean failed, active, fullscreen;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable retry = () -> { if (active && failed && web != null) web.loadUrl(address); };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        preferences = getSharedPreferences("mixer", MODE_PRIVATE);
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(11,19,32));
        root.setOnApplyWindowInsetsListener((view,insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        setContentView(root);
        address = preferences.getString("address", "");
        if (address.isEmpty()) showSetup(); else openMixer();
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView text(String value, int size) {
        TextView label = new TextView(this); label.setText(value); label.setTextSize(size);
        label.setTextColor(Color.rgb(230,244,255)); label.setPadding(dp(12),dp(12),dp(12),dp(12)); return label;
    }
    private Button button(String label, Runnable action) {
        Button b = new Button(this); b.setText(label); b.setAllCaps(false); b.setMinHeight(dp(48));
        b.setOnClickListener(v -> action.run()); return b;
    }
    private void destroyWeb() {
        handler.removeCallbacks(retry);
        if (web != null) { web.stopLoading(); web.destroy(); web = null; }
    }
    private void showSetup() {
        destroyWeb(); failed = false; setFullscreen(false); root.removeAllViews();
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        ScrollView scroll = new ScrollView(this);
        LinearLayout form = new LinearLayout(this); form.setOrientation(LinearLayout.VERTICAL); form.setPadding(dp(20),dp(20),dp(20),dp(20));
        form.addView(text("NoobatWork Mixer",28));
        form.addView(text("Dein Audio-Tablet",18));
        form.addView(text("Öffne das Mixer Control Center auf deinem Windows-PC. Trage hier die dort angezeigte LAN-Adresse ein. Beide Geräte müssen im gleichen Netzwerk sein.",16));
        EditText input = new EditText(this); input.setSingleLine(true); input.setHint("192.168.1.20:8877"); input.setText(address);
        input.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        input.setContentDescription("PC-Adresse"); form.addView(input);
        CheckBox awake = new CheckBox(this); awake.setText("Bildschirm beim Mixen eingeschaltet lassen"); awake.setChecked(preferences.getBoolean("awake",true)); form.addView(awake);
        form.addView(button("Mit PC verbinden", () -> {
            try { address = ServerAddress.normalize(input.getText().toString()); }
            catch (IllegalArgumentException e) { input.setError(e.getMessage()); return; }
            preferences.edit().putString("address",address).putBoolean("awake",awake.isChecked()).apply(); openMixer();
        }));
        form.addView(text("Beim ersten Verbinden gibst du den sechsstelligen Pairing-Code vom PC ein. Die App merkt sich dieses Tablet und seine Einstellungen.",14));
        form.addView(text("Android-App 0.1.0 Preview · Control Center ab v0.2.0",12));
        scroll.addView(form); root.addView(scroll);
    }
    @SuppressLint("SetJavaScriptEnabled")
    private void openMixer() {
        destroyWeb(); root.removeAllViews(); failed = false;
        if (preferences.getBoolean("awake",true)) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        toolbar = new LinearLayout(this);
        toolbar.addView(button("PC / Einstellungen", this::showSetup));
        toolbar.addView(button("Neu laden", () -> web.loadUrl(address)));
        toolbar.addView(button("Vollbild", () -> setFullscreen(true)));
        HorizontalScrollView toolbarScroll = new HorizontalScrollView(this); toolbarScroll.addView(toolbar); root.addView(toolbarScroll);
        content = new FrameLayout(this); root.addView(content,new LinearLayout.LayoutParams(-1,0,1));
        web = new WebView(this); web.setBackgroundColor(Color.rgb(11,19,32));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false); web.getSettings().setAllowContentAccess(false);
        web.getSettings().setUserAgentString(web.getSettings().getUserAgentString()+" NoobatWorkMixerAndroid/0.1.0");
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsConfirm(WebView view,String url,String message,JsResult result) {
                new AlertDialog.Builder(MixerActivity.this).setMessage(message)
                    .setPositiveButton("Ja",(d,w)->result.confirm()).setNegativeButton("Abbrechen",(d,w)->result.cancel())
                    .setOnCancelListener(d->result.cancel()).show(); return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
                return !ServerAddress.sameOrigin(address,request.getUrl().toString());
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon) { failed=false; }
            @Override public void onPageFinished(WebView view,String url) {
                if (!failed) { problem.setVisibility(View.GONE); handler.removeCallbacks(retry); }
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error) {
                if (request.isForMainFrame()) showProblem();
            }
            @Override public void onReceivedHttpError(WebView view,WebResourceRequest request,WebResourceResponse response) {
                if (request.isForMainFrame()) showProblem();
            }
        });
        content.addView(web,new FrameLayout.LayoutParams(-1,-1));
        problem = text("PC nicht erreichbar. Prüfe WLAN und Control Center. Die App versucht es automatisch erneut.\n\nMit Zurück gelangst du zu den Einstellungen.",18);
        problem.setBackgroundColor(Color.rgb(11,19,32)); problem.setGravity(android.view.Gravity.CENTER); problem.setVisibility(View.GONE);
        content.addView(problem,new FrameLayout.LayoutParams(-1,-1));
        setFullscreen(preferences.getBoolean("fullscreen",false)); web.loadUrl(address);
    }
    private void showProblem() { failed=true; problem.setVisibility(View.VISIBLE); handler.removeCallbacks(retry); if(active)handler.postDelayed(retry,3000); }
    private void setFullscreen(boolean enabled) {
        fullscreen=enabled;
        if (toolbar != null && toolbar.getParent() instanceof View) ((View)toolbar.getParent()).setVisibility(enabled?View.GONE:View.VISIBLE);
        getWindow().getDecorView().setSystemUiVisibility(enabled ? View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY : View.SYSTEM_UI_FLAG_VISIBLE);
        if (web != null) preferences.edit().putBoolean("fullscreen",enabled).apply();
    }
    @Override public void onBackPressed() { if(fullscreen)setFullscreen(false); else if(web!=null)showSetup(); else super.onBackPressed(); }
    @Override protected void onResume() { super.onResume(); active=true; if(web!=null)web.onResume(); if(failed)handler.post(retry); }
    @Override protected void onPause() { active=false; handler.removeCallbacks(retry); if(web!=null)web.onPause(); super.onPause(); }
    @Override protected void onDestroy() { destroyWeb(); super.onDestroy(); }
    WebView mixerForTest() { return web; }
}
