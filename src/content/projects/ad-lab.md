---
title: "An AD Lab for OSCP, and the Process of Building It"
description: "A three-VM Active Directory range built to rehearse the 40-point AD set: what the exam actually asks for, what the lab grows beyond it, and the build problems that shaped the design."
category: "Pentesting"
team: "Red Team"
tags: ["Active Directory", "OSCP", "Vagrant", "libvirt", "PowerShell", "ligolo-ng"]
featured: true
date: "2026-10-03"
timeline: "Ongoing (2024 - Present)"
githubUrl: "https://codeberg.org/santiagosj/AD-Hacking-Lab"
---

The exam is three standalone machines plus one Active Directory set of three machines. The AD set
is worth 40 of the 100 points and it is assumed breach: credentials for a low-privileged domain
user are handed to you at the start, along with the DC's address. Seventy points to pass. That
shape is the reason this lab exists.

You cannot rehearse on the exam. You get one attempt at that AD set, and the difference between
recognising a path in four minutes and spending forty on it is most of a machine's worth of points.
A home lab is the only place where the cost of being wrong is an evening.

So the question this project answers is:

> Which exam techniques have to be present and reliable every single time, and which of them am I
> allowed to be slow about because they will not decide the exam?

Everything below follows from that. The lab is not realistic and does not try to be. It is
*repeatable*, and it is scoped to the exam's own list, with a small overflow I am explicit about.

## The context

One operator, one Linux host that is simultaneously the hypervisor and the attacker, three VMs:

| Host | Role | Interfaces | Exam role it stands in for |
|------|------|-----------|---------------------------|
| `DC01` — Server 2019 | Domain controller for `oscp.exam` | internal `10.10.172.140` | Machine 3 — the DC, `proof.txt` |
| `MS01` — Server 2019 | Dual-homed web/app server | DMZ `192.168.56.141`, internal `10.10.172.141` | Machine 1 — foothold and pivot source |
| `MS02` — Windows 10 Enterprise | Internal workstation | internal `10.10.172.142` | Machine 2 — lateral movement target |

Three machines, 2 GB and 2 vCPU each, all three addressing the shape of the exam's AD set: foothold,
pivot target, domain controller. The starting position is one low-privileged domain account.

One deliberate difference from the exam, because pretending otherwise would be dishonest: the exam
hands you credentials and you are already inside. This lab starts you outside with nothing and makes
you earn the inside. That is stricter than the exam on purpose. The exam will not let me rehearse the
approach, and a home lab is the one place where the expensive mistake is affordable. Pivoting is also
separately examinable, so the tunnel is not decoration here — it is the part of the chain I most
wanted to stop thinking about.

## The constraints

| Type | Constraint |
|------|-----------|
| Hard | The host *is* the hypervisor. libvirt puts the host on every bridge it creates, and Vagrant needs a management network to provision over WinRM. |
| Hard | Windows guests reboot several times during provisioning, and Vagrant's default WinRM timeout assumes one machine booting alone. |
| Budget | 6 GB of RAM across three VMs on one workstation. A reset has to fit in an evening. |
| Surface | The lab's own conveniences must not become the path I walk. A firewall rule that isolates the range but also kills the pivot teaches exactly the wrong lesson. |
| Scope | The exam's AD list is the specification. Anything outside it is an extra, and extras have to be labelled as extras. |
| Non-goal | Realism. Single forest, no trusts, planted misconfigurations, no telemetry. |

### Exam scope versus everything else

The current focus list for the AD set is roughly: AS-REP roasting, Kerberoasting, password spraying,
ACL abuse (`ForceChangePassword`, `GenericAll`, `GenericWrite`, `WriteOwner`, `WriteDACL`), ADCS with
`certipy-ad` for ESC1 and ESC8, `SeImpersonate` to SYSTEM via a potato, `SeBackupPrivilege` NTDS
dumps, Pass-the-Hash and Pass-the-Ticket, `secretsdump`, DCSync, MSSQL abuse, and pivoting. Above that
line sit unconstrained-delegation printerbug chains, deeper ADCS chains, `BadSuccessor` and dMSA.

Mapping the lab against that line is uncomfortable in one direction and reassuring in the other:

| Planted or planned | Status |
|--------------------|--------|
| SPNs on three service accounts | In scope. Session complete. |
| Account with no pre-authentication | In scope. Collection works, cracking still pending. |
| Pass-the-Hash between machines | In scope. Session complete. |
| `SeImpersonate` on `MS01` → SYSTEM | In scope. Session complete. |
| Mimikatz credential extraction | In scope. Session complete. |
| Pivoting over ligolo-ng | In scope. Exercised constantly, which is the point. |
| `ForceChangePassword`, `GenericAll` on the IT OU | In scope. Seeded, sessions not yet run. |
| DCSync rights on one account | In scope. The intended finish. |
| MSSQL on `MS02` with `xp_cmdshell` | In scope. Seeded, session not yet run. |
| BloodHound collection and shortest-path queries | In scope. Session not yet run. |
| Unconstrained delegation on `MS01` | **Beyond** the core line. Kept because it is how I want to understand printerbug chains. |
| RBCD `MS01$` → `MS02$` | **Beyond.** This one earned its place — see below. |
| ADCS / `certipy-ad` ESC1 and ESC8 | **In scope and absent.** No CA exists anywhere in the three VMs. This is the real gap. |

