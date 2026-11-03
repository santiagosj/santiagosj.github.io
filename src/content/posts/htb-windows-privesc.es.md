---
title: "HTB: Técnicas de Escalada de Privilegios en Windows"
description: "Compilación de técnicas de escalada en Windows provenientes de máquinas HTB: Token Impersonation, SeBackupPrivilege, bypass de UAC, malas configuraciones de servicios, secuestro de DLL y AlwaysInstallElevated."
category: "HTB"
tags: ["Windows", "PowerShell", "WinPEAS", "SharpUp", "Metasploit", "C#"]
featured: false
date: "2024-01-01"
---

Writeups detallados de escalada de privilegios en Windows sobre máquinas HTB. Cubre: Token
Impersonation con RoguePotato/JuicyPotato, abuso de SeBackupPrivilege para volcar SAM/SYSTEM,
SeImpersonatePrivilege, bypass de UAC vía registro/rutas modificables, malas configuraciones de
servicios (binPath, rutas sin comillar, permisos débiles), secuestro de DLL en servicios y
aplicaciones, AlwaysInstallElevated para paquetes MSI maliciosos y abuso de tareas programadas.
Incluye scripts PowerShell propios y compilación de exploits en C#.

## Desafíos

- Compilar exploits para versiones específicas de Windows
- Evadir el antivirus y Windows Defender durante la explotación
- Técnicas que requieren múltiples pasos encadenados

## Aprendizajes

- 10+ técnicas de escalada en Windows documentadas desde HTB
- Scripts PowerShell propios para automatización
- Guía de evasión de AV para cada técnica

## Cronología

2024 - Presente
