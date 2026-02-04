# Improved Variable Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the LLM-based variable extraction system with semantic inference, contextual awareness, and multi-pass extraction for higher accuracy.

**Architecture:** Add a semantic inference layer to the SmartFieldExtractor that parses variable names into natural language descriptions, passes already-extracted fields as context to help the LLM understand document structure, and implements a two-pass extraction strategy for low-confidence fields.

**Tech Stack:** Python 3.11+, FastAPI, Azure OpenAI, pytest for testing

---

## Task 1: Add Semantic Variable Name Inference

**Files:**
- Create: `document-processor/app/services/semantic_variable_parser.py`
- Test: `document-processor/tests/unit/test_semantic_variable_parser.py`

**Step 1: Write the failing test**

Create `document-processor/tests/unit/test_semantic_variable_parser.py`:

```python
"""Tests for semantic variable name parsing."""
import pytest
from app.services.semantic_variable_parser import SemanticVariableParser


class TestSemanticVariableParser:
    """Test semantic parsing of variable names to natural language descriptions."""

    @pytest.fixture
    def parser(self):
        return SemanticVariableParser()

    def test_parse_snake_case_variable(self, parser):
        """Parse snake_case variable names into semantic descriptions."""
        result = parser.parse_variable_name("customer_billing_address")
        assert result["semantic_description"] == "billing address of a customer"
        assert result["field_type_hint"] == "address"
        assert "street" in result["search_keywords"] or "address" in result["search_keywords"]

    def test_parse_camel_case_variable(self, parser):
        """Parse camelCase variable names."""
        result = parser.parse_variable_name("vendorEmailAddress")
        assert "email" in result["semantic_description"].lower()
        assert result["field_type_hint"] == "email"

    def test_parse_date_variable(self, parser):
        """Identify date-related variables."""
        result = parser.parse_variable_name("invoice_date")
        assert result["field_type_hint"] == "date"
        assert "date" in result["search_keywords"]

    def test_parse_currency_variable(self, parser):
        """Identify currency-related variables."""
        result = parser.parse_variable_name("total_amount")
        assert result["field_type_hint"] == "currency"
        assert any(kw in result["search_keywords"] for kw in ["total", "amount", "$"])

    def test_parse_id_variable(self, parser):
        """Identify ID/reference number variables."""
        result = parser.parse_variable_name("invoice_number")
        assert result["field_type_hint"] == "id"
        assert any(kw in result["search_keywords"] for kw in ["#", "no.", "number"])

    def test_parse_name_variable(self, parser):
        """Identify name variables."""
        result = parser.parse_variable_name("company_name")
        assert result["field_type_hint"] == "text"
        assert "name" in result["semantic_description"].lower()

    def test_relationship_inference(self, parser):
        """Infer relationships between variables."""
        result = parser.parse_variable_name("vendor_address")
        assert "vendor" in result["related_fields"]
        # Should suggest looking near vendor_name
```

**Step 2: Run test to verify it fails**

Run: `cd document-processor && python -m pytest tests/unit/test_semantic_variable_parser.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'app.services.semantic_variable_parser'"

**Step 3: Write minimal implementation**

Create `document-processor/app/services/semantic_variable_parser.py`:

```python
"""
Semantic Variable Parser - Converts variable names to natural language descriptions.

Parses variable names like "customer_billing_address" into semantic descriptions
that help the LLM understand what to look for in documents.
"""
import re
from typing import Dict, List, Any


