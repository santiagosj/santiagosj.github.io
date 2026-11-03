---
title: "Active Directory: Guía de enumeration ofensiva"
description: "De cero conocimiento de AD a comprender la superficie de ataque y las técnicas de descubrimiento. Un desglose estructurado de componentes, protocolos, estrategias de enumeration y vectores comunes, con analogías antes del detalle técnico."
category: "Método"
tags: ["Active Directory", "AD", "Kerberos", "LDAP", "Enumeration", "Pentesting"]
featured: false
date: "2026-10-05"
---

> Entender Active Directory tiene menos que ver con memorizar sintaxis de herramientas y más con comprender cómo la identidad, la confianza y la política trabajan juntas. Este artículo se centra en la enumeration primero, para que las rutas de ataque que siguen tengan sentido en lugar de sentirse como un checklist.

## La pregunta

¿Cómo funciona realmente un dominio de Active Directory y, lo más importante, qué partes de él forman una superficie de ataque descubrible antes de ejecutar cualquier herramienta?

El objetivo es sencillo: tras leer esto, deberías poder mapear un entorno AD conceptualmente, saber qué enumerar en cada fase (sin autenticar vs autenticado) y entender *por qué* recopilas cada pieza de información en lugar de ejecutar scripts a ciegas.

## El modelo objetivo

Active Directory (AD) es el servicio de directorio de Microsoft. Actúa como una base de datos centralizada de identidad, autenticación, autorización y aplicación de políticas en entornos Windows. En lugar de pensar en él como "solo servidores Windows", piénsalo como el **reglamento, la guía de teléfonos y el guardia de seguridad** de toda una red.

- **El trabajo para el que existe**: Autenticar usuarios y equipos, autorizar el acceso a recursos y aplicar configuraciones consistentes en todo el dominio.
- **Componentes**: Los Domain Controllers (DCs) alojan la base de datos del directorio y gestionan la autenticación; los dominios agrupan objetos bajo un límite de seguridad; los bosques agrupan dominios bajo esquemas/confianzas compartidos; las OUs organizan objetos para la delegación y la aplicación de políticas; las GPOs aplican configuraciones; las Trusts definen cómo fluye la autenticación entre dominios/bosques.
- **Actores**: Usuarios anónimos (si se permite), usuarios de dominio autenticados, cuentas de servicio, cuentas de equipo, domain admins/enterprise admins y servicios automatizados.
- **Activos que importan**: Credenciales de usuarios, tickets de Kerberos, contraseñas de cuentas de servicio, objetos Group Policy que pueden abusarse, ACLs que otorgan control y el propio DC (que guarda las llaves del reino).

> **En pocas palabras**
> Imagina un edificio de empresa con tarjetas de identificación. Hay una oficina de seguridad central (Domain Controller) que emite y valida las tarjetas de identificación (tickets), mantiene un directorio maestro de empleados (base de datos LDAP) y publica las normas del edificio en cada planta (Group Policy). Diferentes edificios podrían confiar en las oficinas de identificación de los demás (Trusts). Necesitas entender quién trabaja dónde, qué puertas puede abrir y quién puede cambiar las normas.

## El criterio de superficie

Un elemento pertenece a la superficie de ataque de AD si se cumple cualquiera de estas condiciones:

| Criterio | Qué pregunta responde |
| --- | --- |
| **Alcanzable** | ¿Puede un actor enviarle tráfico de red (DNS, LDAP/LDAPS, Kerberos, SMB, RPC)? |
| **Traduce** | ¿Toma entrada (consultas, peticiones) y produce una decisión de autorización o devuelve datos del directorio? |
| **Intermedia confianza** | ¿Confía en otro componente sin revalidar de una forma que podamos abusar (relaciones de confianza, SPNs, delegación)? |
| **Tiene autoridad** | ¿Posee credenciales, tickets, hashes de contraseñas o privilegios que otros asumen? |

