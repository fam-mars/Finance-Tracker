# Vercel Deployment Setup

## Frontend Deployment to Vercel

The React frontend is ready to deploy to Vercel. Follow these steps:

### 1. Connect Repository to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Select "GitHub" and authorize Vercel
3. Search for and select the `fam-mars/Finance-Tracker` repository
4. Click "Import"

### 2. Configure Project Settings

1. **Framework Preset**: Select "Vite"
2. **Build Command**: `npm run build` (default)
3. **Output Directory**: `dist` (default)
4. **Environment Variables**: Add the following:
   - `VITE_API_URL`: Set to your backend URL (e.g., `https://api.yourdomainname.com`)

### 3. Configure Build Settings (frontend directory)

In the Vercel project settings:
1. Root Directory: `frontend`
2. Install Command: `npm install`
3. Build Command: `npm run build`
4. Output Directory: `dist`

### 4. Deploy

Click "Deploy" to start the build and deployment.

---

## Environment Variables

### Frontend (.env in frontend directory)

```env
VITE_API_URL=https://your-api-domain.com
```

The frontend will proxy `/api/*` requests to this URL.

### Production API Endpoint

Once your .NET backend is deployed to your VPS, set the API URL in Vercel environment variables:
- Key: `VITE_API_URL`
- Value: `https://your-vps-domain.com` (or IP with reverse proxy)

---

## Testing Without Backend

To test the frontend locally or on Vercel preview with in-memory mock data:

### Local Testing

```bash
cd frontend
npm install
npm run dev
```

The app will display seed data from `backend/data/seed.json`.

### Vercel Preview with Mock Backend

You can temporarily set `VITE_API_URL` to point to a local in-memory backend running with:
```bash
cd backend
FINANCE_TRACKER_USE_INMEMORY=true dotnet run
```

Then expose it via ngrok or similar for testing preview deployments.

---

## Rollback & Monitoring

- **Vercel Dashboard**: View deployments, logs, and analytics
- **Rollback**: Click "Promote to Production" on any previous deployment
- **Custom Domain**: Add your domain in Vercel project settings > Domains

---

## Troubleshooting

### CORS Errors
- Ensure backend's `Cors:AllowedOrigins` includes your Vercel domain
- Check backend logs: `journalctl -u finance-tracker-api -f` (if using systemd)

### API Requests Failing
- Verify `VITE_API_URL` is correct and accessible
- Check that the backend is running and has authentication enabled (if `AUTH__APIKEY` is set)
- Test the health endpoint: `curl https://your-api-domain.com/healthz`

### Build Failures
- Check Vercel build logs for errors
- Ensure `frontend/package.json` dependencies are correct
- Verify no TypeScript errors: `npm run tsc`

---

## First Deployment Checklist

- [ ] Repository connected to Vercel
- [ ] Root directory set to `frontend`
- [ ] Build settings configured
- [ ] Environment variables added
- [ ] Deployment successful
- [ ] Frontend loads and displays seed data
- [ ] API endpoint configured when backend is ready
