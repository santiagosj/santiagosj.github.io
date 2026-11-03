---
title: "La caza de credenciales no es un comando find"
description: "Un scanner puede listar cada archivo de Windows y Linux que parece un secreto; no puede decirte cuál abre el siguiente host. El método manual — claves SSH, ticket caches, credenciales guardadas, token stores — como un mapa de decisiones cuyo destino manda, construido sobre un estate ficticio con un foothold en cada SO, incluidos los candidatos que descarté y el criterio que mató a cada uno."
category: "Método"
tags: ["Credential Hunting", "Lateral Movement", "Windows", "Linux", "SSH", "Post-Exploitation"]
featured: false
date: "2026-10-08"
---

Existe un género de posts de post-explotación que en realidad es una lista de directorios: cuarenta
lugares donde Windows y Linux guardan secretos, escritos como una checklist, cerrados con la
recomendación de ejecutar un scanner. La lista es exacta. También es inútil de la misma manera en
que es inútil un mapa de todos los edificios de la ciudad cuando nadie te ha dicho a qué edificio
vas.

Así que esto no es una lista de lugares donde viven las credenciales — de esas ya hay bastantes — y
aquí no hay ninguna máquina. El estate de abajo es una especificación que escribí para este
artículo, con dos footholds dentro, uno por sistema operativo, y existe para demostrar un punto:
**la búsqueda no empieza en el host. Empieza en el destino.** Todo lo demás — cuál de los cuarenta
lugares abres, en qué orden, y a qué hallazgo tienes permitido creerle — sale de esa única
decisión.

## La pregunta

¿Debes enumerar cada credential store del host comprometido antes de decidir a dónde vas después?

La respuesta honesta es que «cada credential store» no es un conjunto que puedas terminar, y esa es
la parte útil. En Windows las tiendas enumerables — Credential Manager, DPAPI, LSASS, ticket
caches, valores de registro, configuración de tareas y servicios — ya no se ponen de acuerdo entre
ellas sobre qué cuenta como una. En Linux no hay ninguna lista, porque cada herramienta a la que
alguna vez se le pidió un token ha escrito un dotfile, y el conjunto crece con lo último que
instaló el engineer de turno. Una enumeración que no puede terminar no es una fase; es un hábito.

La pregunta real, entonces, es esta:

> Dado el host que necesito alcanzar a continuación, **qué método de autenticación acepta — y
> cuáles de las tiendas de este host pueden guardar material de esa clase?**

Si puedes responder eso, los cuarenta lugares se reducen a dos o tres, y un hallazgo se vuelve
creíble porque sabes *para qué* sirve. Si no puedes, ningún scanner te lleva ahí — solo te entrega
una lista más larga que todavía no puedes priorizar, y la línea que importaba está entre dos
archivos que de todas formas habrías abierto.

Después de leer esto deberías poder aterrizar en cualquiera de los dos SO, escribir el destino
antes de tocar nada, abrir solo las clases de almacenamiento que implica el método del destino, y
descartar candidatos con un criterio escrito en lugar de una intuición.

## El modelo objetivo

El objetivo es un estate de operaciones ficticio que escribí para este artículo: tres máquinas, y
dos maneras de estar dentro de una de ellas.

- **`relay`** — un jump host Linux que el equipo de operaciones usa para alcanzar la flota.
  **Foothold A:** tengo `deploy`, una cuenta de servicio real de bajos privilegios que usa la CI.
  Cómo se obtuvo `deploy` queda fuera de alcance, como siempre.
- **`ws-ops-01`** — la workstation Windows 11 de `ana`, la administradora de infraestructura, unida
  al dominio `MERIDIAN`. **Foothold B:** estoy ejecutándome dentro de su sesión interactiva. Cómo
  obtuve code execution ahí también queda fuera de alcance.
- **`prod-app`** — el host de producción de la aplicación: Linux, con `sshd` aceptando solo
  autenticación por clave pública. Es **el objetivo para ambos footholds.** Guarda la visión de la
  flota que tiene `ops` — el inventario, las deploy keys, el material de firmado de releases. Una
  credencial cruza, y este artículo se detiene en el cruce.

Los actores, descompuestos con honestidad:

- **Yo, dos veces** — una vez como `deploy`, otra como `ana`. Las dos identidades ven estates
  diferentes, y esa diferencia es el tema de una sección más abajo.
- **`ana`** — una persona, cuyos hábitos son la configuración real del estate. Nadie escribió la
  política que puso una clave privada en un directorio con modo `0644`; alguien solo necesitaba que
  funcionara a la 01:00.
- **`svc-ops`** — una cuenta de automatización cuya contraseña vive en un archivo y no en un
  vault.
- **La gente que mira los logs** — no son actores en este artículo, pero su existencia pertenece al
  denominador de cada decisión de abajo.

Los activos que importan: la autoridad de `ops` en `prod-app`, el acceso guardado de ana a la
flota, y el hecho de que ambos existen en *almacenamiento* y no en la cabeza de una persona. Los
componentes no son servicios — son **tiendas**: el directorio de claves en `relay`; y en
`ws-ops-01`, su directorio SSH, su Credential Manager, su vault DPAPI, su ticket cache y su shell
history.

> **En pocas palabras**
> Un edificio de producción con dos armarios de guardia. En el sótano, alguien fotocopió una llave
> y dejó la copia en una estantería a la que cualquiera puede llegar, porque una máquina necesitaba
> usarla de noche. Arriba, una persona guarda sus llaves en una chaqueta que solo ella puede abrir,
> junto con notas de cada puerta cuyo código ha tecleado alguna vez. Estás de pie en una de las dos
> salas, y necesitas entrar en una tercera sala del piso de arriba. La pregunta que responde este
> artículo no es «qué hay en los armarios» — podrías buscarlos durante una semana — sino «la sala
> del piso de arriba quiere una llave; quién ha dejado una llave tirada?»

## Los criterios de superficie

Considero que una credencial guardada merece mi tiempo si se cumple **cualquiera** de estas
condiciones. No todas — cualquiera. Una basta para ganar una fila en el inventario.

| Criterio | Qué pregunta responde |
| --- | --- |
| **Portable** | ¿Funciona desde una sesión distinta de la que la guardó? |
| **Traduce** | ¿Autentica en un host o principal *distinto* del que se encontró? |
| **Tiene autoridad** | ¿Qué alcanza legítimamente el principal que la posee? |
| **Comprobable** | ¿Puedo probar que funciona sin consumirla — ni sin despertar a la gente que vigila los logons fallidos? |

La cuarta es donde esta disciplina se diferencia de cazar archivos. Un secreto no es un hallazgo
hasta que tienes una forma barata de probarlo: una clave SSH falla en silencio y se puede reintentar
para siempre, una contraseña incorrecta de Windows cuesta presupuesto de lockout y escribe un
evento, un token revocado le avisa a alguien. Misma basura, denominadores muy diferentes.

Como una rúbrica que no ordena no es más que una lista:

> **Prioridad ≈ autoridad del principal × portabilidad ÷ (costo de probarlo × ruido)**

El ruido está en el denominador a propósito. En escalada de privilegios, la escalada *es* el
objetivo, así que el ruido es una nota para el informe. En la caza de credenciales para movimiento
lateral, la prueba equivocada puede bloquear la cuenta que ibas a usar — la búsqueda misma puede
destruir el activo.

**El mapa.** Los criterios dicen que una credencial puede merecer tiempo. No dicen dónde buscar, y
esa es la pregunta que la gente falla de verdad. Así que el destino responde primero, y su
respuesta elige las filas:

> 1. **¿A dónde voy?** Nombra el siguiente host o principal. Sin destino → no hay búsqueda; estás
>    recolectando, no cazando.
> 2. **¿Qué acepta?** Llave, contraseña, ticket, token, sesión viva. Esa respuesta es el filtro.
> 3. **¿Cuáles de las tiendas de este host guardan material de esa clase?** Solo esas. Las otras
>    treinta y tantas existen y todavía no importan.

