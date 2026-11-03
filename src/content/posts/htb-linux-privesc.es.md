---
title: "HTB: Escalada de Privilegios en Linux en Profundidad"
description: "Writeup detallado de técnicas de escalada de privilegios en Linux aplicadas a máquinas HTB: abuso de SUID, capabilities, cron jobs, exploits de kernel LPE y secuestro de PATH. Metodología paso a paso con comandos y salidas."
category: "HTB"
tags: ["Linux", "Bash", "Python", "GTFOBins", "pspy", "linpeas", "enumy"]
featured: false
date: "2024-01-01"
---

Compilación de writeups centrados en la escalada de privilegios en Linux a partir de múltiples
máquinas HTB. Cada técnica documentada con: reconociimiento inicial del sistema, enumeración de
vectores de escalada, explotación paso a paso y post-explotación. Cubre abuso de binarios
SUID/SGID, Linux capabilities mal configuradas, cron jobs con scripts escribibles, escalada de
privilegios vía exploits de kernel (DirtyPipe, OverlayFS), secuestro de PATH y abuso de reglas de
sudo. Incluye salidas reales, comandos exactos y el razonamiento detrás de cada decisión.

## Desafíos

- Identificar el vector correcto entre múltiples posibilidades
- Exploits de kernel que requieren versiones específicas
- Máquinas con múltiples capas de escalada encadenadas

## Aprendizajes

- 8+ máquinas HTB de escalada de privilegios en Linux documentadas
- Cobertura de 15+ técnicas de escalada distintas
- Metodología reproducible para cualquier máquina Linux

## Cronología

2024 - Presente
