---
title: "Attack surface is not a port list"
description: "A port tells you something is listening. It does not tell you what the system is for. How I decide what to attack, worked end to end on a fictional document portal — including the two candidates I threw away and why."
category: "Method"
tags: ["attack surface", "threat modeling", "web", "recon"]
featured: true
date: "2026-10-03"
---

There is a genre of pentest writeup that opens with an `nmap` paste and closes with a root shell, and
in between it is a list of things that were tried. It is a useful genre. It is also, on the
aggregate, close to noise: the specific machine has no future, and the reader cannot tell which of
the 200 commands mattered.

So this is not that. There is no box here. The target below is a specification I wrote for this
article, and it exists to make one point: **you cannot decide what to attack before you decide what
the thing is for.** Everything downstream — the recon, the vector, the priority — falls out of that
one decision.

## The question

Should enumeration come before or after you understand what the system does?

The honest answer is that the question is malformed, and that is the useful part. "Before or after"
only makes sense if enumeration is a phase you can point at. Once you stop treating it as a phase,
the real question becomes:

> Given what this system is for, **what is it exposing on purpose** — and which of those exposures
> is the owner relying on something nobody is actually checking?

If you can answer that, you never needed a scanner to tell you where to look. If you cannot, no
amount of scanning gets you there — it only hands you a longer list of things you cannot yet rank.

After reading this you should be able to take an unfamiliar system, write its inventory in the
shape of the table below, and reject candidates using a written criterion instead of a feeling.

## The target model

The target is `portal.acme.test`, a fictional B2B document portal. Partners upload monthly
statements; the portal parses them, stores them, and lets each tenant's staff read them back.

The job, decomposed honestly:

- **Actors.** An anonymous visitor. A partner uploader — a real, low-privilege account issued per
  company. A tenant staff member who reads documents. An internal backoffice operator.
- **Assets that matter.** Tenant documents (confidential), the tenant boundary itself (who can see
  whose data), and the importer's ability to write into storage without being noticed.
- **Components.** A TLS-terminating proxy that also serves static assets; an application server
  holding sessions and authorization; a file volume served directly by path; Postgres as the system
  of record; a background worker that ingests uploaded files; an SFTP drop the partners push into;
  and a converter binary the worker shells out to.

I am not going to give you a scan of this thing. I am going to give you the seven questions I ask
about each component, and the answer for each one here.

> **Plain terms**
> Think of a shared document warehouse. Companies drop boxes of paperwork into a mailroom, a clerk
> opens each box, copies the numbers into the system, and prints a clean copy for the company that
> sent it. The clerk works alone, at night, and never checks whether the box was really sent by the
> company it claims to come from. Everything in this article is about that clerk.

## The surface criteria

I score a component as attack surface if **any** of these holds. Not all — any. One is enough to
earn a row in the inventory.

| Criterion | The question it answers |
| --- | --- |
| **Reachable** | Can an actor whose credentials I hold send bytes to it, and have them interpreted? |
| **Translates** | Does it take input and turn it into something else — a query, a command, a path, a rendered document? |
| **Brokers trust** | Does something upstream trust its output without checking it? |
| **Holds authority** | Does it hold credentials, keys, or a privilege that other components assume it has? |

The third one is the one that carries the most weight, and it is the one that scan output never
tells you about. A component brokers trust when it stands between one party's data and another
party's assumption. The importer in this target brokers trust — the application trusts the database
the importer wrote to, without knowing the importer was handed that row by a partner.

**Reachability alone is not a filter, it is a precondition.** Plenty of things are reachable and
none of them matter. Which is why the criteria produce a set, not a ranking, and ranking happens
here:

> **Priority ≈ reachability × capability × blast radius ÷ cost of proving it**

The denominator is the part people skip. A vector that needs nine hours of blind boolean
extraction to prove you can read your *own* data is worse than a vector that takes twenty minutes
and reads someone else's. The formula is not sacred. Writing it down is.

> **Rejected**
> `edge` — the proxy's management interface on `8443`. Passes **Reachable**, and nothing else. It
> returns the same `403` for every path and every method, and answering "why" requires credentials
> nobody gave me. It is a lead. It stays in the notes and it does not get an hour.

## The inventory

The criteria, applied. Seven components, and the rubric is what earned each of them a row.

| Element | Purpose | Talks to | Trust boundary | Fails into |
| --- | --- | --- | --- | --- |
| `edge` | Terminates TLS, routes by path, serves static assets | Browser, `app`, `files` | Internet → internal network; the only intended edge | 502s, slow pages |
| `app` | Sessions, authorization, renders the UI, serves downloads | `edge`, `db`, queue, `files` | Logged-in user → other tenants' documents | 500s, wrong data shown |
| `files` | Serves generated documents by path, unauthenticated, straight off disk | `edge`, worker | **Anyone holding a path** — no application logic in front of it | 403/404, or a leaked document |
| `db` | System of record: tenants, documents, audit rows | `app`, `importer` | The app trusts rows the importer wrote | Data loss, cross-tenant data |
| `importer` | Reads partner uploads, maps columns, writes `db`, generates PDFs | `drop`, `db`, `files`, `converter` | **Partner-authored file content → values a privileged process persists** | Stuck jobs, silently bad rows |
| `drop` | Landing area partners push statements into, over SFTP | Partners, `importer` | External party → internal filesystem, with no app in between | Stale files, wrong company's file |
| `converter` | Turns stored rows into a PDF | `importer` | A string that came from user input becomes an argument to a process | Failed conversions, hung worker |

