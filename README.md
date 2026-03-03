# SACCOFlow

Phase 1 scaffold for SACCO digitization using Next.js + Bun + Prisma + SQLite + Better Auth.

## Phase 1 Scope

- Next.js App Router structure with public and protected dashboard routes
- Prisma + SQLite data model for SACCO core entities
- Better Auth wired with Prisma adapter
- RBAC helpers for protected pages and write operations
- API/service/validator boundaries scaffolded for Phase 2 feature work

## Stack

- Runtime/package manager: Bun
- Framework: Next.js (App Router)
- ORM: Prisma
- Database: SQLite
- Auth: Better Auth (Prisma adapter)

## Project Structure

```text
app/
  (public)/
  (dashboard)/
  api/
src/
  server/
    auth/
    db/
    services/
    validators/
  ui/
prisma/
scripts/
```

## Setup

1. Install dependencies

```bash
bun install
```

2. Copy environment file

```bash
cp .env.example .env
```

3. Generate Better Auth Prisma schema additions

```bash
bun run auth:generate
```

4. Run migrations

```bash
bun run db:migrate
```

5. Start development server

```bash
bun run dev
```

## Useful Commands

```bash
bun run lint
bun run test
bun run db:generate
bun run db:deploy
bun run db:baseline
bun run db:reset
bun run db:studio
bun run admin:create-super -- --email superadmin@example.com --password "StrongPassword123!"
bun run phase1:check
```

## Notes

- The Prisma schema includes SACCO and Better Auth models, with a committed baseline migration in `prisma/migrations`.
- RBAC is enforced in `src/server/auth/rbac.ts` and used by API write routes.
- Password-reset links are logged to the server console in development via `emailAndPassword.sendResetPassword`.
- If your local DB was created before migrations, run `bun run db:baseline` once to mark the baseline migration as applied.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
