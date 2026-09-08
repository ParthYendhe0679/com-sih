"""KRITAGAS Synthetic Demo Data Generator (5,000+ Records).

Generates 5 deterministic, fully synthetic datasets with realistic Mumbai/Thane/Navi Mumbai geography,
hidden cross-city criminal syndicates, isolated cases, resolved historical precedents, and geo-temporal events.
All records are strictly tagged with is_synthetic=True and data_source="KRITAGAS_DEMO".
"""

import os
import sys
import json
import uuid
import random
from datetime import date, datetime, time, timedelta

DEMO_SEED = 42
rng = random.Random(DEMO_SEED)

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "synthetic")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# -------------------------------------------------------------
# GEOGRAPHIC DEFINITIONS & BOUNDING BOXES
# -------------------------------------------------------------
REGIONS = {
    "MUMBAI": {
        "city": "Mumbai",
        "region": "Mumbai Metropolitan",
        "areas": [
            ("Bandra West", 19.0596, 72.8295, "Bandra Police Station"),
            ("Bandra Kurla Complex", 19.0660, 72.8680, "BKC Cyber Police Station"),
            ("Andheri West", 19.1363, 72.8277, "Andheri West Police Station"),
            ("Colaba", 18.9067, 72.8147, "Colaba Police Station"),
            ("Dadar Central", 19.0178, 72.8478, "Dadar Police Station"),
            ("Kurla City", 19.0657, 72.8792, "Kurla Police Station"),
            ("Chembur East", 19.0622, 72.8974, "Chembur Police Station"),
            ("Worli Coastal", 19.0134, 72.8182, "Worli Police Station"),
            ("Malad West", 19.1860, 72.8485, "Malad Police Station"),
            ("Ghatkopar East", 19.0860, 72.9090, "Ghatkopar Police Station"),
            ("Powai Tech Zone", 19.1176, 72.9060, "Powai Police Station"),
            ("Juhu Beachfront", 19.0988, 72.8264, "Juhu Police Station"),
        ],
    },
    "THANE": {
        "city": "Thane",
        "region": "Thane Commissionerate",
        "areas": [
            ("Naupada", 19.1880, 72.9720, "Naupada Police Station"),
            ("Kopri", 19.1790, 72.9640, "Kopri Police Station"),
            ("Vartak Nagar", 19.2080, 72.9620, "Vartak Nagar Police Station"),
            ("Majiwada Junction", 19.2150, 72.9790, "Kapurbawdi Police Station"),
            ("Ghodbunder Road", 19.2630, 72.9690, "Kasarvadavali Police Station"),
            ("Wagle Estate", 19.1950, 72.9460, "Wagle Estate Police Station"),
            ("Kalwa Station", 19.1990, 72.9980, "Kalwa Police Station"),
            ("Panch Pakhadi", 19.1910, 72.9660, "Naupada Police Station"),
            ("Kalyan Gate", 19.2402, 73.1305, "Kalyan City Police Station"),
        ],
    },
    "NAVI_MUMBAI": {
        "city": "Navi Mumbai",
        "region": "Navi Mumbai Commissionerate",
        "areas": [
            ("Vashi Sector 17", 19.0770, 72.9980, "Vashi Police Station"),
            ("Nerul Central", 19.0330, 73.0160, "Nerul Police Station"),
            ("CBD Belapur", 19.0200, 73.0400, "CBD Belapur Police Station"),
            ("Kharghar Hills", 19.0470, 73.0690, "Kharghar Police Station"),
            ("Airoli Tech Park", 19.1570, 72.9980, "Airoli Police Station"),
            ("Sanpada East", 19.0640, 73.0080, "Sanpada Police Station"),
            ("Kopar Khairane", 19.1020, 73.0110, "Kopar Khairane Police Station"),
            ("Seawoods Grand", 19.0170, 73.0180, "NRI Coastal Police Station"),
            ("Turbhe MIDC", 19.0830, 73.0230, "Turbhe Police Station"),
            ("Panvel City", 18.9894, 73.1175, "Panvel City Police Station"),
        ],
    },
}

CRIME_CATEGORIES = [
    "Cybercrime", "Financial Fraud", "Burglary", "Narcotics",
    "Extortion", "Vehicle Theft", "Organized Crime", "Homicide", "Cargo Theft"
]

FIRST_NAMES = [
    "Aarav", "Arjun", "Aditya", "Devendra", "Girish", "Kunal", "Mahesh", "Nikhil",
    "Pranav", "Rajesh", "Rohan", "Sachin", "Sameer", "Sanjay", "Suresh", "Tariq",
    "Vikram", "Vishal", "Yogesh", "Ananya", "Deepa", "Kavita", "Meera", "Neha",
    "Pooja", "Priya", "Ritu", "Sunita", "Sneha", "Tanvi"
]
LAST_NAMES = [
    "Verma", "Patil", "Deshmukh", "Singhania", "Gaikwad", "Sheikh", "Nair",
    "Kulkarni", "Shinde", "Jadhav", "Sawant", "Chavan", "Mehta", "Shah",
    "Kapoor", "Bhosale", "Pawar", "More", "Tambe", "Kadam"
]

VEHICLE_MAKES = [
    ("Hyundai Creta", "SUV", "Black"),
    ("Honda City", "Sedan", "Silver"),
    ("Mahindra Scorpio", "SUV", "White"),
    ("Maruti Suzuki Swift", "Hatchback", "Red"),
    ("Toyota Innova Crysta", "MUV", "Grey"),
    ("Tata Nexon", "Compact SUV", "Blue"),
    ("Bajaj Pulsar 220", "Motorcycle", "Black/Red"),
    ("TVS Apache RTR", "Motorcycle", "White"),
    ("Honda Activa 6G", "Scooter", "Grey"),
    ("Ashok Leyland Cargo", "Commercial Truck", "Yellow/Blue"),
]

# -------------------------------------------------------------
# SYNTHETIC DATA CONTAINERS
# -------------------------------------------------------------
cases = []
firs = []
entities = []
vehicles_and_objects = []
relationships = []
geo_events = []

# Known UUIDs and Keys for Cross-City Syndicate
SYNDICATE_IDS = {
    # Cases
    "MUM_CASE_1": str(uuid.UUID("00000001-0000-4000-8000-000000000001")),
    "THN_CASE_2": str(uuid.UUID("00000001-0000-4000-8000-000000000002")),
    "NAV_CASE_3": str(uuid.UUID("00000001-0000-4000-8000-000000000003")),
    "MUM_CASE_4": str(uuid.UUID("00000001-0000-4000-8000-000000000004")),
    "THN_ISO_5":  str(uuid.UUID("00000001-0000-4000-8000-000000000005")),
    "NAV_ISO_6":  str(uuid.UUID("00000001-0000-4000-8000-000000000006")),
    "MUM_RES_7":  str(uuid.UUID("00000001-0000-4000-8000-000000000007")),
    "NAV_RES_8":  str(uuid.UUID("00000001-0000-4000-8000-000000000008")),
    "MUM_LIV_9":  str(uuid.UUID("00000001-0000-4000-8000-000000000009")),
    "THN_LIV_10": str(uuid.UUID("00000001-0000-4000-8000-000000000010")),
    # Key Entities
    "SUSPECT_ARJUN": str(uuid.UUID("00000002-0000-4000-8000-000000000001")),
    "SUSPECT_VIKRAM": str(uuid.UUID("00000002-0000-4000-8000-000000000002")),
    "SUSPECT_PRIYA": str(uuid.UUID("00000002-0000-4000-8000-000000000003")),
    "SUSPECT_RAJESH": str(uuid.UUID("00000002-0000-4000-8000-000000000004")),
    "SUSPECT_TARIQ": str(uuid.UUID("00000002-0000-4000-8000-000000000005")),
    "OFFICER_PATIL": str(uuid.UUID("00000002-0000-4000-8000-000000000010")),
    "OFFICER_SHINDE": str(uuid.UUID("00000002-0000-4000-8000-000000000011")),
    "OFFICER_SAWANT": str(uuid.UUID("00000002-0000-4000-8000-000000000012")),
    # Key Objects
    "VEHICLE_CRETA": str(uuid.UUID("00000003-0000-4000-8000-000000000001")),
    "PHONE_BURNER": str(uuid.UUID("00000003-0000-4000-8000-000000000002")),
    "CRYPTO_WALLET": str(uuid.UUID("00000003-0000-4000-8000-000000000003")),
    "DEVICE_SKIMMER": str(uuid.UUID("00000003-0000-4000-8000-000000000004")),
}

