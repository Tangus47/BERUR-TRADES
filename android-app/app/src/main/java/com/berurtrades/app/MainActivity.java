package com.berurtrades.app;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.*;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Color;
public class MainActivity extends Activity {
 private static final String APP_URL="https://tangus47.github.io/BERUR-TRADES/";
 private WebView web;
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  getWindow().setStatusBarColor(Color.rgb(6,13,25)); getWindow().setNavigationBarColor(Color.rgb(6,13,25));
  web=new WebView(this); setContentView(web);
  WebSettings s=web.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true); s.setLoadsImagesAutomatically(true); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.setBackgroundColor(Color.rgb(6,13,25)); web.setWebChromeClient(new WebChromeClient());
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r){
    Uri u=r.getUrl(); String h=u.getHost()==null?"":u.getHost().toLowerCase();
    if(h.equals("tangus47.github.io")) return false;
    if("https".equals(u.getScheme())) { try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){} }
    return true;
   }
  });
  if(state==null) web.loadUrl(APP_URL+"?app=android"); else web.restoreState(state);
 }
 @Override protected void onSaveInstanceState(Bundle b){if(web!=null)web.saveState(b);super.onSaveInstanceState(b);}
 @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(web!=null){web.destroy();web=null;}super.onDestroy();}
}