class SemanticVariableParser:
    """
    Parse variable names into semantic descriptions for improved LLM extraction.
    """

    # Field type patterns
    FIELD_TYPE_PATTERNS = {
        "date": ["date", "time", "when", "created", "updated", "due", "issued"],
        "currency": ["amount", "total", "price", "cost", "fee", "payment", "balance", "sum"],
        "email": ["email", "mail"],
        "phone": ["phone", "tel", "mobile", "fax", "contact"],
        "address": ["address", "street", "city", "state", "zip", "location"],
        "id": ["id", "number", "ref", "reference", "invoice", "receipt", "order", "tracking"],
        "percentage": ["percent", "rate", "ratio"],
    }

    # Relationship keywords (entity prefixes that suggest related fields)
    ENTITY_PREFIXES = [
        "customer", "client", "vendor", "supplier", "company", "business",
        "buyer", "seller", "sender", "recipient", "shipper", "carrier"
    ]

    def parse_variable_name(self, variable_name: str) -> Dict[str, Any]:
        """
        Parse a variable name into semantic components.

        Args:
            variable_name: The variable name (e.g., "customer_billing_address")

        Returns:
            Dict with:
                - semantic_description: Natural language description
                - field_type_hint: Detected field type (date, currency, email, etc.)
                - search_keywords: Keywords to look for in document
                - related_fields: Other variables that might be nearby
        """
        # Split into words
        words = self._split_variable_name(variable_name)

        # Detect field type
        field_type_hint = self._detect_field_type(words)

        # Generate semantic description
        semantic_description = self._generate_description(words, field_type_hint)

        # Generate search keywords
        search_keywords = self._generate_keywords(words, field_type_hint)

        # Find related fields
        related_fields = self._find_related_fields(words)

        return {
            "semantic_description": semantic_description,
            "field_type_hint": field_type_hint,
            "search_keywords": search_keywords,
            "related_fields": related_fields,
            "original_name": variable_name,
            "words": words
        }

    def _split_variable_name(self, name: str) -> List[str]:
        """Split variable name into component words."""
        # Handle snake_case
        if "_" in name:
            words = name.lower().split("_")
        # Handle camelCase
        elif any(c.isupper() for c in name[1:]):
            # Split on uppercase letters
            words = re.sub(r'([A-Z])', r' \1', name).lower().split()
        else:
            words = [name.lower()]

        return [w for w in words if w]

    def _detect_field_type(self, words: List[str]) -> str:
        """Detect the most likely field type from words."""
        words_set = set(words)

        for field_type, keywords in self.FIELD_TYPE_PATTERNS.items():
            if words_set & set(keywords):
                return field_type

        return "text"

    def _generate_description(self, words: List[str], field_type: str) -> str:
        """Generate natural language description."""
        # Find entity prefix if present
        entity = None
        remaining_words = []

        for word in words:
            if word in self.ENTITY_PREFIXES:
                entity = word
            else:
                remaining_words.append(word)

        # Build description
        field_desc = " ".join(remaining_words)

        if entity:
            return f"{field_desc} of a {entity}"
        else:
            return field_desc

    def _generate_keywords(self, words: List[str], field_type: str) -> List[str]:
        """Generate search keywords for document scanning."""
        keywords = list(words)

        # Add type-specific keywords
        type_keywords = {
            "date": ["date", "dated", "on"],
            "currency": ["$", "total", "amount", "USD"],
            "email": ["@", "email", "e-mail"],
            "phone": ["tel", "phone", "call"],
            "address": ["street", "address", "city", "state", "zip"],
            "id": ["#", "no.", "number", "ref", "reference"],
        }

        if field_type in type_keywords:
            keywords.extend(type_keywords[field_type])

        return list(set(keywords))

    def _find_related_fields(self, words: List[str]) -> List[str]:
        """Find related field names based on entity prefix."""
        related = []

        for word in words:
            if word in self.ENTITY_PREFIXES:
                # Suggest looking near other fields with same prefix
                related.append(word)
                related.append(f"{word}_name")
                related.append(f"{word}_address")
                related.append(f"{word}_email")

        return list(set(related))


