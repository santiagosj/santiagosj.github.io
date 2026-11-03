---
title: "Cegando al guardián: la telemetría de un EDR y los fundamentos de su evasión en Windows"
description: "Los hooks de user-land de un EDR son la parte de su telemetría que puedes quitar y la que menos ve. Cómo decido si una técnica de evasión merece ser escrita — desarrollado de principio a fin sobre un sensor ficticio, incluidos los tres candidatos que descarté y el criterio que mató a cada uno."
category: "Método"
tags: ["EDR", "Windows", "Evasion", "Red Team", "Purple Team", "Syscalls"]
featured: false
date: "2026-11-03"
---

Hay un género de artículo sobre EDR que va así: aquí está `NtAllocateVirtualMemory`, estos son sus
primeros cinco bytes, así se reponen. Es correcto, está en todos los blogs dos veces, y enseña una
idea equivocada: que el hook es el muro.

El hook no es el muro. El hook es un alambre de tropiezo que un fabricante instaló dentro de *mi*
espacio de direcciones, en una página que mi proceso ya posee. Cortarlo no es la parte interesante, y
nunca lo fue. La parte interesante es qué sigue mirando después del corte.

Así que esto no es un writeup de técnica. Aquí no hay ninguna máquina ni ningún producto: el sensor
de abajo es una especificación que escribí para este artículo, descrita por comportamiento y no por
nombre, porque un nombre de producto envejece un artículo y un comportamiento no. Lo que se traslada
es el mapa — **qué capa quita una técnica y qué capa despierta esa misma técnica.** Ese mapa tiene la
misma forma en todos los sensores comerciales que he mirado desde afuera, y es la única razón por la
que vale la pena publicarlo.

## La pregunta

¿Qué lado de la frontera de rings está mirando realmente el sensor — y ciega un solo lado cuenta como
evasión?

La respuesta honesta es que la pregunta está mal planteada, y esa es la parte útil. «User-land o
kernel» solo sirve si los dos son alternativas. No lo son: son un productor y un consumidor del mismo
evento, escritos en dos momentos distintos, por dos programas distintos, con grados de confianza
distintos en el proceso que están observando. Cuando ves eso, la pregunta real pasa a ser:

> Si quito el componente que inspecciona mis llamadas, **qué queda que todavía me ve** — y la señal
> que produce quitarlo, ¿es más ruidosa que la señal que borré?

Esa pregunta tiene respuesta de sí o no para cada técnica, y fuerza un tradeoff en lugar de un
checklist. Si puedes responderla, dejas de juntar trucos y empiezas a elegirlos. Si no puedes,
terminas con un laboratorio lleno de bypasses que funcionaron en un laboratorio.

Después de leer esto deberías poder tomar cualquier técnica de evasión de user-land y completar dos
columnas: *qué sensor quita* y *qué sensor crea*. Una técnica que no puede llenar la segunda columna
no es evasión. Es un reflejo.

## El modelo objetivo

El objetivo es `sensor`, un agente ficticio de detección en endpoint sobre una estación Windows
gestionada. Existe porque lo que caza — una secuencia de syscalls ejecutada por un proceso cuyo
archivo nunca toca el cable — es invisible para cualquier cosa sentada en el borde de la red. Esa
única restricción decide todo lo demás sobre su forma.

El trabajo, descompuesto con honestidad:

- **Actores.** Yo: un proceso sin privilegios con ejecución de código, sin administrador, sin driver.
  El agente: una DLL firmada mapeada en cada proceso nuevo antes de que corra su primer hilo. El
  driver: un componente de kernel firmado con callbacks de notificación y un minifilter de sistema de
  archivos. La consola: un servidor que no puedo alcanzar. El analista: la persona que lee lo que
  sobreviva a todo lo anterior.
- **Activos que importan.** El flujo de telemetría, porque su integridad es el producto entero del
  defensor. La copia de referencia de `ntdll` en disco, porque cada chequeo de integridad del diseño
  es una comparación contra ella. Y mi propio espacio de direcciones — que poseo por la misma ley de
  propiedad que le permite a un proceso liberar su propia memoria, y que por eso es la única parte
  del mundo del sensor que tengo permitido editar.
