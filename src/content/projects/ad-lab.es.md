---
title: "Un lab de AD para OSCP, y el proceso de construirlo"
description: "Un rango de Active Directory de tres VMs creado para ensayar el set de AD de 40 puntos: lo que el examen realmente pide, hasta dónde llega el lab más allá de eso, y los problemas de construcción que dieron forma al diseño."
category: "Pentesting"
team: "Red Team"
tags: ["Active Directory", "OSCP", "Vagrant", "libvirt", "PowerShell", "ligolo-ng"]
featured: true
date: "2026-10-03"
timeline: "En curso (2024 - Presente)"
githubUrl: "https://codeberg.org/santiagosj/AD-Hacking-Lab"
---

El examen son tres máquinas independientes más un set de Active Directory de tres máquinas. El set
de AD vale 40 de los 100 puntos y asume brecha: al inicio te entregan las credenciales de un usuario
de dominio de baja privilegiada, junto con la dirección del DC. Setenta puntos para aprobar. Esa
forma es la razón de la existencia de este lab.

En el examen no se puede ensayar. Tienes un solo intento para ese set de AD, y la diferencia entre
reconocer un camino en cuatro minutos y gastar cuarenta en él es casi el valor de una máquina
entera. Un lab casero es el único lugar donde el coste de equivocarse es una tarde.

Así que la pregunta que este proyecto responde es:

> Qué técnicas del examen tienen que estar presentes y ser fiables cada vez, y de cuáles se me
> permite ser lento porque no van a decidir el examen.

Todo lo que sigue se deduce de ahí. El lab no es realista y no intenta serlo. Es *repetible*, y su
alcance es la propia lista del examen, con un pequeño excedente del que soy explícito.

## El contexto

Un operador, un host Linux que es a la vez el hipervisor y el atacante, tres VMs:

| Host | Rol | Interfaces | Rol en el examen que representa |
|------|------|-----------|---------------------------|
| `DC01` — Server 2019 | Domain Controller para `oscp.exam` | interna `10.10.172.140` | Máquina 3 — el DC, `proof.txt` |
| `MS01` — Server 2019 | Servidor web/app dual-homed | DMZ `192.168.56.141`, interna `10.10.172.141` | Máquina 1 — punto de entrada y origen del pivot |
| `MS02` — Windows 10 Enterprise | Estación de trabajo interna | interna `10.10.172.142` | Máquina 2 — objetivo de movimiento lateral |

Tres máquinas, 2 GB y 2 vCPU cada una, las tres respondiendo a la forma del set de AD del examen:
foothold, objetivo de pivot, Domain Controller. La posición de partida es una sola cuenta de dominio
de baja privilegiada.

Una diferencia deliberada con el examen, porque fingir lo contrario sería deshonesto: el examen te
entrega credenciales y ya estás dentro. Este lab te empieza fuera, sin nada, y te obliga a ganarte el
dentro. Es más estricto que el examen a propósito. El examen no me deja ensayar el approach, y un lab
casero es el único lugar donde el error caro es asequible. El pivoting también es evaluado por
separado, así que el túnel aquí no es adorno — es la parte de la cadena con la que más quería dejar de
pensar.

## Las restricciones

| Tipo | Restricción |
|------|-----------|
| Dura | El host *es* el hipervisor. libvirt pone al host en cada bridge que crea, y Vagrant necesita una red de gestión para aprovisionar por WinRM. |
| Dura | Los invitados Windows se reinician varias veces durante el aprovisionamiento, y el timeout de WinRM por defecto de Vagrant asume una máquina arrancando sola. |
| Presupuesto | 6 GB de RAM en tres VMs en una sola estación de trabajo. Un reset tiene que caber en una tarde. |
| Superficie | Las comodidades del propio lab no deben convertirse en el camino que yo recorro. Una regla de firewall que aísla el rango pero también mata el pivot enseña exactamente la lección equivocada. |
| Alcance | La lista de AD del examen es la especificación. Cualquier cosa fuera de eso es un extra, y los extras tienen que etiquetarse como extras. |
| No-objetivo | Realismo. Un solo bosque, sin trusts, configuraciones mal plantadas, sin telemetría. |

