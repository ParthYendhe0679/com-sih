# KRITAGAS — AI Environment Configuration & Provider Pipeline Guide

This guide details the centralized AI provider pipeline for the **KRITAGAS** Criminal Intelligence and Investigation Platform.

---

## 1. Architectural Overview

KRITAGAS employs a multi-provider, task-based AI orchestration pipeline engineered for high availability, investigative precision, and strict privacy controls.

```
                  ┌────────────────────────────────────────┐
                  │           FastAPI Application          │
                  │   /api/v1/health/ai  |  Intelligence   │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │        AIService          │
                        │ (Pydantic Schema Validate,│
                        │  Retry Engine, Logging)   │
                        └─────────────┬─────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │     AIProviderRouter      │
                        │  (TaskType Priority Map)  │
                        └──────┬──────┬──────┬──────┘
                               │      │      │      │
            ┌──────────────────┘      │      │      └─────────────────┐
            ▼                         ▼      ▼                        ▼
  ┌──────────────────┐   ┌─────────────────┐ ┌──────────────┐   ┌────────────────┐
  │   GroqProvider   │   │ GeminiProvider  │ │HuggingFace   │   │ LocalFallback  │
  │ Llama-3.3-70b    │   │ Gemini-1.5-Flash│ │SentenceTrans │   │ Rule Engine    │
  │ Fast Reasoning   │   │ Large Summaries │ │Embeddings/Sim│   │ Heuristics     │
  └──────────────────┘   └─────────────────┘ └──────────────┘   └────────────────┘
```

### Core Components
- **`app/core/config.py`**: Centralized configuration through Pydantic `BaseSettings`. Handles API keys, primary indices, timeouts, and thresholds.
- **`app/ai/schemas/ai.py`**: Standardized request/response envelopes (`AIResponseEnvelope`, `TaskType`, `InvestigativeLeadExtraction`, `AnomalyExplanationOutput`).
- **`app/ai/providers/`**: Pluggable provider implementations (`GroqProvider`, `GeminiProvider`, `HuggingFaceProvider`, `LocalFallbackProvider`).
- **`app/ai/services/provider_router.py`**: Task-based router mapping tasks to candidate chains with graceful fallbacks.
- **`app/ai/services/provider_health.py`**: Passive health probe inspecting credentials without consuming billable API tokens.
- **`app/ai/services/ai_service.py`**: Main unified service facade with automatic retries on transient network errors.

---

## 2. Environment Variables Specification

All configuration variables are loaded from the environment or `.env` file via `Settings`:

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `GROQ_PRIMARY_KEY_INDEX` | `int` | `1` | Active Groq key index to use (1 to 4) |
| `GROQ_API_KEY_1` | `str` | `""` | Primary Groq API key |
| `GROQ_API_KEY_2` | `str` | `""` | Secondary Groq API key |
| `GROQ_API_KEY_3` | `str` | `""` | Tertiary Groq API key |
| `GROQ_API_KEY_4` | `str` | `""` | Quaternary Groq API key |
| `GROQ_MODEL` | `str` | `"llama-3.3-70b-versatile"` | Default Groq model identifier |
| `GROQ_API_KEY` | `str` | `""` | Backward compatibility alias |
| `GEMINI_PRIMARY_KEY_INDEX` | `int` | `1` | Active Gemini key index to use (1 or 2) |
| `GEMINI_API_KEY_1` | `str` | `""` | Primary Gemini API key |
| `GEMINI_API_KEY_2` | `str` | `""` | Secondary Gemini API key |
| `GEMINI_MODEL` | `str` | `"gemini-1.5-flash"` | Default Gemini model identifier |
| `GEMINI_API_KEY` | `str` | `""` | Backward compatibility alias |
| `HUGGINGFACE_API_KEY` | `str` | `""` | Hugging Face Hub API key (optional for local embeddings) |
| `HF_EMBEDDING_MODEL` | `str` | `"sentence-transformers/all-MiniLM-L6-v2"` | Embedding model identifier |
| `AI_DEFAULT_PROVIDER` | `str` | `"groq"` | Initial default inference provider |
| `AI_ENABLE_GROQ` | `bool` | `true` | Feature flag to enable/disable Groq provider |
| `AI_ENABLE_GEMINI` | `bool` | `true` | Feature flag to enable/disable Gemini provider |
| `AI_ENABLE_HUGGINGFACE` | `bool` | `true` | Feature flag to enable/disable Hugging Face provider |
| `AI_REQUEST_TIMEOUT` | `int` | `30` | Max timeout in seconds for external requests |
| `AI_MAX_RETRIES` | `int` | `2` | Number of retries on transient network/timeout errors |
| `EMBEDDING_MODEL` | `str` | `"all-MiniLM-L6-v2"` | Local sentence transformer model |
| `SIMILARITY_THRESHOLD` | `float` | `0.75` | Minimum cosine similarity for narrative linking |
| `ENTITY_MATCH_THRESHOLD` | `float` | `0.80` | Minimum score for criminal entity resolution |

