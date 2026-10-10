using System.Collections.Concurrent;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Net.WebSockets;

namespace NoobatWork.iPadMixer;

internal static class MixerServer
{
    private const int DefaultPort = 8877;
    private static readonly ConcurrentDictionary<string, (int count, DateTime since)> PairAttempts = new();
    private static readonly ConcurrentDictionary<Guid, ClientSocket> Clients = new();
    private static string accessToken = "";
    private static string pairingCode = "";
    private static AudioEngine engine = null!;

    public static async Task RunAsync(string[] args, CancellationToken cancellation)
    {
        Status = "Startet…";
        try {
        int port = DefaultPort;
        for (int i = 0; i < args.Length - 1; i++)
            if (args[i] == "--port" && int.TryParse(args[i + 1], out var p) && p is >= 1024 and <= 65535) port = p;
        var dataDir = Environment.GetEnvironmentVariable("NAW_DATA_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "NoobatWork", "MixerControlCenter");
        Directory.CreateDirectory(dataDir);
        Profiles ??= new ProfileStore(dataDir);
        Port = port;
        PairAttempts.Clear();
        string tokenFile = Path.Combine(dataDir, "pair-token.txt");
        if (File.Exists(tokenFile))
        {
            accessToken = File.ReadAllText(tokenFile).Trim();
            if (!Regex.IsMatch(accessToken, @"\A[a-f0-9]{64}\z")) accessToken = "";
        }
        if (accessToken.Length != 64)
        {
            accessToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
            File.WriteAllText(tokenFile, accessToken, Encoding.ASCII);
        }
        pairingCode = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
        engine = new AudioEngine(Path.Combine(AppContext.BaseDirectory, "bin"));
        engine.Start();
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = Array.Empty<string>(), WebRootPath = Path.Combine(AppContext.BaseDirectory, "wwwroot") });
        builder.WebHost.UseKestrel(o => o.Listen(IPAddress.Any, port));
        builder.Logging.ClearProviders();
        builder.Logging.AddProvider(new CenterLogProvider());
        await using var app = builder.Build();

        app.Use(async (ctx, next) =>
        {
            if (!IsPrivate(ctx.Connection.RemoteIpAddress) || !IsSafeHost(ctx.Request.Host.Host))
            {
                ctx.Response.StatusCode = 403;
                return;
            }
            ctx.Response.Headers.CacheControl = "no-store";
            await next();
        });
        app.UseDefaultFiles();
        app.UseStaticFiles();
        app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(20) });

        app.MapPost("/api/pair", async (HttpContext ctx) =>
        {
            ctx.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>()!.MaxRequestBodySize = 256;
            if (!SameOrigin(ctx) || !(ctx.Request.ContentType ?? "").StartsWith("application/json", StringComparison.OrdinalIgnoreCase))
                return Results.StatusCode(403);
            string key = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var now = DateTime.UtcNow;
            var n = PairAttempts.AddOrUpdate(key, (1, now), (_, old) =>
                now - old.since > TimeSpan.FromMinutes(10) ? (1, now) : (old.count + 1, old.since));
            if (n.count > 12) return Results.StatusCode(429);
            try
            {
                if (ctx.Request.ContentLength is > 256) return Results.BadRequest();
                using var doc = await JsonDocument.ParseAsync(ctx.Request.Body);
                string code = doc.RootElement.GetProperty("code").GetString() ?? "";
                if (FixedEqual(code, pairingCode))
                {
                    PairAttempts.TryRemove(key, out _);
                    return Results.Json(new { token = accessToken });
                }
            }
            catch (Exception) { }
            return Results.Unauthorized();
        });

        app.MapGet("/api/state", (HttpContext ctx) =>
        {
            if (!Authorized(ctx.Request.Headers.Authorization.ToString().Replace("Bearer ", "", StringComparison.Ordinal)))
                return Results.Unauthorized();
            return Results.Json(engine.Snapshot());
        });

        app.Map("/ws", async (HttpContext ctx) =>
        {
            if (!SameOrigin(ctx) || !ctx.WebSockets.IsWebSocketRequest)
            {
                ctx.Response.StatusCode = 403;
                return;
            }
            using var socket = await ctx.WebSockets.AcceptWebSocketAsync();
            using var client = new ClientSocket(socket);
            bool authenticated = false;
            var id = Guid.NewGuid();
            var data = new byte[8192];
            string deviceId = "";
            using var authTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
            authTimeout.CancelAfter(TimeSpan.FromSeconds(10));
            try
            {
                while (socket.State == WebSocketState.Open)
                {
                    using var stream = new MemoryStream();
                    WebSocketReceiveResult result;
                    do
                    {
                        result = await socket.ReceiveAsync(new ArraySegment<byte>(data), authenticated ? cancellation : authTimeout.Token);
                        if (result.MessageType == WebSocketMessageType.Close) return;
                        if (stream.Length + result.Count > 8192) return;
                        stream.Write(data, 0, result.Count);
                    } while (!result.EndOfMessage);
                    if (result.MessageType != WebSocketMessageType.Text) continue;
                    using var msg = JsonDocument.Parse(stream.ToArray());
                    var root = msg.RootElement;
                    string type = root.TryGetProperty("type", out var t) ? t.GetString() ?? "" : "";
                    if (!authenticated)
                    {
                        if (type != "auth" || !root.TryGetProperty("token", out var v) || !Authorized(v.GetString() ?? ""))
                        {
                            await client.Send(new { type = "unauthorized" });
                            return;
                        }
                        deviceId = root.TryGetProperty("deviceId", out var did) ? did.GetString() ?? "" : "";
                        if (!Regex.IsMatch(deviceId, @"\A[a-zA-Z0-9_-]{1,64}\z")) deviceId = "legacy-" + id.ToString("N");
                        string name = root.TryGetProperty("name", out var dn) ? dn.GetString() ?? "Browser" : "Browser";
                        if (name.Length > 80) name = name[..80];
                        client.DeviceId = deviceId;
                        KnownDevices[deviceId] = new(deviceId, name, ctx.Connection.RemoteIpAddress?.ToString() ?? "", true, DateTime.UtcNow);
                        Console.WriteLine("Gerät verbunden: " + name);
                        authenticated = true;
                        Clients[id] = client;
                        await client.SendProfile();
                        await client.Send(engine.Snapshot());
                        continue;
                    }
                    if (type == "command" && root.TryGetProperty("command", out var command))
                    {
                        bool accepted = engine.Command(command);
                        if (!accepted) await client.Send(new { type = "error", message = "Ungültiger Audio-Befehl" });
                    }
                }
            }
            catch (Exception) { /* A disconnected tablet is normal. */ }
            finally { Clients.TryRemove(id, out _); }
        });

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
        app.Lifetime.ApplicationStopping.Register(() => { cts.Cancel(); engine.Dispose(); });
        var pollTask = Task.Run(async () =>
        {
            // Keep the v0.1.1 command tick independent of slow network clients.
            while (!cts.IsCancellationRequested)
            {
                try
                {
                    engine.Poll();
                    await Task.Delay(90, cts.Token);
                }
                catch (OperationCanceledException) { break; }
                catch (Exception) { try { await Task.Delay(500, cts.Token); } catch { break; } }
            }
        });
        var broadcastTask = Task.Run(async () =>
        {
            while (!cts.IsCancellationRequested)
            {
                try
                {
                    var snapshot = engine.Snapshot();
                    await Task.WhenAll(Clients.Values.Select(async c =>
                    {
                        await c.SendProfile(); await c.Send(snapshot);
                        if (KnownDevices.TryGetValue(c.DeviceId, out var d)) KnownDevices[c.DeviceId] = d with { LastSeen = DateTime.UtcNow };
                    }));
                    await Task.Delay(300, cts.Token);
                }
                catch (OperationCanceledException) { break; }
                catch (Exception e) { Console.WriteLine("Statusübertragung: " + e.Message); }
            }
        });

        try
        {
            await app.StartAsync(cancellation);
            Status = "Online";
            Console.WriteLine($"Server online auf Port {port}");
            await app.WaitForShutdownAsync(cancellation);
        }
        finally { cts.Cancel(); await Task.WhenAll(pollTask, broadcastTask); engine.Dispose(); }
        }
        catch (OperationCanceledException) { }
        catch (Exception e) { Status = "Fehler: " + e.Message; Console.WriteLine(Status); engine?.Dispose(); return; }
        finally { foreach (var c in Clients.Values) c.Abort(); Clients.Clear(); }
        Status = "Gestoppt";
    }

    public static int Port { get; private set; } = DefaultPort;
    public static string Status { get; private set; } = "Gestoppt";
    public static string PairingCode => pairingCode;
    public static ProfileStore Profiles { get; private set; } = null!;
    private static readonly ConcurrentDictionary<string, DeviceInfo> KnownDevices = new();
    public static DeviceInfo[] Devices() => KnownDevices.Values.OrderBy(d => d.Name).ToArray();
    public static string[] Addresses() => LocalAddresses().Select(a => $"http://{a}:{Port}/").Prepend($"http://127.0.0.1:{Port}/ (dieser PC)").ToArray();
    public static void RotateCode() { pairingCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString(); PairAttempts.Clear(); Console.WriteLine("Pairing-Code erneuert"); }
    public static string AudioStatus
    {
        get { if (engine == null) return "Audio wartet"; var state = JsonSerializer.SerializeToElement(engine.Snapshot()); return "Windows Audio: " + (state.GetProperty("appOnline").GetBoolean() ? "Online" : "Offline") + " · Voicemeeter: " + (state.GetProperty("vmOnline").GetBoolean() ? "Online" : "Offline"); }
    }
    public static List<MixerItem> AvailableItems()
    {
        var items = new List<MixerItem>();
        if (engine == null) return items;
        var state = JsonSerializer.SerializeToElement(engine.Snapshot());
        foreach (var ch in state.GetProperty("channels").EnumerateArray()) items.Add(new("channel:" + ch.GetProperty("id").GetString(), ch.GetProperty("name").GetString()!, true, "#37cce5"));
        if (state.GetProperty("apps").ValueKind == JsonValueKind.Array)
            foreach (var a in state.GetProperty("apps").EnumerateArray()) items.Add(new("app:" + a.GetProperty("id").GetString(), a.GetProperty("name").GetString()!, true, "#668fff"));
        return items;
    }

    private static bool Authorized(string candidate) => candidate.Length == 64 && FixedEqual(candidate, accessToken);
    private static bool FixedEqual(string a, string b)
    {
        var aa = Encoding.UTF8.GetBytes(a);
        var bb = Encoding.UTF8.GetBytes(b);
        return aa.Length == bb.Length && CryptographicOperations.FixedTimeEquals(aa, bb);
    }
    private static bool IsPrivate(IPAddress? address)
    {
        if (address is null) return false;
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        if (IPAddress.IsLoopback(address)) return true;
        var b = address.GetAddressBytes();
        return address.AddressFamily == AddressFamily.InterNetwork &&
            (b[0] == 10 || (b[0] == 172 && b[1] is >= 16 and <= 31) ||
             (b[0] == 192 && b[1] == 168) || (b[0] == 169 && b[1] == 254));
    }
    private static bool IsSafeHost(string host) =>
        host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
        (IPAddress.TryParse(host, out var ip) && IsPrivate(ip));

    private static bool SameOrigin(HttpContext ctx)
    {
        string value = ctx.Request.Headers.Origin.ToString();
        if (!Uri.TryCreate(value, UriKind.Absolute, out var origin)) return false;
        return origin.Scheme == "http" &&
            string.Equals(origin.Host, ctx.Request.Host.Host, StringComparison.OrdinalIgnoreCase) &&
            origin.Port == (ctx.Request.Host.Port ?? 80);
    }
    private static IEnumerable<IPAddress> LocalAddresses() =>
        NetworkInterface.GetAllNetworkInterfaces()
            .Where(n => n.OperationalStatus == OperationalStatus.Up && n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
            .SelectMany(n => n.GetIPProperties().UnicastAddresses)
            .Select(a => a.Address)
            .Where(a => a.AddressFamily == AddressFamily.InterNetwork && IsPrivate(a))
            .Distinct();
}