### Alcance del examen frente al resto

La lista de foco actual para el set de AD es más o menos: AS-REP roasting, Kerberoasting, password
spraying, abuso de ACL (`ForceChangePassword`, `GenericAll`, `GenericWrite`, `WriteOwner`,
`WriteDACL`), ADCS con `certipy-ad` para ESC1 y ESC8, `SeImpersonate` a SYSTEM vía una potato,
volcados de NTDS con `SeBackupPrivilege`, Pass-the-Hash y Pass-the-Ticket, `secretsdump`, DCSync,
abuso de MSSQL y pivoting. Por encima de esa línea están las cadenas de printerbug con delegación sin
restricciones, cadenas de ADCS más profundas, `BadSuccessor` y dMSA.

Mapear el lab contra esa línea es incómodo en una dirección y tranquilizador en la otra:

| Plantado o planeado | Estado |
|--------------------|--------|
| SPNs en tres service accounts | En alcance. Sesión completa. |
| Cuenta sin pre-authentication | En alcance. La recolección funciona, el cracking sigue pendiente. |
| Pass-the-Hash entre máquinas | En alcance. Sesión completa. |
| `SeImpersonate` en `MS01` → SYSTEM | En alcance. Sesión completa. |
| Extracción de credenciales con Mimikatz | En alcance. Sesión completa. |
| Pivoting sobre ligolo-ng | En alcance. Ejercitado constantemente, que es el punto. |
| `ForceChangePassword`, `GenericAll` en la OU de IT | En alcance. Sembrado, sesiones aún sin ejecutar. |
| Derechos DCSync en una cuenta | En alcance. El final previsto. |
| MSSQL en `MS02` con `xp_cmdshell` | En alcance. Sembrado, sesión aún sin ejecutar. |
| Recolección con BloodHound y consultas de camino más corto | En alcance. Sesión aún sin ejecutar. |
| Delegación sin restricciones en `MS01` | **Más allá** de la línea central. Se mantiene porque es como quiero entender las cadenas de printerbug. |
| RBCD `MS01$` → `MS02$` | **Más allá.** Esta se ganó su lugar — ver abajo. |
| ADCS / `certipy-ad` ESC1 y ESC8 | **En alcance y ausente.** No existe ninguna CA en ninguna de las tres VMs. Esta es la brecha real. |

Esa última fila es la honesta. El examen espera ejercitación de ADCS y mi lab no puede ensayarla,
porque nunca levanté una certificate authority. Todo lo demás de la lista está construido o planeado;
esa falta, y no es un error de redondeo: `ESC1`/`ESC8` son el tipo de hallazgo que un solo comando de
enumeration pone a la vista, y una cadena larga no.

Dos de los extras resultaron más valiosos de lo que esperaba. RBCD importa porque convierte un camino
exclusivo de Windows en uno de Kerberos, que es justo el pivot que quería ensayar. La delegación sin
restricciones está en la lista de excedente, así que se queda etiquetada como extra en lugar de inflar
discretamente la cobertura aparente del lab.

## Los componentes

| Componente | Responsabilidad | Falla en |
|-----------|----------------|-----------|
| `Vagrantfile` | Tres VMs, tres redes libvirt, MAC fija por red privada | El aprovisionamiento configura el NIC equivocado |
| `scripts/provision/dc/*.ps1` | Promover el DC, sembrar usuarios, SPNs, ACLs, delegación, RBCD | No existe ningún camino de ataque |
| `scripts/provision/ms01/*.ps1` | Dirección dual-homed, unión al dominio, servicios web, `SeImpersonate` | El punto de entrada no funciona |
| `scripts/provision/ms02/*.ps1` | Dirección interna, unión, artefactos de post-explotación | Las rutas de credenciales y SAM faltan en silencio |
| `scripts/02_deploy.sh` + `provision.ps1` | Orden de fases entre VMs, espera de WinRM a través de los reinicios | Un bosque a medio aprovisionar que se ve bien |
| `scripts/host/isolate_internal.sh` | nftables: bloquear host → interna, acotado a la interfaz de libvirt | Me salto el pivot por completo |
| `scripts/host/ligolo_tunnel.sh` | Diagnosticar y arreglar la precedencia de TUN frente a la ruta conectada | El túnel está "Online" y no lleva nada |
| `tools/evil-winrm-ruby33-fix.rb` | Cliente incluido, parcheado para Ruby 3.3 | Cada sesión empieza con un crash |
| `docs/*` | Referencia de ruteo, registro de incidencias, instantánea del lab | El conocimiento se queda en mi cabeza y deriva |

