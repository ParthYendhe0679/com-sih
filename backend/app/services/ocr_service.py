"""KRITAGAS Centralized Optical Character Recognition (OCR) Service.

Provides a robust, multi-tier document extraction pipeline for physical FIRs,
legal scans, PDFs, and crime evidence documents.
"""

import asyncio
import base64
import io
import time
from typing import Any, Dict, List, Optional
from PIL import Image, ImageEnhance, ImageOps
from pydantic import BaseModel

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("kritagas.ocr_service")

MINIMUM_TEXT_LENGTH = 15


class OCRResult(BaseModel):
    """Standardized OCR extraction result envelope."""
    success: bool
    text: str
    cleaned_text: str
    confidence: float
    page_count: int
    provider: str
    processing_time_ms: float
    file_type: str
    metadata: Dict[str, Any] = {}
    error: Optional[str] = None


class OCRService:
    """Multi-tiered OCR and document text extraction service."""

    def __init__(self):
        self.min_length = MINIMUM_TEXT_LENGTH

    def preprocess_image(self, image_bytes: bytes) -> Image.Image:
        """Preprocesses scanned document images for improved character recognition.
        Performs orientation normalization, contrast enhancement, and noise dampening.
        Preserves original raw bytes intact.
        """
        try:
            image = Image.open(io.BytesIO(image_bytes))
            # Auto-orient based on EXIF tag if present
            image = ImageOps.exif_transpose(image)

            # Convert RGBA / Palette to RGB
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")

            # Mild contrast enhancement for faint pencil/ink police FIR scans
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(1.2)

            return image
        except Exception as e:
            logger.warning(f"[OCR_PREPROCESS] Image preprocessing warning: {e}. Falling back to raw PIL Image.")
            return Image.open(io.BytesIO(image_bytes))

    def _extract_pdf_native_text(self, pdf_bytes: bytes) -> str:
        """Extracts native embedded text from digital PDF documents using pypdf."""
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            text_parts = []
            for idx, page in enumerate(reader.pages):
                extracted = page.extract_text() or ""
                if extracted.strip():
                    text_parts.append(extracted.strip())
            return "\n\n".join(text_parts).strip()
        except Exception as e:
            logger.warning(f"[OCR_PDF] Native PDF text extraction encountered error: {e}")
            return ""

    def _extract_pdf_page_images(self, pdf_bytes: bytes) -> List[Image.Image]:
        """Extracts embedded raster images from scanned PDF pages for vision OCR."""
        images = []
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            for page in reader.pages:
                for img_obj in page.images:
                    try:
                        images.append(Image.open(io.BytesIO(img_obj.data)))
                    except Exception:
                        pass
        except Exception as e:
            logger.warning(f"[OCR_PDF] Could not extract images from PDF: {e}")
        return images

    async def _run_groq_qwen_vision_ocr(self, image: Image.Image) -> str:
        """Extracts text from an image using Groq Qwen Multimodal Vision (e.g. qwen/qwen3.8-27b)
        with multi-key round-robin failover and automatic payload optimization.
        """
        from groq import Groq

        # Prepare optimized JPEG payload (thumbnail 1200x1600 keeps police document text razor-sharp while reducing bytes)
        img_copy = image.copy()
        img_copy.thumbnail((1200, 1600))
        if img_copy.mode in ("RGBA", "P"):
            img_copy = img_copy.convert("RGB")
        buf = io.BytesIO()
        img_copy.save(buf, format="JPEG", quality=85)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        prompt = (
            "Extract all text verbatim from this legal FIR document scan / evidence image. "
            "Maintain all names, dates, sections, phone numbers, email addresses, transaction IDs, "
            "bank accounts, and monetary amounts exactly as written. Do not summarize or explain."
        )

        groq_model = getattr(settings, "GROQ_VISION_MODEL", "qwen/qwen3.8-27b")

        # Collect all configured Groq keys for automatic failover/rotation
        candidate_keys = [
            settings.get_active_groq_key(),
            settings.GROQ_API_KEY_1,
            settings.GROQ_API_KEY_2,
            settings.GROQ_API_KEY_3,
            settings.GROQ_API_KEY_4,
            settings.GROQ_API_KEY,
        ]
        keys = []
        for k in candidate_keys:
            if k and k.strip() and k.strip() not in keys:
                keys.append(k.strip())

        if not keys:
            raise RuntimeError("No Groq API keys configured for Qwen Vision OCR.")

        last_error = None
        for idx, key in enumerate(keys):
            try:
                client = Groq(api_key=key, max_retries=0, timeout=25.0)
                # Run synchronous Groq API call in threadpool to avoid blocking async event loop
                resp = await asyncio.to_thread(
                    client.chat.completions.create,
                    model=groq_model,
                    messages=[{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
                        ]
                    }],
                    max_tokens=900,
                    temperature=0.0,
                )
                content = resp.choices[0].message.content or ""
                if self.validate_text(content):
                    logger.info(f"[OCR_GROQ_QWEN] Groq key #{idx+1} succeeded with {groq_model} ({len(content)} chars)")
                    return content.strip()
            except Exception as e:
                last_error = e
                logger.warning(f"[OCR_GROQ_QWEN] Key #{idx+1} failed ({type(e).__name__}): {e}. Attempting next key...")
                continue

        raise RuntimeError(f"All Groq Qwen Vision keys failed. Last error: {last_error}")

    async def _run_gemini_vision_ocr(self, image: Image.Image) -> str:
        """Extracts text from an image using Gemini Multimodal Vision."""
        active_key = settings.get_active_gemini_key()
        if not active_key:
            raise RuntimeError("Gemini API key is not configured for OCR.")

        import google.generativeai as genai
        genai.configure(api_key=active_key)
        model = genai.GenerativeModel(settings.GEMINI_MODEL)

        prompt = (
            "You are a forensic legal OCR document analyzer. Extract all text, numbers, clauses, "
            "tables, transaction details, person names, police badge numbers, and sections verbatim "
            "from this document. Maintain the exact wording, spelling, and numerical values without hallucinating. "
            "Return only the complete extracted document text."
        )

        # Prepare optimized payload (thumbnail 1200x1600 keeps text razor-sharp while cutting transfer latency)
        img_copy = image.copy()
        img_copy.thumbnail((1200, 1600))
        if img_copy.mode in ("RGBA", "P"):
            img_copy = img_copy.convert("RGB")

        resp = await model.generate_content_async([prompt, img_copy])
        if not resp or not resp.text:
            raise RuntimeError("Gemini returned empty OCR text.")
        return resp.text.strip()

    def clean_text(self, raw_text: str) -> str:
        """Normalizes unicode characters, converts <br> tags to newlines,
        strips markdown formatting (* and **), and removes excessive blank lines.
        """
        if not raw_text:
            return ""
        import re
        # Normalize non-breaking spaces and line endings
        text = raw_text.replace("\xa0", " ").replace("\r\n", "\n").replace("\r", "\n")
        # Convert <br> and <br/> tags to newlines
        text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
        # Strip markdown bold/italic asterisks and underscores
        text = re.sub(r"\*\*|\*|__", "", text)
        # Clean leading markdown table pipes on each line
        text = re.sub(r"^[\|\s\-:]+", "", text, flags=re.MULTILINE)
        # Remove consecutive empty blank lines (keep at most 2)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def validate_text(self, text: str) -> bool:
        """Validates that extracted text is meaningful and meets minimum threshold."""
        if not text:
            return False
        cleaned = text.strip()
        if len(cleaned) < self.min_length:
            return False
        # Ensure it contains alphanumeric characters, not just punctuation/noise
        alphanumeric_count = sum(c.isalnum() for c in cleaned)
        return alphanumeric_count >= 8

    async def process_document(
        self,
        file_bytes: bytes,
        file_name: str,
        content_type: str = "application/octet-stream",
    ) -> OCRResult:
        """Complete end-to-end document OCR ingestion pipeline."""
        start_time = time.perf_counter()
        logger.info(f"[OCR_START] Received document '{file_name}' ({len(file_bytes)} bytes, type: {content_type})")

        ext = file_name.lower().split(".")[-1] if "." in file_name else ""
        extracted_text = ""
        provider_used = "native"
        confidence = 0.95
        page_count = 1

        try:
            # 1. Plain Text or Log Files
            if ext in ["txt", "text", "csv", "log", "json"]:
                extracted_text = file_bytes.decode("utf-8", errors="ignore").strip()
                provider_used = "text_utf8"
                confidence = 1.0

            # 2. PDF Documents
            elif ext == "pdf" or "pdf" in content_type.lower():
                # Attempt native PDF text extraction first
                native_text = self._extract_pdf_native_text(file_bytes)
                if self.validate_text(native_text):
                    extracted_text = native_text
                    provider_used = "pypdf_native"
                    confidence = 0.98
                    logger.info(f"[OCR_PDF] Successfully extracted native PDF text ({len(native_text)} chars)")
                else:
                    # PDF is a scanned image copy — extract images and run vision OCR
                    logger.info("[OCR_PDF] No native text found in PDF. Extracting embedded images for Vision OCR...")
                    page_images = self._extract_pdf_page_images(file_bytes)
                    if page_images:
                        page_count = len(page_images)
                        text_results = []
                        for idx, p_img in enumerate(page_images[:5]):  # limit to first 5 pages for efficiency
                            try:
                                t = await self._run_groq_qwen_vision_ocr(p_img)
                            except Exception as g_err:
                                logger.warning(f"[OCR_PDF] Groq Qwen failed on page {idx+1}: {g_err}. Trying Gemini...")
                                t = await self._run_gemini_vision_ocr(p_img)
                            if t:
                                text_results.append(t)
                        extracted_text = "\n\n".join(text_results).strip()
                        provider_used = "groq_qwen_vision"
                        confidence = 0.95
                    else:
                        raise ValueError("PDF contains neither extractable text nor readable page images.")

            # 3. Raster Image Formats (PNG, JPG, JPEG, WEBP, TIFF, BMP)
            elif ext in ["png", "jpg", "jpeg", "webp", "bmp", "tiff"] or "image" in content_type.lower():
                preprocessed_image = self.preprocess_image(file_bytes)
                try:
                    extracted_text = await self._run_groq_qwen_vision_ocr(preprocessed_image)
                    provider_used = f"groq_{getattr(settings, 'GROQ_VISION_MODEL', 'qwen/qwen3.8-27b')}"
                    confidence = 0.98
                    logger.info(f"[OCR_IMAGE] Successfully extracted image text via {provider_used} ({len(extracted_text)} chars)")
                except Exception as groq_err:
                    logger.warning(f"[OCR_IMAGE] Groq Qwen Vision failed: {groq_err}. Falling back to Gemini...")
                    extracted_text = await self._run_gemini_vision_ocr(preprocessed_image)
                    provider_used = f"gemini_vision_{settings.GEMINI_MODEL}"
                    confidence = 0.95
                    logger.info(f"[OCR_IMAGE] Successfully extracted image text via Gemini fallback ({len(extracted_text)} chars)")

            else:
                # Try generic UTF-8 decode before failing
                try:
                    text_candidate = file_bytes.decode("utf-8")
                    if self.validate_text(text_candidate):
                        extracted_text = text_candidate
                        provider_used = "fallback_utf8"
                except Exception:
                    raise ValueError(f"Unsupported file format '{ext}' for optical character recognition.")

            # Text Cleaning & Validation
            cleaned = self.clean_text(extracted_text)
            if not self.validate_text(cleaned):
                elapsed = (time.perf_counter() - start_time) * 1000.0
                logger.warning(f"[OCR_INSUFFICIENT] Extracted text from '{file_name}' insufficient ({len(cleaned)} chars).")
                return OCRResult(
                    success=False,
                    text=extracted_text,
                    cleaned_text=cleaned,
                    confidence=0.0,
                    page_count=page_count,
                    provider=provider_used,
                    processing_time_ms=round(elapsed, 2),
                    file_type=ext.upper() or "UNKNOWN",
                    error="OCR_TEXT_INSUFFICIENT: Unable to extract sufficient legible characters from this document.",
                )

            elapsed = (time.perf_counter() - start_time) * 1000.0
            logger.info(f"[OCR_COMPLETED] File '{file_name}' processed in {elapsed:.1f}ms. Total characters: {len(cleaned)}")

            return OCRResult(
                success=True,
                text=extracted_text,
                cleaned_text=cleaned,
                confidence=confidence,
                page_count=page_count,
                provider=provider_used,
                processing_time_ms=round(elapsed, 2),
                file_type=ext.upper() or "UNKNOWN",
                metadata={"character_count": len(cleaned), "word_count": len(cleaned.split())},
            )

        except Exception as err:
            elapsed = (time.perf_counter() - start_time) * 1000.0
            logger.error(f"[OCR_FAILED] Error processing document '{file_name}': {err}")
            return OCRResult(
                success=False,
                text="",
                cleaned_text="",
                confidence=0.0,
                page_count=page_count,
                provider=provider_used,
                processing_time_ms=round(elapsed, 2),
                file_type=ext.upper() or "UNKNOWN",
                error=str(err),
            )


# Global singleton instance
ocr_service = OCRService()
