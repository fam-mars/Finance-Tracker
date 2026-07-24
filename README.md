# Finance Tracker

A comprehensive finance tracking application built with Node.js and Vercel.

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Vercel account (for deployment)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/fam-mars/Finance-Tracker.git
cd Finance-Tracker
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Development

Run the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

Check the health endpoint:
```bash
curl http://localhost:3000/api/health
```

### Testing

Run the test suite:
```bash
npm test
```

## Deployment

### Vercel

This project is configured for automatic deployment to Vercel.

1. Push to your branch
2. Vercel will automatically build and deploy the application
3. Access your deployed app at the provided Vercel URL

For manual deployment:
```bash
npm i -g vercel
vercel
```

## Project Structure

```
Finance-Tracker/
├── api/              # API endpoints and server logic
├── src/              # Application source code
├── .env.example      # Environment variables template
├── vercel.json       # Vercel configuration
└── package.json      # Project dependencies
```

## Environment Variables

See `.env.example` for required environment variables.

## License

MIT