That last row is the honest one. The exam expects ADCS drills and my lab cannot rehearse them,
because I never stood up a certificate authority. Everything else on the list is either built or
planned; that one is missing, and it is not a rounding error — `ESC1`/`ESC8` are the kind of finding
that a single enumeration command surfaces and a long chain does not.

Two of the extras became more valuable than I expected. RBCD matters because it turns a Windows-only
path into a Kerberos one, which is exactly the pivot I wanted to rehearse. Unconstrained delegation
is on the overflow list, so it stays labelled as an extra rather than quietly inflating the lab's
apparent coverage.

## The components

| Component | Responsibility | Fails into |
|-----------|----------------|-----------|
| `Vagrantfile` | Three VMs, three libvirt networks, fixed MAC per private network | Provisioning configures the wrong NIC |
| `scripts/provision/dc/*.ps1` | Promote the DC, seed users, SPNs, ACLs, delegation, RBCD | No attack paths exist at all |
| `scripts/provision/ms01/*.ps1` | Dual-homed addressing, domain join, web services, `SeImpersonate` | The entry point does not work |
| `scripts/provision/ms02/*.ps1` | Internal addressing, join, post-exploitation artifacts | Credential and SAM paths are silently absent |
| `scripts/02_deploy.sh` + `provision.ps1` | Phase order across VMs, wait for WinRM across reboots | A half-provisioned forest that looks fine |
| `scripts/host/isolate_internal.sh` | nftables: block host → internal, scoped to the libvirt interface | I skip the pivot entirely |
| `scripts/host/ligolo_tunnel.sh` | Diagnose and fix TUN versus connected-route precedence | Tunnel is "Online" and carries nothing |
| `tools/evil-winrm-ruby33-fix.rb` | Vendored client patched for Ruby 3.3 | Every session starts with a crash |
| `docs/*` | Routing reference, issue log, lab snapshot | Knowledge stays in my head, and drifts |

## From requirement to design

The pivotal decision is how to make the internal network unreachable from me without breaking the
tunnel that is the only way to reach it. Both requirements are non-negotiable and they pull in opposite
directions, which is what makes this a design problem rather than a configuration task.

**Rejected — remove the host address from the internal bridge.** The constraint that killed it:
libvirt's bridge exists *so the host can reach the guests*, and Vagrant's WinRM management plane
depends on exactly that. There is no host-less bridge in this model. Hand-editing the network XML is
also not durable, because Vagrant recreates libvirt networks on every `vagrant up`.

**Rejected — filter by destination CIDR.** This satisfies isolation and quietly kills the pivot,
because the tunnel's whole job is to make the host emit genuine packets toward `10.10.172.0/24`
through the TUN device, and a rule saying "drop traffic to this destination" catches those too:

```bash
# What I wrote first. Isolation: perfect. Pivot: dead.
nft add rule inet lab-isolate output ip daddr 10.10.172.0/24 drop
```

The failure mode is nasty because the tool lies. ligolo-ng reports the tunnel `Online`, its TX counter
climbs because it really is transmitting into a black hole, RX never moves, and `nmap` calls every
internal host `filtered`. I spent a long stretch convinced the tunnel was broken. The tunnel was fine.
My own firewall was eating it.

**Chosen — scope the rules to the libvirt interface.** Match on the path, not the destination:

```bash
nft add rule inet lab-isolate input  iifname "virbr3" ip saddr 10.10.172.0/24 drop
nft add rule inet lab-isolate output oifname "virbr3" ip daddr 10.10.172.0/24 drop
```

Every legitimate use of that destination leaves through a different interface. Only the direct route
exits via `virbr3`. The host's own input/output hooks see host traffic and not bridge L2 forwarding,
and not what `MS01` forwards on my behalf, so the pivot survives untouched. The bridge is also
detected by the address it carries rather than hardcoded as `virbr3`, because bridge numbering follows
creation order and shifted every time I added a network.

> **Plain terms** I locked the gate to the main building, then broke my own key. The rule I wrote
> first was "nothing goes to that address" — true, and equally true of the tunnel I was meant to use
> to get there. The tunnel kept saying CONNECTED, because from where it sat it really was handing
> packets over and watching them disappear. What fixed it was asking a narrower question: not *where is
> this packet going* but *which door is it leaving through*. One door is locked. The tunnel uses
> another. Both are true at once, and now they are.

