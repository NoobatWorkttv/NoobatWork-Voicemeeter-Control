using System.Drawing;
using System.Windows.Forms;
using System.Text;
using System.Collections.Concurrent;
using System.Text.Json;

namespace NoobatWork.iPadMixer;

internal static class Desktop
{
    [STAThread]
    public static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var logs = new LogWriter();
        Console.SetOut(logs);
        Console.SetError(logs);
        using var mutex = new Mutex(true, "Local\\NoobatWork-Mixer-Control-Center-v020", out bool first);
        if (!first) { MessageBox.Show("Das Control Center läuft bereits. Bitte das Symbol im Infobereich öffnen."); return; }
        if (args.Contains("--self-test")) { SelfTest.Run(); return; }
        using var form = new ControlCenter(logs, args);
        Application.Run(form);
    }
}

internal sealed class LogWriter : TextWriter
{
    public override Encoding Encoding => Encoding.UTF8;
    private readonly ConcurrentQueue<string> lines = new();
    public override void WriteLine(string? value)
    {
        lines.Enqueue(DateTime.Now.ToString("HH:mm:ss") + "  " + value);
        while (lines.Count > 500) lines.TryDequeue(out _);
    }
    public string Text => string.Join(Environment.NewLine, lines);
}

internal sealed class ControlCenter : Form
{
    private readonly Label status = new() { AutoSize = true };
    private readonly TextBox addresses = new() { ReadOnly = true, Multiline = true, Height = 85, Dock = DockStyle.Top };
    private readonly Label pairing = new() { AutoSize = true, Font = new Font("Segoe UI", 18, FontStyle.Bold) };
    private readonly ListBox devices = new() { Dock = DockStyle.Fill };
    private readonly TextBox logs = new() { Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Both, Dock = DockStyle.Fill };
    private readonly ComboBox device = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 290 };
    private readonly ComboBox layout = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 110, AccessibleName = "Layout: auto, split oder full" };
    private readonly TextBox profileName = new() { Width = 200, AccessibleName = "Profilname", PlaceholderText = "Profilname" };
    private readonly DataGridView grid = new() { Dock = DockStyle.Fill, AllowUserToAddRows = false, AllowUserToDeleteRows = false, AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill, SelectionMode = DataGridViewSelectionMode.FullRowSelect, MultiSelect = false };
    private readonly NotifyIcon tray;
    private readonly System.Windows.Forms.Timer timer = new() { Interval = 600 };
    private CancellationTokenSource? stop;
    private Task? server;
    private bool exiting, profileLoaded;
    private readonly string[] args;
    private readonly LogWriter logWriter;
    public ControlCenter(LogWriter writer, string[] args)
    {
        this.args = args; logWriter = writer;
        Text = "NoobatWork Mixer Control Center · v0.2.0";
        MinimumSize = new Size(920, 620); Size = new Size(1100, 760);
        Font = new Font("Segoe UI", 10); StartPosition = FormStartPosition.CenterScreen;
        var tabs = new TabControl { Dock = DockStyle.Fill };
        var overview = new TabPage("Server & Pairing") { Padding = new Padding(20) };
        var panel = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true };
        panel.Controls.Add(new Label { Text = "NOOBATWORK  /  MIXER CONTROL CENTER", AutoSize = true, Font = new Font(Font, FontStyle.Bold) });
        panel.Controls.Add(status); panel.Controls.Add(pairing);
        addresses.Width = 770; panel.Controls.Add(addresses);
        var actions = new FlowLayoutPanel { AutoSize = true };
        actions.Controls.Add(Button("Server starten", (_, _) => StartServer()));
        actions.Controls.Add(Button("Server stoppen", async (_, _) => await StopServer()));
        actions.Controls.Add(Button("Mixer öffnen", (_, _) => System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo($"http://127.0.0.1:{MixerServer.Port}/") { UseShellExecute = true })));
        actions.Controls.Add(Button("Neuer Pairing-Code", (_, _) => MixerServer.RotateCode()));
        panel.Controls.Add(actions);
        panel.Controls.Add(new Label { Text = "iPad, Android oder Windows-Touch-PC: LAN-Adresse im Browser öffnen und Code eingeben.\nFenster schließen minimiert in den Infobereich. Beenden über das Tray-Menü.\nPort 8877 • Bei Bedarf Windows-Firewall für private Netzwerke freigeben.", AutoSize = true });
        overview.Controls.Add(panel);
        var devicePage = new TabPage("Geräte"); devicePage.Controls.Add(devices);
        var editor = new TabPage("Mixer & Profile") { Padding = new Padding(10) };
        var bar = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 85, AutoScroll = true };
        device.Items.Add(new DeviceChoice("default", "Standard (für neue Geräte)")); device.SelectedIndex = 0;
        layout.Items.AddRange(new object[] { "auto", "split", "full" });
        bar.Controls.Add(device); bar.Controls.Add(profileName); bar.Controls.Add(layout);
        bar.Controls.Add(Button("Laden / Verwerfen", (_, _) => LoadProfile()));
        bar.Controls.Add(Button("↑", (_, _) => MoveRow(-1))); bar.Controls.Add(Button("↓", (_, _) => MoveRow(1)));
        bar.Controls.Add(Button("Farbe…", (_, _) => PickColor()));
        bar.Controls.Add(Button("Speichern", (_, _) => SaveProfile()));
        grid.Columns.Add(new DataGridViewTextBoxColumn { Name = "Key", HeaderText = "Kanal", ReadOnly = true });
        grid.Columns.Add("Name", "Anzeigename");
        grid.Columns.Add(new DataGridViewCheckBoxColumn { Name = "Visible", HeaderText = "Sichtbar" });
        grid.Columns.Add("Color", "Farbe (#RRGGBB)");
        editor.Controls.Add(grid); editor.Controls.Add(bar);
        editor.Controls.Add(new Label { Text = "Reihenfolge mit ↑ / ↓ ändern. Speichern überträgt das Profil an verbundene Geräte. Gerät auswählen, um dessen eigenes Layout zu bearbeiten.", Dock = DockStyle.Bottom, Height = 45 });
        var logPage = new TabPage("Logs"); logPage.Controls.Add(logs);
        tabs.TabPages.AddRange(new[] { overview, devicePage, editor, logPage }); Controls.Add(tabs);
        tray = new NotifyIcon { Icon = SystemIcons.Application, Text = "NoobatWork Mixer Control Center", Visible = true };
        var menu = new ContextMenuStrip();
        menu.Items.Add("Control Center öffnen", null, (_, _) => Restore());
        menu.Items.Add("Server starten", null, (_, _) => StartServer());
        menu.Items.Add("Server stoppen", null, async (_, _) => await StopServer());
        menu.Items.Add("Beenden", null, async (_, _) => { exiting = true; await StopServer(); Close(); });
        tray.ContextMenuStrip = menu; tray.DoubleClick += (_, _) => Restore();
        FormClosing += (_, e) => { if (!exiting && e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; Hide(); } };
        device.SelectedIndexChanged += (_, _) => LoadProfile();
        timer.Tick += (_, _) => RefreshStatus(); timer.Start();
        Shown += (_, _) => { StartServer(); LoadProfile(); };
    }
    private static Button Button(string text, EventHandler click) { var b = new Button { Text = text, AutoSize = true, Height = 34 }; b.Click += click; return b; }
    private void Restore() { Show(); WindowState = FormWindowState.Normal; Activate(); }
    private void StartServer()
    {
        if (server is { IsCompleted: false }) return;
        stop?.Dispose(); stop = new CancellationTokenSource();
        server = Task.Run(() => MixerServer.RunAsync(args, stop.Token));
    }
    private async Task StopServer()
    {
        stop?.Cancel();
        if (server != null) try { await server; } catch (Exception e) { Console.WriteLine(e.Message); }
    }
    private void RefreshStatus()
    {
        if (!profileLoaded && MixerServer.Status == "Online") { LoadProfile(); profileLoaded = true; }
        status.Text = "Server: " + MixerServer.Status + "   |   " + MixerServer.AudioStatus;
        pairing.Text = MixerServer.Status == "Online" ? "Pairing-Code: " + MixerServer.PairingCode : "Pairing verfügbar, sobald der Server läuft";
        addresses.Text = string.Join(Environment.NewLine, MixerServer.Addresses());
        var text = logWriter.Text; if (logs.Text != text) { logs.Text = text; logs.SelectionStart = logs.TextLength; logs.ScrollToCaret(); }
        var entries = MixerServer.Devices();
        devices.BeginUpdate(); devices.Items.Clear();
        foreach (var d in entries)
        {
            devices.Items.Add($"{d.Name}  |  {d.Address}  |  {(d.Online ? "Verbunden" : "Offline")}  |  zuletzt {d.LastSeen.ToLocalTime():HH:mm:ss}  |  {d.Id}");
            if (!device.Items.Cast<DeviceChoice>().Any(x => x.Id == d.Id)) device.Items.Add(new DeviceChoice(d.Id, d.Name + " · " + d.Id));
        }
        devices.EndUpdate();
        if (MixerServer.Profiles != null)
            foreach (var id in MixerServer.Profiles.Keys())
                if (!device.Items.Cast<DeviceChoice>().Any(x => x.Id == id)) device.Items.Add(new DeviceChoice(id, MixerServer.Profiles.Get(id).Name + " · " + id));
    }
    private string DeviceId => ((DeviceChoice)device.SelectedItem!).Id;
    private void LoadProfile()
    {
        if (MixerServer.Profiles == null) return;
        var p = MixerServer.Profiles.Get(DeviceId); profileName.Text = p.Name; layout.SelectedItem = p.Layout;
        grid.Rows.Clear();
        var rows = p.Items.ToList();
        foreach (var item in MixerServer.AvailableItems()) if (!rows.Any(x => x.Key == item.Key)) rows.Add(item);
        foreach (var item in rows) grid.Rows.Add(item.Key, item.Name, item.Visible, item.Color);
    }
    private void SaveProfile()
    {
        try
        {
            grid.EndEdit();
            var items = grid.Rows.Cast<DataGridViewRow>().Select(r => new MixerItem(Convert.ToString(r.Cells[0].Value) ?? "", Convert.ToString(r.Cells[1].Value) ?? "", Convert.ToBoolean(r.Cells[2].Value), Convert.ToString(r.Cells[3].Value) ?? "")).ToList();
            MixerServer.Profiles.Save(DeviceId, new MixerProfile(profileName.Text.Trim(), layout.SelectedItem?.ToString() ?? "auto", items));
        }
        catch (Exception e) { MessageBox.Show(this, e.Message, "Profil nicht gespeichert"); }
    }
    private void MoveRow(int direction)
    {
        if (grid.CurrentRow is not { } row) return;
        int from = row.Index, to = from + direction; if (to < 0 || to >= grid.Rows.Count) return;
        grid.EndEdit(); grid.Rows.Remove(row); grid.Rows.Insert(to, row); grid.CurrentCell = row.Cells[1];
    }
    private void PickColor()
    {
        if (grid.CurrentRow is not { } row) return;
        using var dialog = new ColorDialog();
        if (dialog.ShowDialog(this) == DialogResult.OK) row.Cells[3].Value = "#" + dialog.Color.R.ToString("X2") + dialog.Color.G.ToString("X2") + dialog.Color.B.ToString("X2");
    }
    protected override void Dispose(bool disposing)
    {
        if (disposing) { stop?.Cancel(); timer.Dispose(); tray.Visible = false; tray.Dispose(); stop?.Dispose(); }
        base.Dispose(disposing);
    }
    private sealed record DeviceChoice(string Id, string Name) { public override string ToString() => Name; }
}
