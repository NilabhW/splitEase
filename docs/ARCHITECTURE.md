# SplitEase architecture

## Components

```
┌──────────────────────┐   HTTPS, JSON, httpOnly cookie   ┌────────────────────────────┐      ┌───────────────┐
│ React SPA (Vercel)   │ ───────────────────────────────▶ │ Express API (Render)       │ ───▶ │ MongoDB Atlas │
│ pages, modals, tabs  │ ◀─────────────────────────────── │ routes → middleware →      │      │ users, groups │
│ AuthContext, Axios   │   { success, data | error }      │ controllers → services     │      │ expenses,     │
└──────────────────────┘                                  └────────────────────────────┘      │ settlements   │
                                                                                               └───────────────┘
```

### Backend (`backend/src`)

| Folder | Responsibility |
| --- | --- |
| `routes/` | URL → middleware chain → controller. `expenses.js` is mounted under `/groups/:groupId/expenses`. |
| `middleware/` | `auth` (verify JWT cookie, load user), `requireGroupMember` (valid id → 404, not a member → 403, attaches `req.group`), `validate` (Zod), `errorHandler` (one error format, no stack traces). |
| `controllers/` | Thin HTTP layer: read the request, call services or models, shape the response. |
| `services/` | Pure business logic with unit tests: `splitService`, `balanceService`, `simplifyDebts`. `expenseService` re-checks membership. `ledgerService` loads records and feeds the pure functions. |
| `models/` | Mongoose schemas with a last line of defence: splits must sum to the amount, and you can't settle with yourself. |

### Frontend (`frontend/src`)

| Folder | Responsibility |
| --- | --- |
| `api/` | One Axios instance (`withCredentials`) plus small functions per resource. |
| `context/AuthContext` | Current user, login/register/logout. A 401 interceptor clears the user, and the protected route redirects to `/login`, remembering where you were going. |
| `hooks/useAsync` | Loading, error and data state with `reload` for retry buttons. |
| `pages/` | Login, Register, Dashboard, GroupDetail (Expenses, Balances and Activity tabs), JoinGroup, NotFound. |
| `components/` | Modals (expense, settle up, create/join, confirm), tabs, empty/error states. |
| `utils/` | Rupee↔paise conversion and split "remaining" calculation (fixed-point, no floats). |

## Data model

All amounts are **integer paise**. Balances are **not stored**.

```js
User       { name, email (unique, lowercase), passwordHash (select: false) }
Group      { name, description, members: [User], createdBy: User, inviteCode (unique, 8 chars, crypto.randomBytes) }
Expense    { group, description, amount, paidBy: User, splitType: 'equal'|'exact'|'percentage',
             splits: [{ user, amount }], createdBy: User, date }
Settlement { group, from: User (payer), to: User (receiver), amount, note, createdBy: User }
```

Invariants:

- `sum(splits.amount) === amount`: computed by `splitService` and re-checked in a model `pre('validate')` hook.
- The payer and everyone in the split are group members (checked in `expenseService`, not only middleware).
- Settlement `from !== to`, both are members, and the caller is one of them.
- You can only leave a group when your computed net balance is 0. The last member leaving deletes the group.
- `computeBalances` logs an error if nets don't sum to 0. Tests assert this with mixed expenses and settlements.

## API

All routes are under `/api`. Responses are `{ success: true, data }` or `{ success: false, error: { code, message } }`.

| Method | Route | Who |
| --- | --- | --- |
| POST | /auth/register, /auth/login | Anyone (rate-limited to 10 per 15 min) |
| POST | /auth/logout · GET /auth/me | Logged in |
| GET / POST | /groups | Logged in (list includes your `netBalance` per group) |
| POST | /groups/join `{ inviteCode }` | Logged in (409 + `details.groupId` if already a member) |
| GET | /groups/:groupId | Member |
| DELETE | /groups/:groupId/leave | Member with zero balance (400 `BALANCE_NOT_ZERO` otherwise) |
| GET / POST | /groups/:groupId/expenses | Member (GET paginated `?page&limit`, newest first) |
| PUT / DELETE | /groups/:groupId/expenses/:id | Expense creator (403 otherwise) |
| GET | /groups/:groupId/balances | Member: `{ balances: [{ user, net }], plan: [{ from, to, amount }] }` |
| POST | /groups/:groupId/settlements | Member who is `from` or `to` |
| GET | /groups/:groupId/activity | Member: expenses and settlements merged, newest first |

Status codes: 400 validation, 401 not logged in, 403 not allowed, 404 missing or invalid id, 409 duplicate, 500 unexpected (generic message only).

## Core algorithms

### Splits (`services/splitService.js`)

- **Equal:** `base = floor(amount / n)`. The first `amount − base·n` people pay one extra paisa. ₹100 / 3 → 3334, 3333, 3333.
- **Exact:** client amounts must be non-negative integers summing to the total.
- **Percentage:** percentages are converted to basis points (33.33% → 3333), which must sum to 10000. Each share is `floor(amount·bp / 10000)`. Leftover paise go to the largest remainders, with ties broken by order (largest-remainder method), all in integer arithmetic.

### Balances (`services/balanceService.js`)

```
net[paidBy] += amount;  net[split.user] -= split.amount   // each expense
net[from]   += amount;  net[to]         -= amount         // each settlement
```

Positive means the group owes you. Negative means you owe.

### Simplification (`services/simplifyDebts.js`)

Repeatedly match the largest creditor with the largest debtor and transfer `min(credit, debt)`. Each step zeroes at least one person, so there are at most *n − 1* payments. Example: A→B ₹100 and B→C ₹100 becomes A→C ₹100.

## Security

- bcrypt (10 rounds). `passwordHash` is `select: false` and stripped from JSON.
- JWT in an httpOnly cookie, 7-day expiry. In production the cookie is `secure` and `sameSite: 'none'` because the frontend and API are on different domains.
- CORS allows only `CLIENT_URL` with credentials. `helmet` headers. Rate limiting on auth routes.
- Every request body is validated with Zod, and ObjectIds are validated before queries.
- Authorization: group membership is checked in middleware and re-checked in services. Creator-only edit and delete. Settlements must involve the caller.
- Secrets live only in environment variables. Only `.env.example` is committed.

## Testing

- **Backend:** service unit tests (split rounding, balances sum to zero, chain simplification, empty plan) plus API tests with supertest against an in-memory MongoDB (auth, authorization 401/403/404, validation, pagination, settlements, leave rule, seed).
- **Frontend:** Testing Library flows with a mocked API (auth redirects, invite link return, dashboard states, all three split types and the remaining counter, settle-up, activity, leave).