**Second collision — the management plane.** Vagrant provisions over `192.168.121.0/24`, which is a
second road from the host straight into the internal machines. Closing it breaks `vagrant up`. Rather
than compromise one requirement, this became a documented toggle: `--mgmt` opens the road for lab
lifecycle, isolation is on by default for attack sessions. It has to be re-applied after a
`vagrant up`, which is exactly the kind of sharp edge that belongs in a README and not in memory.

**Third — the connected route outranks the tunnel.** Even with correct rules, traffic still left via
the bridge, because libvirt gives the host `10.10.172.1/24` on `virbr3` and the kernel installs that
as a connected route at metric 0. When ligolo adds its route for the same prefix it either fails or
loses. So the fix is to ask the kernel which device it would actually use, and read the answer
precisely — three outcomes, not two:

```bash
ip route get 10.10.172.140
# via the TUN    -> correct, traffic will be tunnelled
# dev virbr3     -> wrong, still direct, this is the metric-0 route shadowing the TUN
# via gateway    -> worse, traffic is leaving the host, the isolation is not holding
```

The third verdict is the one that matters. "Tunnel broken" and "isolation broken" look identical from
`nmap`, and only the routing answer distinguishes them. Delete-then-re-add is session-scoped on
purpose: after `vagrant up` the connected route returns, and I would rather the environment tell the
truth than have a stale fix hide a broken state.

## Implementation

### How it came up

The Vagrantfile was the easy part and it took the longest to get boring. Three VMs, libvirt with
VirtualBox as fallback, and three separate networks — DMZ, internal, and Vagrant's own management
network that I would later spend a lot of effort pretending does not exist.

The part that was not boring was WinRM. Three Windows machines rebooting across promotion and domain
join, all in parallel, is well past what Vagrant's defaults assume. The fix was unglamorous and
effective: a boot timeout of 1200 seconds and forty connection retries fifteen seconds apart, which
buys ten minutes of the guest actually answering.

Then the network. Fixed twice — once for the isolation rules, once for the route precedence — and the
two commits in the history are both that same problem from different angles. This is the honest shape
of the build: the domain came up fairly smoothly and the network fought me the whole way.

Ordering and idempotency came next, because three VMs rebooting across nine phases is where "works on
my machine" is born. Phases are ordered, cross-VM dependencies are explicit, and NIC configuration is
keyed off the MAC pinned in the Vagrantfile rather than enumeration order, which is not stable on a
freshly imaged box:

```powershell
$dmzMac      = "52:54:00:ad:00:11"
$internalMac = "52:54:00:ad:00:12"

$adapters = @(Get-NetAdapter |
    Where-Object { $_.Status -eq "Up" -and $_.InterfaceDescription -notlike "*Loopback*" } |
    Sort-Object ifIndex)

$dmzAdapter      = $adapters | Where-Object { $_.MacAddress -eq $dmzMac }      | Select-Object -First 1
$internalAdapter = $adapters | Where-Object { $_.MacAddress -eq $internalMac } | Select-Object -First 1
```

Position-based selection survives as a fallback for VMs predating the pinned MACs, which is the honest
version of "it works either way". The dual-homed DNS split is the quiet load-bearing detail: the
internal adapter gets a lower interface metric so `dc01.oscp.exam` resolves through the DC instead of
the management network's resolver. Get that backwards and Kerberos name resolution goes strange in
ways that look like a Kerberos problem.

### The parts that fought back

**A tool that crashed every session.** Kali's Ruby had moved to 3.3, which uses Reline, and evil-winrm
assumed a `Readline.line_buffer` string. Under Reline it returns `nil`, and the client died on the
first prompt. No upstream release fixed it, and Kali ships only one version. I patched the binary and
vendored it in `tools/`. The part worth remembering is that only one call site was genuinely broken —
the others were already nil-safe, because `nil =~ regexp` evaluates to `nil` rather than raising. I
read the code instead of shotgun-patching every occurrence.

**A dump that returned nothing, and looked like a tool problem.** Mimikatz's `sekurlsa::logonpasswords`
came back empty on `MS01` while everything else worked, which is exactly the shape of "wrong tool". It
was not the tool. The service-based method for simulating interactive logon keeps dying because a
service whose binary is `cmd.exe` gets terminated by the SCM, and `sc.exe` will not grant
`SeServiceLogonRight` to a domain account. The replacement is a scheduled task plus an explicit rights
grant, reached through a small P/Invoke since PowerShell has no LSA policy handle binding of its own:

```powershell
Add-Type @"
[DllImport("advapi32.dll", SetLastError = true)]
static extern uint LsaAddAccountRights(IntPtr PolicyHandle, byte[] AccountSid,
    LSA_UNICODE_STRING[] UserRights, uint CountOfRights);
"@
```

