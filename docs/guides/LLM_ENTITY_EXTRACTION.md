# LLM-Based Entity Extraction Guide

This document describes the architecture and implementation of FetchText's LLM-based entity extraction system.

## Core Principle

**All entity extraction uses LLM inference, never hardcoded regex patterns.**

The LLM understands context and semantics, enabling accurate extraction across diverse document formats without brittle pattern matching.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Document Processing                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │   Document   │───▶│  Text Extractor  │───▶│  LLM Entity   │  │
│  │   (PDF/etc)  │    │   (Docling)      │    │  Extractor    │  │
│  └──────────────┘    └──────────────────┘    └───────┬───────┘  │
│                                                       │          │
│                                              ┌────────▼────────┐ │
│                                              │  Entity Index   │ │
│                                              │  (Searchable)   │ │
│                                              └────────┬────────┘ │
│                                                       │          │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────▼───────┐  │
│  │  Similar     │◀───│ Similarity       │◀───│   Vector      │  │
│  │  Documents   │    │ Calculator       │    │   Embeddings  │  │
│  └──────────────┘    └──────────────────┘    └───────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Entity Types

The LLM extracts these entity categories:

### Identity Entities
- **PERSON** - Full names of individuals
- **ORGANIZATION** - Company, institution, or group names
- **EMAIL** - Email addresses
- **PHONE** - Phone/fax numbers

### Location Entities
- **ADDRESS** - Street addresses
- **CITY_STATE_ZIP** - City, state, and postal codes
- **LOCATION** - General location references

### Financial Entities
- **CURRENCY** - Monetary amounts with currency symbols
- **PERCENTAGE** - Percentage values
- **ACCOUNT_NUMBER** - Bank or account identifiers

### Temporal Entities
- **DATE** - Calendar dates in any format
- **DURATION** - Time periods (days, weeks, months)
- **TIME** - Clock times

### Document-Specific Entities
- **DOCUMENT_NUMBER** - Invoice, receipt, contract numbers
- **LICENSE_NUMBER** - Professional or business licenses
- **REFERENCE_ID** - Reference or tracking identifiers

### Domain Entities (Construction/Legal)
- **MATERIAL** - Construction materials
- **WORK_TYPE** - Types of work or services
- **LEGAL_TERM** - Legal terminology
- **MEASUREMENT** - Quantities with units

## LLM Extraction Prompt

The extraction uses a structured prompt to get consistent JSON output:

```python
ENTITY_EXTRACTION_PROMPT = """
You are an expert document analyst. Extract ALL named entities from this document.

For EACH entity found, provide:
1. value: The exact text of the entity
2. type: One of: PERSON, ORGANIZATION, EMAIL, PHONE, ADDRESS, CURRENCY, DATE, etc.
3. confidence: 0.0-1.0 based on certainty
4. context: The surrounding text (10 words before/after)

Return ONLY valid JSON in this format:
{
  "entities": [
    {
      "value": "Nicholas Yeager",
      "type": "PERSON",
      "confidence": 0.95,
      "context": "Submitted To: Nicholas Yeager Job Location:"
    }
  ],
  "document_summary": "Brief description of document type and content"
}

Important:
- Extract EVERY entity, not just the first occurrence
- Include confidence based on context clarity
- For ambiguous values, use lower confidence
- Dates should include the detected format

Document text:
{document_text}
"""
```

## Implementation

### LLMEntityExtractor Class

```python
# document-processor/app/services/llm_entity_extractor.py

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import json

@dataclass
class ExtractedEntity:
    """Represents a single extracted entity."""
    value: str
    entity_type: str
    confidence: float
    context: str
    start_pos: Optional[int] = None
    end_pos: Optional[int] = None

@dataclass
class DocumentEntityProfile:
    """Complete entity profile for a document."""
    document_id: str
    document_name: str
    entities: List[ExtractedEntity]
    entity_counts: Dict[str, int]
    document_summary: str
    raw_text: str

class LLMEntityExtractor:
    """
    Extracts entities from documents using LLM inference.
    NO hardcoded regex patterns - all extraction via LLM.
    """

    def __init__(self, llm_service):
        self.llm_service = llm_service

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
        prompt = self._build_extraction_prompt(text)
        response = await self.llm_service.generate(prompt)
        entities = self._parse_llm_response(response, text)

        # Build entity counts
        entity_counts = {}
        for entity in entities:
            entity_counts[entity.entity_type] = \
                entity_counts.get(entity.entity_type, 0) + 1

        return DocumentEntityProfile(
            document_id=document_id,
            document_name=document_name,
            entities=entities,
            entity_counts=entity_counts,
            document_summary=self._extract_summary(response),
            raw_text=text
        )

    def _build_extraction_prompt(self, text: str) -> str:
        """Build the LLM prompt for entity extraction."""
        # Truncate very long documents
        max_chars = 8000
        if len(text) > max_chars:
            text = text[:max_chars] + "\n\n[Document truncated...]"

        return ENTITY_EXTRACTION_PROMPT.format(document_text=text)

    def _parse_llm_response(
        self,
        response: str,
        original_text: str
    ) -> List[ExtractedEntity]:
        """Parse LLM response into ExtractedEntity objects."""
        try:
            # Try to parse JSON directly
            data = json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            data = self._extract_json_from_response(response)

        entities = []
        for item in data.get("entities", []):
            entity = ExtractedEntity(
                value=item.get("value", ""),
                entity_type=item.get("type", "UNKNOWN"),
                confidence=float(item.get("confidence", 0.5)),
                context=item.get("context", ""),
            )

            # Find position in original text
            pos = original_text.find(entity.value)
            if pos >= 0:
                entity.start_pos = pos
                entity.end_pos = pos + len(entity.value)

            entities.append(entity)

        return entities
```

