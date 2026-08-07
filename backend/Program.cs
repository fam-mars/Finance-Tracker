using System.Text.Json;
using FinancieelOverzicht.Api.Domain;
using FinancieelOverzicht.Api.Models;
using FinancieelOverzicht.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Use in-memory mock storage if FINANCE_TRACKER_USE_INMEMORY=true (dev/testing without backend deployment)
var useInMemory = builder.Configuration.GetValue<bool>("UseInMemory") ||
                  Environment.GetEnvironmentVariable("FINANCE_TRACKER_USE_INMEMORY")?.ToLower() == "true";

if (useInMemory)
{
    builder.Services.AddSingleton<IStateStore, InMemoryStateStore>();
}
else
{
    builder.Services.AddSingleton<IStateStore, StateStore>();
}

// CORS: the frontend lives on Vercel, the API on the VPS. Origins come from config
// so preview deployments can be added without a rebuild.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? ["http://localhost:5173"];
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(allowedOrigins)
    .SetIsOriginAllowedToAllowWildcardSubdomains()
    .AllowAnyHeader()
    .WithMethods("GET", "PUT", "POST", "OPTIONS")
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
app.MapGet("/healthz", (IStateStore store) => Results.Ok(new
{
    status = "ok",
    revision = store.Current.Revision,
    updatedAt = store.Current.UpdatedAt,
    storageMode = useInMemory ? "in-memory (mock)" : "persistent",
}));

// --- Full state sync ----------------------------------------------------------

// GET /api/state → the whole document + revision. Supports If-None-Match so a
// polling client pays nothing when unchanged.
app.MapGet("/api/state", (HttpContext ctx, IStateStore store) =>
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
app.MapPut("/api/state", async (HttpContext ctx, IStateStore store, CancellationToken ct) =>
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

    var problems = Validation.Validate(next);
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

// --- Domeinlogica op de server -------------------------------------------------
// De frontend werkt lokaal door zolang deze API niet uitgerold is; zodra
// VITE_API_BASE_URL gezet is haalt hij alle afgeleide cijfers hier vandaan.

// POST /api/derive → alle afgeleide cijfers voor het meegestuurde document.
// Bewust stateless (het document zit in de body): werkt ook wanneer de client
// nog localStorage als bron van waarheid gebruikt.
app.MapPost("/api/derive", async (HttpContext ctx, CancellationToken ct) =>
{
    FinancialState? s;
    try
    {
        s = await JsonSerializer.DeserializeAsync<FinancialState>(ctx.Request.Body, Json.Options, ct);
    }
    catch (JsonException ex)
    {
        return Results.BadRequest(new { error = "invalid_json", detail = ex.Message });
    }
    if (s is null) return Results.BadRequest(new { error = "empty_body" });
    return Results.Json(Calc.Derive(s), Json.Options);
});

// POST /api/validate → dezelfde controles als bij PUT, zonder op te slaan.
app.MapPost("/api/validate", async (HttpContext ctx, CancellationToken ct) =>
{
    FinancialState? s;
    try
    {
        s = await JsonSerializer.DeserializeAsync<FinancialState>(ctx.Request.Body, Json.Options, ct);
    }
    catch (JsonException ex)
    {
        return Results.BadRequest(new { error = "invalid_json", detail = ex.Message });
    }
    if (s is null) return Results.BadRequest(new { error = "empty_body" });
    return Results.Json(new { problems = Validation.Validate(s) }, Json.Options);
});

// Losse rekenendpoints voor de interactieve wat-als-berekeningen.
app.MapPost("/api/calc/forecast-scenario", (ForecastScenarioRequest r) =>
    Results.Json(new
    {
        endValue = Calc.ForecastScenario(r.StartValue, r.MonthlyContribution, r.ReturnPerYear, r.Years),
    }, Json.Options));

app.MapPost("/api/calc/months-to-target", (MonthsToTargetRequest r) =>
    Results.Json(new
    {
        months = Calc.MonthsToReachTarget(r.Start, r.MonthlyContribution, r.ReturnPerYear, r.Target),
    }, Json.Options));

app.MapPost("/api/calc/annuity", (AnnuityRequest r) =>
    Results.Json(new
    {
        payment = Calc.AnnuityPayment(r.Principal, r.RatePerYear, r.Years),
    }, Json.Options));

app.MapPost("/api/calc/amortization", (MortgageInputs m) =>
    Results.Json(new
    {
        summary = Calc.MortgageSummary(m),
        perYear = Calc.MortgagePerYear(m),
        schedule = Calc.AmortizationSchedule(m),
    }, Json.Options));

app.MapPost("/api/calc/repay-vs-invest", (RepayVsInvestRequest r) =>
    Results.Json(Calc.RepayVsInvest(r.Mortgage, r.ExtraPerMonth, r.ReturnPerYear), Json.Options));

app.MapPost("/api/calc/box3", (Box3Request r) =>
    Results.Json(Calc.Box3Estimate(r.State, r.Partners), Json.Options));

app.MapPost("/api/calc/debt-strategy", (DebtStrategyRequest r) =>
    Results.Json(Calc.DebtStrategy(r.Debts, r.ExtraPerMonth, r.Strategy), Json.Options));

app.MapPost("/api/calc/debt-repay-vs-invest", (DebtRepayVsInvestRequest r) =>
    Results.Json(Calc.DebtRepayVsInvest(r.Debt, r.ExtraPerMonth, r.ReturnPerYear), Json.Options));

app.Run();

// --- Helpers -------------------------------------------------------------------

static bool CryptographicEquals(string a, string b)
{
    var ba = System.Text.Encoding.UTF8.GetBytes(a);
    var bb = System.Text.Encoding.UTF8.GetBytes(b);
    return ba.Length == bb.Length && System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(ba, bb);
}