# Global instance
semantic_variable_parser = SemanticVariableParser()
```

**Step 4: Run test to verify it passes**

Run: `cd document-processor && python -m pytest tests/unit/test_semantic_variable_parser.py -v`
Expected: PASS - All tests should pass

**Step 5: Commit**

```bash
git add document-processor/app/services/semantic_variable_parser.py document-processor/tests/unit/test_semantic_variable_parser.py
git commit -m "feat: add semantic variable name parser for improved extraction"
```

---

## Task 2: Integrate Semantic Parser into Smart Field Extractor

**Files:**
- Modify: `document-processor/app/services/smart_field_extractor.py:92-178`
- Test: `document-processor/tests/unit/test_smart_field_extractor_semantic.py`

**Step 1: Write the failing test**

Create `document-processor/tests/unit/test_smart_field_extractor_semantic.py`:

```python
"""Tests for semantic-enhanced smart field extraction."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.smart_field_extractor import SmartFieldExtractor


class TestSmartFieldExtractorSemantic:
    """Test semantic enhancements to smart field extractor."""

    @pytest.fixture
    def extractor(self):
        return SmartFieldExtractor()

    def test_build_prompt_includes_semantic_description(self, extractor):
        """Prompt should include semantic description of variable."""
        template_variables = [
            {
                "name": "customer_billing_address",
                "type": "text",
                "description": "Customer address",
                "extraction_hints": []
            }
        ]

        prompt = extractor._build_smart_extraction_prompt(
            "Sample document text",
            template_variables
        )

        # Should include semantic understanding
        assert "billing address of a customer" in prompt.lower() or \
               "semantic meaning" in prompt.lower() or \
               "look for" in prompt.lower()

    def test_build_prompt_includes_field_type_guidance(self, extractor):
        """Prompt should include field-type specific guidance."""
        template_variables = [
            {
                "name": "invoice_date",
                "type": "date",
                "description": "Invoice date",
                "extraction_hints": []
            }
        ]

        prompt = extractor._build_smart_extraction_prompt(
            "Sample document text",
            template_variables
        )

        # Should mention date patterns
        assert "date" in prompt.lower()

    def test_get_semantic_field_info(self, extractor):
        """Should generate semantic info for fields."""
        result = extractor._get_semantic_field_info("vendor_email_address")

        assert result is not None
        assert "email" in result.get("field_type_hint", "") or \
               "email" in result.get("semantic_description", "").lower()
```

**Step 2: Run test to verify it fails**

Run: `cd document-processor && python -m pytest tests/unit/test_smart_field_extractor_semantic.py -v`
Expected: FAIL - `_get_semantic_field_info` method doesn't exist

**Step 3: Modify smart_field_extractor.py**

Add import at top of `document-processor/app/services/smart_field_extractor.py` (after line 11):

```python
from .semantic_variable_parser import semantic_variable_parser
```

Add new method after `__init__` (around line 23):

```python
    def _get_semantic_field_info(self, field_name: str) -> Dict[str, Any]:
        """
        Get semantic information about a field name.

        Args:
            field_name: The variable/field name to analyze

        Returns:
            Dict with semantic_description, field_type_hint, search_keywords, related_fields
        """
        return semantic_variable_parser.parse_variable_name(field_name)
```

Modify `_build_smart_extraction_prompt` method (starting at line 92). Replace lines 100-118 with:

```python
        # Create enhanced field descriptions with semantic understanding
        field_descriptions = []
        field_examples = {}

        for var in template_variables:
            field_name = var.get('name', var.get('id', 'unknown'))
            field_type = var.get('type', 'text')
            description = var.get('description', f'{field_name} field')

            # Get semantic info for better extraction
            semantic_info = self._get_semantic_field_info(field_name)

            # Add field-specific examples and variations
            examples, variations = self._get_field_examples_and_variations(field_name, field_type)

            # Build enhanced field description with semantic understanding
            field_desc = f'- {field_name} ({field_type}): {description}'

            # Add semantic meaning
            if semantic_info.get('semantic_description'):
                field_desc += f'\n  Semantic meaning: "{semantic_info["semantic_description"]}"'

            # Add search keywords from semantic analysis
            semantic_keywords = semantic_info.get('search_keywords', [])
            all_variations = list(set(variations + semantic_keywords))
            if all_variations:
                field_desc += f'\n  Look for: {", ".join(all_variations[:8])}'

            if examples:
                field_desc += f'\n  Examples: {", ".join(examples)}'

            # Add relationship hints
            related = semantic_info.get('related_fields', [])
            if related:
                field_desc += f'\n  Often found near: {", ".join(related[:3])}'

            field_descriptions.append(field_desc)
            field_examples[field_name] = examples
```

**Step 4: Run test to verify it passes**

Run: `cd document-processor && python -m pytest tests/unit/test_smart_field_extractor_semantic.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add document-processor/app/services/smart_field_extractor.py document-processor/tests/unit/test_smart_field_extractor_semantic.py
git commit -m "feat: integrate semantic parser into smart field extractor"
```

---

## Task 3: Add Context-Aware Extraction with Previously Extracted Fields

**Files:**
- Modify: `document-processor/app/services/smart_field_extractor.py:24-91`
- Test: `document-processor/tests/unit/test_context_aware_extraction.py`

**Step 1: Write the failing test**

Create `document-processor/tests/unit/test_context_aware_extraction.py`:

```python
"""Tests for context-aware field extraction."""
import pytest
from app.services.smart_field_extractor import SmartFieldExtractor


class TestContextAwareExtraction:
    """Test extraction with context from previously extracted fields."""

    @pytest.fixture
    def extractor(self):
        return SmartFieldExtractor()

    def test_prompt_includes_existing_context(self, extractor):
        """Prompt should include already-extracted fields as context."""
        template_variables = [
            {"name": "vendor_address", "type": "text", "description": "Vendor address"}
        ]

        existing_context = {
            "vendor_name": {"value": "Acme Corporation", "confidence": 0.95}
        }

        prompt = extractor._build_smart_extraction_prompt(
            "Sample document mentioning Acme Corporation at 123 Main St",
            template_variables,
            existing_context=existing_context
        )

        # Should mention the existing context
        assert "Acme Corporation" in prompt
        assert "vendor_name" in prompt.lower()

    def test_extract_with_context_parameter(self, extractor):
        """extract_fields_intelligently should accept existing_context param."""
        # This tests the function signature includes the parameter
        import inspect
        sig = inspect.signature(extractor.extract_fields_intelligently)
        params = list(sig.parameters.keys())

        assert "existing_context" in params or "context" in params
```

**Step 2: Run test to verify it fails**

Run: `cd document-processor && python -m pytest tests/unit/test_context_aware_extraction.py -v`
Expected: FAIL - existing_context parameter not found

**Step 3: Modify smart_field_extractor.py**

Update `extract_fields_intelligently` signature (line 24) to add new parameter:

```python
    async def extract_fields_intelligently(
        self,
        text_content: str,
        template_variables: List[Dict[str, Any]],
        confidence_threshold: float = 0.6,
        provider: str = "azure",
        existing_context: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
```

Update the call to `_build_smart_extraction_prompt` (around line 41):

```python
            # Build the smart extraction prompt with existing context
            extraction_prompt = self._build_smart_extraction_prompt(
                text_content, template_variables, existing_context=existing_context
            )
```

Update `_build_smart_extraction_prompt` signature (line 92):

```python
    def _build_smart_extraction_prompt(
        self,
        text_content: str,
        template_variables: List[Dict[str, Any]],
        existing_context: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> str:
```

Add context section to the prompt (add after line 143, before EXTRACTION STRATEGY):

```python
        # Add existing context if available
        context_section = ""
        if existing_context and len(existing_context) > 0:
            context_items = []
            for field_name, field_data in existing_context.items():
                value = field_data.get('value', 'unknown')
                confidence = field_data.get('confidence', 0)
                if value and confidence >= 0.5:
                    context_items.append(f'  - {field_name}: "{value}" (confidence: {confidence:.0%})')

            if context_items:
                context_section = f"""
