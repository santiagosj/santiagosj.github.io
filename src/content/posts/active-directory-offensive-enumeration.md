---
title: "Active Directory: An Offensive Enumeration Guide"
description: "From zero AD knowledge to understanding the attack surface and discovery techniques. A structured breakdown of components, protocols, enumeration strategies, and common vectors with analogies before the technical detail."
category: "Method"
tags: ["Active Directory", "AD", "Kerberos", "LDAP", "Enumeration", "Pentesting"]
featured: false
date: "2026-10-05"
---

> Understanding Active Directory is less about memorizing tool syntax and more about understanding how identity, trust, and policy work together. This article focuses on enumeration first, so the attack paths that follow make sense instead of feeling like a checklist.

## The question

How does an Active Directory domain actually work, and more importantly, what parts of it form a discoverable attack surface before running any tools?

The goal is simple: after reading this, you should be able to map an AD environment conceptually, know what to enumerate at each phase (unauthenticated vs authenticated), and understand *why* you're collecting each piece of information instead of blindly running scripts.

## The target model

Active Directory (AD) is Microsoft's directory service. It acts as a centralized database for identity, authentication, authorization, and policy enforcement in Windows environments. Rather than thinking of it as "just Windows servers", think of it as the **rulebook, phonebook, and bouncer** for an entire network.

- **The job it exists to do**: Authenticate users and computers, authorize access to resources, and enforce consistent configurations across the domain.
- **Components**: Domain Controllers (DCs) hold the directory database and handle authentication; Domains group objects under a security boundary; Forests group domains under shared schemas/trusts; OUs organize objects for delegation and policy application; GPOs enforce settings; Trusts define how authentication flows between domains/forests.
- **Actors**: Anonymous users (if allowed), authenticated domain users, service accounts, computer accounts, domain admins/enterprise admins, and automated services.
- **Assets that matter**: User credentials, Kerberos tickets, service account passwords, Group Policy objects that can be abused, ACLs that grant control, and the DC itself (which holds the keys to the kingdom).

> **Plain terms**
> Imagine a company building with ID cards. There's a central security office (Domain Controller) that issues and validates ID cards (tickets), keeps a master employee directory (LDAP database), and posts building rules on every floor (Group Policy). Different buildings might trust each other's ID offices (Trusts). You need to understand who works where, what doors they can open, and who can change the rules.

## The surface criteria

An element belongs to AD's attack surface if any of these hold true:

| Criterion | Question it answers |
| --- | --- |
| **Reachable** | Can an actor send network traffic to it (DNS, LDAP/LDAPS, Kerberos, SMB, RPC)? |
| **Translates** | Does it take input (queries, requests) and produce an authorization decision or return directory data? |
| **Brokers trust** | Does it trust another component without re-validating in a way we can abuse (trust relationships, SPNs, delegation)? |
| **Holds authority** | Does it hold credentials, tickets, password hashes, or privileges others assume? |

**Prioritization rule**: Reachability × Information Value × Privilege Escalation Potential ÷ Proof Cost. Focus on elements that yield actionable path information (users, groups, ACLs, SPNs, trusts) with minimal assumptions.

## The inventory

| Element | Purpose | Talks to | Trust boundary | Fails into |
| --- | --- | --- | --- | --- |
| **Domain** | Logical security boundary containing users, groups, computers, and policies. | DCs, member servers, clients | Authentication boundary (domain vs workgroup) | Compromise of one domain object can be pivoted within domain scope. |
| **Forest** | Collection of one or more domains sharing schema, configuration, global catalog. | Domains via trusts | Inter-domain security boundary | Forest compromise can affect all child domains if trusts allow. |
| **Tree** | Hierarchy of domains in same namespace sharing contiguous DNS names. | Parent/child domains | Namespace/trust boundary | Transitive trusts can propagate access. |
| **OU (Organizational Unit)** | Container for delegation and GPO scoping. | DCs, admins | Delegation boundary | Mis-delegated OU permissions enable privilege escalation. |
| **Domain Controller (DC)** | Hosts AD database (NTDS.dit), handles Kerberos/LDAP auth, enforces policy. | Everything in domain | Central trust authority | Full domain compromise if DC is owned (DCSync, hash extraction). |
| **Users/Groups/Computers** | Identities and principals. Groups define authorization. | DC (auth), resources | Identity boundary | Overprivileged groups/ACLs create lateral paths. |
| **GPOs** | Enforce settings, scripts, permissions. Applied to OUs/sites/domains. | DC, clients | Configuration authority | Misconfigured GPOs can lead to local privilege escalation/domain takeover. |
| **FSMO Roles** | Five flexible single-master operations (Schema, Domain Naming, RID, PDC Emulator, Infrastructure). | DCs | Critical ops boundary | Certain abuses depend on role holders (PDC for time/Kerberos anomalies). |
| **Trusts** | Directional/transitive relationships between domains/forests (one-way/two-way, external, forest). | DCs across trust | Cross-boundary auth | Trusts can be abused to pivot between domains/forests. |

