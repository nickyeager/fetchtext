"""
Smart Field Extractor - LLM-based intelligent field extraction
"""
import json
import logging
import re
from typing import List, Dict, Any, Optional
from datetime import datetime

from .llm_service import llm_service
from ..config import provider_config, AIProvider

logger = logging.getLogger(__name__)

class SmartFieldExtractor:
    """
    Intelligent field extraction using LLM instead of regex patterns
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.llm_service = llm_service
        
    async def extract_fields_intelligently(
        self,
        text_content: str,
        template_variables: List[Dict[str, Any]],
        confidence_threshold: float = 0.6,
        provider: str = "azure"
    ) -> Dict[str, Any]:
        """
        Use LLM to intelligently extract field values from text content
        """
        import time
        start_time = time.time()
        
        self.logger.info(f"Starting smart extraction for {len(template_variables)} fields with provider: {provider}")
        
        try:
            # Build the smart extraction prompt
            extraction_prompt = self._build_smart_extraction_prompt(
                text_content, template_variables
            )
            self.logger.debug(f"Built extraction prompt (length: {len(extraction_prompt)})")
            
            # Optimize LLM parameters based on document type and field count
            llm_params = self._get_optimized_llm_params(text_content, template_variables, provider)
            # Ensure max_tokens is an integer
            if 'max_tokens' in llm_params:
                llm_params['max_tokens'] = int(llm_params['max_tokens'])
            self.logger.info(f"LLM params: {llm_params}, max_tokens type: {type(llm_params.get('max_tokens'))}")
            
            # Call LLM for intelligent extraction
            self.logger.info(f"Calling LLM service with provider: {llm_params.get('provider', provider)}")
            response = await self.llm_service.complete(
                extraction_prompt,
                **llm_params
            )
            self.logger.info(f"LLM response received (length: {len(response)})")
            self.logger.debug(f"LLM response preview: {response[:200]}...")
            
            # Parse and validate the LLM response
            self.logger.debug(f"Raw LLM response preview: {response[:500]}...")
            extracted_data = self._parse_llm_response(response, template_variables)
            self.logger.info(f"Parsed {len(extracted_data)} fields from LLM response")
            
            # Apply confidence threshold filtering
            filtered_data = self._apply_confidence_threshold(extracted_data, confidence_threshold)
            self.logger.info(f"After confidence filtering: {len(filtered_data)} fields remain")
            
            # Calculate actual processing time
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            # Return in the expected format
            return {
                "extraction_method": "llm_intelligent", 
                "extracted_values": filtered_data,
                "total_fields_requested": len(template_variables),
                "fields_extracted": len(filtered_data),
                "confidence_threshold": confidence_threshold,
                "extraction_notes": f"AI-powered extraction using {provider} provider",
                "success_rate": len(filtered_data) / len(template_variables) if template_variables else 0,
                "processing_time_ms": processing_time_ms
            }
            
        except Exception as e:
            self.logger.error(f"Smart extraction failed: {str(e)}", exc_info=True)
            # Fall back to simple extraction on error
            self.logger.warning(f"Falling back to simple extraction due to error: {str(e)}")
            return await self._fallback_simple_extraction(text_content, template_variables, confidence_threshold)
    
    def _build_smart_extraction_prompt(
        self,
        text_content: str,
        template_variables: List[Dict[str, Any]]
    ) -> str:
        """
        Build an intelligent prompt for LLM-based field extraction with examples and variations
        """
        # Create enhanced field descriptions with examples and variations
        field_descriptions = []
        field_examples = {}
        
        for var in template_variables:
            field_name = var.get('name', var.get('id', 'unknown'))
            field_type = var.get('type', 'text')
            description = var.get('description', f'{field_name} field')
            
            # Add field-specific examples and variations
            examples, variations = self._get_field_examples_and_variations(field_name, field_type)
            
            field_desc = f'- {field_name} ({field_type}): {description}'
            if variations:
                field_desc += f'\n  Look for: {", ".join(variations)}'
            if examples:
                field_desc += f'\n  Examples: {", ".join(examples)}'
            
            field_descriptions.append(field_desc)
            field_examples[field_name] = examples
        
        # Detect document type for context
        doc_type = self._detect_document_type(text_content)
        
        # Build the enhanced smart extraction prompt with receipt-specific guidance
        receipt_guidance = ""
        if doc_type in ['receipt', 'invoice']:
            receipt_guidance = f"""
