// ============================================================
// KRITAGAS — Mock Data: Evidence, Vehicles, Phones, Locations, Orgs, FIRs, Alerts, Timeline, etc.
// ============================================================
import { Evidence, Vehicle, Phone, Location, Organization, Alert, TimelineEvent, ForensicRecord, Contradiction, WatchlistItem, HistoricalCase, HotspotData, PredictiveData, Transaction, SentinelSubject, AuditLogEntry, FIR, CrimeTrendData, NetworkNode, NetworkEdge } from '@/types';

// ============ VEHICLES ============
export const vehicles: Vehicle[] = [
  { id: 'VEHICLE-001', type: 'Car', make: 'Maruti', model: 'Swift', color: 'White', registrationNumber: 'MH-02-AB-1234', ownerPersonId: 'PERSON-001', caseIds: ['CASE-001'], observations: [{ date: '2026-07-10', location: 'Andheri East', coordinates: [19.1197, 72.8464], source: 'CCTV' }] },
  { id: 'VEHICLE-003', type: 'Van', make: 'Tata', model: 'Ace', color: 'Blue', registrationNumber: 'MH-04-CD-5678', ownerPersonId: 'PERSON-003', caseIds: ['CASE-002'], observations: [{ date: '2026-06-22', location: 'Borivali West', coordinates: [19.2288, 72.8544], source: 'CCTV' }] },
  { id: 'VEHICLE-005', type: 'SUV', make: 'Toyota', model: 'Fortuner', color: 'Black', registrationNumber: 'DL-01-EF-9012', ownerPersonId: 'PERSON-005', caseIds: ['CASE-004'], observations: [{ date: '2026-05-15', location: 'Dwarka', coordinates: [28.5921, 77.0460], source: 'Toll Plaza' }] },
  { id: 'VEHICLE-006', type: 'Car', make: 'Honda', model: 'City', color: 'Silver', registrationNumber: 'DL-03-GH-3456', ownerPersonId: 'PERSON-005', caseIds: ['CASE-004'], observations: [] },
  { id: 'VEHICLE-007', type: 'Car', make: 'Hyundai', model: 'Creta', color: 'Red', registrationNumber: 'TS-09-IJ-7890', ownerPersonId: 'PERSON-006', caseIds: ['CASE-005'], observations: [{ date: '2026-07-20', location: 'Banjara Hills', coordinates: [17.4156, 78.4347], source: 'CCTV' }] },
  { id: 'VEHICLE-008', type: 'Car', make: 'BMW', model: '3 Series', color: 'Grey', registrationNumber: 'KA-01-KL-1234', ownerPersonId: 'PERSON-007', caseIds: ['CASE-006'], observations: [] },
  { id: 'VEHICLE-009', type: 'Car', make: 'Skoda', model: 'Octavia', color: 'White', registrationNumber: 'WB-06-MN-5678', ownerPersonId: 'PERSON-008', caseIds: ['CASE-007'], observations: [{ date: '2026-06-05', location: 'Salt Lake', coordinates: [22.5809, 88.4137], source: 'CCTV' }] },
  { id: 'VEHICLE-010', type: 'SUV', make: 'Mahindra', model: 'Scorpio', color: 'Black', registrationNumber: 'MH-01-OP-9012', ownerPersonId: 'PERSON-010', caseIds: ['CASE-009'], observations: [{ date: '2026-03-20', location: 'Khar West', coordinates: [19.0711, 72.8366], source: 'CCTV' }] },
  { id: 'VEHICLE-011', type: 'Truck', make: 'Ashok Leyland', model: 'Ecomet', color: 'Yellow', registrationNumber: 'MH-03-QR-3456', ownerPersonId: 'PERSON-010', caseIds: ['CASE-009'], observations: [] },
  { id: 'VEHICLE-012', type: 'Motorcycle', make: 'Royal Enfield', model: 'Classic 350', color: 'Black', registrationNumber: 'DL-05-ST-7890', ownerPersonId: 'PERSON-011', caseIds: ['CASE-010'], observations: [] },
  { id: 'VEHICLE-013', type: 'Car', make: 'Maruti', model: 'Alto', color: 'White', registrationNumber: 'MH-02-UV-1234', ownerPersonId: 'PERSON-013', caseIds: ['CASE-010'], observations: [] },
  { id: 'VEHICLE-014', type: 'Van', make: 'Mahindra', model: 'Bolero Pickup', color: 'Grey', registrationNumber: 'MH-04-WX-5678', ownerPersonId: 'PERSON-013', caseIds: ['CASE-013'], observations: [] },
  // CASE-102 vehicles
  { id: 'VEHICLE-044', type: 'Car', make: 'Mercedes-Benz', model: 'E-Class', color: 'Black', registrationNumber: 'MH-01-AM-4400', ownerPersonId: 'PERSON-014', caseIds: ['CASE-102','CASE-087'], observations: [{ date: '2026-08-20', location: 'Juhu', coordinates: [19.1075, 72.8263], source: 'CCTV' }, { date: '2026-08-28', location: 'Bandra', coordinates: [19.0596, 72.8295], source: 'CCTV' }, { date: '2026-09-01', location: 'Andheri West', coordinates: [19.1364, 72.8296], source: 'Toll Plaza' }] },
  { id: 'VEHICLE-018', type: 'SUV', make: 'Audi', model: 'Q5', color: 'White', registrationNumber: 'MH-02-AM-1800', ownerPersonId: 'PERSON-014', caseIds: ['CASE-102'], observations: [{ date: '2026-08-25', location: 'Pune', coordinates: [18.5204, 73.8567], source: 'Toll Plaza' }] },
  { id: 'VEHICLE-019', type: 'Car', make: 'Honda', model: 'Civic', color: 'Blue', registrationNumber: 'MH-01-NK-1900', ownerPersonId: 'PERSON-015', caseIds: ['CASE-102'], observations: [{ date: '2026-08-22', location: 'Versova', coordinates: [19.1332, 72.8120], source: 'CCTV' }] },
  { id: 'VEHICLE-020', type: 'Truck', make: 'Tata', model: 'LPT 1613', color: 'Blue', registrationNumber: 'MH-12-RT-2000', ownerPersonId: 'PERSON-016', caseIds: ['CASE-102'], observations: [{ date: '2026-08-18', location: 'Pune-Mumbai Expressway', coordinates: [18.7546, 73.3727], source: 'Toll Plaza' }] },
  { id: 'VEHICLE-021', type: 'Van', make: 'Force', model: 'Traveller', color: 'White', registrationNumber: 'MH-12-RT-2100', ownerPersonId: 'PERSON-016', caseIds: ['CASE-102'], observations: [] },
  { id: 'VEHICLE-022', type: 'Car', make: 'Maruti', model: 'Ciaz', color: 'Silver', registrationNumber: 'DL-02-SY-2200', ownerPersonId: 'PERSON-018', caseIds: ['CASE-102'], observations: [{ date: '2026-08-30', location: 'Model Town, Delhi', coordinates: [28.7170, 77.1932], source: 'CCTV' }] },
  { id: 'VEHICLE-023', type: 'Motorcycle', make: 'KTM', model: 'Duke 390', color: 'Orange', registrationNumber: 'KA-05-KV-2300', ownerPersonId: 'PERSON-019', caseIds: ['CASE-102'], observations: [] },
  { id: 'VEHICLE-024', type: 'SUV', make: 'Toyota', model: 'Innova Crysta', color: 'White', registrationNumber: 'MH-01-VS-2400', ownerPersonId: 'PERSON-021', caseIds: ['CASE-102','CASE-087'], observations: [{ date: '2026-08-15', location: 'Carter Road', coordinates: [19.0626, 72.8259], source: 'CCTV' }, { date: '2026-09-02', location: 'Andheri West', coordinates: [19.1364, 72.8296], source: 'CCTV' }] },
  { id: 'VEHICLE-025', type: 'Car', make: 'Volkswagen', model: 'Vento', color: 'Grey', registrationNumber: 'MH-02-VS-2500', ownerPersonId: 'PERSON-021', caseIds: ['CASE-102'], observations: [] },
  { id: 'VEHICLE-026', type: 'Car', make: 'Hyundai', model: 'i20', color: 'Red', registrationNumber: 'MH-01-LM-2600', ownerPersonId: 'PERSON-022', caseIds: ['CASE-102'], observations: [] },
  { id: 'VEHICLE-027', type: 'Car', make: 'Tata', model: 'Nexon', color: 'Blue', registrationNumber: 'DL-04-MT-2700', ownerPersonId: 'PERSON-023', caseIds: ['CASE-102'], observations: [] },
  ...Array.from({ length: 27 }, (_, i) => ({
    id: `VEHICLE-${String(i + 28).padStart(3, '0')}`, type: ['Car','SUV','Motorcycle','Van','Truck'][i % 5], make: ['Maruti','Hyundai','Tata','Mahindra','Honda'][i % 5], model: ['Swift','Creta','Nexon','Scorpio','City'][i % 5], color: ['White','Black','Silver','Blue','Red'][i % 5], registrationNumber: `MH-${String(i % 10 + 1).padStart(2,'0')}-XX-${String(2800 + i).padStart(4,'0')}`, ownerPersonId: `PERSON-${String(24 + i).padStart(3,'0')}`, caseIds: [`CASE-${String((i % 40) + 11).padStart(3,'0')}`], observations: [] as Vehicle['observations'],
  })),
];

// ============ PHONES ============
export const phones: Phone[] = Array.from({ length: 100 }, (_, i) => ({
  id: `PHONE-${String(i + 1).padStart(3, '0')}`,
  number: `+91 ${9820100000 + i * 111}`,
  imei: `35${String(4920000000000 + i * 100000).padStart(13, '0')}`,
  carrier: ['Jio', 'Airtel', 'Vi', 'BSNL'][i % 4],
  ownerPersonId: `PERSON-${String(i + 1).padStart(3, '0')}`,
  caseIds: i < 23 ? [`CASE-${String(i < 10 ? i + 1 : 102).padStart(3, '0')}`] : [`CASE-${String((i % 50) + 1).padStart(3, '0')}`],
  cdrRecords: i === 13 || i === 20 ? [
    { date: '2026-08-28', time: '14:32', duration: 342, type: 'Outgoing' as const, otherNumber: i === 13 ? '+91 98201 02128' : '+91 98201 01421', towerLocation: 'Andheri West', coordinates: [19.1364, 72.8296] as [number, number] },
    { date: '2026-08-29', time: '09:15', duration: 128, type: 'Incoming' as const, otherNumber: '+91 98230 02027', towerLocation: 'Bandra', coordinates: [19.0596, 72.8295] as [number, number] },
    { date: '2026-09-01', time: '22:45', duration: 67, type: 'Outgoing' as const, otherNumber: '+91 98201 01522', towerLocation: 'Juhu', coordinates: [19.1075, 72.8263] as [number, number] },
  ] : [],
}));

