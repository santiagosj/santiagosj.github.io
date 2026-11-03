---
title: "Blinding the guard: EDR telemetry and the foundations of its evasion on Windows"
description: "An EDR's user-land hooks are the part of its telemetry you can remove, and the part that sees the least. How I decide whether an evasion technique is worth writing — worked end to end on a fictional sensor, including the three candidates I threw away and the criterion that killed each."
category: "Method"
tags: ["EDR", "Windows", "Evasion", "Red Team", "Purple Team", "Syscalls"]
featured: false
date: "2026-11-03"
---

There is a genre of EDR writing that goes: here is `NtAllocateVirtualMemory`, here are its first
five bytes, here is how to put them back. It is correct, it is on every blog twice, and it teaches
one wrong idea — that the hook is the wall.

The hook is not the wall. The hook is a tripwire that a vendor installed inside *my* address space,
on a page my process already owns. Cutting it is not the interesting part, and it never was. The
interesting part is what is still watching after the cut.

So this is not a technique writeup. There is no machine here and no product: the sensor below is a
specification I wrote for this article, described by behaviour rather than by name, because a
product name dates an article and a behaviour does not. What transfers is the map — **which layer a
technique removes, and which layer that same technique wakes up.** That map has been the same shape
for every commercial sensor I have looked at from the outside, and that is the only reason it is
worth publishing.

## The question

Which side of the ring boundary is the sensor actually watching — and does blinding one side count
as evasion?

The honest answer is that the question is malformed, and that is the useful part. "User land or
kernel" only helps if the two are alternatives. They are not: they are a producer and a consumer of
the same event, written at two different moments, by two different pieces of software, with
different amounts of trust in the process being observed. Once you see that, the real question is:

> If I remove the component that inspects my calls, **what is left that still sees me** — and is
> the signal produced by removing it louder than the signal it deleted?

That question has a yes/no answer for every technique, and it forces a tradeoff instead of a
checklist. If you can answer it, you stop collecting tricks and start choosing them. If you cannot,
you end up with a lab full of bypasses that all worked in a lab.

After reading this you should be able to take any user-land evasion technique and fill in two
columns: *which sensor it removes*, and *which sensor it creates*. A technique that cannot fill in
the second column is not evasion. It is a reflex.

## The target model

The target is `sensor`, a fictional endpoint detection agent on a managed Windows workstation. It
exists because the thing it hunts — a sequence of syscalls executed by a process whose file never
touches the wire — is invisible to anything sitting at the network edge. That single constraint
decides everything else about its shape.

The job, decomposed honestly:

- **Actors.** Me: an unprivileged process with code execution, no administrator, no driver. The
  agent: a signed DLL mapped into every new process before its first thread runs. The driver: a
  signed kernel component with notification callbacks and a file-system minifilter. The console: a
  server I cannot reach. The analyst: the person who reads whatever survives all of the above.
- **Assets that matter.** The telemetry stream, because its integrity is the defender's whole
  product. The reference copy of `ntdll` on disk, because every integrity check in the design is a
  comparison against it. And my own address space — which I own by the same property law that lets
  a process free its own memory, and which is therefore the one part of the sensor's world I am
  allowed to edit.
- **Layers.** Four, and they fail differently: user-land hooks inside my process, kernel callbacks
  in Ring 0, ETW providers writing from the kernel, and a scanner that periodically re-reads image
  pages and diffs them against the file they claim to be.

Read that list again and notice where the hooks are. They are the only layer that lives on a page
my process can write to.

```text
[ my process ]
      |
      v  calls NtAllocateVirtualMemory
[ ntdll!NtAllocateVirtualMemory ]      <- first 5 bytes replaced
      |
      +--> jmp sensor.dll+0x1a2c0 ---> [ agent: inspect arguments, decide ]
                                                     |
                                                     v  if allowed
                                            [ ntdll stub body: syscall ]
                                                     |
                                                     v
                                            [ kernel ]
```

> **Plain terms**
> Each office in the building keeps its own copy of the rulebook, and on the first page of every
> copy the guard has stamped "ask me first". When a clerk wants something from the archive, he reads
> his office's page, walks to the guard, and the guard decides. The stamp only exists in the copies.
> The original in the basement is untouched — and the office, after all, belongs to the clerk.

## The surface criteria

I score a component as attack surface if **any** of these holds. Not all — any. One is enough for a
row in the inventory.

| Criterion | The question it answers here |
| --- | --- |
| **Reachable** | Does it live in memory my process can write? |
| **Translates** | Does it take my call and turn it into a decision? |
| **Brokers trust** | Does something downstream act on its output without checking it? |
| **Holds authority** | Does it hold a privilege the rest of the chain assumes it has? |

