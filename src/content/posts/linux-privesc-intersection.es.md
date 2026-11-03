---
title: "Escalada de privilegios en Linux: las preguntas correctas"
description: "Un script para enumerar automaticamente puede entregar 400 líneas de hallazgos; pero no entrega el criterio que convierte el hallazgo en un root shell. Las preguntas que me hago después de tener un foothold, post-explotación — incluidos los candidatos que descarté y el criterio que mató a cada uno."
category: "Método"
tags: ["Linux", "Privilege Escalation", "Post-Exploitation", "Enumeration", "SUID", "sudo"]
featured: false
date: "2026-10-06"
---

Existe un modus operandi post-explotación que consiste en ejecutar `linpeas.sh` o cualquier otro script 
que automatice la enumeracion, hacer una lectura rapida filtrando con la vista por color de prioridad
y tratar lo que se ponga rojo como la posible respuesta. Funciona lo suficientenmente bien como para que
nadie deje de hacerlo y sea una especie de estandar mientras se enumera de manera manual. 
El incombeniente con esto es que también produce un fallo muy concreto: un informe de 400 líneas donde a veces
la informacion se pierde entre tantas lineas, sin contar que al ser un escaneo masivo cae en 
informacion generica perdiendo la perspectiva contextual y callendo en falsos positivos.

Entonces a la hora de distinguir lo reelevante de lo irrelevante debemos saber que preguntarnos para tomar perspectiva del contexto. 
Así que esto no es una lista de técnicas — SUID, capabilities, cron, sudo, de eso ya hay bastante en otros sitios — y aquí
no hay ninguna máquina. El objetivo de abajo es una especificación que escribí para este artículo,
y existe para demostrar un punto: **la escalada es un punto de convergencia entre dos o mas puntos** Todo lo demás — 
el vocabulario, las herramientas, el orden de operaciones — sale de ahí.

## La pregunta

¿Lo primero que debemos hacer en un host comprometido es ejecutar un script de enumeración, o poder responder
«¿donde estoy y quién soy yo aquí ahora mismo»?

La respuesta honesta a mi entender es que el script es inútil mientras no respondamos la segunda pregunta, debemos plantarnos
ante el dilema entre entender **_vs._** actuar sobre el contexto y hacer un balance dependiendo de la situacion. 
Si el tiempo es un factor que nos pesa al momento de estar auditando un sistema, probablemente elijamos actuar,
mientras vamos entendiendo en paralelo para responder la segunda pregunta.

El mismo binario —modo `4755`, dueño root, ejecutable por cualquiera— significa dos cosas distintas según quién lo mire. 
Para una identidad cuyos grupos y shell le permiten activarlo, es un camino directo a root. 
Para otra, es apenas una línea más en un listado de archivos. La diferencia no está en el binario: está en el contexto de quien lo ejecuta.
Entonces enumerar antes de fijar nuestro propio contexto no produce hallazgos; produce candidatos que todavía no podemos priorizar.

La pregunta real, entonces, es esta:

> ¿Dada la identidad que realmente tengo, **qué cruza algo que yo puedo influir con algo que corre
> por encima de mí** — y cuál de esos cruces puedo probar en minutos en lugar de horas?

Si podemos responder eso, la salida de la herramienta se convierte en evidencia en lugar de en un
mapa del tesoro. Si no podemos, la herramienta solo te entrega una lista más larga de cosas que, como dije con anterioridad,
todavía no podemos priorizar.

La idea de este post es detenernos sobre el dilema mencionado anteriormente (entender vs. actuar)
y analizar el proposito de las entidades que hacen a la cadena que compone la escalada 
de privilegios. Sobre esto construimos nuestro mapa de accion.

Después de leer esto deberías poder aterrizar en un host que no conoces, establecer tu contexto
antes de tocar nada, priorizar hallazgos por dónde se cruzan dos ejes en lugar de por lo ruidosos
que se ven, y descartar candidatos con un criterio escrito en lugar de una intuición.

## El modelo objetivo

> **Supongamos el siguiente caso**
El objetivo es `forge`, un servidor de compilación interno ficticio. Compila paquetes para un
equipo interno, prepara el resultado y lo publica en un mirror cada noche a las 02:00 a.m. Es una maquina
sin jerarquias y bienintencionada, construida por developers y no por un equipo de operaciones, que
es exactamente el caso interesante: aquí no hay nada malicioso, todo aquí es *razonable*.