// ============ LOCATIONS ============
export const locations: Location[] = [
  { id: 'LOC-001', name: 'Golden Touch Jewellers', address: 'Shop 14, Andheri East Market', city: 'Mumbai', type: 'Crime Scene', coordinates: [19.1197, 72.8464], caseIds: ['CASE-001'], personIds: ['PERSON-001'], crimeTypes: ['Robbery'], incidents: 3 },
  { id: 'LOC-002', name: 'Borivali Auto Parts Hub', address: 'Plot 45, Industrial Area', city: 'Mumbai', type: 'Business', coordinates: [19.2288, 72.8544], caseIds: ['CASE-002'], personIds: ['PERSON-003'], crimeTypes: ['Drug Trafficking'], incidents: 2 },
  { id: 'LOC-003', name: 'TechPark Phase 2', address: 'Hinjewadi IT Park', city: 'Pune', type: 'Business', coordinates: [18.5912, 73.7390], caseIds: ['CASE-003'], personIds: ['PERSON-004'], crimeTypes: ['Cybercrime'], incidents: 1 },
  { id: 'LOC-004', name: 'Dwarka Sector 21', address: 'Plot 78, Sector 21', city: 'Delhi', type: 'Crime Scene', coordinates: [28.5921, 77.0460], caseIds: ['CASE-004'], personIds: ['PERSON-005'], crimeTypes: ['Fraud'], incidents: 4 },
  { id: 'LOC-005', name: 'Banjara Hills Road 12', address: '12 Banjara Hills', city: 'Hyderabad', type: 'Business', coordinates: [17.4156, 78.4347], caseIds: ['CASE-005'], personIds: ['PERSON-006'], crimeTypes: ['Extortion'], incidents: 2 },
  { id: 'LOC-006', name: 'Whitefield Industrial Estate', address: 'Unit 23, EPIP Zone', city: 'Bengaluru', type: 'Business', coordinates: [12.9698, 77.7500], caseIds: ['CASE-006'], personIds: ['PERSON-007'], crimeTypes: ['Fraud'], incidents: 1 },
  { id: 'LOC-007', name: 'Salt Lake Block FD', address: 'Block FD, Sector 3', city: 'Kolkata', type: 'Business', coordinates: [22.5809, 88.4137], caseIds: ['CASE-007'], personIds: ['PERSON-008','PERSON-012'], crimeTypes: ['Fraud'], incidents: 3 },
  { id: 'LOC-008', name: 'T Nagar Cyber Cafe', address: '89 South Usman Road', city: 'Chennai', type: 'Observation Point', coordinates: [13.0418, 80.2341], caseIds: ['CASE-008'], personIds: ['PERSON-009'], crimeTypes: ['Cybercrime'], incidents: 1 },
  { id: 'LOC-009', name: 'Khar West Jewellers Lane', address: '78 Linking Road', city: 'Mumbai', type: 'Business', coordinates: [19.0711, 72.8366], caseIds: ['CASE-009'], personIds: ['PERSON-010'], crimeTypes: ['Arms Trafficking'], incidents: 2 },
  { id: 'LOC-010', name: 'Karol Bagh Workshop', address: '45 Ajmal Khan Road', city: 'Delhi', type: 'Crime Scene', coordinates: [28.6519, 77.1909], caseIds: ['CASE-010'], personIds: ['PERSON-011','PERSON-013'], crimeTypes: ['Vehicle Theft'], incidents: 5 },
  // CASE-102 locations
  { id: 'LOC-087', name: 'Nexus Trading Office', address: '22 Juhu Tara Road, Juhu', city: 'Mumbai', type: 'Business', coordinates: [19.1075, 72.8263], caseIds: ['CASE-102','CASE-087'], personIds: ['PERSON-014','PERSON-021','PERSON-015'], crimeTypes: ['Money Laundering','Fraud'], incidents: 7 },
  { id: 'LOC-023', name: 'GlobalProp Realty Office', address: '55 FC Road, Deccan', city: 'Pune', type: 'Business', coordinates: [18.5204, 73.8567], caseIds: ['CASE-102','CASE-087'], personIds: ['PERSON-016','PERSON-020'], crimeTypes: ['Money Laundering'], incidents: 3 },
  { id: 'LOC-088', name: 'Carter Road Residence', address: '66 Carter Road', city: 'Mumbai', type: 'Residence', coordinates: [19.0626, 72.8259], caseIds: ['CASE-102'], personIds: ['PERSON-021'], crimeTypes: [], incidents: 0 },
  { id: 'LOC-089', name: 'Versova Business Centre', address: '8 Versova Lane', city: 'Mumbai', type: 'Business', coordinates: [19.1332, 72.8120], caseIds: ['CASE-102'], personIds: ['PERSON-015'], crimeTypes: ['Money Laundering'], incidents: 2 },
  { id: 'LOC-090', name: 'Model Town Meeting Point', address: '77 Model Town', city: 'Delhi', type: 'Observation Point', coordinates: [28.7170, 77.1932], caseIds: ['CASE-102'], personIds: ['PERSON-018'], crimeTypes: [], incidents: 1 },
  ...Array.from({ length: 60 }, (_, i) => ({
    id: `LOC-${String(i + 30).padStart(3, '0')}`,
    name: `Location ${i + 30}`,
    address: `${i * 7 + 10} Sector ${i % 15 + 1}`,
    city: ['Mumbai','Delhi','Pune','Bengaluru','Hyderabad','Chennai','Kolkata'][i % 7],
    type: ['Residence','Business','Crime Scene','Observation Point'][i % 4],
    coordinates: [19.0 + (i % 10) * 0.05, 72.8 + (i % 10) * 0.03] as [number, number],
    caseIds: [`CASE-${String((i % 50) + 1).padStart(3, '0')}`],
    personIds: [`PERSON-${String(30 + i).padStart(3, '0')}`],
    crimeTypes: [] as Location['crimeTypes'],
    incidents: i % 5,
  })),
];

// ============ ORGANIZATIONS ============
export const organizations: Organization[] = [
  { id: 'ORG-001', name: 'Golden Touch Jewellers Pvt Ltd', type: 'Business', address: 'Andheri East', city: 'Mumbai', registrationNumber: 'U74999MH2018PTC123456', personIds: ['PERSON-001','PERSON-002'], caseIds: ['CASE-001'], status: 'Under Investigation' },
  { id: 'ORG-002', name: 'Singh Construction Co', type: 'Business', address: 'Dwarka', city: 'Delhi', registrationNumber: 'U45200DL2015PTC234567', personIds: ['PERSON-005'], caseIds: ['CASE-004'], status: 'Under Investigation' },
  { id: 'ORG-003', name: 'Pacific Trading International', type: 'Shell Company', address: 'Borivali West', city: 'Mumbai', registrationNumber: 'U51100MH2020PTC345678', personIds: ['PERSON-003','PERSON-007'], caseIds: ['CASE-002','CASE-006'], status: 'Suspended' },
  { id: 'ORG-004', name: 'Reddy Realtors', type: 'Business', address: 'Banjara Hills', city: 'Hyderabad', registrationNumber: 'U70100TS2019PTC456789', personIds: ['PERSON-006'], caseIds: ['CASE-005'], status: 'Active' },
  { id: 'ORG-005', name: 'DelhiLand Developers', type: 'Business', address: 'Connaught Place', city: 'Delhi', registrationNumber: 'U45201DL2017PTC567890', personIds: ['PERSON-005'], caseIds: ['CASE-004'], status: 'Under Investigation' },
  { id: 'ORG-006', name: 'East India Finance Corp', type: 'Financial Institution', address: 'Park Street', city: 'Kolkata', registrationNumber: 'U65100WB2016PTC678901', personIds: ['PERSON-007','PERSON-008'], caseIds: ['CASE-006','CASE-007'], status: 'Under Investigation' },
  { id: 'ORG-007', name: 'Gupta Gold & Diamonds', type: 'Business', address: 'Khar West', city: 'Mumbai', registrationNumber: 'U36100MH2014PTC789012', personIds: ['PERSON-010'], caseIds: ['CASE-009'], status: 'Under Investigation' },
  { id: 'ORG-008', name: 'Bengal National Bank', type: 'Financial Institution', address: 'Salt Lake', city: 'Kolkata', registrationNumber: 'U65191WB2010PTC890123', personIds: ['PERSON-012'], caseIds: ['CASE-007','CASE-011'], status: 'Active' },
  { id: 'ORG-009', name: 'AutoKraft Parts & Service', type: 'Business', address: 'Mohammed Ali Road', city: 'Mumbai', registrationNumber: 'U34100MH2019PTC901234', personIds: ['PERSON-013'], caseIds: ['CASE-010','CASE-013'], status: 'Under Investigation' },
  { id: 'ORG-010', name: 'Kapoor Restaurant Chain', type: 'Business', address: 'Pali Hill', city: 'Mumbai', registrationNumber: 'U55100MH2012PTC012345', personIds: ['PERSON-024'], caseIds: ['CASE-014'], status: 'Active' },
  { id: 'ORG-011', name: 'MedPharm Distributors', type: 'Business', address: 'Indiranagar', city: 'Bengaluru', registrationNumber: 'U24200KA2018PTC112233', personIds: ['PERSON-026'], caseIds: ['CASE-016'], status: 'Under Investigation' },
  { id: 'ORG-012', name: 'Sri Lakshmi Temple Trust', type: 'NGO', address: 'T Nagar', city: 'Chennai', registrationNumber: 'NGO-TN-2010-44556', personIds: ['PERSON-028'], caseIds: ['CASE-019'], status: 'Active' },
  { id: 'ORG-013', name: 'Calcutta Medical Centre', type: 'Business', address: 'Ballygunge', city: 'Kolkata', registrationNumber: 'U85100WB2008PTC223344', personIds: ['PERSON-030'], caseIds: ['CASE-021'], status: 'Active' },
  // CASE-102 orgs
  { id: 'ORG-014', name: 'Nexus Trading Corp', type: 'Shell Company', address: 'Juhu Tara Road', city: 'Mumbai', registrationNumber: 'U74900MH2021PTC334455', personIds: ['PERSON-014','PERSON-018','PERSON-020','PERSON-021'], caseIds: ['CASE-102','CASE-087'], status: 'Under Investigation' },
  { id: 'ORG-015', name: 'Horizon Digital Solutions', type: 'Business', address: 'Versova Lane', city: 'Mumbai', registrationNumber: 'U72200MH2022PTC445566', personIds: ['PERSON-015','PERSON-017'], caseIds: ['CASE-102'], status: 'Under Investigation' },
  { id: 'ORG-016', name: 'GlobalProp Realty Pvt Ltd', type: 'Business', address: 'FC Road', city: 'Pune', registrationNumber: 'U70100MH2020PTC556677', personIds: ['PERSON-016'], caseIds: ['CASE-102'], status: 'Under Investigation' },
  { id: 'ORG-017', name: 'Apex Financial Services', type: 'Financial Institution', address: 'Koregaon Park', city: 'Pune', registrationNumber: 'U65990MH2019PTC667788', personIds: ['PERSON-020'], caseIds: ['CASE-102'], status: 'Under Investigation' },
  { id: 'ORG-018', name: 'Westline Logistics Ltd', type: 'Business', address: 'Carter Road', city: 'Mumbai', registrationNumber: 'U63000MH2018PTC778899', personIds: ['PERSON-021','PERSON-022'], caseIds: ['CASE-102'], status: 'Under Investigation' },
  { id: 'ORG-019', name: 'AM Consultancy Services', type: 'Shell Company', address: 'Juhu', city: 'Mumbai', registrationNumber: 'U74110MH2023PTC889900', personIds: ['PERSON-014'], caseIds: ['CASE-102'], status: 'Under Investigation' },
  ...Array.from({ length: 31 }, (_, i) => ({
    id: `ORG-${String(i + 20).padStart(3, '0')}`,
    name: `Organization ${i + 20}`,
    type: ['Business','NGO','Shell Company','Financial Institution'][i % 4],
    address: `${i * 5 + 10} Sector ${i % 10 + 1}`,
    city: ['Mumbai','Delhi','Pune','Bengaluru','Hyderabad','Chennai','Kolkata'][i % 7],
    registrationNumber: `U${String(10000 + i * 1000)}MH2020PTC${String(100000 + i * 111)}`,
    personIds: [] as string[],
    caseIds: [`CASE-${String((i % 50) + 1).padStart(3, '0')}`],
    status: (['Active','Under Investigation','Suspended','Dissolved'] as const)[i % 4],
  })),
];

