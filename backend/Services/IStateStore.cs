using FinancieelOverzicht.Api.Models;

namespace FinancieelOverzicht.Api.Services;

public interface IStateStore
{
    StateEnvelope Current { get; }
    Task<StateEnvelope?> ReplaceAsync(FinancialState next, long baseRevision, CancellationToken ct);
}