print("Step 1: Generating 10 Live Cases (with 4-node Cross-City Syndicate, 2 Isolated, 2 Resolved)...")

# --- CASE 1: Mumbai Live (Syndicate Core) ---
cases.append({
    "id": SYNDICATE_IDS["MUM_CASE_1"],
    "case_number": "MUM-2026-CR-00101",
    "title": "Operation Deep Skim: BKC Financial Kiosk Firmware Hijack",
    "description": "Sophisticated deep-insert skimming devices and custom malware implants detected across 7 ATM terminals in BKC and Bandra West. Intercepted payloads exfiltrated magnetic stripe track-2 data to an offshore server. Lead operative identified by alias 'Shadow' operating a dark-tinted Hyundai Creta.",
    "crime_category": "Cybercrime",
    "crime_type": "ATM Skimming & Cyber Infiltration",
    "priority": "CRITICAL",
    "status": "UNDER_INVESTIGATION",
    "incident_date": "2026-02-14",
    "incident_time": "02:45:00",
    "city": "Mumbai",
    "region": "Mumbai Metropolitan",
    "police_station": "BKC Cyber Police Station",
    "area": "Bandra Kurla Complex",
    "latitude": 19.0660,
    "longitude": 72.8680,
    "source": "CYBER_CRIME_PORTAL",
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "resolution_status": "UNDER_INVESTIGATION",
    "case_outcome": None,
})

# --- CASE 2: Thane Live (Syndicate Link) ---
cases.append({
    "id": SYNDICATE_IDS["THN_CASE_2"],
    "case_number": "THN-2026-CR-00204",
    "title": "Naupada Bullion Cyber Hawala & Extortion",
    "description": "Targeted ransomware and hawala money mule ring targeting jewelry merchants in Naupada and Majiwada. Ransom payments routed through cloned debit cards matching BKC skimming dumps. Surveillance logged black Hyundai Creta MH-02-DN-4821 and burner contact +91-98201-44912.",
    "crime_category": "Financial Fraud",
    "crime_type": "Hawala Laundering & Extortion",
    "priority": "CRITICAL",
    "status": "UNDER_INVESTIGATION",
    "incident_date": "2026-02-22",
    "incident_time": "14:15:00",
    "city": "Thane",
    "region": "Thane Commissionerate",
    "police_station": "Naupada Police Station",
    "area": "Naupada",
    "latitude": 19.1880,
    "longitude": 72.9720,
    "source": "FIR_INGESTION",
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "resolution_status": "UNDER_INVESTIGATION",
    "case_outcome": None,
})

# --- CASE 3: Navi Mumbai Live (Syndicate Link) ---
cases.append({
    "id": SYNDICATE_IDS["NAV_CASE_3"],
    "case_number": "NAV-2026-CR-00307",
    "title": "Vashi Tech Escrow Phishing & Customs Clearance Extortion",
    "description": "Logistics and customs clearing agents in Vashi Sector 17 and CBD Belapur coerced into crypto payments via compromised billing portals. Intercepted telecom CDR pings show frequent coordination calls to burner +91-98201-44912 and USDT wallet laundering.",
    "crime_category": "Cybercrime",
    "crime_type": "Crypto Extortion & Phishing",
    "priority": "HIGH",
    "status": "UNDER_INVESTIGATION",
    "incident_date": "2026-03-01",
    "incident_time": "19:30:00",
    "city": "Navi Mumbai",
    "region": "Navi Mumbai Commissionerate",
    "police_station": "Vashi Police Station",
    "area": "Vashi Sector 17",
    "latitude": 19.0770,
    "longitude": 72.9980,
    "source": "INTERNET_REPORT",
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "resolution_status": "UNDER_INVESTIGATION",
    "case_outcome": None,
})

# --- CASE 4: Mumbai Live (Syndicate Forgery Hub) ---
cases.append({
    "id": SYNDICATE_IDS["MUM_CASE_4"],
    "case_number": "MUM-2026-CR-00108",
    "title": "Kurla Document Forgery & Mule Account Factory",
    "description": "Raid in Kurla West uncovered a clandestine laboratory printing counterfeit Aadhaar, PAN cards, and SIM activation forms. Confiscated ledger reveals SIM provisioning for burner +91-98201-44912 and logistics assistance to 'Shadow'.",
    "crime_category": "Organized Crime",
    "crime_type": "Synthetic Identity Forgery",
    "priority": "HIGH",
    "status": "UNDER_INVESTIGATION",
    "incident_date": "2026-03-03",
    "incident_time": "11:20:00",
    "city": "Mumbai",
    "region": "Mumbai Metropolitan",
    "police_station": "Kurla Police Station",
    "area": "Kurla City",
    "latitude": 19.0657,
    "longitude": 72.8792,
    "source": "POLICE_PATROL",
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "resolution_status": "UNDER_INVESTIGATION",
    "case_outcome": None,
})

# --- CASE 5: Thane Isolated Case ---
cases.append({
    "id": SYNDICATE_IDS["THN_ISO_5"],
    "case_number": "THN-2026-CR-00209",
    "title": "Kopri Commercial Tenant Assault & Property Dispute",
    "description": "Physical altercation and criminal intimidation between landlord Ramesh Chhajed and commercial tenant Sunil Parekh over retail shop lease renewal in Kopri market. Strictly local civil/criminal dispute with zero syndicate linkages.",
    "crime_category": "Homicide",
    "crime_type": "Assault & Criminal Intimidation",
    "priority": "MEDIUM",
    "status": "OPEN",
    "incident_date": "2026-02-18",
    "incident_time": "16:45:00",
    "city": "Thane",
    "region": "Thane Commissionerate",
    "police_station": "Kopri Police Station",
    "area": "Kopri",
    "latitude": 19.1790,
    "longitude": 72.9640,
    "source": "STATION_DIARY",
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "resolution_status": "ACTIVE_TRIAL",
    "case_outcome": None,
})

# --- CASE 6: Navi Mumbai Isolated Case ---
cases.append({
    "id": SYNDICATE_IDS["NAV_ISO_6"],
    "case_number": "NAV-2026-CR-00311",
    "title": "Kharghar Construction Site Nighttime Copper Cable Theft",
    "description": "Nighttime theft of 450 meters of industrial high-tension copper wiring from an under-construction commercial tower in Sector 10 Kharghar. Perpetrated by local scrap scavengers without technological or organized gang involvement.",
    "crime_category": "Burglary",
    "crime_type": "Industrial Material Theft",
    "priority": "LOW",
    "status": "OPEN",
    "incident_date": "2026-02-25",
    "incident_time": "03:10:00",
    "city": "Navi Mumbai",
    "region": "Navi Mumbai Commissionerate",
    "police_station": "Kharghar Police Station",
    "area": "Kharghar Hills",
    "latitude": 19.0470,
    "longitude": 73.0690,
    "source": "FIR_INGESTION",
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "resolution_status": "INVESTIGATION_ONGOING",
    "case_outcome": None,
})

# --- CASE 7: Mumbai Resolved Precedent ---
cases.append({
    "id": SYNDICATE_IDS["MUM_RES_7"],
    "case_number": "MUM-2025-CR-00088",
    "title": "Operation Sea Gate: Mumbai Port Container Pilferage",
    "description": "High-value container seal tampering and electronics theft at Mumbai Port Trust container yard. Joint sting operation intercepted stolen consignment in Sewri warehouse. 4 perpetrators arrested with full recovery.",
    "crime_category": "Cargo Theft",
    "crime_type": "Port Cargo Tampering",
    "priority": "HIGH",
    "status": "CLOSED",
    "incident_date": "2025-08-11",
    "incident_time": "23:15:00",
    "city": "Mumbai",
    "region": "Mumbai Metropolitan",
    "police_station": "Colaba Police Station",
    "area": "Colaba",
    "latitude": 18.9067,
    "longitude": 72.8147,
    "source": "PORT_POLICE",
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "resolution_status": "RESOLVED",
    "case_outcome": "CASE CLOSED: Conviction secured under IPC 379/411. Stolen container recovered, 4 accused sentenced to 3 years rigorous imprisonment by Esplanade Court.",
})