// ============ EVIDENCE ============
export const evidence: Evidence[] = [
  // CASE-102 evidence
  { id: 'EVIDENCE-044', type: 'FIR', title: 'FIR Document — CASE-102', description: 'Original FIR filed regarding suspected money laundering through Nexus Trading Corp', source: 'Juhu Police Station', date: '2026-08-15', caseId: 'CASE-102', personIds: ['PERSON-014','PERSON-023'], status: 'Verified', integrity: { hash: 'a8f4e2b1c3d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e992cd', verified: true, verifiedDate: '2026-08-15' }, metadata: { pages: '4', language: 'Hindi/English', policeStation: 'Juhu PS' } },
  { id: 'EVIDENCE-045', type: 'Document', title: 'Nexus Trading Corp Registration', description: 'Company registration documents for Nexus Trading Corp showing directors and shareholders', source: 'MCA Records', date: '2026-08-16', caseId: 'CASE-102', personIds: ['PERSON-014','PERSON-021'], status: 'Verified', integrity: { hash: 'b9a5f3c2d4e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2', verified: true, verifiedDate: '2026-08-16' }, metadata: { documentType: 'Registration Certificate', registrar: 'ROC Mumbai' } },
  { id: 'EVIDENCE-046', type: 'Transaction', title: 'Suspicious Bank Transfers', description: 'Series of bank transfers between Nexus Trading and Apex Financial totalling ₹4.7 Crore', source: 'Bank Records', date: '2026-08-18', caseId: 'CASE-102', personIds: ['PERSON-014','PERSON-020'], status: 'Under Analysis', integrity: { hash: 'c0b6a4d3e5f7a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4', verified: true, verifiedDate: '2026-08-18' }, metadata: { transactionCount: '23', totalAmount: '₹4.7 Crore', period: 'Jan 2026 - Aug 2026' } },
  { id: 'EVIDENCE-047', type: 'CCTV', title: 'CCTV — Nexus Office Entry', description: 'CCTV footage showing multiple persons of interest entering Nexus Trading office', source: 'Building Security', date: '2026-08-20', caseId: 'CASE-102', personIds: ['PERSON-014','PERSON-015','PERSON-021'], status: 'Verified', integrity: { hash: 'd1c7b5e4f6a8b9c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6', verified: true, verifiedDate: '2026-08-21' }, metadata: { duration: '4h 23m', cameras: '3', resolution: '1080p' } },
  { id: 'EVIDENCE-048', type: 'Image', title: 'Property Documents — Versova', description: 'Photographs of property registration documents for Versova Business Centre', source: 'Sub-Registrar Office', date: '2026-08-22', caseId: 'CASE-102', personIds: ['PERSON-015'], status: 'Verified', integrity: { hash: 'e2d8c6f5a7b9c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8', verified: true, verifiedDate: '2026-08-22' }, metadata: { imageCount: '12', format: 'JPEG' } },
  { id: 'EVIDENCE-049', type: 'Report', title: 'Financial Analysis Report', description: 'Detailed financial analysis of transactions between ORG-014, ORG-017, and ORG-019', source: 'Forensic Accountant', date: '2026-08-25', caseId: 'CASE-102', personIds: ['PERSON-014','PERSON-020','PERSON-021'], status: 'Verified', integrity: { hash: 'f3e9d7a6b8c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0', verified: true, verifiedDate: '2026-08-25' }, metadata: { pages: '28', analyst: 'CA Rohit Menon' } },
  { id: 'EVIDENCE-050', type: 'CCTV', title: 'CCTV — Pune Office Meeting', description: 'Footage showing meeting between PERSON-016 and PERSON-020 at Pune office', source: 'Office Complex CCTV', date: '2026-08-26', caseId: 'CASE-102', personIds: ['PERSON-016','PERSON-020'], status: 'Under Analysis', integrity: { hash: 'a4f0e8b7c9d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1', verified: true, verifiedDate: '2026-08-27' }, metadata: { duration: '1h 12m', cameras: '2' } },
  { id: 'EVIDENCE-051', type: 'Document', title: 'Property Transfer Records', description: 'Records showing property transfers through GlobalProp Realty at undervalued rates', source: 'Sub-Registrar Pune', date: '2026-08-27', caseId: 'CASE-102', personIds: ['PERSON-016','PERSON-015'], status: 'Verified', integrity: { hash: 'b5a1f9c8d0e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2', verified: true, verifiedDate: '2026-08-28' }, metadata: { properties: '5', totalValue: '₹8.2 Crore' } },
  { id: 'EVIDENCE-052', type: 'Transaction', title: 'Cash Deposit Patterns', description: 'Pattern of cash deposits below reporting threshold across multiple accounts', source: 'Bank Records', date: '2026-08-28', caseId: 'CASE-102', personIds: ['PERSON-021','PERSON-014'], status: 'Flagged', integrity: { hash: 'c6b2a0d9e1f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3', verified: true, verifiedDate: '2026-08-29' }, metadata: { deposits: '47', totalAmount: '₹1.8 Crore', period: 'Mar-Aug 2026' } },
  { id: 'EVIDENCE-053', type: 'Video', title: 'Toll Plaza Footage — Mumbai-Pune', description: 'Vehicle observation at toll plaza showing VEHICLE-020 and VEHICLE-044 in convoy', source: 'NHAI Toll Records', date: '2026-08-18', caseId: 'CASE-102', personIds: ['PERSON-016','PERSON-014'], status: 'Verified', integrity: { hash: 'd7c3b1e0f2a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4', verified: true, verifiedDate: '2026-08-19' }, metadata: { tollPlaza: 'Khalapur', direction: 'Mumbai → Pune' } },
  { id: 'EVIDENCE-054', type: 'PDF', title: 'Aadhaar Verification Report', description: 'Identity verification documents for persons of interest', source: 'UIDAI Records', date: '2026-08-20', caseId: 'CASE-102', personIds: ['PERSON-014','PERSON-021'], status: 'Verified', integrity: { hash: 'e8d4c2f1a3b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5', verified: true, verifiedDate: '2026-08-20' }, metadata: { records: '2' } },
  { id: 'EVIDENCE-055', type: 'Report', title: 'Network Analysis Summary', description: 'Summary of relationship network analysis for CASE-102 entities', source: 'Intelligence Unit', date: '2026-09-01', caseId: 'CASE-102', personIds: ['PERSON-014','PERSON-021','PERSON-015','PERSON-016'], status: 'Under Analysis', integrity: { hash: 'f9e5d3a2b4c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6', verified: true, verifiedDate: '2026-09-01' }, metadata: { pages: '15' } },
  { id: 'EVIDENCE-056', type: 'Document', title: 'Phone CDR Analysis', description: 'Call detail record analysis showing communication patterns', source: 'Telecom Provider', date: '2026-09-02', caseId: 'CASE-102', personIds: ['PERSON-014','PERSON-021'], status: 'Under Analysis', integrity: { hash: 'a0f6e4b3c5d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7', verified: false, verifiedDate: '' }, metadata: { records: '342', period: 'Jun-Aug 2026' } },
  // Historical case evidence
  { id: 'EVIDENCE-087', type: 'FIR', title: 'FIR — Westside Fraud Ring', description: 'Original FIR for the 2023 financial fraud investigation', source: 'Bandra PS', date: '2023-03-12', caseId: 'CASE-087', personIds: ['PERSON-014','PERSON-021'], status: 'Archived', integrity: { hash: 'b1a7f5c4d6e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8', verified: true, verifiedDate: '2023-03-12' }, metadata: {} },
  { id: 'EVIDENCE-088', type: 'Report', title: 'Investigation Summary — CASE-087', description: 'Final investigation report for the Westside Financial Fraud Ring case', source: 'ACP V. Patil', date: '2024-01-15', caseId: 'CASE-087', personIds: ['PERSON-014','PERSON-021','PERSON-018'], status: 'Archived', integrity: { hash: 'c2b8a6d5e7f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9', verified: true, verifiedDate: '2024-01-15' }, metadata: { pages: '42' } },
  // General evidence
  ...Array.from({ length: 135 }, (_, i) => {
    const idx = i + 1;
    const types: Evidence['type'][] = ['FIR','PDF','Image','Video','CCTV','Transaction','Report','Document'];
    return {
      id: `EVIDENCE-${String(idx).padStart(3, '0')}`,
      type: types[idx % types.length],
      title: `Evidence Record ${idx}`,
      description: `Evidence item ${idx} collected during investigation`,
      source: ['Police Station','CCTV','Bank Records','Forensic Lab','Witness','Digital Extraction','Toll Records'][idx % 7],
      date: `2026-${String((idx % 8) + 1).padStart(2,'0')}-${String((idx % 28) + 1).padStart(2,'0')}`,
      caseId: `CASE-${String((idx % 50) + 1).padStart(3,'0')}`,
      personIds: [`PERSON-${String((idx % 100) + 1).padStart(3,'0')}`],
      status: (['Collected','Under Analysis','Verified','Flagged','Archived'] as const)[idx % 5],
      integrity: { hash: `${idx.toString(16).padStart(64,'0')}`, verified: idx % 3 !== 0, verifiedDate: idx % 3 !== 0 ? `2026-08-${String((idx % 28) + 1).padStart(2,'0')}` : '' },
      metadata: {},
    } satisfies Evidence;
  }),
];

// ============ ALERTS ============
export const alerts: Alert[] = [
  { id: 'ALERT-102', type: 'Network Relationship', severity: 'High Priority', title: 'New network connection detected between PERSON-014 and PERSON-021', description: 'Analysis reveals previously unknown financial connection between Aarav Mehta and Vikram Sharma through Nexus Trading Corp.', caseId: 'CASE-102', entityId: 'PERSON-014', entityType: 'Person', date: '2026-09-01T14:32:00', read: false, resolved: false },
  { id: 'ALERT-103', type: 'Evidence Contradiction', severity: 'High Priority', title: 'Timeline inconsistency detected in CASE-102', description: 'CCTV evidence shows PERSON-014 at two different locations within a 15-minute window on Aug 28.', caseId: 'CASE-102', entityId: 'PERSON-014', entityType: 'Person', date: '2026-09-02T09:15:00', read: false, resolved: false },
  { id: 'ALERT-104', type: 'Historical Match', severity: 'Review', title: 'Historical case match found: CASE-087', description: 'CASE-102 shares 89% pattern similarity with closed case CASE-087 (Westside Financial Fraud Ring, 2023).', caseId: 'CASE-102', entityId: 'CASE-087', entityType: 'Case', date: '2026-09-02T11:42:00', read: true, resolved: false },
  { id: 'ALERT-105', type: 'Anomaly Detected', severity: 'High Priority', title: 'Behavior anomaly detected for PERSON-014', description: 'Unusual activity pattern detected: nocturnal communication at 03:14 AM, departure from established behavioral baseline.', caseId: 'CASE-102', entityId: 'PERSON-014', entityType: 'Person', date: '2026-09-03T06:30:00', read: false, resolved: false },
  { id: 'ALERT-001', type: 'New FIR Connection', severity: 'Review', title: 'FIR connection to existing case', description: 'New FIR filed at Andheri PS matches patterns from CASE-001.', caseId: 'CASE-001', date: '2026-09-01T10:00:00', read: true, resolved: false },
  { id: 'ALERT-002', type: 'CCTV Observation', severity: 'Review', title: 'Vehicle spotted at flagged location', description: 'VEHICLE-003 observed at known drug trafficking point.', caseId: 'CASE-002', entityId: 'VEHICLE-003', entityType: 'Vehicle', date: '2026-08-30T16:45:00', read: false, resolved: false },
  { id: 'ALERT-003', type: 'Crime Trend Increase', severity: 'Info', title: 'Fraud cases increasing in Dwarka', description: 'Monthly fraud reports in Dwarka sector increased by 23% over last quarter.', caseId: 'CASE-004', date: '2026-08-28T08:00:00', read: true, resolved: true },
  { id: 'ALERT-004', type: 'Watchlist Event', severity: 'High Priority', title: 'Watchlist entity activity detected', description: 'PERSON-006 observed at new location not in baseline profile.', caseId: 'CASE-005', entityId: 'PERSON-006', entityType: 'Person', date: '2026-09-01T22:10:00', read: false, resolved: false },
  { id: 'ALERT-005', type: 'Network Relationship', severity: 'Review', title: 'Cross-case entity link discovered', description: 'PERSON-008 appears in records from both CASE-007 and an unrelated financial investigation.', caseId: 'CASE-007', entityId: 'PERSON-008', entityType: 'Person', date: '2026-09-02T13:20:00', read: true, resolved: false },
  { id: 'ALERT-006', type: 'New FIR Connection', severity: 'High Priority', title: 'Gold smuggling FIR pattern match', description: 'New complaint at Khar PS shows strong pattern similarity with CASE-009 methodology.', caseId: 'CASE-009', date: '2026-08-25T11:30:00', read: false, resolved: false },
  { id: 'ALERT-007', type: 'CCTV Observation', severity: 'Review', title: 'Stolen vehicle identified', description: 'VEHICLE-012 identified at Karol Bagh via ANPR camera.', caseId: 'CASE-010', entityId: 'VEHICLE-012', entityType: 'Vehicle', date: '2026-08-29T19:45:00', read: true, resolved: false },
  ...Array.from({ length: 89 }, (_, i) => {
    const idx = i + 8;
    const types: Alert['type'][] = ['New FIR Connection','Network Relationship','Historical Match','Evidence Contradiction','Anomaly Detected','Crime Trend Increase','CCTV Observation','Watchlist Event'];
    const severities: Alert['severity'][] = ['Info','Review','High Priority'];
    return {
      id: `ALERT-${String(idx + 100).padStart(3, '0')}`,
      type: types[idx % types.length],
      severity: severities[idx % severities.length],
      title: `Alert ${idx + 100}`,
      description: `System-generated alert for investigation activity ${idx + 100}.`,
      caseId: `CASE-${String((idx % 50) + 1).padStart(3, '0')}`,
      date: `2026-08-${String((idx % 28) + 1).padStart(2,'0')}T${String(8 + idx % 12).padStart(2,'0')}:${String(idx % 60).padStart(2,'0')}:00`,
      read: idx % 3 === 0,
      resolved: idx % 7 === 0,
    } satisfies Alert;
  }),
];

