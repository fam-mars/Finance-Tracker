using System.Text.Json;
using FinancieelOverzicht.Api.Models;

namespace FinancieelOverzicht.Api.Services;

/// <summary>
/// Single-document store backed by one JSON file on disk.
///
/// Why not a database: this app has exactly one document, a handful of users
/// (one household), and a full-document sync model. A JSON file with atomic
/// replace (write temp + File.Move) plus rolling backups is simpler to run on
/// a VPS, trivially inspectable, and impossible to migrate wrongly.
///
/// Concurrency: a SemaphoreSlim serialises writes. Optimistic concurrency is
/// enforced with a revision number: PUT must carry the revision it was based
/// on (If-Match header); a mismatch returns 409 so the client can re-sync.
/// </summary>
public sealed class StateStore : IStateStore
{
    private readonly string _dataDir;
    private readonly string _statePath;
    private readonly string _seedPath;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly ILogger<StateStore> _log;

    private StateEnvelope _current = new();

    public StateStore(IConfiguration cfg, IHostEnvironment env, ILogger<StateStore> log)
    {
        _log = log;
        _dataDir = cfg["Storage:DataDirectory"] ?? Path.Combine(env.ContentRootPath, "data");
        _statePath = Path.Combine(_dataDir, "state.json");
        _seedPath = Path.Combine(env.ContentRootPath, "data", "seed.json");
        Directory.CreateDirectory(_dataDir);
        Load();
    }

    public StateEnvelope Current => _current;

    private void Load()
    {
        if (File.Exists(_statePath))
        {
            var envl = JsonSerializer.Deserialize<StateEnvelope>(File.ReadAllText(_statePath), Json.Options);
            if (envl is not null)
            {
                _current = envl;
                _log.LogInformation("Loaded state revision {Rev} from {Path}", envl.Revision, _statePath);
                return;
            }
            _log.LogWarning("state.json unreadable; falling back to seed");
        }

        var seed = File.Exists(_seedPath)
            ? JsonSerializer.Deserialize<FinancialState>(File.ReadAllText(_seedPath), Json.Options) ?? new FinancialState()
            : new FinancialState();

        _current = new StateEnvelope
        {
            Revision = 1,
            UpdatedAt = DateTimeOffset.UtcNow.ToString("O"),
            State = seed,
        };
        Persist(_current);
        _log.LogInformation("Initialised state from seed at revision 1");
    }

    /// <summary>
    /// Replace the full state. Returns the new envelope, or null when
    /// baseRevision no longer matches (caller should return 409).
    /// </summary>
    public async Task<StateEnvelope?> ReplaceAsync(FinancialState next, long baseRevision, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            if (baseRevision != _current.Revision) return null;

            var envl = new StateEnvelope
            {
                Revision = _current.Revision + 1,
                UpdatedAt = DateTimeOffset.UtcNow.ToString("O"),
                State = next,
            };
            Backup();
            Persist(envl);
            _current = envl;
            return envl;
        }
        finally
        {
            _gate.Release();
        }
    }

    private void Persist(StateEnvelope envl)
    {
        var tmp = _statePath + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(envl, Json.Options));
        File.Move(tmp, _statePath, overwrite: true);
    }

    /// <summary>Keep the last 30 revisions as timestamped backups.</summary>
    private void Backup()
    {
        if (!File.Exists(_statePath)) return;
        var backupDir = Path.Combine(_dataDir, "backups");
        Directory.CreateDirectory(backupDir);
        var name = $"state.{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss}.r{_current.Revision}.json";
        File.Copy(_statePath, Path.Combine(backupDir, name), overwrite: true);

        foreach (var old in Directory.GetFiles(backupDir, "state.*.json")
                     .OrderByDescending(f => f)
                     .Skip(30))
        {
            try { File.Delete(old); } catch { /* best effort */ }
        }
    }
}
