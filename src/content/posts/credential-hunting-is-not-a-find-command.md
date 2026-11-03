---
title: "Credential hunting is not a find command"
description: "A scanner can list every file on Windows and Linux that looks like a secret; it cannot tell you which one opens the next host. The manual method — SSH keys, ticket caches, saved credentials, token stores — as a destination-first decision map, built on a fictional estate with a foothold on each OS, including the candidates I discarded and the criterion that killed each."
category: "Method"
tags: ["Credential Hunting", "Lateral Movement", "Windows", "Linux", "SSH", "Post-Exploitation"]
featured: false
date: "2026-10-08"
---

There is a genre of post-exploitation post that is really a directory list: forty places where
Windows and Linux keep secrets, written as a checklist, closed with a recommendation to run a
scanner. The list is accurate. It is also useless in the exact way a map of every building in the
city is useless when nobody has told you which building you are going to.

So this is not a list of places credentials live — there are enough of those — and there is no
machine here. The estate below is a specification I wrote for this article, with two footholds in
it, one per operating system, and it exists to make one point: **the search does not start on the
host. It starts on the destination.** Everything else — which of the forty locations you open, in
what order, and which finding you are allowed to believe — falls out of that one decision.

## The question

Should you enumerate every credential store on the compromised host before deciding where you are
going next?

The honest answer is that "every credential store" is not a set you can finish, and that is the
useful part. On Windows the enumerable stores — Credential Manager, DPAPI, LSASS, ticket caches,
registry values, task and service configuration — already disagree with each other about what
counts as one. On Linux there is no list at all, because every tool that has ever been asked for a
token has written a dotfile, and the set grows with whatever the last engineer installed. An
enumeration that cannot terminate is not a phase; it is a habit.

The real question, then, is this:

> Given the host I need to reach next, **which authentication method does it accept — and which of
> this host's stores can hold material for that method?**

If you can answer that, the forty locations shrink to two or three, and a finding becomes
believable because you know what it is *for*. If you cannot, no scanner gets you there — it only
hands you a longer list you cannot yet rank, and the line that mattered sits between two files you
would have opened anyway.

After reading this you should be able to land on either OS, write the destination down before
touching anything, open only the storage classes that destination's method implies, and reject
candidates with a written criterion instead of a feeling.

## The target model

The target is a fictional operations estate I wrote for this article: three machines, and two ways
of being inside one of them.

- **`relay`** — a Linux jump host the ops team uses to reach the fleet. **Foothold A:** I hold
  `deploy`, a real low-privilege service account that CI uses. How `deploy` was obtained is out of
  scope, as always.
- **`ws-ops-01`** — the Windows 11 workstation of `ana`, the infrastructure administrator,
  domain-joined to `MERIDIAN`. **Foothold B:** I am running inside her interactive session. How I
  got code execution there is out of scope too.
- **`prod-app`** — the production application host: Linux, `sshd` accepting public-key
  authentication only. It is **the objective for both footholds.** It holds `ops`'s view of the
  fleet — the inventory, the deploy keys, the release signing material. One credential crosses, and
  this article stops at the crossing.

The actors, decomposed honestly:

- **Me, twice** — once as `deploy`, once as `ana`. The two identities see different estates, and
  that difference is the subject of a section below.
- **`ana`** — a human, whose habits are the estate's real configuration. Nobody wrote the policy
  that put a private key in a directory with mode `0644`; somebody just needed it to work at 01:00.
- **`svc-ops`** — an automation account whose password lives in a file rather than in a vault.
- **The people who watch the logs** — not actors in this article, but their existence belongs in
  the denominator of every decision below.

The assets that matter: `ops`'s authority on `prod-app`, ana's saved access to the fleet, and the
fact that both of those exist in *storage* rather than in a person's head. The components are not
services — they are **stores**: the key directory on `relay`; and on `ws-ops-01`, her SSH
directory, her Credential Manager, her DPAPI vault, her ticket cache, her shell history.

> **Plain terms**
> A production building with two guards' cupboards. In the basement, somebody photocopied a key and
> left the copy on a shelf anyone can reach, because a machine needed to use it at night. Upstairs,
> a person keeps her keys in a coat only she can open, together with notes of every door whose code
> she has ever typed. You are standing in one of the two rooms, and you need into a third room on
> the top floor. The question this article answers is not "what is in the cupboards" — you could
> search them for a week — but "the top-floor room wants a key; who has left a key lying around?"

## The surface criteria

