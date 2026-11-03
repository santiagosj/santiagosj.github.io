---
title: "A SOC Homelab Organized Around Closed Cases, Not Installed Tools"
description: "An end-to-end SOC lab under construction, designed so that each phase closes one real incident —telemetry, detection, response, evidence— instead of accumulating dashboards. In progress: design and skeleton done, V1 not yet deployed."
category: "Detection & Response"
team: "Blue Team"
tags: ["Wazuh", "Suricata", "Sigma", "Detection as Code", "Incident Response", "Threat Intel"]
featured: false
date: "2026-10-27"
timeline: "In progress (2026 - Present)"
githubUrl: ""
liveUrl: ""
---

> **Status: in progress.** The architecture design, the network plan, and the repo skeleton are done.
> The first phase (V1) is not yet deployed. This page documents the *judgment* the lab is built on, not
> incidents that already happened. Once V1 closes its first case, I rewrite it around the lived build,
> like the others.

## The problem

The question this project exists to answer:

> How do I learn to operate a SOC without having a SOC —no real traffic, no budget, no shift team— in a
> way that transfers to an actual shift, instead of ending up as "I installed Wazuh and stared at the
> dashboard"?

The risk isn't technical, it's one of judgment. The typical security homelab is organized by tools: you
install the SIEM, then the IDS, then the case platform, and along the way you assemble an impressive
stack that never closed a single incident. Plenty to screenshot, nothing to reconstruct.

What this lab does **not** do: it does not recreate an enterprise SOC, does not chase volume realism, and
is not measured by how many tools it runs. It is measured by how many incidents it can tell end to end.

## The context

One operator —me, at a terminal— on a residential virtualization host (Proxmox), home-grade hardware,
and a network segmented into VLANs: *management*, *targets*, *attack*, and *malware*, kept apart on
purpose. The only exposure to the internet is a small VPS for the honeypot; the residential IP is never
exposed. Malware is analyzed in its own VLAN, with no route to management.

What it replaces is the "install it and admire the dashboard" homelab: the one that produces telemetry
but no evidence, and that cannot tell you *what happened, how we saw it, how we stopped it*.

> **Plain terms**
> It's a training ground for running security at home. Instead of filling it with famous tools, every
> step has to end with the complete story of one incident —how it was seen, understood, contained, and
> proven— or it doesn't count.

## The constraints

| Kind | Constraint |
|------|------------|
| Hard | A single virtualization host and a residential network. No cloud budget beyond a minimal VPS for the honeypot. |
| Budget | One person's time. Each phase has to fit in 2–3 weeks and leave something closed and demonstrable. |
| Surface | The honeypot faces the real internet and malware is hostile by definition: both are treated as untrusted input, isolated by network. |
| Non-goal | Enterprise volume realism. It does not reproduce millions of events or a team of analysts; I accept that, which is why nothing here says how tuning scales to real volume. |

## The components

The part that carries the decision is not any tool: it's the **vertical phase**. Each one adds the
minimum stack to close *one* case end to end, and exists only if it leaves a deliverable.

| Phase | What it closes (responsibility) | Depends on | Fails into |
|-------|---------------------------------|------------|------------|
| V0 | One SSH event visible end to end (heartbeat) | Wazuh, a Linux server, Kali | No signal that the pipeline works |
| V1 | SSH brute force → detection → block, with evidence | OPNsense, Suricata, Wazuh, Pi-hole | The first incident can't be reconstructed |
| V2 | Compromised endpoint → enriched case → isolation | Zeek, Sysmon, TheHive, Cortex | There's an alert but no response and no case |
| V3 | IOC from MISP → detection and block (detection as code) | MISP, Shuffle, Python exporter | Intelligence stays decorative, not operational |

V4–V7 (external honeypot, vulnerability management, malware/DFIR, and portfolio close-out) follow the
same rule, but the **committed MVP is V1 + V2 + V3**: three closed cases before expanding.

## From requirement to design

The clash is between two constraints: I want to learn many disciplines (SIEM, IDS, CTI, response, DFIR)
and at the same time each stretch has to leave something finished within a few weeks, with one operator.

**Rejected — organize by layer (horizontal).** "First the network, then the SIEM, then the cases, then
the intelligence." Fails on *budget* and on *deliverable*: you spend weeks installing without a single
closed incident, and if the project is abandoned halfway —the fate of nearly every homelab— nothing is
left to show or to reconstruct.

**Rejected — chase volume realism.** Generate massive traffic to look like a real environment. Fails on
*budget* (it eats the hardware) and on *non-goal*: it adds no judgment, only noise.

**Chosen — vertical phases with one closed case per phase, and evidence before dashboards.** Each phase
cuts through every layer to close a concrete incident and leaves four things: a case study, a versioned
detection, a runbook, and a metric. If the incident can't be reconstructed, the phase isn't done, no
matter how good the dashboard looks.

> **Plain terms**
> I chose to finish short, complete stories rather than leave many tools half-installed. I gain something
> demonstrable at every step and the freedom to walk away without losing it all; I give up the feeling of
> "having the full stack" before closing the first case.

An operational decision that comes with it: **human in the loop.** Nothing blocks on its own without an
allowlist and approval. It's deliberately slower, because the goal is to learn to decide, not to automate
a block I later can't justify.

## Implementation

What exists today is the **skeleton that pins the decisions**, not the incidents. Built so far:

- Architecture design, network/VLAN plan, and base inventory.
- Case, detection, and playbook templates, so every phase is comparable.
- Preflight scripts (read-only) and case-creation scripts.

What keeps phases comparable is the **conventions**, not the tools: stable names (`V1-SSH-001`,
`CASE-2026-001`), UTC/ISO 8601 timestamps, evidence *sanitized* before commit (raw captures and public
IPs live outside Git), secrets only in a local `.env`, and every meaningful change paired with an ADR or
a note in `docs/`.

```text
docs/          architecture, network, inventory, metrics, ADRs
phases/        one folder per vertical phase, with its case and closing criteria
detections/    Sigma, Suricata, Zeek, Wazuh — versioned
playbooks/     response procedures
evidence/      sanitized evidence (raw stays out of Git)
```

Pending, and stated plainly: **V1 is not deployed.** There is no closed case against real telemetry yet.
The repo's checklist says so without dressing it up.

## In plain terms

Someone builds a training ground to learn how to defend systems. The temptation is to gather a pile of
well-known tools and admire the panels that light up. This lab refuses that: every step has to end with
the complete story of one incident —how it was seen, how it was understood, how it was stopped, and how
it is proven— or it doesn't count.

For now the blueprint and the scaffolding are there; the first real incident hasn't been run yet. What
that discipline buys is that, when it's shown, it shows judgment and not a shopping list.

## What I'd do differently

**Carry-over.** Organize learning around *closed deliverables*, not tools. Before starting any lab, ask:
what is the smallest case I can close end to end, and what evidence proves it? If a phase doesn't leave a
reconstructable incident, it isn't finished. "Evidence before dashboards" is the short version.

**Limits.** This still proves **design judgment, not operational capability.** Nothing here is validated
against a real attack: the detections have not seen genuinely hostile traffic and false-positive tuning
has not been measured. Until V1 is deployed, this page shows *how I think about the problem*, not that I
solved it.

If I started again, what I'd cut is the temptation to draw the full stack (V1–V7) before closing V1. That
is exactly why the scope is already committed to three phases as an MVP: the most honest way to avoid
mistaking an ambitious plan for finished work.