| El siguiente host autentica con | Dónde vive esa clase en Linux | Dónde vive esa clase en Windows |
| --- | --- | --- |
| **Clave SSH** | `~/.ssh/` — claves privadas, `config`, `known_hosts`; claves aparcadas en directorios de automatización; agent sockets (solo mismo uid o root) | `%USERPROFILE%\.ssh\` — claves de cliente y `config`; agente (`ssh-agent`, Pageant); lado servidor: `administrators_authorized_keys` |
| **Contraseña local o de dominio** | shell history; `.pgpass`, `.my.cnf`, `.netrc`; cron y systemd units; compose files; inventarios de ansible | `cmdkey /list` (solo targets y usernames — puedes usarla en su sitio, no extraerla); blobs DPAPI en `%APPDATA%\Microsoft\Credentials`; PSReadLine history; `schtasks /query /v` y `sc qc` (nombran el *principal*, no el secreto); valores de autologon en el registro |
| **Ticket Kerberos** | ficheros ccache — `/tmp/krb5cc_*`, `KRB5CCNAME` | `klist` — los tickets viven en la sesión, no en un fichero que puedas copiar |
| **Token bearer** | `.aws/credentials`, `.kube/config`, `.docker/config.json`, `.git-credentials` | los mismos dotfiles en el perfil; el vault del navegador (DPAPI); sesiones WinSCP/PuTTY |
| **Una sesión interactiva viva** | tmux/screen; un `SSH_AUTH_SOCK` reenviado al que realmente puedas llegar | la sesión en la que ya estás; credenciales RDP guardadas que `mstsc` consume en su sitio |

Lee la primera columna como la respuesta del destino a la pregunta 2, y abre solo las filas que
enciende. Un mapa que lo lista todo es la checklist contra la que va este artículo; este tiene
permitido estar incompleto porque el destino lo completa.

> **Descartado**
> `find / -type f \( -name 'id_*' -o -name '*.pem' -o -name '*.kdbx' -o -name '.netrc' \)` —
> falla en *costo de probarlo*. El conjunto es ilimitado, sin priorizar, y no responde ninguna
> pregunta del mapa: te dice qué *parece* una credencial, nunca qué autentica en `prod-app`.
> Treinta segundos en ejecutarlo, tres horas en triagear, y el triage es la parte que este
> artículo existe para reemplazar.

## El inventario

Antes de cualquier búsqueda, la pregunta de contexto — porque en estos dos branches la respuesta es
distinta, y la respuesta cambia la priorización de cada candidato:

```bash
$ id
uid=1007(deploy) gid=1007(deploy) groups=1007(deploy),999(ops)
```

```powershell
PS> whoami /groups | findstr /i "mandatory"
NT AUTHORITY\INTERACTIVE S-1-5-4 Mandatory Group
MERIDIAN\ana Mandatory Group
```

El branch A es una cuenta de servicio en el grupo `ops`. El branch B es la sesión de una persona.
No «qué secretos hay en esta caja» — **qué identidad está de pie delante de cada tienda, justo
ahora.**

### `relay` — foothold A (Linux)

| Elemento | Propósito | Se comunica con | Frontera de confianza | Deriva en |
| --- | --- | --- | --- | --- |
| `/opt/ops/id_ed25519` + `config` (ambos `0644`) | Permitir que la automatización alcance la flota sin un humano en el teclado | `prod-app` y el resto de la flota, exactamente como dice `config` | Una clave privada legible por cualquier cuenta del host — el modo de archivo es lo único que separa a `deploy` de `ops` | Un fallo de autenticación SSH: silencioso, y ausente de todo log que el equipo lee |
| `/home/ana/.bash_history` (`0644`) | Nada; es residuo | Nadie | Lo que una persona quiso hacer vs lo que el sistema registró | Nada — el history nunca es un incidente |
| `/etc/cron.d/backup` (`0644`) | Dump nocturno de base de datos | La base de datos local, a las 03:00 | Una automatización guarda una contraseña reutilizable en un archivo legible por cualquier cuenta local | Nada; el backup funciona, y por eso nadie lo ha mirado nunca |
| Dotfiles de `deploy` — `.netrc`, `.git-credentials` | Hablar con el artifact registry y el remote de git desde la CI | Registry, git | Un token con alcance para un solo sistema, viviendo en el home de una cuenta de servicio donde cualquier compromiso local lo reutiliza | Revocación ruidosa y visible — la CI se rompe a la mañana siguiente |

No está en la tabla, y no merece una segunda mirada desde *esta* identidad:

- `/etc/shadow`, `sudo -l`, `docker.sock` — falla en *precondición* y en *objetivo*. Leerlos es
  escalada de privilegios en el host que ya tengo, que es otro artículo; un root shell en `relay`
  no autentica en `prod-app`. Las claves sí.
- Los directorios `~/.ssh/` de otros usuarios — comprobado con un solo `ls` y cerrado: modo
  `0700`, su uid, no el mío. La clase existe; la puerta no, para mí.
- Los agent sockets bajo `/tmp/ssh-*/` — mismo veredicto: el directorio padre es `0700` y ni siquiera
  puedo listarlo. Un comando para establecerlo, registrado como una línea en las notas.

### `ws-ops-01` — foothold B (Windows), ejecutándose como `ana`

| Elemento | Propósito | Se comunica con | Frontera de confianza | Deriva en |
| --- | --- | --- | --- | --- |
| `%USERPROFILE%\.ssh\id_ed25519` + `config` | Alcanzar la flota desde su workstation, igual que la automatización lo hace desde `relay` | `prod-app`, según su `config` | La clave está protegida por el ACL de su perfil y nada más: sin passphrase, sin agente, sin segundo factor | Fallo silencioso de autenticación |
| Credential Manager (`cmdkey /list`) | RDP rápido a los hosts Windows que administra | Cada jump host al que se haya conectado nunca | Target y username visibles para cualquier proceso de su sesión; la contraseña está ligada a su perfil vía DPAPI | Eventos de logon RDP — y solo cuando alguien la usa |
| Blobs DPAPI — `%APPDATA%\Microsoft\Credentials`, el vault del navegador | Sus contraseñas guardadas para paneles y webs internas | Esos paneles, desde su navegador | **El contexto de usuario es el vault**: cualquier cosa ejecutándose como ella puede descifrar, nada más puede | Como mucho, una auditoría del lado de la aplicación |
| Ticket cache de Kerberos (`klist`) | SSO a todo lo que su cuenta tiene derecho a alcanzar, sin volver a teclear nada | El dominio | Un ticket bearer: quien lo posee *es* `MERIDIAN\ana` hasta que expira | Ruido de logon ordinario — invisible, porque se parece exactamente a ella |
| PSReadLine history | Nada; es residuo | Nadie | Intención vs registro | Nada |

Dos filas que merece la pena nombrar y que **no** son credenciales: `sc qc` y `schtasks /query /v`
te dicen bajo qué *principal* corre un servicio o una tarea. Eso es información de autoridad para
la tercera columna de la rúbrica — te dice de quién cazar la credencial — y es un error de categoría
archivarlo bajo «secretos encontrados».

## Del elemento al vector

Un vector responde cinco preguntas. Ni cuatro, ni seis — cinco, porque cuatro te deja saltarte la
que hace el trabajo.

1. **Actor** — qué identidad tengo en la mano ahora mismo.
2. **Precondición** — qué tiene que ser cierto ya para que esta credencial sea usable *por mí*.
3. **Primitiva** — qué autenticación única concede.
4. **Consecuencia** — qué host o principal desbloquea esa autenticación a continuación.
5. **Objetivo** — ¿me mueve hacia el destino, o solo me re-autentico donde ya estoy?

Si alguna respuesta es *desconocida* en lugar de *sí*, es una pista, no un vector. Desconocido está
bien — la mayoría de los buenos vectors empiezan desconocidos. Lo que no está bien es reportar un
secreto cuya consecuencia no puedes enunciar, porque así es como los informes acaban con una lista
de cuarenta hallazgos y sin un camino a través de ellos.

> **En pocas palabras**
> Una credencial no es un tesoro. Es la relación de una persona con una puerta, puesta por escrito.
> Antes de tocar nada, haz dos preguntas cotidianas de cada candidato: ¿de quién es esta relación, y
> ¿para qué puerta es? Si la puerta es la que ya tienes delante, has encontrado muebles. El filtro
> corre antes del trabajo — esa es toda la diferencia entre «aquí hay un lugar donde se esconden
> secretos» y «así es como decido».

### Candidato A — la llave en el directorio de automatización

- **Actor** — `deploy`, o cualquier cuenta local: la clave es `0644`, así que el grupo ni siquiera
  importa.
- **Precondición** — tres hechos, todos legibles en lugar de inferidos: el archivo existe; no
  tiene passphrase (se establece abajo); y `/opt/ops/config` nombra a `prod-app`, usuario `ops`, y
  a esta clave como identity file. La última precondición — que `prod-app` todavía honre la clave —
  es la única que no puedo leer, solo probar, y probarla es barato.
- **Primitiva** — autenticar en hosts de la flota como `ops`, desde cualquier lugar, repetidamente.
  Los fallos SSH no cuestan nada: sin lockout, sin semántica de password spray, sin evento que lea
  un humano.
- **Consecuencia** — una sesión en `prod-app` con la autoridad de `ops`: el inventario, las deploy
  keys, el material de firmado.
- **Objetivo** — `prod-app` *es* el destino. No lateral, no «interesante»: el cruce para el que
  existe este artículo.

### Candidato B — la clave en su perfil

- **Actor** — lo que se ejecute dentro de la sesión de ana. Su ACL es la precondición, y la
  satisfijo por construcción en este branch.
- **Precondición** — el archivo existe en su perfil; el cliente OpenSSH de Windows está instalado;
  la clave se lee sin pedir passphrase. Fíjate en lo que *no* es precondición: el modo de archivo.
  Su perfil no tiene un «mundo» al que conceder — la frontera es el propio contexto de usuario.
- **Primitiva, consecuencia, objetivo** — idénticas a A. Misma clase, sala diferente.

Costo de probarlo: un comando. Bajo la fórmula de prioridad este es el candidato más barato de
cualquiera de los dos branches, y va primero — no porque las claves SSH estén de moda, sino porque
el destino respondió a la pregunta 2 con «una llave» antes de que yo abriera un solo directorio.
El mapa predijo esta fila.

> **Descartado**
> Los `.netrc` y `.git-credentials` de `deploy` — falla en *traduce*. Estos autentican en el
> artifact registry y el remote de git; `prod-app` acepta claves SSH, y no voy a llevar un token de
> registry a una ceremonia de claves. Peor para mis intereses: como `deploy` ya puedo usar ambos
> tokens legítimamente. Secreto, válido, delta cero.

> **Descartado**
> La contraseña en `/etc/cron.d/backup` — falla en *traduce*. Me re-autentica en el host en el que
> ya estoy de pie, un servicio más allá. Y el requisito de honestidad: si el destino hubiera sido
> *los datos de esa base de datos* en lugar de una sesión en `prod-app`, esta fila sube al tope del
> mapa. El mapa es una función del destino — cambia el destino, re-ejecuta el mapa, no re-ejecutes
> la búsqueda.

> **Descartado**
> `cmdkey /list` en `ws-ops-01` — falla dos veces, en *primitiva* y en *traduce*. Me entrega
> nombres de targets y usernames, lo cual es información, no acceso; las contraseñas en sí están
> ligadas a su perfil vía DPAPI y no son extraíbles desde la lista. Y usarla en su sitio solo
> habla RDP — mi destino corre `sshd`. Registrado como una lista de targets para otro objetivo.

> **Descartado**
> El TGT de Kerberos que muestra `klist` — falla en *traduce*, que es el mapa funcionando tal como
> fue diseñado. El ticket es portable y tiene autoridad real — todo a lo que su cuenta tiene derecho
> — pero `prod-app` no acepta Kerberos, así que el método de la credencial y el método del destino
> nunca se encuentran. Una credencial de primera fila, inútil aquí, por una sola razón: hice la
> pregunta 2 primero.

> **Descartado**
> Su vault DPAPI — falla en *objetivo* y en *costo de probarlo*. Lo que se descifra desde su
> contexto son sus contraseñas de navegador y de aplicaciones: puertas por las que ya estoy pasando
> como ella. Descifrarlo bien necesita una herramienta ejecutada en su sesión, y el beneficio
> plausible — una contraseña reutilizada en algún sitio — está sin probar. Se queda como una pista
> con un costo declarado, no como un hallazgo.

> **Descartado**
> LSASS, el hive SAM, `reg save` de lo que sea — falla en *precondición*. Su workstation está
> gestionada; ella es una usuaria corriente en ella, y `whoami /priv` no muestra
> `SeDebugPrivilege`. Comprobarlo lleva dos minutos y se registra como una línea, no como una
> noche de arqueología de volcado de credenciales. El hábito sobrevive al descarte; solo esta caja
> no califica.

> **Descartado**
> El `cpassword` de GPP en SYSVOL — falla en *precondición*: comprobado, ausente, parcheado desde
> MS14-025. Dos minutos de `findstr /s /i cpassword` sobre `\\MERIDIAN\SYSVOL`, un resultado vacío y
> una línea en las notas. El descarte es barato; lo que cuesta es saltarte la comprobación.

### La parte que es genuinamente incómoda

Cambia las identidades y el artículo cambia de forma. En `relay`, el premio es un archivo `0644`:
*todo* usuario local lo ve, así que la priorización del branch A apenas depende de ser `deploy`. En
`ws-ops-01`, todo lo interesante está cerrado para cualquiera que no sea ana — su directorio
`.ssh`, su vault DPAPI, sus tickets. Así que el hallazgo de un branch es un servicio público y el
del otro es una cerradura, y ese asimetría no es «Linux vs Windows». Es un modo de archivo y un ACL
que dos personas diferentes eligieron en dos tardes diferentes.

Escribe las tres propiedades — destino, host, identidad — porque la lista de prioridad es función
de las tres, y cada una de las frases de abajo recibe una reacción distinta del cliente:

- «Esta es la peor credencial del host.»
- «Esta es la peor credencial del host *dado lo que pude leer con la identidad que tenía*.»
- «Esta es la peor credencial *para alcanzar el destino que nombraste*.»

Solo la tercera es la evaluación de movimiento lateral. Las otras dos son inventario.

## Ejecución

Doce comandos llevaron decisiones a través de los dos branches. Todo lo demás se omite a propósito.

**Branch A — contexto, luego la tienda a la que apuntó el mapa:**

```bash
$ ls -la /opt/ops/
```

```text
-rw-r--r--  1 root ops  412 Oct  2 01:44 config
-rw-r--r--  1 root ops  487 Oct  2 01:44 id_ed25519
```

```bash
$ cat /opt/ops/config
```

```text
Host prod-app
    HostName 10.20.4.31
    User ops
    IdentityFile /opt/ops/id_ed25519
    IdentitiesOnly yes