I score a stored credential as worth my time if **any** of these holds. Not all — any. One is
enough to earn a row in the inventory.

| Criterion | The question it answers |
| --- | --- |
| **Portable** | Does it work from a session other than the one that stored it? |
| **Translates** | Does it authenticate to a *different* host or principal than the one it was found on? |
| **Holds authority** | What does the principal that owns it legitimately reach? |
| **Checkable** | Can I prove it works without consuming it — or without waking the people who watch failed logons? |

The fourth one is where this discipline differs from file hunting. A secret is not a finding until
you have a cheap way to test it: an SSH key fails silently and can be retried forever, a wrong
Windows password costs lockout budget and writes an event, a revoked token tells somebody. Same
rubbish, very different denominator.

Because a rubric that ranks nothing is just a list:

> **Priority ≈ authority of the principal × portability ÷ (cost of proving it × noise)**

Noise is in the denominator on purpose. In privilege escalation, escalation *is* the objective, so
noise is a report note. In credential hunting for lateral movement, the wrong test can lock the
account you were about to use — the search itself can destroy the asset.

**The map.** The criteria say a credential can earn time. They do not say where to look, and that
is the question people actually get wrong. So the destination answers first, and its answer picks
the rows:

> 1. **Where am I going?** Name the next host or principal. No destination → no search; you are
>    collecting, not hunting.
> 2. **What does it accept?** Key, password, ticket, token, live session. That answer is the
>    filter.
> 3. **Which of this host's stores hold material of that class?** Only those. The other thirty-odd
>    locations exist and do not matter yet.

