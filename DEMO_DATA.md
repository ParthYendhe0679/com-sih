# KRITAGAS Synthetic Demo Data Architecture & Guide

This document provides the technical specification, provenance, topology, and operational guidelines for the **KRITAGAS 5,000+ Record Synthetic Demo Data Suite**.

---

## 1. Provenance & Safety Compliance

All demo records generated across relational, graph, vector, and cache systems are strictly synthetic:
- **Seed Determinism**: Fixed random generator seed `DEMO_SEED = 42` (`KRITAGAS_2026`).
- **Provenance Tags**: Every record possesses `is_synthetic = True` and `data_source = "KRITAGAS_DEMO"`.
- **Fictional Entity Protection**: All personal names, masked Aadhaar (`XXXX-XXXX-XXXX`), PAN (`A****X`), mobile numbers (`+91-98XXX-XXXXX`), vehicle license numbers, and bank accounts are entirely fictional and generated algorithmically. Zero real-world victim, witness, or criminal records are used.

---

## 2. Multi-Tier Database Topology

```
┌─────────────────────────────────────────────────────────────┐
│                 KRITAGAS Next.js Frontend                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST / JSON (JWT Auth)
┌──────────────────────────────▼──────────────────────────────┐
│                    FastAPI Backend Core                     │
└───────┬──────────────┬──────────────┬──────────────┬────────┘
        │              │              │              │
┌───────▼──────┐┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐
│  PostgreSQL  ││  Neo4j Aura ││ Valkey/Redis││ Sample FIRs │
│  (1,000 Cases││(Graph Nodes,││ (Pre-warmed ││  (5 Test    │
│2,000 Entities││Cross-City   ││  Dashboard  ││  Narratives │
│1,000 Events) ││Bridge Edges)││  Caches)    ││   in Raw TXT│
└──────────────┘└─────────────┘└─────────────┘└─────────────┘
```

---

## 3. Geographic Demarcation & Coordinate Demarcation

Records are distributed across 3 administrative jurisdictions:

| Jurisdiction | Share | Bounding Latitude | Bounding Longitude | Primary Localities |
|---|---|---|---|---|
| **Mumbai** | **40.1%** | 18.9000 – 19.2500 | 72.8000 – 72.9500 | Bandra Kurla Complex (BKC), Bandra West, Andheri West, Colaba, Dadar Central, Kurla City, Chembur East, Worli |
| **Thane** | **30.4%** | 19.1800 – 19.3000 | 72.9500 – 73.0800 | Naupada, Kopri, Vartak Nagar, Majiwada Junction, Ghodbunder Road, Wagle Estate, Kalwa Station |
| **Navi Mumbai** | **29.5%** | 19.0000 – 19.1500 | 72.9800 – 73.1200 | Vashi Sector 17, Nerul Central, CBD Belapur, Kharghar Hills, Airoli Tech Park, Sanpada, Seawoods Grand, Turbhe MIDC |

---

## 4. The 5 Synthetic Datasets (5,000 Records Total)

### Dataset 1: Cases (`dataset_1_cases.json` — 1,000 records)
- **10 Live Cases**:
  - **Case 1 (Mumbai)**: `MUM-2026-CR-00101` — *Operation Deep Skim: BKC Financial Kiosk Firmware Hijack* (Lead suspect: Arjun "Shadow" Verma).
  - **Case 2 (Thane)**: `THN-2026-CR-00204` — *Naupada Bullion Cyber Hawala & Extortion* (Connected to Arjun Verma and Creta `MH-02-DN-4821`).
  - **Case 3 (Navi Mumbai)**: `NAV-2026-CR-00307` — *Vashi Tech Escrow Phishing & Customs Clearance Extortion* (Connected to burner `+91-98201-44912` and USDT wallet).
  - **Case 4 (Mumbai)**: `MUM-2026-CR-00108` — *Kurla Document Forgery & Mule Account Factory* (Supplied burner credentials to Arjun Verma).
  - **Case 5 (Thane)**: `THN-2026-CR-00209` — *Kopri Commercial Tenant Assault & Property Dispute* (**Isolated case**, 0 cross-city edges).
  - **Case 6 (Navi Mumbai)**: `NAV-2026-CR-00311` — *Kharghar Construction Site Nighttime Copper Cable Theft* (**Isolated case**, local theft).
  - **Case 7 (Mumbai)**: `MUM-2025-CR-00088` — *Operation Sea Gate: Mumbai Port Container Pilferage* (**Resolved precedent**, `case_outcome` recorded).
  - **Case 8 (Navi Mumbai)**: `NAV-2025-CR-00094` — *Seawoods Grand Retail POS Skimming Ring* (**Resolved precedent**, `case_outcome` recorded).
  - **Case 9 (Mumbai)**: `MUM-2026-CR-00115` — *Dadar Terminus Synthetic Stimulant Transit Intercept*.
  - **Case 10 (Thane)**: `THN-2026-CR-00218` — *Ghodbunder Road Smart Key Cloner Car Ring*.
