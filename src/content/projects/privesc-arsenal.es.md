---
title: "Arsenal de Escalada de Privilegios"
description: "Un banco de trabajo de escalada de privilegios para Linux y Windows, hecho para priorizar hallazgos en lugar de listarlos: diecisiete técnicas documentadas, quince scripts de enumeración y un motor de cruce que solo reporta dónde algo que puedo influir se cruza con algo que corre por encima de mí."
category: "Pentesting"
team: "Red Team"
tags: ["Python", "Bash", "PowerShell", "C", "Linux", "Windows", "Metasploit"]
featured: true
date: "2024-01-01"
timeline: "En curso (2024 - Presente)"
githubUrl: "https://codeberg.org/santiagosj/privesc-arsenal"
---

Tirar `linpeas.sh` en un host comprometido, esperar los colores y tratar lo que se ponga rojo como
la respuesta. Funciona lo bastante seguido como para que nadie deje de hacerlo, y falla de una
manera concreta: dos listas largas —cosas que corren por encima de mí, cosas que puedo escribir— y
ningún vector, porque la línea que importa no es una línea. Es donde dos líneas se cruzan.

El argumento completo es el artículo [`Escalada de privilegios en Linux: las preguntas
correctas`](/posts/linux-privesc-intersection), escrito en este mismo portfolio. Este repositorio es
la misma tesis construida en la otra dirección: enumerar por categoría produce dos listas, la
escalada vive donde los dos ejes se encuentran, y las fichas de técnicas, los scripts de enumeración
y el árbol de decisión salen todos de esa única idea.

## El problema

La pregunta que el proyecto existe para responder: **dada la identidad que realmente tengo, qué
puedo influir que algo con más privilegios vaya a leer o ejecutar después — y cuál de esos cruces
puedo probar en minutos en lugar de horas?**

Esa es una pregunta de criterio, no una tarea de recolección, y es justo la que un scanner no puede
contestar. `linpeas` reporta que un archivo es escribible por el grupo; no puede decirte si algo con
privilegios lo va a leer alguna vez, porque esa respuesta vive en un crontab, un unit file y un
script de arranque que una persona tiene que leer *juntos*. Así que el proyecto hace dos cosas y se
niega a una tercera: documenta cada técnica para que el mecanismo se entienda, y cruza los ejes para
que los candidatos que sobreviven queden priorizados. Lo que **no** hace es explotar nada.

Alcance, escrito antes de que se ensanchara solo:

- **No weaponiza.** El motor de cruce reporta dónde gastar los próximos diez minutos; nunca ejecuta
  el payload. Detectar un config escribible que root sourcea es un hallazgo. Escribirlo es un
  incidente, y la herramienta no da ese paso por vos.
- **No es un reemplazo de cobertura completa de LinPEAS/WinPEAS.** Esas herramientas recolectan
  mucho y bien. Esta recolecta poco y prioriza, a propósito.
- **No decide.** Cada vector carga las cinco preguntas del operador y una prioridad, nunca un
  veredicto.

## El contexto

Una herramienta solo es razonable respecto de dónde corre. Esta corre en el lugar más incómodo de un
engagement: minutos después de un foothold, en un host que nadie me describió.

- **Máquina.** Un host Linux alcanzado con privilegios bajos, para el motor de cruce y los diez
  chequeos de Linux —`bash` y coreutils asumidos, nada más. Un host Windows para los cinco scripts
  de enumeración en PowerShell. Sin gestor de paquetes, sin salida a la red, sin intérprete más allá
  del shell que ya está en la caja.
- **Credenciales y privilegios.** Exactamente lo que traje: una cuenta normal, sin root, sin `sudo`
  cacheado. El script de contexto prueba `sudo -n -l` y nunca pide contraseña, porque un prompt
  interactivo es un cuelgue en una sesión no interactiva. Cada script lee el sistema; ninguno
  instala, compila ni edita nada en el objetivo.
- **Operador.** Una persona con una terminal, contra el reloj —en este caso la preparación del OSCP,
  donde el presupuesto son minutos por host y el costo de perseguir la línea equivocada es el
  examen entero.
- **Lo que existía antes.** `linpeas.sh`, `WinPEAS`, un archivo de notas y una costumbre. El archivo
  de notas era la parte honesta: ahí vivía el criterio, y era justo la parte que nunca se transfería
  a la máquina siguiente.