**Regla de priorización**: Alcanzabilidad × Valor de la información × Potencial de escalada de privilegios ÷ Costo de prueba. Céntrate en elementos que produzcan información de ruta accionable (usuarios, grupos, ACLs, SPNs, trust) con el mínimo de suposiciones.

## El inventario

| Elemento | Propósito | Se comunica con | Frontera de confianza | Deriva en |
| --- | --- | --- | --- | --- |
| **Domain** | Límite lógico de seguridad que contiene usuarios, grupos, equipos y políticas. | DCs, servidores miembro, clientes | Frontera de autenticación (dominio vs workgroup) | El compromiso de un objeto del dominio puede hacerse pivotar dentro del ámbito del dominio. |
| **Forest** | Colección de uno o más dominios que comparten esquema, configuración y catálogo global. | Dominios vía trust | Frontera de seguridad entre dominios | El compromiso del bosque puede afectar a todos los dominios hijos si los trust lo permiten. |
| **Tree** | Jerarquía de dominios en el mismo espacio de nombres con nombres DNS contiguos. | Dominios padre/hijo | Frontera de espacio de nombres/confianza | Los trust transitivos pueden propagar el acceso. |
| **OU (Organizational Unit)** | Contenedor para delegación y alcance de GPOs. | DCs, admins | Frontera de delegación | Permisos de OU mal delegados permiten escalada de privilegios. |
| **Domain Controller (DC)** | Aloja la base de datos AD (NTDS.dit), gestiona la autenticación Kerberos/LDAP y aplica la política. | Todo el dominio | Autoridad central de confianza | Compromiso total del dominio si el DC cae en manos del atacante (DCSync, extracción de hashes). |
| **Users/Groups/Computers** | Identidades y principals. Los grupos definen la autorización. | DC (autenticación), recursos | Frontera de identidad | Grupos/ACLs con exceso de privilegios crean rutas laterales. |
| **GPOs** | Aplican configuraciones, scripts y permisos. Se aplican a OUs/sitios/dominios. | DC, clientes | Autoridad de configuración | GPOs mal configuradas pueden llevar a escalada local de privilegios o toma de dominio. |
| **FSMO Roles** | Cinco operaciones flexible single-master (Schema, Domain Naming, RID, PDC Emulator, Infrastructure). | DCs | Frontera de operaciones críticas | Ciertos abusos dependen de los titulares de los roles (PDC para anomalías de tiempo/Kerberos). |
| **Trusts** | Relaciones direccionales/transitivas entre dominios/bosques (unidireccional/bidireccional, externo, forest). | DCs a través del trust | Autenticación entre fronteras | Los trust pueden abusarse para hacer pivoting entre dominios/bosques. |

## Del elemento al vector

Los vectores responden: Actor, Precondición, Primitiva, Consecuencia, Objetivo. Una pista se convierte en vector solo cuando se conocen los cinco.

**Candidatos que sobreviven (por valor de enumeration):**

1. **Divulgación de información sin autenticar vía LDAP/DNS/SMB**  
   - Actor: Atacante sin autenticar en la red (interno) o con acceso de red al segmento del dominio  
   - Precondición: DC/DNS/SMB alcanzable  
   - Primitiva: Leer metadatos (usuarios, grupos, SPNs, información del dominio)  
   - Consecuencia: Construir lista de usuarios para Kerberoasting/AS-REP roasting, identificar objetivos  
   - Objetivo: Obtener una ruta de acceso inicial o material de credenciales

2. **Enumeration de usuarios vía Kerberos**  
   - Actor: Sin autenticar  
   - Precondición: Kerberos (puerto 88) alcanzable  
   - Primitiva: Validar nombres de usuario mediante el comportamiento del AS-REQ  
   - Consecuencia: Lista de usuarios válidos → ataques dirigidos  
   - Objetivo: Reducir la adivinación, centrarse en cuentas vulnerables