The last one is the column that separates a tripwire from a wall. `PPL` protection, the driver's
signature, the ETW consumer — that is authority, and authority is not reachable from Ring 3. You do
not attack it; you route around it. Everything in the next section that survives is a route, not a
breach, and that distinction is why the article has a fourth section at all.

The first criterion is the one people get wrong when they read about this subject. "Reachable" is
not "the EDR is on the box". It is "this specific page is mapped writable in my process". By that
reading, exactly one of the four layers is reachable from where I stand, and the other three are
context.

Which gives a formula, because a rubric that ranks nothing is a list:

> **Evasion value ≈ detections removed ÷ new observables introduced × coverage of the objective**

The denominator is the whole article. Removing a hook costs one protection change and, depending on
how you get the clean bytes, one file read or one section map — and those happen at layers that are
not mine to edit. The numerator is cheap to overestimate and the coverage term is the honest one: a
technique that blinds the argument inspector while leaving the allocation event intact covers half
of the objective, and half is not the objective.

> **Rejected**
> `console` — the sensor's management plane. Passes **Holds authority** and nothing else. It is
> reachable over TLS with a credential I do not have, it decides nothing about my process in real
> time, and it only ever sees what the endpoint already chose to send. It is a target for a
> different engagement with a different actor. It stays in the notes and it does not get an hour.

## The inventory

Seven rows, and the rubric is what earned each one.

| Element | Purpose | Talks to | Trust boundary | Fails into |
| --- | --- | --- | --- | --- |
| `ntdll` (in process) | The sanctioned door from Ring 3 to Ring 0; every Native API is a stub of four instructions | my process, the gate | **My process owns the page; the sensor edits a copy it does not own** | a stale reference, an integrity alarm |
| `agent` (sensor DLL) | Inspects arguments and call stacks before the call crosses | my process, driver, console | It runs inside a process whose memory I can write | a hung process, a bypassed check, a tamper alert |
| `driver` (Ring 0) | Process, thread, image and object callbacks; minifilter on file and network IO | kernel, agent, console | It sees the syscall **after** it crosses, with no idea who issued it | a telemetry gap, rarely a crash |
| `providers` (ETW, kernel side) | Streams image loads, allocations and protection changes as they happen | kernel, consumers | The producer is not in my process; only the consumer is, and it is protected | dropped events, a blind spot |
| `scanner` | Re-reads loaded image pages and diffs them against the on-disk copy | my process, `disk` | It trusts the disk as the reference | false positives on JIT, or silence when both sides are edited |
| `disk` (`System32\ntdll.dll`) | The untouched reference every integrity check compares against | everyone | **It sits outside the process boundary and is world-readable** | a stale reference after an update |
| `ppl` (protected process) | Makes the agent unkillable from user land | kernel, agent | Signing, enforced by the kernel | no sensor at all |

Two columns carry the table, as always. **Trust boundary** names the assumption nobody verifies —
and here it is stated twice, in opposite directions: the agent assumes a page it does not own, and
the scanner assumes a file I can read. **Fails into** tells you what the owner hardened: a vendor
that ships a protected process has already paid for the "kill the agent" path, so that path is
expensive on purpose and cheap to predict.

Notice what is *not* in the table. No product, no version, no CVE, no hook offset. A hook offset is
a fact about one build on one Tuesday. The layer the offset lives in is a fact about the design, and
the design is what generalises.

## From element to vector

A vector answers five questions. The fifth is the one that keeps the other four honest.

1. **Actor.** Who am I right now, with what access?
2. **Precondition.** What must already be true for this to work?
3. **Primitive.** What single capability does it hand me?
4. **Consequence.** What does that capability unlock next?
5. **Objective.** Does that move toward the goal, or only make noise that sounds like progress?

Also, in this domain, a sixth that is not in the template but belongs here: **what does it cost?**
Not in hours — in new observables. An evasion that works and is detected has a name: a detection.

> **Plain terms**
> The guard checks every clerk, but each office keeps its own copy of the rulebook, and the office
> belongs to the clerk. So there are only two honest moves. You can restore your own copy to the
> pristine wording — the guard's stamp disappears, and so does his chance to read the page before
> you act. Or you can skip the rulebook entirely, walk to the archive door and open it with your own
> hands. The first is legitimate because it is your office. The second works because the door never asked
> for a form. Neither one turns off the camera above the door, and the camera is not plugged into
> anything in your office.