**A protection I documented as off that was on.** Provisioning disabled Defender's real-time
monitoring on `MS02`. On Windows 10, Tamper Protection silently reverts that, and
`-ErrorAction SilentlyContinue` swallowed the failure — the provisioning log said done while the
opposite was true. The same command sticks on `MS01`, because that is Server 2019. So the lab was
internally inconsistent and the inconsistency was invisible from the logs.

I could not beat it. The policy call returns `E_NOTIMPL`, registry writes are denied even as local
admin, and a scheduled task running as SYSTEM was reverted anyway. So the objective changed. Instead
of *disable the antivirus*, the lab now guarantees a persistent exclusion and lets real-time protection
stay on:

```powershell
Add-MpPreference -ExclusionPath 'C:\Users\celia.almeda\Documents'
```

A binary deposited there runs; the same binary anywhere else is blocked by signature. That is closer
to a real engagement anyway, where the AV is on and you have to work with it.

**Drift, which is the lesson I keep coming back to.** Later the lab stopped matching its own snapshot.
A credential file documented in a shared folder did not exist. A `windows.old` tree for offline SAM
dumping was gone. A provisioning log was unreadable. WMI queries returned access denied.

The root cause was my own seeding script. It wrote PowerShell history and sticky notes using the
`APPDATA` of *the account running the provisioning* — which over `vagrant winrm` is `vagrant` — not the
account I log in as. The artifacts existed. They were in the wrong user's house. One ACL on
`C:\Users\Public` was also non-default, so a directory listing denied a token that had every right to
be there.

Fixing it live meant going in over the internal NIC with local admin, because the management WinRM port
was down. Restoring the `Public` ACL, recreating the file, and rebuilding the registry hive backup got
the snapshot and the machine agreeing again.

> **Plain terms** I spent real time reading my own notes and believing them. The antivirus was written
> down as off. It was on. A credential file was written down in a shared folder. It was not there,
> because it had been written into the account that set the place up rather than the account I was
> sitting in. And a folder that should have been readable by everyone was not, because nobody had ever
> looked at its permissions. Reading my documentation felt like progress and was closer to the
> opposite. What I actually needed was a check that fails loudly, not a description that reads well.

## In plain terms

It is a training ground with a main building and a shed out front. They hand me a key to the shed and
lock the gate to the building, and the whole job is making sure the lock is real.

The part I got wrong first was how I locked it. I wrote the rule as "no packets go to the building's
address", which is true and also true of the tunnel I was supposed to use to get there. The tunnel
kept reporting CONNECTED, so for a long time I blamed the tunnel, the TUN driver, the proxy, the
subnet. None of them were broken. My own lock was sitting on the key.

The fix was to stop asking *where is this packet going* and start asking *which door is it leaving
through*. One door is locked, the tunnel uses another, and both statements can be true at once — which
is the thing I could not see while I was only thinking about addresses.

The second thing the lab taught me is about scope. I planted a dozen attack paths and for a while it
felt like the lab covered the exam. Checking it against the actual list, one significant item was
simply absent: I never built a certificate authority, so the ADCS material I am expected to know has
nowhere to happen. Having the paths is not the same as having covered the list, and only writing the
two side by side showed that.

## What I'd do differently

**Carry-over.**

- Assert the target state, do not describe it. "Tamper Protection is off" is a claim; a check that
  reads the value and fails is a test. The snapshot is a starting point, not a guaranteed state.
- Fail loudly whenever the lab's validity depends on a step. `-ErrorAction SilentlyContinue` on a
  security-setting change is what let a false "Defender off" survive for months.
- Seed artifacts into the account that will read them. Every path problem I hit came from writing
  files relative to whoever ran the setup.
- Write the exam scope table before building, and keep it in the repo. I would have found the missing
  CA in a day instead of at write-up time.
- Pin everything I did not pin. MACs and IPs are pinned; box images and Ruby drifted underneath me.
- Move the per-VM NIC scripts into the box images. They exist only to assign addresses that belong in
  an unattend file, and they are the source of every wrong-adapter bug I have had.

**Limits of what this lab proves.**

- It rehearses recognition, not discovery. Every path here was planted, so I get no practice at finding
  misconfigurations nobody authored — which is the harder half of the job.
- One AD set is not the exam's variance. Single forest, no trusts, no ADCS, so nothing here says
  anything about multi-domain or certificate-based paths.
- No detection layer, so nothing transfers to the blue side. I cannot claim what I did not build.
- Sessions 1 and 2 are genuinely complete. Sessions 3 through 8 are seeded and unrun, so the scope
  table above records intent for most rows, not verification.
- The tunnel fix is session-scoped by design. Every `vagrant up` restores the connected route, so the
  lab can fail in a way that looks like a bug and is actually the lab behaving as intended.