## Del requisito al diseño

La decisión pivotal es cómo hacer que la red interna sea inalcanzable desde mí sin romper el túnel,
que es la única forma de llegar a ella. Ambos requisitos son innegociables y tiran en direcciones
opuestas, y eso es lo que convierte esto en un problema de diseño y no en una tarea de configuración.

**Rechazado — quitar la dirección del host del bridge interno.** La restricción que lo mató: el
bridge de libvirt existe *para que el host pueda alcanzar a los invitados*, y la capa de gestión WinRM
de Vagrant depende exactamente de eso. No existe un bridge sin host en este modelo. Editar el XML de
red a mano tampoco es duradero, porque Vagrant recrea las redes de libvirt en cada `vagrant up`.

**Rechazado — filtrar por CIDR de destino.** Esto satisface el aislamiento y mata discretamente el
pivot, porque todo el trabajo del túnel es hacer que el host emita paquetes genuinos hacia
`10.10.172.0/24` a través del dispositivo TUN, y una regla que diga "descartar el tráfico hacia este
destino" también los atrapa:

```bash
# What I wrote first. Isolation: perfect. Pivot: dead.
nft add rule inet lab-isolate output ip daddr 10.10.172.0/24 drop
```

El modo de fallo es malvado porque la herramienta miente. ligolo-ng reporta el túnel `Online`, su
contador TX sube porque de verdad está transmitiendo a un agujero negro, RX nunca se mueve, y `nmap`
llama `filtered` a cada host interno. Pasé un largo rato convencido de que el túnel estaba roto. El
túnel estaba bien. Mi propio firewall se lo estaba comiendo.

**Elegido — acotar las reglas a la interfaz de libvirt.** Casar sobre el camino, no sobre el destino:

```bash
nft add rule inet lab-isolate input  iifname "virbr3" ip saddr 10.10.172.0/24 drop
nft add rule inet lab-isolate output oifname "virbr3" ip daddr 10.10.172.0/24 drop
```

Todo uso legítimo de ese destino sale por otra interfaz. Solo la ruta directa sale por `virbr3`. Los
propios hooks de input/output del host ven tráfico del host, no el forwarding L2 del bridge, ni lo que
`MS01` reenvía en mi nombre, así que el pivot sobrevive intacto. El bridge también se detecta por la
dirección que lleva en lugar de hardcodearlo como `virbr3`, porque la numeración de bridges sigue el
orden de creación y se desplazaba cada vez que añadía una red.

> **En pocas palabras** Cerré con llave la puerta principal del edificio y luego rompí mi propia
> llave. La regla que escribí primero era "nada va a esa dirección" — cierta, e igual de cierta para
> el túnel que debía usar para llegar ahí. El túnel seguía diciendo CONNECTED, porque desde donde
> estaba realmente estaba entregando paquetes y viéndolos desaparecer. Lo que lo arregló fue hacer
> una pregunta más estrecha: no *a dónde va este paquete* sino *por qué puerta sale*. Una puerta
> está cerrada. El túnel usa otra. Ambas son ciertas a la vez, y ahora lo son.

**Segunda colisión — la capa de gestión.** Vagrant aprovisiona sobre `192.168.121.0/24`, que es una
segunda carretera desde el host directo a las máquinas internas. Cerrarla rompe `vagrant up`. En
lugar de sacrificar un requisito, esto se convirtió en un toggle documentado: `--mgmt` abre la
carretera para el ciclo de vida del lab, y el aislamiento está activado por defecto para las sesiones
de ataque. Hay que reaplicarlo después de cada `vagrant up`, que es exactamente el tipo de filo agudo
que pertenece a un README y no a la memoria.

