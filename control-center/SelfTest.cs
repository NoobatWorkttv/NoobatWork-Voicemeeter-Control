using System.Net;
using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Windows.Forms;

namespace NoobatWork.iPadMixer;

internal static class SelfTest
{
    private static void Check(bool value, string message) { if (!value) throw new Exception(message); }
    public static void Run()
    {
        var result = Environment.GetEnvironmentVariable("NAW_TEST_RESULT") ?? Path.Combine(Path.GetTempPath(), "naw-center-test.json");
        try
        {
            TestAsync().GetAwaiter().GetResult();
            using var form = new ControlCenter(new LogWriter(), Array.Empty<string>());
            form.CreateControl();
            Check(form.Text.Contains("v0.2.0") && form.Controls.Count > 0, "Native GUI construction");
            File.WriteAllText(result, JsonSerializer.Serialize(new { passed = true, tests = new[] { "Windows HTTP", "pairing", "unauthorized requests", "wrong origin", "three simultaneous WebSockets", "invalid command", "device profiles live", "profile persistence", "profile validation", "native GUI construction", "graceful shutdown" } }));
        }
        catch (Exception e) { File.WriteAllText(result, JsonSerializer.Serialize(new { passed = false, error = e.ToString() })); Environment.ExitCode = 1; }
    }
    private static async Task TestAsync()
    {
        using var stop = new CancellationTokenSource();
        var server = MixerServer.RunAsync(new[] { "--port", "18877" }, stop.Token);
        using var http = new HttpClient { BaseAddress = new Uri("http://127.0.0.1:18877") };
        try
        {
            for (int i = 0; i < 100 && MixerServer.Status != "Online"; i++) { if (server.IsCompleted) await server; await Task.Delay(100); }
            Check(MixerServer.Status == "Online", MixerServer.Status);
            Check((await http.GetAsync("/")).StatusCode == HttpStatusCode.OK, "Web UI missing");
            Check((await http.GetAsync("/api/state")).StatusCode == HttpStatusCode.Unauthorized, "Unauthenticated state exposed");
            using var badOrigin = new HttpRequestMessage(HttpMethod.Post, "/api/pair") { Content = JsonContent.Create(new { code = MixerServer.PairingCode }) };
            badOrigin.Headers.Add("Origin", "http://evil.invalid");
            Check((await http.SendAsync(badOrigin)).StatusCode == HttpStatusCode.Forbidden, "Origin not checked");
            http.DefaultRequestHeaders.Add("Origin", "http://127.0.0.1:18877");
            Check((await http.PostAsJsonAsync("/api/pair", new { code = "000000" })).StatusCode == HttpStatusCode.Unauthorized, "Bad pairing code accepted");
            var paired = await http.PostAsJsonAsync("/api/pair", new { code = MixerServer.PairingCode });
            paired.EnsureSuccessStatusCode();
            var token = (await paired.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
            using var unauthorized = new ClientWebSocket(); unauthorized.Options.SetRequestHeader("Origin", "http://127.0.0.1:18877");
            await unauthorized.ConnectAsync(new Uri("ws://127.0.0.1:18877/ws"), CancellationToken.None);
            await Send(unauthorized, new { type = "auth", token = "wrong" });
            Check((await Receive(unauthorized, "unauthorized")).GetProperty("type").GetString() == "unauthorized", "Bad WS token accepted");
            var sockets = new List<ClientWebSocket>();
            try
            {
                foreach (var name in new[] { "ipad", "android", "windows-touch" })
                {
                    var socket = new ClientWebSocket(); sockets.Add(socket); socket.Options.SetRequestHeader("Origin", "http://127.0.0.1:18877");
                    await socket.ConnectAsync(new Uri("ws://127.0.0.1:18877/ws"), CancellationToken.None);
                    await Send(socket, new { type = "auth", token, deviceId = name, name });
                    await Receive(socket, "profile");
                    Check((await Receive(socket, "state")).GetProperty("channels").GetArrayLength() == 16, "Invalid snapshot");
                }
                Check(MixerServer.Devices().Count(x => x.Online) == 3, "Three simultaneous devices not online");
                await Send(sockets[0], new { type = "command", command = new { target = "channel", id = "Strip[99]", op = "set", value = 999 } });
                await Receive(sockets[0], "error");
                var profile = new MixerProfile("Touch desk", "split", new() { new("channel:Bus[0]", "Speakers", true, "#ff8800"), new("channel:Strip[0]", "Mic", false, "#00ff00") });
                MixerServer.Profiles.Save("windows-touch", profile);
                var applied = await Receive(sockets[2], "profile");
                Check(applied.GetProperty("profile").GetProperty("Name").GetString() == "Touch desk", "Device profile missing");
                var other = await Receive(sockets[1], "profile");
                Check(other.GetProperty("profile").GetProperty("Name").GetString() == "Standard", "Profile leaked across devices");
                var reloaded = new ProfileStore(Environment.GetEnvironmentVariable("NAW_DATA_DIR")!);
                Check(reloaded.Get("windows-touch").Items[1].Visible == false, "Profile persistence failed");
                bool rejected = false;
                try { MixerServer.Profiles.Save("windows-touch", profile with { Layout = "invalid" }); } catch (ArgumentException) { rejected = true; }
                Check(rejected, "Invalid profile accepted");
            }
            finally { foreach (var s in sockets) { s.Abort(); s.Dispose(); } }
        }
        finally { stop.Cancel(); await server.WaitAsync(TimeSpan.FromSeconds(15)); }
        Check(MixerServer.Status == "Gestoppt", "Server did not stop");
    }
    private static async Task Send(ClientWebSocket socket, object value) => await socket.SendAsync(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value)), WebSocketMessageType.Text, true, CancellationToken.None);
    private static async Task<JsonElement> Receive(ClientWebSocket socket, string type)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(8));
        while (true)
        {
            using var data = new MemoryStream(); var buffer = new byte[65536]; WebSocketReceiveResult r;
            do { r = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), timeout.Token); Check(r.MessageType == WebSocketMessageType.Text, "Socket closed"); data.Write(buffer, 0, r.Count); } while (!r.EndOfMessage);
            using var doc = JsonDocument.Parse(data.ToArray()); if (doc.RootElement.GetProperty("type").GetString() == type) return doc.RootElement.Clone();
        }
    }
}