## From element to vector

Vectors answer: Actor, Precondition, Primitive, Consequence, Objective. Leads become vectors only when all five are known.

**Surviving candidates (by enumeration value):**

1. **Unauthenticated info disclosure via LDAP/DNS/SMB**  
   - Actor: Unauthenticated attacker on network (internal) or with network access to domain segment  
   - Precondition: Reachable DC/DNS/SMB  
   - Primitive: Read metadata (users, groups, SPNs, domain info)  
   - Consequence: Build user list for Kerberoasting/AS-REP roasting, identify targets  
   - Objective: Gain initial foothold path or credential material

2. **Kerberos user enumeration**  
   - Actor: Unauthenticated  
   - Precondition: Kerberos (port 88) reachable  
   - Primitive: Validate usernames via AS-REQ behavior  
   - Consequence: Valid user list → targeted attacks  
   - Objective: Reduce guessing, focus on vulnerable accounts

3. **Authenticated LDAP enumeration**  
   - Actor: Authenticated domain user (valid creds/ticket)  
   - Precondition: Valid credentials  
   - Primitive: Full directory queries (users, groups, ACLs, trusts, GPO links, SPNs)  
   - Consequence: Map attack paths (BloodHound), identify ACL/GPO abuses, Kerberoastable accounts  
   - Objective: Privilege escalation/lateral movement

4. **Kerberoasting / AS-REP roasting surface**  
   - Actor: Authenticated or with userlist  
   - Precondition: Identified SPN accounts or users with DONT_REQ_PREAUTH  
   - Primitive: Obtain TGS/AS-REP hashes  
   - Consequence: Offline cracking → credential gain  
   - Objective: Initial access or lateral move

**Rejected candidates:**

> **Rejected:** Brute-forcing Kerberos passwords unauthenticated at scale — fails on *cost of proving*: noisy, slow, likely blocked; better to enumerate valid users first.  
> **Rejected:** Blind trust exploitation without mapping — fails on *primitive*: gives no concrete capability without knowing trust direction/transitivity and reachable resources.  
> **Rejected:** Trying DCSync unauthenticated — fails on *precondition*: requires specific high-privilege rights (Replicating Directory Changes) and usually needs authenticated context.

> **Plain terms**  
> Before picking any "attack", filter ruthlessly: What can I actually learn? Does that learning unlock a next step? If the answer is "maybe later" without specifics, it's a rabbit hole. Enumeration is the filter.

## Execution

### Authentication protocols — simple to technical

#### Kerberos (analogy first)
Think of Kerberos like a concert venue with a central box office (KDC = Key Distribution Center, split into AS and TGS). You show ID at box office (Authentication Server) and get a **TGT** (temporary ID badge). When you want to enter a specific room (service), you present your TGT to another window (Ticket Granting Server) and get a **TGS** (service ticket) for that room. The door checks the service ticket. The whole thing uses shared secrets (password hashes) so tickets can't be forged easily.

**Technical flow (key steps):**
- AS-REQ: Client sends request to KDC (AS) with username; KDC checks user exists. If preauth required, encrypted timestamp proves password knowledge.
- AS-REP: If valid, KDC returns TGT (encrypted with KRBTGT hash) + session key.
- TGS-REQ: Client presents TGT to TGS requesting access to SPN (Service Principal Name).
- TGS-REP: TGS returns service ticket (encrypted with service account hash) + session key.
- AP-REQ: Client presents service ticket to service for authentication.

**Enumeration relevance:** User existence can leak via AS-REQ behavior; accounts with SPNs yield TGS tickets (Kerberoastable); accounts without preauth yield AS-REP (AS-REP roastable).

#### LDAP (Lightweight Directory Access Protocol)
LDAP is the **query interface** to the AD database (like a SQL interface to a phonebook). You can ask "show me all users", "show me all groups", "find accounts with SPNs", etc.  
- **LDAP vs LDAPS**: LDAP is plaintext by default on 389; LDAPS (636) is LDAP wrapped in TLS. Both expose schema/data; LDAPS prevents eavesdropping.
- **Anonymous binds**: Some misconfigurations allow binding anonymously (no creds) and reading directory info. This is pure enumeration gold if allowed.
- **Common use**: Authenticated LDAP queries reveal ACLs, trusts, GPO links, nested groups, last logon info (careful with sensitive attrs), and much more.