3. **Enumeration LDAP autenticada**  
   - Actor: Usuario de dominio autenticado (credenciales/ticket válidos)  
   - Precondición: Credenciales válidas  
   - Primitiva: Consultas completas al directorio (usuarios, grupos, ACLs, trust, enlaces de GPO, SPNs)  
   - Consecuencia: Mapear rutas de ataque (BloodHound), identificar abusos de ACL/GPO, cuentas Kerberoastable  
   - Objetivo: Escalada de privilegios / movimiento lateral

4. **Superficie de Kerberoasting / AS-REP roasting**  
   - Actor: Autenticado o con una userlist  
   - Precondición: Cuentas con SPN identificadas o usuarios con DONT_REQ_PREAUTH  
   - Primitiva: Obtener hashes TGS/AS-REP  
   - Consecuencia: Crackeo offline → obtención de credenciales  
   - Objetivo: Acceso inicial o movimiento lateral

**Candidatos descartados:**

> **Descartado:** Fuerza bruta de contraseñas Kerberos sin autenticar a gran escala — falla en el *costo de probar*: ruidoso, lento y probablemente bloqueado; es mejor enumerar primero los usuarios válidos.  
> **Descartado:** Explotación de trust a ciegas sin mapeo — falla en la *primitiva*: no da ninguna capacidad concreta sin conocer la dirección/transitividad del trust y los recursos alcanzables.  
> **Descartado:** Intentar DCSync sin autenticar — falla en la *precondición*: requiere permisos específicos de alto privilegio (Replicating Directory Changes) y normalmente necesita contexto autenticado.

> **En pocas palabras**  
> Antes de elegir cualquier "ataque", filtra sin piedad: ¿qué puedo aprender de verdad? ¿Ese aprendizaje desbloquea un siguiente paso? Si la respuesta es "quizá más adelante" sin concretar, es un agujero sin fondo. La enumeration es el filtro.

## Ejecución

### Protocolos de autenticación — de lo simple a lo técnico

#### Kerberos (analogía primero)
Piensa en Kerberos como un recinto de conciertos con una taquilla central (KDC = Key Distribution Center, dividido en AS y TGS). Muestras tu identificación en la taquilla (Authentication Server) y recibes una **TGT** (gafete de identificación temporal). Cuando quieres entrar en una sala concreta (servicio), presentas tu TGT a otra ventanilla (Ticket Granting Server) y recibes un **TGS** (ticket de servicio) para esa sala. La puerta comprueba el ticket de servicio. Todo el sistema usa secretos compartidos (hashes de contraseñas) para que los tickets no se puedan falsificar fácilmente.

**Flujo técnico (pasos clave):**
- AS-REQ: El cliente envía una petición al KDC (AS) con el nombre de usuario; el KDC comprueba que el usuario existe. Si se requiere preautenticación, una marca de tiempo cifrada demuestra que conoce la contraseña.
- AS-REP: Si es válido, el KDC devuelve el TGT (cifrado con el hash KRBTGT) + la clave de sesión.
- TGS-REQ: El cliente presenta el TGT al TGS solicitando acceso a un SPN (Service Principal Name).
- TGS-REP: El TGS devuelve el ticket de servicio (cifrado con el hash de la cuenta de servicio) + la clave de sesión.
- AP-REQ: El cliente presenta el ticket de servicio al servicio para autenticarse.

**Relevancia para la enumeration:** La existencia de un usuario puede filtrarse mediante el comportamiento del AS-REQ; las cuentas con SPN producen tickets TGS (Kerberoastable); las cuentas sin preautenticación producen AS-REP (AS-REP roastable).

#### LDAP (Lightweight Directory Access Protocol)
LDAP es la **interfaz de consultas** a la base de datos AD (como una interfaz SQL para una guía de teléfonos). Puedes preguntar "muéstrame todos los usuarios", "muéstrame todos los grupos", "encuentra cuentas con SPN", etc.  
- **LDAP vs LDAPS**: LDAP va en texto plano por defecto en el 389; LDAPS (636) es LDAP envuelto en TLS. Ambos exponen esquema/datos; LDAPS impide la interceptación.  
- **Bind anónimo**: Algunas malas configuraciones permiten hacer bind de forma anónima (sin credenciales) y leer la información del directorio. Es oro puro de enumeration si está permitido.  
- **Uso común**: Las consultas LDAP autenticadas revelan ACLs, trust, enlaces de GPO, grupos anidados, información del último inicio de sesión (cuidado con atributos sensibles) y mucho más.

