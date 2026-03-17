package com.will.gvcity;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        WebView webView = getBridge().getWebView();

        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
