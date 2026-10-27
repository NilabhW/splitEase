# SplitEase

Split shared expenses with friends, roommates and trip-mates, see who owes whom, and settle up in the fewest payments possible.

**Live app:** https://split-ease-1iqb.vercel.app · **API:** https://split-ease-mu-flame.vercel.app/api/health · **Demo video:** https://youtu.be/fXUESQm2E-I

**Demo login:** `asha@demo.com` / `demo1234` (also `bob@demo.com`, `cara@demo.com`), already a member of a seeded "Goa Trip" group.

---

## Problem statement

Shared costs end up tracked in chat messages and memory. People forget who paid for what, uneven splits ("I only had the starter") are hard to do by hand, and settling up becomes a chain of confusing transfers: A pays B, B pays C, C pays A.

## Target users

College students, hostel and flat roommates, and friend groups on trips: small groups who share many costs over days or weeks and settle up at the end.

## Solution

SplitEase gives each group a shared ledger. Anyone in the group logs an expense with who paid and how it should be split. The app keeps every member's net balance up to date and computes a **simplified payment plan**: the smallest practical set of transfers that clears every balance. When someone pays, recording the settlement updates everyone's balance immediately.

## Key features (core workflows)

1. **Accounts:** register, log in, log out. JWT in an httpOnly cookie, bcrypt-hashed passwords.
2. **Groups:** create a group, invite people with an 8-character code or a shareable `/join/<code>` link. If a logged-out user opens the link, they come back to it after logging in.
3. **Expenses:** add, edit, or delete expenses split **equally**, by **exact amounts**, or by **percentage**. A live "remaining" counter disables Save until the split balances. Only the person who added an expense can edit or delete it.
4. **Balances and a simplified plan:** every member's net balance, plus suggested payments ("Cara pays Asha ₹500.00"). The dashboard shows your balance in each group.
5. **Settle up and activity:** record a payment ("Mark as paid" pre-fills it from the plan), with balances updating instantly. A merged activity timeline shows expenses and payments. You can only leave a group once your balance is zero.

Every data screen handles loading, empty, error (with retry) and success states. Buttons are disabled while a request is in flight, and destructive actions ask for confirmation.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, Vite, React Router, Axios, Tailwind CSS, react-hot-toast |
| Backend | Node.js 20, Express 5, Mongoose, Zod validation |
| Database | MongoDB Atlas |
| Auth | JWT in httpOnly cookie, bcrypt |
| Security | helmet, CORS allow-list, express-rate-limit on login/register |
| Testing | Vitest, supertest, mongodb-memory-server (backend); Vitest + Testing Library (frontend) |
| Hosting | Vercel (frontend + API as a serverless function), Atlas (DB) |

## Architecture

```
React SPA (Vercel) ──HTTPS + cookie──▶ Express REST API (Vercel) ──▶ MongoDB Atlas
                                           │
              routes → middleware (auth, requireGroupMember, Zod validate)
                     → controllers → services (pure logic) → Mongoose models
```

- **Money is integer paise everywhere** (₹125.50 = 12550), so floating-point errors never appear.
- **Balances are never stored.** They are computed from expenses and settlements on every read, so they cannot drift out of sync.
- **Split calculation** (`splitService`): equal splits hand leftover paise to the first people. Percentage splits work in basis points and use the largest-remainder method. The parts always sum exactly to the total, and the model checks this again before saving.
- **Debt simplification** (`simplifyDebts`): greedily match the largest debtor with the largest creditor. Each step clears at least one person, so *n* people need at most *n − 1* payments. A owes B ₹100 and B owes C ₹100 becomes one payment: A pays C ₹100.

Full details (data model, API table, authorization rules, error handling) are in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Local setup

Prerequisites: Node.js 20+, and MongoDB running locally (or an Atlas connection string).

```bash
git clone https://github.com/NilabhW/splitEase.git && cd splitEase

# API on http://localhost:5001
cd backend
cp .env.example .env        # then set JWT_SECRET to a long random string
npm install
npm run seed                # optional: demo users + "Goa Trip" group
npm run dev

# Web app on http://localhost:5173 (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

Tests: `npm test` in `backend/` (API and services, using an in-memory MongoDB) and in `frontend/` (components and flows).

## Environment variables

| Variable | Where | Example | Purpose |
| --- | --- | --- | --- |
| `MONGO_URI` | backend | `mongodb+srv://user:pass@cluster/splitease` | Database connection |
| `JWT_SECRET` | backend | long random string | Signs session tokens (required) |
| `CLIENT_URL` | backend | `https://split-ease-1iqb.vercel.app` | CORS allow-list origin |
| `NODE_ENV` | backend | `production` | Enables secure, cross-site cookies |
| `PORT` | backend | `5001` | API port (5000 clashes with AirPlay on macOS) |
| `VITE_API_URL` | frontend | `https://split-ease-mu-flame.vercel.app/api` | API base URL |

Only `.env.example` files are committed. Real `.env` files are git-ignored.

## Deployment

- **Database:** MongoDB Atlas free M0 cluster. Network access is 0.0.0.0/0 because Vercel functions have no fixed IPs.
- **API:** a second Vercel project with root `backend/` and Framework Preset "Other". `backend/api/index.js` wraps the Express app as a serverless function and caches the MongoDB connection across warm invocations; `backend/vercel.json` routes every path to it. Set `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` and `NODE_ENV=production`. Local development still uses `src/server.js`.
- **Frontend:** Vercel project with root `frontend/` and `VITE_API_URL` set. `vercel.json` rewrites all routes to `index.html` so deep links work on refresh.
- **Demo data:** run `npm run seed` in `backend/` with `MONGO_URI` pointing at Atlas.

Links: app https://split-ease-1iqb.vercel.app · API https://split-ease-mu-flame.vercel.app/api
