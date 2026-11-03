---
title: "Linux privilege escalation: the questions, not the commands"
description: "A script can hand you 400 lines of findings; it cannot hand you the judgment that turns one of them into a root shell. The questions I ask after the foothold, built on a fictional build server — including the candidates I discarded and the criterion that killed each."
category: "Method"
tags: ["Linux", "Privilege Escalation", "Post-Exploitation", "Enumeration", "SUID", "sudo"]
featured: false
date: "2026-10-06"
---

There is a genre of post-exploitation that consists of dropping `linpeas.sh` on a box, waiting for
the colours, and treating whatever turns red as the answer. It works often enough that nobody stops
doing it. It also produces a very specific failure: a 400-line report where the reader cannot tell
which line mattered, and where the line that did matter sits three screens below something that
rendered identically and was worthless.

The difference between those two lines is not a tool. It is a question. So this is not a list of
techniques — SUID, capabilities, cron, sudo, there are enough of those elsewhere — and there is no
machine here. The target below is a specification I wrote for this article, and it exists to make
one point: **escalation almost never happens in one thing. It happens where two things cross.**
Everything else — the vocabulary, the tooling, the order of operations — falls out of that.

## The question

Should the first thing you run on a compromised host be the enumeration script, or the answer to
"who am I right now"?

The honest answer is that the script is useless until the second question is answered, and that is
the useful part. The same `4755` binary, owned by root and world-executable, is a road to root for
one identity and a photograph of the operating system for another — depending on nothing except
which groups it belongs to and what its shell is allowed to inherit. Enumerating before fixing your
own context does not produce findings; it produces candidates you cannot yet rank.

The real question, then, is this:

> Given the identity I actually hold, **what crosses something I can influence with something that
> runs above me** — and which of those crossings can I prove in minutes rather than hours?

If you can answer that, the tool output becomes evidence instead of a treasure map. If you cannot,
the tool only hands you a longer list of things you cannot yet rank.

After reading this you should be able to land on an unfamiliar host, establish your context before
touching anything, rank findings by where two axes meet instead of by how loud they render, and
reject candidates with a written criterion instead of a feeling.

## The target model

The target is `forge`, a fictional internal build server. It compiles packages for an internal
team, stages the output, and publishes it to a mirror every night at 02:00. It is a plain,
well-meaning box built by developers rather than by an operations team, which is exactly the
interesting case: nothing here is malicious, everything here is *reasonable*.

- **Actors.** Me: `builder`, a real low-privilege account, member of group `builders`. Root: not a
  person, a schedule — cron entries that run scripts as root overnight. `svc-deploy`: a service
  account that owns its own socket. The administrator: whoever configured all of the above and
  went home.
- **Assets that matter.** Root's ability to write anywhere (the thing I want), the artifact mirror
  (what the team ships — integrity), and the cron schedule itself (the most reliable privileged
  process on the box).
- **Components.** A `cron.d` entry that runs `publish.sh` as root; that script plus the
  `publish.conf` it sources; a SUID helper the developers wrote to archive build output; an
  interpreter carrying a file capability; one `NOPASSWD` sudo rule; and the deploy service's
  socket.

### The vocabulary the model is built from

Before the model, the language it is written in. Six pieces, no more.

- **`rwx`, three times.** Every file carries read/write/execute bits for its owner, its group, and
  everyone else — `rwxr-x---` is a statement about three audiences, not one. `ls -l` is the
  confession: the first column *is* the whole permission model as far as `ls` is concerned.
- **SUID, SGID, sticky.** A fourth octet in front of those nine: `4000` (SUID) makes the kernel run
  the program with the *file owner's* identity, `2000` (SGID) with the *file group's*, and `1000`
  (sticky, the thing on `/tmp`) only prevents deletion of other people's files. The mental model
  that matters: **a SUID file lends its owner's identity to whoever executes it.** Permissions say
  who may borrow the key; SUID says there is a key inside.
- **Capabilities.** The alternative to lending the whole keyring: root sliced into small named
  pieces — `cap_setuid`, `cap_net_raw`, `cap_dac_override` — that can be attached to a single file
  and take effect for a single execution. The difference from SUID is not cosmetic: a SUID binary
  is *root while it runs*, whereas a file with `cap_net_raw+ep` holds exactly one capability and
  nothing else. `setcap` writes them into the file's extended attributes; `getcap -r /` reads them
  back — and note the suffix, because `+ep` (effective + permitted) does work in a normal shell
  while `+p` without `e` arrives in a process that has no idea how to use it.
