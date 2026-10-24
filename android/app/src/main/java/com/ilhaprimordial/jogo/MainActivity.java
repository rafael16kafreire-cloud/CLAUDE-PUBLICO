package com.ilhaprimordial.jogo;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.lang.reflect.Method;

/**
 * Tela única do app: um navegador interno (WebView) em tela cheia que abre
 * o jogo guardado dentro do próprio app (assets/index.html). Funciona
 * sem internet.
 */
public class MainActivity extends Activity {

    private WebView web;

    // Flags de tela cheia "imersiva" (escondem barra de status e de navegação).
    // Valores numéricos para funcionar em todas as versões do Android.
    private static final int IMMERSIVE_FLAGS =
            0x00000100   // LAYOUT_STABLE
          | 0x00000200   // LAYOUT_HIDE_NAVIGATION
          | 0x00000400   // LAYOUT_FULLSCREEN
          | 0x00000002   // HIDE_NAVIGATION
          | 0x00000004   // FULLSCREEN
          | 0x00001000;  // IMMERSIVE_STICKY

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        // Tela sempre acesa enquanto joga + tela cheia.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_FULLSCREEN);

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(18, 24, 22));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);       // salvar opções (localStorage)
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        // Android 4.2+: deixa tocar sons sem esperar um toque (Fase 12).
        callIfExists(s, "setMediaPlaybackRequiresUserGesture", false);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file:")) return false;
                // Links externos abrem no navegador do celular.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) {
                }
                return true;
            }
        });
        // Ponte para o jogo: window.IlhaAndroid.exit() fecha o app.
        web.addJavascriptInterface(new Bridge(), "IlhaAndroid");

        setContentView(web);
        hideSystemUi();

        if (state != null) {
            web.restoreState(state);
        } else {
            web.loadUrl("file:///android_asset/index.html");
        }
    }

    /** Métodos que o JavaScript do jogo pode chamar. */
    public class Bridge {
        @JavascriptInterface
        public void exit() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    finish();
                }
            });
        }
    }

    // Botão/gesto "voltar": pausa ou continua o jogo (não fecha sem querer).
    @Override
    public void onBackPressed() {
        web.loadUrl("javascript:window.__ilhaBack&&window.__ilhaBack()");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
        web.pauseTimers();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.resumeTimers();
        hideSystemUi();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(IMMERSIVE_FLAGS);
    }

    // Chama um método só se ele existir nesta versão do Android.
    private static void callIfExists(Object target, String name, boolean value) {
        try {
            Method m = target.getClass().getMethod(name, boolean.class);
            m.invoke(target, value);
        } catch (Exception ignored) {
        }
    }
}
