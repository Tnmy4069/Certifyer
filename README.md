# Certify — Certificate Issuance Platform

Production-oriented Next.js app for creating events, designing certificate templates, importing candidates via CSV, generating PNG/PDF certificates, and verifying them publicly.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- MongoDB + Mongoose
- Auth.js (credentials email/password for admin)
- Sharp + pdf-lib for rendering
- Local private storage adapter (swap later for Vercel Blob)

## Quick start

1. Copy env:

```bash
cp .env.example .env.local
```

2. Set `MONGODB_URI` and `AUTH_SECRET` in `.env.local`.

3. Install and seed:

```bash
npm install
npm run seed
npm run dev
```

4. Optional dedicated generation worker (recommended for large batches):

```bash
npm run worker
```

## Demo credentials

After seeding:

- Admin: `admin@certify.local` / `Admin123!`
- Event: TechFest 2026
- Public portal: `/public/techfest-2026`
- Demo candidate email: `tanmay@example.com`

Generate certificates from the admin Certificates page, then publish (seed already publishes TechFest).

## Key routes

| Route | Purpose |
| --- | --- |
| `/login` | Admin sign-in |
| `/admin` | Dashboard |
| `/admin/events/new` | Create event |
| `/admin/events/[id]/template` | Visual certificate editor |
| `/admin/events/[id]/candidates` | CSV import |
| `/admin/events/[id]/certificates` | Generate / manage certificates |
| `/public/[eventSlug]` | Candidate portal |
| `/verify/[certificateId]` | Public verification |

## Notes

- Candidate portal currently uses **email-only** lookup (requested). Access is rate-limited and uses short-lived tokens, but it does **not** prove email ownership. OTP/magic-link can replace the provider in `src/lib/candidate-access`.
- Generated files are stored under `./storage` and served via signed URLs.
- Rotate any MongoDB credentials that were shared in chat before production use.
