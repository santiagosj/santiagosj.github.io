---
title: "El attack surface no es una lista de puertos"
description: "Un puerto te dice que algo está escuchando. No te dice para qué sirve el sistema. Cómo decido qué atacar, desarrollado de principio a fin sobre un portal de documentos ficticio — incluidos los dos candidatos que descarté y por qué."
category: "Método"
tags: ["attack surface", "threat modeling", "web", "recon"]
featured: true
date: "2026-10-03"
---

Existe un género de writeups de pentest que empieza con un copia-pega de `nmap` y termina con una
root shell, y en medio hay una lista de cosas que se probaron. Es un género útil. También es, en
aggregate, casi ruido: la máquina en cuestión no tiene futuro, y el lector no puede saber cuál de
los 200 comandos importó.

Así que esto no es eso. Aquí no hay ninguna máquina. El objetivo de abajo es una especificación que
escribí para este artículo, y existe para demostrar un punto: **no puedes decidir qué atacar antes
de decidir para qué sirve la cosa.** Todo lo que viene después — la recon, el vector, la prioridad —
sale de esa única decisión.

## La pregunta

¿Debe la enumeration ir antes o después de que entiendas qué hace el sistema?

La respuesta honesta es que la pregunta está mal planteada, y esa es la parte útil. «Antes o
después» solo tiene sentido si la enumeration es una fase a la que puedes señalar. Cuando dejas de
tratarla como una fase, la pregunta real se convierte en:

> Dado para qué sirve este sistema, **qué está exponiendo a propósito** — y en cuál de esas
> exposiciones el propietario confía en algo que nadie está comprobando de verdad.

Si puedes responder eso, nunca necesitaste un escáner para saber dónde mirar. Si no puedes, ningún
volumen de escaneo te llevará ahí — solo te entrega una lista más larga de cosas que todavía no
puedes priorizar.

Después de leer esto deberías poder tomar un sistema que no conoces, escribir su inventario con la
forma de la tabla de abajo, y descartar candidatos usando un criterio escrito en lugar de una
intuición.

## El modelo objetivo

El objetivo es `portal.acme.test`, un portal de documentos B2B ficticio. Los partners suben estados
de cuenta mensuales; el portal los analiza, los almacena y permite que el personal de cada tenant
los vuelva a leer.

El trabajo, descompuesto con honestidad:

- **Actores.** Un visitante anónimo. Un uploader partner — una cuenta real y de bajos privilegios,
  emitida por empresa. Un miembro del personal de un tenant que lee documentos. Un operador interno
  de backoffice.
- **Activos que importan.** Documentos de tenant (confidenciales), la propia frontera entre tenants
  (quién puede ver los datos de quién), y la capacidad del importer de escribir en el almacenamiento
  sin que nadie se dé cuenta.
- **Componentes.** Un proxy que termina TLS y que también sirve assets estáticos; un servidor de
  aplicaciones que mantiene sesiones y autorización; un volumen de archivos servido directamente por
  ruta; Postgres como sistema de registro; un worker en segundo plano que ingiere los archivos
  subidos; un drop al que los partners envían por SFTP; y un binario de conversión al que el worker
  llama desde la shell.

No te voy a dar un escaneo de esta cosa. Te voy a dar las siete preguntas que hago sobre cada
componente, y la respuesta a cada una aquí.

> **En pocas palabras**
> Imagina un almacén de documentos compartido. Las empresas dejan cajas de papeleo en una
> recepción de correo, un empleado abre cada caja, copia los números al sistema e imprime una copia
> limpia para la empresa que la envió. El empleado trabaja solo, de noche, y nunca comprueba si la
> caja fue realmente enviada por la empresa que dice ser. Todo este artículo trata sobre ese
> empleado.

## Los criterios de superficie

Considero que un componente es attack surface si se cumple **cualquiera** de estas condiciones. No
todas — cualquiera. Una basta para ganar una fila en el inventario.

