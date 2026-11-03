---
title: "Privilege Escalation Arsenal"
description: "A privilege-escalation workbench for Linux and Windows built to rank findings instead of listing them: seventeen documented techniques, fifteen enumeration scripts, and a crossing engine that reports only where something I can influence meets something that runs above me."
category: "Pentesting"
team: "Red Team"
tags: ["Python", "Bash", "PowerShell", "C", "Linux", "Windows", "Metasploit"]
featured: true
date: "2024-01-01"
timeline: "Ongoing (2024 - Present)"
githubUrl: "https://codeberg.org/santiagosj/privesc-arsenal"
---

Drop `linpeas.sh` on a compromised host, wait for the colours, and treat whatever renders red as
the answer. It works often enough that nobody stops, and it fails in one way: two long lists —
things that run above me, things I can write — and no vector, because the line that matters is not
a line. It is where two lines cross.

The full argument is the article [`Linux privilege escalation: the questions, not the
commands`](/posts/linux-privesc-intersection), written in this same portfolio. This repository is
the same thesis built in the other direction: enumeration by category produces two lists, escalation
lives where the two axes meet, and the technique notes, the enumeration scripts and the decision
tree all fall out of that one idea.

## The problem

The question the project exists to answer: **given the identity I actually hold, what can I
influence that something more privileged will read or execute later — and which of those crossings
can I prove in minutes rather than hours?**

That is a judgment question, not a collection task, and it is the one a scanner cannot answer.
`linpeas` reports that a file is group-writable; it cannot tell you whether anything privileged
will ever read it, because that answer lives in a crontab, a unit file and an init script that a
person has to read *together*. So the project does two things and refuses a third: it documents
each technique so the mechanism is understood, and it crosses the axes so the surviving candidates
are ranked. What it does **not** do is exploit anything.

Scope, written down before it widened on its own:

- **It does not weaponise.** The crossing engine reports where to spend the next ten minutes; it
  never runs the payload. Detecting a writable config that root sources is a finding. Writing to it
  is an incident, and the tool does not take that step for you.
- **It is not a coverage-complete replacement for LinPEAS/WinPEAS.** Those tools collect broadly and
  well. This one collects narrowly and ranks, on purpose.
- **It does not decide.** Every vector carries the operator's five questions and a priority, never a
  verdict.

## The context

A tool is only reasonable relative to where it runs. This one runs in the least comfortable place
in an engagement: minutes after a foothold, on a host nobody has described to me.

- **Machine.** A Linux host reached at low privilege, for the crossing engine and the ten Linux
  checks — `bash` and coreutils assumed, nothing else. A Windows host for the five PowerShell
  enumeration scripts. No package manager, no network egress, no interpreter beyond the shell
  already on the box.
- **Credentials and privileges.** Exactly what I landed with: a normal account, no root, no cached
  `sudo`. The context script probes `sudo -n -l` and never prompts, because an interactive password
  request is a hang in a non-interactive session. Each script reads the system; none of them
  installs, compiles or edits anything on the target.
- **Operator.** A person with a terminal, against the clock — in this case OSCP preparation, where
  the budget is minutes per host and the cost of chasing the wrong line is the whole exam.
- **What existed before.** `linpeas.sh`, `WinPEAS`, a notes file, and a habit. The notes file was
  the honest part: it was where the judgment lived, and it was the part that never transferred to
  the next machine.

> **Plain terms**
> You have broken into a building you are not supposed to be in, and you have ten minutes before
> someone notices. A map of every lock in the building is not useful — there are hundreds, and they
> all look alike. What is useful is the one place where a door you *can* open leads to a floor you
> *cannot*, and the map never shows that, because it draws doors one at a time instead of drawing
> which doors touch which. This project is the note that says: here are the two doors that touch.

## The constraints

The handful of conditions that decided the shape of everything below.

| Kind | The constraint |
| --- | --- |
| **Hard** | It has to run on a bare host: `bash` + coreutils on Linux, PowerShell on Windows. No `pip`, no `jq`, no `python3` I am allowed to assume. |
| **Hard** | It must not need root, and must not modify the host under test. Read-only, with one exception I document rather than hide. |
| **Budget** | Minutes per host. The engine has to rank, not enumerate, and its own reproducibility test has to finish in seconds without root. |
| **Surface** | The filesystem is the untrusted input: filenames with spaces, symlinks that resolve elsewhere, permission bits that describe three audiences, a `.bashrc` that executes on read. Output has to be parseable without executing it. |
| **Non-goal** | No weaponisation, no kernel-exploit database, no Windows crossing engine, no claim of complete detection coverage. |

