using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace NoobatWork.iPadMixer;

// Isolated child-process architecture: neither the existing Stream Deck plugin nor
// its audio bridge is modified or shared in-process.
internal sealed class AudioEngine : IDisposable
{
    private readonly string binDir;
    private readonly object gate = new();
    private LineWorker? appWorker;
    private LineWorker? vmWorker;
    private DateTime nextAppStart = DateTime.MinValue, nextVmStart = DateTime.MinValue;
    private DateTime appRequested = DateTime.MinValue, vmRequested = DateTime.MinValue;
    private bool waitingApp, waitingVm, vmOnline;
    private DateTime lastAppPoll = DateTime.MinValue, lastVmPoll = DateTime.MinValue;
    // Latest-value wins: never enqueue 30 intermediate slider positions.
    private readonly Dictionary<string, (bool app, string id, double value)> pendingGains = new();
    private JsonElement? appList;
    private readonly Dictionary<string, double> values = new();
    private readonly Dictionary<string, double> meters = new();
    private static readonly Regex ChannelPattern = new(@"^(Strip|Bus)\[[0-7]\]$", RegexOptions.Compiled);
    private static readonly Regex AppPattern = new(@"^[a-z0-9_.-]{1,116}\.exe$", RegexOptions.Compiled);
    private static readonly string[] ChannelKeys =
        Enumerable.Range(0, 8).Select(i => $"Strip[{i}]")
        .Concat(Enumerable.Range(0, 8).Select(i => $"Bus[{i}]")).ToArray();

    public AudioEngine(string binDir) { this.binDir = binDir; }
    public void Start() { StartApp(); StartVm(); }

    private void StartApp()
    {
        if (DateTime.UtcNow < nextAppStart) return;
        nextAppStart = DateTime.UtcNow.AddSeconds(12);
        var exe = Path.Combine(binDir, "NoobatWorkAudioSessions.exe");
        if (!File.Exists(exe)) { Console.WriteLine("App-Helper fehlt: " + exe); return; }
        try
        {
            appWorker = new LineWorker(exe, "");
            appWorker.Received += msg =>
            {
                if (!msg.TryGetProperty("type", out var t)) return;
                lock (gate)
                {
                    // The fast iPad helper replies "ack" to writes. Only a
                    // full "apps" response completes a pending discovery poll.
                    if (t.GetString() == "apps" && msg.TryGetProperty("apps", out var list) && list.ValueKind == JsonValueKind.Array)
                    {
                        waitingApp = false;
                        appList = list.Clone();
                    }
                }
            };
            appWorker.Start();
        }
        catch (Exception e) { Console.WriteLine("App-Helper nicht gestartet: " + e.Message); }
    }
    private void StartVm()
    {
        if (DateTime.UtcNow < nextVmStart) return;
        nextVmStart = DateTime.UtcNow.AddSeconds(12);
        var script = Path.Combine(binDir, "bridge.ps1");
        if (!File.Exists(script)) { Console.WriteLine("Voicemeeter-Bridge fehlt: " + script); return; }
        var ps = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
        try
        {
            vmWorker = new LineWorker(ps, "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + script + "\"");
            vmWorker.Received += msg =>
            {
                lock (gate)
                {
                    if (msg.TryGetProperty("ready", out var ready) && ready.ValueKind == JsonValueKind.True) vmOnline = true;
                    if (msg.TryGetProperty("error", out _)) { waitingVm = false; vmOnline = false; }
                    if (msg.TryGetProperty("values", out var vals) && vals.ValueKind == JsonValueKind.Object)
                    {
                        waitingVm = false; vmOnline = true;
                        foreach (var pair in vals.EnumerateObject())
                            if (pair.Value.TryGetDouble(out var n) && double.IsFinite(n)) values[pair.Name] = n;
                        if (msg.TryGetProperty("meters", out var lev) && lev.ValueKind == JsonValueKind.Object)
                            foreach (var pair in lev.EnumerateObject())
                                if (pair.Value.TryGetDouble(out var n) && double.IsFinite(n)) meters[pair.Name] = n;
                    }
                }
            };
            vmWorker.Start();
        }
        catch (Exception e) { Console.WriteLine("Voicemeeter-Bridge nicht gestartet: " + e.Message); }
    }

    public void Poll()
    {
        lock (gate)
        {
            if (appWorker is null || !appWorker.Alive) { waitingApp = false; appWorker?.Dispose(); appWorker = null; StartApp(); }
            if (vmWorker is null || !vmWorker.Alive) { waitingVm = false; vmOnline = false; vmWorker?.Dispose(); vmWorker = null; StartVm(); }
            var now = DateTime.UtcNow;
            // Deliver at most the most recent volume per key on every fast tick.
            // Commands are sent before slow full status scans.
            foreach (var (key, entry) in pendingGains.ToArray())
            {
                var success = entry.app
                    ? (appWorker?.Send(new { op = "set", app = entry.id, value = entry.value / 100 }) ?? false)
                    : (vmWorker?.Send(new { op = "set", path = entry.id + ".Gain", value = entry.value }) ?? false);
                if (success) pendingGains.Remove(key);
            }
            if (appWorker?.Alive == true && now - lastAppPoll >= TimeSpan.FromMilliseconds(520) &&
                (!waitingApp || (now - appRequested).TotalSeconds > 4))
            {
                waitingApp = appWorker.Send(new { op = "list" });
                appRequested = now;lastAppPoll = now;
            }
            if (vmWorker?.Alive == true && now - lastVmPoll >= TimeSpan.FromMilliseconds(450) &&
                (!waitingVm || (now - vmRequested).TotalSeconds > 4))
            {
                var levels = ChannelKeys.Select(key => new
                {
                    key,
                    type = key.StartsWith("Bus") ? 3 : 2,
                    channels = ChannelMeterIndices(key)
                }).ToArray();
                waitingVm = vmWorker.Send(new
                {
                    op = "get",
                    paths = ChannelKeys.SelectMany(key => new[] { key + ".Gain", key + ".Mute" }),
                    meters = levels
                });
                vmRequested = now;lastVmPoll = now;
            }
        }
    }