| The next host authenticates with | Where that class lives on Linux | Where that class lives on Windows |
| --- | --- | --- |
| **SSH key** | `~/.ssh/` — private keys, `config`, `known_hosts`; keys parked in automation directories; agent sockets (same uid or root only) | `%USERPROFILE%\.ssh\` — client keys and `config`; agent (`ssh-agent`, Pageant); server side: `administrators_authorized_keys` |
| **Local or domain password** | shell history; `.pgpass`, `.my.cnf`, `.netrc`; cron and systemd units; compose files; ansible inventories | `cmdkey /list` (targets and usernames only — you can use it in place, not extract it); DPAPI blobs in `%APPDATA%\Microsoft\Credentials`; PSReadLine history; `schtasks /query /v` and `sc qc` (they name the *principal*, not the secret); autologon registry values |
| **Kerberos ticket** | ccache files — `/tmp/krb5cc_*`, `KRB5CCNAME` | `klist` — tickets live in the session, not in a file you can copy |
| **Bearer token** | `.aws/credentials`, `.kube/config`, `.docker/config.json`, `.git-credentials` | the same dotfiles in the profile; the browser vault (DPAPI); WinSCP/PuTTY sessions |
| **A live interactive session** | tmux/screen; a forwarded `SSH_AUTH_SOCK` you can actually reach | the session you are already in; saved RDP credentials consumed in place by `mstsc` |

Read the first column as the destination's answer to question 2, and open only the rows it lights
up. A map that lists everything is the checklist this article is against; this one is allowed to
be incomplete because the destination completes it.

> **Rejected**
> `find / -type f \( -name 'id_*' -o -name '*.pem' -o -name '*.kdbx' -o -name '.netrc' \)` —
> fails on *cost of proving*. The set is unbounded, unranked, and answers no question from the map:
> it tells you what looks like a credential, never what authenticates to `prod-app`. Thirty seconds
> to run, three hours to triage, and the triage is the part this article exists to replace.

## The inventory

Before any search, the context question — because on these two branches it is a different answer,
and the answer changes every candidate's ranking:

```bash
$ id
uid=1007(deploy) gid=1007(deploy) groups=1007(deploy),999(ops)
```

```powershell
PS> whoami /groups | findstr /i "mandatory"
NT AUTHORITY\INTERACTIVE S-1-5-4 Mandatory Group
MERIDIAN\ana Mandatory Group
```

Branch A is a service account in group `ops`. Branch B is a human's session. Not "what secrets are
on this box" — **what identity is standing in front of each store, right now.**

### `relay` — foothold A (Linux)

| Element | Purpose | Talks to | Trust boundary | Fails into |
| --- | --- | --- | --- | --- |
| `/opt/ops/id_ed25519` + `config` (both `0644`) | Let automation reach the fleet without a human at the keyboard | `prod-app` and the rest of the fleet, exactly as `config` says | A private key readable by every account on the host — the file mode is the only thing between `deploy` and `ops` | An SSH authentication failure: quiet, and absent from every log the team reads |
| `/home/ana/.bash_history` (`0644`) | Nothing; it is residue | Nobody | What a person meant to do vs what the system recorded | Nothing — history is never an incident |
| `/etc/cron.d/backup` (`0644`) | Nightly database dump | The local database, at 03:00 | An automation stores a reusable password in a file any local account can read | Nothing; the backup works, which is why nobody has ever looked |
| `deploy`'s dotfiles — `.netrc`, `.git-credentials` | Talk to the artifact registry and the git remote from CI | Registry, git | A token scoped to one system, living in a service account's home where any local compromise reuses it | Loud, visible revocation — CI breaks the next morning |

Not in the table, and not worth a second look from *this* identity:

- `/etc/shadow`, `sudo -l`, `docker.sock` — fails on *precondition* and on *objective*. Reading
  them is privilege escalation on the host I already hold, which is a different article; a root
  shell on `relay` does not authenticate to `prod-app`. Keys do.
- The other users' `~/.ssh/` directories — checked with one `ls` and closed: mode `0700`, their
  uid, not mine. The class exists; the door does not, for me.
- Agent sockets under `/tmp/ssh-*/` — same verdict: the parent directory is `0700` and I cannot
  even list it. One command to establish that, recorded as a line in the notes.

### `ws-ops-01` — foothold B (Windows), running as `ana`

| Element | Purpose | Talks to | Trust boundary | Fails into |
| --- | --- | --- | --- | --- |
| `%USERPROFILE%\.ssh\id_ed25519` + `config` | Reach the fleet from her workstation, the same way the automation does from `relay` | `prod-app`, per her `config` | The key is protected by her profile's ACL and nothing else: no passphrase, no agent, no second factor | Quiet authentication failure |
| Credential Manager (`cmdkey /list`) | Fast RDP to the Windows hosts she administers | Every jump host she has ever connected to | Target and username are visible to any process in her session; the password is DPAPI-bound to her profile | RDP logon events — and only when somebody uses it |
| DPAPI blobs — `%APPDATA%\Microsoft\Credentials`, the browser vault | Her saved passwords for internal panels and sites | Those panels, from her browser | **The user context is the vault**: anything executing as her can decrypt, nothing else can | At most an application-side audit |
| Kerberos ticket cache (`klist`) | SSO to whatever her account is entitled to, without retyping anything | The domain | A bearer ticket: whoever holds it *is* `MERIDIAN\ana` until it expires | Ordinary logon noise — invisible, because it looks exactly like her |
| PSReadLine history | Nothing; it is residue | Nobody | Intent vs record | Nothing |

Two rows worth naming that are **not** credentials: `sc qc` and `schtasks /query /v` tell you which
*principal* a service or task runs as. That is authority information for the rubric's third column
— it tells you whose credential to hunt — and it is a category error to file it under "secrets
found".

## From element to vector

A vector answers five questions. Not four, not six — five, because four lets you skip the one that
does the work.

1. **Actor** — which identity am I holding right now?
2. **Precondition** — what must already be true for this credential to be usable *by me*?
3. **Primitive** — what single authentication does it grant?
4. **Consequence** — which host or principal does that authentication unlock next?
5. **Objective** — does it move toward the destination, or just re-authenticate where I already am?

If any answer is *unknown* rather than *yes*, it is a lead, not a vector. Unknown is fine — most
good vectors start unknown. What is not fine is reporting a secret whose consequence you cannot
state, because that is how reports end up with a list of forty findings and no path through them.

> **Plain terms**
> A credential is not a treasure. It is a person's relationship with a door, written down. Before
> touching anything, ask two everyday questions of every candidate: whose relationship is this, and
> which door is it *for*? If the door is the one you are already standing in front of, you have
> found furniture. The filter runs before the work — that is the whole difference between "here is
> a place secrets hide" and "here is how I decide".

### Candidate A — the key in the automation directory

- **Actor** — `deploy`, or any local account at all: the key is mode `0644`, so the group does not
  even matter.
- **Precondition** — three facts, all readable rather than inferred: the file is present; it has no
  passphrase (established below); and `/opt/ops/config` names `prod-app`, user `ops`, and this
  key as the identity file. The last precondition — that `prod-app` still honours the key — is the
  only one I cannot read, only try, and trying it is cheap.
- **Primitive** — authenticate to fleet hosts as `ops`, from anywhere, repeatably. SSH failures
  cost nothing: no lockout, no password-spray semantics, no event a human reads.
- **Consequence** — a session on `prod-app` with `ops`'s authority: the inventory, the deploy keys,
  the signing material.
- **Objective** — `prod-app` *is* the destination. Not sideways, not "interesting": the crossing
  this article exists to make.

### Candidate B — the key in her profile

- **Actor** — whatever runs inside ana's session. Her ACLs are the precondition, and I satisfy
  them by construction on this branch.
- **Precondition** — the file exists in her profile; the Windows OpenSSH client is installed; the
  key reads without a passphrase prompt. Note what is *not* a precondition: file mode. Her profile
  has no "world" to grant to — the boundary is the user context itself.
- **Primitive, consequence, objective** — identical to A. Same class, different room.

Cost of proving: one command. Under the priority formula this is the cheapest candidate on either
branch, and it goes first — not because SSH keys are fashionable, but because the destination
answered question 2 with "a key" before I opened a single directory. The map predicted this row.

> **Rejected**
> `deploy`'s `.netrc` and `.git-credentials` — fails on *translates*. These authenticate to the
> artifact registry and the git remote; `prod-app` accepts SSH keys, and I am not bringing a
> registry token to a key ceremony. Worse for my purposes: as `deploy` I can already use both
> tokens legitimately. Secret, valid, zero delta.

> **Rejected**
> The password in `/etc/cron.d/backup` — fails on *translates*. It re-authenticates me to the host
> I am already standing in, one service over. And the honesty requirement: if the destination had
> been *the data in that database* instead of a session on `prod-app`, this row jumps to the top of
> the map. The map is a function of the destination — change the destination, re-run the map, do
> not re-run the search.

> **Rejected**
> `cmdkey /list` on `ws-ops-01` — fails twice, on *primitive* and on *translates*. It hands me
> target names and usernames, which is information, not access; the passwords themselves are
> DPAPI-bound to the profile and are not extractable from the list. And use-in-place only speaks
> RDP — my destination runs `sshd`. Recorded as a target list for a different objective.

> **Rejected**
> The Kerberos TGT shown by `klist` — fails on *translates*, which is the map working exactly as
> designed. The ticket is portable and it holds real authority — everything her account is
> entitled to — but `prod-app` does not accept Kerberos, so the credential's method and the
> destination's method never meet. A first-class credential, useless here, for one reason: I asked
> question 2 first.

> **Rejected**
> Her DPAPI vault — fails on *objective* and on *cost of proving*. What decrypts from her context
> is her browser and application passwords: doors I am already walking through as her. Decrypting
> it properly needs a tool run in her session, and the plausible payoff — a reused password to
> somewhere — is unproven. It stays a lead with a stated cost, not a finding.

> **Rejected**
> LSASS, the SAM hive, `reg save` of anything — fails on *precondition*. Her workstation is
> managed; she is an ordinary user on it, and `whoami /priv` shows no `SeDebugPrivilege`. Checking
> that takes two minutes and is recorded as a line, not a night of credential-dump archaeology.
> The habit survives the rejection; only this box does not qualify.

> **Rejected**
> GPP `cpassword` in SYSVOL — fails on *precondition*: checked, absent, patched since MS14-025.
> Two minutes of `findstr /s /i cpassword` over `\\MERIDIAN\SYSVOL`, an empty result, and a line in
> the notes. The rejection is cheap; skipping the check is what costs.

### The part that is genuinely uncomfortable

Swap the identities and the article changes shape. On `relay`, the prize is a `0644` file: *every*
local account sees it, so foothold A's ranking barely depends on being `deploy` at all. On
`ws-ops-01`, everything interesting is closed to anyone but ana — her `.ssh` directory, her DPAPI
vault, her tickets. So one branch's finding is a public service and the other's is a keyhole, and
that asymmetry is not "Linux vs Windows". It is one file mode and one ACL that two different
people chose on two different afternoons.

Write down all three properties — destination, host, identity — because the priority list is a
function of all three, and each of the sentences below gets a different reaction from the client:

- "This is the worst credential on the host."
- "This is the worst credential on the host *given what I could read as the identity I held*."
- "This is the worst credential *for reaching the destination you named*."

Only the third one is the lateral movement assessment. The other two are inventory.

## Execution

Twelve commands carried decisions across the two branches. Everything else is omitted
deliberately.

**Branch A — context, then the store the map pointed at:**

```bash
$ ls -la /opt/ops/
```

```text
-rw-r--r--  1 root ops  412 Oct  2 01:44 config
-rw-r--r--  1 root ops  487 Oct  2 01:44 id_ed25519
```

```bash
$ cat /opt/ops/config
```

```text
Host prod-app
    HostName 10.20.4.31
    User ops
    IdentityFile /opt/ops/id_ed25519
    IdentitiesOnly yes
