# ShiftSwap 🔄

Same-day shift coverage made simple. Built for medical teams who need fast shift swaps.

## Features

- **📱 Mobile-first** - Staff post call-outs and claim shifts from their phones
- **🚨 Quick Call-Outs** - Post "I can't work" in seconds
- **✋ Easy Claims** - Available staff claim open shifts instantly
- **✅ Manager Approval** - One-tap approval for shift swaps
- **📲 Notifications** - Email/SMS alerts for new openings (SMS coming soon)

## Tech Stack

- **Frontend:** Next.js 15 + React 19 + TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Hosting:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/struv/shiftswap.git
   cd shiftswap
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a Supabase project and run the migration:
   - Go to Supabase Dashboard → SQL Editor
   - Run `supabase/migrations/001_initial_schema.sql`

4. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

5. Add your Supabase credentials to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` - From Supabase → Settings → API
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - From Supabase → Settings → API

6. Run the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
shiftswap/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── auth/             # Login, signup, callback
│   │   ├── dashboard/        # Main dashboard
│   │   ├── callouts/         # Call-out posting & claiming (TODO)
│   │   └── shifts/           # Shift management (TODO)
│   ├── components/           # Reusable React components
│   ├── lib/
│   │   └── supabase/         # Supabase client setup
│   └── types/                # TypeScript types
├── supabase/
│   └── migrations/           # SQL migrations
└── public/                   # Static assets
```

## Development Roadmap

### Night 1 ✅
- [x] Project setup (Next.js + Supabase)
- [x] Database schema & migrations
- [x] Authentication flow
- [x] Basic dashboard

### Night 2 (TODO)
- [ ] Call-out posting UI
- [ ] View open call-outs
- [ ] Email notifications

### Night 3 (TODO)
- [ ] Claim shift flow
- [ ] Manager approval UI

### Night 4 (TODO)
- [ ] Polish & testing
- [ ] Deploy to Vercel

### Week 2 (TODO)
- [ ] SMS notifications (Twilio)
- [ ] Mobile optimization
- [ ] User management for admins

## Contributing

This is a private project for struv's team. Contact William for access.

## License

Private - All rights reserved.
