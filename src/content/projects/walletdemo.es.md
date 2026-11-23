---
title: "WalletDemo: una billetera fintech construida para que la ataque su propio autor"
description: "Una billetera móvil (saldo, movimientos, transferencias) en React Native con una API en Node, construida historia por historia para que cada funcionalidad llegue con el ataque que tiene que resistir. En progreso: historia 1 de 15 terminada, el server de la historia 2 listo."
category: "Seguridad móvil"
team: "Purple Team"
tags: ["React Native", "TypeScript", "Express", "SQLite", "argon2id", "OWASP MASVS", "OWASP API Top 10"]
featured: false
date: "2026-11-19"
timeline: "En progreso (2026 - Presente)"
githubUrl: ""
liveUrl: ""
---

> **Estado: en progreso.** La historia #1 (ver el saldo traído del backend) está terminada, testeada y
> verificada en un celular Android físico. La historia #2 (registro) tiene el server terminado y la
> pantalla mobile sin empezar. Las historias #3–#15 (login, transferencias, biometría, pinning,
> detección de root) existen solo como backlog. Esta página documenta el criterio con el que se
> construye la app y las dos historias que existen, no una billetera terminada.

## El problema

La pregunta que este proyecto busca responder:

> ¿Cómo aprendo desarrollo mobile desde cero de una forma que me deje en condiciones de *atacar* lo
> que construyo (IDOR, montos negativos, race conditions, robo de tokens, un APK enganchado con Frida),
> en lugar de aprender primero el framework y agregar la seguridad al final?

Una billetera es el objetivo correcto porque sus fallas no son ambiguas: plata que aparece,
desaparece o sale de una cuenta que no es tuya. Cada funcionalidad del backlog va acompañada de la
clase de ataque que invita (OWASP MASVS en el celular, OWASP API Top 10 en el server).

Lo que **no** hace: no es un producto de pagos real. No hay PSP, ni datos de tarjeta, ni KYC, ni
multimoneda (solo ARS), ni multi-tenant, y la interfaz está solo en español. Todo eso está escrito como
decisión en el backlog, no quedó implícito.

## El contexto

- **Cliente:** React Native 0.78 (CLI, no Expo) + React 19 + TypeScript, testeado con Jest y
  `@testing-library/react-native`. Se desarrolla contra un celular Android físico conectado por USB.
- **Server:** Node + Express + TypeScript, SQLite con `better-sqlite3`, testeado con `supertest`.
- **Red en desarrollo:** la app llama a `http://localhost:3000` y `adb reverse` redirige ese puerto
  del celular a la notebook. El HTTP en claro es deuda aceptada hasta la historia #11 (TLS + pinning).
- **Operador:** una persona, trabajando en sesiones de pairing con un ciclo TDD rojo→verde estricto.
  Cada historia se refina en criterios de aceptación y una test list antes de escribir código.
- **Lo que reemplaza:** la típica "app de tutorial" donde la seguridad es el último capítulo. Acá el
  tema de seguridad es una columna del backlog y se decide antes que la funcionalidad.

> **En pocas palabras**
> Es una billetera digital de mentira en un celular, que habla con un servidor chico. Cada
> funcionalidad nueva viene con la pregunta "¿cómo me robaría alguien plata por acá?", y la respuesta
> se construye en el mismo paso que la funcionalidad, no después.

## Las restricciones

| Tipo | Restricción |
|------|-------------|
| Dura | Las pruebas se hacen en un dispositivo Android físico, no en un emulador. Cualquier cosa que solo exista en el emulador (como el alias de host `10.0.2.2`) queda afuera. |
| Presupuesto | Una persona aprendiendo el stack sobre la marcha. El trabajo se parte en 15 historias de dificultad creciente, cada una lo bastante chica para terminarla y mostrarla. |
| Superficie | Todo lo que recibe el server viene de un cliente que se puede modificar. El server trata cada body como hostil, incluidos los requests que nunca salieron de la app. |
| No-objetivo | Realismo de producción: sin PSP, sin tarjetas, sin varias monedas, sin migraciones. Acepto que SQLite y un esquema armado con `CREATE TABLE IF NOT EXISTS` no escalan, y lo digo. |

## Los componentes

