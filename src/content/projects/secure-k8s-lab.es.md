---
title: "Endurecimiento de Kubernetes y Monitorización en Tiempo Real"
description: "Clúster K8s con endurecimiento completo: network policies, RBAC de mínimo privilegio, Falco para detección en runtime y modelado de amenazas STRIDE. Scripts automatizados de despliegue y validación de seguridad."
category: "Seguridad en Kubernetes"
team: "Blue Team"
tags: ["Kubernetes", "Falco", "Calico", "Helm", "kind", "Bash"]
featured: true
date: "2025-01-01"
timeline: "3 meses (2025)"
---

Laboratorio de seguridad en Kubernetes desplegado con kind. Implementación completa de
endurecimiento: network policies de denegación por defecto, RBAC de mínimo privilegio con
ServiceAccounts que no montan tokens automáticamente, Falco con el driver modern_ebpf para la
detección de amenazas en runtime (shells en contenedores, montajes privilegiados, escrituras
sensibles) y alertas vía falcosidekick. Incluye scripts automatizados de despliegue, validación de
seguridad y simulación de ataques para verificar la detección. Modelado de amenazas STRIDE
aplicado a la arquitectura del clúster.

## Desafíos

- Configurar Falco con eBPF sin afectar el rendimiento del clúster
- Definir network policies que no rompan el funcionamiento de las aplicaciones
- Simular ataques realistas sin dañar el entorno del laboratorio

## Aprendizajes

- Clúster K8s con defensa en profundidad totalmente automatizada vía scripts
- Falco detectando reverse shells, montajes privilegiados y escrituras sensibles
- Modelado de amenazas STRIDE documentado para cada componente