| Criterio | Qué pregunta responde |
| --- | --- |
| **Alcanzable** | ¿Puede un actor cuyas credenciales tengo enviarle bytes y que sean interpretados? |
| **Traduce** | ¿Toma entrada y la convierte en otra cosa — una consulta, un comando, una ruta, un documento renderizado? |
| **Intermedia confianza** | ¿Confía algo aguas arriba en su salida sin verificarla? |
| **Tiene autoridad** | ¿Posee credenciales, claves o un privilegio que otros componentes dan por hecho que tiene? |

La tercera es la que más peso tiene, y es la que la salida de un escaneo nunca te cuenta. Un
componente intermedia en la confianza cuando se sitúa entre los datos de una parte y la suposición
de otra. El importer en este objetivo intermedia en la confianza — la aplicación confía en la base
de datos donde el importer escribió, sin saber que la fila que el importer persistió se la entregó
un partner.

**La alcanzabilidad por sí sola no es un filtro, es una precondición.** Hay muchísimas cosas
alcanzables y ninguna importa. Por eso los criterios producen un conjunto, no un ordenamiento, y el
ordenamiento ocurre aquí:

> **Prioridad ≈ alcanzabilidad × capacidad × radio de impacto ÷ costo de probarlo**

El denominador es la parte que la gente se salta. Un vector que necesita nueve horas de extracción
booleana a ciegas para demostrar que puedes leer tus *propios* datos es peor que un vector que
tarda veinte minutos y lee los de otro. La fórmula no es sagrada. El hecho de escribirla sí lo es.

> **Descartado**
> `edge` — la interfaz de gestión del proxy en `8443`. Cumple **Alcanzable**, y nada más. Devuelve
> el mismo `403` para toda ruta y todo método, y responder al "por qué" requiere credenciales que
> nadie me dio. Es una pista. Se queda en las notas y no recibe ni una hora.

## El inventario

Los criterios, aplicados. Siete componentes, y la rúbrica es lo que le ganó a cada uno su fila.

| Elemento | Propósito | Se comunica con | Frontera de confianza | Deriva en |
| --- | --- | --- | --- | --- |
| `edge` | Termina TLS, enruta por ruta, sirve assets estáticos | Navegador, `app`, `files` | Internet → red interna; el único borde intencionado | 502, páginas lentas |
| `app` | Sesiones, autorización, renderiza la UI, sirve descargas | `edge`, `db`, cola, `files` | Usuario con sesión → documentos de otros tenants | 500, datos incorrectos mostrados |
| `files` | Sirve documentos generados por ruta, sin autenticación, directamente del disco | `edge`, worker | **Cualquiera que tenga una ruta** — sin lógica de aplicación por delante | 403/404, o un documento filtrado |
| `db` | Sistema de registro: tenants, documentos, filas de auditoría | `app`, `importer` | La app confía en las filas que escribió el importer | Pérdida de datos, datos entre tenants |
| `importer` | Lee las subidas de los partners, mapea columnas, escribe en `db`, genera PDFs | `drop`, `db`, `files`, `converter` | **Contenido de archivo escrito por un partner → valores que persiste un proceso privilegiado** | Trabajos atascados, filas malas en silencio |
| `drop` | Zona de aterrizaje a la que los partners envían estados de cuenta por SFTP | Partners, `importer` | Parte externa → sistema de archivos interno, sin app por medio | Archivos obsoletos, archivo de la empresa equivocada |
| `converter` | Convierte las filas almacenadas en un PDF | `importer` | Un string que vino de entrada del usuario se convierte en argumento de un proceso | Conversiones fallidas, worker colgado |

Dos columnas sostienen toda la tabla. **Frontera de confianza** nombra la suposición que nadie está
verificando. **Deriva en** te dice qué ya endureció el propietario, que es donde están los agujeros:
nadie escribe un reintento alrededor de una impresora de PDF que espera que funcione siempre, y
nadie valida los nombres de columna de un CSV que sus partners nunca han usado mal.

Fíjate en lo que *no* está en la tabla. No hay `admin panel`, no hay `nginx/1.18.0`, no hay CVE. El
número de versión no es la superficie. La pregunta "¿esta cosa permite que contenido no confiable
se convierta en algo más poderoso?" es la superficie, y la versión es como mucho una pista sobre la
respuesta.