# --- CASE 8: Navi Mumbai Resolved Precedent ---
cases.append({
    "id": SYNDICATE_IDS["NAV_RES_8"],
    "case_number": "NAV-2025-CR-00094",
    "title": "Seawoods Grand Retail POS Skimming Ring",
    "description": "Mall restaurant POS terminals tampered with bluetooth-enabled skimming chips capturing debit card credentials. Investigation tracked dummy accounts and arrested key technician with skimming equipment in Nerul.",
    "crime_category": "Cybercrime",
    "crime_type": "Retail POS Tampering",
    "priority": "HIGH",
    "status": "CLOSED",
    "incident_date": "2025-10-04",
    "incident_time": "18:40:00",
    "city": "Navi Mumbai",
    "region": "Navi Mumbai Commissionerate",
    "police_station": "NRI Coastal Police Station",
    "area": "Seawoods Grand",
    "latitude": 19.0170,
    "longitude": 73.0180,
    "source": "CYBER_PATROL",
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "resolution_status": "RESOLVED",
    "case_outcome": "CASE CLOSED: Prime operative apprehended, 14 POS skimming devices confiscated, financial restitution completed to 42 defrauded cardholders.",
})

# --- CASE 9: Mumbai Live Narcotics Interception ---
cases.append({
    "id": SYNDICATE_IDS["MUM_LIV_9"],
    "case_number": "MUM-2026-CR-00115",
    "title": "Dadar Terminus Synthetic Stimulant Transit Intercept",
    "description": "Railway police intercepted commercial courier package at Dadar Central containing 1.8 kg of high-purity synthetic stimulants concealed inside sealed audio speakers en route to Goa. Courier fled platform upon bag scanning.",
    "crime_category": "Narcotics",
    "crime_type": "Synthetic Drug Trafficking",
    "priority": "HIGH",
    "status": "UNDER_INVESTIGATION",
    "incident_date": "2026-03-02",
    "incident_time": "08:15:00",
    "city": "Mumbai",
    "region": "Mumbai Metropolitan",
    "police_station": "Dadar Police Station",
    "area": "Dadar Central",
    "latitude": 19.0178,
    "longitude": 72.8478,
    "source": "RAILWAY_SECURITY",
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "resolution_status": "UNDER_INVESTIGATION",
    "case_outcome": None,
})

# --- CASE 10: Thane Live Luxury Vehicle Cloner ---
cases.append({
    "id": SYNDICATE_IDS["THN_LIV_10"],
    "case_number": "THN-2026-CR-00218",
    "title": "Ghodbunder Road Smart Key Cloner Car Ring",
    "description": "String of 6 luxury SUV thefts using OBD-port reprogrammers along Ghodbunder residential societies. Vehicles fitted with fake Gujarat registration plates within 4 hours of theft.",
    "crime_category": "Vehicle Theft",
    "crime_type": "Smart Key Relay Attack",
    "priority": "MEDIUM",
    "status": "UNDER_INVESTIGATION",
    "incident_date": "2026-02-28",
    "incident_time": "04:20:00",
    "city": "Thane",
    "region": "Thane Commissionerate",
    "police_station": "Kasarvadavali Police Station",
    "area": "Ghodbunder Road",
    "latitude": 19.2630,
    "longitude": 72.9690,
    "source": "CCTV_MONITORING",
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "resolution_status": "UNDER_INVESTIGATION",
    "case_outcome": None,
})

print("Step 2: Generating 30 Detailed Core Historical Precedents (2000-2024)...")

HISTORICAL_TEMPLATES = [
    # (Category, Crime Type, Title Template, MO Description, Resolution)
    ("Cybercrime", "Banking Trojan", "{city} Commercial Core Online Wire Intercept", "Infiltration of commercial banking portals via spoofed DNS and spear-phishing attachments.", "CASE CLOSED: Intercept server seized, funds frozen."),
    ("Financial Fraud", "Ponzi Scheme", "{area} High-Yield Investment Syndicate", "Unregistered multi-level cooperative society promising 24% monthly returns via bogus agro-tech projects.", "CASE CLOSED: Prime promoter arrested under MPID Act."),
    ("Burglary", "Jewelry Vault Heist", "{area} Wall Tunneling Bullion Burglary", "Tunnel excavated through adjacent vacant shop over a holiday weekend to breach concrete vault.", "CASE CLOSED: Gang traced through discarded drill equipment serials."),
    ("Vehicle Theft", "Engine Number Grinding", "{city} Commercial Highway Transport Hijack", "Inter-state truck hijacking, chassis number re-engraved, goods liquidated in gray market.", "CASE CLOSED: RTO registration trail identified chop shop."),
    ("Extortion", "Protection Racket", "{area} Builder Coercion & Intimidation", "Armed threats delivered to real estate developer site offices demanding 2% project extortion.", "CASE CLOSED: Accused intercepted at rendezvous point."),
    ("Narcotics", "Clandestine Lab", "{area} Industrial Chemical Diversion Lab", "Diversion of precursor chemicals from pharmaceutical manufacturing plant into synthetic narcotics.", "CASE CLOSED: Factory sealed, 300kg seized under NDPS Act."),
    ("Organized Crime", "Smuggling Network", "{city} Coastal Electronics Contraband Ring", "Offshore mother vessel offloading unregistered high-end electronic gear into mechanized fishing boats.", "CASE CLOSED: Intercepted by Coast Guard and Customs."),
    ("Homicide", "Contract Hit", "{area} Business Rivalry Conspiracy", "Targeted contract killing executed by motorbike-borne hitmen over disputed infrastructure tender.", "CASE CLOSED: Hitmen and conspirators convicted under IPC 302/120B."),
]

city_allocation = (["MUMBAI"] * 12) + (["THANE"] * 9) + (["NAVI_MUMBAI"] * 9)
for idx, reg_key in enumerate(city_allocation, 1):
    reg = REGIONS[reg_key]
    area_name, lat, lon, ps = rng.choice(reg["areas"])
    cat, ctype, t_tpl, mo_desc, outcome_tpl = HISTORICAL_TEMPLATES[idx % len(HISTORICAL_TEMPLATES)]
    year = rng.randint(2005, 2023)
    month = rng.randint(1, 12)
    day = rng.randint(1, 28)
    inc_date = f"{year:04d}-{month:02d}-{day:02d}"
    
    city_code = "MUM" if reg_key == "MUMBAI" else ("THN" if reg_key == "THANE" else "NAV")
    c_num = f"{city_code}-{year}-HIST-{idx:04d}"
    title = t_tpl.format(city=reg["city"], area=area_name)
    
    cases.append({
        "id": str(uuid.uuid4()),
        "case_number": c_num,
        "title": title,
        "description": f"Historical record ({year}) from {ps}. Modus Operandi: {mo_desc} Location: {area_name}, {reg['city']}.",
        "crime_category": cat,
        "crime_type": ctype,
        "priority": rng.choice(["LOW", "MEDIUM", "HIGH"]),
        "status": "CLOSED",
        "incident_date": inc_date,
        "incident_time": f"{rng.randint(0,23):02d}:{rng.randint(0,59):02d}:00",
        "city": reg["city"],
        "region": reg["region"],
        "police_station": ps,
        "area": area_name,
        "latitude": round(lat + rng.uniform(-0.008, 0.008), 5),
        "longitude": round(lon + rng.uniform(-0.008, 0.008), 5),
        "source": "HISTORICAL_ARCHIVE",
        "is_synthetic": True,
        "data_source": "KRITAGAS_DEMO",
        "resolution_status": "RESOLVED",
        "case_outcome": outcome_tpl,
    })

