# QCard Frontend

Next.js web application for QCard.

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Clone and setup:
```bash
git clone git@github.com:triphobic/qcard-web.git
cd qcard-web
npm install
cp .env.example .env.local
```

2. Update `.env.local` with your values:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
NEXT_PUBLIC_API_URL=http://localhost:10000
```

3. Start development server:
```bash
npm run dev
```

Visit http://localhost:3002

## Build for Production

```bash
npm run build
npm start
```

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_API_URL` - Backend API base URL
- `NEXT_PUBLIC_APP_URL` - Application URL (for social sharing, emails)

## Technology Stack

- **Framework**: Next.js 14
- **Styling**: Tailwind CSS
- **Database**: Supabase
- **Language**: TypeScript
- **UI**: React 18

## Folder Structure

```
src/
├── app/           # Next.js app directory (routes)
├── components/    # Reusable React components
├── hooks/         # Custom React hooks
├── lib/           # Utilities and helpers
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

## Testing

```bash
npm run test
```

## Deployment

### Production Ready ✅

The frontend is fully configured for production deployment. See [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) for detailed instructions.

**Quick Start for Production:**

#### Docker
```bash
docker build -t qcard-web:latest .
docker run -p 3002:3002 \
  -e NEXT_PUBLIC_SUPABASE_URL=your_url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
  -e NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  qcard-web:latest
```

#### Dokploy
```bash
# Upload code to Dokploy
# Set environment variables in Dokploy UI
# Deploy automatically handles Docker build and SSL
```

#### Vercel
```bash
# Push to GitHub
# Connect to Vercel
# Set environment variables in Vercel dashboard
```

**Includes:**
- ✅ Multi-stage optimized Docker build
- ✅ Health check endpoint
- ✅ Production-grade Dockerfile
- ✅ Security headers configured
- ✅ Static asset optimization
- ✅ Source maps for debugging
- ✅ Non-root user for security

## License

MIT