- **Actores.** 
    - **Yo**: Usuario `builder`, una cuenta real de bajos privilegios, miembro del grupo `builders`.
    - **Root**: no es una persona, es un horario — entradas de cron que ejecutan scripts como root durante
  la noche. 
    - `svc-deploy`: una cuenta de servicio que posee su propio socket. 
    - **El administrador**: quien configuró todo lo anterior y se fue a casa.
- **Activos que importan.** 
    - La capacidad de root de escribir en cualquier lugar (lo que yo quiero),
    - el mirror de artefactos (lo que el equipo publica — integridad) 
    - el propio horario de cron (el proceso privilegiado más fiable de la maquina).
    
- **Componentes.** 
    - Una entrada de `cron.d` que ejecuta `publish.sh` como root; ese script y el
  `publish.conf` que sourcea; 
    - Un helper con SUID que los developers escribieron para archivar el build; 
    - Un intérprete que lleva una file capability; una regla sudo `NOPASSWD`; y el socket del servicio de deploy.

### El vocabulario con el que se construye el modelo

Antes del modelo, **el lenguaje en el que está escrito**. Seis piezas, ni una más.

- **`rwx`, tres veces.** Cada archivo lleva bits de **lectura/escritura/ejecución** para su owner, su
  grupo y todos los demás — `rwxr-x---` es una declaración sobre tres públicos, no sobre uno. `ls
  -l` es la _confesión_: la primera columna *es* todo el modelo de permisos por lo que a `ls` le
  importa.
- **SUID, SGID, sticky.** Un cuarto octeto delante de esos nueve: `4000` (SUID) hace que el kernel
  ejecute el programa con la identidad del ***owner del archivo***, `2000` (SGID) con la de ***su
  grupo***, y `1000` (sticky, lo que hay en `/tmp`) solo impide borrar archivos de otros. El modelo
  mental que importa: **un archivo SUID presta la identidad de su owner a quien lo ejecute.** Los
  permisos dicen quién puede tomar prestada la llave; el SUID dice que dentro hay una llave.
- **Capabilities.** La alternativa a prestar el llavero entero: root partido en piezas pequeñas con
  nombre — `cap_setuid`, `cap_net_raw`, `cap_dac_override` — que pueden pegarse a un solo archivo
  y tener efecto en una sola ejecución. La diferencia con SUID no es cosmética: un binario SUID
  *es root mientras corre*, mientras que un archivo con `cap_net_raw+ep` tiene exactamente una
  capability y nada más. `setcap` las escribe en los extended attributes del archivo; `getcap -r /`
  las lee de vuelta — y mira el sufijo, porque `+ep` (effective + permitted) sí funciona en una
  shell normal, mientras que `+p` sin `e` llega a un proceso que no tiene ni idea de cómo usarla.
- **ACLs.** Las tres columnas `rwx` no son toda la verdad: `setfacl` puede conceder una cuarta
  entrada a un usuario concreto, y `ls -l` se limitará a mostrar un `+` al final de la cadena de
  modo. Si nunca has ejecutado `getfacl`, has estado leyendo un resumen y llamándolo archivo.
- **UID real, efectivo y guardado.** Tres números, no uno: **quién *eres*** (`ruid`, lo que ven señales
  y logins), **quién *eres para las comprobaciones de permisos*** (`euid`/`fsuid`, lo que el kernel
  consulta cuando abres un archivo) y **a quién tienes *permitido volver*** (`suid`, lo que hace que el
  `setuid(0)` de un programa SUID sea reversible). La escalada es, con precisión, el acto de mover
  el número efectivo sin mover necesariamente el real — y todo este artículo trata sobre quién
  tiene permitido moverlo.
- **Ownership vs derechos efectivos.** Un archivo puede ser propiedad de root y seguir siendo
  group-writable por mí; una ACL puede concederme acceso de escritura que el owner nunca concedió;
  una capability puede dar a mi *proceso* una identidad que mi cuenta no tiene. El ownership es un
  hecho sobre un archivo. Los derechos efectivos son un hecho sobre un momento: qué identidad está
  de pie delante de él, justo ahora.

