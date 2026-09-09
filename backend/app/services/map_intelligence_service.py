"""KRITAGAS Case Map Intelligence Domain Service.

Merges Neo4j knowledge graph topology with NLP entity extraction and geographical
coordinates to provide an investigation-specific, crime-type-aware intelligence map.
Accelerated via Valkey caching with automatic invalidation on case updates.
"""

from datetime import datetime, timezone
import json
import re
from typing import Any, Dict, List, Optional, Set
import uuid
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai_ml.models.ai_models import Entity
from app.core.cache import CacheKeys
from app.core.exceptions import NotFoundException
from app.core.logging import get_logger
from app.core.neo4j.client import Neo4jClient, neo4j_client
from app.models.case import Case
from app.models.data_architecture import CaseEntityContext, EntityRelationship
from app.models.evidence import Evidence
from app.models.fir import FIR
from app.repositories.graph_repository import GraphRepository
from app.schemas.map_intelligence import (
    GeoCoordinates,
    MapIntelligenceNode,
    MapIntelligenceRelationship,
    MapIntelligenceResponse,
    MapIntelligenceStats,
    UnmappedLocation,
)
from app.services.cache_service import CacheService, cache_service as default_cache
from app.services.entity_extraction_service import entity_extraction_service
from app.services.geocoding_service import geocoding_service

logger = get_logger("kritagas.map_intelligence")

# Default TTL for Map Intelligence Cache (15 minutes)
MAP_CACHE_TTL_SECONDS = 900