- **ACLs.** The three `rwx` columns are not the whole truth: `setfacl` can grant a fourth entry to
  one specific user, and `ls -l` will only deign to show a `+` at the end of the mode string. If
  you have never run `getfacl`, you have been reading a summary and calling it the file.
- **Real, effective, saved UID.** Three numbers, not one: who you *are* (`ruid`, what signals and
  logins see), who you *are for permission checks* (`euid`/`fsuid`, what the kernel consults when
  you open a file), and who you are allowed to *go back to* (`suid`, what makes `setuid(0)` in a
  SUID program reversible). Escalation is, precisely, the act of moving the second number without
  necessarily moving the first — and everything in this article is about who is allowed to move it.
- **Ownership vs effective rights.** A file can be owned by root and still be group-writable by
  me; an ACL can hand me write access that the owner never granted; a capability can hand my
  *process* an identity my account does not have. Ownership is a fact about a file. Effective
  rights are a fact about a moment — which identity is standing in front of it, right now.

> **Plain terms**
> Think of a building with three kinds of authority. First, the locks: every door has three lists
> taped to it — yours, your department's, and everyone else's. Second, keys that work for one
> night only: the cleaning contractor's badge opens every floor, but only while the contractor is
> on shift — except in this building some badges were copied and never expired. Third, a desk
> clerk who is allowed to act as the manager for two specific tasks, because giving the clerk the
> manager's whole keyring felt excessive. Everything technical in this article is one of those
> three objects; everything strategic is about which of them crosses with something you are
> allowed to touch.

## The surface criteria

I score an element as privilege-escalation surface if **any** of these holds. Not all — any. One
is enough to earn a row in the inventory.

| Axis | The question it answers |
| --- | --- |
| **Runs above me** | Can I make something execute with an identity I do not hold? (SUID/SGID, file capabilities, `sudo -l`) |
| **Write reaches up** | Can I write or influence something a more privileged actor will read or execute later? (cron, timers, configs a root script sources, PATH directories, library search paths, run-parts directories) |
| **Contact with root** | Does a process running as root touch a file, socket, pipe, temp path, or environment that I can touch too? |
| **Unverified trust** | Does anything privileged act on my input because *I* am the one providing it, without checking it? (wildcards, relative paths, unvalidated symlinks, filenames and arguments that reach a shell) |
| **Context crossing** | Are a file's permissions evaluated once by one identity, and the file's content acted on later by another? |

Any one of these earns a row. **But a row is not a vector — a vector is an element that sits on at
least two axes at once.** The SUID helper is only "runs above me". The group-writable config is
only "write reaches up". The root cron that sources that config with that helper in its PATH is
where the axes meet, and escalation lives in the meeting, not in either line of `ls -l` taken
alone. This is why enumerating by category produces two lists and no vector, and it is the entire
argument of this article.

Because a rubric that ranks nothing is just a list:

> **Priority ≈ privilege delta × my influence on it ÷ cost of proving it**

The privilege delta is how far the identity moves — `builders` to `root` is a delta, `builder` to
`builder` is zero. My influence is whether I can write the *exact* thing the privileged actor
consumes, and how soon it will consume it again (tonight at 02:00 beats "some day"). The
denominator is the part people skip: an hour proving something that yields a version string is
worse than ten minutes proving a path root will write to. The formula is not sacred. Writing it
down is — it forces the tradeoff to be explicit, and it is what stops you spending the night on a
debug socket.

## The inventory

Before any system-wide command, the context question — because it is the only one whose answer
changes every other answer:

```bash
$ id; sudo -l 2>/dev/null | tail -n +3
```

```text
uid=1001(builder) gid=1001(builder) groups=1001(builder),1005(builders)
User builder may run the following commands on forge:
    NOPASSWD: /usr/bin/systemctl restart watcher.service
```

Not "what is on this box", but **what does this identity already reach**: two groups, one sudo
rule, and — from the same habit — my shell's bounding set, whether I am in a container, and what
environment I inherited. A `+ep` capability is invisible in `id` but visible in the same sweep; a
`deploy`-group socket is visible but unreachable. The context comes first because *reachability is
a property of the identity, not of the file*.

