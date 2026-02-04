"""
LLM-Based Entity Extractor

Extracts named entities from documents using LLM inference.
NO hardcoded regex patterns - all extraction via LLM.

This is the ONLY approved method for entity extraction in FetchText.
See docs/guides/LLM_ENTITY_EXTRACTION.md for architecture details.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Tuple
import json
import logging

logger = logging.getLogger(__name__)


# Entity extraction prompt - the core of LLM-based extraction
ENTITY_EXTRACTION_PROMPT = """You are an expert document analyst. Extract ALL named entities from this document.

For EACH entity found, provide:
1. value: The exact text of the entity as it appears in the document
2. type: One of the entity types listed below
3. confidence: 0.0-1.0 based on how certain you are
4. context: The surrounding text (about 5-10 words before and after)

Entity Types:
- PERSON: Full names of individuals (e.g., "John Smith", "Jane Doe")
- ORGANIZATION: Company, institution, or group names (e.g., "Acme Corp", "State University")
- EMAIL: Email addresses
- PHONE: Phone or fax numbers
- ADDRESS: Street addresses (e.g., "123 Main St")
- CITY_STATE_ZIP: City, state, and postal code (e.g., "Phoenix, AZ 85001")
- CURRENCY: Monetary amounts (e.g., "$8,000.00", "USD 500")
- PERCENTAGE: Percentage values (e.g., "50%", "25 percent")
- DATE: Calendar dates in any format (e.g., "12/05/2025", "January 15, 2024")
- DURATION: Time periods (e.g., "30 days", "2 weeks")
- DOCUMENT_NUMBER: Invoice, receipt, contract numbers
- LICENSE_NUMBER: Professional or business license numbers
- REFERENCE_ID: Reference or tracking identifiers
- MATERIAL: Construction/manufacturing materials (e.g., "stucco", "concrete", "lumber")
- WORK_TYPE: Types of work or services (e.g., "installation", "repair", "renovation")
- LEGAL_TERM: Legal terminology (e.g., "warranty", "indemnification", "liability")
- MEASUREMENT: Quantities with units (e.g., "500 sq ft", "100 gallons")

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{{
  "entities": [
    {{
      "value": "Nicholas Yeager",
      "type": "PERSON",
      "confidence": 0.95,
      "context": "Submitted To: Nicholas Yeager Job Location:"
    }},
    {{
      "value": "$8,000.00",
      "type": "CURRENCY",
      "confidence": 0.98,
      "context": "TOTAL PROJECT PRICE: $8,000.00 Payment Schedule:"
    }}
  ],
  "document_summary": "Brief description of document type and content"
}}

Important extraction rules:
- Extract EVERY entity, including duplicates if they appear multiple times
- For PERSON entities, only extract actual human names, not labels like "Owner" or "Contractor"
- Include confidence based on context clarity (0.9+ for clear context, 0.7 for ambiguous)
- For dates, include them regardless of format
- For currency, include the currency symbol if present