```

La dirección del destino, su usuario y el identity file — tres de las precondiciones del candidato
A, leídas en lugar de adivinadas. Ahora la que decide si esto es un vector o una puerta cerrada:

```bash
$ ssh-keygen -y -f /opt/ops/id_ed25519
```

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI...fQ9
```

Sin prompt de passphrase — la clave leyó su propia mitad pública y la imprimió. Las claves con
passphrase se detienen aquí con un prompt, y en un shell no interactivo, con un error; ese único
comando es toda la comprobación de precondición.

El residuo como corroboración, no como tienda:

```bash
$ grep -h 'prod-app' /home/ana/.bash_history
```

```text
ssh -F /opt/ops/config ops@prod-app systemctl status api
```

Ella conduce exactamente esta clave hacia exactamente este host, a mano. El `config` dejó de ser una
suposición.

Las dos filas con forma de credencial que el mapa dice que *no* aplican, evidenciadas en una sola
vista:

```bash
$ cat /home/deploy/.netrc; grep -n 'password' /etc/cron.d/backup
```

```text
machine artifacts.acme.test login ci-bot password glpat-9f2c...
3:0 3 * * * root /usr/local/bin/db-dump --password 's3rver-n1ghtly' >> /var/log/backup.log
```

Dos secretos, dos puertas distintas, ninguna de ellas la que tengo delante. Registrado en un
minuto, descartado en *traduce*, nunca probado — probarlos no demuestra nada que yo no sepa ya.