> **En pocas palabras**
> Imaginemos un edificio con tres tipos de autoridad. **Primero**, las cerraduras: cada puerta tiene tres
> listas pegadas — la tuya, la de tu departamento y la de todos los demás. **Segundo**, llaves que
> sirven solo una noche: la tarjeta del contratista de limpieza abre todas las plantas, pero solo
> mientras está de turno — salvo que en este edificio algunas tarjetas se copiaron y nunca
> caducaron. Y **tercero**, un recepcionista al que se le permitió actuar como el gerente para dos
> tareas concretas, porque darle el llavero entero del gerente parecía excesivo. Todo lo técnico de
> este artículo es uno de esos tres objetos; todo lo estratégico consiste en cuál de ellos se cruza
> con algo que tenemos permitido tocar.

## Los criterios de superficie

Considero que un elemento es superficie de escalada de privilegios si se cumple **cualquiera** de
estas condiciones. No todas — cualquiera. Una basta para ganar una fila en el inventario.

| Eje | La pregunta que responde |
| --- | --- |
| **Corre por encima de mí** | ¿Puedo hacer que algo se ejecute con una identidad que no tengo? (SUID/SGID, file capabilities, `sudo -l`) |
| **La escritura sube** | ¿Puedo escribir o influir en algo que un actor más privilegiado leerá o ejecutará más tarde? (cron, timers, configs que un script root sourcea, directorios de `PATH`, rutas de búsqueda de librerías, directorios de run-parts) |
| **Contacto con root** | ¿Toca un proceso que corre como root un archivo, socket, pipe, ruta temporal o entorno que yo también puedo tocar? |
| **Confianza sin verificar** | ¿Actúa algo privilegiado sobre mi input porque *soy yo* quien lo da, sin comprobarlo? (wildcards, rutas relativas, symlinks no validados, nombres de archivo y argumentos que llegan a una shell) |
| **Cruce de contexto** | ¿Se evalúan los permisos de un archivo una sola vez con una identidad, y su contenido se actúa después con otra? |

Cualquiera de estas gana una fila. **Pero una fila no es un vector — un vector es un elemento que
está sentado en dos ejes a la vez.** El helper con SUID es solo «corre por encima de mí». La config
group-writable es solo «la escritura sube». El cron de root que sourcea esa config con ese helper
en su `PATH` es donde se cruzan los ejes, y la escalada vive en el cruce, no en ninguna de las dos
líneas de `ls -l` por separado. Por eso enumerar por categorías produce dos listas y ningún
vector, y ese es todo el argumento de este artículo.

Porque una rúbrica que no prioriza es solo una lista:

> **Prioridad ≈ delta de privilegio × mi influencia sobre ello ÷ costo de probarlo**

El **delta de privilegio** es cuánto se mueve la identidad — de `builders` a `root` es un delta, de
`builder` a `builder` es cero. Mi influencia radica en si puedo escribir esa *"entidad|objeto|asset"* llamemosle,
que consume el actor privilegiado, y cuándo volverá a consumirlo (esta noche a las 02:00 gana a «algún día»). El
denominador es la parte que la gente se salta: una hora probando algo que produce un número de
versión es peor que diez minutos probando un path al que root va a escribir. La fórmula no es
sagrada. Escribirla sí lo es — obliga a que el tradeoff sea explícito, y es lo que te impasa pasar
la noche en un socket de debug.

## El inventario

Antes de cualquier comando sistemático, la pregunta por el contexto — porque es la única cuya
respuesta cambia todas las demás:

```bash
$ id; sudo -l 2>/dev/null | tail -n +3
```

```text
uid=1001(builder) gid=1001(builder) groups=1001(builder),1005(builders)
User builder may run the following commands on forge:
    NOPASSWD: /usr/bin/systemctl restart watcher.service
```

Tiena mas valor **qué alcance tiene esta identidad**, que «qué hay en esta maquina» : dos grupos, una regla sudo, y —
desde el mismo hábito — el bounding set de mi shell, si estoy en un contenedor y qué entorno
heredé. El contexto va primero porque *el alcance es una propiedad de la identidad, no del
archivo*.