Two columns carry the whole table. **Trust boundary** names the assumption nobody is verifying.
**Fails into** tells you what the owner already hardened, which is where the gaps are: nobody writes
a retry loop around a PDF printer they expect to always work, and nobody validates the column names
in a CSV their partners have never misused.

Note what is *not* in the table. There is no `admin panel`, no `nginx/1.18.0`, no CVE. The version
number is not the surface. The question "does this thing let untrusted content become something more
powerful" is the surface, and the version is at best a hint about the answer.

## From element to vector

A vector answers five questions. Not four, not six — five, because four lets you skip the one that
does the work.

1. **Actor.** Who am I right now, with what credentials?
2. **Precondition.** What must already be true for this to work?
3. **Primitive.** What single capability does it hand me?
4. **Consequence.** What does that capability unlock next?
5. **Objective.** Does that move toward the goal, or just sideways?

If any answer is *unknown* instead of *yes*, you have a lead. Unknown is fine — plenty of good
vectors start as unknown. What is not fine is shipping a finding whose consequence you cannot
state, because that is how reports end up with a critical severity and nothing underneath it.

### Candidate A — the import pipeline

Follow the `Brokers trust` marker from the inventory. `importer` is the only component where a
low-privilege external party's input becomes a value that `app` later trusts.

> **Plain terms**
> The clerk takes the box, reads the labels on the columns, and files the numbers under those
> labels. Nobody gave the clerk a list of labels that are allowed. So if I put a new column in my
> box with a name the system happens to use for something else, the clerk files my number under
> that name too — and then the office uses it to find a cabinet in someone else's wing.

- **Actor** — partner uploader. A real credential, issued to me legitimately, for one tenant.
- **Precondition** — the importer maps CSV columns by header name, and the resulting row is
  persisted without allowlisting the keys.
- **Primitive** — write one attacker-chosen string into a column the application treats as a
  storage locator.
- **Consequence** — the download endpoint builds a path from that value. I control part of a path I
  was never meant to control.
- **Objective** — read a document belonging to a different tenant. That is the objective. Not
  "interesting", not "a finding": *unauthorized access to another tenant's data*, in one request.

### Candidate B — cross-tenant IDOR on the download endpoint

- **Actor** — tenant staff user. Precondition: a valid session in one tenant. Primitive: an
  incrementing document ID is returned instead of a tenant-scoped one.
- **Consequence, objective** — same as A. Read another tenant's document.

Same objective, cheaper primitive, but a strictly worse actor: it requires a staff account rather
than the uploader credential, and it depends on identifiers being guessable — which is an
*assumption* until I see the response. A's precondition is visible in the code path I already
care about; B's is a guess about someone else's design.

> **Rejected**
> `id` on `/api/documents/{id}` — killed on *cost of proving*. Sequential IDs may or may not be
> guessable, and "may or may not" is a **lead** under question 2, not a vector. It goes in the
> report as a recommendation to the team to confirm, and I keep my hour for Candidate A, whose
> precondition I can read rather than infer.

### Candidate C — injection in the tenant search box

- **Primitive** — if injectable, read/write through the app's own database role.
- **Killed on cost.** The parameter is bound, not concatenated, and the only observable signal is
  response timing at a magnitude indistinguishable from network jitter. Proving blind extraction
  here costs hours and yields data the search box already returns. Dead end, recorded.

Two candidates killed out of three, and the kills cost me nothing but reading. That is the entire
argument of this article: the criteria are not there to help you find more, they are there to let
you stop.

### The part that is genuinely uncomfortable

Candidate A only exists because I hold a partner credential. In an engagement where I am given
nothing, A does not exist, and B — the one I just deprioritized — becomes the most promising thing
on the board.

So the priority formula is not a property of the target. It is a property of the target **and the
credentials in my hands**. Write that down in your report too, because it is the difference between
"this is the worst issue" and "this is the worst issue *given the access I was granted*", and those
two sentences get remediated at very different speeds.

## Execution

Four commands, because four is what it took. Everything else I ran is omitted deliberately.

**Reach.** The sweep, to establish which components exist. Read it as a component list, not a
port list:

```bash
$ nmap -sV -Pn -p- --min-rate 3000 10.10.0.0/24 -oN sweep.txt
```

```text
Host: 10.10.0.11 (edge)     Ports: 80/open  443/tcp open  8443/tcp closed
Host: 10.10.0.12 (app)      Ports: 8080/tcp open
Host: 10.10.0.13 (db)       Ports: 5432/tcp open
Host: 10.10.0.21 (drop)     Ports: 22/tcp open
```