**El cruce, probado en silencio:**

```bash
$ ssh -o BatchMode=yes -o ConnectTimeout=5 ops@10.20.4.31 id
```

```text
uid=2001(ops) gid=2001(ops) groups=2001(ops),100(users)
```

`BatchMode` importa: rehúsa preguntar, así que esto o autentica con la clave o falla sin ofrecer
jamás una contraseña. Repetible, silencioso, y responde la última precondición en un round trip.

**Branch B — el mismo mapa, las mismas preguntas, el segundo host:**

```powershell
PS> cmdkey /list
```

```text
Target: TERMSRV/legacy-win-02
Type: Domain Password
User: MERIDIAN\ana
```

```powershell
PS> klist
```

```text
Current Logon Id is 0:0x4a211
Cached TGT  Service: krbtgt/MERIDIAN.LOCAL  Realm: MERIDIAN.LOCAL
            End time: Oct  8 19:02:11
```

```powershell
PS> whoami /priv | findstr /i seDebug
```

```text
(no output — el privilegio no está en posesión)
```

Tres filas del inventario, tres descartes, tres minutos: RDP no es el método del destino; el TGT
autentica a una identidad en un host que no habla Kerberos; la memoria de procesos volcable
pertenece a un privilegio que esta workstation nunca le concedió.