- **30 Core Historical Precedents**: 2005–2024 detailed precedents across all 3 cities with full MO and outcome summaries.
- **960 Extended Historical Cases**: Synthesized multi-category case records providing depth for predictive hotspotting and historical search.

### Dataset 2: Persons & Entities (`dataset_2_persons.json` — 1,000 records)
- **Syndicate Hierarchy**:
  - `Arjun Verma` (Alias: "Shadow", Role: Mastermind / Cyber Coordinator, Phone: `+91-98201-44912`)
  - `Vikram Singhania` (Alias: "Doctor", Role: Hawala Broker / Financier, Location: Naupada, Thane)
  - `Priya Nair` (Alias: "Cipher", Role: Escrow / Crypto Conversion Desk, Location: Vashi, Navi Mumbai)
  - `Rajesh Gaikwad` (Alias: "Kaka", Role: Document Forger / SIM Provisioner, Location: Kurla, Mumbai)
  - `Tariq Sheikh` (Alias: "Volt", Role: Hardware Assembly Technician, Location: Navi Mumbai)
- **Investigating Officers**:
  - `Inspector Devendra Patil` (BKC Cyber PS)
  - `Senior PI Mahesh Shinde` (Naupada PS)
  - `ACP Sunita Sawant` (Navi Mumbai Crime Branch)
- **Extended Persons**: 992 suspects, complainants, witnesses, and informants with complete demographic attributes.

### Dataset 3: Vehicles & Objects (`dataset_3_objects.json` — 1,000 records)
- **Key Bridge Vehicle**: `MH-02-DN-4821` (Phantom Black Hyundai Creta SX 2022).
- **Key Burner Phone**: `+91-98201-44912` (Jio Synthetic SIM, IMEI: `864291048821039`).
- **Key Crypto Wallet**: `0x7F41A92B6E324881A4513B902CFD88902A1EC48B` (Tether USDT multi-sig).
- **Contraband Hardware**: `Deep-Insert Micro-Skimmer Rev-3` (NCR/Diebold flex-PCB skimmer).
- **Extended Objects**: 996 vehicles (MH-01 through MH-43), mobile phones, bank accounts, and digital forensic storage units.

### Dataset 4: Relationships (`dataset_4_relationships.json` — 1,000 records)
- **Cluster 1**: South/Central Mumbai network (~400 edges).
- **Cluster 2**: Thane/Kalyan bullion corridor (~300 edges).
- **Cluster 3**: Navi Mumbai logistics & port network (~300 edges).
- **Cross-City Bridge Edges**:
  - `Arjun Verma` linked to both `MUM-2026-CR-00101` and `THN-2026-CR-00204`.
  - `MH-02-DN-4821` sighted at both BKC ATM and Naupada Majiwada crime scenes.
  - `+91-98201-44912` coordinated calls between Arjun Verma, Vikram Singhania, and Priya Nair.
  - Hawala funds flow from Vikram Singhania (Thane) to Priya Nair (Navi Mumbai).

### Dataset 5: Geo-Temporal Events (`dataset_5_geo_events.json` — 1,000 records)
- Timestamped incidents, vehicle sightings, CDR tower pings, and ATM withdrawal flags.
- Bounded coordinates mapped to real Mumbai, Thane, and Navi Mumbai police jurisdictions.
- Categorized into time buckets (`MORNING`, `AFTERNOON`, `EVENING`, `NIGHT`, `LATE_NIGHT`) and risk levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).

---

## 5. Automation CLI Reference

```bash
# 1. Regenerate synthetic JSON datasets to backend/data/synthetic/
python -u backend/scripts/generate_demo_data.py

# 2. Seed data into PostgreSQL, Neo4j Aura, and Valkey Cache
python -u backend/scripts/seed_demo_data.py

# 3. Verify health across all 5 databases & services (10/10 checks)
python -u backend/scripts/verify_demo_data.py

# 4. Safely purge only synthetic demo data without touching real records
python -u backend/scripts/reset_demo_data.py
```
