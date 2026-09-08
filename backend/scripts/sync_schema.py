import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from app.db.session import engine
from sqlalchemy import text

DDL_STATEMENTS = [
    # 1. Alter cases table
    """
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS crime_type VARCHAR(100);
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS incident_date DATE;
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS incident_time TIME;
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS city VARCHAR(100);
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS region VARCHAR(100);
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS police_station VARCHAR(150);
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS area VARCHAR(150);
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS source VARCHAR(100);
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN DEFAULT FALSE;
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) DEFAULT 'KRITAGAS_LIVE';
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS resolution_status VARCHAR(50);
    ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_outcome TEXT;
    """,
    # 2. Alter firs table
    """
    ALTER TABLE firs ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN DEFAULT FALSE;
    ALTER TABLE firs ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) DEFAULT 'KRITAGAS_LIVE';
    """,
    # 3. Create indexes on cases and firs
    """
    CREATE INDEX IF NOT EXISTS ix_cases_city ON cases (city);
    CREATE INDEX IF NOT EXISTS ix_cases_region ON cases (region);
    CREATE INDEX IF NOT EXISTS ix_cases_is_synthetic ON cases (is_synthetic);
    CREATE INDEX IF NOT EXISTS ix_cases_incident_date ON cases (incident_date);
    CREATE INDEX IF NOT EXISTS ix_firs_is_synthetic ON firs (is_synthetic);
    """,
    # 4. Create entities table
    """
    CREATE TABLE IF NOT EXISTS entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
        fir_id UUID REFERENCES firs(id) ON DELETE CASCADE,
        entity_type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        normalized_value VARCHAR(255) NOT NULL,
        confidence FLOAT NOT NULL DEFAULT 1.0,
        source_text TEXT,
        attributes_json JSONB,
        is_canonical BOOLEAN NOT NULL DEFAULT TRUE,
        canonical_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_entities_case_id ON entities (case_id);
    CREATE INDEX IF NOT EXISTS ix_entities_entity_type ON entities (entity_type);
    CREATE INDEX IF NOT EXISTS ix_entities_name ON entities (name);
    CREATE INDEX IF NOT EXISTS ix_entities_normalized_value ON entities (normalized_value);
    """,
    # 5. Create entity_matches table
    """
    CREATE TABLE IF NOT EXISTS entity_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        confidence_score FLOAT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING_REVIEW',
        similarity_breakdown JSONB,
        supporting_evidence JSONB,
        conflicting_evidence JSONB,
        reviewed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ,
        review_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    # 6. Create entity_relationships table
    """
    CREATE TABLE IF NOT EXISTS entity_relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        relationship_type VARCHAR(60) NOT NULL,
        case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
        confidence FLOAT NOT NULL DEFAULT 1.0,
        source_evidence_id UUID REFERENCES evidence(id) ON DELETE SET NULL,
        extraction_method VARCHAR(60) NOT NULL DEFAULT 'NLP_DEPENDENCY_PARSE',
        created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'DETECTED',
        evidence_chain JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_entity_relationships_case_id ON entity_relationships (case_id);
    CREATE INDEX IF NOT EXISTS ix_entity_relationships_rel_type ON entity_relationships (relationship_type);
    """,
    # 7. Create case_entity_contexts table
    """
    CREATE TABLE IF NOT EXISTS case_entity_contexts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'PERSON_OF_INTEREST',
        fir_id UUID REFERENCES firs(id) ON DELETE SET NULL,
        source_evidence_id UUID REFERENCES evidence(id) ON DELETE SET NULL,
        confidence FLOAT NOT NULL DEFAULT 1.0,
        extraction_method VARCHAR(50) NOT NULL DEFAULT 'MANUAL_ENTRY',
        original_text TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'EXTRACTED',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_case_entity_role UNIQUE (case_id, entity_id, role)
    );
    """,
    # 8. Create case_similarities table
    """
    CREATE TABLE IF NOT EXISTS case_similarities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        target_case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        similarity_score FLOAT NOT NULL,
        semantic_score FLOAT NOT NULL DEFAULT 0.0,
        modus_operandi_score FLOAT NOT NULL DEFAULT 0.0,
        entity_overlap_score FLOAT NOT NULL DEFAULT 0.0,
        location_score FLOAT NOT NULL DEFAULT 0.0,
        temporal_score FLOAT NOT NULL DEFAULT 0.0,
        common_features JSONB,
        explanation_summary TEXT NOT NULL,
        supporting_records JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_case_sim_score ON case_similarities (similarity_score);
    """,
    # 9. Create correlations table
    """
    CREATE TABLE IF NOT EXISTS correlations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        source_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
        target_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
        correlation_type VARCHAR(100) NOT NULL,
        confidence FLOAT NOT NULL,
        description TEXT NOT NULL,
        evidence_chain JSONB,
        source_records JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    # 10. Create intelligence_insights table
    """
    CREATE TABLE IF NOT EXISTS intelligence_insights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        insight_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        summary TEXT NOT NULL,
        confidence FLOAT NOT NULL,
        facts JSONB,
        inferences JSONB,
        supporting_records JSONB,
        limitations TEXT,
        priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    # 11. Create anomalies table
    """
    CREATE TABLE IF NOT EXISTS anomalies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
        anomaly_type VARCHAR(100) NOT NULL,
        score FLOAT NOT NULL,
        baseline_value FLOAT,
        observed_value FLOAT,
        deviation_metric VARCHAR(100),
        description TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'REQUIRES_INVESTIGATION',
        evidence JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    # 12. Create geo_temporal_events table
    """
    CREATE TABLE IF NOT EXISTS geo_temporal_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id VARCHAR(50) NOT NULL UNIQUE,
        case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
        city VARCHAR(100) NOT NULL,
        region VARCHAR(100) NOT NULL,
        area VARCHAR(150) NOT NULL,
        latitude FLOAT NOT NULL,
        longitude FLOAT NOT NULL,
        incident_date DATE NOT NULL,
        incident_time TIME,
        crime_type VARCHAR(100) NOT NULL,
        time_bucket VARCHAR(50) NOT NULL DEFAULT 'NIGHT',
        location_cluster VARCHAR(100) NOT NULL,
        risk_level VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
        related_case_number VARCHAR(50),
        pattern_identifier VARCHAR(100),
        metadata_json JSONB,
        is_synthetic BOOLEAN NOT NULL DEFAULT TRUE,
        data_source VARCHAR(50) NOT NULL DEFAULT 'KRITAGAS_DEMO',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_geo_events_event_id ON geo_temporal_events (event_id);
    CREATE INDEX IF NOT EXISTS ix_geo_events_city ON geo_temporal_events (city);
    CREATE INDEX IF NOT EXISTS ix_geo_events_region ON geo_temporal_events (region);
    CREATE INDEX IF NOT EXISTS ix_geo_events_area ON geo_temporal_events (area);
    CREATE INDEX IF NOT EXISTS ix_geo_events_date ON geo_temporal_events (incident_date);
    CREATE INDEX IF NOT EXISTS ix_geo_events_cluster ON geo_temporal_events (location_cluster);
    CREATE INDEX IF NOT EXISTS ix_geo_events_synthetic ON geo_temporal_events (is_synthetic);
    """,
    # 13. Create case_members table
    """
    CREATE TABLE IF NOT EXISTS case_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'INVESTIGATOR',
        assigned_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        permissions_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_case_member UNIQUE (case_id, user_id)
    );
    """,
    # 14. Create data_sources table
    """
    CREATE TABLE IF NOT EXISTS data_sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_type VARCHAR(50) NOT NULL,
        case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
        fir_id UUID REFERENCES firs(id) ON DELETE SET NULL,
        evidence_id UUID REFERENCES evidence(id) ON DELETE SET NULL,
        source_reference VARCHAR(255) NOT NULL,
        source_system VARCHAR(100),
        uploaded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        processing_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        raw_metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    # 15. Create investigation_reports table
    """
    CREATE TABLE IF NOT EXISTS investigation_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        report_type VARCHAR(60) NOT NULL,
        title VARCHAR(255) NOT NULL,
        summary TEXT NOT NULL,
        content_json JSONB,
        generated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
        agent_name VARCHAR(100),
        status VARCHAR(30) NOT NULL DEFAULT 'FINAL',
        blockchain_record_id UUID,
        content_hash VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """
]

async def sync_schema():
    print("Executing schema DDL migrations sequentially...", flush=True)
    async with engine.connect() as conn:
        for idx, block in enumerate(DDL_STATEMENTS, 1):
            commands = [cmd.strip() for cmd in block.split(";") if cmd.strip()]
            for cmd in commands:
                await conn.execute(text(cmd))
            await conn.commit()
            print(f"Applied migration block {idx}/{len(DDL_STATEMENTS)}", flush=True)
    print("All DDL migrations applied successfully!", flush=True)
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(sync_schema())
