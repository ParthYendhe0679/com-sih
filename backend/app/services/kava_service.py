"""KAVA AI — Case-Grounded Investigative Intelligence Service.

Orchestrates:
  1. Intent analysis on the investigator's question.
  2. Selective retrieval from PostgreSQL (case, FIR, entities, relationships, evidence).
  3. Redis cache lookups for SAMANVAYA dossier and CDR analysis.
  4. Prompt construction with strict grounding instructions.
  5. Gemini (or fallback) generation via the existing AIService.
  6. Structured response with sources and context stats.
"""

import json
import re
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.schemas.ai import AIRequest, TaskType
from app.ai.services.ai_service import AIService, ai_service as default_ai_service
from app.ai_ml.models.ai_models import Entity
from app.core.logging import get_logger
from app.models.case import Case
from app.models.data_architecture import CaseEntityContext, EntityRelationship
from app.models.evidence import Evidence
from app.models.fir import FIR
from app.services.cache_service import CacheService, cache_service as default_cache

logger = get_logger("kritagas.kava.service")

# ── Redis key helpers ────────────────────────────────────────────────────────
def _kava_context_key(case_id: str) -> str:
    return f"kava:context:{case_id}"

def _samanvaya_result_key(case_id: str) -> str:
    return f"samanvaya:result:{case_id}"

def _samanvaya_cdr_key(case_id: str) -> str:
    return f"samanvaya:cdr:{case_id}"

KAVA_CONTEXT_TTL = 600  # 10 minutes


# ── Intent detection ─────────────────────────────────────────────────────────
_INTENT_SUSPECTS   = re.compile(r"\b(suspect|accused|person|people|who|identify|perpetrator|culprit|offender)\b", re.I)
_INTENT_CALLS      = re.compile(r"\b(call|cdr|communication|phone|contact|number|sms|rang|spoke)\b", re.I)
_INTENT_NETWORK    = re.compile(r"\b(network|connect|graph|relation|link|hub|central|cluster|association|path)\b", re.I)
_INTENT_TIMELINE   = re.compile(r"\b(timeline|when|before|after|hour|day|time|sequence|chronolog|event)\b", re.I)
_INTENT_HISTORY    = re.compile(r"\b(histor|similar|pattern|modus|precedent|past|previous|repeat)\b", re.I)
_INTENT_AGENTS     = re.compile(r"\b(agent|samanvaya|soochna|abhijnana|sutra|itihas|vyakhya|discover|found)\b", re.I)
_INTENT_EVIDENCE   = re.compile(r"\b(evidence|exhibit|document|photo|video|proof|forensic|sample)\b", re.I)
_INTENT_SUMMARY    = re.compile(r"\b(summary|summarize|overview|brief|report|overall|everything|all)\b", re.I)
_INTENT_GEO        = re.compile(r"\b(location|map|place|where|geo|area|region|station|scene|locus)\b", re.I)


def _detect_intent(question: str) -> List[str]:
    intents = []
    if _INTENT_SUMMARY.search(question):   intents.append("summary")
    if _INTENT_SUSPECTS.search(question):  intents.append("entities")
    if _INTENT_CALLS.search(question):     intents.append("cdr")
    if _INTENT_NETWORK.search(question):   intents.append("network")
    if _INTENT_TIMELINE.search(question):  intents.append("timeline")
    if _INTENT_HISTORY.search(question):   intents.append("history")
    if _INTENT_AGENTS.search(question):    intents.append("agents")
    if _INTENT_EVIDENCE.search(question):  intents.append("evidence")
    if _INTENT_GEO.search(question):       intents.append("geo")
    if not intents:
        intents = ["general"]
    return list(dict.fromkeys(intents))  # deduplicate while preserving order