Document text:
{document_text}
"""


@dataclass
class ExtractedEntity:
    """Represents a single extracted entity."""
    value: str
    entity_type: str
    confidence: float
    context: str
    start_pos: Optional[int] = None
    end_pos: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


@dataclass
class DocumentEntityProfile:
    """Complete entity profile for a document."""
    document_id: str
    document_name: str
    entities: List[ExtractedEntity]
    entity_counts: Dict[str, int]
    document_summary: str
    raw_text: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "document_id": self.document_id,
            "document_name": self.document_name,
            "entities": [e.to_dict() for e in self.entities],
            "entity_counts": self.entity_counts,
            "document_summary": self.document_summary,
            "raw_text_length": len(self.raw_text)
        }

    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), indent=2)

    def get_entities_by_type(self, entity_type: str) -> List[ExtractedEntity]:
        """Get all entities of a specific type."""
        return [e for e in self.entities if e.entity_type == entity_type]

    def get_unique_values(self, entity_type: str) -> List[str]:
        """Get unique values for an entity type."""
        return list(set(e.value for e in self.get_entities_by_type(entity_type)))


class LLMEntityExtractor:
    """
    Extracts entities from documents using LLM inference.

    This is the ONLY approved method for entity extraction in FetchText.
    NO hardcoded regex patterns - all extraction via LLM.
    """

    def __init__(self, llm_service=None):
        """
        Initialize the extractor.

        Args:
            llm_service: The LLM service to use for extraction.
                         If None, will be loaded lazily.
        """
        self._llm_service = llm_service
        self._cached_service = None

    def _get_llm_service(self):
        """Get the LLM service, loading lazily if needed."""
        if self._llm_service is not None:
            return self._llm_service

        if self._cached_service is None:
            from app.services.llm_service import llm_service
            self._cached_service = llm_service

        return self._cached_service

    async def extract_entities(
        self,
        text: str,
        document_id: str = "unknown",
        document_name: str = "unknown"
    ) -> DocumentEntityProfile:
        """
        Extract all entities from document text using LLM.

        Args:
            text: Document text content
            document_id: Unique document identifier
            document_name: Human-readable document name

        Returns:
            DocumentEntityProfile with all extracted entities
        """
        logger.info(f"Extracting entities from document: {document_name}")
        logger.debug(f"Text length: {len(text)} characters")

        prompt = self._build_extraction_prompt(text)

        try:
            llm = self._get_llm_service()
            # Use complete() method with JSON format for structured output
            # Explicitly use Azure OpenAI for faster, more reliable extraction
            response = await llm.complete(
                prompt,
                provider="azure_openai",  # Use Azure OpenAI (configured in environment)
                format="json",
                temperature=0.1,  # Low temperature for consistent extraction
                max_tokens=2000,
                timeout=60.0  # Allow time for extraction
            )
            logger.debug(f"LLM response length: {len(response)} characters")
        except Exception as e:
            logger.error(f"LLM extraction failed: {e}")
            # Return empty profile on LLM failure - never fall back to regex
            return DocumentEntityProfile(
                document_id=document_id,
                document_name=document_name,
                entities=[],
                entity_counts={},
                document_summary=f"Extraction failed: {str(e)}",
                raw_text=text
            )

        entities = self._parse_llm_response(response, text)
        summary = self._extract_summary(response)

        # Build entity counts
        entity_counts: Dict[str, int] = {}
        for entity in entities:
            entity_counts[entity.entity_type] = \
                entity_counts.get(entity.entity_type, 0) + 1

        profile = DocumentEntityProfile(
            document_id=document_id,
            document_name=document_name,
            entities=entities,
            entity_counts=entity_counts,
            document_summary=summary,
            raw_text=text
        )

        logger.info(
            f"Extracted {len(entities)} entities: "
            f"{dict(sorted(entity_counts.items()))}"
        )

        return profile

    def extract_entities_sync(
        self,
        text: str,
        document_id: str = "unknown",
        document_name: str = "unknown"
    ) -> DocumentEntityProfile:
        """
        Synchronous wrapper for entity extraction.

        Use this when you can't use async/await.
        """
        import asyncio

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(
            self.extract_entities(text, document_id, document_name)
        )

    def _build_extraction_prompt(self, text: str) -> str:
        """Build the LLM prompt for entity extraction."""
        # Truncate very long documents to fit in context window
        max_chars = 8000
        if len(text) > max_chars:
            text = text[:max_chars] + "\n\n[Document truncated for processing...]"
            logger.warning(f"Document truncated from {len(text)} to {max_chars} chars")

        return ENTITY_EXTRACTION_PROMPT.format(document_text=text)

    def _parse_llm_response(
        self,
        response: str,
        original_text: str
    ) -> List[ExtractedEntity]:
        """Parse LLM response into ExtractedEntity objects."""
        data = None

        # Strategy 1: Try direct JSON parse
        try:
            data = json.loads(response)
        except json.JSONDecodeError:
            pass

        # Strategy 2: Try to extract JSON from markdown code block
        if data is None:
            try:
                if "```json" in response:
                    json_str = response.split("```json")[1].split("```")[0]
                    data = json.loads(json_str)
                elif "```" in response:
                    json_str = response.split("```")[1].split("```")[0]
                    data = json.loads(json_str)
            except (json.JSONDecodeError, IndexError):
                pass

        # Strategy 3: Try to find JSON object in response
        if data is None:
            try:
                # Find first { and last }
                start = response.find("{")
                end = response.rfind("}") + 1
                if start >= 0 and end > start:
                    json_str = response[start:end]
                    # Fix common JSON issues
                    json_str = self._fix_json(json_str)
                    data = json.loads(json_str)
            except json.JSONDecodeError:
                pass

        if data is None:
            logger.error("Failed to parse LLM response as JSON")
            logger.debug(f"Response was: {response[:500]}...")
            return []

        entities = []
        for item in data.get("entities", []):
            try:
                entity = ExtractedEntity(
                    value=str(item.get("value", "")).strip(),
                    entity_type=str(item.get("type", "UNKNOWN")).upper(),
                    confidence=float(item.get("confidence", 0.5)),
                    context=str(item.get("context", "")),
                )

                # Skip empty values
                if not entity.value:
                    continue

                # Find position in original text
                pos = original_text.find(entity.value)
                if pos >= 0:
                    entity.start_pos = pos
                    entity.end_pos = pos + len(entity.value)

                entities.append(entity)
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to parse entity: {item}, error: {e}")
                continue

        return entities

    def _fix_json(self, json_str: str) -> str:
        """Fix common JSON formatting issues from LLM responses."""
        import re
        # Remove trailing commas before } or ]
        json_str = re.sub(r',\s*}', '}', json_str)
        json_str = re.sub(r',\s*]', ']', json_str)
        return json_str

    def _extract_summary(self, response: str) -> str:
        """Extract document summary from LLM response."""
        try:
            data = json.loads(response)
            return data.get("document_summary", "")
        except json.JSONDecodeError:
            pass

        # Try to extract from partially parsed response
        try:
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                json_str = self._fix_json(response[start:end])
                data = json.loads(json_str)
                return data.get("document_summary", "")
        except json.JSONDecodeError:
            pass

        return ""


class EntityIndex:
    """
    Searchable index of extracted entities across documents.
    Enables finding similar documents by entity overlap.
    """

    def __init__(self, embedding_service=None):
        """
        Initialize the entity index.

        Args:
            embedding_service: Optional service for vector embeddings.
        """
        self.documents: Dict[str, DocumentEntityProfile] = {}
        self.embedding_service = embedding_service

    def add_document(self, profile: DocumentEntityProfile):
        """Add a document's entity profile to the index."""
        self.documents[profile.document_id] = profile
        logger.debug(
            f"Added document {profile.document_id} to index "
            f"({len(profile.entities)} entities)"
        )

    def remove_document(self, document_id: str):
        """Remove a document from the index."""
        if document_id in self.documents:
            del self.documents[document_id]
            logger.debug(f"Removed document {document_id} from index")

    def get_document(self, document_id: str) -> Optional[DocumentEntityProfile]:
        """Get a document's entity profile by ID."""
        return self.documents.get(document_id)

    def find_similar(
        self,
        target: DocumentEntityProfile,
        threshold: float = 0.3,
        max_results: int = 10
    ) -> List[Tuple[str, float, DocumentEntityProfile]]:
        """
        Find documents similar to target based on entity overlap.

        Args:
            target: The document to find similar documents for
            threshold: Minimum similarity score (0.0-1.0)
            max_results: Maximum number of results to return

        Returns:
            List of (document_id, similarity_score, profile) tuples,
            sorted by similarity descending.
        """
        results = []
        target_entities = self._entity_set(target)

        if not target_entities:
            logger.warning("Target document has no entities")
            return []

        for doc_id, profile in self.documents.items():
            if doc_id == target.document_id:
                continue

            doc_entities = self._entity_set(profile)
            if not doc_entities:
                continue

            # Calculate multiple similarity metrics
            jaccard = self._jaccard_similarity(target_entities, doc_entities)
            weighted = self._weighted_similarity(target, profile)

            # Combined score
            similarity = (jaccard + weighted) / 2

            if similarity >= threshold:
                results.append((doc_id, similarity, profile))

        # Sort by similarity and limit results
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:max_results]

    def find_by_entity(
        self,
        entity_type: str,
        value: str,
        exact_match: bool = False
    ) -> List[Tuple[str, DocumentEntityProfile]]:
        """
        Find documents containing a specific entity.

        Args:
            entity_type: Type of entity to search for
            value: Value to search for
            exact_match: If True, require exact match; else substring match

        Returns:
            List of (document_id, profile) tuples.
        """
        results = []
        value_lower = value.lower().strip()

        for doc_id, profile in self.documents.items():
            for entity in profile.entities:
                if entity.entity_type != entity_type:
                    continue

                entity_value = entity.value.lower().strip()

                if exact_match:
                    if entity_value == value_lower:
                        results.append((doc_id, profile))
                        break
                else:
                    if value_lower in entity_value or entity_value in value_lower:
                        results.append((doc_id, profile))
                        break

        return results

    def _entity_set(self, profile: DocumentEntityProfile) -> set:
        """Convert entity profile to comparable set of (type, value) tuples."""
        return {
            (e.entity_type, e.value.lower().strip())
            for e in profile.entities
            if e.value.strip()
        }

    def _jaccard_similarity(self, set1: set, set2: set) -> float:
        """Calculate Jaccard similarity between entity sets."""
        if not set1 or not set2:
            return 0.0
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0

    def _weighted_similarity(
        self,
        profile1: DocumentEntityProfile,
        profile2: DocumentEntityProfile
    ) -> float:
        """
        Calculate weighted similarity based on entity type importance.

        Some entity types are more indicative of document similarity.
        """
        # Weights for different entity types
        weights = {
            "PERSON": 1.5,
            "ORGANIZATION": 2.0,
            "CURRENCY": 1.0,
            "DATE": 0.5,
            "EMAIL": 2.0,
            "PHONE": 1.5,
            "ADDRESS": 1.5,
            "DOCUMENT_NUMBER": 2.5,
            "MATERIAL": 1.0,
            "WORK_TYPE": 1.0,
        }
        default_weight = 0.5

        total_weight = 0.0
        matched_weight = 0.0

        entities1 = self._entity_set(profile1)
        entities2 = self._entity_set(profile2)

        for entity_type, value in entities1:
            weight = weights.get(entity_type, default_weight)
            total_weight += weight

            if (entity_type, value) in entities2:
                matched_weight += weight

        return matched_weight / total_weight if total_weight > 0 else 0.0

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the index."""
        total_entities = sum(
            len(p.entities) for p in self.documents.values()
        )

        type_counts: Dict[str, int] = {}
        for profile in self.documents.values():
            for entity_type, count in profile.entity_counts.items():
                type_counts[entity_type] = type_counts.get(entity_type, 0) + count

        return {
            "document_count": len(self.documents),
            "total_entities": total_entities,
            "entities_by_type": dict(sorted(type_counts.items())),
            "avg_entities_per_doc": (
                total_entities / len(self.documents)
                if self.documents else 0
            )
        }


# Singleton instance for convenience
_default_extractor: Optional[LLMEntityExtractor] = None


def get_entity_extractor() -> LLMEntityExtractor:
    """Get the default entity extractor instance."""
    global _default_extractor
    if _default_extractor is None:
        _default_extractor = LLMEntityExtractor()
    return _default_extractor