#### NTLM (brief)
NTLM is legacy challenge-response auth. Still present. Its main offensive relevance is **NTLM relay** (abusing coerced auth) and pass-the-hash style moves in mixed environments. Focus on Kerberos/LDAP for enumeration first.

#### Group Policy Objects (GPOs)
GPOs are collections of settings applied to users/computers via OUs/domains/sites. They can deploy scripts, set permissions, install software, change registry.  
- **Why they matter**: Misconfigured GPO permissions (e.g. "Authenticated Users" can edit) or writable SYSVOL paths can let you drop malicious scripts executed as SYSTEM/domain users — a common escalation path.
- **Enumeration angle**: Find GPOs linked to interesting OUs, identify who can modify them (ACLs), check SYSVOL for scripts.

### Attack surface definition (AD context)
"Attack surface" = all reachable, input-handling, trust-brokering, or authority-holding points that can yield next-step capability when enumerated or abused.

- **Network-exposed services**: DNS (53), Kerberos (88 TCP/UDP), LDAP (389), LDAPS (636), SMB (445), RPC/DCERPC (135, high ports), WinRM (5985/5986) — many are needed for normal ops.
- **Authenticated vs unauthenticated surface**: Unauthenticated → user lists, domain info, sometimes anonymous LDAP. Authenticated → full map (ACLs, trusts, GPOs) enabling path building.
- **Trust relationships**: One-way/two-way, external/forest trusts expand effective surface across boundaries.
- **Misconfigurations as surface**: Preauth disabled (AS-REP roast), weak SPN service account passwords (Kerberoast), excessive ACLs, writable GPOs/SYSVOL, anonymous LDAP binds — these are enumeration-driven discoveries.

### Enumeration & discovery strategies

Organize by phase. The key: **enumerate first, attack second**.

#### Phase 1: Unauthenticated enumeration
Goal: Recon domain structure, valid users, reachable services.

| Technique | What | Notes |
| --- | --- | --- |
| **DNS** | Domain name, DCs, nameservers (nslookup/dig type=SRV/_ldap._tcp.dc._msdcs.<domain>) | Reveals DCs, GC, site info. Foundation for Kerberos/LDAP targeting. |
| **SMB null session** | Connect with null creds to IPC$ | Legacy; often blocked. If allowed, can leak shares/users depending on config. |
| **RPC null session / enum** | Query domain info via SAMR/RPC with null auth | Also legacy; check policy. |
| **Anonymous LDAP bind** | Bind to LDAP without creds, query base DNs | High value if allowed — dumps users/groups/OUs/SPNs without auth. |
| **Kerberos user enumeration** | AS-REQ with guessed usernames | Reveals valid usernames without password attempts (timing/response differences). |
| **Network mapping** | Port scan DCs (88, 389, 636, 445, 135, 5985/5986) | Validate reachability; avoid blind service brute force. |

#### Phase 2: Authenticated enumeration
Goal: Map relationships, privileges, paths. Needs at least one valid domain account.

| Technique | What | Notes |
| --- | --- | --- |
| **LDAP queries** | Users, groups (including nested), SPNs, OUs, trusts, GPO links, computer objects, ACLs | Core. Can filter to Kerberoastable (user accounts with SPNs), AS-REP roastable (userAccountControl flag), privileged groups. |
| **BloodHound** | Ingest LDAP/NetSessions/LocalAdmin data → graph attack paths | Visualizes shortest paths to DA via ACLs, group membership, trusts. Essential for modern AD path finding. |
| **PowerView (PowerShell)** | Enumerate domain, users, groups, ACLs, trusts, GPOs programmatically | Flexible; mirrors many LDAP queries. Good for targeted extraction. |
| **ldapsearch** | Direct LDAP queries from Linux | Scriptable, precise. Great for controlled extraction. |
| **rpcclient** | SAMR, LSA, NetLogon RPC queries | Legacy but still useful in some environments for local/domain info. |
| **netexec/crackmapexec style tooling** | Auth-based enumeration (users, shares, sessions) | Fast, but noisy; use with care and authorization. |

#### Phase 3: Kerberos-based enumeration
Focus on credential material without spraying passwords.

