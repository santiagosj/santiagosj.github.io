# Graph Report - portfolio  (2026-10-28)

## Corpus Check
- 73 files · ~65,135 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: .scss 12, (none) 1)

## Summary
- 299 nodes · 485 edges · 22 communities (16 shown, 6 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.87)
- Token cost: 401,634 input · 0 output

## Community Hubs (Navigation)
- Dev Tooling & Lint
- Runtime Dependencies
- Markdown & Language UI
- Content Collection Loader
- AD Enumeration & Surface Rubric
- Credential & Privesc Method
- App TS Config
- Node TS Config
- Agent Rules & HTB Posts
- NPM Scripts
- SOC Homelab Project
- HTB Privesc Posts
- HTB Pivoting Posts
- Vite Logo
- Five-Question Vector
- K8s Hardening Project
- Root TS Config
- Dork Helper Draft
- Wazuh SIEM Draft
- Vite Template Entry
- EN/ES Switch

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 20 edges
2. `compilerOptions` - 18 edges
3. `react` - 16 edges
4. `useLanguage()` - 11 edges
5. `react-router-dom` - 9 edges
6. `AppRouter()` - 9 edges
7. `Locale` - 9 edges
8. `ProjectDetail()` - 8 edges
9. `Projects()` - 8 edges
10. `AppHolder()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Frontend-to-Pentester refactor prompt` --references--> `Custom Pentest Reporting Engine (draft)`  [INFERRED]
  PROMPT_REFACTOR.md → src/content/_drafts/pentest-reporting-engine.md
- `Frontend-to-Pentester refactor prompt` --references--> `Web Pentest Lab Writeups (draft)`  [INFERRED]
  PROMPT_REFACTOR.md → src/content/_drafts/web-pentest-writeups.md
- `Arsenal de Escalada de Privilegios (ES)` --semantically_similar_to--> `Privilege Escalation Arsenal`  [INFERRED] [semantically similar]
  src/content/projects/privesc-arsenal.es.md → src/content/projects/privesc-arsenal.md
- `Escalada de privilegios en Linux: las preguntas correctas (ES)` --semantically_similar_to--> `Linux privilege escalation: the questions, not the commands (EN)`  [INFERRED] [semantically similar]
  src/content/posts/linux-privesc-intersection.es.md → src/content/posts/linux-privesc-intersection.md
- `Ejes de superficie de escalada` --semantically_similar_to--> `Privesc surface axes (runs above me / write reaches up / contact with root / unverified trust / context crossing)`  [INFERRED] [semantically similar]
  src/content/posts/linux-privesc-intersection.es.md → src/content/posts/linux-privesc-intersection.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **HTB writeup series (EN posts)** — content_posts_htb_ad_attacks, content_posts_htb_linux_privesc, content_posts_htb_recon_methodology, content_posts_htb_tunneling_pivoting, content_posts_htb_web_exploitation, content_posts_htb_windows_privesc [EXTRACTED 0.90]
- **Eight-section content discipline** — src_content_template_article_skeleton, src_content_template_project_project_skeleton, agents_content_template_rules [EXTRACTED 0.90]
- **Red Team draft project write-ups** — content__drafts_dork_helper_extension, content__drafts_pentest_reporting_engine, content__drafts_web_pentest_writeups [INFERRED 0.75]
- **Security project portfolio (Red & Blue team labs)** — src_content_projects_ad_lab_project, src_content_projects_privesc_arsenal_project, src_content_projects_secure_k8s_lab_project, src_content_projects_soc_homelab_project [INFERRED 0.75]
- **Honesty method: write the rejection, assert state, state the limits** — src_content_projects_privesc_arsenal_rejection_log, src_content_projects_privesc_arsenal_read_only_constraint, src_content_projects_ad_lab_assert_not_describe, src_content_projects_soc_homelab_evidence_before_dashboards [INFERRED 0.75]
- **Shared reachable/translates/brokers-trust/holds-authority surface rubric across posts** — src_content_posts_active_directory_offensive_enumeration_surface_criteria_rubric, src_content_posts_attack_surface_is_not_a_port_list_surface_criteria_rubric, src_content_posts_exposed_git_repository_extraction_surface_criteria_rubric [INFERRED 0.95]
- **AD credential-material attacks (Kerberoasting, AS-REP Roasting, DCSync)** — src_content_posts_active_directory_offensive_enumeration_kerberoasting, src_content_posts_active_directory_offensive_enumeration_as_rep_roasting, src_content_posts_active_directory_offensive_enumeration_dcsync [EXTRACTED 0.85]
- **Destination-first credential-hunting method** — src_content_posts_credential_hunting_is_not_a_find_command_destination_first, src_content_posts_credential_hunting_is_not_a_find_command_surface_criteria, src_content_posts_credential_hunting_is_not_a_find_command_the_map, src_content_posts_credential_hunting_is_not_a_find_command_five_question_vector, src_content_posts_credential_hunting_is_not_a_find_command_priority_formula [EXTRACTED 0.85]
- **Crossing-based Linux privesc method** — src_content_posts_linux_privesc_intersection_crossing_principle, src_content_posts_linux_privesc_intersection_surface_criteria, src_content_posts_linux_privesc_intersection_priority_formula, src_content_posts_linux_privesc_intersection_five_question_vector, src_content_posts_linux_privesc_intersection_context_first [EXTRACTED 0.85]

## Communities (22 total, 6 thin omitted)