## Del elemento al vector

Un vector responde cinco preguntas. No cuatro, no seis — cinco, porque con cuatro te salteas la que
hace el trabajo.

1. **Actor.** ¿Quién soy yo ahora mismo, con qué credenciales?
2. **Precondición.** ¿Qué tiene que ser ya cierto para que esto funcione?
3. **Primitiva.** ¿Qué capacidad única me entrega?
4. **Consecuencia.** ¿Qué desbloquea esa capacidad después?
5. **Objetivo.** ¿Eso acerca a la meta, o solo va hacia un costado?

Si alguna respuesta es *desconocida* en lugar de *sí*, tienes una pista. Desconocido está bien —
muchos buenos vectores empiezan siendo desconocidos. Lo que no está bien es entregar un hallazgo
cuya consecuencia no puedas enunciar, porque así es como los informes terminan con severidad crítica
y nada debajo.

### Candidato A — el pipeline de importación

Sigue el marcador `Brokers trust` del inventario. `importer` es el único componente donde la entrada
de una parte externa de bajos privilegios se convierte en un valor en el que `app` confía después.

> **En pocas palabras**
> El empleado toma la caja, lee las etiquetas de las columnas y archiva los números bajo esas
> etiquetas. Nadie le dio al empleado una lista de etiquetas permitidas. Así que si pongo una
> columna nueva en mi caja con un nombre que el sistema usa para otra cosa, el empleado archiva mi
> número también bajo ese nombre — y después la oficina lo usa para encontrar un armario en el ala
> de otra persona.

- **Actor** — uploader partner. Una credencial real, emitida legítimamente a mi nombre, para un
  tenant.
- **Precondición** — el importer mapea las columnas del CSV por el nombre de la cabecera, y la fila
  resultante se persiste sin aplicar una allowlist a las claves.
- **Primitiva** — escribir un string elegido por el atacante en una columna que la aplicación trata
  como localizador de almacenamiento.
- **Consecuencia** — el endpoint de descarga construye una ruta a partir de ese valor. Controlo
  parte de una ruta que nunca debí controlar.
- **Objetivo** — leer un documento perteneciente a otro tenant. Ese es el objetivo. No
  "interesante", no "un hallazgo": *acceso no autorizado a los datos de otro tenant*, en una sola
  petición.

### Candidato B — IDOR entre tenants en el endpoint de descarga

- **Actor** — usuario del personal de un tenant. Precondición: una sesión válida en un tenant.
  Primitiva: se devuelve un ID de documento incremental en lugar de uno con scope de tenant.
- **Consecuencia, objetivo** — igual que A. Leer el documento de otro tenant.

Mismo objetivo, primitiva más barata, pero un actor estrictamente peor: requiere una cuenta de
personal en lugar de la credencial del uploader, y depende de que los identificadores sean
adivinables — lo cual es una *suposición* hasta que veo la respuesta. La precondición de A es
visible en el path de código que ya me interesa; la de B es una conjetura sobre el diseño de otro.

> **Descartado**
> `id` en `/api/documents/{id}` — descartado por el *costo de probar*. Los IDs secuenciales pueden
> o no ser adivinables, y el "puede o no" es una **pista** bajo la pregunta 2, no un vector. Va al
> informe como recomendación para que el equipo lo confirme, y me quedo mi hora para el Candidato A,
> cuya precondición puedo leer en lugar de inferir.

### Candidato C — inyección en el cuadro de búsqueda del tenant

- **Primitiva** — si es inyectable, lectura/escritura a través del propio rol de base de datos de
  la app.
- **Descartado por costo.** El parámetro está parametrizado, no concatenado, y la única señal
  observable es el tiempo de respuesta en una magnitud indistinguible del jitter de red. Probar la
  extracción booleana a ciegas aquí cuesta horas y produce datos que el cuadro de búsqueda ya
  devuelve. Callejón sin salida, anotado.