Then enumerate **by crossing, not by category**. Do not produce a SUID list and a cron list and
compare them later; produce the question "which of these SUID binaries touches something I can
write, and which of these root processes reads a file I can write". The two lists were always the
same list, asked properly.

Tools: `linpeas`, `LinEnum`, `enumy` collect, and they collect well — use them. What they cannot do
is the crossing, because the crossing requires a hypothesis. A script can report that a file is
group-writable; it cannot tell you whether anything privileged will ever read it, because that
answer lives in a crontab, a unit file, and an init script that someone has to read *together*.
That reading is the job. The tool is the intern.

The criteria also decide what does **not** earn time. Not in the table below, and not worth a
second look:

- The distribution's own SUID set — `su`, `passwd`, `newgrp`, `mount`. Documented behaviour; they
  hand you exactly what their manpages promise and nothing behind that.
- `cap_net_raw+ep` on `/usr/bin/ping`. A real capability, honestly reported — and raw sockets are
  not root. Wrong objective, zero delta.
- Files writable only by my own uid. I already own them; that is not "write reaches up", that is
  writing.
- Sudo entries that require a password I do not have. `sudo -l` is a wish list until proven.
- World-writable `/tmp`, `/proc`, `/sys`: sticky bit, kernel plumbing, or nothing privileged ever
  consumes them.
- Kernel exploit classes whose preconditions fail — a `uname -r` outside the affected ranges, or
  `kernel.unprivileged_userns_clone = 0`. Check the precondition, record it, move on. That is a
  two-minute habit, not a night's project.

The criteria, applied. Six rows, and the rubric is what earned each of them a place:

| Element | Purpose | Talks to | Trust boundary | Fails into |
| --- | --- | --- | --- | --- |
| `stage-artifacts` (SUID) | Archive and hash build output as root so artifacts land root-owned in `/opt/release` | My shell, `sha256sum` resolved **by name**, `/opt/release` | A root program inherits my environment and resolves helpers by first name | Releases nobody can tamper with — the intent, and the only thing guaranteed |
| `nightly-publish` (cron) | Publishes the nightly build at 02:00, as root | `publish.sh`, the log file, the mirror | Root executes a script whose inputs come from a group I am in | A missed publish, a wrong artifact — nobody gets paged for either |
| `publish.conf` | Knobs for the publish script: stage dir, mirror dir, log file | `publish.sh` at 02:00 | A group-writable file that root sources without validating | A quiet misconfiguration nobody watches, because it has never misbehaved |
| `python3.11` (`cap_setuid,cap_setgid+ep`) | A deploy script once needed `setuid`; the capability landed on the interpreter | Every local account | An identity-changing capability on a world-executable interpreter | The interpreter still behaves normally for everyone — which is why it stayed |
| `sudoers`: `systemctl restart watcher` | Let builders bounce the log watcher without filing a ticket | `systemctl` as root, `watcher.service` | A root action granted to a group, safe only as long as the unit cannot be steered | Service blips during deploys |
| `/run/deploy.sock` | IPC for the deploy service | `svc-deploy`, group `deploy` | Group `deploy` → service — **`id` says I am not in that group** | Nothing, for me: a boundary that does not include my identity |

Two columns carry the table. **Trust boundary** names the assumption nobody is verifying.
**Fails into** is what the owner already accepted as normal — and the gaps live there, because
nobody hardens the thing that has never misbehaved: the config file that has been group-writable
for two years and has never once been edited by the wrong person is invisible, right up until the
night somebody edits it.

## From element to vector

A vector answers five questions. Not four, not six — five, because four lets you skip the one that
does the work.

1. **Actor** — who am I at this point, with what groups?
2. **Precondition** — what must already be true for this to work?
3. **Primitive** — what single capability does it hand me?
4. **Consequence** — what does that capability unlock next?
5. **Objective** — does it move toward root, or just sideways?

If any answer is *unknown* rather than *yes*, it is a lead, not a vector. Unknown is fine — most
good vectors start unknown. What is not fine is shipping a finding whose consequence you cannot
state.