#### NTLM (breve)
NTLM es autenticación legacy de challenge-response. Sigue presente. Su relevancia ofensiva principal es el **NTLM relay** (abusando de autenticación coaccionada) y movimientos estilo pass-the-hash en entornos mixtos. Céntrate primero en Kerberos/LDAP para la enumeration.

#### Group Policy Objects (GPOs)
Las GPOs son colecciones de configuraciones aplicadas a usuarios/equipos vía OUs/dominios/sitios. Pueden desplegar scripts, establecer permisos, instalar software y modificar el registro.  
- **Por qué importan**: Permisos de GPO mal configurados (p. ej., que "Authenticated Users" pueda editarlos) o rutas de SYSVOL escribibles pueden permitirte dejar scripts maliciosos que se ejecuten como SYSTEM/usuarios del dominio — una ruta de escalada común.  
- **Ángulo de enumeration**: Buscar GPOs enlazadas a OUs interesantes, identificar quién puede modificarlas (ACLs), revisar SYSVOL en busca de scripts.

### Definición de superficie de ataque (contexto AD)
"Superficie de ataque" = todos los puntos alcanzables, que manejan entrada, intermedian confianza o poseen autoridad, y que pueden producir capacidad de siguiente paso cuando se enumeran o se abusan.

- **Servicios expuestos en red**: DNS (53), Kerberos (88 TCP/UDP), LDAP (389), LDAPS (636), SMB (445), RPC/DCERPC (135, puertos altos), WinRM (5985/5986) — muchos son necesarios para operaciones normales.
- **Superficie autenticada vs sin autenticar**: Sin autenticar → listas de usuarios, información del dominio, a veces LDAP anónimo. Autenticado → mapa completo (ACLs, trust, GPOs) que permite construir rutas.
- **Relaciones de confianza**: Los trust unidireccionales/bidireccionales, externos y de bosque expanden la superficie efectiva más allá de las fronteras.
- **Mala configuración como superficie**: Preauth deshabilitado (AS-REP roast), contraseñas débiles de cuentas de servicio con SPN (Kerberoast), ACLs excesivas, GPOs/SYSVOL escribibles, bind LDAP anónimo — estos son descubrimientos impulsados por la enumeration.

### Estrategias de enumeration y descubrimiento

Organiza por fase. La clave: **enumerar primero, atacar después.**

#### Fase 1: Enumeration sin autenticar
Objetivo: Reconocer la estructura del dominio, usuarios válidos y servicios alcanzables.

| Técnica | Qué | Notas |
| --- | --- | --- |
| **DNS** | Nombre del dominio, DCs, nameservers (nslookup/dig type=SRV/_ldap._tcp.dc._msdcs.<domain>) | Revela DCs, GC, información de sitio. Base para el direccionamiento Kerberos/LDAP. |
| **SMB null session** | Conectarse con credenciales nulas a IPC$ | Legacy; a menudo bloqueado. Si se permite, puede filtrar recursos/usuarios según la configuración. |
| **RPC null session / enum** | Consultar información del dominio vía SAMR/RPC con autenticación nula | También legacy; revisa la política. |
| **Bind LDAP anónimo** | Bind a LDAP sin credenciales, consultar base DNs | Muy valioso si está permitido — vuelca usuarios/grupos/OUs/SPNs sin autenticación. |
| **Enumeration de usuarios Kerberos** | AS-REQ con nombres de usuario supuestos | Revela nombres de usuario válidos sin intentar contraseñas (diferencias de tiempo/respuesta). |
| **Mapeo de red** | Escaneo de puertos de los DCs (88, 389, 636, 445, 135, 5985/5986) | Valida la alcanzabilidad; evita la fuerza bruta ciega de servicios. |

