---
title: "HTB: Windows Privilege Escalation Techniques"
description: "Compilation of Windows escalation techniques from HTB machines: Token Impersonation, SeBackupPrivilege, UAC bypass, service misconfigurations, DLL hijacking, and AlwaysInstallElevated."
category: "HTB"
tags: ["Windows", "PowerShell", "WinPEAS", "SharpUp", "Metasploit", "C#"]
featured: false
date: "2024-01-01"
---

Detailed writeups of Windows privilege escalation on HTB machines. Covers: Token Impersonation
with RoguePotato/JuicyPotato, SeBackupPrivilege abuse to dump SAM/SYSTEM, SeImpersonatePrivilege,
UAC bypass via registry/modifiable paths, service misconfigurations (binPath, unquoted paths, weak
permissions), DLL hijacking in services and applications, AlwaysInstallElevated for malicious MSI
packages, and scheduled task abuse. Includes custom PowerShell scripts and C# exploit compilation.

## Challenges

- Compiling exploits for specific Windows versions
- Bypassing AV and Windows Defender during exploitation
- Techniques that require multiple chained steps

## Takeaways

- 10+ documented Windows privesc techniques from HTB
- Custom PowerShell scripts for automation
- AV bypass guide for each technique

## Timeline

2024 - Present