| Componente | Responsabilidad | Depende de | Falla en |
|------------|-----------------|------------|----------|
| Pantalla de saldo | Muestra el saldo en tres estados: cargando, éxito y error con reintento | API, `formatMoney`, chequeo de la respuesta en runtime | Un error visible con botón "Reintentar", nunca un saldo vacío o en cero |
| `formatMoney` | Formatea centavos enteros como ARS (`$ 1.234,56`), a mano | — | Formato incorrecto de negativos (conocido, diferido a #4) |
| `createApp(db)` | Arma la app de Express sin abrir un puerto, con la DB inyectada | Express, `Db` | Tests que no pueden correr aislados (es lo que la factory evita) |
| `POST /api/users` | Valida, hashea e inserta; responde 201 / 400 / 409 | `validateRegistration`, argon2, SQLite | 400 con errores por campo; 409 `email_taken`; 500 para cualquier otra cosa |
| Tabla `users` | Una cuenta por email normalizado, solo roles válidos | `UNIQUE` + `CHECK` de SQLite | El INSERT falla y el estado inválido nunca se guarda |

## Del requisito al diseño

El choque: el objetivo declarado es *aprender* React Native desde cero, y eso empuja hacia lo más
simple que funcione. Pero una billetera castiga todo lo simple que además está mal (un saldo en float,
un chequear-y-después-insertar, un rol leído del body). La regla que lo resolvió: **el server es la
única autoridad, y cada atajo se permite solo si queda escrito como deuda, con la historia que lo
paga.**

> **En pocas palabras**
> Mantengo la app simple a propósito porque estoy aprendiendo, pero no dejo que "simple" signifique
> "confiado". El celular revisa los datos para ayudar; el server los revisa para proteger. Cada esquina
> que corto queda anotada con la fecha en que vuelvo a buscarla.

Descartados en el camino, cada uno con la restricción que lo mató:

> **Descartado**
> Dinero como `number` con decimales: falla en *superficie/correctitud*. `0.1 + 0.2 !== 0.3` y los
> errores de redondeo se acumulan. Los saldos son centavos enteros.

> **Descartado**
> Un `SELECT` para ver si el email existe y después el `INSERT`: falla en *superficie*. Dos registros
> simultáneos pasan los dos el chequeo (TOCTOU). La restricción `UNIQUE` es atómica y su violación se
> traduce en un 409.

> **Descartado**
> bcrypt: trunca en silencio la entrada a los 72 bytes, y el límite de la contraseña es 128. argon2id
> es la primera opción de OWASP.

> **Descartado**
> Guardar los usuarios en memoria: falla en *presupuesto*. El server de desarrollo se reinicia en cada
> guardado y pierde las cuentas, y las historias #4/#5 igual necesitan transacciones reales. SQLite da
> SQL real sin un servidor que instalar.

> **Descartado**
> `10.0.2.2` como dirección del backend: falla en *dura*. Solo existe dentro del emulador de Android.
> Se reemplazó por `localhost` + `adb reverse`.

> **Descartado**
> npm workspaces para compartir las reglas de validación entre app y server: rompe Metro y el
> autolinking nativo. Las reglas quedan duplicadas, y esa duplicación figura como deuda.

> **Descartado**
> `Intl.NumberFormat` para la moneda: el `Intl` de Hermes se comporta distinto según la build de
> Android. El formateador está escrito a mano.

## Implementación

La decisión con más peso está en el esquema: la propia base rechaza estados que el código nunca
debería producir, así que un bug en la ruta no puede convertirse en un privilegio guardado.

```sql
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('usuario', 'admin'))
)
```

La ruta de registro lee del body solo una lista permitida (`email` y `password`) y el rol lo fija el
server. Un `role: "admin"` en el request se ignora (mass assignment). Los duplicados los maneja la
restricción, no una consulta previa:

```typescript
const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

try {
  const result = db
    .prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'usuario')")
    .run(email, passwordHash);
  res.status(201).json({ id: Number(result.lastInsertRowid), email });
} catch (err) {
  if (isUniqueViolation(err)) {
    res.status(409).json({ error: 'email_taken' });
    return;
  }
  throw err;
}
```

La validación tipa el body como `unknown` porque viene de la red: un número o un objeto donde se
esperaba un string tiene que fallar tan limpio como un email mal formado. Las contraseñas van de 12 a
128 caracteres, sin reglas de composición (NIST SP 800-63B), y nunca se recortan. En el cliente, la
respuesta del saldo se chequea en runtime (centavos enteros, moneda `ARS`, `res.ok`) antes de
mostrarla, porque un `fetch` tipado es una promesa que el server nunca firmó.

Dónde está: la historia #1 tiene 14 ítems en la test list, todos en verde, incluidos tres que sumó el
code review (HTTP 500, monto no entero, moneda incorrecta). También se probó a mano en el celular:
server arriba, server caído, server de vuelta + reintentar. El server de la historia #2 pasa 19 tests.
Su pantalla mobile, el login, las sesiones y todo lo que realmente mueve plata todavía no existen.

## En pocas palabras

Alguien quiere aprender a hacer apps de celular y, al mismo tiempo, a romperlas. En vez de construir
primero una app linda y preocuparse por los ladrones al final, arma una billetera de mentira de a una
pieza chica por vez, y cada pieza viene con el truco específico que un ladrón probaría contra ella.

Por ahora la app muestra un saldo y el server crea cuentas que resisten los trucos obvios: registrarse
dos veces al mismo tiempo, colarse como administrador, mandar basura. Las partes donde se mueve plata de
verdad todavía están por delante. Ser honesto con esa distancia es parte del método.

## Qué haría distinto

**Para llevarse.** Cuando estás aprendiendo un framework, emparejá cada funcionalidad con el ataque
que invita *antes* de escribirla, y poné la defensa en la capa que no se puede saltear: el server y, si
se puede, la restricción de la base. La validación en el cliente es UX, no seguridad.

**Límites.** Hoy esto demuestra hábitos de diseño en dos historias, no una billetera segura. Todavía no
hay autenticación: cualquiera que llame a `GET /api/balance` ve el saldo de demo. El tráfico es HTTP en
claro. La respuesta `email_taken` permite enumerar cuentas (planificado para #9). El mínimo de 12
caracteres está por debajo de los 15 que pide NIST para una contraseña como único factor. Nadie más
que su autor lo atacó. Solo corrió en un dispositivo Android, y nada en iOS.

Si empezara de nuevo, sacaría el saldo de demo fijo del walking skeleton. Publicar un endpoint de
dinero sin autenticación como primer paso hizo rápido el esqueleto, pero también normalizó "cualquiera
puede leer esto" hasta que la historia #3 agregue el login. Un saldo fijo detrás de un chequeo de auth de mentira habría
costado una hora y habría mantenido el hábito correcto desde el primer commit.
