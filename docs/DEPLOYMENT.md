# Deployment

## 1. Backend on the VPS

### Option A — systemd (no Docker)

```bash
# on the VPS (Ubuntu example, .NET 8 runtime installed)
sudo mkdir -p /opt/fo-api /var/lib/fo-api
# from your machine / CI:
dotnet publish backend -c Release -o out
rsync -a out/ user@vps:/opt/fo-api/
```

`/etc/systemd/system/fo-api.service`:

```ini
[Unit]
Description=Financieel Overzicht API
After=network.target

[Service]
WorkingDirectory=/opt/fo-api
ExecStart=/usr/bin/dotnet /opt/fo-api/FinancieelOverzicht.Api.dll
Restart=always
User=www-data
Environment=ASPNETCORE_URLS=http://127.0.0.1:5080
Environment=Storage__DataDirectory=/var/lib/fo-api
Environment=AUTH__APIKEY=<generate: openssl rand -hex 32>
Environment=Cors__AllowedOrigins__0=https://<jouw-app>.vercel.app
Environment=Cors__AllowedOrigins__1=https://*.vercel.app

[Install]
WantedBy=multi-user.target
```

```bash
sudo chown -R www-data:www-data /var/lib/fo-api
sudo systemctl enable --now fo-api
curl http://127.0.0.1:5080/healthz
```

### Option B — Docker

```bash
docker build -t fo-api ./backend
docker run -d --name fo-api --restart unless-stopped \
  -p 127.0.0.1:5080:5080 \
  -v fo-data:/data \
  -e AUTH__APIKEY=<key> \
  -e Cors__AllowedOrigins__0=https://<jouw-app>.vercel.app \
  fo-api
```

### nginx + HTTPS in front (both options)

```nginx
server {
    server_name api.jouwdomein.nl;
    location / {
        proxy_pass http://127.0.0.1:5080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then `sudo certbot --nginx -d api.jouwdomein.nl`. The API must be HTTPS —
Vercel serves the SPA over HTTPS and browsers block mixed content.

### Data & backups

- Live document: `<DataDirectory>/state.json`
- Last 30 revisions: `<DataDirectory>/backups/state.<timestamp>.r<rev>.json`
- Include the data directory in your normal VPS backup. Restore = stop the
  service, copy a backup over `state.json`, start.

## 2. Frontend on Vercel

1. Push the repo; import the project in Vercel with **Root Directory = `frontend`**
   (framework auto-detects Vite; `vercel.json` adds the SPA rewrite).
2. Environment variables (Production + Preview):
   - `VITE_API_BASE_URL=https://api.jouwdomein.nl`
   - `VITE_API_KEY=<same key as AUTH__APIKEY>`
3. Deploy. Preview deployments work because the backend CORS list includes
   `https://*.vercel.app`.

> Note: `VITE_API_KEY` is baked into the client bundle, so anyone with the
> app URL and DevTools can read it. That's acceptable for a private household
> app whose URL isn't shared; if you want it stronger, see AGENT-TASKS T7
> (move auth to a Vercel serverless proxy or basic-auth the whole site).

## 3. Local development

```bash
cd backend && dotnet run          # :5080, auth disabled (empty key), seeds itself
cd frontend && npm run dev        # :5173, Vite proxies /api → :5080
```

## 4. Smoke test after deploy

```bash
curl -s https://api.jouwdomein.nl/healthz
curl -s -H "X-Api-Key: $KEY" https://api.jouwdomein.nl/api/state | head -c 300
# expect the seeded document and ETag; then open the Vercel URL on a phone
```