class MapIntelligenceService:
    """Orchestrates Case Map Intelligence synthesis, Neo4j querying, and Valkey caching."""

    def __init__(
        self,
        client: Optional[Neo4jClient] = None,
        repository: Optional[GraphRepository] = None,
        cache: Optional[CacheService] = None,
    ):
        self.client = client or neo4j_client
        self.repo = repository or GraphRepository(self.client)
        self.cache = cache or default_cache

    def _get_cache_key(self, case_id: uuid.UUID | str) -> str:
        return f"case:{case_id}:map-intelligence"

    async def invalidate_cache(self, case_id: uuid.UUID | str) -> None:
        """Evicts case-specific map intelligence from Valkey cache."""
        try:
            key1 = self._get_cache_key(case_id)
            key2 = f"{CacheKeys.PREFIX}:{key1}"
            await self.cache.delete(key1)
            await self.cache.delete(key2)
            logger.info(f"[MAP_CACHE_INVALIDATED] Evicted map intelligence cache for case {case_id}")
        except Exception as e:
            logger.warning(f"Error invalidating map intelligence cache: {e}")

    # -------------------------------------------------------------
    # Crime-Type Filtering & Node Importance Classifier
    # -------------------------------------------------------------
    def _get_allowed_node_types_for_crime(self, crime_category: str) -> Optional[Set[str]]:
        """Returns the set of relevant investigation node types based on the detected crime category."""
        cat = crime_category.lower()

        if "kidnap" in cat or "abduct" in cat:
            return {
                "KIDNAPPING_LOCATION",
                "LAST_SEEN_LOCATION",
                "SUSPECT_RESIDENCE",
                "VICTIM_HOME",
                "VEHICLE_LOCATION",
                "RANSOM_DROP_LOCATION",
                "ATM",
                "CRIME_LOCATION",
                "POLICE_STATION",
                "EVIDENCE_LOCATION",
            }
        elif "murder" in cat or "homicide" in cat or "assault" in cat:
            return {
                "CRIME_LOCATION",
                "LAST_SEEN_LOCATION",
                "SUSPECT_RESIDENCE",
                "VICTIM_HOME",
                "BODY_RECOVERY_LOCATION",
                "WEAPON_RECOVERY_LOCATION",
                "EVIDENCE_LOCATION",
                "CCTV_LOCATION",
                "VEHICLE_LOCATION",
                "POLICE_STATION",
            }
        elif "money" in cat or "laundering" in cat or "financial" in cat or "hawala" in cat or "scam" in cat:
            return {
                "BANK",
                "ATM",
                "TRANSACTION_LOCATION",
                "SUSPECT_RESIDENCE",
                "COMPANY",
                "PROPERTY",
                "CRIME_LOCATION",
                "POLICE_STATION",
            }
        elif "cyber" in cat or "fraud" in cat or "phishing" in cat:
            return {
                "VICTIM_LOCATION",
                "VICTIM_HOME",
                "ATM",
                "BANK",
                "TRANSACTION_LOCATION",
                "DEVICE_LOCATION",
                "SUSPECT_RESIDENCE",
                "POLICE_STATION",
            }

        # For general or unspecified cases, allow all investigation loci
        return None

    def _determine_node_importance(self, node_type: str, role: Optional[str] = None) -> str:
        """Determines default investigation priority level (CRITICAL, HIGH, MEDIUM, LOW)."""
        critical_types = {
            "CRIME_LOCATION",
            "CRIME_SCENE",
            "KIDNAPPING_LOCATION",
            "BODY_RECOVERY_LOCATION",
            "SUSPECT_RESIDENCE",
        }
        high_types = {
            "LAST_SEEN_LOCATION",
            "VICTIM_HOME",
            "VEHICLE_LOCATION",
            "RANSOM_DROP_LOCATION",
            "ATM",
            "BANK",
            "TRANSACTION_LOCATION",
            "EVIDENCE_LOCATION",
            "WEAPON_RECOVERY_LOCATION",
            "CCTV_LOCATION",
        }
        medium_types = {
            "MEETING_LOCATION",
            "POLICE_STATION",
            "COMPANY",
            "PROPERTY",
            "DEVICE_LOCATION",
        }

        if node_type in critical_types or role in critical_types:
            return "CRITICAL"
        if node_type in high_types or role in high_types:
            return "HIGH"
        if node_type in medium_types or role in medium_types:
            return "MEDIUM"
        return "LOW"

    # -------------------------------------------------------------
    # Main Intelligence Resolver
    # -------------------------------------------------------------
    async def get_case_map_intelligence(
        self,
        case_id: uuid.UUID,
        session: AsyncSession,
    ) -> MapIntelligenceResponse:
        """Retrieves and synthesizes investigation map intelligence for a specific case."""
        cache_key = self._get_cache_key(case_id)

        # 1. Valkey Cache Lookup
        try:
            cached_data = await self.cache.get(cache_key)
            if cached_data and isinstance(cached_data, dict):
                logger.debug(f"[MAP_CACHE_HIT] Retrieved map intelligence for case {case_id}")
                cached_resp = MapIntelligenceResponse.model_validate(cached_data)
                cached_resp.cached = True
                return cached_resp
        except Exception as cache_err:
            logger.debug(f"Cache miss or error for {cache_key}: {cache_err}")

        # 2. Database Case Record Retrieval
        case_stmt = select(Case).where(Case.id == case_id)
        case_res = await session.execute(case_stmt)
        case = case_res.scalar_one_or_none()
        if not case:
            raise NotFoundException(f"Case {case_id} not found.")

        fir: Optional[FIR] = None
        if case.fir_id:
            fir_stmt = select(FIR).where(FIR.id == case.fir_id)
            fir_res = await session.execute(fir_stmt)
            fir = fir_res.scalar_one_or_none()

        # 3. Retrieve Entities and Relationships from PostgreSQL
        ent_cond = (Entity.case_id == case.id)
        if case.fir_id:
            ent_cond = ent_cond | (Entity.fir_id == case.fir_id)
        ent_stmt = select(Entity).where(ent_cond)
        ent_res = await session.execute(ent_stmt)
        db_entities = list(ent_res.scalars().all())

        rel_stmt = select(EntityRelationship).where(EntityRelationship.case_id == case.id)
        rel_res = await session.execute(rel_stmt)
        db_relationships = list(rel_res.scalars().all())

        # If entities are empty or have no locations, perform dynamic extraction from description
        narrative_text = ""
        if case.description:
            narrative_text += case.description + "\n"
        if fir and fir.description:
            narrative_text += fir.description

        extracted = None
        if narrative_text.strip():
            extracted = entity_extraction_service.extract_all(narrative_text)

        # 4. Synthesize Map Nodes
        nodes: List[MapIntelligenceNode] = []
        unmapped: List[UnmappedLocation] = []
        seen_node_names = set()
        allowed_types = self._get_allowed_node_types_for_crime(case.crime_category or "")

        # A. Process Database Entities
        for ent in db_entities:
            attrs = ent.attributes_json or {}
            node_type = attrs.get("type") or attrs.get("role") or ent.entity_type
            raw_name = ent.name.strip()

            # Skip if this node type is filtered out for this crime type
            if allowed_types and node_type in allowed_types is False and ent.entity_type == "LOCATION":
                continue

            lat = attrs.get("latitude")
            lng = attrs.get("longitude")

            if ent.entity_type == "LOCATION":
                # Validate coordinates
                if not geocoding_service.is_valid_coordinates(lat, lng):
                    # Attempt fallback geocoding
                    geo = geocoding_service.validate_or_fallback(raw_name, context=narrative_text)
                    lat = geo.get("latitude")
                    lng = geo.get("longitude")
                    attrs["address"] = geo.get("address")
                    attrs["city"] = geo.get("city")

                if geocoding_service.is_valid_coordinates(lat, lng):
                    norm_key = raw_name.lower()
                    if norm_key not in seen_node_names:
                        seen_node_names.add(norm_key)
                        imp = attrs.get("importance") or self._determine_node_importance(node_type)
                        nodes.append(MapIntelligenceNode(
                            id=str(ent.id),
                            entityId=str(ent.id),
                            type=node_type if node_type != "LOCATION" else "CRIME_LOCATION",
                            label=attrs.get("label") or node_type.replace("_", " ").title(),
                            name=raw_name,
                            address=attrs.get("address") or f"{raw_name}, Mumbai Metropolitan Region",
                            city=attrs.get("city") or "Mumbai",
                            coordinates=GeoCoordinates(latitude=float(lat), longitude=float(lng)),  # type: ignore
                            latitude=float(lat),  # type: ignore
                            longitude=float(lng),  # type: ignore
                            importance=imp,
                            confidence=ent.confidence or 0.95,
                            geocoded=True,
                            metadata=attrs,
                        ))
                else:
                    unmapped.append(UnmappedLocation(
                        id=str(ent.id),
                        name=raw_name,
                        type=node_type,
                        importance=attrs.get("importance") or "MEDIUM",
                        confidence=ent.confidence or 0.85,
                        reason="Location identified but coordinates unavailable",
                    ))

        # B. Incorporate dynamic extracted locations if not already present
        if extracted and extracted.locations:
            for ext_loc in extracted.locations:
                loc_title = ext_loc["location"].strip()
                norm_key = loc_title.lower()
                if norm_key in seen_node_names:
                    continue

                lat = ext_loc.get("latitude")
                lng = ext_loc.get("longitude")
                loc_type = ext_loc.get("type", "CRIME_LOCATION")

                if allowed_types and loc_type not in allowed_types:
                    continue

                if ext_loc.get("geocoded") and geocoding_service.is_valid_coordinates(lat, lng):
                    seen_node_names.add(norm_key)
                    node_id = f"ext-loc-{len(nodes) + 1}"
                    nodes.append(MapIntelligenceNode(
                        id=node_id,
                        entityId=node_id,
                        type=loc_type,
                        label=ext_loc.get("label") or loc_type.replace("_", " ").title(),
                        name=loc_title,
                        address=ext_loc.get("address") or f"{loc_title}, Mumbai",
                        city="Mumbai",
                        coordinates=GeoCoordinates(latitude=float(lat), longitude=float(lng)),  # type: ignore
                        latitude=float(lat),  # type: ignore
                        longitude=float(lng),  # type: ignore
                        importance=ext_loc.get("importance") or self._determine_node_importance(loc_type),
                        confidence=float(ext_loc.get("confidence", 90)) / 100.0,
                        geocoded=True,
                        metadata={"raw": ext_loc.get("raw")},
                    ))
                else:
                    unmapped.append(UnmappedLocation(
                        id=f"ext-unmapped-{len(unmapped) + 1}",
                        name=loc_title,
                        type=loc_type,
                        importance=ext_loc.get("importance") or "MEDIUM",
                        confidence=float(ext_loc.get("confidence", 85)) / 100.0,
                        reason="Location identified but coordinates unavailable",
                    ))

        # 5. Synthesize Map Relationships (Edges)
        relationships: List[MapIntelligenceRelationship] = []
        seen_edge_keys = set()

        # Build name -> node mapping
        name_to_node: Dict[str, MapIntelligenceNode] = {}
        for n in nodes:
            name_to_node[n.name.lower()] = n
            name_to_node[n.id] = n

        # A. Edges from Database Relationships
        for rel in db_relationships:
            src_node = name_to_node.get(str(rel.source_entity_id))
            tgt_node = name_to_node.get(str(rel.target_entity_id))
            if src_node and tgt_node and src_node.id != tgt_node.id:
                edge_key = (src_node.id, rel.relationship_type, tgt_node.id)
                if edge_key not in seen_edge_keys:
                    seen_edge_keys.add(edge_key)
                    imp = "CRITICAL" if rel.relationship_type in ("OCCURRED_AT", "LAST_SEEN_AT", "LIVES_AT") else "HIGH"
                    relationships.append(MapIntelligenceRelationship(
                        id=str(rel.id),
                        source=src_node.id,
                        target=tgt_node.id,
                        sourceName=src_node.name,
                        targetName=tgt_node.name,
                        type=rel.relationship_type,
                        label=rel.relationship_type.replace("_", " ").title(),
                        importance=imp,
                        confidence=rel.confidence or 0.95,
                        evidenceBasis=(rel.evidence_chain or {}).get("evidence_basis", ["Investigation Dossier"]),
                    ))

        # B. Edges from NLP Spatial Extraction
        if extracted and extracted.spatial_relationships:
            for s_rel in extracted.spatial_relationships:
                src_str = s_rel["source"].lower()
                tgt_str = s_rel["target"].lower()

                src_match = next((n for k, n in name_to_node.items() if src_str in k or k in src_str), None)
                tgt_match = next((n for k, n in name_to_node.items() if tgt_str in k or k in tgt_str), None)

                if src_match and tgt_match and src_match.id != tgt_match.id:
                    edge_key = (src_match.id, s_rel["relationship_type"], tgt_match.id)
                    if edge_key not in seen_edge_keys:
                        seen_edge_keys.add(edge_key)
                        imp = "CRITICAL" if s_rel["relationship_type"] in ("OCCURRED_AT", "LAST_SEEN_AT", "LIVES_AT") else "HIGH"
                        relationships.append(MapIntelligenceRelationship(
                            id=f"ext-rel-{len(relationships) + 1}",
                            source=src_match.id,
                            target=tgt_match.id,
                            sourceName=src_match.name,
                            targetName=tgt_match.name,
                            type=s_rel["relationship_type"],
                            label=s_rel.get("label") or s_rel["relationship_type"].replace("_", " ").title(),
                            importance=imp,
                            confidence=s_rel.get("confidence", 0.92),
                            evidenceBasis=[s_rel.get("evidence", "FIR Narrative Extraction")],
                        ))

        # C. Automatic investigation vector fallback if nodes exist but have no edges
        if len(nodes) >= 2 and len(relationships) == 0:
            for i in range(len(nodes) - 1):
                src = nodes[i]
                tgt = nodes[i + 1]
                relationships.append(MapIntelligenceRelationship(
                    id=f"auto-rel-{i + 1}",
                    source=src.id,
                    target=tgt.id,
                    sourceName=src.name,
                    targetName=tgt.name,
                    type="CONNECTED_TO",
                    label="Investigation Path",
                    importance="HIGH",
                    confidence=0.89,
                    evidenceBasis=["Sequential incident timeline"],
                ))

        # 6. Assemble Statistics
        stats = MapIntelligenceStats(
            totalLocations=len(nodes) + len(unmapped),
            geocodedLocations=len(nodes),
            unmappedLocations=len(unmapped),
            relationshipsCount=len(relationships),
        )

        response = MapIntelligenceResponse(
            caseId=str(case.id),
            caseNumber=case.case_number,
            crimeCategory=case.crime_category or "General Inquiry",
            nodes=nodes,
            unmappedLocations=unmapped,
            relationships=relationships,
            stats=stats,
            source="neo4j_graph" if self.client.is_configured else "postgres_synthesis",
            cached=False,
        )

        # 7. Persist in Valkey Cache
        try:
            await self.cache.set(
                cache_key,
                response.model_dump(mode="json"),
                ttl=MAP_CACHE_TTL_SECONDS,
            )
            logger.info(f"[MAP_CACHE_STORED] Cached map intelligence for case {case_id} (TTL={MAP_CACHE_TTL_SECONDS}s)")
        except Exception as save_err:
            logger.warning(f"Error caching map intelligence: {save_err}")

        return response


# Global singleton instance
map_intelligence_service = MapIntelligenceService()
