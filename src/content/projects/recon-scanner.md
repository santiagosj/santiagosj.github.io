---
title: "Automated Recon & Vulnerability Scanner"
description: "Automated reconnaissance pipeline for web pentesting. Orchestrates subfinder, nmap, httpx, ffuf, and nuclei in phases, configurable via YAML, with structured JSON output."
category: "Automation"
team: "Red Team"
tags: ["Python", "Bash", "subfinder", "httpx", "nuclei", "ffuf"]
featured: false
date: "2024-01-01"
timeline: "2 months (2024)"
---

Automated reconnaissance pipeline for web pentesting. Orchestrates multiple tools in phases:
subdomain enumeration (subfinder, assetfinder), port scanning (nmap, masscan), technology
fingerprinting (httpx, wappalyzer), directory brute-forcing (ffuf, dirsearch), and vulnerability
scanning (nuclei). Fully configurable pipeline via YAML, with structured JSON output for
integration with other tools.

## Challenges

- Orchestrating tools with different output formats
- Avoiding rate limiting and detection during scanning
- Prioritizing critical findings on large targets

## Takeaways

- Complete automation of the reconnaissance phase
- Unified JSON output for CI/CD pipelines
- Modular configuration per assessment type