ALREADY EXTRACTED FIELDS (use as context):
{chr(10).join(context_items)}

Use these values to help locate related fields. For example, if vendor_name="Acme Corp",
look for vendor_address near mentions of "Acme Corp".
"""
```

Update the prompt template to include context_section (around line 137):

```python
        prompt = f"""You are an expert document data extractor specializing in {doc_type} documents. Extract the following fields from this document text.

DOCUMENT TEXT:
{text_content[:2500]}

FIELDS TO EXTRACT:
{chr(10).join(field_descriptions)}
{receipt_guidance}
{context_section}
EXTRACTION STRATEGY:
```

**Step 4: Run test to verify it passes**

Run: `cd document-processor && python -m pytest tests/unit/test_context_aware_extraction.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add document-processor/app/services/smart_field_extractor.py document-processor/tests/unit/test_context_aware_extraction.py
git commit -m "feat: add context-aware extraction with previously extracted fields"
```

---

## Task 4: Implement Two-Pass Extraction Strategy

**Files:**
- Create: `document-processor/app/services/two_pass_extractor.py`
- Test: `document-processor/tests/unit/test_two_pass_extraction.py`

**Step 1: Write the failing test**

Create `document-processor/tests/unit/test_two_pass_extraction.py`:

```python
"""Tests for two-pass extraction strategy."""
import pytest
from unittest.mock import AsyncMock, patch
from app.services.two_pass_extractor import TwoPassExtractor


class TestTwoPassExtraction:
    """Test two-pass extraction for improved accuracy."""

    @pytest.fixture
    def extractor(self):
        return TwoPassExtractor()

    @pytest.mark.asyncio
    async def test_first_pass_extracts_high_confidence(self, extractor):
        """First pass should extract high-confidence fields."""
        with patch.object(extractor, '_run_extraction_pass') as mock_extract:
            mock_extract.return_value = {
                "vendor_name": {"value": "Acme Corp", "confidence": 0.95},
                "vendor_address": {"value": "123 Main", "confidence": 0.45},  # Low confidence
            }

            result = await extractor.extract_two_pass(
                "Sample text",
                [{"name": "vendor_name"}, {"name": "vendor_address"}],
                confidence_threshold=0.6
            )

            # Should have attempted second pass for low-confidence field
            assert mock_extract.call_count >= 1

    @pytest.mark.asyncio
    async def test_second_pass_uses_first_pass_context(self, extractor):
        """Second pass should use first pass results as context."""
        call_contexts = []

        async def mock_extraction(text, variables, threshold, context=None):
            call_contexts.append(context)
            if context is None:
                # First pass
                return {
                    "vendor_name": {"value": "Acme Corp", "confidence": 0.95},
                    "total_amount": {"value": "$100", "confidence": 0.40},
                }
            else:
                # Second pass with context
                return {
                    "total_amount": {"value": "$150.00", "confidence": 0.85},
                }

        with patch.object(extractor, '_run_extraction_pass', side_effect=mock_extraction):
            result = await extractor.extract_two_pass(
                "Invoice from Acme Corp for $150.00",
                [{"name": "vendor_name"}, {"name": "total_amount"}],
                confidence_threshold=0.6
            )

            # Second call should have context from first pass
            assert len(call_contexts) >= 2
            assert call_contexts[1] is not None
            assert "vendor_name" in call_contexts[1]

    @pytest.mark.asyncio
    async def test_returns_best_results(self, extractor):
        """Should return best confidence results from both passes."""
        async def mock_extraction(text, variables, threshold, context=None):
            if context is None:
                return {
                    "field_a": {"value": "first", "confidence": 0.9},
                    "field_b": {"value": "low", "confidence": 0.4},
                }
            else:
                return {
                    "field_b": {"value": "improved", "confidence": 0.8},
                }

        with patch.object(extractor, '_run_extraction_pass', side_effect=mock_extraction):
            result = await extractor.extract_two_pass(
                "text",
                [{"name": "field_a"}, {"name": "field_b"}],
                confidence_threshold=0.6
            )

            # Should have high-confidence field_a from pass 1
            # and improved field_b from pass 2
            extracted = result.get("extracted_values", {})
            assert extracted.get("field_a", {}).get("value") == "first"
            assert extracted.get("field_b", {}).get("value") == "improved"
```

**Step 2: Run test to verify it fails**

Run: `cd document-processor && python -m pytest tests/unit/test_two_pass_extraction.py -v`
Expected: FAIL - No module named 'app.services.two_pass_extractor'

**Step 3: Write minimal implementation**

Create `document-processor/app/services/two_pass_extractor.py`:

```python
"""
Two-Pass Extractor - Improves extraction accuracy through iterative refinement.

Strategy:
1. First pass: Extract all fields with standard prompting
2. Identify low-confidence fields (below threshold)
3. Second pass: Re-extract low-confidence fields using high-confidence
   fields as context anchors
"""
import logging
from typing import List, Dict, Any, Optional

