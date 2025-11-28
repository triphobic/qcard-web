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

Deploy to Vercel, Netlify, or Docker:

```bash
# Docker build
docker build -t qcard-web .
docker run -p 3002:3002 qcard-web
```

## License

MIT