Luego la fila que el mapa sí encendió:

```powershell
PS> dir $env:USERPROFILE\.ssh
```

```text
    Directory: C:\Users\ana\.ssh

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a---                 10/2/2026   1:44        487 id_ed25519
-a---                 10/2/2026   1:44        412 config
```

```powershell
PS> type $env:USERPROFILE\.ssh\config
PS> ssh-keygen -y -f $env:USERPROFILE\.ssh\id_ed25519
```

```text
Host prod-app
    HostName 10.20.4.31
    User ops
    IdentityFile ~/.ssh/id_ed25519
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI...fQ9
```

Mismo hostname, mismo usuario, mismo material de clave que el branch A — un fingerprint de
diferencia respecto a la misma clave. Y la prueba:

```powershell
PS> ssh -o BatchMode=yes ops@prod-app id
```

```text
uid=2001(ops) gid=2001(ops) groups=2001(ops),100(users)
```

Su comprobación de `.bash_history` y su comprobación de PSReadLine devolvieron lo que el residuo
suele devolver: comandos, sin secretos. El residuo es una comprobación, no una tienda: cuesta
treinta segundos, y «vacío» sigue siendo una respuesta a la pregunta 3.

**Lo que no pude probar.** Declarado y no enterrado:

- Que nadie se diera cuenta. El éxito de `BatchMode` es silencioso *por el diseño de SSH*, no por
  garantía del SOC; yo veo solo el lado del cliente, y el informe lo dice.
