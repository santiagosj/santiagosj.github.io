---
title: "Un SOC homelab organizado por casos cerrados, no por herramientas instaladas"
description: "Un laboratorio SOC end-to-end en construcción, diseñado para que cada fase cierre un incidente real —telemetría, detección, respuesta y evidencia— en lugar de acumular dashboards. En progreso: diseño y esqueleto listos, V1 sin desplegar."
category: "Detección y respuesta"
team: "Blue Team"
tags: ["Wazuh", "Suricata", "Sigma", "Detection as Code", "Incident Response", "Threat Intel"]
featured: false
date: "2026-10-27"
timeline: "En progreso (2026 - Presente)"
githubUrl: ""
liveUrl: ""
---

> **Estado: en progreso.** El diseño de arquitectura, el plan de red y el esqueleto del repo están
> hechos. La primera fase (V1) todavía no está desplegada. Esta página documenta el *criterio* con el
> que está pensado, no incidentes que ya ocurrieron. Cuando V1 cierre su primer caso, la reescribo
> con la construcción vivida, como las demás.

## El problema

La pregunta que este proyecto existe para responder:

> ¿Cómo aprendo a operar un SOC sin tener un SOC —sin tráfico real, sin presupuesto, sin un equipo de
> turnos— de modo que lo que practico transfiera a un turno de verdad, y no termine siendo "instalé
> Wazuh y miré el dashboard"?

El riesgo no es técnico, es de criterio. El homelab de seguridad típico se organiza por herramientas:
se instala el SIEM, después el IDS, después la plataforma de casos, y en el camino se junta un stack
impresionante que no cerró un solo incidente. Mucho para mostrar en una captura, nada que reconstruir.

Lo que este lab **no** hace: no recrea un SOC empresarial, no persigue realismo de volumen, y no se
mide por cuántas herramientas corre. Se mide por cuántos incidentes puede contar de punta a punta.

## El contexto

Un operador —yo, con una terminal— sobre un host de virtualización residencial (Proxmox), hardware de
casa, y una red segmentada en VLANs: *management*, *targets*, *ataque* y *malware*, separadas a
propósito. La única exposición a internet es un VPS chico para el honeypot; la IP residencial nunca se
expone. El malware se analiza en su VLAN, sin ruta a management.

Lo que esto viene a reemplazar es el homelab "instalá y admirá el dashboard": el que produce
telemetría pero no evidencia, y del que no se puede decir *qué pasó, cómo lo vimos, cómo lo paramos*.

> **En pocas palabras**
> Es un campo de entrenamiento para operar seguridad en casa. En vez de llenarlo de herramientas
> famosas, cada paso tiene que terminar con la historia completa de un incidente —cómo se vio, se
> entendió, se contuvo y se probó— o no cuenta.

## Las restricciones

| Tipo | Restricción |
|------|-------------|
| Dura | Un solo host de virtualización y una red residencial. Sin presupuesto cloud salvo un VPS mínimo para el honeypot. |
| Presupuesto | Tiempo de una sola persona. Cada fase tiene que caber en 2–3 semanas y dejar algo cerrado y demostrable. |
| Superficie | El honeypot expone a internet real y el malware es hostil por definición: ambos se tratan como entrada no confiable, aislados por red. |
| No-objetivo | Realismo de volumen empresarial. No reproduce millones de eventos ni un equipo de analistas; lo acepto, y por eso nada acá dice cómo escala el tuning a volumen real. |

## Los componentes

La pieza que carga la decisión no es ninguna herramienta: es la **fase vertical**. Cada una agrega el
stack mínimo para cerrar *un* caso de punta a punta, y existe solo si deja un entregable.

| Fase | Qué cierra (responsabilidad) | Depende de | En qué falla si se rompe |
|------|------------------------------|------------|--------------------------|
| V0 | Un evento SSH visible de punta a punta (latido) | Wazuh, un server Linux, Kali | No hay señal de que el pipeline funcione |
| V1 | SSH brute force → detección → bloqueo, con evidencia | OPNsense, Suricata, Wazuh, Pi-hole | El primer incidente no se puede reconstruir |
| V2 | Endpoint comprometido → caso enriquecido → aislamiento | Zeek, Sysmon, TheHive, Cortex | Hay alerta pero no hay respuesta ni caso |
| V3 | IOC de MISP → detección y bloqueo (detection as code) | MISP, Shuffle, exportador Python | La inteligencia queda decorativa, no operativa |

V4–V7 (honeypot externo, vulnerability management, malware/DFIR, y cierre de portfolio) siguen la misma
regla, pero el **MVP comprometido es V1 + V2 + V3**: tres casos cerrados antes de ampliar.