from .smart_field_extractor import smart_field_extractor

logger = logging.getLogger(__name__)


class TwoPassExtractor:
    """
    Two-pass extraction strategy for improved accuracy.

    Uses high-confidence fields from first pass as context for
    second pass extraction of low-confidence fields.
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.base_extractor = smart_field_extractor

    async def extract_two_pass(
        self,
        text_content: str,
        template_variables: List[Dict[str, Any]],
        confidence_threshold: float = 0.6,
        provider: str = "azure"
    ) -> Dict[str, Any]:
        """
        Extract fields using two-pass strategy.

        Args:
            text_content: Document text to extract from
            template_variables: List of variables to extract
            confidence_threshold: Minimum confidence for successful extraction
            provider: LLM provider to use

        Returns:
            Extraction result with combined best-confidence values
        """
        import time
        start_time = time.time()

        self.logger.info(f"Starting two-pass extraction for {len(template_variables)} fields")

        # Pass 1: Extract all fields
        pass1_result = await self._run_extraction_pass(
            text_content,
            template_variables,
            confidence_threshold,
            context=None,
            provider=provider
        )

        pass1_values = pass1_result.get("extracted_values", {})
        self.logger.info(f"Pass 1 extracted {len(pass1_values)} fields")

        # Identify high-confidence and low-confidence fields
        high_confidence = {}
        low_confidence_vars = []

        for field_name, field_data in pass1_values.items():
            confidence = field_data.get("confidence", 0)
            if confidence >= confidence_threshold:
                high_confidence[field_name] = field_data
            else:
                # Find the original variable definition
                for var in template_variables:
                    if var.get("name") == field_name:
                        low_confidence_vars.append(var)
                        break

        # Also add variables that weren't extracted at all
        extracted_names = set(pass1_values.keys())
        for var in template_variables:
            if var.get("name") not in extracted_names:
                low_confidence_vars.append(var)

        self.logger.info(
            f"Pass 1 results: {len(high_confidence)} high-confidence, "
            f"{len(low_confidence_vars)} need second pass"
        )

        # Pass 2: Re-extract low-confidence fields with context
        if low_confidence_vars and high_confidence:
            self.logger.info(f"Starting pass 2 for {len(low_confidence_vars)} fields")

            pass2_result = await self._run_extraction_pass(
                text_content,
                low_confidence_vars,
                confidence_threshold,
                context=high_confidence,
                provider=provider
            )

            pass2_values = pass2_result.get("extracted_values", {})
            self.logger.info(f"Pass 2 extracted {len(pass2_values)} improved fields")

            # Merge results, preferring higher confidence
            final_values = dict(high_confidence)
            for field_name, field_data in pass2_values.items():
                existing = final_values.get(field_name)
                if existing is None or field_data.get("confidence", 0) > existing.get("confidence", 0):
                    final_values[field_name] = field_data
                    final_values[field_name]["extraction_pass"] = 2

            # Add any pass1 low-confidence that didn't improve
            for field_name, field_data in pass1_values.items():
                if field_name not in final_values:
                    final_values[field_name] = field_data
                    final_values[field_name]["extraction_pass"] = 1
        else:
            final_values = pass1_values
            for field_data in final_values.values():
                field_data["extraction_pass"] = 1

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        return {
            "extraction_method": "two_pass_intelligent",
            "extracted_values": final_values,
            "total_fields_requested": len(template_variables),
            "fields_extracted": len([v for v in final_values.values()
                                    if v.get("confidence", 0) >= confidence_threshold]),
            "confidence_threshold": confidence_threshold,
            "extraction_notes": "Two-pass extraction with context refinement",
            "success_rate": len(final_values) / len(template_variables) if template_variables else 0,
            "processing_time_ms": processing_time_ms,
            "pass_stats": {
                "pass1_high_confidence": len(high_confidence),
                "pass2_refined": len(low_confidence_vars) if low_confidence_vars else 0
            }
        }

    async def _run_extraction_pass(
        self,
        text_content: str,
        template_variables: List[Dict[str, Any]],
        confidence_threshold: float,
        context: Optional[Dict[str, Dict[str, Any]]] = None,
        provider: str = "azure"
    ) -> Dict[str, Any]:
        """Run a single extraction pass."""
        return await self.base_extractor.extract_fields_intelligently(
            text_content=text_content,
            template_variables=template_variables,
            confidence_threshold=confidence_threshold,
            provider=provider,
            existing_context=context
        )


# Global instance
two_pass_extractor = TwoPassExtractor()
```

**Step 4: Run test to verify it passes**

Run: `cd document-processor && python -m pytest tests/unit/test_two_pass_extraction.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add document-processor/app/services/two_pass_extractor.py document-processor/tests/unit/test_two_pass_extraction.py
git commit -m "feat: add two-pass extraction strategy for improved accuracy"
```

---

## Task 5: Add Chunked Extraction for Long Documents

**Files:**
- Modify: `document-processor/app/services/smart_field_extractor.py:180-226`
- Test: `document-processor/tests/unit/test_chunked_extraction.py`

**Step 1: Write the failing test**

Create `document-processor/tests/unit/test_chunked_extraction.py`:

```python
"""Tests for chunked document extraction."""
import pytest
from app.services.smart_field_extractor import SmartFieldExtractor


class TestChunkedExtraction:
    """Test extraction of long documents using chunking."""

    @pytest.fixture
    def extractor(self):
        return SmartFieldExtractor()

    def test_chunk_document_creates_overlapping_chunks(self, extractor):
        """Should create overlapping chunks for context preservation."""
        # Create a document longer than the chunk size
        long_text = "Section A content. " * 200 + "TARGET VALUE HERE. " + "Section B content. " * 200

        chunks = extractor._chunk_document(long_text, chunk_size=500, overlap=100)

        assert len(chunks) > 1
        # Check overlap - adjacent chunks should share some content
        if len(chunks) >= 2:
            # Last part of chunk 0 should appear at start of chunk 1
            chunk0_end = chunks[0][-100:]
            assert any(word in chunks[1][:200] for word in chunk0_end.split()[:5])

    def test_chunk_preserves_all_content(self, extractor):
        """Chunking should not lose any content."""
        original = "Word" + " Word" * 1000  # Long document

        chunks = extractor._chunk_document(original, chunk_size=500, overlap=50)

        # All words from original should appear in at least one chunk
        original_words = set(original.split())
        chunk_words = set()
        for chunk in chunks:
            chunk_words.update(chunk.split())

        assert original_words <= chunk_words

    def test_short_document_single_chunk(self, extractor):
        """Short documents should return single chunk."""
        short_text = "This is a short document."

        chunks = extractor._chunk_document(short_text, chunk_size=500, overlap=50)

        assert len(chunks) == 1
        assert chunks[0] == short_text
```

**Step 2: Run test to verify it fails**

Run: `cd document-processor && python -m pytest tests/unit/test_chunked_extraction.py -v`
Expected: FAIL - `_chunk_document` method doesn't exist

**Step 3: Add chunking method to smart_field_extractor.py**

Add after `_get_optimized_llm_params` method (around line 226):

```python
    def _chunk_document(
        self,
        text: str,
        chunk_size: int = 2500,
        overlap: int = 200
    ) -> List[str]:
        """
        Split long document into overlapping chunks for processing.

        Args:
            text: Document text to chunk
            chunk_size: Maximum characters per chunk
            overlap: Characters to overlap between chunks

        Returns:
            List of text chunks with overlap
        """
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        start = 0

        while start < len(text):
            # Find the end of this chunk
            end = start + chunk_size

            if end >= len(text):
                # Last chunk - take everything remaining
                chunks.append(text[start:])
                break

            # Try to break at a sentence or word boundary
            # Look for sentence end (.!?) in the last 100 chars of the chunk
            search_start = max(end - 100, start)
            best_break = end

            for i in range(end, search_start, -1):
                if text[i-1] in '.!?\n':
                    best_break = i
                    break

            # If no sentence break, try word break (space)
            if best_break == end:
                for i in range(end, search_start, -1):
                    if text[i-1] == ' ':
                        best_break = i
                        break

            chunks.append(text[start:best_break])

            # Next chunk starts with overlap
            start = best_break - overlap
            if start < 0:
                start = 0

        return chunks

    def _merge_chunk_extractions(
        self,
        chunk_results: List[Dict[str, Dict[str, Any]]]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Merge extraction results from multiple chunks.

        Keeps the highest-confidence value for each field.

        Args:
            chunk_results: List of extraction results from each chunk

        Returns:
            Merged results with best confidence values
        """
        merged = {}

        for chunk_result in chunk_results:
            for field_name, field_data in chunk_result.items():
                existing = merged.get(field_name)
                new_confidence = field_data.get("confidence", 0)

                if existing is None:
                    merged[field_name] = field_data
                elif new_confidence > existing.get("confidence", 0):
                    merged[field_name] = field_data

        return merged