# ── KAVA System Prompt ────────────────────────────────────────────────────────
_SYSTEM_PROMPT = """You are KAVA AI, the Case-Grounded Investigative Intelligence Assistant inside the
KRITAGAS Criminal Network Intelligence Platform.

Your ONLY job is to help authorized investigators analyze the CURRENTLY ACTIVE investigation case.

ABSOLUTE RULES:
1. Never invent case facts, suspects, evidence, or events.
2. Never fabricate evidence or claim something is verified unless the provided context explicitly states it.
3. When information is not present in the provided context, say clearly: "No verified information is currently available in the active case data for this query."
4. Do NOT mix information from different cases.
5. Clearly distinguish VERIFIED FACTS (from FIR/evidence) from AI ANALYTICAL OBSERVATIONS.
6. Highlight uncertainty. Never express false confidence.
7. Do not provide final legal conclusions. The human investigator remains the decision-maker.
8. When possible, cite the source of every significant claim (e.g., "per FIR", "per Agent 2 — ABHIJNANA", "per Call Records").
9. Format responses clearly with section headers, bullet points, and source citations.
10. Be concise. Avoid padding. Every sentence must add investigative value."""


# ── In-Memory Intelligence Cache (5 min TTL) ──────────────────────────────────
_IN_MEMORY_INTEL_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
INTEL_CACHE_TTL = 300  # 5 minutes in memory


def invalidate_kava_cache(case_id: Optional[str] = None):
    """Purge in-memory KAVA intelligence cache for a case or globally."""
    global _IN_MEMORY_INTEL_CACHE
    if case_id:
        _IN_MEMORY_INTEL_CACHE.pop(str(case_id), None)
    else:
        _IN_MEMORY_INTEL_CACHE.clear()


# ── Context aggregation ───────────────────────────────────────────────────────

