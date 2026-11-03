---
title: "HTB: Playbook de Reconocimiento y Enumeración"
description: "Playbook de reconocimiento y enumeración para máquinas HTB: desde el escaneo inicial con nmap hasta la enumeración profunda de servicios, usuarios y vulnerabilidades. Automatización con scripts propios."
category: "HTB"
tags: ["nmap", "ffuf", "Gobuster", "enum4linux", "smbclient", "searchsploit", "Bash"]
featured: false
date: "2024-01-01"
---

Playbook completo de reconocimiento y enumeración para abordar cualquier máquina HTB de forma
metódica. Fases documentadas: escaneo inicial con nmap (top ports, detección de versiones, scripts
NSE), enumeración de servicios web con ffuf y Gobuster, enumeración SMB con enum4linux y
smbclient, enumeración LDAP/AD, identificación de vulnerabilidades con searchsploit y nuclei, y
fingerprinting de tecnologías con whatweb y wappalyzer. Automatización con scripts Bash propios
para ejecutar toda la fase de enumeración en paralelo y en orden.

## Desafíos

- Equilibrar la velocidad de escaneo frente a la detección de servicios
- Enumeración silenciosa para no saturar los logs del objetivo
- Priorizar vectores cuando hay múltiples puertos abiertos

## Aprendizajes

- Playbook de enumeración con 20+ herramientas integradas
- Script de automatización en Bash para reconocimiento
- Checklist de enumeración para no dejar ningún vector sin cubrir

## Cronología

2024 - Presente
