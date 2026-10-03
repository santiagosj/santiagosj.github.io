---
title: "HTB: Tunneling, Pivoting & Port Forwarding"
description: "Guide to tunneling and pivoting techniques applied on HTB machines: SSH tunneling, Chisel SOCKS proxy, Ligolo-ng, port forwarding with plink, and multi-hop pivoting routes."
category: "HTB"
tags: ["SSH", "Chisel", "Ligolo-ng", "proxychains", "plink", "nmap", "socat"]
featured: false
date: "2024-01-01"
---

Practical guide to tunneling and pivoting techniques applied on HTB machines with multiple network
interfaces and segmentation. Covers: SSH dynamic port forwarding as a SOCKS proxy, Chisel for
reverse TCP/UDP tunnels, Ligolo-ng for automatic pivoting routes, port forwarding with plink.exe
from Windows, and proxychains to route tools through the tunnel. Each technique includes real HTB
cases, network topology, and the exact commands used.

## Challenges

- Keeping the tunnel stable during large scans
- Pivoting through Linux -> Windows -> Linux hosts
- Routing multiple tools simultaneously

## Takeaways

- 5+ documented tunneling configurations
- Automation scripts for Ligolo-ng
- Pivoting methodology for any topology

## Timeline

2024 - Present