internal sealed class ClientSocket : IDisposable
{
    private readonly WebSocket socket;
    private readonly SemaphoreSlim sendGate = new(1, 1);
    public string DeviceId { get; set; } = "default";
    private long profileRevision = -1;
    public void Abort() => socket.Abort();
    public async Task SendProfile()
    {
        var (revision, profile) = MixerServer.Profiles.Read(DeviceId);
        if (profileRevision == revision) return;
        await Send(new { type = "profile", profile, revision });
        profileRevision = revision;
    }
    public ClientSocket(WebSocket socket) => this.socket = socket;
    public async Task Send(object value)
    {
        try
        {
            await sendGate.WaitAsync();
            if (socket.State != WebSocketState.Open) return;
            var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value));
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            await socket.SendAsync(bytes, WebSocketMessageType.Text, true, timeout.Token);
        }
        catch (Exception) { }
        finally { try { sendGate.Release(); } catch (ObjectDisposedException) { } }
    }
    // Socket belongs to the HTTP request, only the send gate belongs to this wrapper.
    public void Dispose() => sendGate.Dispose();
}

internal sealed record DeviceInfo(string Id, string Name, string Address, bool Online, DateTime LastSeen);
internal sealed class CenterLogProvider : ILoggerProvider
{
    public ILogger CreateLogger(string categoryName) => new CenterLogger();
    public void Dispose() { }
    private sealed class CenterLogger : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel level) => level >= LogLevel.Warning;
        public void Log<TState>(LogLevel level, EventId id, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        { if (IsEnabled(level)) Console.WriteLine(formatter(state, exception)); }
    }
}

