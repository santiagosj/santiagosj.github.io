---
title: "HTB: Túneles, Pivoting y Reenvío de Puertos"
description: "Guía de técnicas de tunelización y pivoting aplicadas en máquinas HTB: túneles SSH, proxy SOCKS con Chisel, Ligolo-ng, reenvío de puertos con plink y rutas de pivoting multi-salto."
category: "HTB"
tags: ["SSH", "Chisel", "Ligolo-ng", "proxychains", "plink", "nmap", "socat"]
featured: false
date: "2024-01-01"
---

Guía práctica de técnicas de tunelización y pivoting aplicadas en máquinas HTB con múltiples
interfaces de red y segmentación. Cubre: reenvío dinámico de puertos SSH como proxy SOCKS, Chisel
para túneles TCP/UDP inversos, Ligolo-ng para rutas de pivoting automáticas, reenvío de puertos
con plink.exe desde Windows y proxychains para enrutar herramientas a través del túnel. Cada
técnica incluye casos reales de HTB, la topología de red y los comandos exactos utilizados.

## Desafíos

- Mantener el túnel estable durante escaneos largos
- Hacer pivoting a través de hosts Linux -> Windows -> Linux
- Enrutar múltiples herramientas simultáneamente

## Aprendizajes

- 5+ configuraciones de tunelización documentadas
- Scripts de automatización para Ligolo-ng
- Metodología de pivoting válida para cualquier topología

## Cronología

2024 - Presente
