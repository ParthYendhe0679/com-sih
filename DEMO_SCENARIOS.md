# KRITAGAS Live Demonstration Scenarios

This guide details 5 step-by-step demonstration scenarios designed for hackathons, jury presentations, and stakeholder audits using the synthetic demo data system.

---

## Scenario 1: Cross-City Syndicate Discovery (Mumbai -> Thane -> Navi Mumbai)

### Narrative
A series of seemingly isolated crimes (ATM skimming in Mumbai, hawala extortion in Thane, and customs crypto phishing in Navi Mumbai) are unmasked as a single coordinated criminal syndicate by KRITAGAS graph analytics.

### Steps to Demonstrate:
1. Open the **Intelligence Network Graph** on the dashboard.
2. Select **Case 1: `MUM-2026-CR-00101`** (*Operation Deep Skim*).
3. Observe the core nodes:
   - Primary Suspect: **Arjun "Shadow" Verma**
   - Sighted Vehicle: **MH-02-DN-4821** (Black Hyundai Creta)
   - Intercepted Burner Contact: **+91-98201-44912**
4. Expand 2-hop graph neighbors:
   - The graph displays bridge edges stretching across city borders:
     - **Vehicle `MH-02-DN-4821`** is highlighted as sighted at Majiwada Junction in **Case 2: `THN-2026-CR-00204`** (Thane).
     - **Burner `+91-98201-44912`** connects to **Vikram Singhania** in Thane and **Priya Nair** in **Case 3: `NAV-2026-CR-00307`** (Navi Mumbai).
5. Point out to the evaluator that three separate police commissionerates (Mumbai, Thane, Navi Mumbai) would typically treat these as separate crimes, but KRITAGAS unifies them automatically.

---

## Scenario 2: Automated FIR Ingestion & Entity Extraction Pipeline

### Narrative
An investigator receives a fresh FIR from BKC Cyber Police Station or Vashi Police Station and uploads it into the KRITAGAS OCR/NER ingestion engine.

### Steps to Demonstrate:
1. Navigate to **FIR Ingestion / Upload** (`/fir/new` or `/intelligence/samanvaya`).
2. Select or copy text from `backend/data/sample_firs/sample_fir_01.txt` or `sample_fir_02.txt`.
3. Submit the FIR.
4. Observe the automated pipeline:
   - **OCR / Text Parsing**: Extracts complainant name, police station, date/time, and IPC sections.
   - **NER Extraction**: Extracts entities:
     - Person: `Arjun Verma` (Alias: `Shadow`)
     - Vehicle: `MH-02-DN-4821`
     - Phone: `+91-98201-44912`
   - **Cross-Case Alert**: The system alerts that vehicle `MH-02-DN-4821` matches an active alert in Thane!

---

## Scenario 3: AI Modus Operandi & Case Similarity Engine

### Narrative
When analyzing an ongoing ATM skimming incident, the investigator queries the AI engine for historical precedents to find solved tactics and conviction paths.

### Steps to Demonstrate:
1. Navigate to **Case Details -> Similarity & Precedents** for `MUM-2026-CR-00101`.
2. Notice the top-ranked match:
   - **Match**: `NAV-2025-CR-00094` (*Seawoods Grand Retail POS Skimming Ring*)
   - **Similarity Score**: **0.89** (Modus Operandi Score: **0.94**)
   - **Explainable Summary**: *"High correlation detected: Shared micro-skimmer hardware insertion technique and magnetic stripe track-2 dumping."*
3. Show the **Outcome Actionable Lead**:
   - The precedent case documents that the perpetrator ordered custom flex-PCBs from a technician in Navi Mumbai, leading investigators directly to hardware suspect **Tariq Sheikh**.

---

## Scenario 4: Geographic Hotspot & Spatial Risk Predictive Map

### Narrative
Police leadership requires spatial intelligence on where to deploy night patrols and ANPR camera checkpoints across the Mumbai Metropolitan Region.

### Steps to Demonstrate:
1. Open the **Crime Hotspots & Spatial Analytics** page (`/analytics/hotspots` or `/cases`).
2. Observe the map visualization rendering over 1,000 geo-temporal events clustered into 3 primary zones:
   - **Mumbai Financial Corridor** (BKC & Bandra) — High density of ATM and cyber incidents during late-night hours.
   - **Thane Bullion Market** (Naupada & Majiwada) — Commercial fraud and afternoon extortion threats.
   - **Navi Mumbai Maritime Hub** (Vashi & JNPT) — Cargo and customs logistics tampering.
3. Filter by **Time Bucket**: Select `LATE_NIGHT` to highlight the specific ATM skimming vector.
4. Filter by **City**: Filter smoothly between Mumbai (40%), Thane (30%), and Navi Mumbai (30%).

---

## Scenario 5: High-Speed Valkey / Redis Caching Performance

### Narrative
During high-concurrency investigations, the dashboard and network graphs load in sub-10 milliseconds via pre-warmed Valkey cache-aside pattern.

### Steps to Demonstrate:
1. Open developer tools (Network tab) or terminal.
2. Load the main dashboard overview (`kritagas:dashboard:overview`):
   - Response time: **< 15 ms**
   - Total Cases: **1,000**
   - Active Syndicates: **3**
3. Open `kritagas:case:MUM-2026-CR-00101:network`:
   - Instant rendering of pre-computed network graph nodes without querying relational tables.