### Community 0 - "Dev Tooling & Lint"
Cohesion: 0.07
Nodes (37): devDependencies, babel-plugin-react-compiler@^1.0.0, eslint@^9.39.1, @eslint/js@^9.39.1, eslint-plugin-react-hooks@^7.0.1, eslint-plugin-react-refresh@^0.4.24, gh-pages@^6.3.0, globals@^16.5.0 (+29 more)

### Community 1 - "Runtime Dependencies"
Cohesion: 0.10
Nodes (26): dependencies, highlight.js@^11.12.0, marked@^18.0.14, p5@^2.2.0, react@^19.2.0, react-dom@^19.2.0, react-router-dom@^7.13.0, highlight.js (+18 more)

### Community 2 - "Markdown & Language UI"
Cohesion: 0.14
Nodes (25): LangSwitch(), OPTIONS, useLanguage(), MarkdownContent(), Props, renderer, Section, sectionsOf() (+17 more)

### Community 3 - "Content Collection Loader"
Cohesion: 0.15
Nodes (27): byDateDesc(), Entry, flag(), FrontmatterData, loadCollection(), localize(), optionalText(), tagList() (+19 more)

### Community 4 - "AD Enumeration & Surface Rubric"
Cohesion: 0.09
Nodes (21): Active Directory: An Offensive Enumeration Guide (post), Active Directory (directory service), BloodHound attack-path graphing, Element-to-vector framework (actor/precondition/primitive/consequence/objective), Active Directory: Guia de enumeration ofensiva (post, ES), Kerberos authentication (KDC/TGT/TGS/SPN), LDAP directory query interface, Surface criteria rubric (reachable/translates/brokers trust/holds authority) (+13 more)

### Community 5 - "Credential & Privesc Method"
Cohesion: 0.09
Nodes (17): Credential hunting is not a find command (EN), La caza de credenciales no es un comando find (ES), Criterios de superficie de credenciales, Credential priority formula (authority x portability / cost x noise), Credential surface criteria (portable/translates/authority/checkable), The three-question map (where/what-it-accepts/which-stores), Linux privilege escalation: the questions, not the commands (EN), Escalada de privilegios en Linux: las preguntas correctas (ES) (+9 more)

### Community 6 - "App TS Config"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+13 more)

### Community 7 - "Node TS Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 8 - "Agent Rules & HTB Posts"
Cohesion: 0.14
Nodes (13): Custom Pentest Reporting Engine (draft), Custom Pentest Reporting Engine (draft, ES), Web Pentest Lab Writeups (draft), Web Pentest Lab Writeups (draft, ES), HTB: Active Directory Attack Paths, HTB: Rutas de Ataque en Active Directory, HTB: Reconnaissance & Enumeration Playbook, HTB: Playbook de Reconocimiento y Enumeración (+5 more)

### Community 9 - "NPM Scripts"
Cohesion: 0.33
Nodes (6): scripts, build, deploy, dev, lint, preview

### Community 10 - "SOC Homelab Project"
Cohesion: 0.40
Nodes (3): SOC Homelab por casos cerrados (ES), Human in the loop (no automated block without approval), SOC Homelab organized around closed cases

### Community 11 - "HTB Privesc Posts"
Cohesion: 0.50
Nodes (4): HTB: Linux Privilege Escalation Deep Dive, HTB: Escalada de Privilegios en Linux, HTB: Windows Privilege Escalation Techniques, HTB: Técnicas de Escalada de Privilegios en Windows

### Community 12 - "HTB Pivoting Posts"
Cohesion: 0.50
Nodes (4): HTB: Tunneling, Pivoting & Port Forwarding, HTB: Túneles, Pivoting y Reenvío de Puertos, HTB: Web Exploitation & Pivoting, HTB: Explotación Web y Pivoting

### Community 13 - "Vite Logo"
Cohesion: 0.50
Nodes (4): Vite Build Tool, Inverted Triangle/Chevron (blue-purple gradient), Lightning Bolt Glyph (yellow-orange gradient), Vite Logo (SVG favicon)

### Community 14 - "Five-Question Vector"
Cohesion: 0.50
Nodes (4): Five-question vector (actor/precondition/primitive/consequence/objective), Fictional estate (relay / ws-ops-01 / prod-app), Five-question vector (actor/precondition/primitive/consequence/objective), Fictional build server forge

### Community 15 - "K8s Hardening Project"
Cohesion: 0.50
Nodes (4): Defense-in-depth K8s hardening (NetPol, RBAC, Falco), Endurecimiento de Kubernetes (ES), Kubernetes Security Hardening & Runtime Monitoring, STRIDE threat modeling per component

## Knowledge Gaps
- **37 isolated node(s):** `EN/ES content switch`, `React + TypeScript + Vite template README`, `App HTML entry point`, `Dork Helper Extension (draft)`, `Dork Helper Extension (draft, ES)` (+32 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 116 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Runtime Dependencies` to `Dev Tooling & Lint`, `Markdown & Language UI`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **What connects `EN/ES content switch`, `React + TypeScript + Vite template README`, `App HTML entry point` to the rest of the system?**
  _37 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dev Tooling & Lint` be split into smaller, more focused modules?**
  _Cohesion score 0.07087486157253599 - nodes in this community are weakly interconnected._
- **Why does `react-router-dom` connect `Runtime Dependencies` to `Dev Tooling & Lint`, `Markdown & Language UI`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Should `Runtime Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0957983193277311 - nodes in this community are weakly interconnected._
- **Should `Markdown & Language UI` be split into smaller, more focused modules?**
  _Cohesion score 0.1443850267379679 - nodes in this community are weakly interconnected._
- **Should `Content Collection Loader` be split into smaller, more focused modules?**
  _Cohesion score 0.14919354838709678 - nodes in this community are weakly interconnected._