# Finance Tracker Deployment Guide

## Current Status

✅ **Frontend**: Ready for Vercel deployment with authentication and localStorage persistence
✅ **Backend**: .NET API with JSON file persistence (requires VPS deployment)

## Issues Fixed

1. **Data Persistence**: Added localStorage fallback so data persists when backend is unavailable
2. **Authentication**: PIN code 19011901 required to access the app (embedded in build)

---

## Vercel Deployment (Frontend)

### 1. Connect GitHub Repository to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Continue with GitHub"
3. Search for `fam-mars/Finance-Tracker` and select it
4. Click "Import"

### 2. Configure Build Settings

In the Vercel project settings:

- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### 3. Set Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables, add:

```
VITE_AUTH_MODE=code
VITE_AUTH_CODE=19011901
VITE_API_BASE_URL=https://your-backend-domain.com (when backend is deployed)
```

**Important**: Without these environment variables, the PIN requirement will not be enforced.

### 4. Deploy

Click "Deploy" to start the build and deployment. The frontend will be live with:
- ✅ PIN authentication (19011901)
- ✅ localStorage fallback for data persistence
- ✅ Responsive mobile UI with charts

---

## Backend Deployment (Optional - for persistent storage)

### Vercel Configuration (If deploying backend as serverless)

Vercel's serverless environment has ephemeral storage, so the JSON file won't persist between invocations. Instead:

**Option A**: Deploy to a traditional VPS with persistent disk (recommended)
- Frontend: Vercel
- Backend: Your VPS (with data/state.json persistence)

**Option B**: Use a managed database service
- Add MongoDB, PostgreSQL, or similar
- Modify backend to use database instead of JSON files

### Option A: VPS Deployment (Recommended)

1. Build the backend:
```bash
cd backend
dotnet publish -c Release
```

2. Deploy to your VPS and set environment variables:
```bash
export AUTH__APIKEY=your-secret-key
export Cors__AllowedOrigins__0=https://your-vercel-domain.com
dotnet FinancieelOverzicht.Api.dll
```

3. Set the Vercel environment variable to point to your backend:
```
VITE_API_BASE_URL=https://your-backend-domain.com
```

---

## Data Security

### Authentication

The PIN code (19011901) is embedded in the build at compile time. This prevents unauthorized access to:
- Income data
- Expense data
- Debt information
- Investment portfolio
- Financial calculations

### Data Storage

**Frontend (Browser)**:
- Cached in localStorage for fast loading
- Session auth token stored in sessionStorage
- Cleared when user closes the browser (or manually logs out)

**Backend (if deployed)**:
- State saved to `data/state.json` with atomic writes
- Automatic backup rotation (keeps last 30 revisions)
- Concurrency control via revision numbers (optimistic locking)

---

## Testing

### Test Locally

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173` and login with PIN: **19011901**

### Test Build

```bash
npm run build
npm run preview
```

Open `http://localhost:4173` and login with PIN: **19011901**

---

## Troubleshooting

### "Ongeldige code" (Invalid PIN)

1. Check that `VITE_AUTH_CODE=19011901` is set in Vercel environment variables
2. Rebuild the project after adding environment variables
3. Clear browser cache and refresh

### Data Not Persisting

1. Check browser's localStorage is not disabled
2. Open DevTools → Application → LocalStorage → Check `finance-tracker-state`
3. If backend is deployed, check API is accessible via `VITE_API_BASE_URL`

### Backend Not Reachable

1. Check `VITE_API_BASE_URL` is correct in Vercel environment variables
2. Test with `curl https://your-backend-domain.com/healthz`
3. Ensure CORS is configured on backend (frontend domain must be in allowed origins)

---

## Environment Variables Reference

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_AUTH_MODE` | `code` | Enable PIN-based authentication |
| `VITE_AUTH_CODE` | `19011901` | PIN code for access |
| `VITE_API_BASE_URL` | `https://...` | Backend API URL (optional) |
| `VITE_API_KEY` | (key) | Optional API key for backend |

---

## Next Steps

1. **Immediate**: Deploy to Vercel with `VITE_AUTH_CODE` environment variable
2. **Testing**: Verify PIN code works on Vercel preview
3. **Optional**: Deploy backend to VPS for persistent storage
4. **Security**: Change PIN code if needed (regenerate build with new code)
