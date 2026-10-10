using System.Text.Json;
using System.Text.RegularExpressions;

namespace NoobatWork.iPadMixer;

public sealed record MixerItem(string Key, string Name, bool Visible, string Color);
public sealed record MixerProfile(string Name, string Layout, List<MixerItem> Items);

internal sealed class ProfileStore
{
    private readonly object gate = new();
    private readonly string path;
    private Dictionary<string, MixerProfile> profiles = new();
    public long Revision { get; private set; }
    public ProfileStore(string directory)
    {
        Directory.CreateDirectory(directory);
        path = Path.Combine(directory, "profiles.json");
        if (!File.Exists(path)) return;
        try
        {
            var loaded = JsonSerializer.Deserialize<Dictionary<string, MixerProfile>>(File.ReadAllText(path))!;
            foreach (var entry in loaded) Validate(entry.Key, entry.Value);
            profiles = loaded;
        }
        catch (Exception e) { Console.WriteLine("Profile konnten nicht geladen werden: " + e.Message); }
    }
    public MixerProfile Get(string id)
    {
        lock (gate)
        {
            var p = profiles.GetValueOrDefault(id) ?? profiles.GetValueOrDefault("default") ?? new("Standard", "auto", new());
            return p with { Items = p.Items.ToList() };
        }
    }
    public string[] Keys() { lock (gate) return profiles.Keys.ToArray(); }
    public static void Validate(string id, MixerProfile profile)
    {
        if (!Regex.IsMatch(id, @"\A[a-zA-Z0-9_-]{1,64}\z") || profile.Name.Length is < 1 or > 80 ||
            profile.Layout is not ("auto" or "split" or "full") || profile.Items.Count > 256)
            throw new ArgumentException("Ungültiges Profil");
        var keys = new HashSet<string>();
        foreach (var item in profile.Items)
            if (!Regex.IsMatch(item.Key, @"\A(channel:(Strip|Bus)\[[0-7]\]|app:[a-z0-9_.-]{1,116}\.exe)\z") ||
                item.Name.Length > 80 || !Regex.IsMatch(item.Color, @"\A#[0-9a-fA-F]{6}\z") || !keys.Add(item.Key))
                throw new ArgumentException("Ungültiger oder doppelter Kanal: " + item.Key);
    }
    public void Save(string id, MixerProfile profile)
    {
        Validate(id, profile);
        lock (gate)
        {
            var next = new Dictionary<string, MixerProfile>(profiles) { [id] = profile with { Items = profile.Items.ToList() } };
            File.WriteAllText(path + ".tmp", JsonSerializer.Serialize(next, new JsonSerializerOptions { WriteIndented = true }));
            File.Move(path + ".tmp", path, true);
            profiles = next;
            Revision++;
        }
        Console.WriteLine("Profil gespeichert: " + profile.Name);
    }
    public (long revision, MixerProfile profile) Read(string id) { lock (gate) return (Revision, Get(id)); }
}