| Technique | What | Notes |
| --- | --- | --- |
| **Kerbrute (userenum)** | Enumerate valid usernames via Kerberos | Stealthier than SMB/RPC user enum in many configs; validates existence. |
| **Kerberoasting** | Request TGS for SPN accounts → extract service ticket hash | Offline crack. Target accounts with weak passwords; service accounts often misconfigured. |
| **AS-REP Roasting** | For users with "DONT_REQ_PREAUTH" set, get AS-REP hash directly | Extremely valuable; can yield creds without knowing password. |
| **SPN scanning** | Identify all user/computer accounts with SPNs | Reveals kerberoastable targets and often high-value services (MSSQL, CIFS, HTTP). |

**What to extract (checklist):** Domain FQDN, DC IPs, valid users, groups + memberships (especially Domain Admins/Enterprise Admins), computers, OUs, GPO links, ACLs on objects/OUs/GPOs, SPNs, trusts (direction/transitivity), accounts with DONT_REQ_PREAUTH, Kerberoastable accounts, delegation settings.

## Common attack vectors (conceptually)

Tie back to components/protocols above. These are conceptual; enumeration tells you which apply.

| Vector | Root cause | Prereq (from enum) | Effect |
| --- | --- | --- | --- |
| **Kerberoasting** | Service account has weak password; any domain user can request TGS for SPN. | Valid domain creds + SPN list | Offline cracking → service account creds → lateral/escalation. |
| **AS-REP Roasting** | User account has DONT_REQ_PREAUTH enabled. | User list showing preauth disabled | AS-REP hash → offline crack → valid creds. |
| **Pass-the-Hash (PTH)** | Reuse NT hash for auth (NTLM). | Captured NT hash + local admin/rights on target | Lateral movement to machines where hash is valid. |
| **DCSync** | Account has "Replicating Directory Changes" (and All) rights on domain. | Find accounts with DCSync rights via ACL enum (often Domain Admins, Enterprise Admins, or custom) | Extract NTDS.dit secrets (user hashes, KRBTGT) → full domain compromise. |
| **ACL abuse** | Over-permissive ACLs on users/groups/OUs/GPOs (GenericAll, WriteOwner, ForceChangePassword, GenericWrite). | ACL enumeration on target objects | Modify object → reset password, add to group, take ownership → privilege escalation. |
| **GPO abuse** | Writable GPO or writable SYSVOL linked to users/computers. | GPO links + edit permissions | Deploy malicious script run as SYSTEM/target user → local/domain escalation. |
| **Delegation abuse** | Unconstrained/constrained/RBCD misconfigurations | Delegation flags from LDAP | Impersonate users (including privileged) to services → escalate. |

## Closing

The philosophy is simple: **enumerate first, attack second**. Tools like BloodHound, ldapsearch, Kerbrute, Impacket are force multipliers — but without understanding Kerberos ticket flow, LDAP's role as the directory interface, trust boundaries, and what ACLs/GPOs actually mean, you'll run them blindly and miss the "why".

Start from reachability (DNS/ports), move to unauthenticated metadata (users/SPNs/domain info), then pivot to authenticated LDAP to build the relationship graph. Only then do you pick vectors that are actually supported by preconditions you found. Understanding the protocols isn't academic — it's what separates shotgun enumeration from targeted, efficient path finding.

## Glossary of key terms

- **AD (Active Directory)**: Microsoft's centralized directory service for identity, auth, policy.
- **DC (Domain Controller)**: Server hosting AD database and handling auth.
- **KDC (Key Distribution Center)**: Kerberos service (AS+TGS) on DC issuing tickets.
- **TGT (Ticket Granting Ticket)**: Proof of initial auth, used to request service tickets.
- **TGS (Ticket Granting Service ticket)**: Ticket for specific service, encrypted with service account key.
- **SPN (Service Principal Name)**: Unique identifier mapping service instance to account; required for Kerberos service auth.
- **Kerberoasting**: Request TGS for SPN → crack hash offline.
- **AS-REP Roasting**: Get AS-REP for preauth-disabled user → crack hash offline.
- **LDAP**: Query protocol to read/write AD directory data.
- **LDAPS**: LDAP over TLS (encrypted).
- **GPO (Group Policy Object)**: Collection of settings enforcing policy; applied to scope.
- **OU (Organizational Unit)**: Container for organizing objects and delegating control.
- **ACL (Access Control List)**: Permissions defining who can read/modify an object.
- **FSMO**: Flexible Single Master Operations roles with specialized duties.
- **Trust**: Relationship allowing auth between domains/forests.
- **DCSync**: Technique to replicate directory changes and extract hashes from DC (requires rights).