> **Plain terms**
> A finding is not a thing that is wrong. It is a thing that is wrong *and that you can push*.
> Before touching anything, ask two everyday questions of every candidate: who is holding the
> key, and who is holding the note? If the person with the key never reads notes from your desk,
> you have a piece of furniture, not a door. The filter runs before the work — that is the whole
> difference between "here is a trick" and "here is how I decide".

### Candidate A — the file the root cron reads

- **Actor** — `builder`, member of `builders`. Group membership is not a detail here; it is
  precondition zero.
- **Precondition** — `publish.sh` is readable, and line 3 sources `/opt/ci/publish.conf` *before*
  it does anything else. The cron runs that script as root at 02:00. Both facts are readable
  rather than inferred — which, under the cost denominator, is exactly what I want.
- **Primitive** — choose a path that root will write to, and content that root will copy there
  (anything I stage, plus whatever the script itself generates).
- **Consequence** — a root-owned file containing my content at a path I choose: `/etc/cron.d/`,
  a cron file anywhere, `ld.so.preload`. The next 02:00 is a root shell.
- **Objective** — root. Not "arbitrary write, interesting", not "a finding": *the ability to place
  a file the operating system will obey*, on a schedule.

Nothing in `ls -l` on `publish.sh` is wrong — it is `755 root root`. Nothing in `publish.conf`'s
mode is wrong on its face — `rw-rw-r--` on a shared build box is a perfectly normal sharing
decision. **Neither file is the bug. The bug is that a file I may write is read by a process I may
not, with no check in between.** That sentence is the vector; it is also invisible to any tool
that lists files without listing who reads them.

### Candidate B — the interpreter that kept a key to the front door

- **Actor** — any local user. The interpreter is world-executable, so this candidate does not care
  which groups I am in.
- **Precondition** — file caps `cap_setuid,cap_setgid+ep`: *effective*, not merely permitted, which
  is the difference between a key and a photograph of one. The one thing that can still stop it is
  my own shell's bounding set — if the attempt silently fails, the next place to look is
  `CapBnd` in `/proc/self/status`, not a different exploit.
- **Primitive** — call `setuid(0)` from a language I control, with the kernel convinced by the
  file's capability rather than by any file permission.
- **Consequence, objective** — root, in one command.

Cost of proving: a single line. Under the priority formula this is the cheapest vector on the box
and, when found, it goes first — not because capabilities are fashionable, but because the
denominator is the smallest number in the table.

### Candidate C — the helper that asks for a tool by first name

- **Actor** — `builder`, with my own `PATH`. Environment passes to a SUID execution; the kernel
  and glibc strip `LD_PRELOAD` and friends, and `PATH` is not one of them — it is the *program's*
  job to re-check it, and this program does not.
- **Precondition** — `stage-artifacts` resolves `sha256sum` unqualified (the string is in the
  binary), and a directory I can write sits ahead of `/usr/bin` in my `PATH`.
- **Primitive** — a program of my choosing executes as root, whenever the helper runs.
- **Consequence, objective** — root.

> **Rejected**
> `sudo` rule (`systemctl restart watcher`) — fails on *consequence*. Precondition is perfect
> (`NOPASSWD`), but the unit file, its drop-in directory, and `ExecStart` are all root-owned and
> not writable, so the restart hands me a service that stops and starts exactly as it did before.
> The rule is a door to a room with nothing in it.

> **Rejected**
> The distribution's SUID set (`su`, `passwd`, `newgrp`, `mount`) — fails on *consequence*: these
> are the manpages, not the system behind them. Every hour spent here buys documented behaviour.

> **Rejected**
> `/run/deploy.sock` — fails on *precondition*: `srw-rw---- root deploy`, and my `id` does not
> contain `deploy`. Note the honesty requirement: I have not proved this socket is useless, I have
> proved it is useless *for me*. It stays in the report as a lead for the next identity.