Después, enumerar **por cruces, no por categorías**. No producir una lista de SUID y una de cron y compararlas después;
es mas valido preguntarnos «cuál de estos binarios SUID toca algo que yo puedo escribir, y cuál de estos procesos root lee un archivo que yo puedo escribir». 
Las dos listas siempre fueron la misma lista, unidas por la pregunta correcta.

Herramientas: `linpeas`, `LinEnum`, `enumy` recogen, y recogen bien — debemos usarlas. Lo que no pueden
hacer es el cruce, porque el cruce requiere una hipótesis. Un script puede reportar que un archivo
es group-writable; no puede decirnos si algo privilegiado lo leerá alguna vez, porque esa respuesta
vive en un crontab, un unit file y un init script que alguien tiene que leer *juntos*. Esa lectura
es el trabajo. La herramienta es el becario.

Los criterios también deciden qué **no** gana tiempo. No está en la tabla de abajo, y no merece una
segunda mirada:

### Descartar 
- El set propio de SUID de la distribución — `su`, `passwd`, `newgrp`, `mount`. Comportamiento
  documentado; te dan exactamente lo que prometen sus manpages y nada detrás de eso.
- `cap_net_raw+ep` en `/usr/bin/ping`. Una capability real, reportada con honestidad — y raw
  sockets no son root. Objetivo equivocado, delta cero.
- Archivos escribibles solo por mi propio uid. Ya los poseo; eso no es «la escritura sube», eso es
  escribir.
- Entradas de sudo que requieren una contraseña que no tengo. `sudo -l` es una lista de deseos
  hasta que se prueba.
- `/tmp`, `/proc`, `/sys` world-writable: sticky bit, plumbing del kernel, o nada privilegiado los
  consume nunca.
- Clases de exploits de kernel cuyas precondiciones fallan — un `uname -r` fuera de los rangos
  afectados, o `kernel.unprivileged_userns_clone = 0`. Comprobar la precondición, anotarla, siguir.
  Esto es un hábito de dos minutos, no un proyecto de una noche.

Los criterios, aplicados. Seis filas, y la rúbrica es lo que ganó cada una de ellas:

| Elemento | Propósito | Habla con | Frontera de confianza | Acaba en |
| --- | --- | --- | --- | --- |
| `stage-artifacts` (SUID) | Archiva y hashea el output del build como root para que los artefactos caigan con owner root en `/opt/release` | Mi shell, `sha256sum` resuelto **por nombre**, `/opt/release` | Un programa root hereda mi entorno y resuelve helpers por nombre de pila | Releases que nadie puede tocar — la intención, y lo único garantizado |
| `nightly-publish` (cron) | Publica el build nocturno a las 02:00, como root | `publish.sh`, el archivo de log, el mirror | Root ejecuta un script cuyos inputs vienen de un grupo al que yo pertenezco | Una publicación fallida, un artefacto equivocado — a nadie le avisan de ninguna de las dos |
| `publish.conf` | Ajustes del script de publicación: dir de stage, dir de mirror, archivo de log | `publish.sh` a las 02:00 | Un archivo group-writable que root sourcea sin validar | Una configuración silenciosa que nadie vigila, porque nunca se ha portado mal |
| `python3.11` (`cap_setuid,cap_setgid+e`) | Un script de deploy necesitó `setuid` una vez; la capability acabó en el intérprete | Cada cuenta local | Una capability que cambia de identidad en un intérprete ejecutable por todos | El intérprete sigue comportándose normal para todo el mundo — por eso se quedó |
| `sudoers`: `systemctl restart watcher` | Permitir a los builders reiniciar el log watcher sin abrir ticket | `systemctl` como root, `watcher.service` | Una acción de root concedida a un grupo, segura solo mientras el unit no se pueda manipular | Parones del servicio durante los deploys |
| `/run/deploy.sock` | IPC para el servicio de deploy | `svc-deploy`, grupo `deploy` | Grupo `deploy` → servicio — **`id` dice que no estoy en ese grupo** | Nada, para mí: una frontera que no incluye mi identidad |

Dos columnas sostienen la tabla. **Frontera de confianza** nombra la asunción que nadie está
verificando. **Acaba en** es lo que el dueño ya aceptó como normal — y ahí viven los huecos,
porque nadie endurece la cosa que nunca se ha portado mal: el archivo de config que lleva dos años
group-writable y que nadie ha editado jamás con la persona equivocada es invisible, hasta la noche
en que alguien lo edita.