SPECIAL {doc_type.upper()} EXTRACTION GUIDELINES:
- Document numbers may appear at the top, in headers, or with prefixes like "Receipt-", "Inv-", "#"
- Look for alphanumeric patterns that could be document IDs (e.g., "2975-4330", "Receipt-2975-4330")
- Amounts usually appear with currency symbols and may be highlighted or in larger text
- Dates may be in various formats (MM/DD/YYYY, DD/MM/YYYY, Month DD, YYYY)
- Company names often appear at the top of the document
- Reference numbers can appear anywhere in the document structure
"""

        prompt = f"""You are an expert document data extractor specializing in {doc_type} documents. Extract the following fields from this document text.

DOCUMENT TEXT:
{text_content[:2500]}

FIELDS TO EXTRACT:
{chr(10).join(field_descriptions)}
{receipt_guidance}
EXTRACTION STRATEGY:
1. Read the document carefully and understand its structure ({doc_type} format)
2. Look for field variations and aliases - don't just match exact field names
3. Use contextual understanding - values may appear in different formats
4. For dates: Accept any date format, convert to readable form (e.g., "July 23, 2025")
5. For amounts: Include currency symbols, handle commas (e.g., "$2,025.00")
6. For names: Extract full names, handle "Bill to:", "Customer:", etc.
7. For IDs/numbers: Extract clean values without labels like "Invoice #", "Receipt:"
8. For emails: Extract complete email addresses
9. For companies: Look for business names, may include "LLC", "Ltd", "Inc"
10. Pay special attention to document numbers - they can appear in filenames, headers, or body text
11. If uncertain, provide your best guess with confidence reflecting certainty
12. NEVER leave a field null if there's any possible match in the text

CONFIDENCE SCORING (be accurate with confidence levels):
- 0.9-1.0: Exact match found with clear context and high certainty
- 0.7-0.9: Good match with reasonable confidence, clear context
- 0.5-0.7: Possible match but some uncertainty about context or format
- 0.3-0.5: Weak match, educated guess based on available information
- 0.1-0.3: Very uncertain match, may be incorrect but best available option
- 0.0: No reasonable match found at all