## Searchable Entity Index

Entities are stored in a searchable index for document similarity:

```python
class EntityIndex:
    """
    Searchable index of extracted entities across documents.
    Enables finding similar documents by entity overlap.
    """

    def __init__(self, embedding_service=None):
        self.documents: Dict[str, DocumentEntityProfile] = {}
        self.embedding_service = embedding_service

    def add_document(self, profile: DocumentEntityProfile):
        """Add a document's entity profile to the index."""
        self.documents[profile.document_id] = profile

    def find_similar(
        self,
        target: DocumentEntityProfile,
        threshold: float = 0.3
    ) -> List[Tuple[str, float]]:
        """
        Find documents similar to target based on entity overlap.

        Returns list of (document_id, similarity_score) tuples.
        """
        results = []
        target_entities = self._entity_set(target)

        for doc_id, profile in self.documents.items():
            if doc_id == target.document_id:
                continue

            doc_entities = self._entity_set(profile)
            similarity = self._jaccard_similarity(target_entities, doc_entities)

            if similarity >= threshold:
                results.append((doc_id, similarity))

        return sorted(results, key=lambda x: x[1], reverse=True)

    def _entity_set(self, profile: DocumentEntityProfile) -> set:
        """Convert entity profile to comparable set."""
        return {
            (e.entity_type, e.value.lower().strip())
            for e in profile.entities
        }

    def _jaccard_similarity(self, set1: set, set2: set) -> float:
        """Calculate Jaccard similarity between entity sets."""
        if not set1 or not set2:
            return 0.0
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0
```

## Usage Examples

### Basic Entity Extraction

```python
from app.services.llm_entity_extractor import LLMEntityExtractor
from app.services.llm_service import llm_service

extractor = LLMEntityExtractor(llm_service)

# Extract entities from document
profile = await extractor.extract_entities(
    text=document_content,
    document_id="doc-123",
    document_name="Stucco Contract V1.pdf"
)

# Access extracted entities
for entity in profile.entities:
    print(f"{entity.entity_type}: {entity.value} ({entity.confidence:.0%})")
```

### Finding Similar Documents

```python
from app.services.llm_entity_extractor import EntityIndex

index = EntityIndex()

# Add documents to index
index.add_document(profile1)
index.add_document(profile2)
index.add_document(profile3)

# Find similar documents
similar = index.find_similar(target_profile, threshold=0.3)
for doc_id, score in similar:
    print(f"Document {doc_id}: {score:.0%} similar")
```

## Testing

Tests must use real LLM calls, not mocked responses:

```python
@pytest.mark.asyncio
async def test_llm_entity_extraction():
    """Test entity extraction using actual LLM."""
    # Load real document
    with open("tests/fixtures/stucco_contract.pdf", "rb") as f:
        text = await extract_text_from_pdf(f)

    # Extract entities using real LLM
    extractor = LLMEntityExtractor(llm_service)
    profile = await extractor.extract_entities(text)

    # Validate expected entities exist
    assert any(e.entity_type == "PERSON" for e in profile.entities)
    assert any(e.entity_type == "CURRENCY" for e in profile.entities)
    assert any(e.entity_type == "DATE" for e in profile.entities)

    # Validate specific known values
    emails = [e.value for e in profile.entities if e.entity_type == "EMAIL"]
    assert "yeag123@gmail.com" in emails
```

## Migration from Regex

When migrating existing regex-based extraction:

1. **Identify regex patterns** - Find all `re.compile`, `re.match`, `re.search`, `re.findall`
2. **Categorize usage**:
   - Entity extraction → Must replace with LLM
   - JSON cleanup → Can keep
   - Text processing → Can keep
3. **Create LLM prompts** - Design prompts that extract the same entity types
4. **Test with real documents** - Verify LLM extracts same/better entities
5. **Remove regex code** - Delete the hardcoded patterns

## Performance Considerations

- **Batching**: For large documents, consider batching text chunks
- **Caching**: Cache entity profiles to avoid re-extraction
- **Async**: Use async LLM calls for parallel processing
- **Fallback**: If LLM is unavailable, queue document for later processing (never fall back to regex)