class KavaService:
    """Case-Grounded Conversational Intelligence Assistant (KAVA AI)."""

    def __init__(
        self,
        session: AsyncSession,
        cache: Optional[CacheService] = None,
        ai: Optional[AIService] = None,
    ):
        self.session = session
        self.cache = cache or default_cache
        self.ai = ai or default_ai_service

    # ── Public entry point ───────────────────────────────────────────────────

    async def ask(
        self,
        case_id: uuid.UUID,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Full KAVA pipeline: validate → retrieve → prompt → generate → return."""
        # 1. Validate case exists
        case = await self._get_case(case_id)
        if not case:
            return {
                "answer": "KAVA AI could not locate the specified case in the database. Please verify the case ID and try again.",
                "sources": [],
                "groundingLevel": "NONE",
                "contextStats": {},
            }

        # 2. Detect intent (flexible; never blocks the user)
        intents = _detect_intent(message)
        logger.info("KAVA query for case %s with intents %s: %s", case_id, intents, message)

        # 3. Build intelligence context with entity & pronoun resolution (cached <0.1ms)
        context, stats, sources = await self._build_context(case, intents, message, history or [])

        # 4. Build prompt incorporating conversation history
        prompt = self._build_prompt(case, context, message, history or [])

        # 5. Call AI (uses router default chain: Groq -> Gemini -> Local for sub-second latency)
        try:
            req = AIRequest(
                prompt=prompt,
                system_instruction=_SYSTEM_PROMPT,
                task_type=TaskType.TEXT_COMPLETION,
                preferred_provider=None,
                temperature=0.2,
                max_tokens=768,
            )
            envelope = await self.ai.generate_text(req)
            answer = envelope.text or "KAVA AI was unable to generate a response. Please retry."
            grounding = "FULL" if len(sources) >= 3 else ("PARTIAL" if sources else "LIMITED")
        except Exception as err:
            logger.error("KAVA AI generation failed: %s", err)
            answer = f"KAVA AI encountered an error during analysis: {err}. Please retry."
            grounding = "ERROR"

        return {
            "answer": answer,
            "sources": sources,
            "groundingLevel": grounding,
            "contextStats": stats,
            "intents": intents,
        }

    async def get_case_intelligence_context(self, case_id: uuid.UUID) -> Dict[str, Any]:
        """Consolidated intelligence context for API and UI status panel with 2-tier caching."""
        c_key = str(case_id)
        now = time.time()

        # 1. Fast in-memory cache check (<0.1ms)
        if c_key in _IN_MEMORY_INTEL_CACHE:
            ts, val = _IN_MEMORY_INTEL_CACHE[c_key]
            if now - ts < INTEL_CACHE_TTL:
                return val

        # 2. Valkey / Redis distributed cache (<5ms)
        v_key = _kava_context_key(c_key)
        try:
            raw = await self.cache.get(v_key)
            if raw:
                data = raw if isinstance(raw, dict) else json.loads(raw)
                _IN_MEMORY_INTEL_CACHE[c_key] = (now, data)
                return data
        except Exception:
            pass

        # 3. Fetch from database (only on initial cache miss)
        case = await self._get_case(case_id)
        if not case:
            return {"error": "Case not found"}
        fir = await self._get_fir(case.fir_id) if case.fir_id else None
        entities, rels = await self._get_entities_and_rels(case)
        evidence_items = await self._get_evidence_records(case.id)
        dossier = await self._get_samanvaya_dossier(case.id) or {}
        cdr = await self._get_cdr(case.id) or {}
        timeline = dossier.get("timeline", [])
        agents = dossier.get("agents", [])
        findings = dossier.get("findings", [])
        leads = dossier.get("leads", [])
        summary = dossier.get("investigationSummary", "")

        stats = {
            "caseNumber": case.case_number,
            "crimeCategory": case.crime_category,
            "caseStatus": str(case.status.value if hasattr(case.status, "value") else case.status),
            "evidenceCount": len(evidence_items),
            "entityCount": len(entities),
            "relationshipCount": len(rels),
            "timelineEvents": len(timeline),
            "agentCount": len(agents),
            "samanvayaComplete": bool(agents and len(agents) >= 5),
            "cdrRecords": cdr.get("parsedRecords", 0),
        }

        result = {
            "case": {
                "id": str(case.id),
                "case_number": case.case_number,
                "title": case.title,
                "crime_category": case.crime_category,
                "status": stats["caseStatus"],
                "priority": str(case.priority.value if hasattr(case.priority, "value") else case.priority),
                "police_station": case.police_station,
                "city": case.city,
                "incident_date": str(case.incident_date) if case.incident_date else None,
                "description": case.description,
            },
            "fir": {
                "fir_number": fir.fir_number,
                "title": fir.title,
                "incident_location": fir.incident_location,
                "description": fir.description,
            } if fir else None,
            "stats": stats,
            "entities": entities,
            "relationships": rels,
            "evidence": evidence_items,
            "timeline": timeline,
            "agents": agents,
            "findings": findings,
            "leads": leads,
            "summary": summary,
            "cdr": cdr,
        }

        # Populate in-memory and distributed caches
        _IN_MEMORY_INTEL_CACHE[c_key] = (now, result)
        try:
            await self.cache.set(v_key, json.dumps(result, default=str), ttl=KAVA_CONTEXT_TTL)
        except Exception:
            pass

        return result

    # ── Case fetch ────────────────────────────────────────────────────────────

    async def _get_case(self, case_id: uuid.UUID) -> Optional[Case]:
        stmt = select(Case).where(Case.id == case_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    # ── Context builder ───────────────────────────────────────────────────────

    async def _build_context(
        self,
        case: Case,
        intents: List[str],
        question: str = "",
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Tuple[str, Dict[str, Any], List[str]]:
        """Assemble a deep grounding context string from database + cache (leveraging fast memory cache)."""
        sections: List[str] = []
        sources: List[str] = []

        # 1. Fetch consolidated intelligence context (retrieved from memory cache in <0.1ms)
        intel = await self.get_case_intelligence_context(case.id)
        stats = intel.get("stats", {})

        # A. Case Record & FIR
        fir_dict = intel.get("fir")
        case_block = self._section_case(case, fir_dict)
        sections.append(case_block)
        sources.append("Case Record")
        if fir_dict:
            sources.append("FIR")

        # B. Entities & Relationships (Always loaded from real Entity table)
        entities = intel.get("entities", [])
        rels = intel.get("relationships", [])
        if entities:
            sections.append(self._section_entities(entities))
            sources.append("Entity Database")
        if rels:
            sections.append(self._section_relationships(rels))
            sources.append("Relationship Graph")

        # C. Evidence Records
        evidence_items = intel.get("evidence", [])
        if evidence_items:
            sections.append(self._section_evidence_items(evidence_items))
            sources.append("Evidence Records")

        # D. SAMANVAYA Dossier (Agents 1-5, Timeline, Graph, Synthesis)
        agents = intel.get("agents", [])
        timeline = intel.get("timeline", [])
        findings = intel.get("findings", [])
        leads = intel.get("leads", [])
        summary = intel.get("summary", "")

        dossier = {
            "agents": agents,
            "timeline": timeline,
            "findings": findings,
            "leads": leads,
            "investigationSummary": summary,
        }
        if agents:
            sections.append(self._section_agents(dossier))
            sources.append("SAMANVAYA Agent Pipeline")

        if timeline:
            sections.append(self._section_timeline(timeline))
            sources.append("Investigation Timeline")

        if summary or findings:
            sections.append(self._section_synthesis(summary, findings))

        # E. Call Detail Records (CDR)
        cdr = intel.get("cdr")
        if cdr and cdr.get("parsedRecords", 0) > 0:
            sections.append(self._section_cdr(cdr))
            sources.append("Call Detail Records")
            stats["cdrRecords"] = cdr.get("parsedRecords", 0)
        else:
            stats["cdrRecords"] = 0

        # F. Entity / Pronoun Resolution Spotlight
        target_entity = self._resolve_target_entity(question, history or [], entities)
        if target_entity:
            spotlight = self._section_entity_spotlight(target_entity, rels, cdr, dossier)
            if spotlight:
                sections.append(spotlight)

        context = "\n\n".join(sections)
        return context, stats, list(dict.fromkeys(sources))

    def _resolve_target_entity(
        self,
        question: str,
        history: List[Dict[str, str]],
        entities: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """Identify if an entity or pronoun is referenced to pull laser-focused dossier."""
        q_lower = question.lower()
        for ent in entities:
            name = ent.get("name", "").lower()
            if len(name) >= 3 and name in q_lower:
                return ent

        pronoun_pattern = re.compile(r"\b(he|him|his|she|her|they|them|this person|the suspect|the victim|main suspect)\b", re.I)
        if pronoun_pattern.search(question) and history:
            for turn in reversed(history[-4:]):
                content = turn.get("content", "").lower()
                for ent in entities:
                    name = ent.get("name", "").lower()
                    if len(name) >= 3 and name in content:
                        return ent

        return None

    def _section_entity_spotlight(
        self,
        ent: Dict[str, Any],
        rels: List[Dict[str, Any]],
        cdr: Optional[Dict[str, Any]],
        dossier: Optional[Dict[str, Any]],
    ) -> str:
        name = ent.get("name", "Unknown")
        lines = [
            f"## Targeted Investigative Spotlight: {name}",
            f"- Entity Type: {ent.get('type')}",
            f"- Designated Role: {ent.get('role')}",
            f"- Extraction Confidence: {ent.get('confidence', 1.0):.0%}",
        ]
        attrs = ent.get("attributes") or {}
        if attrs:
            for k, v in list(attrs.items())[:6]:
                lines.append(f"- {k.replace('_', ' ').title()}: {v}")

        linked_rels = [
            r for r in rels
            if name.lower() in str(r.get("source", "")).lower() or name.lower() in str(r.get("target", "")).lower()
        ]
        if linked_rels:
            lines.append("- Direct Network Connections:")
            for r in linked_rels[:6]:
                lines.append(f"  • {r.get('source')} —[{r.get('type')}]→ {r.get('target')} (confidence {r.get('confidence', 0.9):.0%})")

        if cdr:
            parties = cdr.get("parties", [])
            for p in parties:
                if name.lower() in str(p.get("name", "")).lower() or name.lower() in str(p.get("role", "")).lower():
                    lines.append(
                        f"- CDR Profile: {p.get('number')} ({p.get('totalCalls')} calls, "
                        f"peak {p.get('peakCallsPerDay', 0):.1f}/day)"
                    )
        return "\n".join(lines)

    def _section_evidence_items(self, evidence_items: List[Dict]) -> str:
        lines = [f"## Physical & Forensic Evidence ({len(evidence_items)} records)"]
        for ev in evidence_items[:12]:
            lines.append(
                f"- [{ev.get('evidence_type', 'EXHIBIT')}] {ev.get('title')}: {ev.get('description', '')[:200]}"
                + (f" (Collected: {ev.get('collected_at')})" if ev.get("collected_at") else "")
            )
        return "\n".join(lines)

    # ── DB helpers ────────────────────────────────────────────────────────────

    async def _get_fir(self, fir_id: uuid.UUID) -> Optional[FIR]:
        stmt = select(FIR).where(FIR.id == fir_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_entities_and_rels(
        self, case: Case
    ) -> Tuple[List[Dict], List[Dict]]:
        # Query Entity table directly matching case_id or fir_id
        conditions = [Entity.case_id == case.id]
        if case.fir_id:
            conditions.append(Entity.fir_id == case.fir_id)
        ent_stmt = select(Entity).where(or_(*conditions)).order_by(Entity.confidence.desc()).limit(100)
        ent_res = await self.session.execute(ent_stmt)
        raw_entities = list(ent_res.scalars().all())

        entity_map = {e.id: e.name for e in raw_entities}
        entities = []
        for ent in raw_entities:
            role = (ent.attributes_json or {}).get("role") or (
                "SUSPECT" if "suspect" in ent.name.lower() or (ent.attributes_json or {}).get("is_suspect")
                else ("VICTIM" if "victim" in ent.name.lower() or (ent.attributes_json or {}).get("is_victim")
                else "PERSON_OF_INTEREST")
            )
            entities.append({
                "id": str(ent.id),
                "name": ent.name,
                "type": ent.entity_type,
                "role": role,
                "confidence": ent.confidence,
                "normalized_value": ent.normalized_value,
                "attributes": ent.attributes_json or {},
            })

        # Query EntityRelationship table
        rel_stmt = select(EntityRelationship).where(EntityRelationship.case_id == case.id).limit(60)
        rel_res = await self.session.execute(rel_stmt)
        raw_rels = list(rel_res.scalars().all())
        rels = []
        for rel in raw_rels:
            rels.append({
                "source": entity_map.get(rel.source_entity_id, "Entity"),
                "target": entity_map.get(rel.target_entity_id, "Entity"),
                "type": rel.relationship_type,
                "confidence": rel.confidence,
                "status": rel.status,
            })

        # If rels is empty or sparse, merge from SAMANVAYA graph if available
        dossier = await self._get_samanvaya_dossier(case.id)
        if dossier and (len(rels) < 3):
            graph_edges = (dossier.get("graph") or {}).get("edges", [])
            for ge in graph_edges[:40]:
                rels.append({
                    "source": ge.get("source", "Source"),
                    "target": ge.get("target", "Target"),
                    "type": ge.get("label", ge.get("relationshipType", "CONNECTED_TO")),
                    "confidence": ge.get("confidence", 0.9),
                    "status": "DETECTED",
                })

        return entities, rels

    async def _get_evidence_records(self, case_id: uuid.UUID) -> List[Dict]:
        stmt = select(Evidence).where(Evidence.case_id == case_id).limit(50)
        result = await self.session.execute(stmt)
        items = []
        for ev in result.scalars().all():
            ev_type = ev.evidence_type.value if hasattr(ev.evidence_type, "value") else str(ev.evidence_type)
            items.append({
                "id": str(ev.id),
                "title": ev.title,
                "evidence_type": ev_type,
                "description": ev.description,
                "collected_at": str(ev.created_at) if ev.created_at else None,
                "file_name": ev.file_name,
            })
        return items

    async def _count_evidence(self, case_id: uuid.UUID) -> int:
        stmt = select(func.count()).select_from(Evidence).where(Evidence.case_id == case_id)
        result = await self.session.execute(stmt)
        return result.scalar_one() or 0

    # ── Cache helpers ─────────────────────────────────────────────────────────

    async def _get_samanvaya_dossier(self, case_id: uuid.UUID) -> Optional[Dict]:
        key = _samanvaya_result_key(str(case_id))
        try:
            raw = await self.cache.get(key)
            if raw:
                if isinstance(raw, dict):
                    return raw
                return json.loads(raw)
        except Exception as e:
            logger.warning("Cache miss for SAMANVAYA dossier %s: %s", case_id, e)
        return None

    async def _get_cdr(self, case_id: uuid.UUID) -> Optional[Dict]:
        key = _samanvaya_cdr_key(str(case_id))
        try:
            raw = await self.cache.get(key)
            if raw:
                if isinstance(raw, dict):
                    return raw
                return json.loads(raw)
        except Exception:
            pass
        return None

    # ── Section formatters ────────────────────────────────────────────────────

    def _section_case(self, case: Case, fir: Optional[Any]) -> str:
        lines = [
            "## Active Investigation Case",
            f"- Case Number: {case.case_number}",
            f"- Title: {case.title}",
            f"- Crime Category: {case.crime_category}",
            f"- Status: {case.status.value if hasattr(case.status, 'value') else case.status}",
            f"- Priority: {case.priority.value if hasattr(case.priority, 'value') else case.priority}",
        ]
        if case.incident_date:
            lines.append(f"- Incident Date: {case.incident_date}")
        if case.police_station:
            lines.append(f"- Police Station: {case.police_station}")
        if case.city:
            lines.append(f"- City: {case.city}")
        lines.append(f"- Description: {case.description[:600]}")
        if fir:
            fir_number = getattr(fir, "fir_number", None) or (fir.get("fir_number") if isinstance(fir, dict) else "N/A")
            incident_location = getattr(fir, "incident_location", None) or (fir.get("incident_location") if isinstance(fir, dict) else "N/A")
            fir_desc = getattr(fir, "description", None) or (fir.get("description") if isinstance(fir, dict) else "")
            lines += [
                "",
                "## FIR Details",
                f"- FIR Number: {fir_number}",
                f"- Incident Location: {incident_location}",
                f"- FIR Narrative (excerpt): {(fir_desc or '')[:800]}",
            ]
        return "\n".join(lines)

    def _section_entities(self, entities: List[Dict]) -> str:
        lines = [f"## Entities ({len(entities)} identified)"]
        for e in entities[:25]:
            lines.append(
                f"- {e['type']}: {e['name']} | Role: {e['role']} | Confidence: {e['confidence']:.0%}"
            )
        return "\n".join(lines)

    def _section_relationships(self, rels: List[Dict]) -> str:
        lines = [f"## Entity Relationships ({len(rels)} detected)"]
        for r in rels[:20]:
            lines.append(f"- {r['type']} | Confidence: {r['confidence']:.0%} | Status: {r['status']}")
        return "\n".join(lines)

    def _section_agents(self, dossier: Dict) -> str:
        agents = dossier.get("agents", [])
        lines = [f"## SAMANVAYA Agent Outputs ({len(agents)} agents)"]
        for ag in agents:
            name = ag.get("name", "Agent")
            sname = ag.get("sanskritName", "")
            role = ag.get("role", "")
            found = ag.get("relevantFound", ag.get("recordsSearched", 0))
            status = ag.get("status", "UNKNOWN")
            lines.append(f"\n### Agent {ag.get('agentNumber','?')} — {sname} ({name})")
            lines.append(f"- Role: {role}")
            lines.append(f"- Status: {status}")
            lines.append(f"- Records Found: {found}")
            highlights = ag.get("highlights", [])
            if highlights:
                lines.append("- Key Highlights:")
                for h in highlights[:5]:
                    lines.append(f"  • {h}")
            output = ag.get("outputData", {})
            if output and isinstance(output, dict):
                summary_str = output.get("summary") or output.get("conclusion") or output.get("investigationSummary") or ""
                if summary_str:
                    lines.append(f"- Output Summary: {summary_str[:250]}")
        return "\n".join(lines)

    def _section_graph(self, graph: Dict) -> str:
        nodes = graph.get("nodes", [])
        edges = graph.get("edges", [])
        clusters = graph.get("clusters", [])
        lines = [
            f"## Criminal Network Graph",
            f"- Total Nodes: {len(nodes)}",
            f"- Total Edges: {len(edges)}",
            f"- Clusters Identified: {len(clusters)}",
        ]
        # Top 10 nodes by label
        if nodes:
            lines.append("- Key Network Nodes:")
            for n in nodes[:10]:
                lines.append(f"  • {n.get('label', n.get('name', 'Unknown'))} [{n.get('category','?')}] importance={n.get('importance','?')}")
        # Top 10 edges
        if edges:
            lines.append("- Key Relationships in Graph:")
            for e in edges[:10]:
                lines.append(f"  • {e.get('source','?')} —[{e.get('label', e.get('relationshipType','?'))}]→ {e.get('target','?')}")
        return "\n".join(lines)

    def _section_timeline(self, events: List[Dict]) -> str:
        lines = [f"## Investigation Timeline ({len(events)} events)"]
        for ev in events[:15]:
            t = ev.get("time", ev.get("timestamp", "?"))
            title = ev.get("title", ev.get("event", "Event"))
            desc = ev.get("description", "")
            src = ev.get("source", ev.get("agent", ""))
            lines.append(f"- [{t}] {title} — {desc[:200]} (Source: {src})")
        return "\n".join(lines)

    def _section_historical(self, agent4: Dict) -> str:
        matches = agent4.get("historicalMatches", [])
        patterns = agent4.get("modusOperandiPatterns", [])
        lines = [f"## Historical & Pattern Intelligence"]
        if matches:
            lines.append(f"- {len(matches)} historical precedent case(s) identified:")
            for m in matches[:5]:
                lines.append(f"  • {m.get('case_number', m.get('title', 'Unknown'))}: {m.get('description', '')[:200]}")
        else:
            lines.append("- No strong historical precedent match found for this crime type.")
        if patterns:
            lines.append(f"- Modus Operandi Patterns: {'; '.join(patterns[:5])}")
        return "\n".join(lines)

    def _section_geo(self, geo_points: List[Dict]) -> str:
        lines = [f"## Geographic Intelligence ({len(geo_points)} locations)"]
        for pt in geo_points[:10]:
            lines.append(
                f"- {pt.get('name','?')} [{pt.get('role','?')}]: {pt.get('address', '')} "
                f"(confidence: {pt.get('confidence', 0):.0%})"
            )
        return "\n".join(lines)

    def _section_synthesis(self, summary: str, findings: List[Dict]) -> str:
        lines = ["## Investigation Summary (Agent 5 — SAMANVAYA/VYAKHYA)"]
        if summary:
            lines.append(summary[:1200])
        if findings:
            lines.append(f"\n### Key Findings ({len(findings)})")
            for f in findings[:10]:
                cls = f.get("classification", "?")
                conf = f.get("confidence", 0)
                src = f.get("agentSource", "?")
                ev = ", ".join(f.get("evidence", [])[:3])
                lines.append(
                    f"- [{cls}] {f.get('finding','')} "
                    f"(confidence: {conf:.0%}, source: {src})"
                    + (f" — evidence: {ev}" if ev else "")
                )
        return "\n".join(lines)

    def _section_cdr(self, cdr: Dict) -> str:
        lines = [
            f"## Call Detail Records",
            f"- Total Records: {cdr.get('parsedRecords', 0)}",
            f"- Unique Numbers: {cdr.get('uniqueNumbers', 0)}",
        ]
        parties = cdr.get("parties", [])
        if parties:
            lines.append(f"- Communication Parties ({len(parties)}):")
            for p in parties[:10]:
                lines.append(
                    f"  • {p.get('number','?')} ({p.get('role','?')}): {p.get('totalCalls',0)} calls, "
                    f"baseline {p.get('baselineCallsPerDay',0):.1f}/day, peak {p.get('peakCallsPerDay',0):.1f}/day"
                    + (" [NEW CONTACT]" if p.get("isNewContact") else "")
                )
        patterns = cdr.get("patterns", [])
        if patterns:
            lines.append(f"\n- Suspicious Communication Patterns ({len(patterns)}):")
            for pt in patterns[:5]:
                lines.append(
                    f"  ⚠ [{pt.get('severity','?')}] {pt.get('title','?')}: {pt.get('description','')[:200]}"
                )
        return "\n".join(lines)

    def _get_agent_output(self, dossier: Dict, agent_number: int) -> Optional[Dict]:
        """Extract a specific agent's outputData from the dossier."""
        agents = dossier.get("agents", [])
        for ag in agents:
            if ag.get("agentNumber") == agent_number:
                return ag.get("outputData", {})
        return None

    # ── Prompt builder ────────────────────────────────────────────────────────

    def _build_prompt(
        self,
        case: Case,
        context: str,
        question: str,
        history: List[Dict[str, str]],
    ) -> str:
        history_block = ""
        if history:
            history_block = "\n\n## Multi-Turn Conversation History\n"
            for turn in history[-6:]:
                role = "Investigator" if turn.get("role") == "user" else "KAVA AI"
                content = str(turn.get("content", ""))
                if role == "KAVA AI" and len(content) > 350:
                    content = content[:350] + "..."
                history_block += f"{role}: {content}\n"

        return f"""## Active Investigation Case Context
Case: {case.case_number} — {case.title}
Crime: {case.crime_category}
Status: {case.status.value if hasattr(case.status, 'value') else case.status}

{context}
{history_block}

## Investigator Current Inquiry
{question}

## Persona & Instructions
You are KAVA AI, the Case-Grounded Criminal Intelligence Assistant in the KRITAGAS platform.
You function like a world-class investigative ChatGPT, analyzing and reasoning over the active case data.

Key Guidelines:
1. Answer ANY investigative question naturally, conversationally, and thoroughly.
2. Ground all answers in the case dossier provided above (FIR, entities, network graph, CDR call patterns, SAMANVAYA agents, timeline, evidence).
3. If the investigator asks a follow-up question using pronouns (e.g., "he", "him", "she", "why is he suspicious?", "who called him?"), use the conversation history to identify the person being discussed and answer accurately.
4. If asked "Explain this case" or "What happened?", provide a structured breakdown: Summary, Incident Facts, Key Suspects, Anomalies, and Next Leads.
5. If asked about suspicious patterns, call spikes, or network connections, cite the relevant facts (e.g. `[Call Detail Records]`, `[Agent 3 — SUTRA]`, `[FIR]`).
6. Clearly distinguish verified evidence from analytical leads.
7. Use clean Markdown: section headers (###), bullet points, and bold entities for scannability."""