print("Step 3: Generating Extended Historical Cases to reach ~1,000 cases total...")
# Target: exactly 1,000 cases
cases_to_generate = 1000 - len(cases)
# Geographic distribution: 40% Mumbai, 30% Thane, 30% Navi Mumbai
weights = [("MUMBAI", 0.40), ("THANE", 0.30), ("NAVI_MUMBAI", 0.30)]

for i in range(cases_to_generate):
    roll = rng.random()
    if roll < 0.40:
        reg_key = "MUMBAI"
        city_code = "MUM"
    elif roll < 0.70:
        reg_key = "THANE"
        city_code = "THN"
    else:
        reg_key = "NAVI_MUMBAI"
        city_code = "NAV"
        
    reg = REGIONS[reg_key]
    area_name, lat, lon, ps = rng.choice(reg["areas"])
    cat = rng.choice(CRIME_CATEGORIES)
    year = rng.randint(2010, 2025)
    month = rng.randint(1, 12)
    day = rng.randint(1, 28)
    inc_date = f"{year:04d}-{month:02d}-{day:02d}"
    c_num = f"{city_code}-{year}-GEN-{i+1:05d}"
    
    # Status: most historical are CLOSED, a few recent ones OPEN/UNDER_INVESTIGATION
    if year >= 2024:
        c_status = rng.choice(["OPEN", "UNDER_INVESTIGATION", "CLOSED"])
    else:
        c_status = "CLOSED"
        
    res_status = "RESOLVED" if c_status == "CLOSED" else "UNDER_INVESTIGATION"
    outcome = "CASE CLOSED: Investigation concluded and filed in judicial record." if res_status == "RESOLVED" else None

    cases.append({
        "id": str(uuid.uuid4()),
        "case_number": c_num,
        "title": f"{reg['city']} {area_name} {cat} Incident #{i+1}",
        "description": f"Archived synthetic investigation record filed at {ps} regarding suspected {cat.lower()} incident near {area_name}.",
        "crime_category": cat,
        "crime_type": f"Pattern-{cat}",
        "priority": rng.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
        "status": c_status,
        "incident_date": inc_date,
        "incident_time": f"{rng.randint(0,23):02d}:{rng.randint(0,59):02d}:00",
        "city": reg["city"],
        "region": reg["region"],
        "police_station": ps,
        "area": area_name,
        "latitude": round(lat + rng.uniform(-0.012, 0.012), 5),
        "longitude": round(lon + rng.uniform(-0.012, 0.012), 5),
        "source": rng.choice(["FIR_INGESTION", "POLICE_PATROL", "CITIZEN_COMPLAINT", "CYBER_ALERT"]),
        "is_synthetic": True,
        "data_source": "KRITAGAS_DEMO",
        "resolution_status": res_status,
        "case_outcome": outcome,
    })

print(f"Total Cases Generated: {len(cases)}")

# -------------------------------------------------------------
# DATASET 2: PERSONS & ENTITIES (~1,000 records)
# -------------------------------------------------------------
print("Step 4: Generating Persons & Entities Dataset...")

# Core syndicate persons
entities.append({
    "id": SYNDICATE_IDS["SUSPECT_ARJUN"],
    "entity_type": "PERSON",
    "name": "Arjun Verma",
    "normalized_value": "ARJUN_VERMA",
    "aliases": ["Shadow", "Viper", "Agent AV"],
    "role": "PRIME_SUSPECT",
    "gender": "MALE",
    "age": 34,
    "residence_city": "Mumbai",
    "phone": "+91-98201-44912",
    "aadhaar_masked": "XXXX-XXXX-4812",
    "pan_masked": "ABCPV****M",
    "risk_score": 0.94,
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Mastermind coordinator behind the BKC ATM firmware implant and cross-city money routing.",
})

entities.append({
    "id": SYNDICATE_IDS["SUSPECT_VIKRAM"],
    "entity_type": "PERSON",
    "name": "Vikram Singhania",
    "normalized_value": "VIKRAM_SINGHANIA",
    "aliases": ["Doctor", "VS", "Thane Seth"],
    "role": "SUSPECT",
    "gender": "MALE",
    "age": 46,
    "residence_city": "Thane",
    "phone": "+91-98192-33108",
    "aadhaar_masked": "XXXX-XXXX-9921",
    "pan_masked": "AALPS****K",
    "risk_score": 0.88,
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Naupada bullion merchant running unlicensed hawala settlement node for Arjun Verma's network.",
})

entities.append({
    "id": SYNDICATE_IDS["SUSPECT_PRIYA"],
    "entity_type": "PERSON",
    "name": "Priya Nair",
    "normalized_value": "PRIYA_NAIR",
    "aliases": ["Cipher", "PN", "Matrix"],
    "role": "SUSPECT",
    "gender": "FEMALE",
    "age": 29,
    "residence_city": "Navi Mumbai",
    "phone": "+91-98334-11823",
    "aadhaar_masked": "XXXX-XXXX-3341",
    "pan_masked": "AHVPN****D",
    "risk_score": 0.86,
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Crypto escrow operator in Vashi converting extorted fiat into USDT and cold wallet storage.",
})

entities.append({
    "id": SYNDICATE_IDS["SUSPECT_RAJESH"],
    "entity_type": "PERSON",
    "name": "Rajesh Gaikwad",
    "normalized_value": "RAJESH_GAIKWAD",
    "aliases": ["Kaka", "Presswala", "Master"],
    "role": "SUSPECT",
    "gender": "MALE",
    "age": 52,
    "residence_city": "Mumbai",
    "phone": "+91-98700-55219",
    "aadhaar_masked": "XXXX-XXXX-7714",
    "pan_masked": "AGRPG****Q",
    "risk_score": 0.79,
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Kurla print workshop manager fabricating forged identity documents and dummy corporate seals.",
})

entities.append({
    "id": SYNDICATE_IDS["SUSPECT_TARIQ"],
    "entity_type": "PERSON",
    "name": "Tariq Sheikh",
    "normalized_value": "TARIQ_SHEIKH",
    "aliases": ["Volt", "Chip", "Solderman"],
    "role": "SUSPECT",
    "gender": "MALE",
    "age": 31,
    "residence_city": "Navi Mumbai",
    "phone": "+91-98671-88402",
    "aadhaar_masked": "XXXX-XXXX-1903",
    "pan_masked": "AASPT****B",
    "risk_score": 0.82,
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Hardware technician assembling deep-insert ATM skimmers and magnetic stripe cloners.",
})

# Investigating Officers
entities.append({
    "id": SYNDICATE_IDS["OFFICER_PATIL"],
    "entity_type": "PERSON",
    "name": "Inspector Devendra Patil",
    "normalized_value": "DEVENDRA_PATIL",
    "aliases": ["Patil Sir"],
    "role": "INVESTIGATING_OFFICER",
    "gender": "MALE",
    "age": 44,
    "residence_city": "Mumbai",
    "phone": "+91-98200-99881",
    "aadhaar_masked": "XXXX-XXXX-5501",
    "pan_masked": "AAPDP****P",
    "risk_score": 0.05,
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Lead Investigating Officer at BKC Cyber Police Station heading Operation Deep Skim.",
})

entities.append({
    "id": SYNDICATE_IDS["OFFICER_SHINDE"],
    "entity_type": "PERSON",
    "name": "Senior PI Mahesh Shinde",
    "normalized_value": "MAHESH_SHINDE",
    "aliases": ["Shinde Saheb"],
    "role": "INVESTIGATING_OFFICER",
    "gender": "MALE",
    "age": 49,
    "residence_city": "Thane",
    "phone": "+91-98190-77662",
    "aadhaar_masked": "XXXX-XXXX-6612",
    "pan_masked": "AAMPS****S",
    "risk_score": 0.04,
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Senior Police Inspector at Naupada Police Station overseeing financial fraud inquiries.",
})

entities.append({
    "id": SYNDICATE_IDS["OFFICER_SAWANT"],
    "entity_type": "PERSON",
    "name": "ACP Sunita Sawant",
    "normalized_value": "SUNITA_SAWANT",
    "aliases": ["Madam"],
    "role": "INVESTIGATING_OFFICER",
    "gender": "FEMALE",
    "age": 47,
    "residence_city": "Navi Mumbai",
    "phone": "+91-98330-44331",
    "aadhaar_masked": "XXXX-XXXX-8823",
    "pan_masked": "AASSS****N",
    "risk_score": 0.03,
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Assistant Commissioner of Police supervising Navi Mumbai Crime Branch and Port security.",
})

