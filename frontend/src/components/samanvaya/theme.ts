// ============================================================
// SAMANVAYA — shared visual language
//
// Colour carries meaning here, so every hue below is bound to a
// concept (an agent, an entity type, a severity) rather than picked
// for decoration. Surfaces use the app's CSS variables so the page
// reads correctly in both the light and dark themes.
// ============================================================

import {
  Database,
  Users,
  Share2,
  History,
  Sparkles,
  Shield,
  User,
  Phone,
  MapPin,
  Car,
  Landmark,
  FileText,
  Compass,
  Link2,
  AlertTriangle,
  Fingerprint,
  type LucideIcon,
} from 'lucide-react';

export interface AgentIdentity {
  agentId: string;
  agentNumber: number;
  name: string;
  shortName: string;
  sanskritName: string;
  role: string;
  purpose: string;
  icon: LucideIcon;
  color: string;
  soft: string;
  ring: string;
}

/** The five agents, each with a fixed identity colour used everywhere. */
export const AGENTS: AgentIdentity[] = [
  {
    agentId: 'agent-1',
    agentNumber: 1,
    name: 'Case Context & Relevance',
    shortName: 'SOOCHNA',
    sanskritName: 'SOOCHNA / SANGRAHA',
    role: 'Reads the case, retrieves records, discards noise',
    purpose:
      'Parses the FIR, pulls the connected datasets, filters out irrelevant records and surfaces the evidence worth analysing.',
    icon: Database,
    color: '#2563EB',
    soft: 'rgba(37, 99, 235, 0.10)',
    ring: 'rgba(37, 99, 235, 0.34)',
  },
  {
    agentId: 'agent-2',
    agentNumber: 2,
    name: 'Entity & Identity Intelligence',
    shortName: 'ABHIJNANA',
    sanskritName: 'ABHIJNANA',
    role: 'Resolves who is who',
    purpose:
      'Disambiguates people, phones, vehicles and addresses; resolves aliases and flags entities recurring in prior cases.',
    icon: Users,
    color: '#7C3AED',
    soft: 'rgba(124, 58, 237, 0.10)',
    ring: 'rgba(124, 58, 237, 0.34)',
  },
  {
    agentId: 'agent-3',
    agentNumber: 3,
    name: 'Network & Relationship',
    shortName: 'SUTRA',
    sanskritName: 'SUTRA',
    role: 'Builds the criminal network',
    purpose:
      'Constructs the evidence-backed relationship graph, computes centrality and identifies sub-networks.',
    icon: Share2,
    color: '#4F46E5',
    soft: 'rgba(79, 70, 229, 0.10)',
    ring: 'rgba(79, 70, 229, 0.34)',
  },
  {
    agentId: 'agent-4',
    agentNumber: 4,
    name: 'Historical & Pattern Intelligence',
    shortName: 'ITIHAS',
    sanskritName: 'ITIHAS / SMRITI',
    role: 'Matches modus operandi against the archive',
    purpose:
      'Searches the historical case archive for matching modus operandi, repeated locations and known associates.',
    icon: History,
    color: '#EA580C',
    soft: 'rgba(234, 88, 12, 0.10)',
    ring: 'rgba(234, 88, 12, 0.34)',
  },
  {
    agentId: 'agent-5',
    agentNumber: 5,
    name: 'Investigative Synthesis',
    shortName: 'SAMANVAYA',
    sanskritName: 'SAMANVAYA / VYAKHYA',
    role: 'Synthesises everything into a dossier',
    purpose:
      'Merges all four streams into classified findings, ranked leads, evidence gaps and the official dossier.',
    icon: Sparkles,
    color: '#059669',
    soft: 'rgba(5, 150, 105, 0.10)',
    ring: 'rgba(5, 150, 105, 0.34)',
  },
];

export const agentByNumber = (n: number) => AGENTS.find((a) => a.agentNumber === n) || AGENTS[0];

// ── Entity / node types ──────────────────────────────────────
export interface TypeStyle {
  color: string;
  soft: string;
  icon: LucideIcon;
  label: string;
}

