---
title: "HTB: Reconnaissance & Enumeration Playbook"
description: "Reconnaissance and enumeration playbook for HTB machines: from initial nmap scanning to deep enumeration of services, users, and vulnerabilities. Automation with custom scripts."
category: "HTB"
tags: ["nmap", "ffuf", "Gobuster", "enum4linux", "smbclient", "searchsploit", "Bash"]
featured: false
date: "2024-01-01"
---

Complete reconnaissance and enumeration playbook to approach any HTB machine methodically.
Documented phases: initial scanning with nmap (top ports, version detection, NSE scripts), web
service enumeration with ffuf and Gobuster, SMB enumeration with enum4linux and smbclient, LDAP/AD
enumeration, vulnerability identification with searchsploit and nuclei, and technology
fingerprinting with whatweb and wappalyzer. Automation with custom Bash scripts to run the entire
enumeration phase in parallel and in order.

## Challenges

- Balancing scan speed against service detection
- Silent enumeration to avoid saturating target logs
- Prioritizing vectors when multiple ports are open

## Takeaways

- Enumeration playbook with 20+ integrated tools
- Bash automation script for reconnaissance
- Enumeration checklist to avoid missing any vector

## Timeline

2024 - Present
