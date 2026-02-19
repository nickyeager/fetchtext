import json
import uuid
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio
import re

from ..services.enhanced_docling_service import enhanced_docling_service
from ..services.ai_content_classifier import ai_classifier
from ..services.llm_service import llm_service


class FieldDetectionAI:
    """AI model for detecting extractable fields in documents."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.pattern_extractors = {
            'currency': self._extract_currency_patterns,
            'date': self._extract_date_patterns,
            'email': self._extract_email_patterns,
            'phone': self._extract_phone_patterns,
            'address': self._extract_address_patterns,
            'number': self._extract_number_patterns
        }
    
    def _extract_currency_patterns(self, text: str) -> List[str]:
        """Extract currency patterns from text"""
        patterns = [
            r'\$[\d,]+\.?\d*',
            r'USD?\s*[\d,]+\.?\d*',
            r'[\d,]+\.?\d*\s*(?:dollars?|USD)',
            r'€[\d,]+\.?\d*',
            r'£[\d,]+\.?\d*',
            r'total[:\s]*\$?[\d,]+\.?\d*',
            r'amount[:\s]*\$?[\d,]+\.?\d*'
        ]
        matches = []
        for pattern in patterns:
            matches.extend(re.findall(pattern, text, re.IGNORECASE))
        return matches[:5]  # Return first 5 matches
    
    def _extract_date_patterns(self, text: str) -> List[str]:
        """Extract date patterns from text"""
        patterns = [
            r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',
            r'\d{4}[/-]\d{1,2}[/-]\d{1,2}',
            r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}',
            r'\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}'
        ]
        matches = []
        for pattern in patterns:
            matches.extend(re.findall(pattern, text, re.IGNORECASE))
        return matches[:5]
    
    def _extract_email_patterns(self, text: str) -> List[str]:
        """Extract email patterns from text"""
        pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        return re.findall(pattern, text)[:3]
    
    def _extract_phone_patterns(self, text: str) -> List[str]:
        """Extract phone patterns from text"""
        patterns = [
            r'\(\d{3}\)\s*\d{3}[-.\s]?\d{4}',
            r'\d{3}[-.\s]?\d{3}[-.\s]?\d{4}',
            r'\+\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}'
        ]
        matches = []
        for pattern in patterns:
            matches.extend(re.findall(pattern, text))
        return matches[:3]
    
    def _extract_address_patterns(self, text: str) -> List[str]:
        """Extract address patterns from text"""
        patterns = [
            r'\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)',
            r'[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}',
            r'\d+\s+[A-Za-z\s]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}'
        ]
        matches = []
        for pattern in patterns:
            matches.extend(re.findall(pattern, text, re.IGNORECASE))
        return matches[:3]
    
    def _extract_number_patterns(self, text: str) -> List[str]:
        """Extract number patterns from text"""
        patterns = [
            r'(?:invoice|receipt|order|ref|reference)[\s#:]*(\d+)',
            r'(?:ID|id)[\s#:]*([A-Z0-9]+)',
            r'\b\d{6,}\b'  # Generic long numbers
        ]
        matches = []
        for pattern in patterns:
            matches.extend(re.findall(pattern, text, re.IGNORECASE))
        return matches[:5]

    async def detect_fields(self, content: str, document_type: str) -> List[Dict[str, Any]]:
        """Detect potential fields for extraction using AI analysis."""
        detected_fields = []
        
        # Common field detection based on document type
        field_suggestions = self._get_document_type_fields(document_type)
        
        for field_name, field_info in field_suggestions.items():
            # Extract sample values using pattern matching
            field_type = field_info['type']
            sample_values = []
            
            if field_type in self.pattern_extractors:
                sample_values = self.pattern_extractors[field_type](content)
            
            # Check for field-specific keywords in content
            keywords_found = any(
                keyword.lower() in content.lower() 
                for keyword in field_info.get('keywords', [])
            )
            
            # Calculate confidence based on sample values and keywords
            confidence = 0.5  # Base confidence
            if sample_values:
                confidence += 0.3
            if keywords_found:
                confidence += 0.2
            
            if confidence >= 0.6 or sample_values:  # Include if decent confidence or has samples
                detected_field = {
                    'name': field_name,
                    'suggested_type': field_type,
                    'confidence': min(confidence, 0.95),
                    'sample_values': sample_values,
                    'extraction_hints': field_info.get('hints', []),
                    'importance': field_info.get('importance', 'medium'),
                    'description': field_info.get('description', f'Extracted {field_name}'),
                    'position': {'page': 1, 'section': 'body', 'relative_position': 0.5}
                }
                detected_fields.append(detected_field)
        
        return detected_fields
    
    def _get_document_type_fields(self, document_type: str) -> Dict[str, Dict[str, Any]]:
        """Get field suggestions based on document type"""
        
        if document_type.lower() in ['invoice', 'financial_statement']:
            return {
                'vendor_name': {
                    'type': 'text',
                    'keywords': ['vendor', 'from', 'company', 'business', 'supplier'],
                    'hints': ['vendor', 'supplier', 'from', 'company name'],
                    'importance': 'high',
                    'description': 'Name of the vendor or company'
                },
                'invoice_number': {
                    'type': 'text',
                    'keywords': ['invoice', 'invoice #', 'ref', 'reference'],
                    'hints': ['invoice', 'invoice #', 'reference number'],
                    'importance': 'high',
                    'description': 'Invoice or reference number'
                },
                'total_amount': {
                    'type': 'currency',
                    'keywords': ['total', 'amount', 'due', 'balance'],
                    'hints': ['total', 'amount', 'grand total', 'balance due'],
                    'importance': 'high',
                    'description': 'Total amount or balance'
                },
                'invoice_date': {
                    'type': 'date',
                    'keywords': ['date', 'invoice date', 'issued'],
                    'hints': ['date', 'invoice date', 'issue date'],
                    'importance': 'high',
                    'description': 'Invoice date'
                },
                'due_date': {
                    'type': 'date',
                    'keywords': ['due', 'due date', 'payment due'],
                    'hints': ['due date', 'payment due', 'due'],
                    'importance': 'medium',
                    'description': 'Payment due date'
                }
            }
        
        elif document_type.lower() == 'business_report':
            return {
                'report_title': {
                    'type': 'text',
                    'keywords': ['title', 'report', 'analysis'],
                    'hints': ['title', 'report title', 'heading'],
                    'importance': 'high',
                    'description': 'Title of the report'
                },
                'report_date': {
                    'type': 'date',
                    'keywords': ['date', 'report date', 'prepared'],
                    'hints': ['date', 'report date', 'prepared on'],
                    'importance': 'high',
                    'description': 'Report preparation date'
                },
                'author_name': {
                    'type': 'text',
                    'keywords': ['author', 'prepared by', 'analyst'],
                    'hints': ['author', 'prepared by', 'analyst'],
                    'importance': 'medium',
                    'description': 'Report author or analyst'
                },
                'summary': {
                    'type': 'text',
                    'keywords': ['summary', 'executive summary', 'overview'],
                    'hints': ['summary', 'executive summary', 'overview'],
                    'importance': 'high',
                    'description': 'Report summary or overview'
                }
            }
        
        elif document_type.lower() in ['form', 'correspondence']:
            return {
                'sender_name': {
                    'type': 'text',
                    'keywords': ['from', 'sender', 'name'],
                    'hints': ['from', 'sender', 'name'],
                    'importance': 'high',
                    'description': 'Name of sender'
                },
                'recipient_name': {
                    'type': 'text',
                    'keywords': ['to', 'recipient', 'dear'],
                    'hints': ['to', 'recipient', 'dear'],
                    'importance': 'high',
                    'description': 'Name of recipient'
                },
                'date': {
                    'type': 'date',
                    'keywords': ['date', 'dated'],
                    'hints': ['date', 'dated'],
                    'importance': 'medium',
                    'description': 'Document date'
                },
                'subject': {
                    'type': 'text',
                    'keywords': ['subject', 'regarding', 're:'],
                    'hints': ['subject', 'regarding', 're:'],
                    'importance': 'medium',
                    'description': 'Subject or topic'
                }
            }
        
        # Default generic fields for unknown document types
        return {
            'document_title': {
                'type': 'text',
                'keywords': ['title'],
                'hints': ['title', 'heading'],
                'importance': 'high',
                'description': 'Document title'
            },
            'document_date': {
                'type': 'date',
                'keywords': ['date'],
                'hints': ['date'],
                'importance': 'medium',
                'description': 'Document date'
            },
            'reference_number': {
                'type': 'text',
                'keywords': ['reference', 'ref', 'number'],
                'hints': ['reference', 'ref #', 'number'],
                'importance': 'low',
                'description': 'Reference number'
            }
        }


class AITemplateGenerator:
    """AI-powered template generation service"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.field_detector = FieldDetectionAI()
    
    async def _detect_fields_with_azure_openai(self, content: str, document_type: str) -> List[Dict[str, Any]]:
        """Use Azure OpenAI to detect ALL extractable fields in the document."""

        print("=" * 80)
        print("🚀 _detect_fields_with_azure_openai() CALLED")
        print(f"Content length: {len(content)}, Document type: {document_type}")
        print("=" * 80)

        self.logger.info("🚀 STARTING Azure OpenAI field detection")
        self.logger.info(f"📄 Content length: {len(content)} chars, Document type: {document_type}")

        # Prepare prompt for Azure OpenAI
        system_prompt = """You are a document field extraction expert. Analyze documents and identify ALL extractable fields with values.

Return ONLY valid JSON in this exact format:
{
  "fields": [
    {"name": "field_name", "type": "text|currency|date|email|phone|number", "description": "what it is", "sample_value": "actual value from doc", "extraction_hints": ["keyword1", "keyword2"]}
  ]
}"""

        user_prompt = f"""Document type: {document_type}

Find ALL fields with these patterns:
1. Label: Value (e.g., "Name: John", "Total: $500")
2. Form fields with colons or dashes
3. Dates, prices, amounts, names, emails, phones
4. Any structured data

Extract AT LEAST 10-15 fields if they exist in the document.

Document:
{content[:3000]}

Return JSON only:"""

        try:
            # Call Azure OpenAI using the LLM service
            # Combine system and user prompts for the complete() method
            full_prompt = f"{system_prompt}\n\n{user_prompt}"

            response = await llm_service.complete(
                prompt=full_prompt,
                provider="azure_openai",
                temperature=0.1,
                max_tokens=800,
                response_format={"type": "json_object"},
            )

            self.logger.info(f"Azure OpenAI response received: {len(response) if response else 0} chars")
            self.logger.info(f"Response preview: {response[:500]}")

            # Parse the response
            if not response:
                self.logger.warning("Empty response from Azure OpenAI")
                return []

            # Strip markdown code blocks if present
            response_clean = response.strip()
            if response_clean.startswith('```'):
                # Remove ```json or ``` at start and ``` at end
                lines = response_clean.split('\n')
                if lines[0].startswith('```'):
                    lines = lines[1:]  # Remove first line
                if lines and lines[-1].strip() == '```':
                    lines = lines[:-1]  # Remove last line
                response_clean = '\n'.join(lines)

            # Try to parse the cleaned response as JSON directly
            try:
                parsed = json.loads(response_clean)
                self.logger.info("✅ Successfully parsed JSON response directly")
            except json.JSONDecodeError as parse_error:
                self.logger.error(f"Failed to parse JSON: {parse_error}")
                self.logger.info(f"Response was: {response_clean[:500]}")
                return []

            detected_fields = parsed.get('fields', [])
            self.logger.info(f"✅ Azure OpenAI detected {len(detected_fields)} fields")

            # Convert to our internal format
            formatted_fields = []
            for field in detected_fields:
                formatted_fields.append({
                    'name': field.get('name', 'unknown_field'),
                    'suggested_type': field.get('type', 'text'),
                    'confidence': 0.85,
                    'sample_values': [field.get('sample_value')] if field.get('sample_value') else [],
                    'extraction_hints': field.get('extraction_hints', [field.get('name')]),
                    'importance': 'high',
                    'description': field.get('description', f'Extracted {field.get("name")}'),
                    'position': {'page': 1, 'section': 'body', 'relative_position': 0.5}
                })

            self.logger.info(f"Formatted {len(formatted_fields)} fields for template")
            return formatted_fields

        except Exception as e:
            self.logger.error(f"Azure OpenAI field detection failed: {e}", exc_info=True)
            self.logger.info("Falling back to pattern-based field detection")
            return []

    async def analyze_document_structure(self, document_path: Path) -> Dict[str, Any]:
        """Analyze document structure and identify potential fields."""

        print("=" * 80)
        print(f"🔍 analyze_document_structure() CALLED with {document_path}")
        print("=" * 80)

        # Process document with enhanced service
        result = await enhanced_docling_service.process_document_with_ai_enhancement(
            document_path,
            extract_text=True,
            extract_metadata=True,
            extract_structure=True,
            use_ai_enhancement=True
        )

        if result.get('status') != 'completed':
            # Try to extract whatever we can
            self.logger.warning(f"Document processing had issues: {result.get('status')}")
            content = result.get('content', {}).get('text', '')
            if not content and result.get('error_message'):
                raise Exception(f"Document processing failed: {result.get('error_message')}")

        content = result.get('content', {}).get('text', '')
        metadata = result.get('metadata', {})
        classification = result.get('ai_classification', {})

        print("=" * 80)
        print("DEBUG: analyze_document_structure() reached field detection code")
        print(f"Content length: {len(content)}")
        print(f"Classification: {classification.get('primary_category', 'unknown')}")
        print("=" * 80)

        # Try Azure OpenAI detection first
        self.logger.info("⚡ About to call _detect_fields_with_azure_openai")
        detected_fields = await self._detect_fields_with_azure_openai(
            content,
            classification.get('primary_category', 'unknown')
        )
        self.logger.info(f"⚡ Returned from _detect_fields_with_azure_openai: {len(detected_fields) if detected_fields else 0} fields")

        # If Azure OpenAI didn't find fields, fall back to pattern detection
        if not detected_fields or len(detected_fields) < 3:
            self.logger.info("Falling back to pattern-based field detection")
            detected_fields = await self.field_detector.detect_fields(
                content,
                classification.get('primary_category', 'unknown')
            )
        else:
            self.logger.info(f"Using Azure OpenAI detected fields: {len(detected_fields)} fields found")

        # Analyze structural elements
        structural_elements = self._analyze_structural_elements(result.get('content', {}))

        # Determine extraction complexity
        complexity = self._determine_extraction_complexity(detected_fields, structural_elements)

        return {
            'analysis_id': str(uuid.uuid4()),
            'document_type': classification.get('primary_category', 'unknown'),
            'confidence': classification.get('confidence', 0.5),
            'suggested_category': self._suggest_template_category(classification),
            'detected_fields': detected_fields,
            'structural_elements': structural_elements,
            'extraction_complexity': complexity,
            'template_matches': [],  # Will be populated by template matching service
            'analysis_metadata': {
                'analysis_time': 2.5,  # Simulated analysis time
                'ai_model_version': '1.0.0',
                'processing_method': 'azure_openai_enhanced' if detected_fields else 'pattern_based'
            }
        }
    
    def _analyze_structural_elements(self, content: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze document structural elements"""
        elements = []
        
        # Analyze headings
        layout_info = content.get('layout_info', {})
        headings = layout_info.get('headings', [])
        
        for i, heading in enumerate(headings):
            elements.append({
                'type': 'header',
                'content': heading.get('text', ''),
                'position': heading.get('position', i),
                'importance': 'high' if heading.get('level', 1) <= 2 else 'medium'
            })
        
        # Analyze tables
        tables = content.get('tables', [])
        for i, table in enumerate(tables):
            elements.append({
                'type': 'table',
                'content': table.get('caption', f'Table {i+1}'),
                'position': table.get('position', i),
                'importance': 'high'
            })
        
        return elements
    
    def _determine_extraction_complexity(self, detected_fields: List[Dict], structural_elements: List[Dict]) -> str:
        """Determine the complexity of data extraction"""
        
        field_count = len(detected_fields)
        has_tables = any(elem['type'] == 'table' for elem in structural_elements)
        has_forms = any(elem['type'] == 'form' for elem in structural_elements)
        
        if field_count <= 5 and not has_tables and not has_forms:
            return 'simple'
        elif field_count <= 15 and (has_tables or has_forms):
            return 'moderate'
        else:
            return 'complex'
    
    def _suggest_template_category(self, classification: Dict[str, Any]) -> str:
        """Suggest appropriate template category"""
        
        primary_category = classification.get('primary_category', 'unknown')
        
        category_mapping = {
            'invoice': 'Financial',
            'financial_statement': 'Financial',
            'business_report': 'Business',
            'technical_document': 'Technical',
            'legal_contract': 'Legal',
            'form': 'Forms',
            'correspondence': 'General',
            'presentation': 'Business',
            'research_paper': 'Academic',
            'manual': 'Technical'
        }
        
        return category_mapping.get(primary_category, 'Other')
    
    async def generate_template_from_analysis(self, analysis: Dict[str, Any], template_name: str) -> Dict[str, Any]:
        """Generate a complete template based on document analysis."""

        print("=" * 80)
        print("🔨 generate_template_from_analysis() CALLED")
        print(f"Template name: {template_name}")
        print(f"Detected fields count: {len(analysis.get('detected_fields', []))}")
        for i, field in enumerate(analysis.get('detected_fields', [])[:5]):
            print(f"  Field {i+1}: {field.get('name')} (type: {field.get('suggested_type')})")
        print("=" * 80)

        # Create smart variables from detected fields
        smart_variables = []
        for field in analysis['detected_fields']:
            variable = {
                'id': field['name'],
                'name': field['name'],
                'type': field['suggested_type'],
                'description': field.get('description', f'Extracted {field["name"]}'),
                'extraction_hints': field['extraction_hints'],
                'default_value': '',
                'confidence_threshold': 0.7
            }
            smart_variables.append(variable)
        
        # Generate template content
        template_content = self._generate_template_content(analysis, smart_variables)
        
        # Create extraction rules
        extraction_rules = self._generate_extraction_rules(analysis['detected_fields'])
        
        template = {
            'name': template_name,
            'description': f'AI-generated template for {analysis["document_type"]} documents',
            'category': analysis['suggested_category'],
            'template_content': template_content,
            'template_type': 'markdown',
            'variables': smart_variables,
            'extraction_rules': extraction_rules,
            'generation_settings': {
                'ai_generated': True,
                'source_analysis_id': analysis['analysis_id'],
                'generation_method': 'ai_automatic',
                'complexity': analysis['extraction_complexity']
            },
            'tags': self._generate_tags(analysis),
            'ai_confidence': analysis['confidence'],
            'generation_method': 'ai_automatic'
        }
        
        return template
    
    def _generate_template_content(self, analysis: Dict[str, Any], variables: List[Dict]) -> str:
        """Generate markdown template content"""
        
        document_type = analysis['document_type'].replace('_', ' ').title()
        
        content = f"# {document_type} Summary\n\n"
        content += f"**Document Type:** {document_type}\n"
        content += f"**Processing Date:** {{processing_date}}\n\n"
        
        # Group variables by importance
        high_importance = [v for v in variables if analysis['detected_fields'][variables.index(v)].get('importance') == 'high']
        medium_importance = [v for v in variables if analysis['detected_fields'][variables.index(v)].get('importance') == 'medium']
        low_importance = [v for v in variables if analysis['detected_fields'][variables.index(v)].get('importance') == 'low']
        
        if high_importance:
            content += "## Key Information\n\n"
            for var in high_importance:
                content += f"**{var['name'].replace('_', ' ').title()}:** {{{var['name']}}}\n"
            content += "\n"
        
        if medium_importance:
            content += "## Additional Details\n\n"
            for var in medium_importance:
                content += f"**{var['name'].replace('_', ' ').title()}:** {{{var['name']}}}\n"
            content += "\n"
        
        if low_importance:
            content += "## Other Information\n\n"
            for var in low_importance:
                content += f"**{var['name'].replace('_', ' ').title()}:** {{{var['name']}}}\n"
            content += "\n"
        
        content += "---\n"
        content += "*Template generated automatically by AI*\n"
        
        return content
    
    def _generate_extraction_rules(self, detected_fields: List[Dict]) -> List[Dict]:
        """Generate extraction rules for the template"""
        rules = []
        
        for field in detected_fields:
            rule = {
                'field_name': field['name'],
                'extraction_method': 'ai_guided',
                'patterns': field.get('sample_values', []),
                'keywords': field.get('extraction_hints', []),
                'confidence_threshold': 0.7,
                'field_type': field['suggested_type']
            }
            rules.append(rule)
        
        return rules
    
    def _generate_tags(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate appropriate tags for the template"""
        tags = ['ai_generated']
        
        document_type = analysis['document_type']
        if document_type != 'unknown':
            tags.append(document_type)
        
        category = analysis['suggested_category'].lower()
        if category != 'other':
            tags.append(category)
        
        complexity = analysis['extraction_complexity']
        tags.append(f'{complexity}_extraction')
        
        return tags


# Global instance
ai_template_generator = AITemplateGenerator()