---
title: "WalletDemo: A Fintech Wallet Built to Be Attacked by Its Own Author"
description: "A mobile wallet (balance, movements, transfers) in React Native with a Node API, built story by story so that each feature arrives with the attack it has to survive. In progress: story 1 of 15 shipped, story 2 server-side done."
category: "Mobile AppSec"
team: "Purple Team"
tags: ["React Native", "TypeScript", "Express", "SQLite", "argon2id", "OWASP MASVS", "OWASP API Top 10"]
featured: false
date: "2026-11-19"
timeline: "In progress (2026 - Present)"
githubUrl: ""
liveUrl: ""
---

> **Status: in progress.** Story #1 (see the balance fetched from the backend) is finished, tested, and
> verified on a physical Android phone. Story #2 (sign-up) has its server side done; the mobile screen
> is not started. Stories #3–#15 —login, transfers, biometrics, pinning, root detection— exist only as a
> backlog. This page documents the judgment the app is being built on and the two stories that exist,
> not a finished wallet.

## The problem

The question this project exists to answer:

> How do I learn mobile development from scratch in a way that leaves me able to *attack* what I
> build —IDOR, negative amounts, race conditions, token theft, a hooked APK— instead of learning the
> framework first and bolting security on later?

A wallet is the right target because its failures are unambiguous: money that appears, disappears, or
moves from an account that isn't yours. Every feature in the backlog is paired with the attack class it
invites (OWASP MASVS on the phone, OWASP API Top 10 on the server).

What it does **not** do: it is not a real payment product. There is no PSP, no card data, no KYC, no
multi-currency (ARS only), no multi-tenant, and the UI is Spanish-only. Those are written down as
decisions in the backlog, not left implicit.

## The context

- **Client:** React Native 0.78 (CLI, not Expo) + React 19 + TypeScript, tested with Jest and
  `@testing-library/react-native`. Developed against a physical Android phone over USB.
- **Server:** Node + Express + TypeScript, SQLite via `better-sqlite3`, tested with `supertest`.
- **Network in development:** the app calls `http://localhost:3000`, and `adb reverse` forwards the
  phone's port to the laptop. Plain HTTP is accepted debt until story #11 (TLS + pinning).
- **Operator:** one person, working in pairing sessions with a strict red→green TDD cycle; every
  story is refined into acceptance criteria and a test list before any code is written.
- **What it replaces:** the usual "tutorial app" where security is a final chapter. Here the security
  topic is a column of the backlog, decided before the feature.

> **Plain terms**
> It's a pretend digital wallet on a phone, talking to a small server. Each new feature comes with the
> question "how would someone steal money through this?", and the answer is built in the same step as
> the feature, not afterwards.

## The constraints

| Kind | Constraint |
|------|------------|
| Hard | Testing happens on a physical Android device, not an emulator. Anything emulator-only (like the `10.0.2.2` host alias) is out. |
| Budget | One person learning the stack as they go. Work is sliced into 15 stories of increasing difficulty, each small enough to finish and demo. |
| Surface | Everything the server receives comes from a client that can be modified. The server treats every request body as hostile, including requests that never came from the app. |
| Non-goal | Production realism: no PSP, no cards, no multiple currencies, no migrations. I accept that SQLite and a schema built with `CREATE TABLE IF NOT EXISTS` won't scale, and say so. |

## The components

| Component | Responsibility | Depends on | Fails into |
|-----------|----------------|------------|------------|
| Balance screen | Shows the balance in three states: loading, success, error with retry | API, `formatMoney`, runtime response check | A visible error with a "Retry" button, never an empty or zero balance |
| `formatMoney` | Formats integer cents as ARS (`$ 1.234,56`) by hand | — | Wrong formatting of negatives (known, deferred to #4) |
| `createApp(db)` | Builds the Express app without opening a port, with the DB injected | Express, `Db` | Tests that can't run in isolation (that's what the factory prevents) |
| `POST /api/users` | Validates, hashes, inserts; answers 201 / 400 / 409 | `validateRegistration`, argon2, SQLite | 400 with per-field errors; 409 `email_taken`; 500 for anything else |
| `users` table | One account per normalized email, only valid roles | SQLite `UNIQUE` + `CHECK` | The INSERT fails, so the bad state never gets stored |

## From requirement to design

The clash: the stated goal is to *learn* React Native from zero, which pushes toward the simplest
thing that works, while a wallet punishes anything simple that is also wrong (a float balance, a
check-then-insert, a role read from the body). The rule that resolved it: **the server is the only
authority, and every shortcut is allowed only if it is written down as debt with the story that pays it
back.**