> **En pocas palabras**
> Entraste a un edificio en el que no deberías estar y tenés diez minutos antes de que alguien lo
> note. Un mapa de todas las cerraduras del edificio no sirve —hay cientos y se parecen todas—. Lo
> que sirve es el único lugar donde una puerta que *sí* podés abrir lleva a un piso que *no* podés,
> y el mapa nunca muestra eso, porque dibuja las puertas de a una en lugar de dibujar qué puerta
> toca qué. Este proyecto es la nota que dice: acá están las dos puertas que se tocan.

## Las restricciones

El puñado de condiciones que decidieron la forma de todo lo que sigue.

| Tipo | La restricción |
| --- | --- |
| **Dura** | Tiene que correr en un host pelado: `bash` + coreutils en Linux, PowerShell en Windows. Sin `pip`, sin `jq`, sin `python3` que pueda asumir. |
| **Dura** | No puede necesitar root, y no puede modificar el host bajo prueba. Solo lectura, con una excepción que documento en lugar de esconder. |
| **Presupuesto** | Minutos por host. El motor tiene que priorizar, no enumerar, y su propio test de reproducibilidad tiene que terminar en segundos y sin root. |
| **Superficie** | El filesystem es la entrada no confiable: nombres con espacios, symlinks que resuelven en otro lado, bits de permiso que describen tres audiencias, un `.bashrc` que se ejecuta al leerlo. La salida tiene que poder parsearse sin ejecutarla. |
| **No-objetivo** | Nada de weaponización, nada de base de exploits de kernel, nada de motor de cruce para Windows, ninguna promesa de cobertura de detección completa. |

La fila **No-objetivo** es la que hace el trabajo real. Sin ella, el próximo pedido razonable es
«que además explote lo que encuentra», y ese pedido habría modelado la arquitectura más que
cualquier decisión que yo tomara a propósito.

## Los componentes

Cada fila se gana su lugar respondiendo una pregunta, no por existir.

| Componente | Responsabilidad | Depende de | Falla en |
| --- | --- | --- | --- |
| `linux/enumeration/context_check.sh` | Fijar quién soy y qué alcanza ya esta identidad, antes de cualquier comando global | `/proc/self/status`, `capsh` opcional | El motor se niega a correr; o el operador cruza contra un contexto viejo |
| `linux/enumeration/*_check.sh` (10) | Una categoría cada uno —SUID, caps, cron, kernel, sudo, NFS, contenedores, sesiones, RPATH— explicando cada chequeo | `bash`, coreutils | Una categoría imprime «limpio» y se lee como cobertura cuando es un solo eje |
| `linux/engine/cross.sh` | Recolectar «corre por encima de mí» × «puedo influir» y reportar **solo la intersección**, cada una con las cinco preguntas y una prioridad | `context_check.sh --facts` | Un informe vacío, o un lead impreso como si fuera un vector |
| `linux/engine/tests/run.sh` | Reconstruir el fixture `forge` del artículo y verificar que el cruce dispare y que los archivos no escribibles queden en silencio | `cross.sh` | Una regresión que nadie nota, en la única pieza que carga la tesis |
| `windows/enumeration/*.ps1` (5) | Chequeos de privilegios por técnica —tokens, servicios, UAC, credenciales guardadas, AlwaysInstallElevated | PowerShell | Un parseo de permisos simplificado que lo dice |
| `*/techniques/*.md` (17) | Mecanismo, chequeo manual, explotación, detección, prevención — una ficha por técnica | Nada | La prosa separándose del script que describe |
| `detection/*.md` (2) | La mitad azul: reglas auditd, config de Sysmon, mapeo de EventID, queries de SIEM | Nada | La mitad defensiva se queda vieja mientras la ofensiva crece |
| `methodology/` | El árbol de decisión y el checklist de Linux que ordena los scripts | Nada | El orden de operaciones pasa a ser memoria en vez de un documento |
| `common/reverse_shells.md` | Payloads y métodos de transferencia para las dos plataformas | Nada | — |
| `Makefile` | Cross-compila el único exploit desde fuente; `clean` borra artefactos de build y reportes | `mingw-w64` | `make linux` imprime un mensaje, porque todavía no hay nada ahí |

## Del requisito al diseño