## Del requisito al diseño

El choque está entre dos restricciones: quiero aprender muchas disciplinas (SIEM, IDS, CTI, respuesta,
DFIR) y a la vez cada tramo tiene que dejar algo terminado en pocas semanas, con un solo operador.

**Rechazado — organizar por capas (horizontal).** "Primero la red, después el SIEM, después los casos,
después la inteligencia." Falla en *presupuesto* y en *entregable*: se pasan semanas instalando sin un
solo incidente cerrado, y si el proyecto se abandona a mitad —el destino de casi todo homelab— no queda
nada que mostrar ni que reconstruir.

**Rechazado — perseguir realismo de volumen.** Generar tráfico masivo para parecer un entorno real.
Falla en *presupuesto* (se come el hardware) y en *no-objetivo*: no agrega criterio, solo ruido.

**Elegido — fases verticales con un caso cerrado por fase, y evidencia antes que dashboards.** Cada
fase cruza todas las capas para cerrar un incidente concreto y deja cuatro cosas: un caso de estudio,
una detección versionada, un runbook y una métrica. Si no se puede reconstruir el incidente, la fase no
está terminada, por lindo que se vea el dashboard.

> **En pocas palabras**
> Preferí terminar historias cortas y completas antes que dejar muchas herramientas a medio instalar.
> Gano algo demostrable en cada paso y la capacidad de abandonar sin perderlo todo; resigno la
> sensación de "tener el stack completo" antes de haber cerrado el primer caso.

Una decisión operativa que viene con eso: **humano en el loop**. Nada se bloquea solo sin allowlist ni
aprobación. Es más lento a propósito, porque el objetivo es aprender a decidir, no a automatizar un
bloqueo que después no sé justificar.

## Implementación

Hoy existe el **esqueleto que fija las decisiones**, no los incidentes. Lo construido:

- Diseño de arquitectura, plan de red/VLANs e inventario base.
- Plantillas de caso, detección y playbook, para que todas las fases sean comparables.
- Scripts de preflight (solo lectura) y de creación de casos.

Lo que mantiene las fases comparables son las **convenciones**, no las herramientas: nombres estables
(`V1-SSH-001`, `CASE-2026-001`), fechas en UTC/ISO 8601, evidencia *sanitizada* antes de commitear (lo
crudo y las IPs públicas viven fuera de Git), secretos solo en `.env` local, y todo cambio relevante
acompañado de un ADR o una nota en `docs/`.

```text
docs/          arquitectura, red, inventario, métricas, ADRs
phases/        una carpeta por fase vertical, con su caso y criterios de cierre
detections/    Sigma, Suricata, Zeek, Wazuh — versionadas
playbooks/     procedimientos de respuesta
evidence/      evidencia sanitizada (lo crudo va fuera de Git)
```

Pendiente, y explícito: **V1 no está desplegada.** No hay todavía un caso cerrado contra telemetría
real. El checklist del repo lo dice sin maquillaje.

## En pocas palabras

Alguien arma un campo de entrenamiento para aprender a defender sistemas. La tentación es juntar una
pila de herramientas conocidas y admirar los tableros que encienden. Este lab se niega a eso: cada paso
tiene que terminar con la historia completa de un incidente —cómo se vio, cómo se entendió, cómo se
frenó y cómo se prueba— o no suma.

Por ahora están el plano y los andamios; el primer incidente real todavía no se corrió. Lo que compra
esa disciplina es que, cuando se muestre, muestre criterio y no una lista de compras.

## Qué haría distinto

**Lo reutilizable.** Organizá el aprendizaje por *entregables cerrados*, no por herramientas. Antes de
empezar cualquier lab, preguntá: ¿cuál es el caso más chico que puedo cerrar de punta a punta, y qué
evidencia lo prueba? Si una fase no deja un incidente reconstruible, no está terminada. "Evidencia antes
que dashboards" es la versión corta.

**Los límites.** Esto todavía prueba **criterio de diseño, no capacidad operativa**. Nada acá está
validado contra un ataque real: las detecciones no vieron tráfico hostil de verdad y el tuning de falsos
positivos no se midió. Hasta desplegar V1, esta página muestra *cómo pienso el problema*, no que lo
resolví.

Si empezara de nuevo, lo que sacaría es la tentación de dibujar el stack completo (V1–V7) antes de
cerrar V1. Por eso el alcance ya está comprometido a tres fases como MVP: la forma más honesta de no
confundir un plan ambicioso con un trabajo terminado.