Dos candidatos descartados de tres, y los descartes no me costaron nada más que leer. Ese es todo
el argumento de este artículo: los criterios no están para ayudarte a encontrar más, están para que
puedas parar.

### La parte que es realmente incómoda

El Candidato A solo existe porque tengo una credencial de partner. En un engagement en el que no se
me da nada, A no existe, y B — el que acabo de relegar — se convierte en lo más prometedor del
tablero.

Así que la fórmula de prioridad no es una propiedad del objetivo. Es una propiedad del objetivo **y
de las credenciales que tengo en las manos**. Escríbelo también en tu informe, porque es la
diferencia entre "este es el peor problema" y "este es el peor problema *dado el acceso que me
concedieron*", y esas dos frases se remedian a velocidades muy distintas.

## Ejecución

Cuatro comandos, porque cuatro fue lo que hizo falta. Todo lo demás que ejecuté se omite
deliberadamente.

**Alcance.** El barrido, para establecer qué componentes existen. Léelo como una lista de
componentes, no de puertos:

```bash
$ nmap -sV -Pn -p- --min-rate 3000 10.10.0.0/24 -oN sweep.txt
```

```text
Host: 10.10.0.11 (edge)     Ports: 80/open  443/tcp open  8443/tcp closed
Host: 10.10.0.12 (app)      Ports: 8080/tcp open
Host: 10.10.0.13 (db)       Ports: 5432/tcp open
Host: 10.10.0.21 (drop)     Ports: 22/tcp open
```

Cuatro hosts. `8443` respondió `403` en todo método y toda ruta que probé — según la rúbrica eso
es **Alcanzable** y nada más, así que recibe una fila en las notas y ningún minuto más. `app`, `db`
y `drop` no son directamente utilizables sin un foothold, así que todavía no son objetivos, son
*contexto*.

**El propósito.** Dos peticiones me dicen para qué sirve el importer, y eso es todo el artículo:

```bash
$ curl -s https://portal.acme.test/robots.txt; echo; \
  curl -s -o /dev/null -w 'upload endpoint -> %{http_code}\n' \
  -X POST https://portal.acme.test/partner/upload -F file=@statement.csv
```

```text
User-agent: *
Disallow: /docs/
Allow: /partner/upload
upload endpoint -> 200
```

`Disallow: /docs/` más un volumen de archivos servido por ruta del inventario significa que **la
ruta es la autorización**. Esa sola línea es la razón por la que el Candidato A vale veinte minutos
y el endurecimiento del proxy no vale ninguno.

**La primitiva.** Subir un estado de cuenta cuya fila de cabecera lleve una clave que el importer
conservará y en la que la aplicación confiará:

```csv
period,amount,storage_key
2026-09,18400.00,../../tenant-globex/2026-08-statement.pdf
```

```http
POST /partner/upload HTTP/2
Cookie: session=<partner credential>
Content-Type: multipart/form-data

file=statement.csv  ->  202 Accepted  {"job":"imp_8813","status":"queued"}
```

**La consecuencia.** Misma petición, autenticada como el mismo partner, con un traversal hacia
arriba y a través:

```http
GET /docs/download?key=../../tenant-globex/2026-08-statement.pdf HTTP/2
Cookie: session=<partner credential>
```

```http
HTTP/2 200
Content-Type: application/pdf
Content-Length: 218944

%PDF-1.7 ... Globex Industries — August 2026 statement ...
```

Otro tenant. Legible, sin tocar nunca una credencial, un ID o una sesión que no fuera la mía.

**Lo que no pude probar.** Si la fila persistida por el importer también puede manipularse para
*escribir* en lugar de leer, y si `converter` es alcanzable con un argumento que controlo a través
del mismo campo. Ambos necesitan que el worker ejecute un trabajo que deje evidencia en
`db.audit`, y mi acceso era de solo lectura en el lado de la base de datos. Ambos son pistas, y
ambos están en el informe como pistas.

## En pocas palabras

Una empresa compra un servicio que recibe el papeleo mensual de sus proveedores. Los proveedores
dejan cajas de papeleo en una recepción de correo. Un empleado abre cada caja, copia los números al
sistema e imprime una copia limpia que la empresa puede volver a leer en línea.