### Candidate A — restore the page (API unhooking)

- **Actor** — an unprivileged process with code execution. No administrator, no driver, no signing.
- **Precondition** — the sensor hooks *my* copy of `ntdll` (true by construction), and the on-disk
  copy is readable (true unless the vendor breaks every loader on the box to stop me).
- **Primitive** — my process's `.text` returns to the vendor's reference bytes. The analyser is gone
  from my address space, and it left no trace in the page it used to occupy.
- **Consequence** — from that point, every Native API call I make goes straight to the gate, with
  arguments nobody inspected.
- **Objective** — run the next stage without the argument inspector reading it. Yes, and only that.

```text
1. [ my process ] --read--> [ disk: System32\ntdll.dll ]        clean reference
2. [ my process ] --map section, copy .text--> [ ntdll in memory ]   the stamp is gone
3. [ my process ] --call--> [ kernel ]                          no agent on the path
```

The sketch, and only the sketch — this is four lines of a mechanism, not a tool:

```c
NtOpenFile(&h, FILE_GENERIC_READ, &path, ...);                    /* clean copy from disk */
NtCreateSection(&s, SECTION_MAP_READ, NULL, NULL, PAGE_READONLY, SEC_IMAGE, h);
NtMapViewOfSection(s, self, &clean, 0, 0, NULL, &sz, ViewShare, 0, PAGE_READONLY);
/* NtProtectVirtualMemory on ntdll .text, then memcpy the pages, then put it back */
```

**What it costs.** The page-level result is perfect: after the copy, my `ntdll` is byte-identical to
the file, so an integrity scanner that diffs pages against disk finds exactly what it expects to
find. That is the strength of the technique and it is real.

The cost is not in the page. It is in the two syscalls that got it there. Changing protection on an
image page is an event. Reading `System32\ntdll.dll` from a process that is not a loader is an
event. Mapping `\KnownDlls\ntdll.dll` instead of reading the file removes the second event and adds
a different one — a section handle in a process that has no reason to hold it.

So the honest version of Candidate A is: it is worth writing when the second stage is clean enough
that those two events are the only footprint left. If the payload was already loud, restoring the
page buys nothing and adds a story.

### Candidate B — skip the door (direct syscalls)

- **Actor** — same process, same access.
- **Precondition** — I know the syscall number for the function on this build, and I can emit a
  `syscall` instruction from my own code.
- **Primitive** — the gate executes my request with no user-land stub on the path at all.
- **Consequence** — nothing in my process can inspect the call, because nothing in my process is
  between me and the kernel.
- **Objective** — same as A, minus the last thing A still depended on: the bytes of `ntdll`.

```text
[ my process: asm stub, SSN embedded ]
        |
        |  (ntdll and its hooks are not on this path)
        v
[ syscall ] --> [ kernel, Ring 0 ]
```

```asm
; direct syscall, x64
NtAllocateVirtualMemory PROC
    mov r10, rcx
    mov eax, 18h        ; syscall number — this build only, not an API contract
    syscall
    ret
NtAllocateVirtualMemory ENDP
```

The number is the whole problem, and it is worth being precise about why. A syscall number is an
implementation detail of a build. The same three functions on the build I resolved them from:

| Function | SSN |
| --- | --- |
| `NtAllocateVirtualMemory` | `0x18` |
| `NtProtectVirtualMemory` | `0x50` |
| `NtCreateThreadEx` | `0xC1` |