const TYPE_STYLES: Record<string, TypeStyle> = {
  CASE: { color: '#4338CA', soft: 'rgba(67, 56, 202, 0.12)', icon: Shield, label: 'Case' },
  BRANCH: { color: '#4F46E5', soft: 'rgba(79, 70, 229, 0.10)', icon: Compass, label: 'Branch' },
  PERSON: { color: '#2563EB', soft: 'rgba(37, 99, 235, 0.12)', icon: User, label: 'Person' },
  SUSPECT: { color: '#DC2626', soft: 'rgba(220, 38, 38, 0.12)', icon: User, label: 'Suspect' },
  ALIAS: { color: '#7C3AED', soft: 'rgba(124, 58, 237, 0.12)', icon: Fingerprint, label: 'Alias' },
  PHONE: { color: '#7C3AED', soft: 'rgba(124, 58, 237, 0.12)', icon: Phone, label: 'Phone' },
  COMMUNICATION: { color: '#7C3AED', soft: 'rgba(124, 58, 237, 0.12)', icon: Phone, label: 'Communication' },
  LOCATION: { color: '#EA580C', soft: 'rgba(234, 88, 12, 0.12)', icon: MapPin, label: 'Location' },
  INCIDENT: { color: '#EA580C', soft: 'rgba(234, 88, 12, 0.12)', icon: AlertTriangle, label: 'Incident' },
  VEHICLE: { color: '#16A34A', soft: 'rgba(22, 163, 74, 0.12)', icon: Car, label: 'Vehicle' },
  FINANCIAL: { color: '#CA8A04', soft: 'rgba(202, 138, 4, 0.14)', icon: Landmark, label: 'Financial' },
  ORGANIZATION: { color: '#0891B2', soft: 'rgba(8, 145, 178, 0.12)', icon: Landmark, label: 'Organisation' },
  EVIDENCE: { color: '#DB2777', soft: 'rgba(219, 39, 119, 0.12)', icon: FileText, label: 'Evidence' },
  HISTORICAL: { color: '#9333EA', soft: 'rgba(147, 51, 234, 0.12)', icon: History, label: 'Historical' },
  HISTORICAL_CASE: { color: '#9333EA', soft: 'rgba(147, 51, 234, 0.12)', icon: History, label: 'Historical case' },
  RELATIONSHIP: { color: '#0891B2', soft: 'rgba(8, 145, 178, 0.12)', icon: Link2, label: 'Relationship' },
  LEAD: { color: '#0EA5E9', soft: 'rgba(14, 165, 233, 0.12)', icon: Compass, label: 'Lead' },
};

const FALLBACK_TYPE: TypeStyle = {
  color: '#64748B',
  soft: 'rgba(100, 116, 139, 0.12)',
  icon: FileText,
  label: 'Item',
};

/** Resolve a node/entity type string to its colour and icon. */
export function typeStyle(type?: string | null): TypeStyle {
  if (!type) return FALLBACK_TYPE;
  const key = type.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (TYPE_STYLES[key]) return TYPE_STYLES[key];
  const lower = key.toLowerCase();
  if (lower.includes('suspect') || lower.includes('accused')) return TYPE_STYLES.SUSPECT;
  if (lower.includes('person') || lower.includes('victim') || lower.includes('witness')) return TYPE_STYLES.PERSON;
  if (lower.includes('phone') || lower.includes('call') || lower.includes('telecom')) return TYPE_STYLES.PHONE;
  if (lower.includes('location') || lower.includes('address') || lower.includes('area')) return TYPE_STYLES.LOCATION;
  if (lower.includes('vehicle') || lower.includes('car')) return TYPE_STYLES.VEHICLE;
  if (lower.includes('bank') || lower.includes('financ') || lower.includes('money')) return TYPE_STYLES.FINANCIAL;
  if (lower.includes('hist') || lower.includes('prior') || lower.includes('precedent')) return TYPE_STYLES.HISTORICAL;
  if (lower.includes('lead') || lower.includes('action')) return TYPE_STYLES.LEAD;
  if (lower.includes('evidence') || lower.includes('gap')) return TYPE_STYLES.EVIDENCE;
  if (lower.includes('case')) return TYPE_STYLES.CASE;
  return FALLBACK_TYPE;
}

// ── Severity / classification ────────────────────────────────
export const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#DC2626',
  HIGH: '#EA580C',
  MEDIUM: '#CA8A04',
  LOW: '#0891B2',
};

export const CLASSIFICATION_COLORS: Record<string, string> = {
  VERIFIED: '#059669',
  SUPPORTED: '#2563EB',
  POTENTIAL: '#CA8A04',
  'INSUFFICIENT DATA': '#DC2626',
};

export const DATA_SOURCE_STATE: Record<string, { color: string; label: string }> = {
  CONNECTED: { color: '#059669', label: 'Connected' },
  UPLOADED: { color: '#059669', label: 'Uploaded' },
  PROCESSING: { color: '#2563EB', label: 'Processing' },
  AWAITING_AUTHORIZATION: { color: '#CA8A04', label: 'Awaiting authorisation' },
  NOT_AVAILABLE: { color: '#94A3B8', label: 'Not available' },
  ERROR: { color: '#DC2626', label: 'Error' },
};

export const TELEMETRY_COLORS: Record<string, string> = {
  INFO: '#64748B',
  WORK: '#2563EB',
  OK: '#059669',
  WARN: '#EA580C',
  ERROR: '#DC2626',
};

/** Blend a hex colour with the surface at the given alpha. */
export function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const fmt = (n: number) => n.toLocaleString('en-IN');
export const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;