The **Non-goal** row does the real work. Without it, the next reasonable request is "make it also
exploit what it finds", and that request would have shaped the architecture more than any decision
I made on purpose.

## The components

Every row earns its place by answering a question, not by existing.

| Component | Responsibility | Depends on | Fails into |
| --- | --- | --- | --- |
| `linux/enumeration/context_check.sh` | Fix who I am and what this identity already reaches, before any system-wide command | `/proc/self/status`, optional `capsh` | The engine refuses to run; or the operator crosses against a stale context |
| `linux/enumeration/*_check.sh` (10) | One category each — SUID, caps, cron, kernel, sudo, NFS, containers, sessions, RPATH — explaining every check it makes | `bash`, coreutils | A category prints "clean" and is read as coverage when it is only one axis |
| `linux/engine/cross.sh` | Collect "runs above me" × "I can influence", report **only the intersection**, each with the five questions and a priority | `context_check.sh --facts` | An empty report, or a lead printed as if it were a vector |
| `linux/engine/tests/run.sh` | Rebuild the article's `forge` fixture and assert the crossing fires and the non-writable files stay silent | `cross.sh` | A regression nobody notices, in the one piece that carries the thesis |
| `windows/enumeration/*.ps1` (5) | Per-technique privilege checks — tokens, services, UAC, stored creds, AlwaysInstallElevated | PowerShell | Permission parsing that is simplified and says so |
| `*/techniques/*.md` (17) | Mechanism, manual check, exploitation, detection, prevention — one note per technique | Nothing | Prose drifting away from the script it describes |
| `detection/*.md` (2) | The blue half: auditd rules, Sysmon config, EventID mapping, SIEM queries | Nothing | The defensive half goes stale while the offensive half grows |
| `methodology/` | The decision tree and the Linux checklist the scripts are ordered by | Nothing | Order of operations becomes memory instead of a document |
| `common/reverse_shells.md` | Payloads and transfer methods for both platforms | Nothing | — |
| `Makefile` | Cross-compiles the one exploit from source; `clean` removes build and report artefacts | `mingw-w64` | `make linux` prints a message, because there is nothing there yet |

## From requirement to design

The pivotal decision is the whole project: **enumerate by category, or enumerate by crossing?** The
first is cheap and produces two lists that never meet. The second is a hypothesis and costs a
person's attention, and it is the only version that produces a vector. Everything else follows from
choosing the second — including the decision to build a small engine in shell rather than extend an
enumeration script, and to accept that the Windows side would get per-technique checks first and a
crossing engine only if it earned one.

> **Plain terms**
> A tool that lists locks gives you a longer list; a tool that shows which two locks touch gives you
> a direction. The second one has to guess — "I think the person carrying the keys reads notes left
> on this desk" — and a guess that costs a minute of reading is worth more than a certainty that
> costs an hour of nothing. The project chose to make the guess explicit and cheap rather than to
> pretend enumeration alone is the answer.

> **Rejected**
> Wrap `linpeas` and post-process its output — fails on *the problem*: it collects by category and
> the crossing is a hypothesis it does not hold. Post-processing cannot invent the hypothesis, only
> reformat the two lists.

> **Rejected**
> One script that enumerates *and* exploits — fails on *non-goal* and *surface*: auto-exploitation
> against a filesystem I do not control turns a report into an incident, on someone else's machine,
> at the moment I am least able to explain it.

> **Rejected**
> Write the engine in Python — fails on *hard*: the box may not carry an interpreter I can rely on,
> and shipping one is not an option. The shell is the one runtime guaranteed to be there, which is
> also why the output is TSV parsed with `cut -d= -f2-` instead of JSON.

> **Rejected**
> Emit JSON and let the operator filter it — fails on *hard*: no `jq`, no `python3` guaranteed. The
> contract is `CTX_KEY=value`, one per line, values allowed to contain spaces, never `source`d —
> because sourcing output produced by a hostile filesystem is how a read-only tool becomes a
> write-anywhere one.

> **Rejected**
> Build the Windows crossing engine first — fails on *budget*: the Linux crossing is cheap to prove
> against `/proc`, `cron` and unit files, and Windows privilege checks need different primitives.
> Shipping one honest half beats stubbing two.

## Implementation

The engine is `bash`. It calls `context_check.sh --facts`, aborts if I am root, and works over
three temporary TSV files inside a `mktemp -d` with a cleanup trap — `stdout` is the report,
`stderr` is progress. Axis A is what runs above me (SUID/SGID, file capabilities, sudo rules,
objects my groups can reach). Axis B is what I can influence (files and directories writable in
paths a privileged process consumes). The output is the intersection, and nothing else.