> **Plain terms**
> I keep the app simple on purpose because I'm learning, but I don't let "simple" mean "trusting". The
> phone checks input to be helpful; the server checks it to be safe. Every corner I cut is written down
> with the date I'll come back for it.

Rejected along the way, each with the constraint that killed it:

> **Rejected**
> Money as `number` with decimals — fails on *surface/correctness*: `0.1 + 0.2 !== 0.3`, and rounding
> errors accumulate. Balances are integer cents.

> **Rejected**
> `SELECT` to check for an existing email, then `INSERT` — fails on *surface*: two concurrent sign-ups
> both pass the check (TOCTOU). The `UNIQUE` constraint is atomic; its violation becomes a 409.

> **Rejected**
> bcrypt — it silently truncates input at 72 bytes, and the password limit is 128. argon2id is OWASP's
> first choice.

> **Rejected**
> An in-memory user store — fails on *budget*: the dev server restarts on every save and loses
> accounts, and stories #4/#5 need real transactions anyway. SQLite gives real SQL with no server to
> install.

> **Rejected**
> `10.0.2.2` as the backend address — fails on *hard*: it only exists inside the Android emulator.
> Replaced by `localhost` + `adb reverse`.

> **Rejected**
> npm workspaces to share validation rules between app and server — breaks Metro and native
> autolinking. The rules are duplicated instead, and that duplication is listed as debt.

> **Rejected**
> `Intl.NumberFormat` for currency — Hermes' `Intl` behaves differently across Android builds. The
> formatter is written by hand.

## Implementation

The decision that carries the most weight is in the schema: the database itself refuses states the
code should never produce, so a bug in the route can't turn into a stored privilege.

```sql
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('usuario', 'admin'))
)
```

The sign-up route reads an allowlist from the body —only `email` and `password`— and the role is fixed
by the server. A `role: "admin"` in the request is ignored (mass assignment). Duplicates are handled
by the constraint, not by a prior lookup:

```typescript
const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

try {
  const result = db
    .prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'usuario')")
    .run(email, passwordHash);
  res.status(201).json({ id: Number(result.lastInsertRowid), email });
} catch (err) {
  if (isUniqueViolation(err)) {
    res.status(409).json({ error: 'email_taken' });
    return;
  }
  throw err;
}
```

Validation types the body as `unknown`, because it comes from the network: a number or an object where
a string was expected has to fail as cleanly as a malformed email. Passwords are 12–128 characters with
no composition rules (NIST SP 800-63B), and they are never trimmed. On the client, the balance response
is checked at runtime (integer cents, currency `ARS`, `res.ok`) before it's rendered, because a typed
`fetch` is a promise the server never signed.

Where it stands: story #1 has 14 test-list items, all green, including three added by code review
(HTTP 500, non-integer amount, wrong currency). It was also checked by hand on the phone: server up,
server down, server back + retry. The server side of story #2 passes 19 tests. Its mobile screen,
login, sessions, and everything that actually moves money do not exist yet.

## In plain terms

Someone wants to learn how to build phone apps and, at the same time, how to break them. Instead of
building a pretty app first and worrying about thieves at the end, they build a pretend wallet one small
piece at a time, and each piece comes with the specific trick a thief would try against it.

So far, the app can show a balance and the server can create accounts that resist the obvious tricks:
signing up twice at the same time, sneaking in as an administrator, sending garbage. The parts where
real money moves are still ahead. Being honest about that gap is part of the method.

## What I'd do differently

**Carry-over.** When you're learning a framework, pair every feature with the attack it invites
*before* you write it, and put the defense in the layer that can't be bypassed: the server, and if
possible, the database constraint. Validation on the client is UX, not security.

**Limits.** Today this proves design habits on two stories, not a secure wallet. There is no
authentication yet: anyone who calls `GET /api/balance` sees the demo balance. Traffic is plain HTTP.
The `email_taken` response lets anyone enumerate accounts (scheduled for #9). The 12-character minimum
is below NIST's 15 for a single-factor password. Nothing has been attacked by anyone but its author. It
has only been run on one Android device, and nothing on iOS.

If I started again, I'd remove the fixed demo balance from the walking skeleton. Shipping an
unauthenticated money endpoint as step one made the skeleton fast, but it also normalized "anyone can
read this" until story #3 adds login. A hard-coded balance behind a stub auth check would have cost an hour and
kept the right habit from the first commit.
