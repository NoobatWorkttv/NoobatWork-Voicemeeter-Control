using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Text.Json;
using NAudio.CoreAudioApi;

namespace NoobatWork.AudioSessions;

// Independent Windows Core Audio helper. It never loads VoicemeeterRemote64.dll.
// All communication uses UTF-8 JSON lines over local stdin/stdout. No listening sockets.
internal sealed record AppInfo(string id, string name, string device, double volume, bool mute, int sessions, double peak, string? icon);
internal static class Program
{
    private static readonly Dictionary<string,string?> IconCache = new(StringComparer.OrdinalIgnoreCase);
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    [STAThread]
    private static void Main()
    {
        Console.InputEncoding = System.Text.Encoding.UTF8;
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        while (Console.ReadLine() is { } line)
        {
            try
            {
                using var payload = JsonDocument.Parse(line.TrimStart('\uFEFF', '\u200B'));
                var root = payload.RootElement;
                string op = root.TryGetProperty("op", out var o) ? o.GetString() ?? "" : "";
                string app = root.TryGetProperty("app", out var a) ? (a.GetString() ?? "").ToLowerInvariant() : "";
                if (op is not ("list" or "adjust" or "mute" or "set"))
                {
                    Reply(new { type = "error", error = "Unknown operation" });
                    continue;
                }

                if (op != "list" && !ValidAppId(app))
                {
                    Reply(new { type = "error", error = "Invalid app ID" });
                    continue;
                }

                // Retain the same COM thread for discovery and updates.
                var result = Scan(op, app, root);
                Reply(new { type = "apps", apps = result, requested = op });
            }
            catch (Exception e)
            {
                Reply(new { type = "error", error = e.Message });
            }
        }
    }

    private static bool ValidAppId(string id) =>
        id.Length is > 0 and <= 120 &&
        id.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) &&
        id.All(c => char.IsLetterOrDigit(c) || c is '.' or '_' or '-');

    private static void Reply(object message) =>
        Console.WriteLine(JsonSerializer.Serialize(message, JsonOptions));

    // Cache the actual EXE icon, never hit the disk/GDI+ every 1.5-second poll.
    private static string? FindIcon(string file)
    {
        if (string.IsNullOrWhiteSpace(file) || !File.Exists(file)) return null;
        if (IconCache.TryGetValue(file, out var cached)) return cached;
        string? encoded = null;
        try
        {
            using var icon = Icon.ExtractAssociatedIcon(file);
            if (icon is not null)
            {
                using var full = icon.ToBitmap();
                using var thumbnail = new Bitmap(40, 40);
                using (var g = Graphics.FromImage(thumbnail))
                {
                    g.Clear(Color.Transparent);
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.DrawImage(full, 0, 0, 40, 40);
                }
                using var buffer = new MemoryStream();
                thumbnail.Save(buffer, ImageFormat.Png);
                if (buffer.Length <= 27000) encoded = "data:image/png;base64," + Convert.ToBase64String(buffer.ToArray());
            }
        }
        catch (Exception) { /* Missing/unreadable icon is an optional visual detail. */ }
        if (IconCache.Count > 300) IconCache.Clear();
        IconCache[file] = encoded;
        return encoded;
    }

    private static List<AppInfo> Scan(string operation, string app, JsonElement input)
    {
        var collected = new Dictionary<string, (string name, string device, double volume, bool mute, int sessions, double peak, string? icon)>(
            StringComparer.OrdinalIgnoreCase);
        using var enumerator = new MMDeviceEnumerator();
        var endpoints = enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active);
        foreach (var endpoint in endpoints)
        {
            // Device and individual session errors should not hide other sound sessions.
            try
            {
                using var device = endpoint;
                var manager = device.AudioSessionManager;
                var sessions = manager.Sessions;
                for (int n = 0; n < sessions.Count; n++)
                {
                    try
                    {
                        using var session = sessions[n];
                        if (session.IsSystemSoundsSession) continue;
                        var pid = (int)session.GetProcessID;
                        if (pid <= 0) continue;
                        string name;
                        string? icon = null;
                        using (var proc = Process.GetProcessById(pid))
                        {
                            name = proc.ProcessName;
                            try { icon = FindIcon(proc.MainModule?.FileName ?? ""); }
                            catch (Exception) { /* Some Windows processes deny module access. */ }
                        }
                        if (string.IsNullOrWhiteSpace(name)) continue;
                        string id = name.ToLowerInvariant() + ".exe";
                        if (!ValidAppId(id)) continue;
                        var volumeControl = session.SimpleAudioVolume;
                        double peak = 0;
                        try { peak = Math.Clamp(session.AudioMeterInformation.MasterPeakValue, 0.0f, 1.0f); }
                        catch (Exception) { /* Metering may not be supported for every session. */ }

                        if (string.Equals(id, app, StringComparison.OrdinalIgnoreCase))
                        {
                            if (operation == "adjust")
                            {
                                double delta = input.GetProperty("delta").GetDouble();
                                if (!double.IsFinite(delta) || Math.Abs(delta) > 0.5)
                                    throw new ArgumentOutOfRangeException(nameof(delta));
                                volumeControl.Volume = (float)Math.Clamp(volumeControl.Volume + delta, 0.0, 1.0);
                            }
                            else if (operation == "mute")
                                volumeControl.Mute = input.GetProperty("value").GetBoolean();
                            else if (operation == "set")
                            {
                                double value = input.GetProperty("value").GetDouble();
                                if (!double.IsFinite(value) || value < 0 || value > 1)
                                    throw new ArgumentOutOfRangeException(nameof(value));
                                volumeControl.Volume = (float)value;
                            }
                        }

                        if (collected.TryGetValue(id, out var prev))
                        {
                            // An app may open multiple sessions or use multiple playback devices.
                            // Actions deliberately target all sessions with the same executable.
                            collected[id] = (prev.name, prev.device == device.FriendlyName ? prev.device : "Mehrere Ausgänge",
                                (prev.volume * prev.sessions + volumeControl.Volume) / (prev.sessions + 1),
                                prev.mute && volumeControl.Mute, prev.sessions + 1,
                                Math.Max(prev.peak, peak), prev.icon ?? icon);
                        }
                        else
                            collected[id] = (name, device.FriendlyName, volumeControl.Volume, volumeControl.Mute, 1, peak, icon);
                    }
                    catch (ArgumentOutOfRangeException) { throw; }
                    catch (Exception) { /* One closed/racing Windows session is not fatal. */ }
                }
            }
            catch (ArgumentOutOfRangeException) { throw; }
            catch (Exception) { /* A device may disappear during enumeration. */ }
        }
        return collected.OrderBy(x => x.Value.name, StringComparer.OrdinalIgnoreCase)
          .Select(x => new AppInfo(x.Key, x.Value.name, x.Value.device,
              Math.Round(x.Value.volume, 4), x.Value.mute, x.Value.sessions,
              Math.Round(x.Value.peak, 4), x.Value.icon))
          .ToList();
    }
}
