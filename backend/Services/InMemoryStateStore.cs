using System.Text.Json;
using FinancieelOverzicht.Api.Models;

namespace FinancieelOverzicht.Api.Services;

/// <summary>
/// In-memory state store for development/testing without the backend deployment.
/// Loads seed.json on startup and keeps all revisions in memory.
/// When the app restarts, data reverts to the seed.
///
/// Enable with: FINANCE_TRACKER_USE_INMEMORY=true
/// </summary>
public sealed class InMemoryStateStore : IStateStore
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly ILogger<InMemoryStateStore> _log;
    private StateEnvelope _current = new();

    public InMemoryStateStore(IHostEnvironment env, ILogger<InMemoryStateStore> log)
    {
        _log = log;
        var seedPath = Path.Combine(env.ContentRootPath, "data", "seed.json");
        Load(seedPath);
    }

    public StateEnvelope Current => _current;

    private void Load(string seedPath)
    {
        var seed = File.Exists(seedPath)
            ? JsonSerializer.Deserialize<FinancialState>(File.ReadAllText(seedPath), Json.Options) ?? new FinancialState()
            : new FinancialState();

        _current = new StateEnvelope
        {
            Revision = 1,
            UpdatedAt = DateTimeOffset.UtcNow.ToString("O"),
            State = seed,
        };

        _log.LogInformation("InMemoryStateStore initialized with seed data at revision 1");
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
            _current = envl;
            _log.LogDebug("State updated to revision {Rev}", envl.Revision);
            return envl;
        }
        finally
        {
            _gate.Release();
        }
    }
}