# Generate remaining to reach ~1,000 person entities
for i in range(1000 - len(entities)):
    first = rng.choice(FIRST_NAMES)
    last = rng.choice(LAST_NAMES)
    full_name = f"{first} {last}"
    norm = f"{first.upper()}_{last.upper()}_{i+1:04d}"
    role = rng.choice(["SUSPECT", "VICTIM", "WITNESS", "COMPLAINANT", "INFORMANT", "ASSOCIATE"])
    city = rng.choice(["Mumbai", "Thane", "Navi Mumbai"])
    
    entities.append({
        "id": str(uuid.uuid4()),
        "entity_type": "PERSON",
        "name": full_name,
        "normalized_value": norm,
        "aliases": [f"{first[:3].upper()}-{rng.randint(10,99)}"] if rng.random() < 0.25 else [],
        "role": role,
        "gender": rng.choice(["MALE", "FEMALE"]),
        "age": rng.randint(21, 68),
        "residence_city": city,
        "phone": f"+91-{rng.randint(98000, 98999)}-{rng.randint(10000, 99999)}",
        "aadhaar_masked": f"XXXX-XXXX-{rng.randint(1000, 9999)}",
        "pan_masked": f"A{first[0]}P{last[0]}P{rng.randint(1000, 9999)}X",
        "risk_score": round(rng.uniform(0.1, 0.85), 2) if role in ["SUSPECT", "ASSOCIATE"] else round(rng.uniform(0.01, 0.2), 2),
        "is_synthetic": True,
        "data_source": "KRITAGAS_DEMO",
        "notes": f"Synthetic entity linked to {city} investigation records.",
    })

print(f"Total Persons/Entities Generated: {len(entities)}")

# -------------------------------------------------------------
# DATASET 3: VEHICLES & OBJECTS (~1,000 records)
# -------------------------------------------------------------
print("Step 5: Generating Vehicles & Objects Dataset...")

# Key bridge vehicle
vehicles_and_objects.append({
    "id": SYNDICATE_IDS["VEHICLE_CRETA"],
    "entity_type": "VEHICLE",
    "name": "MH-02-DN-4821 (Hyundai Creta)",
    "normalized_value": "MH02DN4821",
    "category": "VEHICLE",
    "make_model": "Hyundai Creta SX 2022",
    "color": "Phantom Black",
    "registration_number": "MH-02-DN-4821",
    "registration_city": "Mumbai (Andheri RTO)",
    "chassis_number": "MALC141EPM****982",
    "engine_number": "D4FA****412",
    "owner_entity_id": SYNDICATE_IDS["SUSPECT_ARJUN"],
    "flagged_status": "STOLEN_OR_SUSPECT",
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Black Hyundai Creta repeatedly sighted at BKC ATM crime scenes and Naupada Majiwada junction.",
})

# Key bridge phone
vehicles_and_objects.append({
    "id": SYNDICATE_IDS["PHONE_BURNER"],
    "entity_type": "PHONE",
    "name": "+91-98201-44912 (Burner SIM)",
    "normalized_value": "919820144912",
    "category": "TELECOM",
    "phone_number": "+91-98201-44912",
    "imei": "864291048821039",
    "telecom_operator": "Jio Synthetic Mobile",
    "activation_location": "Kurla West, Mumbai",
    "associated_entity_id": SYNDICATE_IDS["SUSPECT_ARJUN"],
    "flagged_status": "INTERCEPTED",
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Shared burner SIM coordinating ATM malware uploads, Thane hawala cash pickups, and Navi Mumbai crypto conversions.",
})

# Key crypto wallet
vehicles_and_objects.append({
    "id": SYNDICATE_IDS["CRYPTO_WALLET"],
    "entity_type": "CRYPTO_WALLET",
    "name": "0x7F41a9...c48B (USDT Escrow)",
    "normalized_value": "0x7F41A92B6E324881A4513B902CFD88902A1EC48B",
    "category": "FINANCIAL",
    "wallet_address": "0x7F41A92B6E324881A4513B902CFD88902A1EC48B",
    "network": "Ethereum / Polygon ERC-20",
    "associated_entity_id": SYNDICATE_IDS["SUSPECT_PRIYA"],
    "flagged_status": "MONITORED",
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Tether USDT receiving wallet receiving ransomware and phishing proceeds from Vashi logistics victims.",
})

# Key hardware skimmer device
vehicles_and_objects.append({
    "id": SYNDICATE_IDS["DEVICE_SKIMMER"],
    "entity_type": "DIGITAL_DEVICE",
    "name": "Deep-Insert Micro-Skimmer Rev-3",
    "normalized_value": "SKIM-REV3-009",
    "category": "CONTRABAND",
    "device_type": "Deep-Insert Magnetic Head Skimmer",
    "serial_number": "SKIM-9982-FX",
    "fabrication_origin": "Clandestine Electronics Bench, Navi Mumbai",
    "associated_entity_id": SYNDICATE_IDS["SUSPECT_TARIQ"],
    "flagged_status": "SEIZED_IN_EVIDENCE",
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Ultra-thin 0.38mm flex-PCB skimmer inserted into NCR and Diebold ATM card readers.",
})

# Generate remaining to reach ~1,000 objects
# RTO prefixes: MH-01 (South Mum), MH-02 (West Mum), MH-03 (East Mum), MH-04 (Thane), MH-43 (Navi Mum)
RTO_LIST = ["MH-01", "MH-02", "MH-03", "MH-04", "MH-43"]

