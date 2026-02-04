"""
Two-Pass Extractor - Improves extraction accuracy through iterative refinement.

Strategy:
1. First pass: Extract all fields with standard prompting
2. Identify low-confidence fields (below threshold)
3. Second pass: Re-extract low-confidence fields using high-confidence
   fields as context anchors

This module leverages the existing_context parameter from smart_field_extractor
to provide high-confidence fields as context for a second extraction pass,
improving accuracy for fields that were uncertain in the first pass.
"""
import logging
import time
from typing import List, Dict, Any, Optional

from .smart_field_extractor import smart_field_extractor


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
        provider: str = "azure",
        organization_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract fields using two-pass strategy.

        Args:
            text_content: Document text to extract from
            template_variables: List of variables to extract
            confidence_threshold: Minimum confidence for successful extraction
            provider: LLM provider to use
            organization_id: Optional organization ID for org-specific LLM config

        Returns:
            Extraction result with combined best-confidence values
        """
        start_time = time.time()

        self.logger.info(f"Starting two-pass extraction for {len(template_variables)} fields")

        # Handle empty template variables
        if not template_variables:
            return {
                "extraction_method": "two_pass_intelligent",
                "extracted_values": {},
                "total_fields_requested": 0,
                "fields_extracted": 0,
                "confidence_threshold": confidence_threshold,
                "extraction_notes": "No fields requested",
                "success_rate": 0,
                "processing_time_ms": 0,
                "pass_stats": {
                    "pass1_high_confidence": 0,
                    "pass2_refined": 0
                }
            }

        # Pass 1: Extract all fields
        pass1_result = await self._run_extraction_pass(
            text_content,
            template_variables,
            confidence_threshold,
            context=None,
            provider=provider,
            organization_id=organization_id
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
        low_confidence_names = {var.get("name") for var in low_confidence_vars}
        for var in template_variables:
            var_name = var.get("name")
            if var_name not in extracted_names and var_name not in low_confidence_names:
                low_confidence_vars.append(var)

        self.logger.info(
            f"Pass 1 results: {len(high_confidence)} high-confidence, "
            f"{len(low_confidence_vars)} need second pass"
        )

        # Pass 2: Re-extract low-confidence fields with context
        # Only do second pass if we have low-confidence fields AND high-confidence context
        if low_confidence_vars and high_confidence:
            self.logger.info(f"Starting pass 2 for {len(low_confidence_vars)} fields")

            pass2_result = await self._run_extraction_pass(
                text_content,
                low_confidence_vars,
                confidence_threshold,
                context=high_confidence,
                provider=provider,
                organization_id=organization_id
            )

            pass2_values = pass2_result.get("extracted_values", {})
            self.logger.info(f"Pass 2 extracted {len(pass2_values)} improved fields")

            # Merge results, preferring higher confidence
            final_values = {}

            # Add high-confidence fields from pass 1
            for field_name, field_data in high_confidence.items():
                final_values[field_name] = dict(field_data)
                final_values[field_name]["extraction_pass"] = 1

            # Add/update with pass 2 results if they have better confidence
            for field_name, field_data in pass2_values.items():
                pass1_data = pass1_values.get(field_name)
                pass1_confidence = pass1_data.get("confidence", 0) if pass1_data else 0
                pass2_confidence = field_data.get("confidence", 0)

                if pass2_confidence > pass1_confidence:
                    # Pass 2 improved the result
                    final_values[field_name] = dict(field_data)
                    final_values[field_name]["extraction_pass"] = 2
                elif field_name not in final_values and pass1_data:
                    # Keep pass 1 result if pass 2 didn't improve it
                    final_values[field_name] = dict(pass1_data)
                    final_values[field_name]["extraction_pass"] = 1

            # Add any pass1 low-confidence that didn't improve
            for field_name, field_data in pass1_values.items():
                if field_name not in final_values:
                    final_values[field_name] = dict(field_data)
                    final_values[field_name]["extraction_pass"] = 1

            # Count fields that were actually refined (improved confidence in pass 2)
            pass2_refined_count = sum(
                1 for field_name, field_data in final_values.items()
                if field_data.get("extraction_pass") == 2
            )
        else:
            final_values = {}
            for field_name, field_data in pass1_values.items():
                final_values[field_name] = dict(field_data)
                final_values[field_name]["extraction_pass"] = 1
            pass2_refined_count = 0

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Count fields that meet the confidence threshold
        fields_extracted = len([
            v for v in final_values.values()
            if v.get("confidence", 0) >= confidence_threshold
        ])

        return {
            "extraction_method": "two_pass_intelligent",
            "extracted_values": final_values,
            "total_fields_requested": len(template_variables),
            "fields_extracted": fields_extracted,
            "confidence_threshold": confidence_threshold,
            "extraction_notes": "Two-pass extraction with context refinement",
            "success_rate": len(final_values) / len(template_variables) if template_variables else 0,
            "processing_time_ms": processing_time_ms,
            "pass_stats": {
                "pass1_high_confidence": len(high_confidence),
                "pass2_refined": pass2_refined_count
            }
        }

    async def _run_extraction_pass(
        self,
        text_content: str,
        template_variables: List[Dict[str, Any]],
        confidence_threshold: float,
        context: Optional[Dict[str, Dict[str, Any]]] = None,
        provider: str = "azure",
        organization_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Run a single extraction pass using the base smart field extractor.

        Args:
            text_content: Document text to extract from
            template_variables: List of variables to extract
            confidence_threshold: Minimum confidence for successful extraction
            context: Optional existing context from previous extraction pass
            provider: LLM provider to use
            organization_id: Optional organization ID for org-specific LLM config

        Returns:
            Extraction result from smart_field_extractor
        """
        return await self.base_extractor.extract_fields_intelligently(
            text_content=text_content,
            template_variables=template_variables,
            confidence_threshold=confidence_threshold,
            provider=provider,
            existing_context=context,
            organization_id=organization_id
        )


# Global instance
two_pass_extractor = TwoPassExtractor()