- Que la clave de `ws-ops-01` esté sin passphrase por diseño y no por accidente. Observé un hecho,
  no una política; si hubiera estado protegida y sin agente en la sesión, el branch B muere en la
  precondición y el estate necesita otra puerta.
- Cualquier afirmación sobre reutilización. El token de `.netrc` y la contraseña del cron *no* se
  probaron — probarlos cuesta o nada de lo que necesito, o, en el lado Windows, presupuesto de
  lockout. La reutilización sigue siendo una hipótesis con un precio puesta encima.
- El contenido de su vault DPAPI. Descifrable desde su contexto con herramientas que no ejecuté; la
  fórmula de prioridad lo puso por debajo de un comando, así que se queda en el informe como una
  pista con su costo pegado.
- Si la configuration management re-asigna los permisos de `/opt/ops` cada noche. Leí el modo una
  vez, no longitudinalmente — un timestamp junto al hallazgo, no una garantía.

## En pocas palabras

Una empresa opera un sistema de producción, y te has metido en dos de sus salas. En el sótano, las
máquinas trabajan de noche, y alguien que montó eso dejó una copia de una llave en una estantería
abierta para que el trabajo no se detuviera — y luego nadie puso nunca la estantería detrás de una
puerta. En la oficina de arriba, una mujer guarda sus llaves en el bolsillo de una chaqueta que
solo le queda a ella, y también guarda una lista de cada puerta cuyo código ha tecclado, porque
nadie puede recordar cuarenta códigos.

Necesitas entrar en una tercera sala, en el piso de arriba. La pregunta equivocada es «qué cosas
valiosas hay en las salas en las que estoy» — podrías buscar durante una semana y encontrar doce
cosas, once de las cuales abren puertas que ya tienes. La pregunta correcta viene en tres pasos, en
este orden. ¿Qué sala necesito? ¿Qué quiere su cerradura — una llave, un código, una cara? Entonces,
y solo entonces: ¿cuál de las salas en las que estoy guarda ese tipo de cosa? La estantería del
sótano es una llave, y la sala del piso de arriba quiere una llave, así que la estantería merece
cuarenta segundos. Los códigos de la chaqueta son para otros edificios. La lista lo dice, y no los
tocas nunca — no porque los códigos no valgan nada, sino porque la cerradura que tienes delante no
los lee.

