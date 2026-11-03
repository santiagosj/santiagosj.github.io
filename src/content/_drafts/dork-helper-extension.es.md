---
title: "Extensión Ayudante de Dorks"
description: "Extensión para Chrome/Firefox que ayuda a construir y ejecutar dorks de búsqueda: constructor de operadores, plantillas de dorks curadas, búsqueda con un clic en Google/Bing/DuckDuckGo y copiado instantáneo al portapapeles."
category: "Seguridad Web"
team: "Red Team"
tags: ["JavaScript", "Chrome Extensions API", "React"]
featured: false
date: "2024-01-01"
timeline: "2 meses (2024)"
---

Extensión para Chrome y Firefox que ayuda con los dorks de búsqueda. Ofrece un constructor de
operadores de búsqueda (site, inurl, filetype, intitle, ext, cache...), una biblioteca de
plantillas de dorks curadas para tareas de reconocimiento habituales y ejecución con un clic en
Google, Bing o DuckDuckGo. Cada dork generado se puede copiar al portapapeles o limitar al
dominio abierto en la pestaña, para armar consultas de reconocimiento sin salir de la página.

## Desafíos

- Mantener la sintaxis generada válida en Google, Bing y DuckDuckGo, que aceptan operadores distintos
- Escapar y entrecomillar la entrada del usuario para que los dorks personalizados no rompan la consulta
- Equilibrar una biblioteca de plantillas curadas con espacio para fragmentos definidos por el usuario

## Aprendizajes

- Plantillas que cubran los casos de reconocimiento más comunes (archivos expuestos, paneles de login, mensajes de error)
- Limitación al dominio y exportado al portapapeles con un solo clic
- Referencia de operadores disponible sin conexión dentro de la ventana de la extensión