> **Rejected**
> Kernel LPE classes (Dirty Pipe's version range, overlayfs via user namespaces) — fail on
> *precondition*: `uname -r` is outside the affected ranges and
> `kernel.unprivileged_userns_clone = 0`. Two minutes of checking, recorded as a line in the
> notes, not a night of patch archaeology. The habit survives the rejection; only this box does
> not qualify.

### The part that is genuinely uncomfortable

Swap my credentials for `svc-deploy`'s and this article changes: not in `builders`, so Candidate A
never enters the room; Candidate B still stands, because world-executable is world-executable;
Candidate C stands too, because your `PATH` is always yours. Now arrive as an identity *in* group
`deploy`, and the row I rejected at the top of this section becomes the live one.

So the priority list is not a property of the target. It is a property of the target **and the
credentials in my hands** — and in privilege escalation, unlike in web work, those credentials are
the first thing you should write down, before you have run a single command against the system.

## Execution

Five commands carried decisions. Everything else I ran is omitted deliberately.

**Context.** The question that comes before enumeration:

```bash
$ id; sudo -l 2>/dev/null | tail -n +3
```

```text
uid=1001(builder) gid=1001(builder) groups=1001(builder),1005(builders)
User builder may run the following commands on forge:
    NOPASSWD: /usr/bin/systemctl restart watcher.service
```

Two groups, one sudo rule. `builders` is what will matter; the sudo rule will be rejected in four
minutes, on consequence.

**What runs above me.** The two searches, run as one sweep because they answer one question:

```bash
$ find / -xdev -perm -4000 -type f 2>/dev/null
$ getcap -r / 2>/dev/null
```

```text
/usr/bin/su
/usr/bin/passwd
/usr/bin/newgrp
/usr/bin/mount
/usr/local/bin/stage-artifacts
/usr/bin/ping            cap_net_raw+ep
/usr/bin/python3.11      cap_setuid,cap_setgid+ep
```

The four distro binaries are the noise filter above, applied. `ping` is rejected on objective in
the same glance. Two lines survive — and of those, `stage-artifacts` only becomes a candidate
after I confirm it resolves helpers by name:

```bash
$ strings /usr/local/bin/stage-artifacts | grep sha256
```

```text
sha256sum %s
```

**What I can write that root reads.** The crossing, before proving it:

```bash
$ grep -n 'conf\|MIRROR\|mkdir\|cp ' /opt/ci/publish.sh; echo ---
3:. /opt/ci/publish.conf
22:mkdir -p "$MIRROR_DIR"
24:cp "$STAGE_DIR"/* "$MIRROR_DIR"/
$ ls -la /opt/ci/
```

```text
-rwxr-xr-x  1 root  builders  812 Oct  4 09:10 publish.sh
-rw-rw-r--  1 root  builders   94 Oct  4 09:10 publish.conf
drwxrwxr-x  2 builder builders 4096 Oct  5 22:14 stage/
$ cat /etc/cron.d/nightly-publish
0 2 * * * root /opt/ci/publish.sh >> /var/log/ci-publish.log 2>&1
```

Line 3 sources the conf before anything else; line 24 copies without `-p`, so whatever lands in the
mirror is root-owned and contains what I staged. Three files, three legal permissions, one
intersection.

**The crossing, proved.** At 23:40 I set `MIRROR_DIR=/tmp/ci-marker/` in `publish.conf` and dropped
a `canary.txt` into `stage/`. The cron fired overnight; at 07:31:

```bash
$ ls -la /tmp/ci-marker/
```

```text
drwxr-xr-x 2 root root 4096 Oct  6 02:00 .
drwxrwxrwt 1 root root 4096 Oct  6 07:31 ..
-rw-r--r-- 1 root root 61440 Oct  6 02:00 release-2026-10-05.tar.gz
-rw-r--r-- 1 root root    42 Oct  6 02:00 canary.txt
```

Root created a directory at a path I typed and put my file inside it, owned by root. Path control
and content control, photographed with an innocuous canary instead of a payload — swapping
`canary.txt` for a cron file and `/tmp/ci-marker/` for `/etc/cron.d/` is a two-line change that
does not need to be performed to be *proved*, and performing it would trade a report finding for an
unstoppable root shell at 02:01 on someone else's build server.

**The cheap door.** Candidate B, one command — run before anything else in a real engagement,
shown last here only because the crossing above is the subject of the article:

```bash
$ python3.11 -c 'import os; os.setuid(0); os.setgid(0); os.system("id")'
```

```text
uid=0(root) gid=0(root) groups=0(root),1005(builders)
```

**What I could not prove.** Three things, stated rather than buried:

- Every call site of `stage-artifacts`. I verified the PATH resolution from an interactive shell;
  a caller that sanitises `PATH` before invoking it would kill Candidate C, and I could not
  enumerate all callers inside the time box. Candidate C is *unconfirmed*, not confirmed.
- Whether `/run/deploy.sock` is reachable through any identity I could have obtained. It is
  rejected for *me*, which is a different claim from rejected, and the report says exactly that.
- Whether configuration management re-owns `publish.conf` nightly. If it does, Candidate A closes
  on its own by morning and my 23:40 edit was a race I happened to win. I observed the file once,
  not longitudinally — a timestamp next to the finding, not a guarantee.

## In plain terms

A company runs a small building where finished goods are made at night. You have a badge that gets
you in the front door and almost nowhere else: you can walk into the workshop, use the shared
tools, and operate the machines you were hired to use. At night there is a cleaner carrying a ring
of master keys, a machine that moves finished boxes into the storeroom, and a guard at the top
floor who opens the door when a card is presented once downstairs and never checks whether the
person walking through is the person the card belonged to.

You would like into the top-floor office. The wrong way to think about it is "which lock is weak".
The right way is "where do two situations touch".

Somebody lends you their keys — that is the program that runs wearing someone else's name. You are
allowed to leave a note on a desk — that is the file you can write. The cleaner picks up notes
left on that desk and follows them without asking who left them — that is the person with the keys
reading your note. Alone, neither fact changes anything: keys you cannot reach, and notes nobody
reads, are just furniture in the room. Together, at two in the morning, one of them opens the
top-floor office. The mistake was never the note, and never the keys. It was that a note you are
allowed to write reached a hand holding keys you are not.

Two other doors existed and I did not walk through either. One needed a keyring belonging to a
club I was never invited to. The other would probably have worked, but only by taking a sledgehammer to the building's own wiring — and the building might have come down with me inside it.

The habit worth taking is this. When you land in a building you do not know, first find out
exactly who you are in it: which badge, which clubs, which doors were already left open *for you*.
Only then ask which two situations touch. The tools will happily hand you a map of every lock in
the building. Not one of them will tell you which lock has both a key and a note pointed at it on
the same night.

## Carry-over

The part you can apply to a host neither of us has seen. Eight questions — if you cannot answer
all eight, you have not finished enumerating, no matter what the script printed.

1. **Who am I here, exactly, and what does this identity already reach?** uid/euid, groups,
   `sudo -l`, file capabilities on my own shell, container or bare metal, the environment and cwd
   I inherited. Before one system-wide command.
2. **What can I make run with an identity that is not mine — and what does that thing actually do
   with the extra identity?** SUID/SGID, file capabilities (`+ep` vs `+p`), sudo rules. The
   privilege is half the finding; the other half is what the program *does* while holding it.
3. **What can I write that something more privileged will read or execute later?** cron and
   `cron.d`, timers, unit files, configs that root scripts source, directories on `PATH`,
   directories on the library search path, run-parts directories, maildrop directories.
4. **What do root processes touch that I can touch too?** Sockets, pipes, temp files with
   predictable names, `/proc/<pid>` exposure, environment variables inherited across a restart.
5. **What does the system assume about me without checking?** Wildcards expanded by a root shell,
   relative paths, symlinks nobody re-validates, filenames and arguments that reach a shell
   quoted or not.
6. **Where do file permissions and execution context cross?** Permissions are evaluated once, by
   one identity; content is acted on later, by another. Find the files that sit on both sides of
   that gap — they will not advertise themselves.
7. **For each hit: primitive → consequence → objective.** What single capability do I get, what
   does it unlock, and does it move toward root or sideways? If you cannot answer the third, you
   have a lead.
8. **What did I reject, on which criterion — and what could I not prove?** The rejection log is
   what makes the surviving findings chosen rather than stumbled into, and the unproven column is
   what keeps the report honest six months later.

Where this does not reach: it treats kernel and namespace breakouts only as a precondition check,
not as a discipline of their own — exploiting them is a different article. It assumes a stable
shell and time: at the ten-minute mark, a script beats a human, and this method is deliberately
slow at the start because the context question is cheap and everything expensive depends on it.
It says nothing about whether the escalation will be noticed — a separate axis entirely. And it
assumes credentials are as issued; password reuse and keys sitting in shell history are yet
another article.