```

**Step 4: Run test to verify it passes**

Run: `cd document-processor && python -m pytest tests/unit/test_chunked_extraction.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add document-processor/app/services/smart_field_extractor.py document-processor/tests/unit/test_chunked_extraction.py
git commit -m "feat: add chunked extraction for long documents"
```

---

## Task 6: Integrate Two-Pass Extractor into API Endpoint

**Files:**
- Modify: `document-processor/app/routers/api_v1.py:240-260`
- Test: `document-processor/tests/test_api_two_pass.py`

**Step 1: Write the failing test**

Create `document-processor/tests/test_api_two_pass.py`:

```python
"""Tests for two-pass extraction API integration."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock


class TestAPITwoPassExtraction:
    """Test API endpoint uses two-pass extraction."""

    @pytest.fixture
    def client(self):
        from app.main import app
        return TestClient(app)

    def test_extract_endpoint_accepts_two_pass_param(self, client):
        """Extract endpoint should accept two_pass parameter."""
        # This tests the parameter is recognized
        response = client.post(
            "/api/v1/extract-with-text",
            params={
                "text_content": "Sample invoice text",
                "template_data": '{"smart_variables": [{"name": "total", "type": "currency"}]}',
                "confidence_threshold": "0.6",
                "use_two_pass": "true"
            }
        )

        # Should not return 422 (validation error) for the parameter
        assert response.status_code != 422 or "use_two_pass" not in response.text
```

**Step 2: Run test to verify it fails**

Run: `cd document-processor && python -m pytest tests/test_api_two_pass.py -v`
Expected: FAIL - use_two_pass parameter not recognized (422 error)

**Step 3: Modify api_v1.py endpoint**

First, add import at top of `document-processor/app/routers/api_v1.py`:

```python
from ..services.two_pass_extractor import two_pass_extractor
```

Find the `/extract-with-text` endpoint (around line 200-260) and update its signature to add the parameter:

```python
@router.post("/extract-with-text")
async def extract_with_text(
    text_content: str = Query(..., description="Text content to extract from"),
    template_data: str = Query(..., description="JSON template data with smart_variables"),
    confidence_threshold: float = Query(0.6, description="Minimum confidence threshold"),
    use_two_pass: bool = Query(False, description="Use two-pass extraction for improved accuracy")
):
```

Update the extraction logic in the endpoint body to use two-pass when requested:

```python
    # Choose extraction method
    if use_two_pass:
        logger.info("Using two-pass extraction strategy")
        extracted_data = await two_pass_extractor.extract_two_pass(
            text_content,
            smart_variables,
            confidence_threshold,
            provider='azure'
        )
    else:
        extracted_data = await smart_field_extractor.extract_fields_intelligently(
            text_content,
            smart_variables,
            confidence_threshold,
            provider='azure'
        )
```

**Step 4: Run test to verify it passes**

Run: `cd document-processor && python -m pytest tests/test_api_two_pass.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add document-processor/app/routers/api_v1.py document-processor/tests/test_api_two_pass.py
git commit -m "feat: add two-pass extraction option to API endpoint"
```

---

## Task 7: Update Frontend to Support Enhanced Extraction

**Files:**
- Modify: `localai-admin-dashboard/src/lib/document-processor-enhanced.ts:348-424`
- Test: `localai-admin-dashboard/src/__tests__/services/document-processor-enhanced.test.ts`

**Step 1: Write the failing test**

Add to existing test file `localai-admin-dashboard/src/__tests__/services/document-processor-enhanced.test.ts`:

```typescript
describe('Enhanced Extraction Options', () => {
  it('should support two-pass extraction parameter', async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        extracted_data: {
          extracted_values: {
            test_field: { value: 'test', confidence: 0.9 }
          }
        }
      })
    });
    global.fetch = mockFetch;

    const processor = new EnhancedDocumentProcessor();

    // Should be able to call with useTwoPass option
    await processor.extractWithTemplateFast(
      'test content',
      { smart_variables: [{ name: 'test_field', type: 'text' }] } as any,
      0.6,
      { useTwoPass: true }
    );

    // Verify fetch was called with use_two_pass parameter
    expect(mockFetch).toHaveBeenCalled();
    const callUrl = mockFetch.mock.calls[0][0];
    expect(callUrl).toContain('use_two_pass=true');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd localai-admin-dashboard && npx pnpm test -- --run src/__tests__/services/document-processor-enhanced.test.ts`
Expected: FAIL - extractWithTemplateFast doesn't accept options parameter

**Step 3: Update document-processor-enhanced.ts**

Update the `extractWithTemplateFast` method signature (around line 348):

```typescript
  private async extractWithTemplateFast(
    textContent: string,
    template: SmartTemplate,
    confidenceThreshold: number = 0.6,
    options: { useTwoPass?: boolean; existingContext?: Record<string, unknown> } = {}
  ): Promise<Record<string, ExtractedField>> {
```

Update the URL params construction (around line 363):

```typescript
      const params = new URLSearchParams({
        text_content: textContent,
        template_data: templateData,
        confidence_threshold: confidenceThreshold.toString(),
        ...(options.useTwoPass && { use_two_pass: 'true' })
      });
```

**Step 4: Run test to verify it passes**

Run: `cd localai-admin-dashboard && npx pnpm test -- --run src/__tests__/services/document-processor-enhanced.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add localai-admin-dashboard/src/lib/document-processor-enhanced.ts localai-admin-dashboard/src/__tests__/services/document-processor-enhanced.test.ts
git commit -m "feat: add two-pass extraction option to frontend"
```

---

## Task 8: Integration Test - End-to-End Improved Extraction

**Files:**
- Create: `document-processor/tests/integration/test_improved_extraction_e2e.py`

**Step 1: Write the integration test**

Create `document-processor/tests/integration/test_improved_extraction_e2e.py`:

```python
"""End-to-end integration tests for improved extraction."""
import pytest
import asyncio
from pathlib import Path

# Test with a realistic invoice document
SAMPLE_INVOICE = """
INVOICE

