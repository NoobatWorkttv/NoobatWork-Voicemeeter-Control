package com.noobatwork.mixer;
import org.junit.Test;
import static org.junit.Assert.*;
public class ServerAddressTest {
    @Test public void acceptsControlCenterAddresses() {
        assertEquals("http://192.168.1.20:8877/",ServerAddress.normalize(" 192.168.1.20 "));
        assertEquals("http://my-pc:8877/",ServerAddress.normalize("http://MY-PC:8877/"));
        assertEquals("https://mixer.local:443/",ServerAddress.normalize("https://mixer.local"));
        assertTrue(ServerAddress.sameOrigin("http://192.168.1.20:8877/","http://192.168.1.20:8877/api/pair"));
    }
    @Test public void rejectsOtherOriginsAndNonServerInputs() {
        for(String input:new String[]{"","javascript:alert(1)","file:///data/test","http://user:secret@pc/","http://pc/path","http://pc/?token=x","http://pc:99999"}) {
            try { ServerAddress.normalize(input); fail(input); } catch(IllegalArgumentException expected) { }
        }
        assertFalse(ServerAddress.sameOrigin("http://pc:8877/","http://evil:8877/"));
        assertFalse(ServerAddress.sameOrigin("http://pc:8877/","http://pc/"));
        assertFalse(ServerAddress.sameOrigin("http://pc:8877/","intent://pc"));
    }
}