// ============ TIMELINE (CASE-102) ============
export const timelineEvents: TimelineEvent[] = [
  { id: 'TL-001', caseId: 'CASE-102', timestamp: '2026-08-15T09:32:00', title: 'Complaint received', description: 'Written complaint received from Manoj Tiwari (PERSON-023) regarding suspected fraudulent property dealings.', type: 'complaint', entityId: 'PERSON-023', entityType: 'Person', icon: 'FileText' },
  { id: 'TL-002', caseId: 'CASE-102', timestamp: '2026-08-15T10:15:00', title: 'FIR registered', description: 'FIR-2026-0102 registered at Juhu Police Station under sections related to financial fraud and cheating.', type: 'fir', entityId: 'FIR-2026-0102', icon: 'FileCheck' },
  { id: 'TL-003', caseId: 'CASE-102', timestamp: '2026-08-15T10:21:00', title: 'FIR OCR completed', description: 'Automated OCR processing completed. Text extraction confidence: 96%.', type: 'processing', icon: 'Scan' },
  { id: 'TL-004', caseId: 'CASE-102', timestamp: '2026-08-15T10:24:00', title: 'Entity extracted: Aarav Mehta', description: 'AI entity extraction identified PERSON-014 (Aarav Mehta) as person of interest from FIR text.', type: 'entity', entityId: 'PERSON-014', entityType: 'Person', icon: 'User' },
  { id: 'TL-005', caseId: 'CASE-102', timestamp: '2026-08-15T10:25:00', title: 'Vehicle identified: MH-01-AM-4400', description: 'Vehicle VEHICLE-044 (Mercedes-Benz E-Class) identified from FIR description.', type: 'entity', entityId: 'VEHICLE-044', entityType: 'Vehicle', icon: 'Car' },
  { id: 'TL-006', caseId: 'CASE-102', timestamp: '2026-08-16T10:28:00', title: 'Organization identified: Nexus Trading Corp', description: 'ORG-014 identified as shell company mentioned in FIR complaint.', type: 'entity', entityId: 'ORG-014', entityType: 'Organization', icon: 'Building2' },
  { id: 'TL-007', caseId: 'CASE-102', timestamp: '2026-08-18T11:02:00', title: 'Network relationship detected', description: 'System detected connection between PERSON-014 and PERSON-021 through Nexus Trading Corp directorship records.', type: 'network', entityId: 'PERSON-021', entityType: 'Person', icon: 'Network' },
  { id: 'TL-008', caseId: 'CASE-102', timestamp: '2026-08-20T14:30:00', title: 'CCTV evidence collected', description: 'CCTV footage obtained from Nexus Trading Corp office building showing entry/exit patterns.', type: 'evidence', entityId: 'EVIDENCE-047', icon: 'Camera' },
  { id: 'TL-009', caseId: 'CASE-102', timestamp: '2026-08-22T09:45:00', title: 'Property records obtained', description: 'Sub-registrar records for Versova properties linked to PERSON-015 collected.', type: 'evidence', entityId: 'EVIDENCE-048', icon: 'FileStack' },
  { id: 'TL-010', caseId: 'CASE-102', timestamp: '2026-08-25T11:00:00', title: 'Financial analysis completed', description: 'Forensic accountant report identifies ₹4.7 Crore in suspicious transactions between three organizations.', type: 'analysis', entityId: 'EVIDENCE-049', icon: 'BarChart3' },
  { id: 'TL-011', caseId: 'CASE-102', timestamp: '2026-08-26T16:20:00', title: 'Pune meeting observed', description: 'CCTV captures meeting between PERSON-016 and PERSON-020 at FC Road office.', type: 'evidence', entityId: 'EVIDENCE-050', icon: 'Camera' },
  { id: 'TL-012', caseId: 'CASE-102', timestamp: '2026-08-28T14:32:00', title: 'Phone communication detected', description: 'CDR analysis shows sustained communication pattern between PHONE-014 and PHONE-021.', type: 'communication', icon: 'Phone' },
  { id: 'TL-013', caseId: 'CASE-102', timestamp: '2026-09-01T11:02:00', title: 'Historical case match: CASE-087', description: 'System identified 89% similarity with closed case CASE-087 (Westside Financial Fraud Ring, 2023).', type: 'historical', entityId: 'CASE-087', entityType: 'Case', icon: 'History' },
  { id: 'TL-014', caseId: 'CASE-102', timestamp: '2026-09-02T09:15:00', title: 'Evidence contradiction detected', description: 'Timeline inconsistency: PERSON-014 observed at two locations within 15-minute window on Aug 28.', type: 'contradiction', entityId: 'PERSON-014', entityType: 'Person', icon: 'AlertTriangle' },
  { id: 'TL-015', caseId: 'CASE-102', timestamp: '2026-09-02T11:42:00', title: 'Sentinel anomaly detected', description: 'Behavioral anomaly: PERSON-014 shows unusual nocturnal activity pattern, departure from baseline.', type: 'anomaly', entityId: 'PERSON-014', entityType: 'Person', icon: 'ShieldAlert' },
  { id: 'TL-016', caseId: 'CASE-102', timestamp: '2026-09-02T14:00:00', title: 'DNA evidence received', description: 'Forensic lab report received for DNA sample DNA-044 from crime scene.', type: 'forensic', entityId: 'EVIDENCE-044', icon: 'Dna' },
  { id: 'TL-017', caseId: 'CASE-102', timestamp: '2026-09-02T15:30:00', title: 'Cash deposit pattern flagged', description: '47 cash deposits below reporting threshold identified across multiple accounts of PERSON-021.', type: 'financial', entityId: 'EVIDENCE-052', icon: 'Banknote' },
  { id: 'TL-018', caseId: 'CASE-102', timestamp: '2026-09-03T08:00:00', title: 'Network analysis updated', description: 'Updated network graph shows 30+ connected nodes across 6 organizations.', type: 'network', icon: 'Network' },
  { id: 'TL-019', caseId: 'CASE-102', timestamp: '2026-09-03T10:00:00', title: 'Investigation review meeting', description: 'DCP R. Sharma reviews investigation progress and assigns additional resources.', type: 'administrative', icon: 'Users' },
  { id: 'TL-020', caseId: 'CASE-102', timestamp: '2026-09-03T12:00:00', title: 'Investigator review checkpoint', description: 'Comprehensive case review conducted. All evidence items catalogued. Next steps identified.', type: 'review', icon: 'ClipboardCheck' },
  ...Array.from({ length: 80 }, (_, i) => ({
    id: `TL-${String(i + 21).padStart(3, '0')}`,
    caseId: `CASE-${String((i % 50) + 1).padStart(3, '0')}`,
    timestamp: `2026-08-${String((i % 28) + 1).padStart(2, '0')}T${String(8 + i % 12).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00`,
    title: ['FIR filed','Evidence collected','Witness interviewed','Suspect identified','Vehicle tracked','Phone records received','CCTV reviewed','Lab report received','Network updated','Case reviewed'][i % 10],
    description: `Investigation activity for case ${(i % 50) + 1}.`,
    type: ['fir','evidence','interview','entity','vehicle','communication','evidence','forensic','network','review'][i % 10],
    icon: ['FileText','FileStack','Users','User','Car','Phone','Camera','Dna','Network','ClipboardCheck'][i % 10],
  })),
];

// ============ FORENSICS ============
export const forensicRecords: ForensicRecord[] = [
  { id: 'DNA-044', category: 'DNA', caseId: 'CASE-102', evidenceId: 'EVIDENCE-044', candidatePersonId: 'PERSON-014', matchPercentage: 98.2, status: 'Requires Examiner Verification', analyst: 'Dr. Sheetal Rao', date: '2026-09-02', details: 'DNA sample extracted from document handling surface at Nexus Trading office. High-confidence match with reference sample of PERSON-014.' },
  { id: 'FP-021', category: 'Fingerprint', caseId: 'CASE-102', evidenceId: 'EVIDENCE-045', candidatePersonId: 'PERSON-021', matchPercentage: 94.7, status: 'Complete', analyst: 'SI Pradeep Kumar', date: '2026-08-28', details: 'Latent fingerprint recovered from registration document. 12-point match with PERSON-021 reference prints.' },
  { id: 'BALL-009', category: 'Ballistics', caseId: 'CASE-009', evidenceId: 'EVIDENCE-015', candidatePersonId: 'PERSON-010', matchPercentage: 87.3, status: 'In Progress', analyst: 'Lab Tech Anand S.', date: '2026-08-20', details: 'Ballistic analysis of recovered firearm. Partial match with seized weapon from CASE-009.' },
  { id: 'TOX-014', category: 'Toxicology', caseId: 'CASE-102', evidenceId: 'EVIDENCE-047', candidatePersonId: 'PERSON-014', matchPercentage: 0, status: 'Complete', analyst: 'Dr. Meera Jain', date: '2026-09-01', details: 'Toxicology screening negative. No controlled substances detected in submitted samples.' },
  { id: 'DIG-044', category: 'Digital Forensics', caseId: 'CASE-102', evidenceId: 'EVIDENCE-056', candidatePersonId: 'PERSON-014', matchPercentage: 91.5, status: 'In Progress', analyst: 'Cyber SI Rahul V.', date: '2026-09-02', details: 'Digital forensics analysis of phone CDR data. Communication pattern analysis shows 91.5% correlation with suspected network activity timeline.' },
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `FOR-${String(i + 6).padStart(3, '0')}`,
    category: (['DNA','Fingerprint','Ballistics','Toxicology','Digital Forensics'] as const)[i % 5],
    caseId: `CASE-${String((i % 10) + 1).padStart(3, '0')}`,
    evidenceId: `EVIDENCE-${String((i % 20) + 1).padStart(3, '0')}`,
    candidatePersonId: `PERSON-${String((i % 30) + 1).padStart(3, '0')}`,
    matchPercentage: 60 + (i * 3.2) % 38,
    status: (['Pending','In Progress','Complete','Requires Examiner Verification'] as const)[i % 4],
    analyst: ['Dr. Sheetal Rao','SI Pradeep Kumar','Lab Tech Anand S.','Dr. Meera Jain','Cyber SI Rahul V.'][i % 5],
    date: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
    details: `Forensic analysis record ${i + 6}.`,
  })),
];

// ============ CONTRADICTIONS ============
export const contradictions: Contradiction[] = [
  { id: 'CONTRA-001', caseId: 'CASE-102', type: 'Timestamp mismatch', sourceA: { id: 'EVIDENCE-047', type: 'CCTV', value: 'PERSON-014 at Nexus Office, Juhu at 14:28', date: '2026-08-28' }, sourceB: { id: 'EVIDENCE-053', type: 'CCTV', value: 'PERSON-014 at Toll Plaza, Khalapur at 14:43', date: '2026-08-28' }, description: 'CCTV timestamps indicate PERSON-014 was observed at Nexus Office at 14:28 and at Khalapur Toll Plaza at 14:43, which is 75km away. Travel time inconsistency of approximately 60 minutes vs 15 minutes observed.', severity: 'High', status: 'Open' },
  { id: 'CONTRA-002', caseId: 'CASE-102', type: 'Document mismatch', sourceA: { id: 'EVIDENCE-045', type: 'Document', value: 'Company registration shows 2 directors', date: '2026-08-16' }, sourceB: { id: 'EVIDENCE-049', type: 'Report', value: 'Financial analysis identifies 4 signatories', date: '2026-08-25' }, description: 'Company registration documents for Nexus Trading Corp list 2 directors, but financial analysis identifies 4 authorized signatories on bank accounts.', severity: 'Medium', status: 'Under Review' },
  { id: 'CONTRA-003', caseId: 'CASE-102', type: 'Vehicle mismatch', sourceA: { id: 'EVIDENCE-053', type: 'Video', value: 'VEHICLE-044 (Black Mercedes E-Class)', date: '2026-08-18' }, sourceB: { id: 'EVIDENCE-047', type: 'CCTV', value: 'Dark grey sedan observed (partial plate AM-44**)', date: '2026-08-20' }, description: 'Toll plaza records show black Mercedes-Benz. CCTV at office shows what appears to be a dark grey sedan with partial plate match. Potential color discrepancy or lighting conditions.', severity: 'Low', status: 'Open' },
  { id: 'CONTRA-004', caseId: 'CASE-102', type: 'Identity mismatch', sourceA: { id: 'EVIDENCE-054', type: 'PDF', value: 'Aadhaar shows DOB: 15-Mar-1987', date: '2026-08-20' }, sourceB: { id: 'EVIDENCE-045', type: 'Document', value: 'Company registration shows DOB: 15-Mar-1986', date: '2026-08-16' }, description: 'Date of birth for PERSON-014 differs between Aadhaar records (1987) and company registration documents (1986). Potential clerical error or deliberate discrepancy.', severity: 'Medium', status: 'Open' },
];

// ============ WATCHLIST ============
export const watchlistItems: WatchlistItem[] = [
  { id: 'WL-001', entityId: 'PERSON-014', entityType: 'Person', entityName: 'Aarav Mehta', reason: 'Primary person of interest in CASE-102', createdBy: 'DCP R. Sharma', createdDate: '2026-08-16', status: 'Active' },
  { id: 'WL-002', entityId: 'PERSON-021', entityType: 'Person', entityName: 'Vikram Sharma', reason: 'Key associate in CASE-102 network', createdBy: 'DCP R. Sharma', createdDate: '2026-08-18', status: 'Active' },
  { id: 'WL-003', entityId: 'VEHICLE-044', entityType: 'Vehicle', entityName: 'MH-01-AM-4400', reason: 'Vehicle associated with PERSON-014', createdBy: 'SI M. Khan', createdDate: '2026-08-16', status: 'Active' },
  { id: 'WL-004', entityId: 'ORG-014', entityType: 'Organization', entityName: 'Nexus Trading Corp', reason: 'Suspected shell company in money laundering', createdBy: 'ACP V. Patil', createdDate: '2026-08-17', status: 'Active' },
  { id: 'WL-005', entityId: 'PERSON-006', entityType: 'Person', entityName: 'Meena Reddy', reason: 'Surveillance target in CASE-005', createdBy: 'CI A. Nair', createdDate: '2026-07-25', status: 'Active' },
  { id: 'WL-006', entityId: 'LOC-087', entityType: 'Location', entityName: 'Nexus Trading Office', reason: 'Primary operational base under investigation', createdBy: 'DCP R. Sharma', createdDate: '2026-08-20', status: 'Active' },
  { id: 'WL-007', entityId: 'PHONE-014', entityType: 'Phone', entityName: '+91 98201 01421', reason: 'Phone of primary POI', createdBy: 'SI M. Khan', createdDate: '2026-08-22', status: 'Active' },
  { id: 'WL-008', entityId: 'PERSON-003', entityType: 'Person', entityName: 'Amit Patel', reason: 'Drug trafficking suspect', createdBy: 'ACP V. Patil', createdDate: '2026-06-25', status: 'Paused' },
];