**Tercera — la ruta conectada se impone sobre el túnel.** Incluso con reglas correctas, el tráfico
seguía saliendo por el bridge, porque libvirt le da al host `10.10.172.1/24` en `virbr3` y el kernel
la instala como ruta conectada con métrica 0. Cuando ligolo añade su ruta para el mismo prefijo, o
falla o pierde. Así que la solución es preguntarle al kernel qué dispositivo usaría en realidad, y
leer la respuesta con precisión — tres resultados, no dos:

```bash
ip route get 10.10.172.140
# via the TUN    -> correct, traffic will be tunnelled
# dev virbr3     -> wrong, still direct, this is the metric-0 route shadowing the TUN
# via gateway    -> worse, traffic is leaving the host, the isolation is not holding
```

El tercer veredicto es el que importa. "Túnel roto" e "aislamiento roto" se ven idénticos desde
`nmap`, y solo la respuesta de ruteo los distingue. Borrar y volver a añadir es acotado a la sesión a
propósito: después de `vagrant up` la ruta conectada vuelve, y prefiero que el entorno diga la verdad
a que un arreglo obsoleto oculte un estado roto.

## Implementación

### Cómo arrancó

El Vagrantfile fue la parte fácil y el que más tardó en volverse aburrido. Tres VMs, libvirt con
VirtualBox como fallback, y tres redes separadas — DMZ, interna, y la propia red de gestión de Vagrant
con la que luego gastaría mucho esfuerzo en fingir que no existe.

La parte que no fue aburrida fue WinRM. Tres máquinas Windows reiniciándose durante la promoción y la
unión al dominio, todas en paralelo, está muy por encima de lo que asumen los defaults de Vagrant. La
solución fue poco glamorosa y efectiva: un timeout de arranque de 1200 segundos y cuarenta
reintentos de conexión con quince segundos de separación, que compran diez minutos de que el invitado
realmente responda.

Luego la red. Arreglada dos veces — una por las reglas de aislamiento, otra por la precedencia de
rutas — y los dos commits del historial son el mismo problema desde ángulos distintos. Esa es la forma
honesta de la construcción: el dominio arrancó bastante sin fricción y la red me peleó todo el camino.

Luego vinieron el orden y la idempotencia, porque tres VMs reiniciándose a lo largo de nueve fases es
donde nace "en mi máquina funciona". Las fases están ordenadas, las dependencias entre VMs son
explícitas, y la configuración de NIC se indexa por la MAC fijada en el Vagrantfile en lugar del
orden de enumeración, que no es estable en una box recién imageada:

```powershell
$dmzMac      = "52:54:00:ad:00:11"
$internalMac = "52:54:00:ad:00:12"

$adapters = @(Get-NetAdapter |
    Where-Object { $_.Status -eq "Up" -and $_.InterfaceDescription -notlike "*Loopback*" } |
    Sort-Object ifIndex)

$dmzAdapter      = $adapters | Where-Object { $_.MacAddress -eq $dmzMac }      | Select-Object -First 1
$internalAdapter = $adapters | Where-Object { $_.MacAddress -eq $internalMac } | Select-Object -First 1
```

La selección por posición sobrevive como fallback para las VMs anteriores a las MACs fijadas, que es
la versión honesta de "funciona de cualquier forma". La división de DNS dual-homed es el detalle
discreto que sostiene todo: el adaptador interno recibe una interface metric más baja para que
`dc01.oscp.exam` resuelva a través del DC en lugar del resolver de la red de gestión. Si lo pones al
revés, la resolución de nombres de Kerberos se vuelve extraña de formas que parecen un problema de
Kerberos.

### Las partes que se defendieron