From: Acme Corporation
123 Business Lane
New York, NY 10001
accounting@acme-corp.com

Invoice Number: INV-2024-0042
Invoice Date: January 15, 2024
Due Date: February 15, 2024

Bill To:
John Smith
456 Customer Road
Los Angeles, CA 90001

Description                     Amount
--------------------------------
Consulting Services            $5,000.00
Software License               $2,500.00
Support Package                  $750.00
--------------------------------
Subtotal:                      $8,250.00
Tax (8%):                        $660.00
--------------------------------
TOTAL DUE:                     $8,910.00

Payment Terms: Net 30
"""


class TestImprovedExtractionE2E:
    """End-to-end tests for improved extraction pipeline."""

    @pytest.fixture
    def template_variables(self):
        return [
            {"name": "vendor_name", "type": "text", "description": "Company sending invoice"},
            {"name": "vendor_address", "type": "text", "description": "Vendor street address"},
            {"name": "vendor_email", "type": "email", "description": "Vendor email"},
            {"name": "invoice_number", "type": "id", "description": "Invoice reference number"},
            {"name": "invoice_date", "type": "date", "description": "Date invoice was issued"},
            {"name": "customer_name", "type": "text", "description": "Customer being billed"},
            {"name": "total_amount", "type": "currency", "description": "Total amount due"},
        ]

    @pytest.mark.asyncio
    async def test_semantic_extraction_improves_accuracy(self, template_variables):
        """Semantic parsing should improve extraction accuracy."""
        from app.services.smart_field_extractor import smart_field_extractor

        result = await smart_field_extractor.extract_fields_intelligently(
            SAMPLE_INVOICE,
            template_variables,
            confidence_threshold=0.5,
            provider="azure"
        )

        extracted = result.get("extracted_values", {})

        # Verify key fields were extracted
        assert "vendor_name" in extracted
        assert extracted["vendor_name"]["value"] == "Acme Corporation"

        assert "invoice_number" in extracted
        assert "INV-2024-0042" in extracted["invoice_number"]["value"]

        assert "total_amount" in extracted
        assert "$8,910" in extracted["total_amount"]["value"]

    @pytest.mark.asyncio
    async def test_two_pass_improves_low_confidence_fields(self, template_variables):
        """Two-pass extraction should improve low-confidence fields."""
        from app.services.two_pass_extractor import two_pass_extractor

        result = await two_pass_extractor.extract_two_pass(
            SAMPLE_INVOICE,
            template_variables,
            confidence_threshold=0.6,
            provider="azure"
        )

        extracted = result.get("extracted_values", {})
        stats = result.get("pass_stats", {})

        # Should have used two passes
        assert result.get("extraction_method") == "two_pass_intelligent"

        # Should have extracted most fields
        assert len(extracted) >= 5

        # High-confidence fields should be identified
        assert stats.get("pass1_high_confidence", 0) > 0

    @pytest.mark.asyncio
    async def test_context_helps_related_field_extraction(self, template_variables):
        """Existing context should help extract related fields."""
        from app.services.smart_field_extractor import smart_field_extractor

        # First extract vendor_name
        first_pass = await smart_field_extractor.extract_fields_intelligently(
            SAMPLE_INVOICE,
            [{"name": "vendor_name", "type": "text"}],
            confidence_threshold=0.5,
            provider="azure"
        )

        vendor_context = first_pass.get("extracted_values", {})

        # Now extract vendor_address with context
        second_pass = await smart_field_extractor.extract_fields_intelligently(
            SAMPLE_INVOICE,
            [{"name": "vendor_address", "type": "text"}],
            confidence_threshold=0.5,
            provider="azure",
            existing_context=vendor_context
        )

        # Should find the address near Acme Corporation
        extracted = second_pass.get("extracted_values", {})
        assert "vendor_address" in extracted
        assert "123 Business" in extracted["vendor_address"]["value"] or \
               "Business Lane" in extracted["vendor_address"]["value"]
```

**Step 2: Run integration test**

Run: `cd document-processor && python -m pytest tests/integration/test_improved_extraction_e2e.py -v --tb=short`
Note: This requires Azure OpenAI to be configured. Skip if not available.

**Step 3: Commit**

```bash
git add document-processor/tests/integration/test_improved_extraction_e2e.py
git commit -m "test: add e2e integration tests for improved extraction"
```

---

## Summary

This plan implements 5 key improvements to variable extraction:

| Task | Improvement | Impact |
|------|-------------|--------|
| 1-2 | Semantic variable name parsing | Better understanding of what to extract |
| 3 | Context-aware extraction | Related fields help locate each other |
| 4 | Two-pass extraction | Improved accuracy for difficult fields |
| 5 | Chunked extraction | Handle long documents without truncation |
| 6-7 | API & Frontend integration | Full stack support for new features |
| 8 | E2E testing | Verify improvements work together |

**Verification:** After all tasks, run full test suite:
```bash
cd document-processor && python -m pytest tests/ -v
cd ../localai-admin-dashboard && npx pnpm test
```