for i in range(1000 - len(vehicles_and_objects)):
    obj_type = rng.choice(["VEHICLE", "PHONE", "BANK_ACCOUNT", "CRYPTO_WALLET", "DIGITAL_DEVICE"])
    rto = rng.choice(RTO_LIST)
    
    if obj_type == "VEHICLE":
        v_model, v_class, v_col = rng.choice(VEHICLE_MAKES)
        series = "".join(rng.choices("ABCDEFGHJKLMNPQRSTUVWXYZ", k=2))
        num = f"{rng.randint(1000, 9999)}"
        plate = f"{rto}-{series}-{num}"
        vehicles_and_objects.append({
            "id": str(uuid.uuid4()),
            "entity_type": "VEHICLE",
            "name": f"{plate} ({v_model})",
            "normalized_value": plate.replace("-", ""),
            "category": "VEHICLE",
            "make_model": v_model,
            "color": v_col,
            "registration_number": plate,
            "registration_city": "Mumbai" if rto in ["MH-01","MH-02","MH-03"] else ("Thane" if rto == "MH-04" else "Navi Mumbai"),
            "chassis_number": f"CHAS{rng.randint(100000, 999999)}IN",
            "engine_number": f"ENG{rng.randint(100000, 999999)}",
            "flagged_status": rng.choice(["CLEAR", "STOLEN_OR_SUSPECT", "IMPOUNDED"]),
            "is_synthetic": True,
            "data_source": "KRITAGAS_DEMO",
            "notes": f"Synthetic vehicle record registered in {rto} jurisdiction.",
        })
    elif obj_type == "PHONE":
        phone_num = f"+91-{rng.randint(98000, 98999)}-{rng.randint(10000, 99999)}"
        vehicles_and_objects.append({
            "id": str(uuid.uuid4()),
            "entity_type": "PHONE",
            "name": f"{phone_num} (Mobile CDR Node)",
            "normalized_value": phone_num.replace("+", "").replace("-", ""),
            "category": "TELECOM",
            "phone_number": phone_num,
            "imei": f"86{rng.randint(1000000000000, 9999999999999)}",
            "telecom_operator": rng.choice(["Airtel Synthetic", "Jio Synthetic", "Vodafone-Idea Synthetic"]),
            "flagged_status": rng.choice(["ACTIVE", "SURVEILLED", "BLOCKED"]),
            "is_synthetic": True,
            "data_source": "KRITAGAS_DEMO",
            "notes": "Synthetic telecom mobile subscriber node.",
        })
    elif obj_type == "BANK_ACCOUNT":
        bank = rng.choice(["HDFC", "ICICI", "SBI", "AXIS", "KOTAK"])
        acct_num = f"{rng.randint(1000000000, 9999999999)}"
        vehicles_and_objects.append({
            "id": str(uuid.uuid4()),
            "entity_type": "BANK_ACCOUNT",
            "name": f"{bank} Acct {acct_num[-4:]}",
            "normalized_value": f"{bank}_{acct_num}",
            "category": "FINANCIAL",
            "account_number": acct_num,
            "bank_name": f"{bank} Bank Ltd",
            "ifsc_code": f"{bank}000{rng.randint(100, 999)}",
            "flagged_status": rng.choice(["ACTIVE", "FROZEN", "FLAGGED_STR"]),
            "is_synthetic": True,
            "data_source": "KRITAGAS_DEMO",
            "notes": "Synthetic bank account node.",
        })
    elif obj_type == "CRYPTO_WALLET":
        h = f"{rng.randint(0x1000, 0xffff):x}"
        t = f"{rng.randint(0x1000, 0xffff):x}"
        vehicles_and_objects.append({
            "id": str(uuid.uuid4()),
            "entity_type": "CRYPTO_WALLET",
            "name": f"0x{h}...{t} (USDT)",
            "normalized_value": f"0x{h}{rng.randint(100000,999999)}{t}",
            "category": "FINANCIAL",
            "wallet_address": f"0x{h}{rng.randint(100000,999999)}{t}",
            "network": "Ethereum / TRON TRC-20",
            "flagged_status": rng.choice(["ACTIVE", "SANCTIONED_ALERT"]),
            "is_synthetic": True,
            "data_source": "KRITAGAS_DEMO",
            "notes": "Synthetic cryptocurrency ledger address.",
        })
    else:  # DIGITAL_DEVICE
        dev = rng.choice(["Dell Latitude Laptop", "Sandisk 2TB SSD", "Raspberry Pi 4 Keylogger", "iPhone 13", "OnePlus Nord"])
        ser = f"DEV-{rng.randint(10000, 99999)}"
        vehicles_and_objects.append({
            "id": str(uuid.uuid4()),
            "entity_type": "DIGITAL_DEVICE",
            "name": f"{dev} ({ser})",
            "normalized_value": ser,
            "category": "ELECTRONICS",
            "device_model": dev,
            "serial_number": ser,
            "flagged_status": rng.choice(["FORENSIC_IMAGED", "CONFISCATED", "ACTIVE"]),
            "is_synthetic": True,
            "data_source": "KRITAGAS_DEMO",
            "notes": "Synthetic digital evidentiary hardware device.",
        })

print(f"Total Vehicles & Objects Generated: {len(vehicles_and_objects)}")

# -------------------------------------------------------------
# DATASET 4: RELATIONSHIPS & GRAPH EDGES (~1,000 edges)
# -------------------------------------------------------------
print("Step 6: Generating Relationships Dataset (3 Clusters + Cross-City Bridge + Isolated)...")

# 1. Cross-City Syndicate Core Relationships (The Bridge Edges)
# Case 1 (Mumbai) -> Arjun Verma
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["SUSPECT_ARJUN"],
    "source_type": "PERSON",
    "source_name": "Arjun Verma",
    "target_id": SYNDICATE_IDS["MUM_CASE_1"],
    "target_type": "CASE",
    "target_name": "MUM-2026-CR-00101",
    "relationship_type": "SUSPECT_IN",
    "confidence": 0.95,
    "case_id": SYNDICATE_IDS["MUM_CASE_1"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Prime suspect in BKC ATM skimmer implants.",
})

# Case 2 (Thane) -> Arjun Verma (CROSS-CITY BRIDGE 1)
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["SUSPECT_ARJUN"],
    "source_type": "PERSON",
    "source_name": "Arjun Verma",
    "target_id": SYNDICATE_IDS["THN_CASE_2"],
    "target_type": "CASE",
    "target_name": "THN-2026-CR-00204",
    "relationship_type": "SUSPECT_IN",
    "confidence": 0.92,
    "case_id": SYNDICATE_IDS["THN_CASE_2"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Cross-city bridge: Suspect Arjun Verma linked to Naupada Hawala ring.",
})

# Arjun Verma -> Vehicle Creta
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["SUSPECT_ARJUN"],
    "source_type": "PERSON",
    "source_name": "Arjun Verma",
    "target_id": SYNDICATE_IDS["VEHICLE_CRETA"],
    "target_type": "VEHICLE",
    "target_name": "MH-02-DN-4821",
    "relationship_type": "OWNS_OR_OPERATES",
    "confidence": 0.98,
    "case_id": SYNDICATE_IDS["MUM_CASE_1"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Arjun Verma registered keeper and operator of getaway vehicle.",
})

# Vehicle Creta -> Case 1 (Mumbai)
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["VEHICLE_CRETA"],
    "source_type": "VEHICLE",
    "source_name": "MH-02-DN-4821",
    "target_id": SYNDICATE_IDS["MUM_CASE_1"],
    "target_type": "CASE",
    "target_name": "MUM-2026-CR-00101",
    "relationship_type": "SIGHTED_AT_SCENE",
    "confidence": 0.94,
    "case_id": SYNDICATE_IDS["MUM_CASE_1"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Captured on BKC CCTV leaving kiosk perimeter at 02:48 AM.",
})

# Vehicle Creta -> Case 2 (Thane) (CROSS-CITY BRIDGE 2)
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["VEHICLE_CRETA"],
    "source_type": "VEHICLE",
    "source_name": "MH-02-DN-4821",
    "target_id": SYNDICATE_IDS["THN_CASE_2"],
    "target_type": "CASE",
    "target_name": "THN-2026-CR-00204",
    "relationship_type": "SIGHTED_AT_SCENE",
    "confidence": 0.91,
    "case_id": SYNDICATE_IDS["THN_CASE_2"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Cross-city bridge: Same Creta MH-02-DN-4821 captured by Majiwada junction ANPR cameras.",
})

# Arjun Verma -> Burner Phone
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["SUSPECT_ARJUN"],
    "source_type": "PERSON",
    "source_name": "Arjun Verma",
    "target_id": SYNDICATE_IDS["PHONE_BURNER"],
    "target_type": "PHONE",
    "target_name": "+91-98201-44912",
    "relationship_type": "USES_DEVICE",
    "confidence": 0.97,
    "case_id": SYNDICATE_IDS["MUM_CASE_1"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Primary handset used for operational coordination.",
})

# Burner Phone -> Vikram Singhania (Thane)
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["PHONE_BURNER"],
    "source_type": "PHONE",
    "source_name": "+91-98201-44912",
    "target_id": SYNDICATE_IDS["SUSPECT_VIKRAM"],
    "target_type": "PERSON",
    "target_name": "Vikram Singhania",
    "relationship_type": "COMMUNICATED_WITH",
    "confidence": 0.89,
    "case_id": SYNDICATE_IDS["THN_CASE_2"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "17 encrypted voice calls logged between burner phone and Vikram Singhania.",
})

# Vikram Singhania -> Case 2 (Thane)
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["SUSPECT_VIKRAM"],
    "source_type": "PERSON",
    "source_name": "Vikram Singhania",
    "target_id": SYNDICATE_IDS["THN_CASE_2"],
    "target_type": "CASE",
    "target_name": "THN-2026-CR-00204",
    "relationship_type": "ACCUSED_IN",
    "confidence": 0.94,
    "case_id": SYNDICATE_IDS["THN_CASE_2"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Accused hawala broker running cash payouts.",
})

# Vikram Singhania (Thane) -> Priya Nair (Navi Mumbai) (CROSS-CITY BRIDGE 3)
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["SUSPECT_VIKRAM"],
    "source_type": "PERSON",
    "source_name": "Vikram Singhania",
    "target_id": SYNDICATE_IDS["SUSPECT_PRIYA"],
    "target_type": "PERSON",
    "target_name": "Priya Nair",
    "relationship_type": "TRANSFERRED_FUNDS_TO",
    "confidence": 0.93,
    "case_id": SYNDICATE_IDS["NAV_CASE_3"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Cross-city bridge: Hawala cash transferred from Thane to Vashi crypto conversion desk.",
})