**Una herramienta que crasheaba cada sesión.** El Ruby de Kali se había movido a la 3.3, que usa
Reline, y evil-winrm asumía un string `Readline.line_buffer`. Bajo Reline devuelve `nil`, y el
cliente moría en el primer prompt. Ninguna release upstream lo arregló, y Kali distribuye una sola
versión. Parchee el binario y lo incluí en `tools/`. Lo que vale la pena recordar es que solo un call
site estaba realmente roto — los demás ya eran nil-safe, porque `nil =~ regexp` evalúa a `nil` en
lugar de lanzar un error. Leí el código en lugar de parchear a escopetazos cada aparición.

**Un volcado que devolvió nada, y que parecía un problema de la herramienta.** `sekurlsa::logonpasswords`
de Mimikatz volvía vacío en `MS01` mientras todo lo demás funcionaba, que es exactamente la forma de
"herramienta equivocada". No era la herramienta. El método basado en servicios para simular un logon
interactivo seguía muriendo porque un servicio cuyo binario es `cmd.exe` es terminado por el SCM, y
`sc.exe` no concede `SeServiceLogonRight` a una cuenta de dominio. El reemplazo es una scheduled task
más una concesión explícita de derechos, alcanzada mediante un pequeño P/Invoke, ya que PowerShell no
tiene su propio binding para el LSA policy handle:

```powershell
Add-Type @"
[DllImport("advapi32.dll", SetLastError = true)]
static extern uint LsaAddAccountRights(IntPtr PolicyHandle, byte[] AccountSid,
    LSA_UNICODE_STRING[] UserRights, uint CountOfRights);
"@
```

**Una protección que documenté como apagada y estaba encendida.** El aprovisionamiento desactivó el
monitoreo en tiempo real de Defender en `MS02`. En Windows 10, Tamper Protection revierte eso en
silencio, y `-ErrorAction SilentlyContinue` se tragó el fallo — el log de aprovisionamiento decía
"done" mientras ocurría lo contrario. El mismo comando se mantiene en `MS01`, porque ahí es Server
2019. Así que el lab estaba internamente inconsistente y la inconsistencia era invisible desde los
logs.

No pude ganarle. La llamada a la política devuelve `E_NOTIMPL`, las escrituras en el registro se
deniegan incluso como admin local, y una scheduled task corriendo como SYSTEM se revertía de todos
modos. Así que el objetivo cambió. En lugar de *desactivar el antivirus*, el lab ahora garantiza una
exclusión persistente y deja que la protección en tiempo real siga activa:

```powershell
Add-MpPreference -ExclusionPath 'C:\Users\celia.almeda\Documents'
```

Un binario depositado ahí se ejecuta; el mismo binario en cualquier otro lado es bloqueado por firma.
Eso se acerca más a un engagement real, donde el AV está encendido y tienes que trabajar con él.

**Deriva, que es la lección a la que sigo volviendo.** Más tarde el lab dejó de coincidir con su
propia snapshot. Un archivo de credenciales documentado en una carpeta compartida no existía. Un árbol
`windows.old` para el volcado offline de SAM había desaparecido. Un log de aprovisionamiento era
ilegible. Las consultas WMI devolvían access denied.

La causa raíz fue mi propio script de seeding. Escribía el historial de PowerShell y las sticky notes
usando el `APPDATA` de *la cuenta que ejecuta el aprovisionamiento* — que por `vagrant winrm` es
`vagrant` — y no la cuenta con la que yo inicio sesión. Los artefactos existían. Estaban en la casa
del usuario equivocado. Una ACL en `C:\Users\Public` tampoco era la por defecto, por lo que un
listado de directorio denegaba un token que tenía todo el derecho de estar ahí.

Arreglarlo en vivo significó entrar por la NIC interna con admin local, porque el puerto WinRM de
gestión estaba caído. Restaurar la ACL de `Public`, recrear el archivo y reconstruir el backup del
registry hive hizo que la snapshot y la máquina volvieran a coincidir.

