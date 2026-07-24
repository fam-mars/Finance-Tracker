using System.Text.Json;
using FinancieelOverzicht.Api.Models;
using FinancieelOverzicht.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<StateStore>();

// CORS: the frontend lives on Vercel, the API on the VPS. Origins come from config
// so preview deployments can be added without a rebuild.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? ["http://localhost:5173"];
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(allowedOrigins)
    .SetIsOriginAllowedToAllowWildcardSubdomains()
    .AllowAnyHeader()
    .WithMethods("GET", "PUT", "OPTIONS")
    .WithExposedHeaders("ETag")));

var app = builder.Build();
app.UseCors();

// --- Auth: single shared API key (household app, one secret). ------------------
// Set Auth:ApiKey via environment variable AUTH__APIKEY on the VPS.
// Empty key = auth disabled (local development only).
var apiKey = app.Configuration["Auth:ApiKey"] ?? "";
app.Use(async (ctx, next) =>
{
    var isApi = ctx.Request.Path.StartsWithSegments("/api");
    var isPreflight = HttpMethods.IsOptions(ctx.Request.Method);
    if (isApi && !isPreflight && apiKey.Length > 0)
    {
        var provided = ctx.Request.Headers["X-Api-Key"].ToString();
        if (!CryptographicEquals(provided, apiKey))
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await ctx.Response.WriteAsJsonAsync(new { error = "invalid_api_key" });
            return;
        }
    }
    await next();
});

// --- Health -------------------------------------------------------------------
app.MapGet("/healthz", (StateStore store) => Results.Ok(new
{
    status = "ok",
    revision = store.Current.Revision,
    updatedAt = store.Current.UpdatedAt,
}));

// --- Full state sync ----------------------------------------------------------

// GET /api/state → the whole document + revision. Supports If-None-Match so a
// polling client pays nothing when unchanged.
app.MapGet("/api/state", (HttpContext ctx, StateStore store) =>
{
    var envl = store.Current;
    var etag = $"\"{envl.Revision}\"";
    if (ctx.Request.Headers.IfNoneMatch.ToString() == etag)
        return Results.StatusCode(StatusCodes.Status304NotModified);

    ctx.Response.Headers.ETag = etag;
    return Results.Json(envl, Json.Options);
});

// PUT /api/state → replace the whole document. Requires If-Match: "<revision>".
// 409 = someone else saved first; the client must GET, merge/confirm, retry.
app.MapPut("/api/state", async (HttpContext ctx, StateStore store, CancellationToken ct) =>
{
    var ifMatch = ctx.Request.Headers.IfMatch.ToString().Trim('"');
    if (!long.TryParse(ifMatch, out var baseRevision))
        return Results.BadRequest(new { error = "missing_if_match", detail = "Send If-Match: \"<revision>\" from your last GET." });

    FinancialState? next;
    try
    {
        next = await JsonSerializer.DeserializeAsync<FinancialState>(ctx.Request.Body, Json.Options, ct);
    }
    catch (JsonException ex)
    {
        return Results.BadRequest(new { error = "invalid_json", detail = ex.Message });
    }
    if (next is null)
        return Results.BadRequest(new { error = "empty_body" });

    var problems = Validate(next);
    if (problems.Count > 0)
        return Results.UnprocessableEntity(new { error = "validation_failed", problems });

    var saved = await store.ReplaceAsync(next, baseRevision, ct);
    if (saved is null)
    {
        var current = store.Current;
        ctx.Response.Headers.ETag = $"\"{current.Revision}\"";
        return Results.Conflict(new
        {
            error = "revision_conflict",
            detail = "State changed since your last sync. GET /api/state and retry.",
            currentRevision = current.Revision,
        });
    }

    ctx.Response.Headers.ETag = $"\"{saved.Revision}\"";
    return Results.Json(saved, Json.Options);
});

app.Run();

// --- Helpers -------------------------------------------------------------------

static List<string> Validate(FinancialState s)
{
    var p = new List<string>();
    if (s.SchemaVersion != 1) p.Add($"schemaVersion must be 1, got {s.SchemaVersion}");

    void Ids(IEnumerable<string> ids, string what)
    {
        var list = ids.ToList();
        if (list.Any(string.IsNullOrWhiteSpace)) p.Add($"{what}: every item needs a non-empty id");
        if (list.Distinct().Count() != list.Count) p.Add($"{what}: duplicate ids");
    }

    Ids(s.Incomes.Select(x => x.Id), "incomes");
    Ids(s.FixedExpenses.Select(x => x.Id), "fixedExpenses");
    Ids(s.Portfolio.Holdings.Select(x => x.Id), "portfolio.holdings");
    Ids(s.Debts.Select(x => x.Id), "debts");
    Ids(s.SavingsGoals.Select(x => x.Id), "savingsGoals");

    if (s.Mortgage.PrincipalRemaining < 0) p.Add("mortgage.principalRemaining must be >= 0");
    if (s.Mortgage.InterestRatePerYear is < 0 or > 1) p.Add("mortgage.interestRatePerYear must be a fraction (0.038 = 3.8%)");
    if (s.Forecast.HorizonYears is < 0 or > 60) p.Add("forecast.horizonYears must be between 0 and 60");
    if (s.Forecast.ExpectedReturnPerYear is < -1 or > 1) p.Add("forecast.expectedReturnPerYear must be a fraction");

    foreach (var e in s.FixedExpenses.Where(e => e.PayDay is < 1 or > 31))
        p.Add($"fixedExpenses[{e.Id}].payDay must be 1-31 or null");

    var validMonths = new[] { "jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec" };
    foreach (var v in s.MonthOverview.VariableExpenses)
        foreach (var k in v.Actuals.Keys.Where(k => !validMonths.Contains(k)))
            p.Add($"monthOverview.variableExpenses[{v.Id}].actuals has unknown month key '{k}'");

    return p;
}

static bool CryptographicEquals(string a, string b)
{
    var ba = System.Text.Encoding.UTF8.GetBytes(a);
    var bb = System.Text.Encoding.UTF8.GetBytes(b);
    return ba.Length == bb.Length && System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(ba, bb);
}