// ============ HISTORICAL CASES ============
export const historicalCases: HistoricalCase[] = [
  { id: 'CASE-087', title: 'Westside Financial Fraud Ring', year: 2023, crime: 'Fraud', location: 'Bandra, Mumbai', city: 'Mumbai', status: 'Closed', similarity: 89, relatedCaseId: 'CASE-102', sharedEntities: ['PERSON-014','PERSON-021','PERSON-018'], sharedLocations: ['LOC-087','LOC-023'], reason: 'Shared entity pattern + location + crime characteristics. Both cases involve suspected financial fraud through shell companies with overlapping directors and property dealings in western Mumbai.' },
  { id: 'HC-002', title: 'Mumbai Port Smuggling Ring', year: 2022, crime: 'Arms Trafficking', location: 'Khar, Mumbai', city: 'Mumbai', status: 'Closed', similarity: 62, relatedCaseId: 'CASE-009', sharedEntities: ['PERSON-010'], sharedLocations: ['LOC-009'], reason: 'Shared entity and similar operational pattern in western Mumbai.' },
  { id: 'HC-003', title: 'Pune Real Estate Scam', year: 2024, crime: 'Fraud', location: 'Koregaon Park, Pune', city: 'Pune', status: 'Closed', similarity: 74, relatedCaseId: 'CASE-102', sharedEntities: ['PERSON-016'], sharedLocations: ['LOC-023'], reason: 'Similar real estate fraud pattern through property undervaluation in Pune region.' },
  { id: 'HC-004', title: 'Delhi NCR Car Theft Ring', year: 2025, crime: 'Vehicle Theft', location: 'Karol Bagh, Delhi', city: 'Delhi', status: 'Closed', similarity: 78, relatedCaseId: 'CASE-010', sharedEntities: ['PERSON-011'], sharedLocations: ['LOC-010'], reason: 'Same operational area and methodological similarities in vehicle theft and resale.' },
  { id: 'HC-005', title: 'Kolkata Ponzi Scheme', year: 2023, crime: 'Fraud', location: 'Salt Lake, Kolkata', city: 'Kolkata', status: 'Closed', similarity: 55, relatedCaseId: 'CASE-007', sharedEntities: ['PERSON-008'], sharedLocations: ['LOC-007'], reason: 'Financial fraud pattern through banking channels with shared entity.' },
  ...Array.from({ length: 70 }, (_, i) => ({
    id: `HC-${String(i + 6).padStart(3, '0')}`,
    title: `Historical Case ${i + 6}`,
    year: 2020 + (i % 6),
    crime: (['Robbery','Fraud','Kidnapping','Murder','Extortion','Drug Trafficking','Vehicle Theft','Cybercrime'] as const)[i % 8],
    location: ['Andheri, Mumbai','CP, Delhi','FC Road, Pune','MG Road, Bengaluru','Jubilee Hills, Hyderabad','T Nagar, Chennai','Park Street, Kolkata'][i % 7],
    city: ['Mumbai','Delhi','Pune','Bengaluru','Hyderabad','Chennai','Kolkata'][i % 7],
    status: 'Closed' as const,
    similarity: 30 + (i * 7) % 50,
    sharedEntities: [],
    sharedLocations: [],
    reason: `Historical pattern match based on crime type and geographical proximity.`,
  })),
];

// ============ HOTSPOTS ============
export const hotspotData: HotspotData[] = [
  { id: 'HS-001', area: 'Andheri West', city: 'Mumbai', state: 'Maharashtra', coordinates: [19.1364, 72.8296], crimeCount: 45, crimeTypes: [{ type: 'Robbery', count: 12 }, { type: 'Fraud', count: 18 }, { type: 'Vehicle Theft', count: 8 }, { type: 'Assault', count: 7 }], trend: 'Increasing', recentFIRs: 8, severity: 'High' },
  { id: 'HS-002', area: 'Bandra', city: 'Mumbai', state: 'Maharashtra', coordinates: [19.0596, 72.8295], crimeCount: 38, crimeTypes: [{ type: 'Fraud', count: 15 }, { type: 'Cybercrime', count: 10 }, { type: 'Robbery', count: 8 }, { type: 'Assault', count: 5 }], trend: 'Stable', recentFIRs: 5, severity: 'Medium' },
  { id: 'HS-003', area: 'Connaught Place', city: 'Delhi', state: 'Delhi', coordinates: [28.6315, 77.2167], crimeCount: 52, crimeTypes: [{ type: 'Robbery', count: 20 }, { type: 'Vehicle Theft', count: 15 }, { type: 'Fraud', count: 10 }, { type: 'Assault', count: 7 }], trend: 'Increasing', recentFIRs: 12, severity: 'Critical' },
  { id: 'HS-004', area: 'Koregaon Park', city: 'Pune', state: 'Maharashtra', coordinates: [18.5362, 73.8932], crimeCount: 22, crimeTypes: [{ type: 'Fraud', count: 10 }, { type: 'Drug Trafficking', count: 7 }, { type: 'Assault', count: 5 }], trend: 'Stable', recentFIRs: 3, severity: 'Medium' },
  { id: 'HS-005', area: 'Whitefield', city: 'Bengaluru', state: 'Karnataka', coordinates: [12.9698, 77.7500], crimeCount: 28, crimeTypes: [{ type: 'Cybercrime', count: 15 }, { type: 'Fraud', count: 8 }, { type: 'Robbery', count: 5 }], trend: 'Increasing', recentFIRs: 6, severity: 'High' },
  { id: 'HS-006', area: 'Jubilee Hills', city: 'Hyderabad', state: 'Telangana', coordinates: [17.4319, 78.4071], crimeCount: 18, crimeTypes: [{ type: 'Extortion', count: 8 }, { type: 'Fraud', count: 6 }, { type: 'Robbery', count: 4 }], trend: 'Decreasing', recentFIRs: 2, severity: 'Medium' },
  { id: 'HS-007', area: 'Park Street', city: 'Kolkata', state: 'West Bengal', coordinates: [22.5518, 88.3517], crimeCount: 30, crimeTypes: [{ type: 'Fraud', count: 12 }, { type: 'Robbery', count: 10 }, { type: 'Assault', count: 8 }], trend: 'Stable', recentFIRs: 4, severity: 'Medium' },
  { id: 'HS-008', area: 'T Nagar', city: 'Chennai', state: 'Tamil Nadu', coordinates: [13.0418, 80.2341], crimeCount: 20, crimeTypes: [{ type: 'Cybercrime', count: 8 }, { type: 'Fraud', count: 7 }, { type: 'Robbery', count: 5 }], trend: 'Increasing', recentFIRs: 5, severity: 'High' },
  { id: 'HS-009', area: 'Karol Bagh', city: 'Delhi', state: 'Delhi', coordinates: [28.6519, 77.1909], crimeCount: 42, crimeTypes: [{ type: 'Vehicle Theft', count: 18 }, { type: 'Robbery', count: 12 }, { type: 'Assault', count: 7 }, { type: 'Fraud', count: 5 }], trend: 'Increasing', recentFIRs: 9, severity: 'Critical' },
  { id: 'HS-010', area: 'Borivali', city: 'Mumbai', state: 'Maharashtra', coordinates: [19.2288, 72.8544], crimeCount: 25, crimeTypes: [{ type: 'Drug Trafficking', count: 10 }, { type: 'Robbery', count: 8 }, { type: 'Assault', count: 7 }], trend: 'Stable', recentFIRs: 4, severity: 'Medium' },
];

// ============ PREDICTIVE ============
export const predictiveData: PredictiveData[] = [
  { area: 'Andheri West', city: 'Mumbai', crimeType: 'Vehicle Theft', trend: 'Increasing', forecast: 'Elevated Activity Probability', probability: 0.78, peakPeriod: '22:00–04:00', recommendation: 'Increased investigative attention and patrol coverage recommended for Andheri West during late-night hours.' },
  { area: 'Connaught Place', city: 'Delhi', crimeType: 'Robbery', trend: 'Increasing', forecast: 'Elevated Activity Probability', probability: 0.82, peakPeriod: '18:00–22:00', recommendation: 'Enhanced surveillance and rapid response capability recommended for CP area during evening hours.' },
  { area: 'Whitefield', city: 'Bengaluru', crimeType: 'Cybercrime', trend: 'Increasing', forecast: 'Elevated Activity Probability', probability: 0.71, peakPeriod: '09:00–17:00', recommendation: 'Cybercrime awareness and monitoring of IT park perimeters recommended.' },
  { area: 'Karol Bagh', city: 'Delhi', crimeType: 'Vehicle Theft', trend: 'Increasing', forecast: 'High Activity Probability', probability: 0.85, peakPeriod: '01:00–05:00', recommendation: 'Intensive patrolling and ANPR camera monitoring recommended for Karol Bagh during early morning hours.' },
  { area: 'T Nagar', city: 'Chennai', crimeType: 'Fraud', trend: 'Increasing', forecast: 'Moderate Activity Probability', probability: 0.64, peakPeriod: '10:00–16:00', recommendation: 'Increased monitoring of financial establishments and awareness campaigns recommended.' },
  { area: 'Bandra', city: 'Mumbai', crimeType: 'Fraud', trend: 'Stable', forecast: 'Stable Activity Probability', probability: 0.45, peakPeriod: '10:00–18:00', recommendation: 'Maintain current investigative posture. No escalation required.' },
  { area: 'Koregaon Park', city: 'Pune', crimeType: 'Drug Trafficking', trend: 'Stable', forecast: 'Moderate Activity Probability', probability: 0.58, peakPeriod: '20:00–02:00', recommendation: 'Sustained monitoring of nightlife establishments and known trafficking routes recommended.' },
  { area: 'Jubilee Hills', city: 'Hyderabad', crimeType: 'Extortion', trend: 'Decreasing', forecast: 'Reduced Activity Probability', probability: 0.32, peakPeriod: '14:00–20:00', recommendation: 'Current enforcement measures appear effective. Maintain baseline monitoring.' },
];

// ============ SENTINEL ============
export const sentinelSubjects: SentinelSubject[] = [
  {
    personId: 'PERSON-014', name: 'Aarav Mehta',
    baselineActivity: { startHour: 8, endHour: 19, typicalLocations: ['Juhu','Andheri West','Bandra'], typicalVehicles: ['VEHICLE-044'] },
    recentActivity: [
      { date: '2026-08-28', time: '14:28', location: 'Nexus Office, Juhu', activity: 'Office visit', isAnomaly: false },
      { date: '2026-08-29', time: '09:15', location: 'Bandra', activity: 'Meeting', isAnomaly: false },
      { date: '2026-09-01', time: '22:45', location: 'Juhu', activity: 'Late-night communication', isAnomaly: true, anomalyReason: 'Activity outside baseline hours (22:45)' },
      { date: '2026-09-02', time: '03:14', location: 'Unknown', activity: 'Phone activity', isAnomaly: true, anomalyReason: 'Nocturnal activity at 03:14 AM. Significant departure from 08:00-19:00 baseline.' },
      { date: '2026-09-02', time: '11:00', location: 'Pune', activity: 'Travel to Pune', isAnomaly: true, anomalyReason: 'Unscheduled trip outside typical operational area' },
      { date: '2026-09-03', time: '07:45', location: 'Andheri West', activity: 'Morning routine', isAnomaly: false },
    ],
    anomalyScore: 0.87,
    status: 'Anomaly Detected',
  },
  {
    personId: 'PERSON-021', name: 'Vikram Sharma',
    baselineActivity: { startHour: 9, endHour: 20, typicalLocations: ['Carter Road','Bandra','Andheri'], typicalVehicles: ['VEHICLE-024'] },
    recentActivity: [
      { date: '2026-08-28', time: '10:00', location: 'Carter Road', activity: 'Residence', isAnomaly: false },
      { date: '2026-09-01', time: '14:32', location: 'Andheri West', activity: 'Phone call', isAnomaly: false },
      { date: '2026-09-02', time: '16:00', location: 'Carter Road', activity: 'Residence', isAnomaly: false },
    ],
    anomalyScore: 0.23,
    status: 'Normal',
  },
  {
    personId: 'PERSON-006', name: 'Meena Reddy',
    baselineActivity: { startHour: 9, endHour: 18, typicalLocations: ['Jubilee Hills','Banjara Hills'], typicalVehicles: ['VEHICLE-007'] },
    recentActivity: [
      { date: '2026-09-01', time: '22:10', location: 'Secunderabad', activity: 'New location visit', isAnomaly: true, anomalyReason: 'Visit to location outside baseline profile' },
      { date: '2026-09-02', time: '08:00', location: 'Jubilee Hills', activity: 'Normal routine', isAnomaly: false },
    ],
    anomalyScore: 0.54,
    status: 'Changed Pattern',
  },
];