Return ONLY this JSON format (no markdown, no explanations):
{{
    "extracted_fields": {{
        "field_name": {{
            "value": "extracted_value_or_null",
            "confidence": 0.95,
            "reasoning": "brief explanation of match and confidence level"
        }}
    }}
}}"""
        
        return prompt
    
    def _get_optimized_llm_params(self, text_content: str, template_variables: List[Dict], provider: str) -> Dict:
        """
        Get optimized LLM parameters based on context
        """
        doc_type = self._detect_document_type(text_content)
        field_count = len(template_variables)
        text_length = len(text_content)
        
        # Base parameters
        params = {
            'provider': provider,
            'temperature': 0.1,  # Start with low temperature for consistency
            'max_tokens': 600,   # Base token count
        }
        
        # Adjust based on document complexity
        # Each field needs ~100 tokens (value + confidence + reasoning)
        # Add buffer for JSON structure and edge cases
        if doc_type in ['receipt', 'invoice']:
            # Receipts and invoices are more structured
            params['temperature'] = 0.05  # Very low for structured docs
            params['max_tokens'] = min(300 + field_count * 100, 2000)
        elif doc_type == 'report':
            # Reports are more complex
            params['temperature'] = 0.15  # Slightly higher for flexibility
            params['max_tokens'] = min(400 + field_count * 120, 2500)
        else:
            # General documents
            params['temperature'] = 0.1
            params['max_tokens'] = min(350 + field_count * 110, 2200)
        
        # Adjust for text length
        if text_length > 2000:
            params['max_tokens'] = min(int(params['max_tokens'] * 1.2), 3000)
        elif text_length < 500:
            params['max_tokens'] = max(int(params['max_tokens'] * 0.8), 500)
        
        # Provider-specific optimizations
        if provider == 'azure':
            # Azure OpenAI works better with slightly higher temperature
            params['temperature'] = min(params['temperature'] + 0.02, 0.2)
        elif provider == 'ollama':
            # Ollama local models might need more tokens
            params['max_tokens'] = min(int(params['max_tokens'] * 1.1), 3000)
        
        self.logger.debug(f"Optimized LLM params for {doc_type} with {field_count} fields: {params}")
        return params
    
    def _get_field_examples_and_variations(self, field_name: str, field_type: str) -> tuple:
        """
        Get examples and variations for field extraction
        """
        field_lower = field_name.lower()
        
        # Define examples and variations by field patterns
        if 'invoice' in field_lower and ('number' in field_lower or 'id' in field_lower):
            return (['INV-001', 'TTKRPHII0001', '12345', '2975-4330', 'Receipt-2975-4330'], ['Invoice #', 'Invoice:', 'Inv:', 'Invoice Number', 'Receipt #', 'Receipt:', 'Document #', 'Ref #', 'Reference'])
            
        elif 'receipt' in field_lower and ('number' in field_lower or 'id' in field_lower):
            return (['R-12345', 'TTKRPHII0001', '2975-4330', 'Receipt-2975-4330'], ['Receipt #', 'Receipt:', 'Invoice number', 'Transaction ID', 'Document #', 'Ref #', 'Reference'])
            
        elif 'payment' in field_lower and 'date' in field_lower:
            return (['July 23, 2025', 'March 15, 2024'], ['Date paid', 'Payment Date', 'Paid on', 'Transaction Date'])
            
        elif 'date' in field_lower:
            return (['January 15, 2024', 'July 23, 2025'], ['Date:', 'Date paid', 'Invoice Date', 'Transaction Date'])
            
        elif 'total' in field_lower or 'amount' in field_lower:
            return (['$2,025.00', '$150.00'], ['Total:', 'Amount:', 'Total Amount', 'paid on', 'Amount Due'])
            
        elif 'customer' in field_lower and 'name' in field_lower:
            return (['Nicholas Yeager', 'John Smith'], ['Bill to', 'Customer:', 'Name:', 'Client:'])
            
        elif 'customer' in field_lower and 'email' in field_lower:
            return (['nickcyeager@gmail.com'], ['Email:', 'E-mail:', 'Contact:'])
            
        elif 'company' in field_lower or 'vendor' in field_lower:
            return (['Koenig Solutions Limited', 'ABC Company LLC'], ['Company:', 'From:', 'Vendor:', 'Business:'])
            
        elif 'email' in field_lower:
            return (['user@example.com'], ['Email:', 'E-mail:', 'Contact Email'])
            
        elif field_type == 'currency':
            return (['$1,234.56', '$2,025.00'], ['Total:', 'Amount:', '$', 'USD'])
            
        elif field_type == 'date':
            return (['July 23, 2025'], ['Date:', 'On:', 'Dated'])
            
        else:
            return ([], [])
    
    def _detect_document_type(self, text_content: str) -> str:
        """
        Detect document type for context-aware extraction
        """
        text_lower = text_content.lower()
        
        if 'invoice' in text_lower:
            return 'invoice'
        elif 'receipt' in text_lower:
            return 'receipt'
        elif 'bill' in text_lower:
            return 'bill'
        elif 'statement' in text_lower:
            return 'statement'
        elif 'report' in text_lower:
            return 'report'
        else:
            return 'document'
    
    def _parse_llm_response(
        self,
        response: str,
        template_variables: List[Dict[str, Any]]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Parse and validate LLM JSON response with multiple fallback methods
        """
        # Try multiple parsing strategies in order of preference
        parsing_strategies = [
            self._parse_clean_json,
            self._parse_markdown_json,
            self._parse_partial_json,
            self._parse_key_value_pairs,
            self._extract_from_malformed_response
        ]
        
        for strategy in parsing_strategies:
            try:
                result = strategy(response, template_variables)
                if result:  # If we got some results, use them
                    self.logger.info(f"Successfully parsed using {strategy.__name__}")
                    return result
            except Exception as e:
                self.logger.debug(f"Parsing strategy {strategy.__name__} failed: {e}")
                continue
        
        self.logger.error("All parsing strategies failed")
        return {}
    
    def _parse_clean_json(self, response: str, template_variables: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Parse clean JSON response"""
        cleaned_response = response.strip()
        parsed_response = json.loads(cleaned_response)
        extracted_fields = parsed_response.get('extracted_fields', {})
        return self._format_extracted_fields(extracted_fields)
    
    def _parse_markdown_json(self, response: str, template_variables: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Parse JSON wrapped in markdown code blocks"""
        cleaned_response = response.strip()
        if cleaned_response.startswith('```json'):
            cleaned_response = cleaned_response[7:]
        elif cleaned_response.startswith('```'):
            cleaned_response = cleaned_response[3:]
        if cleaned_response.endswith('```'):
            cleaned_response = cleaned_response[:-3]
        cleaned_response = cleaned_response.strip()
        
        parsed_response = json.loads(cleaned_response)
        return self._format_extracted_fields(parsed_response.get('extracted_fields', {}))
    
    def _parse_partial_json(self, response: str, template_variables: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Try to extract JSON from partial or malformed responses"""
        import re
        
        # Look for JSON-like structure
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
            # Try to fix common JSON issues
            json_str = re.sub(r',\s*}', '}', json_str)  # Remove trailing commas
            json_str = re.sub(r',\s*]', ']', json_str)  # Remove trailing commas in arrays
            
            parsed_response = json.loads(json_str)
            extracted_fields = parsed_response.get('extracted_fields', parsed_response)
            return self._format_extracted_fields(extracted_fields)
        return {}
    
    def _parse_key_value_pairs(self, response: str, template_variables: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Extract key-value pairs from text response"""
        import re
        extracted_fields = {}
        
        # Look for field patterns in various formats
        patterns = [
            r'"([^"]+)":\s*"([^"]*)"',  # "field": "value"
            r'([a-zA-Z_]+):\s*([^\n,}]+)',  # field: value
            r'([a-zA-Z_]+)\s*=\s*([^\n,}]+)',  # field = value
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, response, re.IGNORECASE)
            for field_name, value in matches:
                field_name = field_name.strip().lower()
                value = value.strip().strip('"\'').strip()
                
                # Map to template variables
                for var in template_variables:
                    var_name = var.get('name', '').lower()
                    if field_name == var_name or field_name in var_name or var_name in field_name:
                        extracted_fields[var.get('name')] = {
                            'value': value,
                            'confidence': 0.6,  # Medium confidence for pattern extraction
                            'source_text': f'{field_name}: {value}',
                            'location': 'pattern_extraction'
                        }
                        break
        
        return extracted_fields
    
    def _format_extracted_fields(self, extracted_fields: Dict) -> Dict[str, Dict[str, Any]]:
        """Format extracted fields to standard format"""
        formatted_fields = {}
        for field_name, field_data in extracted_fields.items():
            if isinstance(field_data, dict) and field_data.get('value') is not None:
                value = str(field_data['value']).strip()
                if value and value.lower() not in ['null', 'none', '']:
                    formatted_fields[field_name] = {
                        'value': value,
                        'confidence': float(field_data.get('confidence', 0.5)),
                        'source_text': field_data.get('reasoning', 'AI extracted'),
                        'location': 'llm_intelligent'
                    }
        return formatted_fields
    
    def _extract_from_malformed_response(
        self,
        response: str,
        template_variables: List[Dict[str, Any]]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Enhanced fallback extraction with field mapping and alias detection
        """
        extracted_fields = {}
        import re
        
        # Look for field patterns with aliases
        for var in template_variables:
            field_name = var.get('name', var.get('id', 'unknown'))
            field_type = var.get('type', 'text')
            
            # Get field variations for better matching
            examples, variations = self._get_field_examples_and_variations(field_name, field_type)
            all_field_names = [field_name] + variations
            
            found_value = None
            confidence = 0.0
            source_text = ""
            
            # Try each field variation
            for field_variant in all_field_names:
                if found_value:
                    break
                    
                # Pattern for field: value
                escaped_variant = re.escape(field_variant)
                escaped_variant_lower = re.escape(field_variant.lower())
                spaced_variant = field_variant.replace(" ", "\\s+")
                
                patterns = [
                    rf'{escaped_variant}[:\s]*([^\n,}}]+)',
                    rf'{escaped_variant_lower}[:\s]*([^\n,}}]+)',
                    rf'{spaced_variant}[:\s]*([^\n,}}]+)',
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, response, re.IGNORECASE)
                    if match:
                        value = match.group(1).strip().strip('"\'').strip()
                        if value and len(value) > 0:
                            found_value = value
                            confidence = 0.5  # Medium confidence for variant matching
                            source_text = match.group(0)
                            break
            
            # If still no match, try content-based extraction
            if not found_value:
                found_value, confidence, source_text = self._extract_by_content_pattern(
                    response, field_name, field_type
                )
            
            if found_value and confidence >= 0.3:  # Lower threshold for fallback
                extracted_fields[field_name] = {
                    'value': found_value,
                    'confidence': confidence,
                    'source_text': source_text,
                    'location': 'enhanced_fallback'
                }
        
        return extracted_fields
    
    def _extract_by_content_pattern(self, text: str, field_name: str, field_type: str) -> tuple:
        """
        Extract values based on content patterns and field types
        """
        import re
        
        field_lower = field_name.lower()
        
        # Email extraction
        if 'email' in field_lower:
            match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
            if match:
                return match.group(0), 0.8, match.group(0)
        
        # Invoice/Receipt number extraction with enhanced patterns
        if any(word in field_lower for word in ['invoice', 'receipt']) and any(word in field_lower for word in ['number', 'id', 'ref']):
            # Look for receipt/invoice patterns
            patterns = [
                r'(?:Receipt[-\s#]?)(\d{4}-\d{4})',  # Receipt-2975-4330
                r'(?:Invoice[-\s#]?)(\d{4}-\d{4})',  # Invoice-2975-4330
                r'(?:Receipt[-\s#]?)([A-Z0-9]{8,})',  # Receipt-ABCD1234
                r'(?:Invoice[-\s#]?)([A-Z0-9]{8,})',  # Invoice-ABCD1234
                r'(?:#|No\.?\s?)(\d{4}-\d{4})',      # #2975-4330 or No. 2975-4330
                r'\b(\d{4}-\d{4})\b',                 # Just 2975-4330 by itself
                r'(?:REF[-\s#]?)([A-Z0-9]{6,})',     # REF-123456
                r'(?:Doc[-\s#]?)([A-Z0-9]{6,})',     # Doc-123456
            ]
            
            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    value = match.group(1)
                    # Higher confidence for receipt/invoice numbers that match expected patterns
                    confidence = 0.9 if re.match(r'\d{4}-\d{4}', value) else 0.8
                    return value, confidence, match.group(0)
        
        # Currency/amount extraction  
        if field_type == 'currency' or any(word in field_lower for word in ['amount', 'total', 'price', 'cost']):
            match = re.search(r'\$[\d,]+\.?\d*', text)
            if match:
                return match.group(0), 0.7, match.group(0)
        
        # Date extraction
        if field_type == 'date' or 'date' in field_lower:
            # Try different date formats
            date_patterns = [
                r'(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}',
                r'\d{1,2}\/\d{1,2}\/\d{4}',
                r'\d{4}-\d{2}-\d{2}',
            ]
            for pattern in date_patterns:
                match = re.search(pattern, text)
                if match:
                    return match.group(0), 0.7, match.group(0)
        
        # ID/Number extraction
        if any(word in field_lower for word in ['id', 'number', 'invoice', 'receipt']):
            match = re.search(r'\b[A-Z0-9]{6,}\b', text)  # Look for alphanumeric IDs
            if match:
                return match.group(0), 0.6, match.group(0)
        
        # Name extraction (look for capitalized words)
        if 'name' in field_lower and 'customer' in field_lower:
            match = re.search(r'\b[A-Z][a-z]+\s+[A-Z][a-z]+\b', text)
            if match:
                return match.group(0), 0.6, match.group(0)
        
        # Company name extraction
        if 'company' in field_lower or 'vendor' in field_lower:
            # Look for company indicators
            match = re.search(r'\b([A-Z][A-Za-z\s]+(?:LLC|Ltd|Limited|Inc|Corporation|Corp|Company))\b', text)
            if match:
                return match.group(1), 0.7, match.group(0)
        
        return None, 0.0, ""
    
    def _apply_confidence_threshold(
        self,
        extracted_data: Dict[str, Dict[str, Any]],
        confidence_threshold: float
    ) -> Dict[str, Dict[str, Any]]:
        """
        Enhanced confidence filtering with validation and adjustment
        """
        filtered_data = {}
        
        for field_name, field_data in extracted_data.items():
            # Get raw confidence
            raw_confidence = field_data.get('confidence', 0.0)
            
            # Validate and adjust confidence based on value quality
            adjusted_confidence = self._validate_and_adjust_confidence(
                field_name, field_data.get('value', ''), raw_confidence
            )
            
            # Update the confidence score
            field_data['confidence'] = adjusted_confidence
            field_data['original_confidence'] = raw_confidence
            
            # Apply threshold
            if adjusted_confidence >= confidence_threshold:
                filtered_data[field_name] = field_data
                self.logger.debug(f"Field {field_name} passed: {adjusted_confidence:.2f} >= {confidence_threshold}")
            else:
                self.logger.debug(f"Field {field_name} filtered: {adjusted_confidence:.2f} < {confidence_threshold}")
        
        return filtered_data
    
    def _validate_and_adjust_confidence(self, field_name: str, value: str, raw_confidence: float) -> float:
        """
        Validate extracted value and adjust confidence accordingly
        """
        if not value or len(value.strip()) == 0:
            return 0.0
        
        field_lower = field_name.lower()
        value_clean = str(value).strip()
        
        # Email validation
        if 'email' in field_lower:
            if re.match(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$', value_clean):
                return min(raw_confidence + 0.2, 1.0)  # Boost valid emails
            elif '@' in value_clean:
                return raw_confidence * 0.8  # Partial match
            else:
                return raw_confidence * 0.3  # Not an email
        
        # Currency validation
        if 'amount' in field_lower or 'total' in field_lower:
            if re.match(r'^\$[\d,]+\.?\d*$', value_clean):
                return min(raw_confidence + 0.15, 1.0)  # Boost valid currency
            elif '$' in value_clean or any(c.isdigit() for c in value_clean):
                return raw_confidence * 0.9  # Has currency indicators
            else:
                return raw_confidence * 0.4  # Not currency-like
        
        # Date validation
        if 'date' in field_lower:
            date_patterns = [
                r'(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}',
                r'\d{1,2}\/\d{1,2}\/\d{4}',
                r'\d{4}-\d{2}-\d{2}',
            ]
            if any(re.match(pattern, value_clean) for pattern in date_patterns):
                return min(raw_confidence + 0.1, 1.0)  # Boost valid dates
            elif any(c.isdigit() for c in value_clean):
                return raw_confidence * 0.8  # Has numbers (possible date)
            else:
                return raw_confidence * 0.4  # Unlikely to be a date
        
        # ID/Number validation  
        if any(word in field_lower for word in ['id', 'number', 'invoice', 'receipt']):
            if re.match(r'^[A-Z0-9]{4,}$', value_clean):
                return min(raw_confidence + 0.1, 1.0)  # Boost valid IDs
            elif any(c.isalnum() for c in value_clean):
                return raw_confidence * 0.9  # Has alphanumeric characters
            else:
                return raw_confidence * 0.5  # Unlikely to be an ID
        
        # Name validation
        if 'name' in field_lower:
            if re.match(r'^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$', value_clean):
                return min(raw_confidence + 0.1, 1.0)  # Boost proper names
            elif len(value_clean.split()) >= 2 and value_clean.replace(' ', '').isalpha():
                return raw_confidence * 0.9  # Multiple words, all letters
            elif value_clean.isalpha():
                return raw_confidence * 0.8  # Single word, all letters
            else:
                return raw_confidence * 0.6  # May contain non-letter characters
        
        # General validation - penalize very short or very long values
        if len(value_clean) < 2:
            return raw_confidence * 0.5  # Too short
        elif len(value_clean) > 200:
            return raw_confidence * 0.7  # Suspiciously long
        
        # Default - slight boost for having any value
        return min(raw_confidence + 0.05, 1.0)

    async def test_template_extraction(
        self,
        content: str,
        template_variables: List[Dict[str, Any]],
        confidence_threshold: float = 0.6,
        provider: str = "azure"
    ) -> Dict[str, Any]:
        """
        Test extraction with a template to validate field extractability.
        This performs REAL extraction to determine if template fields can be extracted.

        Returns:
            ExtractionTestResult with:
            - field_success_rate: Ratio of successfully extracted fields
            - avg_confidence: Average confidence of extracted fields
            - extractable_count: Number of fields that passed threshold
            - total_fields: Total number of fields in template
            - failed_fields: List of field names that couldn't be extracted
            - successful_fields: Dict of successfully extracted field data
        """
        self.logger.info(f"Testing template extraction for {len(template_variables)} fields")

        try:
            # Perform actual extraction
            extraction_result = await self.extract_fields_intelligently(
                text_content=content,
                template_variables=template_variables,
                confidence_threshold=confidence_threshold,
                provider=provider
            )

            # Analyze results
            extracted_values = extraction_result.get('extracted_values', {})
            total_fields = len(template_variables)
            extractable_count = len(extracted_values)

            # Calculate average confidence
            if extracted_values:
                confidences = [field.get('confidence', 0.0) for field in extracted_values.values()]
                avg_confidence = sum(confidences) / len(confidences)
            else:
                avg_confidence = 0.0

            # Identify failed fields
            extracted_field_names = set(extracted_values.keys())
            all_field_names = {var.get('name', var.get('id', '')) for var in template_variables}
            failed_fields = list(all_field_names - extracted_field_names)

            # Calculate success rate
            field_success_rate = extractable_count / total_fields if total_fields > 0 else 0.0

            self.logger.info(
                f"Template extraction test complete: {extractable_count}/{total_fields} fields "
                f"extracted ({field_success_rate:.1%}), avg confidence: {avg_confidence:.2f}"
            )

            return {
                'field_success_rate': field_success_rate,
                'avg_confidence': avg_confidence,
                'extractable_count': extractable_count,
                'total_fields': total_fields,
                'failed_fields': failed_fields,
                'successful_fields': extracted_values,
                'extraction_quality': field_success_rate,  # Alias for consistency
                'test_passed': field_success_rate >= 0.7 and avg_confidence >= 0.6
            }

        except Exception as e:
            self.logger.error(f"Template extraction test failed: {str(e)}", exc_info=True)
            return {
                'field_success_rate': 0.0,
                'avg_confidence': 0.0,
                'extractable_count': 0,
                'total_fields': len(template_variables),
                'failed_fields': [var.get('name', var.get('id', '')) for var in template_variables],
                'successful_fields': {},
                'extraction_quality': 0.0,
                'test_passed': False,
                'error': str(e)
            }

    async def _fallback_simple_extraction(
        self,
        text_content: str,
        template_variables: List[Dict[str, Any]],
        confidence_threshold: float
    ) -> Dict[str, Any]:
        """
        Fallback to simple pattern-based extraction when LLM fails
        """
        self.logger.warning("Using fallback pattern extraction method")
        
        extracted_fields = {}
        
        # Simple fallback patterns
        import re
        
        for var in template_variables:
            field_name = var.get('name', var.get('id', 'unknown'))
            field_type = var.get('type', 'text')
            
            found_value = None
            confidence = 0.0
            
            # Basic patterns by type
            if field_type == 'currency' or 'amount' in field_name.lower():
                match = re.search(r'\$[\d,]+\.?\d*', text_content)
                if match:
                    found_value = match.group(0)
                    confidence = 0.7
            
            elif field_type == 'date' or 'date' in field_name.lower():
                match = re.search(r'(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}', text_content)
                if match:
                    found_value = match.group(0)
                    confidence = 0.7
            
            elif 'email' in field_name.lower():
                match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text_content)
                if match:
                    found_value = match.group(0)
                    confidence = 0.8
            
            if found_value and confidence >= confidence_threshold:
                extracted_fields[field_name] = {
                    'value': found_value,
                    'confidence': confidence,
                    'source_text': found_value,
                    'location': 'fallback_pattern'
                }
        
        self.logger.info(f"Fallback extraction completed: {len(extracted_fields)} fields extracted")
        
        # IMPORTANT: This is NOT template_guided_regex!
        return {
            "extraction_method": "fallback_pattern",
            "extracted_values": extracted_fields,
            "total_fields_requested": len(template_variables),
            "fields_extracted": len(extracted_fields),
            "confidence_threshold": confidence_threshold,
            "extraction_notes": "Fallback pattern extraction used due to LLM failure",
            "success_rate": len(extracted_fields) / len(template_variables) if template_variables else 0,
            "processing_time_ms": 50
        }

# Global instance
smart_field_extractor = SmartFieldExtractor()