- **Capas.** Cuatro, y fallan distinto: hooks de user-land dentro de mi proceso, callbacks de kernel
  en Ring 0, proveedores ETW que escriben desde el kernel, y un scanner que relee periódicamente las
  páginas de imagen y las compara contra el archivo que dicen ser.

Lee esa lista otra vez y fíjate dónde están los hooks. Son la única capa que vive en una página que
mi proceso puede escribir.

```text
[ my process ]
      |
      v  calls NtAllocateVirtualMemory
[ ntdll!NtAllocateVirtualMemory ]      <- first 5 bytes replaced
      |
      +--> jmp sensor.dll+0x1a2c0 ---> [ agent: inspect arguments, decide ]
                                                     |
                                                     v  if allowed
                                            [ ntdll stub body: syscall ]
                                                     |
                                                     v
                                            [ kernel ]
```

> **En pocas palabras**
> Cada oficina del edificio tiene su propia copia del reglamento, y en la primera página de cada
> copia el guardián puso un sello: pregúntame primero. Cuando un empleado quiere algo del archivo,
> lee la página de su oficina, camina hasta el guardián, y el guardián decide. El sello solo existe
> en las copias. El original en el sótano está intacto — y la oficina, después de todo, es del
> empleado.

## Los criterios de superficie

Considero que un componente es attack surface si se cumple **cualquiera** de estas condiciones. No
todas — cualquiera. Una basta para ganar una fila en el inventario.

| Criterio | Qué pregunta responde aquí |
| --- | --- |
| **Alcanzable** | ¿Vive en memoria que mi proceso puede escribir? |
| **Traduce** | ¿Toma mi llamada y la convierte en una decisión? |
| **Intermedia confianza** | ¿Actúa algo aguas abajo sobre su salida sin verificarla? |
| **Tiene autoridad** | ¿Posee un privilegio que el resto de la cadena da por hecho que tiene? |

La última es la columna que separa un alambre de tropiezo de un muro. La protección `PPL`, la firma
del driver, el consumidor de ETW — eso es autoridad, y la autoridad no es alcanzable desde Ring 3.
No se ataca: se rodea. Todo lo que sobrevive en la sección siguiente es una ruta, no una brecha, y
esa distinción es la razón por la que el artículo tiene una cuarta sección.

El primer criterio es el que la gente malinterpreta cuando lee sobre este tema. «Alcanzable» no
significa «el EDR está en la máquina». Significa «esta página concreta está mapeada como escribible
en mi proceso». Leída así, exactamente una de las cuatro capas es alcanzable desde donde estoy, y
las otras tres son contexto.

Lo cual da una fórmula, porque una rúbrica que no ordena nada es una lista:

> **Valor de evasión ≈ detecciones quitadas ÷ observables nuevos introducidos × cobertura del objetivo**

El denominador es el artículo entero. Quitar un hook cuesta un cambio de protección y, según de dónde
salgas los bytes limpios, una lectura de archivo o un mapeo de sección — y eso ocurre en capas que no
son mías para editar. El numerador es barato de sobreestimar y el término de cobertura es el honesto:
una técnica que ciega al inspector de argumentos pero deja intacto el evento de asignación cubre la
mitad del objetivo, y la mitad no es el objetivo.

> **Descartado**
> `console` — el plano de gestión del sensor. Cumple **Tiene autoridad** y nada más. Es alcanzable
> por TLS con una credencial que no tengo, no decide nada sobre mi proceso en tiempo real, y solo ve
> lo que el endpoint ya eligió enviar. Es un objetivo para otro engagement con otro actor. Se queda
> en las notas y no recibe ni una hora.

## El inventario

Siete filas, y la rúbrica es lo que le ganó a cada una su lugar.

