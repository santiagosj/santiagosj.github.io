# Progreso

**Estado:** en pausa
**Actualizado:** 2026-11-16
**Rama:** gh-pages (local) → origin/source @ bd534a8
**Sin commitear:** nada (todo commiteado para clonar en otra máquina)

## Objetivo
Portfolio "Web Developer → Pentester" con posts y proyectos en markdown (EN/ES). Que todo el contenido
sea un write-up real, nada de placeholders.

## Dónde me quedé
Borré los 6 posts placeholder `htb-*` (EN + ES) y actualicé `AGENTS.md` (ahora 10 pares). Quedan 6
posts reales y 4 proyectos. Los 4 proyectos (ad-lab, privesc-arsenal, secure-k8s-lab, soc-homelab)
siguen siendo placeholders de dos líneas.

## Siguiente paso
Escribir el primer proyecto real: copiar `src/content/projects/_TEMPLATE.project.md` sobre
`src/content/projects/<slug>.md` (con sus 8 secciones), luego su `.es.md`, y verificar con `npm run dev`.

## Pendiente
- [ ] Write-up real de los 4 proyectos (EN + ES)
- [ ] Corregir `AGENTS.md`: dice "All 8 project pages", pero son 4 proyectos (8 archivos)
- [ ] Decidir el lío de ramas (ver Notas)

## Hecho
- [x] Estructura de contenido, barra de progreso, post de EDR
- [x] Eliminar posts placeholder `htb-*` y actualizar `AGENTS.md`

## Notas
- El código fuente está en `origin/source` (rama local `gh-pages`); para clonarlo: `git clone -b source git@github.com:santiagosj/portfolio.git`. Diverge de `main`, que está desactualizada.
  `origin/gh-pages` contiene el build compilado (commits "Updates"), no el código fuente.
- `npm run deploy` publica `dist` en el repo `santiagosj.github.io`, no en este.