## Del elemento al vector

Un vector a mi entender responde cinco preguntas. 

1. **Actor** — quién soy yo en este punto, con qué grupos.
2. **Precondición** — qué tiene que ser ya cierto para que esto funcione.
3. **Primitiva** — qué capacidad única me entrega.
4. **Consecuencia** — qué desbloquea esa capacidad después.
5. **Objetivo** — ¿me mueve hacia root, o lateralmente?

Si alguna respuesta es *desconocida* en lugar de *sí*, es un lead, no un vector. Desconocido está
bien — la mayoría de los buenos vectores empiezan desconocidos. Lo que no está bien es entregar un
hallazgo cuya consecuencia no puedas enunciar.

> **En pocas palabras**
> Un hallazgo no es una cosa que está mal. Es una cosa que está mal *y que tú puedes empujar*.
> Antes de tocar nada, hazte dos preguntas cotidianas de cada candidato: quién tiene la llave, y
> quién tiene la nota? Si la persona con la llave nunca lee notas de tu escritorio, tienes un
> mueble, no una puerta. El filtro corre antes del trabajo — esa es toda la diferencia entre
> «aquí tienes un truco» y «así es como decido».

### Candidato A — el archivo que lee el cron de root

- **Actor** — `builder`, miembro de `builders`. La pertenencia a un grupo no es un detalle aquí;
  es la precondición cero.
- **Precondición** — `publish.sh` es legible, y la línea 3 sourcea `/opt/ci/publish.conf`
  *antes* de hacer nada más. El cron ejecuta ese script como root a las 02:00. Ambos hechos son
  legibles en lugar de inferidos — lo cual, bajo el denominador de coste, es exactamente lo que
  quiero.
- **Primitiva** — elegir una ruta a la que root escribirá, y contenido que root copiará allí
  (cualquier cosa que yo stagie, más lo que el script genere él mismo).
- **Consecuencia** — un archivo con owner root que contiene mi contenido en una ruta que yo elijo:
  `/etc/cron.d/`, un archivo cron en cualquier sitio, `ld.so.preload`. Las próximas 02:00 son un
  root shell.
- **Objetivo** — root. No «escritura arbitraria, interesante», no «un hallazgo»: *la capacidad de
  colocar un archivo que el sistema operativo obedecerá*, con un horario.

Nada en el `ls -l` de `publish.sh` está mal — es `755 root root`. Nada en el modo de
`publish.conf` está mal a primera vista — `rw-rw-r--` en una maquina de build compartida es una
decisión de compartir perfectamente normal. **Ninguno de los dos archivos es el bug. El bug es que
un archivo que yo puedo escribir es leído por un proceso que yo no puedo, sin ninguna comprobación
en medio.** Esa frase es el vector; también es invisible para cualquier herramienta que liste
archivos sin listar quién los lee.

### Candidato B — el intérprete que se quedó una llave de la puerta principal

- **Actor** — cualquier usuario local. El intérprete es ejecutable por todos, así que este
  candidato no le importa qué grupos tengo.
- **Precondición** — file caps `cap_setuid,cap_setgid+ep`: *effective*, no solo permitted, que es
  la diferencia entre una llave y una fotografía de una. La única cosa que aún puede pararlo es el
  bounding set de mi propia shell — si el intento falla en silencio, el siguiente lugar donde
  mirar es `CapBnd` en `/proc/self/status`, no otro exploit.
- **Primitiva** — llamar a `setuid(0)` desde un lenguaje que yo controlo, con el kernel convencido
  por la capability del archivo y no por ningún permiso de archivo.
- **Consecuencia, objetivo** — root, en un comando.

Coste de probarlo: una sola línea. Bajo la fórmula de prioridad este es el vector más barato de la
maquina y, cuando se encuentra, va primero — no porque las capabilities estén de moda, sino porque el
denominador es el número más pequeño de la tabla.

### Candidato C — el helper que pide una herramienta por su nombre de pila

- **Actor** — `builder`, con mi propio `PATH`. El entorno pasa a una ejecución SUID; el kernel y
  glibc quitan `LD_PRELOAD` y compañía, y `PATH` no es uno de ellos — es trabajo del *programa*
  volver a comprobarlo, y este programa no lo hace.