| Elemento | Propósito | Se comunica con | Frontera de confianza | Deriva en |
| --- | --- | --- | --- | --- |
| `ntdll` (en proceso) | La puerta sancionada de Ring 3 a Ring 0; cada Native API es un stub de cuatro instrucciones | mi proceso, el gate | **Mi proceso posee la página; el sensor edita una copia que no le pertenece** | una referencia vieja, una alarma de integridad |
| `agent` (DLL del sensor) | Inspecciona argumentos y call stacks antes de que la llamada cruce | mi proceso, driver, consola | Corre dentro de un proceso cuya memoria puedo escribir | un proceso colgado, un chequeo evadido, una alerta de manipulación |
| `driver` (Ring 0) | Callbacks de proceso, hilo, imagen y objeto; minifilter de IO de archivo y red | kernel, agent, consola | Ve la syscall **después** de que cruza, sin idea de quién la emitió | un hueco de telemetría, rara vez un crash |
| `providers` (ETW, lado kernel) | Emite cargas de imagen, asignaciones y cambios de protección a medida que ocurren | kernel, consumidores | El productor no está en mi proceso; solo el consumidor lo está, y está protegido | eventos perdidos, un punto ciego |
| `scanner` | Relee las páginas de imagen cargadas y las compara contra la copia en disco | mi proceso, `disk` | Confía en el disco como referencia | falsos positivos con JIT, o silencio cuando ambos lados están editados |
| `disk` (`System32\ntdll.dll`) | La referencia intacta contra la que compara todo chequeo de integridad | todos | **Está fuera de la frontera del proceso y es legible por cualquiera** | una referencia vieja tras una actualización |
| `ppl` (proceso protegido) | Hace al agente imposible de matar desde user-land | kernel, agent | Firma, aplicada por el kernel | ningún sensor en absoluto |

Dos columnas sostienen la tabla, como siempre. **Frontera de confianza** nombra la suposición que
nadie verifica — y aquí está enunciada dos veces, en direcciones opuestas: el agente asume una página
que no posee, y el scanner asume un archivo que yo puedo leer. **Deriva en** te dice qué ya endureció
el propietario: un fabricante que envía un proceso protegido ya pagó el camino de «matar al agente»,
así que ese camino es caro a propósito y barato de prever.

Fíjate en lo que *no* está en la tabla. Ni producto, ni versión, ni CVE, ni offset de hook. Un offset
de hook es un dato sobre un build de un martes. La capa en la que vive el offset es un dato sobre el
diseño, y el diseño es lo que generaliza.

## Del elemento al vector

Un vector responde cinco preguntas. La quinta es la que mantiene honestas a las otras cuatro.

1. **Actor.** ¿Quién soy ahora mismo, con qué acceso?
2. **Precondición.** ¿Qué tiene que ser ya cierto para que esto funcione?
3. **Primitiva.** ¿Qué capacidad única me entrega?
4. **Consecuencia.** ¿Qué desbloquea esa capacidad después?
5. **Objetivo.** ¿Eso acerca a la meta, o solo hace ruido que suena a progreso?

Y en este dominio, una sexta que no está en la plantilla pero corresponde: **¿cuánto cuesta?** No en
horas — en observables nuevos. Una evasión que funciona y es detectada tiene un nombre: una
detección.

> **En pocas palabras**
> El guardián revisa a cada empleado, pero cada oficina tiene su propia copia del reglamento, y la
> oficina es del empleado. Así que solo hay dos movimientos honestos. Puedes devolver tu copia al
> texto original — el sello del guardián desaparece, y con él su chance de leer la página antes de
> que actúes. O puedes saltarte el reglamento entero, caminar hasta la puerta del archivo y abrirla
> con tus propias manos. El primero es legítimo porque la oficina es tuya. El segundo funciona
> porque la puerta nunca pidió un formulario. Ninguno de los dos apaga la cámara sobre la puerta, y la
> cámara no está enchufada a nada de tu oficina.

### Candidato A — reponer la página (API unhooking)

- **Actor** — un proceso sin privilegios con ejecución de código. Sin administrador, sin driver, sin
  firma.
- **Precondición** — el sensor hookea *mi* copia de `ntdll` (cierto por construcción), y la copia en
  disco es legible (cierto, salvo que el fabricante rompa a todos los loaders de la máquina para
  detenerme).
- **Primitiva** — el `.text` de mi proceso vuelve a los bytes de referencia del fabricante. El
  analizador desapareció de mi espacio de direcciones y no dejó rastro en la página que ocupaba.