---

## 3. Key Selection & Rate Limit Compliance

### Explicit Primary Key Selection
KRITAGAS supports multi-key configuration for deployment flexibility (e.g. separating development, staging, or department quotas):
```bash
# Select key 2 as active key for Groq
GROQ_PRIMARY_KEY_INDEX=2
GROQ_API_KEY_2="gsk_..."
```

> **Security & Compliance Note**: The system does **not** dynamically rotate or cycle credentials at runtime to bypass API rate limits or evasion policies. Key selection is strictly controlled via `GROQ_PRIMARY_KEY_INDEX` and `GEMINI_PRIMARY_KEY_INDEX`.

---

## 4. Task-Based Provider Routing

Different investigative tasks are assigned to specialized providers:

| Task Type (`TaskType`) | Primary Provider | Fallback Chain | Rationale |
| :--- | :--- | :--- | :--- |
| `TEXT_COMPLETION` | `groq` | `gemini` → `local_fallback` | Ultra-low latency LPU inference |
| `STRUCTURED_EXTRACTION` | `groq` | `gemini` → `local_fallback` | Strict JSON output generation |
| `SUMMARIZATION` | `gemini` | `groq` → `local_fallback` | Large token context window |
| `INTELLIGENCE_REPORT` | `gemini` | `groq` → `local_fallback` | Comprehensive multimodal reasoning |
| `EMBEDDING` | `huggingface` | Local SentenceTransformers | Offline, reproducible 384-d vectors |
| `ANOMALY_EXPLANATION` | `groq` | `gemini` → `local_fallback` | Fast investigator explanation loops |
| `ENTITY_RESOLUTION` | `groq` | `huggingface` → `local_fallback`| Name matching & semantic alignment |

---

## 5. Health Monitoring & Probes

### `GET /api/v1/health/ai`
The dedicated AI health probe returns operational readiness for all configured providers:
- **Zero Paid Calls**: Does **not** invoke paid inference or consume token quotas.
- **Credential Masking**: Keys are never leaked in API outputs or logs (e.g., `gsk_...9a2f`).
- **Graceful Unconfigured Mode**: If no keys are present, the endpoint returns `200 OK` with status `"unconfigured"` and local fallback `"ready"`.

#### Example Response:
```json
{
  "status": "healthy",
  "default_provider": "groq",
  "configured_providers": ["groq", "gemini", "huggingface"],
  "providers": {
    "groq": {
      "provider": "groq",
      "configured": true,
      "enabled": true,
      "model": "llama-3.3-70b-versatile",
      "active_key_index": 1,
      "key_masked": "gsk_...3fa2",
      "status": "ready",
      "details": "Primary key index 1 (set)"
    },
    "gemini": {
      "provider": "gemini",
      "configured": true,
      "enabled": true,
      "model": "gemini-1.5-flash",
      "active_key_index": 1,
      "key_masked": "AIza...4b1c",
      "status": "ready",
      "details": "Primary key index 1 (set)"
    },
    "huggingface": {
      "provider": "huggingface",
      "configured": true,
      "enabled": true,
      "model": "sentence-transformers/all-MiniLM-L6-v2",
      "active_key_index": null,
      "key_masked": "local_model",
      "status": "ready",
      "details": "Remote key: none (local embedding engine active)"
    },
    "local_fallback": {
      "provider": "local_fallback",
      "configured": true,
      "enabled": true,
      "model": "kritagas-heuristic-v1",
      "active_key_index": null,
      "key_masked": null,
      "status": "ready",
      "details": "Local heuristic fallback engine is permanently ready."
    }
  },
  "timestamp": "2026-09-07T22:50:00.000000Z"
}
```

---

## 6. Testing & Validation

Run the dedicated AI test suite:
```bash
cd backend
python -m pytest tests/ai/ -v
```

This suite validates:
1. Configuration loading, key resolution, and primary index overrides.
2. Provider instantiation, offline graceful mode, and response envelope normalization.
3. Fallback routing across task types.
4. Structured Pydantic extraction validation.
5. Passive `/api/v1/health/ai` and `/api/v1/health/ready` probe outputs.