- **Precondición** — `stage-artifacts` resuelve `sha256sum` sin calificar (la cadena está en el
  binario), y un directorio que yo puedo escribir se coloca por delante de `/usr/bin` en mi
  `PATH`.
- **Primitiva** — un programa de mi elección se ejecuta como root, cada vez que corre el helper.
- **Consecuencia, objetivo** — root.

> **Descartado**
> La regla `sudo` (`systemctl restart watcher`) — falla en *consecuencia*. La precondición es
> perfecta (`NOPASSWD`), pero el unit file, su directorio de drop-ins y `ExecStart` son todos
> propiedad de root y no escribibles, así que el restart me entrega un servicio que se detiene y
> arranca exactamente igual que antes. La regla es una puerta a una habitación vacía.

> **Descartado**
> El set propio de SUID de la distribución (`su`, `passwd`, `newgrp`, `mount`) — falla en
> *consecuencia*: estas son las manpages, no el sistema que hay detrás. Cada hora gastada aquí
> compra comportamiento documentado.

> **Descartado**
> `/run/deploy.sock` — falla en *precondición*: `srw-rw---- root deploy`, y mi `id` no contiene
> `deploy`. Nota el requisito de honestidad: no he probado que este socket sea inútil, he probado
> que es inútil *para mí*. Se queda en el informe como lead para la siguiente identidad.

> **Descartado**
> Clases de LPE de kernel (el rango de versiones de Dirty Pipe, overlayfs vía user namespaces) —
> fallan en *precondición*: `uname -r` está fuera de los rangos afectados y
> `kernel.unprivileged_userns_clone = 0`. Dos minutos de comprobación, anotados como una línea en
> las notas, no una noche de arqueología de parches. El hábito sobrevive al descarte; solo esta
> maquina no califica.

### La parte que es realmente incómoda

Cambia mis credenciales por las de `svc-deploy` y este artículo cambia: sin estar en `builders`,
el Candidato A nunca entra en la sala; el Candidato B se mantiene, porque ejecutable por todos es
ejecutable por todos; el Candidato C también se mantiene, porque tu `PATH` siempre es tuyo. Ahora
llega una identidad *dentro* del grupo `deploy`, y la fila que descarté al principio de esta
sección se convierte en la viva.

Así que la lista de prioridades no es una propiedad del target. Es una propiedad del target **y de
las credenciales que tengo en las manos** — y en escalada de privilegios, a diferencia del trabajo
web, esas credenciales son lo primero que deberías escribir, antes de haber ejecutado un solo
comando contra el sistema.

## Ejecución

Cinco comandos sostuvieron decisiones. Todo lo demás que ejecuté queda omitido deliberadamente.

**Contexto.** La pregunta que precede a la enumeración:

```bash
$ id; sudo -l 2>/dev/null | tail -n +3
```

```text
uid=1001(builder) gid=1001(builder) groups=1001(builder),1005(builders)
User builder may run the following commands on forge:
    NOPASSWD: /usr/bin/systemctl restart watcher.service
```

Dos grupos, una regla sudo. `builders` es lo que va a importar; la regla sudo será descartada en
cuatro minutos, por consecuencia.

**Lo que corre por encima de mí.** Las dos búsquedas, ejecutadas como un solo barrido porque
responden una sola pregunta:

```bash
$ find / -xdev -perm -4000 -type f 2>/dev/null
$ getcap -r / 2>/dev/null
```

```text
/usr/bin/su
/usr/bin/passwd
/usr/bin/newgrp
/usr/bin/mount
/usr/local/bin/stage-artifacts
/usr/bin/ping            cap_net_raw+ep
/usr/bin/python3.11      cap_setuid,cap_setgid+ep
```

Los cuatro binarios de la distribución son el filtro de ruido de arriba, aplicado. `ping` se
descarta por objetivo en la misma mirada. Dos líneas sobreviven — y de ellas, `stage-artifacts`
solo se convierte en candidato después de confirmar que resuelve helpers por nombre:

```bash
$ strings /usr/local/bin/stage-artifacts | grep sha256
```

```text
sha256sum %s
```

**Lo que puedo escribir y root lee.** El cruce, antes de probarlo:

```bash
$ grep -n 'conf\|MIRROR\|mkdir\|cp ' /opt/ci/publish.sh; echo ---
3:. /opt/ci/publish.conf
22:mkdir -p "$MIRROR_DIR"
24:cp "$STAGE_DIR"/* "$MIRROR_DIR"/
$ ls -la /opt/ci/
```

```text
-rwxr-xr-x  1 root  builders  812 Oct  4 09:10 publish.sh
-rw-rw-r--  1 root  builders   94 Oct  4 09:10 publish.conf
drwxrwxr-x  2 builder builders 4096 Oct  5 22:14 stage/
$ cat /etc/cron.d/nightly-publish
0 2 * * * root /opt/ci/publish.sh >> /var/log/ci-publish.log 2>&1
```

La línea 3 sourcea la config antes que nada; la línea 24 copia sin `-p`, así que todo lo que caiga
en el mirror tendrá owner root y contendrá lo que yo stagie. Tres archivos, tres permisos legales,
una intersección.

**El cruce, demostrado.** A las 23:40 puse `MIRROR_DIR=/tmp/ci-marker/` en `publish.conf` y dejé
un `canary.txt` en `stage/`. El cron se disparó durante la noche; a las 07:31:

```bash
$ ls -la /tmp/ci-marker/
```

```text
drwxr-xr-x 2 root root 4096 Oct  6 02:00 .
drwxrwxrwt 1 root root 4096 Oct  6 07:31 ..
-rw-r--r-- 1 root root 61440 Oct  6 02:00 release-2026-10-05.tar.gz
-rw-r--r--  1 root root    42 Oct  6 02:00 canary.txt
```

Root creó un directorio en una ruta que yo escribí y puso dentro mi archivo, con owner root.
Control de ruta y control de contenido, fotografiados con un canary inofensivo en lugar de un
payload — cambiar `canary.txt` por un archivo cron y `/tmp/ci-marker/` por `/etc/cron.d/` es un
cambio de dos líneas que no hace falta realizar para *probarlo*, y realizarlo cambiaría un hallazgo
de informe por un root shell imparable a las 02:01 en el servidor de compilación de otro.

**La puerta barata.** Candidato B, un comando — ejecutado antes que nada en un engagement real,
mostrado al final aquí solo porque el cruce de arriba es el asunto del artículo:

```bash
$ python3.11 -c 'import os; os.setuid(0); os.setgid(0); os.system("id")'
```

```text
uid=0(root) gid=0(root) groups=0(root),1005(builders)
```

**Lo que no pude probar.** Tres cosas, enunciadas y no enterradas:

- Todos los puntos de llamada de `stage-artifacts`. Verifiqué la resolución de `PATH` desde una
  shell interactiva; un llamante que sanee el `PATH` antes de invocarlo mataría al Candidato C, y
  no pude enumerar todos los llamantes dentro del time box. El Candidato C está *sin confirmar*,
  no confirmado.
- Si `/run/deploy.sock` es alcanzable a través de alguna identidad que yo hubiera podido obtener.
  Está descartado *para mí*, que es una distinta de descartado, y el informe dice exactamente eso.
- Si la configuration management re-ownea `publish.conf` cada noche. Si lo hace, el Candidato A se
  cierra solo para la mañana y mi edición de las 23:40 fue una carrera que gané por casualidad. Vi
  el archivo una vez, no longitudinalmente — un timestamp junto al hallazgo, no una garantía.

## En pocas palabras

Una empresa gestiona un edificio pequeño donde de noche se fabrican productos terminados. Tienes
una tarjeta que te abre la puerta principal y casi ningún otro sitio: puedes entrar al taller,
usar las herramientas compartidas y operar las máquinas para las que te contrataron. De noche hay
un conserje con un llavero de maestras, una máquina que mueve las cajas terminadas al almacén, y
un vigilante de la planta de arriba que abre la puerta cuando alguien enseña una tarjeta abajo una
sola vez, y nunca comprueba si la persona que pasa es la persona a la que pertenecía la tarjeta.

Te gustaría entrar a la oficina de la planta de arriba. La manera equivocada de pensarlo es «qué
cerradura es débil». La correcta es «dónde se cruzan dos situaciones».