# Priya Nair -> Case 3 (Navi Mumbai)
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["SUSPECT_PRIYA"],
    "source_type": "PERSON",
    "source_name": "Priya Nair",
    "target_id": SYNDICATE_IDS["NAV_CASE_3"],
    "target_type": "CASE",
    "target_name": "NAV-2026-CR-00307",
    "relationship_type": "SUSPECT_IN",
    "confidence": 0.91,
    "case_id": SYNDICATE_IDS["NAV_CASE_3"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Suspect running crypto ransom conversion.",
})

# Priya Nair -> Crypto Wallet
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["SUSPECT_PRIYA"],
    "source_type": "PERSON",
    "source_name": "Priya Nair",
    "target_id": SYNDICATE_IDS["CRYPTO_WALLET"],
    "target_type": "CRYPTO_WALLET",
    "target_name": "0x7F41a9...c48B",
    "relationship_type": "CONTROLS_WALLET",
    "confidence": 0.96,
    "case_id": SYNDICATE_IDS["NAV_CASE_3"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Sole signatory on multi-sig smart contract receiver address.",
})

# Rajesh Gaikwad (Kurla) -> Case 4 (Mumbai)
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["SUSPECT_RAJESH"],
    "source_type": "PERSON",
    "source_name": "Rajesh Gaikwad",
    "target_id": SYNDICATE_IDS["MUM_CASE_4"],
    "target_type": "CASE",
    "target_name": "MUM-2026-CR-00108",
    "relationship_type": "ACCUSED_IN",
    "confidence": 0.98,
    "case_id": SYNDICATE_IDS["MUM_CASE_4"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Accused operator of document forgery workshop.",
})

# Rajesh Gaikwad -> Arjun Verma (Logistics)
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["SUSPECT_RAJESH"],
    "source_type": "PERSON",
    "source_name": "Rajesh Gaikwad",
    "target_id": SYNDICATE_IDS["SUSPECT_ARJUN"],
    "target_type": "PERSON",
    "target_name": "Arjun Verma",
    "relationship_type": "SUPPLIED_DOCUMENTS_TO",
    "confidence": 0.88,
    "case_id": SYNDICATE_IDS["MUM_CASE_4"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Forged KYC documentation provided to Arjun Verma for SIM registration.",
})

# Tariq Sheikh -> Device Skimmer
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["SUSPECT_TARIQ"],
    "source_type": "PERSON",
    "source_name": "Tariq Sheikh",
    "target_id": SYNDICATE_IDS["DEVICE_SKIMMER"],
    "target_type": "DIGITAL_DEVICE",
    "target_name": "Deep-Insert Micro-Skimmer",
    "relationship_type": "MANUFACTURED",
    "confidence": 0.97,
    "case_id": SYNDICATE_IDS["MUM_CASE_1"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Fabricated custom flex-PCB reader.",
})

# Device Skimmer -> Case 1 (Mumbai)
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["DEVICE_SKIMMER"],
    "source_type": "DIGITAL_DEVICE",
    "source_name": "Deep-Insert Micro-Skimmer",
    "target_id": SYNDICATE_IDS["MUM_CASE_1"],
    "target_type": "CASE",
    "target_name": "MUM-2026-CR-00101",
    "relationship_type": "EVIDENCE_IN",
    "confidence": 0.99,
    "case_id": SYNDICATE_IDS["MUM_CASE_1"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Extracted from ATM card slot during forensic inspection.",
})

# Officer Devendra Patil -> Case 1
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["OFFICER_PATIL"],
    "source_type": "PERSON",
    "source_name": "Devendra Patil",
    "target_id": SYNDICATE_IDS["MUM_CASE_1"],
    "target_type": "CASE",
    "target_name": "MUM-2026-CR-00101",
    "relationship_type": "INVESTIGATED_BY",
    "confidence": 1.0,
    "case_id": SYNDICATE_IDS["MUM_CASE_1"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Lead Investigating Officer.",
})

# Officer Mahesh Shinde -> Case 2
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": SYNDICATE_IDS["OFFICER_SHINDE"],
    "source_type": "PERSON",
    "source_name": "Mahesh Shinde",
    "target_id": SYNDICATE_IDS["THN_CASE_2"],
    "target_type": "CASE",
    "target_name": "THN-2026-CR-00204",
    "relationship_type": "INVESTIGATED_BY",
    "confidence": 1.0,
    "case_id": SYNDICATE_IDS["THN_CASE_2"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Supervising Senior PI.",
})

# 2. Isolated Cases (Local connections only, strictly no external edges)
# Isolated Case 5 (Thane Property Dispute)
iso_person_5 = entities[10] # a generated entity
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": iso_person_5["id"],
    "source_type": "PERSON",
    "source_name": iso_person_5["name"],
    "target_id": SYNDICATE_IDS["THN_ISO_5"],
    "target_type": "CASE",
    "target_name": "THN-2026-CR-00209",
    "relationship_type": "COMPLAINANT_IN",
    "confidence": 1.0,
    "case_id": SYNDICATE_IDS["THN_ISO_5"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Complainant in Kopri market dispute.",
})

# Isolated Case 6 (Navi Mumbai Copper Theft)
iso_person_6 = entities[11] # another generated entity
relationships.append({
    "id": str(uuid.uuid4()),
    "source_id": iso_person_6["id"],
    "source_type": "PERSON",
    "source_name": iso_person_6["name"],
    "target_id": SYNDICATE_IDS["NAV_ISO_6"],
    "target_type": "CASE",
    "target_name": "NAV-2026-CR-00311",
    "relationship_type": "WITNESS_IN",
    "confidence": 0.95,
    "case_id": SYNDICATE_IDS["NAV_ISO_6"],
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
    "notes": "Night security guard witness.",
})

# 3. Generate remaining edges to reach ~1,000 relationships
# Partition cases by city into 3 clusters:
mumbai_cases = [c for c in cases if c["city"] == "Mumbai"]
thane_cases = [c for c in cases if c["city"] == "Thane"]
nav_cases = [c for c in cases if c["city"] == "Navi Mumbai"]

REL_TYPES = [
    "SUSPECT_IN", "VICTIM_OF", "WITNESS_TO", "OWNS_VEHICLE",
    "COMMUNICATED_WITH", "ASSOCIATED_WITH", "LOCATED_AT", "INVESTIGATED_BY"
]

target_rels = 1000 - len(relationships)
for i in range(target_rels):
    cluster = rng.choices(["MUMBAI", "THANE", "NAVI_MUMBAI"], weights=[0.40, 0.30, 0.30])[0]
    case_pool = mumbai_cases if cluster == "MUMBAI" else (thane_cases if cluster == "THANE" else nav_cases)
    target_case = rng.choice(case_pool)
    
    rtype = rng.choice(REL_TYPES)
    # Pick random entity and object
    person = rng.choice(entities)
    obj = rng.choice(vehicles_and_objects)
    
    if rtype in ["SUSPECT_IN", "VICTIM_OF", "WITNESS_TO", "INVESTIGATED_BY"]:
        src_id = person["id"]
        src_type = "PERSON"
        src_name = person["name"]
        tgt_id = target_case["id"]
        tgt_type = "CASE"
        tgt_name = target_case["case_number"]
    elif rtype == "OWNS_VEHICLE":
        src_id = person["id"]
        src_type = "PERSON"
        src_name = person["name"]
        tgt_id = obj["id"]
        tgt_type = obj["entity_type"]
        tgt_name = obj["name"]
    else:  # COMMUNICATED_WITH or ASSOCIATED_WITH
        p2 = rng.choice(entities)
        src_id = person["id"]
        src_type = "PERSON"
        src_name = person["name"]
        tgt_id = p2["id"]
        tgt_type = "PERSON"
        tgt_name = p2["name"]
        
    relationships.append({
        "id": str(uuid.uuid4()),
        "source_id": src_id,
        "source_type": src_type,
        "source_name": src_name,
        "target_id": tgt_id,
        "target_type": tgt_type,
        "target_name": tgt_name,
        "relationship_type": rtype,
        "confidence": round(rng.uniform(0.70, 0.99), 2),
        "case_id": target_case["id"],
        "is_synthetic": True,
        "data_source": "KRITAGAS_DEMO",
        "notes": f"Synthetic relationship record within {cluster} cluster.",
    })