#### Fase 2: Enumeration autenticada
Objetivo: Mapear relaciones, privilegios y rutas. Necesita al menos una cuenta de dominio válida.

| Técnica | Qué | Notas |
| --- | --- | --- |
| **Consultas LDAP** | Usuarios, grupos (incluidos los anidados), SPNs, OUs, trust, enlaces de GPO, objetos de equipo, ACLs | Núcleo. Se puede filtrar a Kerberoastable (cuentas de usuario con SPN), AS-REP roastable (flag de userAccountControl), grupos privilegiados. |
| **BloodHound** | Ingesta de datos LDAP/NetSessions/LocalAdmin → grafo de rutas de ataque | Visualiza los caminos más cortos hacia DA vía ACLs, membresía de grupos y trust. Esencial para encontrar rutas AD modernas. |
| **PowerView (PowerShell)** | Enumerar dominio, usuarios, grupos, ACLs, trust, GPOs de forma programática | Flexible; replica muchas consultas LDAP. Bueno para extracción dirigida. |
| **ldapsearch** | Consultas LDAP directas desde Linux | Scriptable, preciso. Excelente para extracción controlada. |
| **rpcclient** | Consultas RPC SAMR, LSA, NetLogon | Legacy pero aún útil en algunos entornos para información local/del dominio. |
| **Herramientas estilo netexec/crackmapexec** | Enumeration basada en autenticación (usuarios, recursos compartidos, sesiones) | Rápido pero ruidoso; úsalo con cuidado y autorización. |

#### Fase 3: Enumeration basada en Kerberos
Céntrate en material de credenciales sin hacer spray de contraseñas.

| Técnica | Qué | Notas |
| --- | --- | --- |
| **Kerbrute (userenum)** | Enumerar nombres de usuario válidos vía Kerberos | Más discreto que la enum de usuarios SMB/RPC en muchas configuraciones; valida la existencia. |
| **Kerberoasting** | Solicitar TGS para cuentas con SPN → extraer hash del ticket de servicio | Crackeo offline. Apunta a cuentas con contraseñas débiles; las cuentas de servicio suelen estar mal configuradas. |
| **AS-REP Roasting** | Para usuarios con "DONT_REQ_PREAUTH" activado, obtener el hash AS-REP directamente | Extremadamente valioso; puede dar credenciales sin conocer la contraseña. |
| **SPN scanning** | Identificar todas las cuentas de usuario/equipo con SPN | Revela objetivos kerberoastable y a menudo servicios de alto valor (MSSQL, CIFS, HTTP). |

**Qué extraer (checklist):** FQDN del dominio, IPs de los DCs, usuarios válidos, grupos + membresías (especialmente Domain Admins/Enterprise Admins), equipos, OUs, enlaces de GPO, ACLs sobre objetos/OUs/GPOs, SPNs, trust (dirección/transitividad), cuentas con DONT_REQ_PREAUTH, cuentas Kerberoastable, configuraciones de delegación.

## Vectores de ataque comunes (a nivel conceptual)

Conecta con los componentes/protocolos anteriores. Son conceptuales; la enumeration te dice cuáles aplican.