Alguien te presta sus llaves — eso es el programa que corre con el nombre de otro. Tienes
permitido dejar una nota en un escritorio — eso es el archivo que puedes escribir. El conserje
recoge las notas dejadas en ese escritorio y las sigue sin preguntar quién las dejó — eso es la
persona con las llaves leyendo tu nota. Por separado, ninguno de los dos hechos cambia nada: las
llaves a las que no llegas, y las notas que nadie lee, son muebles en la habitación. Juntos, a las
dos de la mañana, uno de ellos abre la oficina de la planta de arriba. El error nunca fue la nota,
ni las llaves. Fue que una nota que tienes permitido escribir llegara a una mano que sostiene
llaves que no tienes permitido tener.

Había otras dos puertas y no pasé por ninguna. Una necesitaba un llavero de un club al que nunca
te invitaron. La otra probablemente habría funcionado, pero solo con un mazo sobre el cableado del
propio edificio — y el edificio podría haberse venido abajo conmigo dentro.

El hábito que vale la pena llevarte es este. Cuando aterrices en un edificio que no conoces,
averigua primero exactamente quién eres en él: qué tarjeta, qué clubes, qué puertas ya estaban
abiertas *para ti*. Solo entonces pregunta qué dos situaciones se cruzan. Las herramientas te
entregarán encantadas un mapa de todas las cerraduras del edificio. Ni una sola te dirá qué
cerradura tiene a la vez una llave y una nota apuntada a ella la misma noche.

## Lo que se traslada

La parte que puedes aplicar a un host que ninguno de los dos haya visto nunca. Ocho preguntas — si
no puedes responder las ocho, no has terminado de enumerar, sin importar lo que imprimiera el
script.

1. **¿Quién soy aquí exactamente, y qué alcanza ya esta identidad?** uid/euid, grupos, `sudo -l`,
   file capabilities en mi propia shell, contenedor o máquina física, el entorno y el cwd que
   heredé. Antes de un solo comando sistemático.
2. **¿Qué puedo hacer ejecutar con una identidad que no es la mía — y qué hace realmente ese
   thing con el privilegio extra?** SUID/SGID, file capabilities (`+ep` vs `+p`), reglas sudo. El
   privilegio es la mitad del hallazgo; la otra mitad es lo que el programa *hace* mientras lo
   sostiene.
3. **¿Qué puedo escribir que algo más privilegiado leerá o ejecutará más tarde?** cron y `cron.d`,
   timers, unit files, configs que los scripts root sourcean, directorios de `PATH`, directorios
   de la ruta de búsqueda de librerías, directorios de run-parts, directorios de maildrop.
4. **¿Qué tocan los procesos root que yo también puedo tocar?** Sockets, pipes, archivos temporales
   con nombres predecibles, exposición de `/proc/<pid>`, variables de entorno heredadas a través de
   un reinicio.
5. **¿Qué asume el sistema sobre mí sin comprobar?** Wildcards expandidas por una shell de root,
   rutas relativas, symlinks que nadie re-valida, nombres de archivo y argumentos que llegan a una
   shell, entrecomillados o no.
6. **¿Dónde se cruzan los permisos de archivo con el contexto de ejecución?** Los permisos se
   evalúan una vez, con una identidad; el contenido se actúa después, con otra. Busca los archivos
   que están en ambos lados de ese hueco — no se anunciarán solos.
7. **Para cada acierto: primitiva → consecuencia → objetivo.** Qué capacidad única consigo, qué
   desbloquea, y si me mueve hacia root o hacia los lados. Si no puedes responder la tercera, tienes
   un lead.
8. **¿Qué descarté, con qué criterio — y qué no pude probar?** El registro de descartes es lo que
   hace que los hallazgos supervivientes fueran elegidos y no tropezados, y la columna de «no
   probado» es lo que mantiene el informe honesto seis meses después.

Hasta dónde no llega esto: trata los breakout de kernel y de namespace solo como comprobación de
precondición, no como una disciplina propia — explotarlos es otro artículo. Asume una shell estable
y tiempo: a los diez minutos, un script le gana a un humano, y este método es deliberadamente
lento al principio porque la pregunta por el contexto es barata y todo lo caro depende de ella. No
dice nada sobre si la escalada será notada — un eje completamente aparte. Y asume que las
credenciales son las emitidas; el reutilizar contraseñas y las claves tiradas en el history de la
shell son otro artículo todavía.