- **Consecuencia** — desde ese momento, cada llamada a Native API que hago va derecha al gate, con
  argumentos que nadie inspeccionó.
- **Objetivo** — correr la etapa siguiente sin que el inspector de argumentos la lea. Sí, y solo eso.

```text
1. [ my process ] --read--> [ disk: System32\ntdll.dll ]        clean reference
2. [ my process ] --map section, copy .text--> [ ntdll in memory ]   the stamp is gone
3. [ my process ] --call--> [ kernel ]                          no agent on the path
```

El esbozo, y solo el esbozo — son cuatro líneas de un mecanismo, no una herramienta:

```c
NtOpenFile(&h, FILE_GENERIC_READ, &path, ...);                    /* clean copy from disk */
NtCreateSection(&s, SECTION_MAP_READ, NULL, NULL, PAGE_READONLY, SEC_IMAGE, h);
NtMapViewOfSection(s, self, &clean, 0, 0, NULL, &sz, ViewShare, 0, PAGE_READONLY);
/* NtProtectVirtualMemory on ntdll .text, then memcpy the pages, then put it back */
```

**Cuánto cuesta.** El resultado a nivel de página es perfecto: después de la copia, mi `ntdll` es
byte a byte igual al archivo, así que un scanner de integridad que compara páginas contra disco
encuentra exactamente lo que espera encontrar. Esa es la fuerza de la técnica y es real.

El costo no está en la página. Está en las dos syscalls que la dejaron así. Cambiar la protección de
una página de imagen es un evento. Leer `System32\ntdll.dll` desde un proceso que no es un loader es
un evento. Mapear `\KnownDlls\ntdll.dll` en lugar de leer el archivo quita el segundo evento y agrega
otro distinto — un handle de sección en un proceso que no tiene ninguna razón para tenerlo.

Así que la versión honesta del Candidato A es: vale la pena escribirlo cuando la segunda etapa es lo
bastante limpia como para que esos dos eventos sean la única huella que queda. Si el payload ya era
ruidoso, reponer la página no compra nada y agrega una historia.

### Candidato B — saltear la puerta (direct syscalls)

- **Actor** — el mismo proceso, el mismo acceso.
- **Precondición** — conozco el número de syscall de la función en este build, y puedo emitir una
  instrucción `syscall` desde mi propio código.
- **Primitiva** — el gate ejecuta mi pedido sin ningún stub de user-land en el camino.
- **Consecuencia** — nada en mi proceso puede inspeccionar la llamada, porque nada en mi proceso está
  entre el kernel y yo.
- **Objetivo** — lo mismo que A, menos lo último de lo que A todavía dependía: los bytes de `ntdll`.

```text
[ my process: asm stub, SSN embedded ]
        |
        |  (ntdll and its hooks are not on this path)
        v
[ syscall ] --> [ kernel, Ring 0 ]
```

```asm
; direct syscall, x64
NtAllocateVirtualMemory PROC
    mov r10, rcx
    mov eax, 18h        ; syscall number — this build only, not an API contract
    syscall
    ret
NtAllocateVirtualMemory ENDP
```

El número es todo el problema, y vale la pena ser preciso sobre por qué. Un número de syscall es un
detalle de implementación de un build. Las mismas tres funciones en el build del que los resolví:

| Función | SSN |
| --- | --- |
| `NtAllocateVirtualMemory` | `0x18` |
| `NtProtectVirtualMemory` | `0x50` |
| `NtCreateThreadEx` | `0xC1` |

Hardcodea esa tabla y tu payload se vuelve una bomba de tiempo que estalla en una actualización
acumulativa. Resuélvela en runtime y estás leyendo `ntdll` otra vez — que es o la copia hookeada (y
los hooks mienten sobre su propio número) o la copia en disco (y entonces el Candidato B carga con el
costo del Candidato A). El tercer camino, leer un stub vecino limpio y hacer aritmética, funciona solo
mientras los hooks sigan siendo saltos de cinco bytes. Cada salida de emergencia acá es una
dependencia de la cosa de la que intentas escapar.

