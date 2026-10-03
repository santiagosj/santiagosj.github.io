---
title: "HTB: Active Directory Attack Paths"
description: "Writeups of HTB machines with Active Directory: AS-REP roasting, kerberoasting, ACL abuse, DCSync, Kerberos delegation, and trust attacks. Includes BloodHound attack path maps."
category: "HTB"
tags: ["BloodHound", "Impacket", "Responder", "CrackMapExec", "AD", "Kerberos", "LDAP"]
featured: false
date: "2024-01-01"
---

Compilation of writeups of HTB machines focused on Active Directory. Full attack path
documentation from standard user to Domain Admin: AS-REP roasting against users without pre-
authentication, kerberoasting of SPNs, ACL abuse (ForceChangePassword, WriteOwner, GenericAll,
GenericWrite), DCSync to dump KRBTGT hashes, Kerberos delegation (unconstrained, constrained,
resource-based), and domain trust attacks. Attack path maps generated with BloodHound and
CustomQueries to identify critical routes.

## Challenges

- Identifying ACL abuse paths in complex forests
- Chaining multiple attacks into a single attack path
- Evading detection in AD events (log tampering)

## Takeaways

- 6+ documented HTB AD machines with attack paths
- BloodHound CustomQueries for ACL abuse detection
- Complete and reproducible AD attack methodology

## Timeline

2024 - Present