Dos puertas por las que decides no pasar. Una necesita un llavero de un club del que nunca fuiste
miembro, y comprobarlo lleva dos minutos y termina la conversación. La otra es el escritorio de un
guardia donde probablemente podrías tomar algo, pero hacerlo sonaría bajo una cámara — y la sala
que necesitas se alcanza sin sonar nada.

El hábito que vale la pena llevarte: antes de abrir un solo armario, escribe la sala a la que vas y
qué quiere su cerradura. Luego abre solo los armarios que guardan ese tipo de cosa. Las
herramientas te entregarán encantadas una lista de todos los armarios del edificio. Ni una de ellas
te dirá cuál armario guarda el tipo de cerradura que tienes delante.

## Lo que se traslada

La parte que puedes aplicar a un host que ninguno de los dos haya visto. Si no puedes responder
las nueve, no has terminado el mapa — sin importar cuántos secretos imprimió el scanner.

1. **Nombra el destino antes de tocar nada.** El siguiente host o principal, escrito. Sin destino →
   estás recolectando, no cazando, y la lista de archivos crecerá hasta que te detengas.
2. **Pregunta qué acepta el destino.** Llave, contraseña, ticket, token, sesión viva. Esa respuesta
   es el filtro, y es la única entrada que decide cuáles de las cuarenta tiendas existen *para ti
   hoy*.
3. **Abre solo las clases que el filtro enciende.** En Linux: `~/.ssh/` y las claves aparcadas en
   automatización, history, `.pgpass`/`.netrc`, cron y unit files, dotfiles de tokens. En Windows:
   su `.ssh`, `cmdkey /list`, blobs DPAPI, `klist`, PSReadLine history, configuración de tareas y
   servicios. El resto de la checklist es real e irrelevante hasta que el destino diga lo contrario.
4. **Para cada candidato, escribe qué autoridad lleva.** El principal detrás del secreto, y qué
   alcanza legítimamente ese principal. Un secreto de alto valor para un principal de baja autoridad
   es un movimiento lateral con disfraz.
5. **Pon precio a la prueba antes de ejecutarla.** Las claves SSH fallan en silencio y barato; las
   contraseñas incorrectas de Windows cuestan presupuesto de lockout y escriben eventos; los
   tokens pueden revocarse bajo los dedos de alguien. La prueba silenciosa va primero, siempre —
   el ruido pertenece al denominador.
6. **Ejecuta las cinco preguntas por candidato.** Actor, precondición, primitiva, consecuencia,
   objetivo. Consecuencia desconocida = pista, no hallazgo.
7. **Descarta con un criterio escrito, y guarda el log.** *Traduce*, *precondición*, *objetivo*,
   *costo de probarlo* — cada descarte de arriba nombra su criterio. El log de descartes es lo que
   hace que el camino superviviente haya sido elegido y no tropezado.
8. **Registra lo que no pudiste probar.** Si alguien lo vio, si el permiso está gestionado, si un
   secreto se reutiliza — cada uno es una hipótesis con un precio, y el informe debe mostrar el
   precio.
9. **Escribe la tripleta, no el hallazgo.** Destino × host × identidad. Tres frases distintas
   reciben tres velocidades de remediación distintas; solo la tercera es una evaluación de movimiento
   lateral.

Hasta dónde no llega: trata el foothold inicial como dado — cómo se obtuvo `deploy` o la sesión es
otro artículo, y también lo es la escalada de privilegios en cualquiera de los dos hosts (un root
shell que no autentica en ningún sitio no es una credencial). No dice nada sobre Active Directory
como sistema — delegación, certificate services y ataques de dominio entero son otro mapa con la
misma primera pregunta. Cubre el cruce, no el objetivo que hay detrás: lo que haces una vez que eres
`ops` en `prod-app` queda fuera de alcance. Asume tiempo — al minuto diez la lista de archivos de
un scanner le gana a un humano *en encontrar candidatos*, y está bien: ejecútala, pero como entrada
del mapa de arriba, nunca como sustituto de la pregunta 2. Y es deliberadamente silencioso primero:
un entorno sin SOC y sin política de lockout cambia el denominador, no el orden de las preguntas.