**El refinamiento, y por qué no cierra la brecha.** En x64 la instrucción `syscall` deja la dirección
de retorno en un registro que el kernel lee al entrar. O sea que el kernel sabe *desde dónde se
ejecutó la instrucción*. Si la ejecuto desde mi propia página privada, esa dirección no está respaldada
por nada en disco. La respuesta estándar es la syscall indirecta: conservo mi stub, pero hago `jmp` a
la instrucción `syscall` dentro de un `ntdll` cargado legítimamente, para que la dirección registrada
parezca una llamada normal. Eso recupera el instruction pointer. No recupera el stack, que igual se
desenrolla hasta mi módulo, y sigue dependiendo del layout de `ntdll` de ese build. Es una técnica
mejor, no una capa distinta.

### Descartados

> **Descartado**
> `EtwEventWrite` — descartado por el *objetivo*. Parchear el event writer de user-land silencia a
> los proveedores que pasan por ahí, que son justo el conjunto que ya estaba dentro de mi proceso.
> Los proveedores del lado kernel no lo llaman: escriben desde Ring 0 y entregan eventos a un
> consumidor que no puedo alcanzar. Así que la técnica es una primitiva real apuntada a la capa
> equivocada, y su propio costo — un `EtwEventWrite` editado en un proceso que no es un debugger —
> es una firma de manipulación archiconocida. El patching de AMSI tiene la misma forma y el mismo
> veredicto.

> **Descartado**
> Matar al agente, o descargar el driver con un driver vulnerable firmado — descartado por el
> *actor*. El agente es un proceso protegido y el driver se carga en el arranque con una firma que el
> kernel aplica. Pasar cualquiera de los dos requiere una primitiva de kernel que no tengo, y
> conseguirla convierte un engagement de red team en algo que termina el engagement. Además es el
> evento más ruidoso que puede producir la máquina. Herramienta equivocada, engagement equivocado,
> señal equivocada.

> **Descartado**
> Desenlazar el módulo del PEB, o `LdrUnloadDll` sobre el sensor — descartado por la *primitiva*.
> Quita una línea de un inventario, no un acto de un log. El callback de carga de imagen se disparó
> cuando el módulo se mapeó, antes de que yo tuviera código corriendo, y esconder la entrada después
> esconde el registro de *mí*, no del sensor. Tres horas acá compran un `tasklist` más ordenado.

Los hardware breakpoints sobre el stub merecen una línea, porque alguien va a preguntar: son por
hilo, se ven en el contexto del hilo, los destruye el siguiente hilo que cree, y solo sirven contra el
hook de user-land que el Candidato B ya resuelve sin tocar un registro de depuración. Descartado por
costo.

Dos sobrevivientes de cinco, y los tres descartes no me costaron nada más que leer. Ese es el
argumento. Los criterios no están para ayudarte a encontrar más técnicas; están para que puedas parar.

## Ejecución

El sensor es ficticio, así que los eventos de abajo también lo son. Lo que no es inventado es dónde se
produce cada línea: todo lo de la segunda mitad de esta sección se emite **después** de que la llamada
ya cruzó la frontera de rings, por algo que no vive en mi proceso. Revisa la procedencia de cada bloque
antes de leer su contenido; esa asimetría es el artículo.

**El hook.** El stub como existe en el archivo en disco, y el mismo stub como existe en mi proceso.
Esta es toda la superficie de ataque del Candidato A: cinco bytes.

```text
$ objdump -d -M intel ntdll.dll | sed -n '/<NtAllocateVirtualMemory>:/,+6p'

00000000000a1c40 <NtAllocateVirtualMemory>:
  a1c40:  4c 8b d1              mov    r10, rcx
  a1c43:  b8 18 00 00 00        mov    eax, 0x18
  a1c48:  f6 04 25 08 03 fe 7f 01   test   BYTE PTR ds:0x7ffe0308, 0x1
  a1c50:  75 03                 jne    a1c55
  a1c52:  0f 05                 syscall
  a1c54:  c3                    ret
```

```text
$ (dump of the same address inside my own process)

  00007ff8`1c351c40:  e9 7b 55 0e 00   jmp    00007ff8`a1d107c0  ; sensor.dll+0x1a2c0
  00007ff8`1c351c45:  00 00 00         ...