Four hosts. `8443` answered `403` on every method and every path I tried — per the rubric that is
**Reachable** and nothing else, so it gets a row in the notes and no more time. `app`, `db` and
`drop` are not directly usable without a foothold, so they are not targets yet, they are *context*.

**The purpose.** Two requests tell me what the importer is for, which is the whole article:

```bash
$ curl -s https://portal.acme.test/robots.txt; echo; \
  curl -s -o /dev/null -w 'upload endpoint -> %{http_code}\n' \
  -X POST https://portal.acme.test/partner/upload -F file=@statement.csv
```

```text
User-agent: *
Disallow: /docs/
Allow: /partner/upload
upload endpoint -> 200
```

`Disallow: /docs/` plus a path-served file volume from the inventory means the **path is the
authorization**. That single line is why Candidate A is worth twenty minutes and the proxy hardening
is worth none.

**The primitive.** Upload a statement whose header row carries a key the importer will keep and the
application will trust:

```csv
period,amount,storage_key
2026-09,18400.00,../../tenant-globex/2026-08-statement.pdf
```

```http
POST /partner/upload HTTP/2
Cookie: session=<partner credential>
Content-Type: multipart/form-data

file=statement.csv  ->  202 Accepted  {"job":"imp_8813","status":"queued"}
```

**The consequence.** Same request, authenticated as the same partner, one traversal up and across:

```http
GET /docs/download?key=../../tenant-globex/2026-08-statement.pdf HTTP/2
Cookie: session=<partner credential>
```

```http
HTTP/2 200
Content-Type: application/pdf
Content-Length: 218944

%PDF-1.7 ... Globex Industries — August 2026 statement ...
```

Different tenant. Readable, without ever touching a credential, an ID, or a session belonging to
anyone but my own.

**What I could not prove.** Whether the importer's persisted row can also be steered into
*writing* rather than reading, and whether `converter` is reachable with an argument I control
through the same field. Both need the worker to run a job that leaves evidence in
`db.audit`, and my access was read-only on the database side. Both are leads, and both are in the
report as leads.

## In plain terms

A company buys a service that accepts monthly paperwork from its suppliers. Suppliers drop boxes of
paperwork into a mailroom. A clerk opens each box, copies the numbers into the system, and prints a
clean copy that the company can read back online.

Now the three things that make this a problem, none of which are about the printer.

The clerk works from the labels on the box. Each column in the paperwork has a name, and the clerk
files each number under the name he finds. But nobody ever gave the clerk a list of names he is
allowed to use. He was told "put the period here, put the amount there" and he filled in the rest of
the form however it came. So if I put an extra column in my box with a name that the office happens
to use for something else, the clerk files my number under that name too. I did not break the form.
I filled it out the way the form was designed to be filled out.

The office, later, uses that name to decide which cabinet to open. The name is not checked against
my company, because by that point in the process, nobody knows it came from me — it came from the
clerk, and the clerk is trusted. The office does what the clerk told it. That is the whole bug: not
a broken lock, but a chain where each link hands its work to the next one without checking, and the
last link opens a drawer in someone else's wing.

And the reason this was findable at all is that the paperwork form is public. The site says so, in
its `robots.txt`, in the section it asks search engines not to look at: the finished documents.
Which told me the finished documents are served by guessing their location, and nothing checks who
is asking. A locked cabinet in a room you can walk into is not a locked cabinet.

Two other doors were in the same building and I left them alone. One of them needed a key I was not
given. One of them I could probably have opened, but only by spending hours to prove something that
would not have mattered, because it opened the same drawer using paperwork I already had.

The rule I take from this: before deciding what to attack, write down what the thing is *for*, and
then find the one component whose entire job is to hand work from one party's hands to another
party's trust. In every system I have looked at, that component exists, and it is almost never the
part with the interesting open ports.

## Carry-over

The part you can apply to something neither of us has seen.

1. **Write the purpose before the ports.** Two sentences: what the system is for, and what it does
   with the data. If you cannot write those two sentences, you are not ready to enumerate anything.
2. **Ask four questions per component.** Reachable, translates, brokers trust, holds authority. Any
   one of them earns a row. The third is where the real estate is.
3. **Log the trust boundary in writing.** A column that says "partner-authored content becomes a
   value a privileged process persists" is the entire finding, before you exploit anything. If you
   cannot fill that column in, you have not found the bug yet.
4. **State the ranking formula and then use the denominator.** Reachability, capability, blast
   radius, over cost of proving. The kills are as valuable as the hits.
5. **Write the credential context into the finding.** "Worst issue given the access I was granted"
   is a different sentence than "worst issue", and it is the one that gets fixed.
6. **Keep the dead ends.** A rejected candidate with a stated criterion is evidence that the
   remaining findings were chosen rather than stumbled into.

Where this does not reach: it does not help with targets where you get no time at all, and it is
slow at the start of an engagement by construction — the inventory is the expensive part. It also
tells you nothing about whether an exploit *works*, only about which exploit is worth writing. That
part is still just testing.