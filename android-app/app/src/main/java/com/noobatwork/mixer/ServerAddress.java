package com.noobatwork.mixer;

import java.net.URI;
import java.util.Locale;

final class ServerAddress {
    static String normalize(String input) {
        try {
            String value = input.trim();
            if (!value.contains("://")) value = "http://" + value;
            URI uri = new URI(value);
            String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
            if ((!scheme.equals("http") && !scheme.equals("https")) || uri.getHost() == null
                    || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                    || !(uri.getPath().isEmpty() || uri.getPath().equals("/"))) throw new IllegalArgumentException();
            int port = uri.getPort() == -1 ? (scheme.equals("http") ? 8877 : 443) : uri.getPort();
            if (port < 1 || port > 65535) throw new IllegalArgumentException();
            return new URI(scheme, null, uri.getHost().toLowerCase(Locale.ROOT), port, "/", null, null).toString();
        } catch (Exception e) { throw new IllegalArgumentException("Bitte die LAN-Adresse aus dem Control Center eingeben, z. B. 192.168.1.20:8877."); }
    }
    static boolean sameOrigin(String address, String destination) {
        try {
            URI a = URI.create(address), b = URI.create(destination);
            int port = b.getPort() == -1 ? ("https".equals(b.getScheme()) ? 443 : 80) : b.getPort();
            return a.getScheme().equalsIgnoreCase(b.getScheme()) && a.getHost().equalsIgnoreCase(b.getHost())
                    && a.getPort() == port && b.getUserInfo() == null;
        } catch (Exception e) { return false; }
    }
}
