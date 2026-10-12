package com.noobatwork.mixer;

import android.content.Context;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class MixerDeviceTest {
    private String js(ActivityScenario<MixerActivity> scenario,String script) throws Exception {
        CountDownLatch done=new CountDownLatch(1); AtomicReference<String> result=new AtomicReference<>();
        scenario.onActivity(a->a.mixerForTest().evaluateJavascript(script,value->{result.set(value);done.countDown();}));
        assertTrue("WebView callback",done.await(5,TimeUnit.SECONDS)); return result.get();
    }
    private void until(ActivityScenario<MixerActivity> scenario,String expression) throws Exception {
        for(int i=0;i<100;i++) { if("true".equals(js(scenario,expression)))return; Thread.sleep(200); }
        fail("Not ready: "+expression+" / "+js(scenario,"document.body.innerText"));
    }
    @Test public void realMixerPairingLateAppCommandAndRestart() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        context.getSharedPreferences("mixer",Context.MODE_PRIVATE).edit().clear().putString("address","http://127.0.0.1:18879/").commit();
        String identity;
        try(ActivityScenario<MixerActivity> scenario=ActivityScenario.launch(MixerActivity.class)) {
            until(scenario,"document.readyState==='complete' && !!document.getElementById('code') && !!localStorage.getItem('naw-center-device')");
            js(scenario,"document.getElementById('code').value='123456';document.getElementById('pair-form').requestSubmit();");
            until(scenario,"document.getElementById('connection').textContent==='Verbunden'");
            until(scenario,"document.body.innerText.includes('EscapeFromTarkov')");
            until(scenario,"!document.getElementById('new-apps').hidden");
            js(scenario,"document.getElementById('new-apps').click();");
            until(scenario,"document.getElementById('heading').textContent==='Anwendungen'");
            js(scenario,"[...document.querySelectorAll('.channel')].find(x=>x.innerText.includes('EscapeFromTarkov')).querySelector('.mute-btn').click();");
            until(scenario,"[...document.querySelectorAll('.channel')].some(x=>x.innerText.includes('EscapeFromTarkov') && x.classList.contains('is-muted'))");
            identity=js(scenario,"localStorage.getItem('naw-center-device')");
            assertNotEquals("null",identity);
            scenario.recreate();
            until(scenario,"document.getElementById('connection')?.textContent==='Verbunden'");
            assertEquals(identity,js(scenario,"localStorage.getItem('naw-center-device')"));
            scenario.onActivity(a->a.setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
            until(scenario,"document.getElementById('connection')?.textContent==='Verbunden'");
            scenario.onActivity(a->a.setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
            until(scenario,"document.getElementById('connection')?.textContent==='Verbunden'");
        }
    }
}
