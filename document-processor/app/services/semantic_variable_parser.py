"""
Semantic Variable Parser - Converts variable names to natural language descriptions.

Parses variable names like "customer_billing_address" into semantic descriptions
that help the LLM understand what to look for in documents.

This module is used by the SmartFieldExtractor to provide better semantic
understanding of variable names during document extraction.
"""
import re
import logging
from typing import Dict, List, Any


logger = logging.getLogger(__name__)


class SemanticVariableParser:
    """
    Parse variable names into semantic descriptions for improved LLM extraction.

    This parser converts programming-style variable names (snake_case, camelCase)
    into natural language descriptions and field type hints that help guide
    LLM-based extraction.

    Example:
        >>> parser = SemanticVariableParser()
        >>> result = parser.parse_variable_name("customer_billing_address")
        >>> print(result["semantic_description"])
        "billing address of a customer"
        >>> print(result["field_type_hint"])
        "address"
    """

    # Field type patterns - keywords that indicate specific field types
    # Order matters: more specific patterns should be checked first
    FIELD_TYPE_PATTERNS = {
        "percentage": ["percent", "rate", "ratio", "discount"],  # Check before currency (tax_rate should be percentage)
        "date": ["date", "time", "when", "created", "updated", "due", "issued", "expires", "expiry"],
        "currency": ["amount", "total", "price", "cost", "fee", "payment", "balance", "sum", "subtotal"],
        "email": ["email", "mail"],
        "phone": ["phone", "tel", "mobile", "fax", "contact"],
        "address": ["address", "street", "city", "state", "zip", "location", "postal"],
        "id": ["id", "number", "ref", "reference", "invoice", "receipt", "order", "tracking", "code"],
    }

    # Search keywords to add for each field type
    TYPE_SEARCH_KEYWORDS = {
        "date": ["date", "dated", "on"],
        "currency": ["$", "total", "amount", "USD", "price"],
        "email": ["@", "email", "e-mail"],
        "phone": ["tel", "phone", "call", "+", "("],
        "address": ["street", "address", "city", "state", "zip", "suite", "apt"],
        "id": ["#", "no.", "number", "ref", "reference"],
        "percentage": ["%", "percent", "rate"],
    }

    # Relationship keywords (entity prefixes that suggest related fields)
    ENTITY_PREFIXES = [
        "customer", "client", "vendor", "supplier", "company", "business",
        "buyer", "seller", "sender", "recipient", "shipper", "carrier",
        "contact", "owner", "manager", "employee", "user", "account"
    ]

    # Common field suffixes that help with type detection
    FIELD_SUFFIXES = {
        "name": "text",
        "title": "text",
        "description": "text",
        "notes": "text",
        "comments": "text",
    }

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
                - original_name: The original variable name
                - words: List of parsed words from the variable name
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

    def parse_variable_names(self, variable_names: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Parse multiple variable names at once.

        Args:
            variable_names: List of variable names to parse

        Returns:
            Dict mapping each variable name to its parsed result
        """
        results = {}
        for name in variable_names:
            results[name] = self.parse_variable_name(name)
        return results

    def get_extraction_context(self, variable_name: str) -> Dict[str, Any]:
        """
        Generate extraction context suitable for LLM prompts.

        This provides a structured context that can be included in prompts
        to help the LLM understand what to look for.

        Args:
            variable_name: The variable name to generate context for

        Returns:
            Dict with:
                - variable: Original variable name
                - description: Human-readable description
                - look_for: Keywords to search for
                - nearby_fields: Related fields that might be nearby
        """
        parsed = self.parse_variable_name(variable_name)

        return {
            "variable": variable_name,
            "description": parsed["semantic_description"],
            "look_for": parsed["search_keywords"],
            "nearby_fields": parsed["related_fields"],
            "expected_type": parsed["field_type_hint"]
        }

    def _split_variable_name(self, name: str) -> List[str]:
        """
        Split variable name into component words.

        Handles:
        - snake_case
        - camelCase
        - PascalCase
        - mixed formats
        """
        if not name:
            return []

        # Handle snake_case first
        if "_" in name:
            parts = name.split("_")
            # Filter out empty strings and process each part for camelCase
            words = []
            for part in parts:
                if part:
                    # Check if this part has camelCase
                    if any(c.isupper() for c in part[1:] if part):
                        words.extend(self._split_camel_case(part))
                    else:
                        words.append(part.lower())
            return [w for w in words if w]

        # Handle camelCase/PascalCase
        if any(c.isupper() for c in name):
            return self._split_camel_case(name)

        # Single word
        return [name.lower()] if name else []

    def _split_camel_case(self, name: str) -> List[str]:
        """Split a camelCase or PascalCase string into words."""
        # Insert space before uppercase letters, then split and lowercase
        result = re.sub(r'([A-Z])', r' \1', name).strip().lower().split()
        return [w for w in result if w]

    def _detect_field_type(self, words: List[str]) -> str:
        """
        Detect the most likely field type from words.

        Checks words against known patterns to determine the field type.
        Priority is given to more specific types (email, phone) over
        generic ones (text).
        """
        if not words:
            return "text"

        words_set = set(words)

        # Check against known field type patterns
        for field_type, keywords in self.FIELD_TYPE_PATTERNS.items():
            if words_set & set(keywords):
                return field_type

        # Check for common suffixes
        if words:
            last_word = words[-1]
            if last_word in self.FIELD_SUFFIXES:
                return self.FIELD_SUFFIXES[last_word]

        return "text"

    def _generate_description(self, words: List[str], field_type: str) -> str:  # noqa: ARG002
        """
        Generate natural language description from parsed words.

        Identifies entity prefixes (customer, vendor, etc.) and restructures
        the description to be more natural, e.g.:
        - "customer_billing_address" -> "billing address of a customer"
        - "invoice_date" -> "invoice date"

        Args:
            words: List of parsed words from the variable name
            field_type: The detected field type (reserved for future enhancements)
        """
        if not words:
            return ""

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
        """
        Generate search keywords for document scanning.

        Combines the parsed words with type-specific keywords to create
        a comprehensive list of terms to look for in the document.
        """
        keywords = list(words)

        # Add type-specific keywords
        if field_type in self.TYPE_SEARCH_KEYWORDS:
            keywords.extend(self.TYPE_SEARCH_KEYWORDS[field_type])

        # Return unique keywords
        return list(set(keywords))

    def _find_related_fields(self, words: List[str]) -> List[str]:
        """
        Find related field names based on entity prefix.

        When a variable has an entity prefix (e.g., "customer"), this
        suggests related fields like customer_name, customer_email, etc.
        that might be nearby in the document.
        """
        related = []

        for word in words:
            if word in self.ENTITY_PREFIXES:
                # Suggest looking near other fields with same prefix
                related.append(word)
                related.append(f"{word}_name")
                related.append(f"{word}_address")
                related.append(f"{word}_email")
                related.append(f"{word}_phone")

        return list(set(related))


# Global instance for convenience
semantic_variable_parser = SemanticVariableParser()
