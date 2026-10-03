---
title: "HTB: Linux Privilege Escalation Deep Dive"
description: "Detailed writeup of Linux privilege escalation techniques applied on HTB machines: SUID abuse, capabilities, cron jobs, LPE kernel exploits, and PATH hijacking. Step-by-step methodology with commands and outputs."
category: "HTB"
tags: ["Linux", "Bash", "Python", "GTFOBins", "pspy", "linpeas", "enumy"]
featured: false
date: "2024-01-01"
---

Compilation of writeups focused on Linux privilege escalation from multiple HTB machines. Each
technique documented with: initial system reconnaissance, enumeration of escalation vectors, step-
by-step exploitation, and post-exploitation. Covers SUID/SGID binary abuse, misconfigured Linux
capabilities, cron jobs with writable scripts, LPE via kernel exploits (DirtyPipe, OverlayFS),
PATH hijacking, and sudo rule abuse. Includes real outputs, exact commands, and the reasoning
behind every decision.

## Challenges

- Identifying the right vector among multiple possibilities
- Kernel exploits that require specific versions
- Machines with multiple chained escalation layers

## Takeaways

- 8+ HTB Linux privesc machines documented
- Coverage of 15+ distinct escalation techniques
- Reproducible methodology for any Linux machine

## Timeline

2024 - Present