| Vector | Causa raíz | Requisito previo (de la enum) | Efecto |
| --- | --- | --- | --- |
| **Kerberoasting** | La cuenta de servicio tiene contraseña débil; cualquier usuario de dominio puede solicitar el TGS para el SPN. | Credenciales de dominio válidas + lista de SPNs | Crackeo offline → credenciales de la cuenta de servicio → lateral/escalada. |
| **AS-REP Roasting** | La cuenta de usuario tiene DONT_REQ_PREAUTH activado. | Lista de usuarios que muestre preauth deshabilitado | Hash AS-REP → crackeo offline → credenciales válidas. |
| **Pass-the-Hash (PTH)** | Reutilizar el hash NT para autenticarse (NTLM). | Hash NT capturado + admin local/permisos en el objetivo | Movimiento lateral hacia máquinas donde el hash es válido. |
| **DCSync** | La cuenta tiene los permisos "Replicating Directory Changes" (y All) en el dominio. | Encontrar cuentas con permisos DCSync vía enum de ACLs (a menudo Domain Admins, Enterprise Admins o personalizados) | Extraer secretos de NTDS.dit (hashes de usuarios, KRBTGT) → compromiso total del dominio. |
| **ACL abuse** | ACLs con exceso de permisos sobre usuarios/grupos/OUs/GPOs (GenericAll, WriteOwner, ForceChangePassword, GenericWrite). | Enumeración de ACLs sobre los objetos objetivo | Modificar el objeto → restablecer contraseña, añadir a un grupo, tomar propiedad → escalada de privilegios. |
| **GPO abuse** | GPO escribible o SYSVOL escribible enlazado a usuarios/equipos. | Enlaces de GPO + permisos de edición | Desplegar script malicioso ejecutado como SYSTEM/usuario objetivo → escalada local/dominio. |
| **Delegation abuse** | Mala configuración de delegación unconstrained/constrained/RBCD | Flags de delegación desde LDAP | Suplantar a usuarios (incluidos privilegiados) ante servicios → escalar. |

## Cierre

La filosofía es sencilla: **enumerar primero, atacar después.** Herramientas como BloodHound, ldapsearch, Kerbrute e Impacket son multiplicadores de fuerza — pero sin entender el flujo de tickets de Kerberos, el papel de LDAP como interfaz del directorio, las fronteras de confianza y lo que realmente significan las ACLs/GPOs, las ejecutarás a ciegas y te perderás el "por qué".

Empieza por la alcanzabilidad (DNS/puertos), pasa a los metadatos sin autenticar (usuarios/SPNs/información del dominio) y luego haz pivoting a LDAP autenticado para construir el grafo de relaciones. Solo entonces elige vectores que realmente estén respaldados por las precondiciones que encontraste. Entender los protocolos no es académico — es lo que separa la enumeration indiscriminada de la búsqueda de rutas dirigida y eficiente.

## Glosario de términos clave

- **AD (Active Directory)**: Servicio de directorio centralizado de Microsoft para identidad, autenticación y políticas.
- **DC (Domain Controller)**: Servidor que aloja la base de datos AD y gestiona la autenticación.
- **KDC (Key Distribution Center)**: Servicio de Kerberos (AS+TGS) en el DC que emite tickets.
- **TGT (Ticket Granting Ticket)**: Prueba de la autenticación inicial, usada para solicitar tickets de servicio.
- **TGS (Ticket Granting Service ticket)**: Ticket para un servicio específico, cifrado con la clave de la cuenta de servicio.
- **SPN (Service Principal Name)**: Identificador único que mapea una instancia de servicio a una cuenta; necesario para la autenticación de servicios con Kerberos.
- **Kerberoasting**: Solicitar TGS para un SPN → crackear el hash offline.
- **AS-REP Roasting**: Obtener el AS-REP de un usuario con preauth deshabilitado → crackear el hash offline.
- **LDAP**: Protocolo de consultas para leer/escribir datos del directorio AD.
- **LDAPS**: LDAP sobre TLS (cifrado).
- **GPO (Group Policy Object)**: Colección de configuraciones que aplican la política; se aplica a un alcance.
- **OU (Organizational Unit)**: Contenedor para organizar objetos y delegar control.
- **ACL (Access Control List)**: Permisos que definen quién puede leer/modificar un objeto.
- **FSMO**: Roles de operaciones flexible single-master con deberes especializados.
- **Trust**: Relación que permite la autenticación entre dominios/bosques.
- **DCSync**: Técnica para replicar cambios del directorio y extraer hashes del DC (requiere permisos).