```

The destination's address, its user, and the identity file — three of candidate A's preconditions,
read instead of guessed. Now the one that decides whether this is a vector or a locked door:

```bash
$ ssh-keygen -y -f /opt/ops/id_ed25519
```

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI...fQ9
```

No passphrase prompt — the key read its own public half and printed it. Passphrase-protected keys
stop here with a prompt instead, and on a non-interactive shell, with an error; that single command
is the whole precondition check.

Residue as corroboration, not as a store:

```bash
$ grep -h 'prod-app' /home/ana/.bash_history
```

```text
ssh -F /opt/ops/config ops@prod-app systemctl status api
```

She drives this exact key at this exact host, by hand. The `config` file stopped being a guess.

The two credential-shaped rows the map says do *not* apply, evidenced in one view:

```bash
$ cat /home/deploy/.netrc; grep -n 'password' /etc/cron.d/backup
```

```text
machine artifacts.acme.test login ci-bot password glpat-9f2c...
3:0 3 * * * root /usr/local/bin/db-dump --password 's3rver-n1ghtly' >> /var/log/backup.log
```

Two secrets, two different doors, neither of them the one I am standing at. Recorded in a minute,
rejected on *translates*, never tested — testing them proves nothing I do not already know.

**The crossing, proved quietly:**

