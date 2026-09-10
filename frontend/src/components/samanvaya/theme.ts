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
    name: 'Step 1 - Read the case',
    shortName: 'SOOCHNA',
    sanskritName: 'SOOCHNA / SANGRAHA',
    role: 'Reads the FIR and pulls the records that matter',
    purpose:
      'Reads the FIR, collects the linked records, and throws away the ones that have nothing to do with this case.',
    icon: Database,
    color: '#12376E',
    soft: 'rgba(18, 55, 110, 0.08)',
    ring: 'rgba(18, 55, 110, 0.28)',
  },
  {
    agentId: 'agent-2',
    agentNumber: 2,
    name: 'Step 2 - Work out who is who',
    shortName: 'ABHIJNANA',
    sanskritName: 'ABHIJNANA',
    role: 'Matches the same person across different records',
    purpose:
      'Decides when two names, phone numbers or vehicles in different files are the same one. Also flags anyone who appears in older cases.',
    icon: Users,
    color: '#12376E',
    soft: 'rgba(18, 55, 110, 0.08)',
    ring: 'rgba(18, 55, 110, 0.28)',
  },
  {
    agentId: 'agent-3',
    agentNumber: 3,
    name: 'Step 3 - Build the link chart',
    shortName: 'SUTRA',
    sanskritName: 'SUTRA',
    role: 'Draws how everyone and everything is connected',
    purpose:
      'Draws the link chart from evidence only, then works out who sits at the centre and which people form a group.',
    icon: Share2,
    color: '#12376E',
    soft: 'rgba(18, 55, 110, 0.08)',
    ring: 'rgba(18, 55, 110, 0.28)',
  },
  {
    agentId: 'agent-4',
    agentNumber: 4,
    name: 'Step 4 - Compare with old cases',
    shortName: 'ITIHAS',
    sanskritName: 'ITIHAS / SMRITI',
    role: 'Looks for older cases done the same way',
    purpose:
      'Searches past cases for the same method, the same places and the same people.',
    icon: History,
    color: '#12376E',
    soft: 'rgba(18, 55, 110, 0.08)',
    ring: 'rgba(18, 55, 110, 0.28)',
  },
  {
    agentId: 'agent-5',
    agentNumber: 5,
    name: 'Step 5 - Write the report',
    shortName: 'REPORT',
    sanskritName: 'SAMANVAYA / VYAKHYA',
    role: 'Puts it all together into one report',
    purpose:
      'Combines all four steps into clear findings, what to do next, what evidence is still missing, and the final report.',
    icon: Sparkles,
    color: '#12376E',
    soft: 'rgba(18, 55, 110, 0.08)',
    ring: 'rgba(18, 55, 110, 0.28)',
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
  CASE: { color: '#12376E', soft: 'rgba(67, 56, 202, 0.12)', icon: Shield, label: 'Case' },
  BRANCH: { color: '#12376E', soft: 'rgba(79, 70, 229, 0.10)', icon: Compass, label: 'Branch' },
  PERSON: { color: '#2563EB', soft: 'rgba(37, 99, 235, 0.12)', icon: User, label: 'Person' },
  SUSPECT: { color: '#DC2626', soft: 'rgba(220, 38, 38, 0.12)', icon: User, label: 'Suspect' },
  ALIAS: { color: '#5B4BC4', soft: 'rgba(124, 58, 237, 0.12)', icon: Fingerprint, label: 'Alias' },
  PHONE: { color: '#5B4BC4', soft: 'rgba(124, 58, 237, 0.12)', icon: Phone, label: 'Phone' },
  COMMUNICATION: { color: '#5B4BC4', soft: 'rgba(124, 58, 237, 0.12)', icon: Phone, label: 'Communication' },
  LOCATION: { color: '#D97706', soft: 'rgba(234, 88, 12, 0.12)', icon: MapPin, label: 'Location' },
  INCIDENT: { color: '#D97706', soft: 'rgba(234, 88, 12, 0.12)', icon: AlertTriangle, label: 'Incident' },
  VEHICLE: { color: '#16A34A', soft: 'rgba(22, 163, 74, 0.12)', icon: Car, label: 'Vehicle' },
  FINANCIAL: { color: '#0F766E', soft: 'rgba(15, 118, 110, 0.12)', icon: Landmark, label: 'Financial' },
  ORGANIZATION: { color: '#0F766E', soft: 'rgba(8, 145, 178, 0.12)', icon: Landmark, label: 'Organisation' },
  EVIDENCE: { color: '#4B5563', soft: 'rgba(75, 85, 99, 0.12)', icon: FileText, label: 'Evidence' },
  HISTORICAL: { color: '#5B4BC4', soft: 'rgba(147, 51, 234, 0.12)', icon: History, label: 'Historical' },
  HISTORICAL_CASE: { color: '#5B4BC4', soft: 'rgba(147, 51, 234, 0.12)', icon: History, label: 'Historical case' },
  RELATIONSHIP: { color: '#0F766E', soft: 'rgba(8, 145, 178, 0.12)', icon: Link2, label: 'Relationship' },
  LEAD: { color: '#2563EB', soft: 'rgba(14, 165, 233, 0.12)', icon: Compass, label: 'Lead' },
};

const FALLBACK_TYPE: TypeStyle = {
  color: '#9CA3AF',
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
  HIGH: '#D97706',
  MEDIUM: '#D97706',
  LOW: '#0F766E',
};

export const CLASSIFICATION_COLORS: Record<string, string> = {
  VERIFIED: '#16A34A',
  SUPPORTED: '#2563EB',
  POTENTIAL: '#D97706',
  'INSUFFICIENT DATA': '#DC2626',
};

export const DATA_SOURCE_STATE: Record<string, { color: string; label: string }> = {
  CONNECTED: { color: '#16A34A', label: 'Connected' },
  UPLOADED: { color: '#16A34A', label: 'Uploaded' },
  PROCESSING: { color: '#2563EB', label: 'Processing' },
  AWAITING_AUTHORIZATION: { color: '#D97706', label: 'Awaiting authorisation' },
  NOT_AVAILABLE: { color: '#9CA3AF', label: 'Not available' },
  ERROR: { color: '#DC2626', label: 'Error' },
};

export const TELEMETRY_COLORS: Record<string, string> = {
  INFO: '#9CA3AF',
  WORK: '#2563EB',
  OK: '#16A34A',
  WARN: '#D97706',
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