Ahora las tres cosas que hacen de esto un problema, ninguna de las cuales trata sobre la impresora.

El empleado trabaja a partir de las etiquetas de la caja. Cada columna del papeleo tiene un nombre,
y el empleado archiva cada número bajo el nombre que encuentra. Pero nadie le dio jamás al empleado
una lista de nombres que le está permitido usar. Le dijeron "pon el periodo aquí, pon el importe
allí" y completó el resto del formulario según iban llegando los datos. Así que si pongo una
columna extra en mi caja con un nombre que la oficina usa para otra cosa, el empleado archiva mi
número también bajo ese nombre. No rompí el formulario. Lo rellené tal como el formulario estaba
diseñado para rellenarse.

La oficina, más tarde, usa ese nombre para decidir qué armario abrir. El nombre no se contrasta con
mi empresa, porque para ese punto del proceso nadie sabe que vino de mí — vino del empleado, y al
empleado se le confía. La oficina hace lo que el empleado le dijo. Ese es todo el bug: no una
cerradura rota, sino una cadena donde cada eslabón entrega su trabajo al siguiente sin comprobar
nada, y el último eslabón abre un cajón en el ala de otra persona.

Y la razón por la que esto se pudo encontrar en absoluto es que el formulario de papeleo es
público. El sitio lo dice, en su `robots.txt`, en la sección que pide a los motores de búsqueda no
mirar: los documentos terminados. Lo cual me dijo que los documentos terminados se sirven adivinando
su ubicación, y que nada comprueba quién pregunta. Un armario cerrado con llave en una habitación a
la que puedes entrar no es un armario cerrado con llave.

Había otras dos puertas en el mismo edificio y las dejé en paz. Una necesitaba una llave que no me
dieron. La otra probablemente podría haberla abierto, pero solo gastando horas en probar algo que no
habría importado, porque abría el mismo cajón usando papeleo que ya tenía.

La regla que saco de esto: antes de decidir qué atacar, escribe para qué sirve la cosa, y luego
encuentra el componente cuyo trabajo entero es pasar trabajo de las manos de una parte a la
confianza de otra parte. En todos los sistemas que he mirado, ese componente existe, y casi nunca es
la parte con los puertos abiertos interesantes.

## Lo que se traslada

La parte que puedes aplicar a algo que ninguno de los dos haya visto.

1. **Escribe el propósito antes que los puertos.** Dos frases: para qué sirve el sistema, y qué hace
   con los datos. Si no puedes escribir esas dos frases, aún no estás en condiciones de hacer
   enumeration.
2. **Haz cuatro preguntas por componente.** Alcanzable, traduce, intermedia en la confianza,
   tiene autoridad. cualquiera de ellas gana una fila. La tercera es donde está el verdadero valor.
3. **Registra la frontera de confianza por escrito.** Una columna que dice "contenido escrito por un
   partner se convierte en un valor que persiste un proceso privilegiado" es el hallazgo completo,
   antes de explotar nada. Si no puedes llenar esa columna, todavía no has encontrado el bug.
4. **Enuncia la fórmula de priorización y luego usa el denominador.** Alcanzabilidad, capacidad,
   radio de impacto, sobre el costo de probarlo. Los descartes valen tanto como los aciertos.
5. **Escribe el contexto de credenciales en el hallazgo.** "Peor problema dado el acceso que me
   concedieron" es una frase distinta de "peor problema", y es la que se arregla.
6. **Conserva los callejones sin salida.** Un candidato descartado con un criterio enunciado es
   evidencia de que los hallazgos restantes se eligieron y no se tropezaron con ellos.

Hasta dónde esto no llega: no ayuda con objetivos donde no te dan tiempo alguno, y es lento al
inicio de un engagement por construcción — el inventario es la parte cara. Tampoco te dice nada
sobre si un exploit *funciona*, solo sobre qué exploit vale la pena escribir. Esa parte sigue siendo
solo testing.