print(f"Total Relationships Generated: {len(relationships)}")

# -------------------------------------------------------------
# DATASET 5: GEO-TEMPORAL & INTELLIGENCE EVENTS (~1,000 events)
# -------------------------------------------------------------
print("Step 7: Generating Geo-temporal Intelligence Events Dataset...")

EVENT_TYPES = [
    "INCIDENT", "VEHICLE_SIGHTING", "CALL_CDR_PING",
    "ATM_WITHDRAWAL", "SURVEILLANCE_FLAG", "CHECKPOINT_INTERCEPT"
]

PATTERNS = [
    "ATM_SKIM_CLUSTER", "HAWALA_ROUTE_MUM_THN", "CONTAINER_SMUGGLE_JNPT",
    "LUXURY_CAR_KEY_CLONE", "NIGHT_COMMERCIAL_BURGLARY", "CYBER_ESCROW_PHISH"
]

TIME_BUCKETS = ["MORNING", "AFTERNOON", "EVENING", "NIGHT", "LATE_NIGHT"]
RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

# Key syndicate coordinated geo-events
geo_events.append({
    "event_id": "EVT-MUM-0001",
    "case_id": SYNDICATE_IDS["MUM_CASE_1"],
    "city": "Mumbai",
    "region": "Mumbai Metropolitan",
    "area": "Bandra Kurla Complex",
    "latitude": 19.0660,
    "longitude": 72.8680,
    "incident_date": "2026-02-14",
    "incident_time": "02:45:00",
    "crime_type": "ATM Skimming & Cyber Infiltration",
    "time_bucket": "LATE_NIGHT",
    "location_cluster": "MUMBAI_CENTRAL_FINANCE",
    "risk_level": "CRITICAL",
    "related_case_number": "MUM-2026-CR-00101",
    "pattern_identifier": "ATM_SKIM_CLUSTER",
    "metadata_json": {"target": "BKC Banking Kiosk 4", "device_type": "Deep-Insert Skimmer"},
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
})

geo_events.append({
    "event_id": "EVT-THN-0002",
    "case_id": SYNDICATE_IDS["THN_CASE_2"],
    "city": "Thane",
    "region": "Thane Commissionerate",
    "area": "Naupada",
    "latitude": 19.1880,
    "longitude": 72.9720,
    "incident_date": "2026-02-22",
    "incident_time": "14:15:00",
    "crime_type": "Hawala Laundering & Extortion",
    "time_bucket": "AFTERNOON",
    "location_cluster": "THANE_BULLION_CORRIDOR",
    "risk_level": "CRITICAL",
    "related_case_number": "THN-2026-CR-00204",
    "pattern_identifier": "HAWALA_ROUTE_MUM_THN",
    "metadata_json": {"target": "Naupada Jewellers Market", "vehicle_sighted": "MH-02-DN-4821"},
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
})

geo_events.append({
    "event_id": "EVT-NAV-0003",
    "case_id": SYNDICATE_IDS["NAV_CASE_3"],
    "city": "Navi Mumbai",
    "region": "Navi Mumbai Commissionerate",
    "area": "Vashi Sector 17",
    "latitude": 19.0770,
    "longitude": 72.9980,
    "incident_date": "2026-03-01",
    "incident_time": "19:30:00",
    "crime_type": "Crypto Extortion & Phishing",
    "time_bucket": "EVENING",
    "location_cluster": "NAVI_MUMBAI_LOGISTICS_HUB",
    "risk_level": "HIGH",
    "related_case_number": "NAV-2026-CR-00307",
    "pattern_identifier": "CYBER_ESCROW_PHISH",
    "metadata_json": {"target": "Vashi Logistics Clearing Center", "crypto_network": "USDT"},
    "is_synthetic": True,
    "data_source": "KRITAGAS_DEMO",
})

# Generate remaining to reach ~1,000 geo-temporal events
for i in range(1000 - len(geo_events)):
    reg_key = rng.choices(["MUMBAI", "THANE", "NAVI_MUMBAI"], weights=[0.40, 0.30, 0.30])[0]
    reg = REGIONS[reg_key]
    area_name, base_lat, base_lon, ps = rng.choice(reg["areas"])
    
    # Slight perturbation within radius
    lat = round(base_lat + rng.uniform(-0.015, 0.015), 5)
    lon = round(base_lon + rng.uniform(-0.015, 0.015), 5)
    
    year = rng.randint(2023, 2026)
    month = rng.randint(1, 12)
    day = rng.randint(1, 28)
    e_date = f"{year:04d}-{month:02d}-{day:02d}"
    h = rng.randint(0, 23)
    e_time = f"{h:02d}:{rng.randint(0, 59):02d}:00"
    
    if 5 <= h < 12:
        t_bucket = "MORNING"
    elif 12 <= h < 17:
        t_bucket = "AFTERNOON"
    elif 17 <= h < 22:
        t_bucket = "EVENING"
    elif 22 <= h or h < 2:
        t_bucket = "NIGHT"
    else:
        t_bucket = "LATE_NIGHT"
        
    c_type = rng.choice(CRIME_CATEGORIES)
    ev_type = rng.choice(EVENT_TYPES)
    risk = rng.choices(RISK_LEVELS, weights=[0.25, 0.45, 0.20, 0.10])[0]
    
    city_code = "MUM" if reg_key == "MUMBAI" else ("THN" if reg_key == "THANE" else "NAV")
    eid = f"EVT-{city_code}-{i+4:05d}"
    
    geo_events.append({
        "event_id": eid,
        "case_id": None,
        "city": reg["city"],
        "region": reg["region"],
        "area": area_name,
        "latitude": lat,
        "longitude": lon,
        "incident_date": e_date,
        "incident_time": e_time,
        "crime_type": c_type,
        "time_bucket": t_bucket,
        "location_cluster": f"{reg_key}_HOTSPOT_{rng.randint(1, 8)}",
        "risk_level": risk,
        "related_case_number": None,
        "pattern_identifier": rng.choice(PATTERNS),
        "metadata_json": {
            "event_type": ev_type,
            "police_station": ps,
            "sensor_confidence": round(rng.uniform(0.75, 0.99), 2),
        },
        "is_synthetic": True,
        "data_source": "KRITAGAS_DEMO",
    })

print(f"Total Geo-Temporal Events Generated: {len(geo_events)}")

# -------------------------------------------------------------
# DUMP DATASETS TO DISK (JSON)
# -------------------------------------------------------------
print("Step 8: Writing synthetic datasets to disk in backend/data/synthetic/...")

files_to_write = [
    ("dataset_1_cases.json", cases),
    ("dataset_2_persons.json", entities),
    ("dataset_3_objects.json", vehicles_and_objects),
    ("dataset_4_relationships.json", relationships),
    ("dataset_5_geo_events.json", geo_events),
]

for filename, dataset in files_to_write:
    file_path = os.path.join(OUTPUT_DIR, filename)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)
    print(f"  -> Wrote {len(dataset):,} records to {filename}")

summary = {
    "generated_at": datetime.utcnow().isoformat() + "Z",
    "demo_seed": DEMO_SEED,
    "record_counts": {
        "dataset_1_cases": len(cases),
        "dataset_2_persons": len(entities),
        "dataset_3_objects": len(vehicles_and_objects),
        "dataset_4_relationships": len(relationships),
        "dataset_5_geo_events": len(geo_events),
        "total_records": len(cases) + len(entities) + len(vehicles_and_objects) + len(relationships) + len(geo_events),
    },
    "provenance": {
        "is_synthetic": True,
        "data_source": "KRITAGAS_DEMO",
        "jurisdictions": ["Mumbai", "Thane", "Navi Mumbai"],
    }
}

with open(os.path.join(OUTPUT_DIR, "summary.json"), "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)

print("\nAll 5 synthetic demo datasets successfully generated!")
print(f"Total Records: {summary['record_counts']['total_records']:,}")