```

Una instrucción reemplazada. `mov r10, rcx` — que lleva el primer argumento al registro que el kernel
espera — ya no está, junto con todo lo que venía después, porque el control nunca vuelve a esta
página. Por eso existe la técnica y por eso mide cinco bytes.

**El costo de A.** La lectura de archivo que trae la copia limpia:

```text
Microsoft-Windows-Kernel-File / 12  Create
  image     C:\Windows\System32\ntdll.dll
  process   app.exe (6124)   image: false
  options   Synchronous IO Non-Alert, Non-Directory File
```

Que un programa de user-space abra el loader del propio sistema desde disco no es normal, pero tampoco
es único — cada JIT, cada packer y cada instalador hace algo parecido. Este es el evento que le dice
al sensor que mire, sin decirle qué encontró.

**El costo de B.** El Candidato B quita el hook y produce esto, del lado del kernel:

```text
Microsoft-Windows-Threat-Intelligence, event 12 (ALLOCVM_LOCAL)
  process        6124  app.exe    private section, unsigned
  base           0x21a4c2f0000      size 0x2000
  rip            0x00007ff61c2a1a2c  app.exe+0x1a2c   <- not ntdll
```

Ese último campo es la huella digital de la técnica. En una llamada ordinaria apunta dentro de `ntdll`,
a la instrucción siguiente al `syscall`. Acá apunta a una página que ningún archivo en disco respalda,
y el evento lo escribió el kernel mientras mi proceso estaba bloqueado dentro de él.

**Lo que no apareció.** Ningún evento de user-land del agente, en ninguno de los dos candidatos —
porque en el primero lo quité y en el segundo nunca estuvo en el camino. Esa ausencia es la condición
de éxito, y es también la razón por la que la ausencia no le sirve de nada a un defensor: no se puede
alertar sobre una línea de log que nunca se escribió. Por eso los dos eventos de arriba, los dos de
capas que no puedo editar, son los que sostienen la detección.

**Lo que no pude probar.** Si el chequeo de integridad periódico de un producto real rehookea la
página o alerta sobre la reposición en lugar de ignorarla. Si los números de syscall que resolví
sobreviven a la próxima actualización acumulativa en un build real. Si el stack walk que hay detrás de
esos eventos habría escalado a un veredicto, en lugar de solo registrar una dirección. Si la lectura
de archivo sola habría alcanzado para detener la etapa siguiente en una consola real. Las cuatro son
incógnitas, y una incógnita en la pregunta 2 es una pista, no un resultado.

Este es el punto donde un writeup de engagement real muestra una captura de pantalla. No hay captura,
porque el objetivo no existe — y porque la salida interesante acá no es una shell. Es un log con un
agujero adentro.

## En pocas palabras

Cada oficina de un edificio grande tiene su propia copia del reglamento, y el guardián de la recepción
selló la primera página de cada copia: pregúntame primero.

Ese sello es todo el modelo de seguridad, y tiene una debilidad estructural que no tiene nada que ver
con lo bueno que sea el guardián. El sello está en *tu* copia. La oficina es tuya. En el sótano hay un
reglamento impecable, y la página en la que está impreso es exactamente la misma página — así que lo
único que tienes que hacer es cambiar tu copia por una limpia, y el sello desaparece. Nadie rompió una
cerradura. Ordenaste tu propio escritorio.

El otro movimiento es más rústico y, en cierto modo, más honesto. No consultas el reglamento en
absoluto. Pasas caminando frente al escritorio y abres la puerta del archivo con tus propias manos. La
puerta nunca estuvo revisando papeleo; simplemente se abre para quien esté parado enfrente. El trabajo
entero del guardián era leer la página que estabas por usar, y tú no usaste ninguna.

Los dos movimientos funcionan. Esa es la parte que se escribe, y también es la parte que es solo la
mitad de la historia.

Porque hay una cámara sobre la puerta del archivo, y el guardián no es su dueño. Es del edificio.
Graba a todos los que pasan, registra la hora y la credencial, y nada de eso vive en tu oficina — no
puedes cambiar su película por una copia limpia, porque no puedes entrar a la habitación donde está. El
sello del guardián era una comodidad, una forma de atrapar cosas temprano y barato. La cámara es el
registro de verdad.

Entonces, ¿qué compraron los dos movimientos ingeniosos? Quitaron un lector. No quitaron la grabación,
y en el segundo caso la cámara consiguió una toma mejor: un hombre caminando hacia la puerta desde un
ángulo desde el que nunca camina un empleado. El primer movimiento salió casi ileso, salvo que para
hacer el cambio hubo que abrir un cajón que nadie abre a esa hora, y la cámara vio el cajón.

La lección que se traslada afuera de este edificio no es «el guardián es inútil» ni «la cámara
alcanza». Es que una defensa que vive dentro de la cosa que defiende siempre puede ser editada por
quien es dueño de esa cosa, así que las únicas detecciones que vale la pena construir son las que
están escritas en algún lugar donde el atacante no tiene permitido pararse.

## Lo que se traslada

La parte que puedes aplicar a un sensor que ninguno de los dos haya visto.

1. **Nombra la capa antes de nombrar la técnica.** Hook, callback, proveedor, scanner. Cada técnica de
   este espacio resta de una capa exactamente una cosa y agrega un observable en otra. Si no puedes
   nombrar las dos, todavía no terminaste de leer la técnica.
2. **Escribe el denominador.** Detecciones quitadas sobre observables nuevos introducidos. Un bypass
   que silencia a un inspector y deja una dirección de retorno en página privada dentro del evento
   que escribe el kernel no es obviamente una ganancia, y la aritmética es lo que te lo dice.
3. **Comprueba que la referencia esté fuera de tu alcance.** El API unhooking funciona porque la copia
   limpia está en disco y el disco es legible. Todo diseño que compara estado vivo contra un artefacto
   guardado tiene este problema, y vale preguntarlo también por cachés, backups, espejos de paquetes
   e imágenes de contenedor.
4. **Prefiere la primitiva menos anómala que llegue a la misma capa.** Una syscall indirecta a través
   de un módulo cargado es mejor técnica que un `syscall` desnudo desde una página privada, no porque
   sea más ingeniosa, sino porque su huella es algo que también ocurre en software inocente.
5. **Descarta por objetivo, no por dificultad.** Si el componente que silencias no es el componente que
   te habría visto, el trabajo es teatro. Parchear el event writer de user-land es el ejemplo
   canónico: primitiva real, capa equivocada, y una firma de manipulación como regalo de despedida.
6. **Conserva los descartes.** Tres candidatos rechazados con un criterio enunciado son la evidencia
   de que los dos sobrevivientes se eligieron y no se tropezaron con ellos — y la pregunta real del
   cliente siempre es «por qué paraste ahí».

Para el otro lado de la mesa, el mismo mapa leído al revés, que es la versión purple team de este
artículo y la razón por la que tiene conclusión. Un hook de user-land es un alambre de tropiezo, no un
muro, así que una estrategia de detección que termina en Ring 3 está leyendo la copia del reglamento
del atacante. Lo que aguanta es la telemetría que el proceso no puede editar: callbacks de notificación
de kernel para eventos de proceso, hilo, imagen y handle; proveedores ETW que escriben desde Ring 0; un
minifilter delante del IO de archivos; y chequeos de integridad de imagen que saben que una reposición
perfecta también los satisface. La posición madura no es «detectar la técnica». Es «asegúrate de que la
capa que estás mirando no sea la capa que el atacante posee» — y después deja que la técnica sea la
que toque este mes.

Hasta dónde esto no llega. No dice nada sobre técnicas que van *a través* del kernel en lugar de
rodearlo — drivers firmados vulnerables, sensores asistidos por hipervisor, o cualquier cosa con una
primitiva legítima de Ring 0, donde el análisis entero cambia porque cambia el actor. No cubre el lado
de la detección que vive en el escaneo de memoria o en el scoring de comportamiento, que puede marcar
un payload sin importarle cómo llamó al kernel. No dice nada sobre `WoW64`, y el camino x86 tiene su
propia puerta y sus propios números. Y la tabla de SSN de arriba es la respuesta de un build; trátala
como ilustración de la inestabilidad, nunca como constante. Un método con límites declarados es
usable; este termina donde empieza Ring 0.