// ============ TRANSACTIONS ============
export const transactions: Transaction[] = [
  { id: 'TXN-001', date: '2026-03-15', amount: 2500000, currency: 'INR', fromEntity: 'ORG-014', toEntity: 'ORG-017', type: 'Wire Transfer', caseId: 'CASE-102', status: 'Suspicious' },
  { id: 'TXN-002', date: '2026-04-02', amount: 1800000, currency: 'INR', fromEntity: 'ORG-017', toEntity: 'ORG-019', type: 'Wire Transfer', caseId: 'CASE-102', status: 'Suspicious' },
  { id: 'TXN-003', date: '2026-04-20', amount: 950000, currency: 'INR', fromEntity: 'ORG-019', toEntity: 'PERSON-014', type: 'Account Transfer', caseId: 'CASE-102', status: 'Suspicious' },
  { id: 'TXN-004', date: '2026-05-08', amount: 3200000, currency: 'INR', fromEntity: 'ORG-014', toEntity: 'ORG-016', type: 'Wire Transfer', caseId: 'CASE-102', status: 'Under Review' },
  { id: 'TXN-005', date: '2026-05-25', amount: 1200000, currency: 'INR', fromEntity: 'ORG-016', toEntity: 'ORG-018', type: 'Wire Transfer', caseId: 'CASE-102', status: 'Suspicious' },
  { id: 'TXN-006', date: '2026-06-10', amount: 4500000, currency: 'INR', fromEntity: 'PERSON-021', toEntity: 'ORG-014', type: 'Cash Deposit', caseId: 'CASE-102', status: 'Suspicious' },
  { id: 'TXN-007', date: '2026-06-28', amount: 890000, currency: 'INR', fromEntity: 'ORG-018', toEntity: 'PERSON-021', type: 'Account Transfer', caseId: 'CASE-102', status: 'Verified' },
  { id: 'TXN-008', date: '2026-07-15', amount: 5600000, currency: 'INR', fromEntity: 'ORG-014', toEntity: 'ORG-015', type: 'Wire Transfer', caseId: 'CASE-102', status: 'Suspicious' },
  { id: 'TXN-009', date: '2026-08-01', amount: 750000, currency: 'INR', fromEntity: 'ORG-015', toEntity: 'PERSON-015', type: 'Account Transfer', caseId: 'CASE-102', status: 'Under Review' },
  { id: 'TXN-010', date: '2026-08-12', amount: 2100000, currency: 'INR', fromEntity: 'PERSON-014', toEntity: 'ORG-016', type: 'Wire Transfer', caseId: 'CASE-102', status: 'Suspicious' },
];

// ============ CRIME TRENDS ============
export const crimeTrendData: CrimeTrendData[] = [
  { month: 'Jan', robbery: 42, fraud: 38, kidnapping: 8, murder: 5, vehicleTheft: 28, cybercrime: 22 },
  { month: 'Feb', robbery: 38, fraud: 41, kidnapping: 6, murder: 4, vehicleTheft: 25, cybercrime: 25 },
  { month: 'Mar', robbery: 45, fraud: 44, kidnapping: 9, murder: 6, vehicleTheft: 30, cybercrime: 28 },
  { month: 'Apr', robbery: 40, fraud: 46, kidnapping: 7, murder: 5, vehicleTheft: 27, cybercrime: 32 },
  { month: 'May', robbery: 48, fraud: 42, kidnapping: 10, murder: 7, vehicleTheft: 32, cybercrime: 29 },
  { month: 'Jun', robbery: 52, fraud: 48, kidnapping: 8, murder: 6, vehicleTheft: 35, cybercrime: 34 },
  { month: 'Jul', robbery: 50, fraud: 51, kidnapping: 11, murder: 8, vehicleTheft: 29, cybercrime: 38 },
  { month: 'Aug', robbery: 55, fraud: 53, kidnapping: 9, murder: 5, vehicleTheft: 33, cybercrime: 41 },
];

// ============ AUDIT LOGS ============
export const auditLogs: AuditLogEntry[] = [
  { id: 'AUD-001', userId: 'USR-001', userName: 'DCP R. Sharma', action: 'Login', target: 'System', timestamp: '2026-09-03T08:00:00', ipAddress: '192.168.1.101' },
  { id: 'AUD-002', userId: 'USR-001', userName: 'DCP R. Sharma', action: 'Case Opened', target: 'CASE-102', timestamp: '2026-09-03T08:05:00', ipAddress: '192.168.1.101' },
  { id: 'AUD-003', userId: 'USR-001', userName: 'DCP R. Sharma', action: 'Evidence Viewed', target: 'EVIDENCE-044', timestamp: '2026-09-03T08:12:00', ipAddress: '192.168.1.101' },
  { id: 'AUD-004', userId: 'USR-002', userName: 'ACP V. Patil', action: 'Login', target: 'System', timestamp: '2026-09-03T08:30:00', ipAddress: '192.168.1.102' },
  { id: 'AUD-005', userId: 'USR-002', userName: 'ACP V. Patil', action: 'Evidence Modified', target: 'EVIDENCE-045', timestamp: '2026-09-03T09:00:00', ipAddress: '192.168.1.102' },
  { id: 'AUD-006', userId: 'USR-001', userName: 'DCP R. Sharma', action: 'Relationship Reviewed', target: 'PERSON-014 → PERSON-021', timestamp: '2026-09-03T09:30:00', ipAddress: '192.168.1.101' },
  { id: 'AUD-007', userId: 'USR-003', userName: 'SI M. Khan', action: 'Alert Dismissed', target: 'ALERT-003', timestamp: '2026-09-03T10:00:00', ipAddress: '192.168.1.103' },
  { id: 'AUD-008', userId: 'USR-001', userName: 'DCP R. Sharma', action: 'AI Query', target: 'Why are PERSON-014 and PERSON-021 connected?', timestamp: '2026-09-03T10:15:00', ipAddress: '192.168.1.101' },
  ...Array.from({ length: 42 }, (_, i) => ({
    id: `AUD-${String(i + 9).padStart(3, '0')}`,
    userId: `USR-${String((i % 5) + 1).padStart(3, '0')}`,
    userName: ['DCP R. Sharma','ACP V. Patil','SI M. Khan','DI P. Reddy','CI A. Nair'][i % 5],
    action: ['Login','Case Opened','Evidence Viewed','Evidence Modified','Relationship Reviewed','Alert Dismissed','AI Query','Logout'][i % 8],
    target: `Target-${i + 9}`,
    timestamp: `2026-09-${String((i % 3) + 1).padStart(2, '0')}T${String(8 + (i % 10)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00`,
    ipAddress: `192.168.1.${100 + (i % 10)}`,
  })),
];

// ============ NETWORK GRAPH DATA (CASE-102) ============
export const networkNodes: NetworkNode[] = [
  { id: 'PERSON-019', label: 'Karan Verma', type: 'Person', data: { role: 'Key Person of Interest', relevance: 'High', phone: '+91 98765 43210', vehicle: 'MH-01-AB-1234' } },
  { id: 'PERSON-016', label: 'Rahul Thakur', type: 'Person', data: { role: 'Key Associate', relevance: 'High', phone: '+91 99887 65432' } },
  { id: 'PERSON-015', label: 'Nisha Kapoor', type: 'Person', data: { role: 'Person of Interest', relevance: 'High' } },
  { id: 'PERSON-014', label: 'Aarav Mehta', type: 'Person', data: { role: 'Person of Interest', relevance: 'Medium' } },
  { id: 'PERSON-021', label: 'Vikram Sharma', type: 'Person', data: { role: 'Logistics Associate', relevance: 'Medium' } },
  { id: 'PERSON-018', label: 'Suresh Yadav', type: 'Person', data: { role: 'Financial Intermediary', relevance: 'Medium' } },
  { id: 'PERSON-020', label: 'Divya Saxena', type: 'Person', data: { role: 'Chartered Accountant', relevance: 'Medium' } },
  { id: 'PERSON-022', label: 'Lakshmi Menon', type: 'Person', data: { role: 'Witness' } },
  { id: 'PERSON-023', label: 'Manoj Tiwari', type: 'Person', data: { role: 'Complainant' } },
  { id: 'PERSON-010', label: 'Sanjay Gupta', type: 'Person', data: { role: 'Suspect' } },
  { id: 'PHONE-014', label: '+91 98765 XXXXX', type: 'Phone', data: { carrier: 'Airtel', subscriber: 'Karan Verma' } },
  { id: 'PHONE-016', label: '+91 99887 XXXXX', type: 'Phone', data: { carrier: 'Jio', subscriber: 'Rahul Thakur' } },
  { id: 'VEHICLE-044', label: 'MH-01-AB-1234', type: 'Vehicle', data: { make: 'Black Mercedes E-Class', reg: 'MH-01-AB-1234' } },
  { id: 'VEHICLE-024', label: 'MH-01-VS-2400', type: 'Vehicle', data: { make: 'Toyota Innova' } },
  { id: 'CASE-102', label: 'CASE-102', type: 'Case', data: {} },
  { id: 'FIR-2026-0102', label: 'FIR-2026-0102', type: 'FIR', data: {} },
  { id: 'ORG-014', label: 'Nexus Trading Corp', type: 'Organization', data: { type: 'Shell Company' } },
  { id: 'ORG-015', label: 'Horizon Digital', type: 'Organization', data: { type: 'Business' } },
  { id: 'ORG-016', label: 'GlobalProp Realty', type: 'Organization', data: { type: 'Business' } },
  { id: 'ORG-017', label: 'Apex Financial', type: 'Organization', data: { type: 'Financial Institution' } },
  { id: 'LOC-087', label: 'Nexus Office, Juhu', type: 'Location', data: { city: 'Mumbai' } },
  { id: 'LOC-023', label: 'Pune Office', type: 'Location', data: { city: 'Pune' } },
  { id: 'LOC-088', label: 'Carter Road Residence', type: 'Location', data: { city: 'Mumbai' } },
  { id: 'LOC-089', label: 'Versova Business Centre', type: 'Location', data: { city: 'Mumbai' } },
  { id: 'PERSON-017', label: 'Rohit Sen', type: 'Person', data: { role: 'Hawala Operator', relevance: 'Medium' } },
  { id: 'ORG-018', label: 'Apex Capital Holding', type: 'Organization', data: { type: 'Holding Company' } },
  { id: 'ORG-019', label: 'AM Consultancy Services', type: 'Organization', data: { type: 'Shell Company' } },
  { id: 'EVIDENCE-044', label: 'FIR Legal Document', type: 'Evidence', data: {} },
  { id: 'EVIDENCE-046', label: 'Bank Transfers Record', type: 'Evidence', data: {} },
  { id: 'EVIDENCE-049', label: 'Financial Audit Report', type: 'Evidence', data: {} },
  { id: 'TXN-001', label: '₹25L Layered Transfer', type: 'Transaction', data: { amount: 2500000 } },
  { id: 'TXN-006', label: '₹45L Shell Deposit', type: 'Transaction', data: { amount: 4500000 } },
  { id: 'TXN-008', label: '₹56L Hawala Remittance', type: 'Transaction', data: { amount: 5600000 } },
];

