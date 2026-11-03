---
title: "SIEM Doméstico con Wazuh"
description: "SIEM centralizado con Wazuh all-in-one. Agentes en Linux y Windows con Sysmon, FIM, detección de vulnerabilidades y dashboards personalizados para monitorización de seguridad en tiempo real."
category: "SIEM"
team: "Blue Team"
tags: ["Wazuh", "Elasticsearch", "Sysmon", "Linux", "Windows", "YARA"]
featured: false
date: "2025-01-01"
timeline: "En curso (2025)"
---

SIEM completo desplegado con Wazuh all-in-one (manager + indexer + dashboard). Agentes instalados
en Linux y Windows con telemetría enriquecida: Sysmon en Windows para el registro detallado de
procesos y conexiones de red, auditoría de seguridad en Linux. Casos de uso de detección
implementados: detección de fuerza bruta, FIM (File Integrity Monitoring) en directorios
críticos, detección de malware con YARA y escaneo de vulnerabilidades. Dashboards personalizados
para visualizar autenticaciones, cambios de privilegios y eventos de seguridad en tiempo real.

## Desafíos

- Dimensionar los recursos del SIEM para un entorno doméstico
- Enriquecer eventos con Sysmon sin saturar el índice
- Construir dashboards útiles y no solo ruido visual

## Aprendizajes

- SIEM totalmente operativo con agentes en Linux y Windows
- Detección de fuerza bruta, cambios vía FIM y malware con YARA
- Dashboards de seguridad para monitorización en tiempo real
