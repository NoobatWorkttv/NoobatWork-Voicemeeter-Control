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

internal static class Program
{
    private const int DefaultPort = 8876;
    private static readonly ConcurrentDictionary<string, (int count, DateTime since)> PairAttempts = new();
    private static readonly ConcurrentDictionary<Guid, ClientSocket> Clients = new();
    private static string accessToken = "";
    private static string pairingCode = "";
    private static AudioEngine engine = null!;

    public static async Task Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        int port = DefaultPort;
        for (int i = 0; i < args.Length - 1; i++)
            if (args[i] == "--port" && int.TryParse(args[i + 1], out var p) && p is >= 1024 and <= 65535) port = p;
        var dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "NoobatWork", "iPadMixer");
        Directory.CreateDirectory(dataDir);
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
        builder.Logging.AddConsole();
        var app = builder.Build();

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
            try
            {
                while (socket.State == WebSocketState.Open)
                {
                    using var stream = new MemoryStream();
                    WebSocketReceiveResult result;
                    do
                    {
                        result = await socket.ReceiveAsync(new ArraySegment<byte>(data), CancellationToken.None);
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
                        authenticated = true;
                        Clients[id] = client;
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

        var cts = new CancellationTokenSource();
        app.Lifetime.ApplicationStopping.Register(() => { cts.Cancel(); engine.Dispose(); });
        _ = Task.Run(async () =>
        {
            while (!cts.IsCancellationRequested)
            {
                try
                {
                    engine.Poll();
                    var snapshot = engine.Snapshot();
                    var tasks = Clients.Values.Select(c => c.Send(snapshot)).ToArray();
                    await Task.WhenAll(tasks);
                    await Task.Delay(600, cts.Token);
                }
                catch (OperationCanceledException) { break; }
                catch (Exception) { try { await Task.Delay(1500, cts.Token); } catch { break; } }
            }
        });

        Console.WriteLine();
        Console.WriteLine("===========================================================");
        Console.WriteLine("  NoobatWork Audio Mixer - iPad Edition (LAN Preview)");
        Console.WriteLine("===========================================================");
        Console.WriteLine("  Auf dem iPad Safari öffnen:");
        foreach (var address in LocalAddresses())
            Console.WriteLine($"    http://{address}:{port}/");
        Console.WriteLine($"  Pairing-Code: {pairingCode}");
        Console.WriteLine("  Code gilt bis zum Neustart dieses Programms.");
        Console.WriteLine("  Nur in deinem privaten Heimnetz verwenden.");
        Console.WriteLine("  Dieses Fenster geöffnet lassen! Schließen = Server aus.");
        Console.WriteLine("===========================================================");
        Console.WriteLine();
        await app.RunAsync();
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
    public ClientSocket(WebSocket socket) => this.socket = socket;
    public async Task Send(object value)
    {
        try
        {
            await sendGate.WaitAsync();
            if (socket.State != WebSocketState.Open) return;
            var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value));
            await socket.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
        }
        catch (Exception) { }
        finally { try { sendGate.Release(); } catch (ObjectDisposedException) { } }
    }
    // Socket belongs to the HTTP request, only the send gate belongs to this wrapper.
    public void Dispose() => sendGate.Dispose();
}