Hardcode that table and your payload becomes a time bomb that goes off on a cumulative update.
Resolve it at runtime and you are reading `ntdll` again — which is either the hooked copy (and the
hooks lie about their own number) or the disk copy (and Candidate B now carries Candidate A's cost).
The third path, reading a clean neighbour stub and doing arithmetic, works only while the hooks are
still five-byte jumps. Every escape hatch here is a dependency on the thing you are trying to
escape.

**The refinement, and why it does not close the gap.** On x64 the `syscall` instruction records the
return address in a register the kernel reads on entry. So the kernel knows *where the instruction
was executed from*. If I execute it from my own private page, that address is backed by nothing on
disk. The standard answer is an indirect syscall: keep my stub, but `jmp` into the `syscall`
instruction inside a legitimately loaded `ntdll`, so the recorded address looks like a normal call.
That buys back the instruction pointer. It does not buy back the stack, which still unwinds into my
module, and it still depends on `ntdll`'s layout for the build. It is a better technique, not a
different layer.

### Rejected

> **Rejected**
> `EtwEventWrite` — killed on *objective*. Patching the user-land event writer silences the
> providers that route through it, which is precisely the set that was already inside my process.
> The kernel-side providers do not call it; they write from Ring 0 and hand events to a consumer I
> cannot reach. So the technique is a real primitive pointed at the wrong layer, and its own cost —
> an edited `EtwEventWrite` in a process that is not a debugger — is a well-known tamper signature.
> AMSI patching has the same shape and the same verdict.

> **Rejected**
> Kill the agent, or unload the driver with a signed vulnerable driver — killed on *actor*. The
> agent is a protected process and the driver is loaded at boot with a signature the kernel
> enforces. Getting past either requires a kernel primitive I do not have, and acquiring one turns a
> red-team engagement into something that ends the engagement. It is also the loudest event the box
> can produce. Wrong tool, wrong engagement, wrong signal.

> **Rejected**
> Unlink the module from the PEB, or `LdrUnloadDll` the sensor — killed on *primitive*. It removes
> a line from an inventory, not an act from a log. The image-load callback fired when the module was
> mapped, before I had any code running, and hiding the entry afterwards hides the record from *me*,
> not from the sensor. Three hours here buys a tidier `tasklist`.

Hardware breakpoints on the stub deserve one line, because someone will ask: per-thread, visible in
the thread context, destroyed by the next thread I create, and only useful against the user-land
hook that Candidate B already handles without touching a debug register. Killed on cost.

Two survivors out of five, and the three kills cost me nothing but reading. That is the argument.
The criteria are not there to help you find more techniques; they are there to let you stop.

## Execution

The sensor is fictional, so the events below are too. What is not invented is where each line is
produced: everything in the second half of this section is emitted **after** the call has already
crossed the ring boundary, by something that does not live in my process. Check the provenance of
each block before reading its content; that asymmetry is the article.

**The hook.** The stub as it exists in the file on disk, and the same stub as it exists in my
process. This is the entire attack surface of Candidate A: five bytes.

```text
$ objdump -d -M intel ntdll.dll | sed -n '/<NtAllocateVirtualMemory>:/,+6p'

00000000000a1c40 <NtAllocateVirtualMemory>:
  a1c40:  4c 8b d1              mov    r10, rcx
  a1c43:  b8 18 00 00 00        mov    eax, 0x18
  a1c48:  f6 04 25 08 03 fe 7f 01   test   BYTE PTR ds:0x7ffe0308, 0x1
  a1c50:  75 03                 jne    a1c55
  a1c52:  0f 05                 syscall
  a1c54:  c3                    ret
```

```text
$ (dump of the same address inside my own process)

  00007ff8`1c351c40:  e9 7b 55 0e 00   jmp    00007ff8`a1d107c0  ; sensor.dll+0x1a2c0
  00007ff8`1c351c45:  00 00 00         ...
```

One instruction replaced. `mov r10, rcx` — which carries the first argument into the register the
kernel expects — is gone, along with everything after it, because control never returns to this
page. That is why the technique exists and why it is five bytes wide.

**The cost of A.** The file read that fetches the clean copy:

```text
Microsoft-Windows-Kernel-File / 12  Create
  image     C:\Windows\System32\ntdll.dll
  process   app.exe (6124)   image: false
  options   Synchronous IO Non-Alert, Non-Directory File
```

A user-space program opening the system's own loader from disk is not normal, but it is not unique
either — every JIT, every packer and every installer does something close to it. This is the event
that tells the sensor to look, without telling it what it found.

**The cost of B.** Candidate B removes the hook and produces this, from the kernel side:

```text
Microsoft-Windows-Threat-Intelligence, event 12 (ALLOCVM_LOCAL)
  process        6124  app.exe    private section, unsigned
  base           0x21a4c2f0000      size 0x2000
  rip            0x00007ff61c2a1a2c  app.exe+0x1a2c   <- not ntdll
```

That last field is the technique's fingerprint. On an ordinary call it points inside `ntdll`, at the
instruction after the `syscall`. Here it points into a page that no file on disk backs, and the
event was written by the kernel while my process was blocked in it.

**What did not appear.** No user-land event from the agent, in either candidate — because in the
first case I removed it and in the second it was never on the path. That absence is the success
condition, and it is also the reason the absence is worthless to a defender: you cannot alert on a
log line that was never written. Which is why the two events above, both from layers I cannot edit,
are the ones that carry the detection.

**What I could not prove.** Whether a real product's periodic integrity check re-hooks the page or
alerts on the restore instead of ignoring it. Whether the syscall numbers I resolved survive the
next cumulative update on a real build. Whether the stack walk behind those events would have
escalated to a verdict, rather than just recording an address. Whether the file read alone would
have been enough to stop the next stage on a real console. All four are unknowns, and an unknown in
question 2 is a lead, not a result.

This is the point where a real engagement writeup shows a screenshot. There is no screenshot,
because the target does not exist — and because the interesting output here is not a shell. It is a
log with a hole in it.

## In plain terms

Every office in a large building keeps its own copy of the rulebook, and the guard in the lobby has
stamped the first page of every copy: ask me first.

That stamp is the whole security model, and it has a structural weakness that has nothing to do with
how good the guard is. The stamp is in *your* copy. The office is yours. There is a pristine
rulebook in the basement, and the page it is printed on is exactly the same page — so all you have
to do is swap your copy for a clean one, and the stamp is gone. Nobody broke a lock. You tidied your
own desk.

The other move is cruder and, in a way, more honest. You do not consult the rulebook at all. You
walk past the desk and open the archive door with your own hands. The door was never checking
paperwork; it just opens for anyone standing in front of it. The guard's entire job was to read the
page you were about to use, and you simply did not use one.

Both moves work. That is the part that gets written up, and it is also the part that is only half
the story.

Because there is a camera above the archive door, and the guard does not own it. It belongs to the
building. It films everyone who walks through, it records the time and the badge, and nothing about
it lives in your office — you cannot swap its film for a clean copy, because you cannot reach the
room it is in. The guard's stamp was a convenience, a way of catching things early and cheaply. The
camera is the actual record.

So what did the two clever moves buy? They removed a reader. They did not remove the recording, and
in the second case the camera got a better look: a man walking to the door from an angle no employee
ever walks from. The first move got away with it almost completely, except that to make the swap you
had to open a drawer that nobody opens at that hour, and the camera saw the drawer.

The lesson that transfers out of this building is not "the guard is useless" or "the camera is
enough". It is that a defence which lives inside the thing it is defending can always be edited by
whoever owns that thing — so the only detections worth building are the ones written somewhere the
attacker is not allowed to stand.

## Carry-over

The part you can apply to a sensor neither of us has seen.

1. **Name the layer before you name the technique.** Hook, callback, provider, scanner. Every
   technique in this space subtracts from exactly one layer and adds an observable to another. If
   you cannot name both, you have not finished reading the technique.
2. **Write the denominator down.** Detections removed over new observables introduced. A bypass that
   silences one inspector and leaves a private-page return address in the kernel's own event is not
   obviously a win, and the arithmetic is what tells you.
3. **Check that the reference is outside your reach.** API unhooking works because the clean copy is
   on disk and disk is readable. Every design that compares live state against a stored artifact has
   this problem, and it is worth asking about caches, backups, package mirrors and container images
   too.
4. **Prefer the least anomalous primitive that reaches the same layer.** An indirect syscall through
   a loaded module is a better technique than a naked `syscall` from a private page, not because it
   is cleverer, but because its footprint is a thing that also occurs in innocent software.
5. **Reject on objective, not on difficulty.** If the component you silence is not the component that
   would have seen you, the work is theatre. Patching the user-land event writer is the canonical
   example: real primitive, wrong layer, and a tamper signature as a parting gift.
6. **Keep the kills.** Three rejected candidates with a stated criterion are the evidence that the
   two survivors were chosen rather than stumbled into — and the client's real question is always
   "why did you stop there".

For the other side of the table, the same map read backwards, which is the purple-team version of
this article and the reason it has a conclusion at all. A user-land hook is a tripwire, not a wall,
so a detection strategy that stops at Ring 3 is reading the attacker's copy of the rulebook. What
holds up is telemetry the process cannot edit: kernel notification callbacks for process, thread,
image and handle events; ETW providers that write from Ring 0; a minifilter in front of file IO; and
image-integrity checks that are aware they can be satisfied by a perfect restore. The mature position
is not "detect the technique". It is "make sure the layer you are watching is not the layer the
attacker owns" — and then let the technique be whatever it is this month.

Where this does not reach. It says nothing about techniques that go *through* the kernel instead of
around it — vulnerable signed drivers, hypervisor-assisted sensors, or anything with a legitimate
Ring 0 primitive, where the whole analysis changes because the actor changes. It does not cover the
detection side that lives in memory scanning or behavioural scoring, which can flag a payload
without caring how it called the kernel. It says nothing about `WoW64`, and the x86 path has its own
gate and its own numbers. And the SSN table above is one build's answer; treat it as an illustration
of instability, never as a constant. A method with stated limits is usable; this one ends where Ring
0 begins.