Six rules decide a crossing:

| Rule | The crossing it captures |
| --- | --- |
| R1 | A privileged binary that is **writable** |
| R2 | A SUID binary that resolves a helper **by name** with a writable `PATH` ahead of it |
| R3 | A root job that **executes or sources** something writable |
| R4 | A sudo rule whose target is writable, or a GTFOBin |
| R5 | A root job whose path or `PATH` sits in a writable directory |
| R6 | A **group** of my identity reaches a privileged object — `docker.sock`, the libvirt socket, `/dev/sda` |

Every hit is emitted with the five questions the article insists on — **Actor · Precondition ·
Primitive · Consequence · Objective** — and a priority:

```text
priority ≈ privilege delta × my influence ÷ cost of proving
           root=3, creds=2, lateral=1   content=1.0, dir=0.8, heuristic=0.5   one line=1, command=2, wait for cron=3
```

If the *consequence* cannot be stated, the hit does not become a vector: it drops into a `Leads`
section, which is where unknown belongs. The rest are not silently dropped either — they land in
`Descartes with criteria`, so the rejection is a written decision and not a feeling:

```text
Discarded, with the criterion that killed each:
  /usr/bin/su, /usr/bin/passwd    distro SUID set: documented behaviour, zero delta
  /usr/bin/ping  cap_net_raw+ep   real capability, wrong objective: raw sockets are not root
  files owned by my own uid       I already own them; that is writing, not privilege
  sudo entries without NOPASSWD   a wish list until proven
```

The one piece of the project that has to be right is the crossing, so it has a reproducible test.
`tests/run.sh` builds the article's `forge` fixture under `/tmp` with legal permissions
(`0555`/`0444`/`0644`), runs `cross.sh --root <fixture> --quick`, and asserts both directions: the
group-writable config that root sources through cron *and* through a systemd `EnvironmentFile` is
found, and the `publish.sh`, the cron entry and the unit file — none of them writable — are
**not** reported. It needs no root and finishes in seconds, which is the only way a hypothesis this
cheap is allowed to be this load-bearing.

## In plain terms

A company runs a building where finished goods are made at night. You have a badge that gets you in
the front door and almost nowhere else. At night a cleaner walks the floors with a ring of master
keys and follows notes left on the desks. You would like into the top-floor office, and the wrong
question is "which lock is weakest". The right one is "where do two situations touch".

Nobody ever wrote that question down, because the map of locks is easy to make and the map of
*touching* is not. So the project is one habit turned into a small tool: before anything else, find
out exactly who you are in the building — which badge, which clubs, which doors were left open for
you already. Then look for the one desk you can leave a note on that the cleaner with the keys
actually reads. Two facts, each harmless alone, one open office at two in the morning.

The tool prints the crossings, the leads and, just as importantly, the things it looked at and
dismissed, with the reason. That last list is what makes the surviving findings chosen rather than
stumbled into.

## What I'd do differently

**Carry-over.** Two rules worth keeping:

- **A vector is an element on two axes.** If a finding sits on one axis only, it is furniture — a
  key you cannot reach, or a note nobody reads. Ask "what runs above me, and what can I influence",
  and only trust the line where both are true.
- **Write the rejection log.** The candidates you kill, with the criterion, are what make the
  survivors chosen. A method that only shows its wins is indistinguishable from luck.

**Limits — where this does not hold.** Stated rather than buried, because a tool presented as
complete gets trusted where it fails:

- The crossing engine is **Linux only**. On Windows these are per-technique enumeration scripts;
  the intersection is still done by hand, and the write-up counterpart to the article — Windows
  privilege escalation — is still pending.
- Detection is **asymmetric**. Every technique note carries a detection and prevention section, but
  the two consolidated notes are thinner than the folder suggests: the Linux one covers five of ten
  techniques at the system level, the Windows one five of seven.
- The root README promises a real HTB case for every technique. Only three notes actually have one.
  That promise is documentation debt, and I would rather cut the claim than pad the notes.
- `linux/exploits/` is empty and its Make target only prints a message; the one compiled exploit,
  PrintSpoofer, is a **studied, simplified reimplementation** of itm4n's original, not the upstream
  binary. On Windows, the service permission check admits it is simplified, and `uac_check.ps1`
  actually attempts a bypass rather than only reading — which contradicts the read-only framing the
  rest of the project keeps.

If I started again, the first thing I would delete is the exploit column in the technique tables.
It promises a weapon the project deliberately does not ship, and every honest thing here is in the
column nobody photographs: the criteria for saying no.
