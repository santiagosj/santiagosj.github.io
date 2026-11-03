---
title: "HTB: Rutas de Ataque en Active Directory"
description: "Writeups de máquinas HTB con Active Directory: AS-REP roasting, kerberoasting, abuso de ACL, DCSync, delegación Kerberos y ataques de confianza. Incluye mapas de ruta de ataque con BloodHound."
category: "HTB"
tags: ["BloodHound", "Impacket", "Responder", "CrackMapExec", "AD", "Kerberos", "LDAP"]
featured: false
date: "2024-01-01"
---

Compilación de writeups de máquinas HTB centradas en Active Directory. Documentación completa de
la ruta de ataque desde usuario estándar hasta Domain Admin: AS-REP roasting contra usuarios sin
pre-autenticación, kerberoasting de SPNs, abuso de ACL (ForceChangePassword, WriteOwner, GenericAll,
GenericWrite), DCSync para volcar hashes de KRBTGT, delegación Kerberos (sin restricción, con
restricción, basada en recursos) y ataques de confianza entre dominios. Mapas de ruta de ataque
generados con BloodHound y CustomQueries para identificar las rutas críticas.

## Desafíos

- Identificar rutas de abuso de ACL en bosques complejos
- Encadenar múltiples ataques en una sola ruta de ataque
- Evadir la detección en eventos de AD (manipulación de logs)

## Aprendizajes

- 6+ máquinas AD de HTB documentadas con sus rutas de ataque
- CustomQueries de BloodHound para detectar abuso de ACL
- Metodología de ataque AD completa y reproducible

## Cronología

2024 - Presente