```bash
$ ssh -o BatchMode=yes -o ConnectTimeout=5 ops@10.20.4.31 id
```

```text
uid=2001(ops) gid=2001(ops) groups=2001(ops),100(users)
```

`BatchMode` matters: it refuses to prompt, so this either authenticates with the key or fails
without ever offering a password. Repeatable, silent, and it answers the last precondition in one
round trip.

**Branch B — the same map, the same questions, the second host:**

```powershell
PS> cmdkey /list
```

```text
Target: TERMSRV/legacy-win-02
Type: Domain Password
User: MERIDIAN\ana
```

```powershell
PS> klist
```

```text
Current Logon Id is 0:0x4a211
Cached TGT  Service: krbtgt/MERIDIAN.LOCAL  Realm: MERIDIAN.LOCAL
            End time: Oct  8 19:02:11
```

```powershell
PS> whoami /priv | findstr /i seDebug
```

```text
(no output — the privilege is not held)
```

Three rows of the inventory, three rejections, three minutes: RDP is not my destination's method;
the TGT authenticates an identity to a host that does not speak Kerberos; the dumpable process
memory belongs to a privilege this workstation never granted her.

Then the row the map did light up:

```powershell
PS> dir $env:USERPROFILE\.ssh
```

```text
    Directory: C:\Users\ana\.ssh

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a---                 10/2/2026   1:44        487 id_ed25519
-a---                 10/2/2026   1:44        412 config
```

```powershell
PS> type $env:USERPROFILE\.ssh\config
PS> ssh-keygen -y -f $env:USERPROFILE\.ssh\id_ed25519
```

```text
Host prod-app
    HostName 10.20.4.31
    User ops
    IdentityFile ~/.ssh/id_ed25519
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI...fQ9
```

Same hostname, same user, same key material as branch A — one fingerprint apart from the same
key. And the proof:

```powershell
PS> ssh -o BatchMode=yes ops@prod-app id
```

```text
uid=2001(ops) gid=2001(ops) groups=2001(ops),100(users)
```

Her `.bash_history` check and her PSReadLine check both returned what residue usually returns —
commands, no secrets. Residue is a check, not a store: it costs thirty seconds, and "empty" is
still an answer to question 3.

**What I could not prove.** Stated rather than buried:

- That nobody noticed. `BatchMode` success is quiet *by the design of SSH*, not by guarantee of the
  SOC; I can see the client side only, and the report says so.
- That the key on `ws-ops-01` is passphrase-less by design rather than by accident. I observed a
  fact, not a policy; had it been protected with no agent in the session, branch B dies at the
  precondition and the estate needs a different door.
- Any claim about reuse. The `.netrc` token and the cron password were *not* tested — testing them
  costs either nothing I need or, on the Windows side, lockout budget. Reuse remains a hypothesis
  with a price on it.
