---
title: "Home Lab SIEM with Wazuh"
description: "Centralized SIEM using Wazuh all-in-one. Agents on Linux and Windows with Sysmon, FIM, vulnerability detection, and custom dashboards for real-time security monitoring."
category: "SIEM"
team: "Blue Team"
tags: ["Wazuh", "Elasticsearch", "Sysmon", "Linux", "Windows", "YARA"]
featured: false
date: "2025-01-01"
timeline: "Ongoing (2025)"
---

Complete SIEM deployed with Wazuh all-in-one (manager + indexer + dashboard). Agents installed on
Linux and Windows with enriched telemetry: Sysmon on Windows for detailed process and network
connection logging, security auditing on Linux. Implemented detection use cases: brute force
detection, FIM (File Integrity Monitoring) in critical directories, malware detection with YARA,
and vulnerability scanning. Custom dashboards to visualize authentications, privilege changes, and
security events in real time.

## Challenges

- Sizing SIEM resources for a home lab environment
- Enriching events with Sysmon without saturating the index
- Building dashboards that are useful and not just visual noise

## Takeaways

- Fully operational SIEM with agents on Linux and Windows
- Detection of brute force, FIM changes, and malware with YARA
- Security dashboards for real-time monitoring