La decisión bisagra es el proyecto entero: **¿enumerar por categoría o enumerar por cruce?** La
primera es barata y produce dos listas que nunca se tocan. La segunda es una hipótesis y cuesta
atención humana, y es la única versión que produce un vector. Todo lo demás sale de elegir la
segunda —incluida la decisión de construir un motor chico en shell en lugar de extender un script de
enumeración, y de aceptar que el lado Windows tendría primero chequeos por técnica y un motor de
cruce solo si se lo ganaba.

> **En pocas palabras**
> Una herramienta que lista cerraduras te da una lista más larga; una que muestra qué dos cerraduras
> se tocan te da una dirección. La segunda tiene que arriesgar una conjetura —«creo que quien lleva
> las llaves lee las notas que se dejan en este escritorio»— y una conjetura que cuesta un minuto de
> lectura vale más que una certeza que cuesta una hora de nada. El proyecto eligió hacer la conjetura
> explícita y barata en lugar de fingir que enumerar es la respuesta.

> **Descartado**
> Envolver `linpeas` y post-procesar su salida — falla en *el problema*: recolecta por categoría y el
> cruce es una hipótesis que no sostiene. El post-procesamiento no puede inventar la hipótesis, solo
> reformatear las dos listas.

> **Descartado**
> Un único script que enumere *y* explote — falla en *no-objetivo* y *superficie*: la explotación
> automática contra un filesystem que no controlo convierte un informe en un incidente, en la máquina
> de otro, en el momento en que menos puedo explicarlo.

> **Descartado**
> Escribir el motor en Python — falla en *dura*: la caja puede no traer un intérprete en el que pueda
> confiar, y llevarlo no es opción. El shell es el único runtime garantizado, y por eso la salida es
> TSV parseada con `cut -d= -f2-` y no JSON.

> **Descartado**
> Emitir JSON y que el operador lo filtre — falla en *dura*: sin `jq` ni `python3` garantizados. El
> contrato es `CTX_KEY=value`, uno por línea, valores que pueden contener espacios, nunca `source`ados
> —porque sourcear la salida que produjo un filesystem hostil es cómo una herramienta de solo lectura
> se vuelve una de escritura total.

> **Descartado**
> Construir primero el motor de cruce para Windows — falla en *presupuesto*: el cruce en Linux es
> barato de probar contra `/proc`, `cron` y unit files, y los chequeos de privilegios en Windows
> necesitan primitivas distintas. Entregar una mitad honesta es mejor que dejar dos en stub.

## Implementación

El motor es `bash`. Llama a `context_check.sh --facts`, aborta si soy root y trabaja sobre tres TSV
temporales dentro de un `mktemp -d` con un trap de limpieza —`stdout` es el informe, `stderr` es el
progreso—. El eje A es lo que corre por encima de mí (SUID/SGID, file capabilities, reglas sudo,
objetos que alcanzan mis grupos). El eje B es lo que puedo influir (archivos y directorios
escribibles en rutas que consume un proceso privilegiado). La salida es la intersección, y nada más.

Seis reglas deciden un cruce:

| Regla | El cruce que captura |
| --- | --- |
| R1 | Un binario privilegiado que es **escribible** |
| R2 | Un binario SUID que resuelve un helper **por nombre** con un `PATH` escribible delante |
| R3 | Un job de root que **ejecuta o sourcea** algo escribible |
| R4 | Una regla sudo cuyo objetivo es escribible, o un GTFOBin |
| R5 | Un job de root cuya ruta o `PATH` está en un directorio escribible |
| R6 | Un **grupo** de mi identidad alcanza un objeto privilegiado — `docker.sock`, el socket de libvirt, `/dev/sda` |

Cada hallazgo se emite con las cinco preguntas que el artículo exige —**Actor · Precondición ·
Primitiva · Consecuencia · Objetivo**— y una prioridad:

```text
prioridad ≈ delta de privilegio × mi influencia ÷ costo de probarlo
             root=3, creds=2, lateral=1   contenido=1.0, dir=0.8, heurística=0.5   una línea=1, comando=2, esperar cron=3
```

Si la *consecuencia* no se puede enunciar, el hallazgo no se vuelve vector: cae en una sección de
`Leads`, que es donde va lo desconocido. El resto tampoco se descarta en silencio —aterriza en
`Descartes con criterio`, para que el rechazo sea una decisión escrita y no una intuición:

```text
Descartado, con el criterio que mató a cada uno:
  /usr/bin/su, /usr/bin/passwd    set SUID de la distro: comportamiento documentado, delta cero
  /usr/bin/ping  cap_net_raw+ep   capability real, objetivo equivocado: raw sockets no son root
  archivos de mi propio uid       ya son míos; eso es escribir, no privilegio
  reglas sudo sin NOPASSWD        una lista de deseos hasta que se pruebe
```

La única pieza que tiene que estar bien es el cruce, así que tiene un test reproducible.
`tests/run.sh` arma el fixture `forge` del artículo bajo `/tmp` con permisos legales
(`0555`/`0444`/`0644`), corre `cross.sh --root <fixture> --quick` y verifica las dos direcciones: el
config escribible por el grupo que root sourcea tanto por cron como por un `EnvironmentFile` de
systemd se encuentra, y `publish.sh`, la entrada de cron y el unit file —ninguno escribible— **no**
se reportan. No necesita root y termina en segundos, que es la única forma en que una hipótesis tan
barata puede permitirse cargar tanto peso.

## En pocas palabras

Una empresa tiene un edificio donde de noche se fabrican productos terminados. Vos tenés un pase que
te deja entrar por la puerta principal y casi a ningún otro lado. De noche, un encargado de limpieza
recorre los pisos con un manojo de llaves maestras y sigue las notas que se dejan en los
escritorios. Vos querés entrar a la oficina del último piso, y la pregunta equivocada es «qué
cerradura es más débil». La correcta es «dónde se tocan dos situaciones».

Nadie escribió nunca esa pregunta, porque el mapa de cerraduras es fácil de hacer y el mapa de
*contactos* no lo es. Así que el proyecto es una costumbre convertida en una herramienta chica: antes
que nada, averiguar exactamente quién sos en el edificio —qué pase, qué clubes, qué puertas ya te
dejaron abiertas—. Después buscar el único escritorio donde podés dejar una nota que el encargado
con las llaves realmente lee. Dos hechos, cada uno inofensivo por separado, una oficina abierta a
las dos de la mañana.

La herramienta imprime los cruces, los leads y, con la misma importancia, las cosas que miró y
descartó, con el motivo. Esa última lista es lo que hace que los hallazgos que sobreviven hayan sido
elegidos y no tropezados.

## Qué haría distinto

**Lo que se traslada.** Dos reglas que vale la pena guardar:

- **Un vector es un elemento en dos ejes.** Si un hallazgo está en un solo eje, es mobiliario: una
  llave que no alcanzás, o una nota que nadie lee. Preguntá «qué corre por encima de mí y qué puedo
  influir», y confiá solo en la línea donde las dos cosas son ciertas.
- **Escribí el registro de descartes.** Los candidatos que matás, con el criterio, son lo que hace
  que los que sobreviven hayan sido elegidos. Un método que solo muestra sus aciertos es
  indistinguible de la suerte.

**Límites — dónde esto no aplica.** Dicho en voz alta en lugar de enterrado, porque una herramienta
presentada como completa se confía justo donde falla:

- El motor de cruce es **solo Linux**. En Windows son scripts de enumeración por técnica; la
  intersección todavía se hace a mano, y el artículo hermano —escalada de privilegios en Windows—
  sigue pendiente.
- La detección es **desigual**. Cada ficha de técnica trae una sección de detección y prevención,
  pero las dos notas consolidadas son más finas de lo que sugiere la carpeta: la de Linux cubre cinco
  de diez técnicas a nivel de sistema, la de Windows cinco de siete.
- El README raíz promete un caso real de HTB por técnica. Solo tres fichas lo tienen. Esa promesa es
  deuda de documentación, y prefiero recortar la promesa antes que rellenar las notas.
- `linux/exploits/` está vacío y su target de Make solo imprime un mensaje; el único exploit
  compilado, PrintSpoofer, es una **reimplementación estudiada y simplificada** del original de
  itm4n, no el binario upstream. En Windows, el chequeo de permisos de servicios admite que es
  simplificado, y `uac_check.ps1` de verdad intenta un bypass en lugar de solo leer —lo que
  contradice el encuadre de solo lectura que mantiene el resto del proyecto.

Si empezara otra vez, lo primero que borraría es la columna de exploit en las tablas de técnicas.
Promete un arma que el proyecto a propósito no entrega, y todo lo honesto de acá está en la columna
que nadie fotografía: el criterio para decir no.