- The contents of her DPAPI vault. Decryptable from her context with tooling I did not run; the
  priority formula put it below one command, so it sits in the report as a lead with its cost
  attached.
- Whether configuration management re-owns `/opt/ops` nightly. I read the mode once, not
  longitudinally — a timestamp next to the finding, not a guarantee.

## In plain terms

A company runs a production system, and you have gotten yourself into two of its rooms. In the
basement, the machines do their work at night, and somebody who set that up left a copy of a key
on an open shelf so the work would not stop — and then nobody ever put the shelf behind a door. In
the upstairs office, a woman keeps her keys in the pocket of a coat that only fits her, and she
also keeps a list of every door whose code she has typed, because nobody can remember forty codes.

You need into a third room, on the top floor. The wrong question is "what valuable things are in
the rooms I am in" — you could search for a week and find twelve things, eleven of which open
doors you already have. The right question comes in three steps, in this order. Which room do I
need? What does its lock want — a key, a code, a face? Then, and only then: which of the rooms I
am in holds that kind of thing? The basement shelf is a key, and the top-floor room wants a key, so
the shelf is worth forty seconds. The codes in the coat pocket are for other buildings. The list
says so, and you never touch them — not because the codes are worthless, but because the lock in
front of you does not read them.

Two doors you deliberately do not walk through. One needs a keyring belonging to a club you were
never in, and checking takes two minutes and ends the conversation. The other is a guard's desk
where you could probably take something, but doing so would ring a bell under a camera — and the
room you need is reachable without ringing anything.

The habit worth taking: before you open a single cupboard, write down the room you are going to
and what its lock wants. Then open only the cupboards that hold that kind of thing. The tools will
happily hand you a list of every cupboard in the building. Not one of them will tell you which
cupboard holds the kind of lock you are standing in front of.

## Carry-over

The part you can apply to a host neither of us has seen. If you cannot answer all nine, you have
not finished the map — no matter how many secrets the scanner printed.

1. **Name the destination before you touch anything.** The next host or principal, written down.
   No destination → you are collecting, not hunting, and the file list will grow until you stop.
2. **Ask what the destination accepts.** Key, password, ticket, token, live session. This answer is
   the filter, and it is the only input that decides which of the forty storage locations exist
   *for you today*.
3. **Open only the classes the filter lights up.** On Linux: `~/.ssh/` and automation-parked keys,
   history, `.pgpass`/`.netrc`, cron and unit files, token dotfiles. On Windows: her `.ssh`,
   `cmdkey /list`, DPAPI blobs, `klist`, PSReadLine history, task and service configuration. The
   rest of the checklist is real and irrelevant until the destination says otherwise.
4. **For each candidate, write whose authority it carries.** The principal behind the secret, and
   what that principal legitimately reaches. A high-value secret for a low-authority principal is a
   sideways move wearing a disguise.
5. **Price the test before you run it.** SSH keys fail silently and cheaply; wrong Windows
   passwords cost lockout budget and write events; tokens can be revoked under someone's fingers.
   The quiet test goes first, always — noise belongs in the denominator.
6. **Run the five questions per candidate.** Actor, precondition, primitive, consequence,
   objective. Unknown consequence = lead, not finding.
7. **Reject on a written criterion, and keep the log.** *Translates*, *precondition*, *objective*,
   *cost of proving* — every rejection above names its criterion. The rejection log is what makes
   the surviving path chosen rather than stumbled into.
8. **Record what you could not prove.** Whether anyone saw it, whether the perm is managed, whether
   a secret is reused — each is a hypothesis with a price, and the report should show the price.
9. **Write the triple, not the finding.** Destination × host × identity. Three different sentences
   get three different remediation speeds; only the third is a lateral movement assessment.

Where this does not reach: it treats the initial foothold as given — how `deploy` or the session
was obtained is another article, and so is privilege escalation on either host (a root shell that
does not authenticate anywhere is not a credential). It says nothing about Active Directory as a
system — delegation, certificate services, and domain-wide attacks are a different map with the
same first question. It covers the crossing, not the objective behind it: what you do once you are
`ops` on `prod-app` is out of scope. It assumes time — at the ten-minute mark a scanner's file
list beats a human at *finding candidates*, and that is fine: run it, but as an input to the map
above, never as a replacement for question 2. And it is deliberately quiet-first: an environment
with no SOC and no lockout policy changes the denominator, not the order of the questions.