> **En pocas palabras** Gasté tiempo real leyendo mis propias notas y creyéndolas. El antivirus estaba
> escrito como apagado. Estaba encendido. Un archivo de credenciales estaba escrito en una carpeta
> compartida. No estaba ahí, porque se había escrito en la cuenta que montó el lugar y no en la cuenta
> en la que yo estaba sentado. Y una carpeta que debería ser legible por todos no lo era, porque
> nadie había mirado nunca sus permisos. Leer mi documentación se sentía como progreso y estaba más
> cerca de lo contrario. Lo que realmente necesitaba era un check que fallara ruidosamente, no una
> descripción que se leyera bien.

## En pocas palabras

Es un campo de entrenamiento con un edificio principal y un cobertizo al frente. Me entregan la llave
del cobertizo y cierran con llave la puerta del edificio, y todo el trabajo consiste en asegurarse de
que la cerradura es real.

Lo primero que hice mal fue cómo la cerré. Escribí la regla como "ningún paquete va a la dirección del
edificio", que es cierta y también cierta del túnel que debía usar para llegar ahí. El túnel seguía
reportando CONNECTED, así que durante mucho tiempo culpé al túnel, al driver TUN, al proxy, a la
subred. Ninguno estaba roto. Mi propia cerradura estaba puesta sobre la llave.

La solución fue dejar de preguntar *a dónde va este paquete* y empezar a preguntar *por qué puerta
sale*. Una puerta está cerrada, el túnel usa otra, y ambas afirmaciones pueden ser ciertas a la vez —
que es lo que no podía ver mientras solo pensaba en direcciones.

La segunda cosa que el lab me enseñó es sobre alcance. Sembré una docena de caminos de ataque y por
un momento pareció que el lab cubría el examen. Al compararlo con la lista real, un ítem significativo
simplemente no estaba: nunca construí una certificate authority, así que el material de ADCS que se
espera que sepa no tiene dónde ocurrir. Tener los caminos no es lo mismo que haber cubierto la lista,
y solo escribir los uno al lado del otro mostró eso.

## Qué haría de otra forma

**Lo que me llevo.**

- Asegura el estado objetivo, no lo describas. "Tamper Protection está desactivado" es una
  afirmación; un check que lee el valor y falla es una prueba. La snapshot es un punto de partida, no
  un estado garantizado.
- Falla ruidosamente siempre que la validez del lab dependa de un paso. Un
  `-ErrorAction SilentlyContinue` sobre un cambio de security-setting fue lo que permitió que un
  falso "Defender off" sobreviviera meses.
- Siembra los artefactos en la cuenta que los va a leer. Todos los problemas de rutas que encontré
  vinieron de escribir archivos relativos a quien ejecutó el setup.
- Escribe la tabla de alcance del examen antes de construir y mantenla en el repo. Habría encontrado
  la CA faltante en un día en lugar de a la hora de escribir el write-up.
- Fija todo lo que no fijé. Las MACs y las IPs están fijadas; las box images y el Ruby se me
  deslizaron por debajo.
- Mueve los scripts de NIC de cada VM dentro de las box images. Solo existen para asignar direcciones
  que deberían estar en un archivo unattend, y son la fuente de todos los bugs de adaptador
  equivocado que he tenido.

**Límites de lo que este lab demuestra.**

- Ensayo el reconocimiento, no el descubrimiento. Todos los caminos de aquí fueron plantados, así que
  no practico encontrar configuraciones malas que nadie escribió — que es la mitad más difícil del
  trabajo.
- Un solo set de AD no es la varianza del examen. Un solo bosque, sin trusts, sin ADCS, así que nada
  de aquí dice nada sobre caminos multi-dominio o basados en certificados.
- Sin capa de detección, así que nada se traslada al lado azul. No puedo reclamar lo que no construí.
- Las sesiones 1 y 2 están genuinamente completas. Las sesiones 3 a 8 están sembradas y sin ejecutar,
  así que la tabla de alcance de arriba registra intención en la mayoría de las filas, no
  verificación.
- El arreglo del túnel está acotado a la sesión por diseño. Cada `vagrant up` restaura la ruta
  conectada, así que el lab puede fallar de una forma que parece un bug y en realidad es el lab
  comportándose como fue diseñado.