export const networkEdges: NetworkEdge[] = [
  { id: 'E-KV-01', source: 'PERSON-019', target: 'CASE-102', relationship: 'INVOLVED_IN', evidenceBasis: ['EVIDENCE-044','EVIDENCE-045'], confidence: 96, caseIds: ['CASE-102','CASE-087'] },
  { id: 'E-KV-02', source: 'PERSON-019', target: 'PERSON-016', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-045','EVIDENCE-047'], confidence: 87, caseIds: ['CASE-102','CASE-087'] },
  { id: 'E-KV-03', source: 'PERSON-019', target: 'PERSON-015', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-048'], confidence: 84, caseIds: ['CASE-102'] },
  { id: 'E-KV-04', source: 'PERSON-019', target: 'PHONE-014', relationship: 'USED', evidenceBasis: ['EVIDENCE-044'], confidence: 98, caseIds: ['CASE-102'] },
  { id: 'E-KV-05', source: 'PERSON-016', target: 'PHONE-016', relationship: 'USED', evidenceBasis: ['EVIDENCE-044'], confidence: 98, caseIds: ['CASE-102'] },
  { id: 'E-KV-06', source: 'PHONE-014', target: 'PHONE-016', relationship: 'CONNECTED_TO', evidenceBasis: ['EVIDENCE-046'], confidence: 92, caseIds: ['CASE-102'] },
  { id: 'E-KV-07', source: 'PERSON-019', target: 'VEHICLE-044', relationship: 'USED', evidenceBasis: ['EVIDENCE-053'], confidence: 94, caseIds: ['CASE-102','CASE-087'] },
  { id: 'E-KV-08', source: 'PERSON-019', target: 'ORG-014', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-045'], confidence: 96, caseIds: ['CASE-102'] },
  { id: 'E-KV-09', source: 'PERSON-019', target: 'LOC-087', relationship: 'LOCATED_AT', evidenceBasis: ['EVIDENCE-047'], confidence: 91, caseIds: ['CASE-102'] },
  { id: 'E-KV-10', source: 'PERSON-019', target: 'TXN-001', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-046'], confidence: 95, caseIds: ['CASE-102'] },
  { id: 'E-001', source: 'PERSON-014', target: 'CASE-102', relationship: 'INVOLVED_IN', evidenceBasis: ['EVIDENCE-044'], confidence: 95, caseIds: ['CASE-102'] },
  { id: 'E-002', source: 'PERSON-021', target: 'CASE-102', relationship: 'INVOLVED_IN', evidenceBasis: ['EVIDENCE-045'], confidence: 92, caseIds: ['CASE-102'] },
  { id: 'E-003', source: 'PERSON-014', target: 'PERSON-021', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-045','EVIDENCE-049','EVIDENCE-056'], confidence: 82, caseIds: ['CASE-102','CASE-087'] },
  { id: 'E-004', source: 'PERSON-014', target: 'ORG-014', relationship: 'OWNS', evidenceBasis: ['EVIDENCE-045'], confidence: 98, caseIds: ['CASE-102'] },
  { id: 'E-005', source: 'PERSON-021', target: 'ORG-014', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-045'], confidence: 95, caseIds: ['CASE-102'] },
  { id: 'E-006', source: 'PERSON-014', target: 'ORG-019', relationship: 'OWNS', evidenceBasis: ['EVIDENCE-045'], confidence: 97, caseIds: ['CASE-102'] },
  { id: 'E-007', source: 'PERSON-015', target: 'CASE-102', relationship: 'INVOLVED_IN', evidenceBasis: ['EVIDENCE-048'], confidence: 88, caseIds: ['CASE-102'] },
  { id: 'E-008', source: 'PERSON-015', target: 'ORG-014', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-048'], confidence: 85, caseIds: ['CASE-102'] },
  { id: 'E-009', source: 'PERSON-015', target: 'ORG-015', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-048'], confidence: 90, caseIds: ['CASE-102'] },
  { id: 'E-010', source: 'PERSON-016', target: 'ORG-016', relationship: 'OWNS', evidenceBasis: ['EVIDENCE-051'], confidence: 96, caseIds: ['CASE-102'] },
  { id: 'E-011', source: 'PERSON-016', target: 'PERSON-014', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-053'], confidence: 72, caseIds: ['CASE-102'] },
  { id: 'E-012', source: 'PERSON-020', target: 'ORG-017', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-046'], confidence: 91, caseIds: ['CASE-102'] },
  { id: 'E-013', source: 'PERSON-020', target: 'ORG-014', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-049'], confidence: 78, caseIds: ['CASE-102'] },
  { id: 'E-014', source: 'PERSON-021', target: 'ORG-018', relationship: 'OWNS', evidenceBasis: ['EVIDENCE-049'], confidence: 94, caseIds: ['CASE-102'] },
  { id: 'E-015', source: 'PERSON-014', target: 'VEHICLE-044', relationship: 'OWNS', evidenceBasis: ['EVIDENCE-053'], confidence: 99, caseIds: ['CASE-102'] },
  { id: 'E-016', source: 'PERSON-021', target: 'VEHICLE-024', relationship: 'OWNS', evidenceBasis: ['EVIDENCE-047'], confidence: 99, caseIds: ['CASE-102'] },
  { id: 'E-017', source: 'PERSON-014', target: 'LOC-087', relationship: 'LOCATED_AT', evidenceBasis: ['EVIDENCE-047'], confidence: 95, caseIds: ['CASE-102'] },
  { id: 'E-018', source: 'PERSON-021', target: 'LOC-088', relationship: 'LOCATED_AT', evidenceBasis: ['EVIDENCE-047'], confidence: 98, caseIds: ['CASE-102'] },
  { id: 'E-019', source: 'PERSON-015', target: 'LOC-089', relationship: 'LOCATED_AT', evidenceBasis: ['EVIDENCE-048'], confidence: 92, caseIds: ['CASE-102'] },
  { id: 'E-020', source: 'ORG-014', target: 'LOC-087', relationship: 'LOCATED_AT', evidenceBasis: ['EVIDENCE-045'], confidence: 99, caseIds: ['CASE-102'] },
  { id: 'E-021', source: 'ORG-016', target: 'LOC-023', relationship: 'LOCATED_AT', evidenceBasis: ['EVIDENCE-051'], confidence: 99, caseIds: ['CASE-102'] },
  { id: 'E-022', source: 'ORG-014', target: 'TXN-001', relationship: 'TRANSFERRED_TO', evidenceBasis: ['EVIDENCE-046'], confidence: 98, caseIds: ['CASE-102'] },
  { id: 'E-023', source: 'TXN-001', target: 'ORG-017', relationship: 'TRANSFERRED_TO', evidenceBasis: ['EVIDENCE-046'], confidence: 98, caseIds: ['CASE-102'] },
  { id: 'E-024', source: 'PERSON-021', target: 'TXN-006', relationship: 'TRANSFERRED_TO', evidenceBasis: ['EVIDENCE-052'], confidence: 95, caseIds: ['CASE-102'] },
  { id: 'E-025', source: 'TXN-006', target: 'ORG-014', relationship: 'TRANSFERRED_TO', evidenceBasis: ['EVIDENCE-052'], confidence: 95, caseIds: ['CASE-102'] },
  { id: 'E-026', source: 'ORG-014', target: 'TXN-008', relationship: 'TRANSFERRED_TO', evidenceBasis: ['EVIDENCE-046'], confidence: 97, caseIds: ['CASE-102'] },
  { id: 'E-027', source: 'TXN-008', target: 'ORG-015', relationship: 'TRANSFERRED_TO', evidenceBasis: ['EVIDENCE-046'], confidence: 97, caseIds: ['CASE-102'] },
  { id: 'E-028', source: 'FIR-2026-0102', target: 'CASE-102', relationship: 'SUPPORTED_BY', evidenceBasis: ['EVIDENCE-044'], confidence: 100, caseIds: ['CASE-102'] },
  { id: 'E-029', source: 'PERSON-023', target: 'FIR-2026-0102', relationship: 'MENTIONED_IN', evidenceBasis: ['EVIDENCE-044'], confidence: 100, caseIds: ['CASE-102'] },
  { id: 'E-030', source: 'PERSON-017', target: 'PERSON-015', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-048'], confidence: 68, caseIds: ['CASE-102'] },
  { id: 'E-031', source: 'PERSON-018', target: 'PERSON-016', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-050'], confidence: 65, caseIds: ['CASE-102'] },
  { id: 'E-032', source: 'PERSON-019', target: 'PERSON-018', relationship: 'CONNECTED_TO', evidenceBasis: ['EVIDENCE-055'], confidence: 58, caseIds: ['CASE-102'] },
  { id: 'E-033', source: 'PERSON-020', target: 'PERSON-021', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-049'], confidence: 75, caseIds: ['CASE-102'] },
  { id: 'E-034', source: 'PERSON-022', target: 'PERSON-021', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-049'], confidence: 62, caseIds: ['CASE-102'] },
  { id: 'E-035', source: 'PERSON-022', target: 'ORG-018', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-049'], confidence: 80, caseIds: ['CASE-102'] },
  { id: 'E-036', source: 'PERSON-010', target: 'PERSON-014', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-055'], confidence: 55, caseIds: ['CASE-102'] },
  { id: 'E-037', source: 'PERSON-010', target: 'PERSON-021', relationship: 'CONNECTED_TO', evidenceBasis: ['EVIDENCE-055'], confidence: 48, caseIds: ['CASE-102'] },
  { id: 'E-038', source: 'EVIDENCE-044', target: 'CASE-102', relationship: 'SUPPORTED_BY', evidenceBasis: ['EVIDENCE-044'], confidence: 100, caseIds: ['CASE-102'] },
  { id: 'E-039', source: 'EVIDENCE-046', target: 'CASE-102', relationship: 'SUPPORTED_BY', evidenceBasis: ['EVIDENCE-046'], confidence: 100, caseIds: ['CASE-102'] },
  { id: 'E-040', source: 'EVIDENCE-049', target: 'CASE-102', relationship: 'SUPPORTED_BY', evidenceBasis: ['EVIDENCE-049'], confidence: 100, caseIds: ['CASE-102'] },
  { id: 'E-041', source: 'PERSON-014', target: 'PERSON-015', relationship: 'ASSOCIATED_WITH', evidenceBasis: ['EVIDENCE-048','EVIDENCE-055'], confidence: 76, caseIds: ['CASE-102'] },
  { id: 'E-042', source: 'PERSON-016', target: 'PERSON-018', relationship: 'CONNECTED_TO', evidenceBasis: ['EVIDENCE-050'], confidence: 65, caseIds: ['CASE-102'] },
  { id: 'E-043', source: 'VEHICLE-044', target: 'LOC-087', relationship: 'LOCATED_AT', evidenceBasis: ['EVIDENCE-047'], confidence: 92, caseIds: ['CASE-102'] },
  { id: 'E-044', source: 'VEHICLE-024', target: 'LOC-088', relationship: 'LOCATED_AT', evidenceBasis: ['EVIDENCE-047'], confidence: 90, caseIds: ['CASE-102'] },
  { id: 'E-045', source: 'PERSON-014', target: 'PERSON-010', relationship: 'CONNECTED_TO', evidenceBasis: ['EVIDENCE-055'], confidence: 55, caseIds: ['CASE-102'] },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `E-${String(i + 46).padStart(3, '0')}`,
    source: `PERSON-${String(14 + (i % 10)).padStart(3, '0')}`,
    target: 'CASE-102',
    relationship: 'INVOLVED_IN' as const,
    evidenceBasis: ['EVIDENCE-055'],
    confidence: 70 + i * 2,
    caseIds: ['CASE-102'],
  })),
];

// ============ FIR (CASE-102) ============
export const firs: FIR[] = [
  {
    id: 'FIR-2026-0102',
    caseId: 'CASE-102',
    policeStation: 'Juhu Police Station',
    crimeType: 'Money Laundering',
    date: '2026-08-15',
    location: 'Juhu, Andheri West',
    city: 'Mumbai',
    complainant: 'Manoj Tiwari',
    complainantPersonId: 'PERSON-023',
    ocrText: `FIRST INFORMATION REPORT
(Under Section 154 Cr.P.C.)

District: Mumbai Suburban
P.S.: Juhu Police Station
Year: 2026
FIR No.: 0102/2026
Date: 15-08-2026

Acts & Sections: IPC 420, 467, 468, 471 r/w 120(B)
Prevention of Money Laundering Act, 2002 — Sections 3, 4

1. COMPLAINANT:
Name: Shri Manoj Tiwari
S/o: Shri Ramesh Tiwari
Address: 52 Hazratganj, New Delhi — 110001
Occupation: Property Dealer
Phone: +91 98110 02330

2. OCCURRENCE OF OFFENCE:
Date From: 01-01-2026    Date To: 15-08-2026
Time Period: Day
Place: 22 Juhu Tara Road, Juhu, Mumbai — 400049
       55 FC Road, Deccan, Pune — 411004

3. TYPE OF INFORMATION: Written

4. BRIEF FACTS:
The complainant states that he entered into a property purchase agreement with M/s Nexus Trading Corp (Registered Office: 22 Juhu Tara Road, Juhu, Mumbai) represented by one Shri Aarav Mehta (Director) for purchase of commercial property at Versova Business Centre, Mumbai for a consideration of Rs. 4,70,00,000/- (Rupees Four Crore Seventy Lakhs).

The complainant paid an advance of Rs. 95,00,000/- (Rupees Ninety Five Lakhs) by account transfer to M/s Nexus Trading Corp. Upon investigation by the complainant, it was discovered that:

(a) The property at Versova was previously sold to another entity, M/s Horizon Digital Solutions, allegedly controlled by one Smt. Nisha Kapoor.

(b) M/s Nexus Trading Corp appears to be a shell company with minimal legitimate business operations. Company registration records show Shri Aarav Mehta and Shri Vikram Sharma as directors.

(c) The complainant's advance amount was transferred through multiple entities including M/s AM Consultancy Services, M/s Apex Financial Services (Pune), and M/s GlobalProp Realty Pvt Ltd (Pune).

(d) Transport of documents was facilitated through vehicles registered under the name of one Shri Ravi Thakur of Pune, associated with M/s GlobalProp Realty.

(e) Suspicious cash deposits were observed in accounts linked to Shri Vikram Sharma and M/s Westline Logistics Ltd.

The complainant believes this constitutes a well-organized fraudulent scheme involving multiple entities and individuals operating across Mumbai, Pune, and Delhi.

Vehicles observed: Mercedes-Benz E-Class (MH-01-AM-4400), Toyota Innova Crysta (MH-01-VS-2400), Tata LPT 1613 (MH-12-RT-2000).

Phone numbers in communication: +91 98201 01421, +91 98201 02128

5. DETAILS OF KNOWN/SUSPECTED/UNKNOWN ACCUSED:
(i) Shri Aarav Mehta, Age ~39, R/o Juhu Tara Road, Mumbai — Director, Nexus Trading Corp
(ii) Shri Vikram Sharma, Age ~41, R/o Carter Road, Bandra — Director, Nexus Trading Corp
(iii) Smt. Nisha Kapoor, Age ~32, R/o Versova, Mumbai — Associated entity
(iv) Shri Ravi Thakur, Age ~44, R/o FC Road, Pune — Transport/Logistics
(v) Other unknown associates

6. TOTAL VALUE OF PROPERTY STOLEN/INVOLVED:
Rs. 4,70,00,000/- (Rupees Four Crore Seventy Lakhs)

7. ACTION TAKEN:
FIR registered. Investigation handed to DCP R. Sharma, Economic Offences Wing.

Signature of Officer:
DCP R. Sharma
Badge No.: DCP/MUM/2019/0456
Date: 15-08-2026`,
    extractedEntities: {
      people: [
        { name: 'Aarav Mehta', role: 'Suspect / Director', confidence: 97 },
        { name: 'Vikram Sharma', role: 'Suspect / Director', confidence: 96 },
        { name: 'Nisha Kapoor', role: 'Associated Entity', confidence: 91 },
        { name: 'Ravi Thakur', role: 'Associated Entity', confidence: 89 },
        { name: 'Manoj Tiwari', role: 'Complainant', confidence: 99 },
        { name: 'Divya Saxena', role: 'Potential Associate', confidence: 72 },
      ],
      vehicles: [
        { description: 'Mercedes-Benz E-Class', registration: 'MH-01-AM-4400', confidence: 95 },
        { description: 'Toyota Innova Crysta', registration: 'MH-01-VS-2400', confidence: 94 },
        { description: 'Tata LPT 1613', registration: 'MH-12-RT-2000', confidence: 92 },
      ],
      phones: [
        { number: '+91 98201 01421', context: 'Communication with Nexus Trading', confidence: 93 },
        { number: '+91 98201 02128', context: 'Communication with associates', confidence: 91 },
      ],
      locations: [
        { name: '22 Juhu Tara Road, Juhu, Mumbai', type: 'Business/Office', confidence: 98 },
        { name: '55 FC Road, Deccan, Pune', type: 'Business/Office', confidence: 95 },
        { name: 'Versova Business Centre, Mumbai', type: 'Property', confidence: 96 },
        { name: 'Carter Road, Bandra', type: 'Residence', confidence: 88 },
      ],
      organizations: [
        { name: 'Nexus Trading Corp', type: 'Shell Company', confidence: 97 },
        { name: 'Horizon Digital Solutions', type: 'Business', confidence: 91 },
        { name: 'AM Consultancy Services', type: 'Shell Company', confidence: 85 },
        { name: 'Apex Financial Services', type: 'Financial', confidence: 88 },
        { name: 'GlobalProp Realty Pvt Ltd', type: 'Business', confidence: 92 },
        { name: 'Westline Logistics Ltd', type: 'Business', confidence: 86 },
      ],
      dates: [
        { date: '2026-01-01', context: 'Start of alleged fraud period', confidence: 95 },
        { date: '2026-08-15', context: 'FIR filing date', confidence: 99 },
      ],
      transactions: [
        { amount: '₹4,70,00,000', context: 'Total property consideration', confidence: 98 },
        { amount: '₹95,00,000', context: 'Advance payment', confidence: 97 },
      ],
    },
    aiAnalysis: {
      summary: 'This FIR describes a sophisticated property fraud scheme involving shell companies, circular fund routing, and multiple individuals operating across Mumbai, Pune, and Delhi. The complaint alleges fraudulent property dealings through Nexus Trading Corp, with funds routed through at least 4 connected entities. The pattern suggests organized financial fraud with elements potentially constituting money laundering under PMLA 2002.',
      crimeClassification: [
        { type: 'Financial Fraud / Cheating', confidence: 94 },
        { type: 'Money Laundering', confidence: 88 },
        { type: 'Forgery', confidence: 72 },
        { type: 'Criminal Conspiracy', confidence: 85 },
      ],
      keyEntities: [
        { name: 'Aarav Mehta', type: 'Person', relevance: 'Primary person of interest — Director of Nexus Trading Corp, named in fraud complaint' },
        { name: 'Vikram Sharma', type: 'Person', relevance: 'Co-director of Nexus Trading Corp, potential coordination with fund routing' },
        { name: 'Nexus Trading Corp', type: 'Organization', relevance: 'Central entity — suspected shell company used for property fraud' },
        { name: 'Nisha Kapoor', type: 'Person', relevance: 'Connected through Horizon Digital Solutions and Versova property' },
      ],
      importantLocations: [
        { name: 'Juhu Tara Road, Mumbai', significance: 'Registered office of Nexus Trading Corp — primary operational base' },
        { name: 'FC Road, Pune', significance: 'Secondary operational location — fund routing through Pune entities' },
        { name: 'Versova Business Centre', significance: 'Subject property — allegedly sold to multiple parties' },
      ],
      importantDates: [
        { date: '2026-01-01', significance: 'Alleged start of fraudulent activity period' },
        { date: '2026-08-15', significance: 'FIR registration date' },
      ],
      potentialRelationships: [
        { entity1: 'Aarav Mehta', entity2: 'Vikram Sharma', basis: 'Co-directors of Nexus Trading Corp, shared organizational affiliation', confidence: 82 },
        { entity1: 'Nexus Trading Corp', entity2: 'Horizon Digital Solutions', basis: 'Property transaction overlap at Versova Business Centre', confidence: 76 },
        { entity1: 'Aarav Mehta', entity2: 'Ravi Thakur', basis: 'Document transport facilitation through GlobalProp Realty', confidence: 68 },
        { entity1: 'Vikram Sharma', entity2: 'Westline Logistics', basis: 'Suspicious cash deposits in linked accounts', confidence: 74 },
      ],
      historicalMatches: [
        { caseId: 'CASE-087', similarity: 89, reason: 'Westside Financial Fraud Ring (2023) — shared entities (Mehta, Sharma), similar methodology, overlapping locations' },
        { caseId: 'HC-003', similarity: 74, reason: 'Pune Real Estate Scam (2024) — similar property fraud methodology in Pune' },
      ],
      patternIndicators: [
        { pattern: 'Shell Company Network', confidence: 88, description: 'Multiple entities with minimal operations used for fund routing — characteristic of layering in money laundering' },
        { pattern: 'Circular Fund Flow', confidence: 82, description: 'Funds routed through chain of entities before partial return — indicative of structured laundering' },
        { pattern: 'Multi-Jurisdiction Operation', confidence: 79, description: 'Operations spanning Mumbai, Pune, and Delhi — typical of sophisticated fraud networks' },
        { pattern: 'Document Fraud', confidence: 71, description: 'Potential use of forged or duplicate property documents for same property' },
      ],
    },
  },
];

// ============================================================
// CITIZEN COMPLAINTS (MOCK DATA)
// ============================================================
import type { CitizenComplaint, LiveEvent, LiveSubject } from '@/types';

export const citizenComplaints: CitizenComplaint[] = [
  {
    id: 'CMP-2026-0102',
    complainantName: 'Manoj Tiwari',
    phone: '+91 98200 11223',
    email: 'manoj.tiwari@corpmail.in',
    crimeType: 'Fraud',
    description: 'Fraudulent inducement regarding property purchase at Juhu Tara Road. Paid advance of Rs 95 Lakh to Nexus Trading Corp, directors subsequently untraceable.',
    location: 'Juhu Tara Road, Juhu',
    city: 'Mumbai',
    date: '2026-08-14',
    time: '14:30',
    status: 'Converted to FIR',
    evidenceFiles: ['bank_statement_aug.pdf', 'agreement_copy_juhu.pdf'],
    assignedStation: 'Juhu Police Station',
    convertedFirId: 'FIR-2026-0102',
    convertedCaseId: 'CASE-102',
    investigatorNotes: [
      { date: '2026-08-14 16:00', officer: 'DCP R. Sharma', note: 'Initial verification conducted. Financial transactions corroborate bank debit.' },
      { date: '2026-08-15 10:15', officer: 'ACP V. Patil', note: 'Complaint converted to cognizable FIR-2026-0102 under IPC 420/467/471 r/w 120(B).' },
    ],
  },
  {
    id: 'CMP-2026-0891',
    complainantName: 'Rajesh Bansal',
    phone: '+91 98765 43210',
    email: 'rbansal@gmail.com',
    crimeType: 'Vehicle Theft',
    description: 'Silver Hyundai Creta stolen from outside residential premises in Andheri East between 22:00 and 06:00.',
    location: 'Chakala, Andheri East',
    city: 'Mumbai',
    date: '2026-09-02',
    time: '08:15',
    status: 'Under Verification',
    evidenceFiles: ['rc_copy_creta.pdf', 'cctv_residential_gate.mp4'],
    assignedStation: 'Andheri East PS',
    investigatorNotes: [
      { date: '2026-09-02 11:30', officer: 'SI M. Khan', note: 'CCTV footage requisitioned from adjacent housing society.' },
    ],
  },
  {
    id: 'CMP-2026-0904',
    complainantName: 'Ananya Sengupta',
    phone: '+91 98310 98765',
    email: 'ananya.s@techconsult.com',
    crimeType: 'Cybercrime',
    description: 'Unauthorized debit of Rs 4,50,000 via fake customs clearing SMS link pretending to be courier delivery agent.',
    location: 'Hinjewadi Phase 1',
    city: 'Pune',
    date: '2026-09-03',
    time: '09:45',
    status: 'Verified',
    evidenceFiles: ['phishing_sms_screenshot.png', 'bank_dispute_form.pdf'],
    assignedStation: 'Hinjewadi Cyber Cell',
    investigatorNotes: [
      { date: '2026-09-03 11:00', officer: 'DI P. Reddy', note: 'Mule account frozen at receiving bank. Originating IP traced to proxy server.' },
    ],
  },
  {
    id: 'CMP-2026-0912',
    complainantName: 'Deepak Chawla',
    phone: '+91 98111 22334',
    email: 'deepak.c@builders.co',
    crimeType: 'Extortion',
    description: 'Threatening WhatsApp calls demanding protection money of Rs 25 Lakh for construction site in Dwarka Sector 12.',
    location: 'Dwarka Sector 12',
    city: 'Delhi',
    date: '2026-09-01',
    time: '19:20',
    status: 'Investigation',
    evidenceFiles: ['call_recording_audio.m4a', 'whatsapp_transcript.pdf'],
    assignedStation: 'Dwarka South PS',
    convertedCaseId: 'CASE-004',
    investigatorNotes: [
      { date: '2026-09-01 21:00', officer: 'CI A. Nair', note: 'VoIP call originates from virtual number pool. Cell tower triangulation initiated.' },
    ],
  },
];

// ============================================================
// LIVE MONITORING SIMULATION SEED DATA
// ============================================================
export const liveEventsSeed: LiveEvent[] = [
  {
    id: 'LIVE-001',
    timestamp: '18:41:02',
    type: 'Vehicle Detected',
    entityId: 'VEHICLE-044',
    entityType: 'Vehicle',
    title: 'ANPR Camera Ping: Black Fortuner MH-02-CD-4411',
    details: 'Vehicle observed passing Khalapur Toll Plaza towards Pune at 98 km/h. Optical match 99.1%.',
    location: 'Khalapur Toll Plaza, Mumbai-Pune Expressway',
    city: 'Mumbai-Pune Corridor',
    coordinates: [18.8105, 73.2845],
    severity: 'warning',
  },
  {
    id: 'LIVE-002',
    timestamp: '18:41:27',
    type: 'CCTV Observation',
    entityId: 'PERSON-014',
    entityType: 'Person',
    title: 'Facial Recognition Trigger: Aarav Mehta',
    details: 'Subject entered parking concourse of Versova Business Centre. Facial match confidence 94.6%.',
    location: 'Versova Business Centre, Andheri West',
    city: 'Mumbai',
    coordinates: [19.1319, 72.8258],
    severity: 'warning',
  },
  {
    id: 'LIVE-003',
    timestamp: '18:41:55',
    type: 'Location Change',
    entityId: 'PERSON-021',
    entityType: 'Person',
    title: 'Cell Tower Handover: Vikram Sharma',
    details: 'Registered device moved from Juhu sector tower to Bandra West sector cell.',
    location: 'Bandra West, Mumbai',
    city: 'Mumbai',
    coordinates: [19.0596, 72.8295],
    severity: 'info',
  },
  {
    id: 'LIVE-004',
    timestamp: '18:42:15',
    type: 'Anomaly Detected',
    entityId: 'PERSON-014',
    entityType: 'Person',
    title: 'Sentinel Trajectory Anomaly Triggered',
    details: 'Subject departing residence during non-baseline circadian window. Anomaly score computed: 0.87.',
    location: 'Juhu Tara Road, Mumbai',
    city: 'Mumbai',
    coordinates: [19.0988, 72.8267],
    severity: 'critical',
  },
  {
    id: 'LIVE-005',
    timestamp: '18:42:38',
    type: 'New Relationship',
    entityId: 'CASE-102',
    entityType: 'Case',
    title: 'Automated Graph Co-occurrence Path',
    details: 'Common IP address detected across Nexus Trading banking portal and Westline Logistics terminal.',
    location: 'Nariman Point, Mumbai',
    city: 'Mumbai',
    coordinates: [18.9256, 72.8242],
    severity: 'info',
  },
  {
    id: 'LIVE-006',
    timestamp: '18:43:02',
    type: 'Evidence Received',
    entityId: 'EVIDENCE-056',
    entityType: 'Evidence',
    title: 'CDR Batch Ingested: 342 Telephony Logs',
    details: 'Telecom provider CDR dump received and cryptographically verified under SHA-256 seal.',
    location: 'Crime Branch Cyber Cell, Mumbai',
    city: 'Mumbai',
    coordinates: [18.9400, 72.8350],
    severity: 'info',
  },
];

export const liveSubjectSeed: LiveSubject = {
  personId: 'PERSON-014',
  name: 'Aarav Mehta',
  status: 'ALERT',
  currentLocation: 'Versova Business Centre, Andheri West, Mumbai',
  lastObservationTime: '18:41:27 IST',
  vehicleId: 'VEHICLE-044 (MH-02-CD-4411)',
  associatedEntities: ['PERSON-021', 'ORG-014', 'ORG-015', 'VEHICLE-044'],
  anomalyScore: 0.87,
  alertsCount: 4,
  caseId: 'CASE-102',
};