    private static int[] ChannelMeterIndices(string key)
    {
        bool bus = key.StartsWith("Bus");
        int idx = key[^2] - '0';
        if (bus) return Enumerable.Range(idx * 8, 8).ToArray();
        return idx < 5 ? new[] { idx * 2, idx * 2 + 1 } :
            Enumerable.Range(10 + (idx - 5) * 8, 8).ToArray();
    }

    public object Snapshot()
    {
        lock (gate)
        {
            // A single POST-fader peak, rather than gain value, controls the meter.
            var channels = ChannelKeys.Select(key =>
            {
                values.TryGetValue(key + ".Gain", out var gain);
                values.TryGetValue(key + ".Mute", out var mute);
                meters.TryGetValue(key, out var peak);
                int index = key[^2] - '0';
                bool bus = key.StartsWith("Bus");
                string label = bus ? (index < 5 ? "A" + (index + 1) : "B" + (index - 4)) :
                    (index < 5 ? "Input " + (index + 1) : "Virtual " + (index - 4));
                return new { id = key, name = label, kind = bus ? "bus" : "strip",
                    gain = Math.Round(gain, 2), mute = mute > .5,
                    peak = Math.Clamp(peak, 0, 1), online = vmOnline && values.ContainsKey(key + ".Gain") };
            }).ToArray();
            return new { type = "state", apps = appList, channels, appOnline = appWorker?.Alive ?? false,
                vmOnline, time = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() };
        }
    }

    public bool Command(JsonElement command)
    {
        try
        {
            if (command.ValueKind != JsonValueKind.Object) return false;
            string target = command.GetProperty("target").GetString() ?? "";
            string id = command.GetProperty("id").GetString() ?? "";
            string op = command.GetProperty("op").GetString() ?? "";
            if (op is not ("set" or "mute")) return false;
            if (target == "app")
            {
                if (!AppPattern.IsMatch(id)) return false;
                lock (gate)
                {
                    if (op == "mute")
                    {
                        if (!command.GetProperty("value").TryGetBoolean(out var mute)) return false;
                        return appWorker?.Send(new { op = "mute", app = id, value = mute }) ?? false;
                    }
                    if (!command.GetProperty("value").TryGetDouble(out var p) || !double.IsFinite(p) || p < 0 || p > 100) return false;
                    if (appWorker?.Alive != true) return false;
                    pendingGains["app:"+id] = (true,id,p);
                    return true;
                }
            }
            if (target == "channel")
            {
                if (!ChannelPattern.IsMatch(id)) return false;
                string param = op == "set" ? "Gain" : "Mute";
                double v;
                if (op == "mute")
                {
                    if (!command.GetProperty("value").TryGetBoolean(out var muted)) return false;
                    v = muted ? 1 : 0;
                }
                else
                {
                    if (!command.GetProperty("value").TryGetDouble(out v) || !double.IsFinite(v) || v < -60 || v > 12) return false;
                }
                lock (gate)
                {
                    if (op == "mute") return vmWorker?.Send(new { op = "set", path = id + "." + param, value = v }) ?? false;
                    if (vmWorker?.Alive != true) return false;
                    pendingGains["channel:"+id] = (false,id,v);
                    return true;
                }
            }
            return false;
        }
        catch (Exception) { return false; }
    }

    public void Dispose()
    {
        lock (gate) { vmWorker?.Dispose(); appWorker?.Dispose(); vmWorker = null; appWorker = null; }
    }
}

// A child process is scoped to this app's lifetime and only accepts closed-form JSON commands.
internal sealed class LineWorker : IDisposable
{
    private readonly Process process;
    private readonly object writeGate = new();
    public event Action<JsonElement>? Received;
    public bool Alive { get { try { return process.StartInfo != null && !process.HasExited; } catch { return false; } } }
    public LineWorker(string file, string arguments)
    {
        process = new Process
        {
            StartInfo = new ProcessStartInfo(file, arguments)
            {
                UseShellExecute = false, RedirectStandardInput = true, RedirectStandardOutput = true,
                RedirectStandardError = true, CreateNoWindow = true,
                StandardInputEncoding = new UTF8Encoding(false), StandardOutputEncoding = Encoding.UTF8
            }
        };
    }
    public void Start()
    {
        process.OutputDataReceived += (_, line) =>
        {
            if (string.IsNullOrEmpty(line.Data)) return;
            try
            {
                using var doc = JsonDocument.Parse(line.Data.TrimStart('\uFEFF'));
                Received?.Invoke(doc.RootElement);
            }
            catch (Exception) { /* Keep process alive; one line may be malformed. */ }
        };
        process.ErrorDataReceived += (_, _) => { }; // drain stderr to avoid deadlocks
        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
    }
    public bool Send(object msg)
    {
        try
        {
            lock (writeGate)
            {
                if (!Alive) return false;
                process.StandardInput.WriteLine(JsonSerializer.Serialize(msg));
                process.StandardInput.Flush();
                return true;
            }
        }
        catch (Exception) { return false; }
    }
    public void Dispose()
    {
        try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch { }
        try { process.Dispose(); } catch { }
    }
}

internal static class JsonExtensions
{
    public static bool TryGetBoolean(this JsonElement e, out bool result)
    {
        result = e.ValueKind == JsonValueKind.True;
        return e.ValueKind is JsonValueKind.True or JsonValueKind.False;
    }
}
