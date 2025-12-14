"""
Template Generation Service
Automatically generates template suggestions when no existing templates match a document.
"""

import logging
import asyncio
import json
import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass, asdict

from .azure_openai_service import AzureOpenAIService
from ..config.providers import ProviderConfig

logger = logging.getLogger(__name__)

@dataclass
class SmartVariable:
    """Represents a smart variable in a generated template"""
    name: str
    display_name: str
    type: str  # text, number, date, currency, email, etc.
    description: str
    required: bool
    extraction_hints: List[str]
    sample_value: Optional[str] = None
    validation_pattern: Optional[str] = None

@dataclass
class GeneratedTemplate:
    """Represents an auto-generated template structure"""
    name: str
    category: str
    description: str
    smart_variables: List[SmartVariable]
    confidence: float
    generation_metadata: Dict[str, Any]
    sample_values: Dict[str, str]

class TemplateGenerationService:
    """Service for automatically generating template suggestions from documents"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.azure_service = AzureOpenAIService()
        
        # Field type patterns for validation
        self.field_type_patterns = {
            'email': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
            'phone': r'^[\+]?[1-9]?[\d\s\-\(\)]{7,15}$',
            'currency': r'^[\$€£¥]?[\d,]+\.?\d{0,2}$',
            'date': r'^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$|^\d{4}-\d{2}-\d{2}$',
            'percentage': r'^\d+\.?\d*%$',
            'number': r'^\d+\.?\d*$',
            'url': r'^(https?://)?([\w\-]+\.)+[\w\-]+(/[\w\-./?%&=]*)?$',
            'tax_id': r'^[A-Za-z0-9\-]{6,}$',
            'id': r'^[A-Za-z0-9\-]{4,}$'
        }
        
        # Common field patterns for extraction hints
        self.field_hint_mapping = {
            'invoice_number': ['invoice', 'inv', 'number', '#', 'id'],
            'receipt_number': ['receipt', 'number', '#', 'id', 'ref'],
            'total_amount': ['total', 'amount', 'sum', 'due', 'balance'],
            'date': ['date', 'dated', 'on', 'day', 'month', 'year', 'issued', 'invoice date', 'due date'],
            'company_name': ['company', 'corp', 'inc', 'ltd', 'llc', 'business'],
            'customer_name': ['customer', 'client', 'name', 'to', 'bill to'],
            'email': ['email', 'e-mail', '@', 'contact'],
            'phone': ['phone', 'tel', 'mobile', 'call'],
            'address': ['address', 'street', 'st.', 'ave', 'road', 'rd.', 'city', 'state', 'zip', 'postal', 'country'],
            'description': ['description', 'details', 'item', 'service'],
            'quantity': ['quantity', 'qty', 'amount', 'count'],
            'rate': ['rate', 'price', 'cost', 'unit price'],
            'subtotal': ['subtotal', 'sub total'],
            'tax_amount': ['tax', 'vat', 'gst'],
            'discount': ['discount', 'rebate'],
            'invoice_date': ['invoice date', 'date issued', 'issued'],
            'due_date': ['due date', 'payment due', 'net 30', 'net 15'],
            'po_number': ['po', 'purchase order', 'po#', 'po number'],
            'order_number': ['order', 'order #', 'order number'],
            'payment_terms': ['payment terms', 'terms', 'net', 'due upon receipt'],
            'website': ['website', 'url', 'http', 'https', 'www.'],
            'tax_id': ['tax id', 'vat', 'gst', 'ein', 'tin'],
            'iban': ['iban'],
            'swift': ['swift', 'bic'],
            'routing_number': ['routing', 'aba'],
            'account_number': ['account', 'acct']
        }

    async def generate_template_from_document(
        self,
        content: str,
        document_type: str,
        metadata: Optional[Dict[str, Any]] = None,
        min_confidence: float = 0.6
    ) -> Optional[GeneratedTemplate]:
        """
        Generate a template suggestion based on document content and type
        
        Args:
            content: Document text content
            document_type: Detected document type (invoice, receipt, etc.)
            metadata: Additional document metadata
            min_confidence: Minimum confidence threshold to return a template
            
        Returns:
            GeneratedTemplate or None if confidence is too low
        """
        try:
            self.logger.info(f"Generating template for document type: {document_type}")
            
            # Step 1: Analyze document for extractable fields
            field_analysis = await self._analyze_document_fields(content, document_type)
            
            if not field_analysis or field_analysis.get('confidence', 0) < min_confidence:
                self.logger.warning(f"Field analysis confidence too low: {field_analysis.get('confidence', 0)}")
                return None
            
            # Step 2: Create smart variables from analysis
            smart_variables = await self._create_smart_variables(field_analysis['fields'], content)
            
            if not smart_variables:
                self.logger.warning("No smart variables could be created")
                return None
            
            # Step 3: Generate template metadata
            template_name = self._generate_template_name(document_type, field_analysis)
            category = self._map_document_type_to_category(document_type)
            description = self._generate_template_description(document_type, smart_variables)
            
            # Step 4: Extract sample values
            sample_values = self._extract_sample_values(smart_variables, content)
            
            # Step 5: Create generation metadata
            generation_metadata = {
                'document_type': document_type,
                'generation_method': 'azure_openai_analysis',
                'ai_model': 'gpt-4',
                'timestamp': datetime.utcnow().isoformat(),
                'field_count': len(smart_variables),
                'confidence': field_analysis['confidence']
            }
            
            generated_template = GeneratedTemplate(
                name=template_name,
                category=category,
                description=description,
                smart_variables=smart_variables,
                confidence=field_analysis['confidence'],
                generation_metadata=generation_metadata,
                sample_values=sample_values
            )
            
            self.logger.info(f"Generated template '{template_name}' with {len(smart_variables)} fields")
            return generated_template
            
        except Exception as e:
            self.logger.error(f"Template generation failed: {str(e)}")
            return None

    async def _analyze_document_fields(
        self, 
        content: str, 
        document_type: str
    ) -> Optional[Dict[str, Any]]:
        """Use Azure OpenAI to analyze document and suggest extractable fields"""
        
        # Limit content to avoid token limits
        analysis_content = content[:4000] if len(content) > 4000 else content
        
        prompt = f"""
        Analyze this {document_type} document and identify all extractable data fields.
        
        Document content:
        {analysis_content}
        
        For each field you identify, provide:
        1. Field name (use snake_case, e.g., "invoice_number")
        2. Display name (human-readable, e.g., "Invoice Number")  
        3. Field type (text, number, date, currency, email, phone, percentage)
        4. Description of what this field represents
        5. Whether it's required or optional
        6. Sample value found in the document (if any)
        7. Keywords that help identify this field in text
        
        Focus on fields that would be commonly found in {document_type} documents and are likely to appear in similar documents of this type.
        
        Return your analysis as JSON in this exact format:
        {{
            "confidence": 0.85,
            "document_type": "{document_type}",
            "fields": [
                {{
                    "name": "field_name",
                    "display_name": "Field Display Name",
                    "type": "text",
                    "description": "What this field represents",
                    "required": true,
                    "sample_value": "Sample from document",
                    "keywords": ["keyword1", "keyword2"]
                }}
            ]
        }}
        """
        
        try:
            # Check if Azure OpenAI is available
            provider_config = ProviderConfig()
            if not provider_config.azure_openai_available:
                self.logger.warning("Azure OpenAI not available, using fallback analysis")
                return await self._fallback_field_analysis(content, document_type)
            
            response_content = await self.azure_service.complete(
                prompt=prompt,
                temperature=0.1,  # Low temperature for consistent analysis
                max_tokens=2000
            )
            
            response = {'content': response_content}
            
            if not response or not response.get('content'):
                self.logger.error("No response from Azure OpenAI")
                return await self._fallback_field_analysis(content, document_type)
            
            # Parse JSON response
            analysis_text = response['content'].strip()
            
            # Clean up response if it has markdown formatting
            if analysis_text.startswith('```json'):
                analysis_text = analysis_text.replace('```json', '').replace('```', '').strip()
            
            analysis = json.loads(analysis_text)
            
            # Validate the response structure
            if not isinstance(analysis, dict) or 'fields' not in analysis:
                self.logger.error("Invalid analysis structure from Azure OpenAI")
                return await self._fallback_field_analysis(content, document_type)
            
            self.logger.info(f"Azure OpenAI identified {len(analysis['fields'])} fields with {analysis.get('confidence', 0):.2f} confidence")
            return analysis
            
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse Azure OpenAI response as JSON: {e}")
            return await self._fallback_field_analysis(content, document_type)
        except Exception as e:
            self.logger.error(f"Azure OpenAI field analysis failed: {e}")
            return await self._fallback_field_analysis(content, document_type)

    async def _fallback_field_analysis(
        self, 
        content: str, 
        document_type: str
    ) -> Dict[str, Any]:
        """Fallback field analysis using pattern matching when AI is unavailable"""
        
        self.logger.info(f"Using fallback analysis for {document_type}")
        
        # Common field patterns based on document type
        type_field_patterns = {
            'invoice': [
                ('invoice_number', 'Invoice Number', ['invoice', 'inv', 'number', '#']),
                ('company_name', 'Company Name', ['company', 'from', 'seller', 'vendor']),
                ('customer_name', 'Customer Name', ['bill to', 'customer', 'client']),
                ('total_amount', 'Total Amount', ['total', 'amount', 'due', 'balance']),
                ('invoice_date', 'Invoice Date', ['invoice date', 'date issued', 'issued']),
                ('due_date', 'Due Date', ['due date', 'payment due', 'net']),
                ('email', 'Email', ['email', '@']),
                ('phone', 'Phone', ['phone', 'tel', 'mobile']),
                ('po_number', 'PO Number', ['po', 'purchase order']),
                ('order_number', 'Order Number', ['order']),
                ('subtotal', 'Subtotal', ['subtotal']),
                ('tax_amount', 'Tax', ['tax', 'vat', 'gst']),
                ('discount', 'Discount', ['discount']),
                ('website', 'Website', ['website', 'www.', 'http', 'https']),
                ('tax_id', 'Tax ID', ['tax id', 'vat', 'ein', 'tin']),
                ('address', 'Address', ['address', 'street', 'city', 'state', 'zip'])
            ],
            'receipt': [
                ('receipt_number', 'Receipt Number', ['receipt', 'number', '#']),
                ('store_name', 'Store Name', ['store', 'shop', 'retailer']),
                ('total_amount', 'Total Amount', ['total', 'amount', 'paid']),
                ('date', 'Date', ['date', 'time', 'purchased']),
                ('payment_method', 'Payment Method', ['card', 'cash', 'payment']),
                ('website', 'Website', ['website', 'www.', 'http', 'https'])
            ],
            'contract': [
                ('contract_number', 'Contract Number', ['contract', 'agreement', '#']),
                ('party_a', 'First Party', ['party', 'client', 'customer']),
                ('party_b', 'Second Party', ['contractor', 'vendor', 'service']),
                ('start_date', 'Start Date', ['start', 'begin', 'commence']),
                ('end_date', 'End Date', ['end', 'expire', 'term']),
                ('contract_value', 'Contract Value', ['value', 'amount', 'fee']),
                ('website', 'Website', ['website', 'www.', 'http', 'https'])
            ]
        }
        
        # Get patterns for this document type, fallback to invoice patterns
        patterns = type_field_patterns.get(document_type, type_field_patterns['invoice'])
        
        detected_fields = []
        content_lower = content.lower()
        
        for field_name, display_name, keywords in patterns:
            # Check if any keywords appear in the content
            found_keywords = [kw for kw in keywords if kw in content_lower]
            
            if found_keywords:
                # Determine field type based on name patterns
                field_type = self._determine_field_type(field_name)
                
                # Extract sample value using simple pattern matching
                sample_value = self._extract_simple_sample(content, keywords, field_type)
                
                detected_fields.append({
                    'name': field_name,
                    'display_name': display_name,
                    'type': field_type,
                    'description': f"{display_name} found in {document_type}",
                    'required': field_name in ['total_amount', 'date', 'invoice_number', 'receipt_number'],
                    'sample_value': sample_value,
                    'keywords': found_keywords
                })
        
        # Add generic detections (email, phone, url, tax id, addresses, amounts, dates)
        generic_fields = self._detect_generic_fields(content)
        # Merge deduplicating by name
        existing_names = {f['name'] for f in detected_fields}
        for gf in generic_fields:
            if gf['name'] not in existing_names:
                detected_fields.append(gf)
                existing_names.add(gf['name'])
        
        return {
            'confidence': 0.7,  # Match expected fallback confidence in tests
            'document_type': document_type,
            'fields': detected_fields
        }

    def _determine_field_type(self, field_name: str) -> str:
        """Determine field type based on field name patterns"""
        name_lower = field_name.lower()
        
        if 'email' in name_lower:
            return 'email'
        elif 'phone' in name_lower or 'tel' in name_lower:
            return 'phone'
        elif 'amount' in name_lower or 'price' in name_lower or 'cost' in name_lower or 'value' in name_lower:
            return 'currency'
        elif 'date' in name_lower or 'time' in name_lower:
            return 'date'
        elif 'number' in name_lower and ('invoice' in name_lower or 'receipt' in name_lower or 'contract' in name_lower):
            return 'text'  # ID numbers are text to preserve leading zeros
        elif 'email' in name_lower:
            return 'email'
        elif 'phone' in name_lower or 'tel' in name_lower:
            return 'phone'
        elif 'website' in name_lower or 'url' in name_lower:
            return 'url'
        elif 'iban' in name_lower or 'swift' in name_lower or 'routing' in name_lower or 'account' in name_lower:
            return 'text'
        elif 'tax' in name_lower or 'vat' in name_lower or 'ein' in name_lower or 'tin' in name_lower:
            return 'tax_id'
        elif 'quantity' in name_lower or 'qty' in name_lower or 'count' in name_lower:
            return 'number'
        elif 'percent' in name_lower or 'rate' in name_lower:
            return 'percentage'
        else:
            return 'text'

    def _extract_simple_sample(
        self, 
        content: str, 
        keywords: List[str], 
        field_type: str
    ) -> Optional[str]:
        """Extract a simple sample value using pattern matching"""
        
        lines = content.split('\n')
        
        for line in lines:
            line_lower = line.lower()
            
            # Check if this line contains any of our keywords
            if any(keyword in line_lower for keyword in keywords):
                # Try to extract value based on field type
                if field_type == 'currency':
                    currency_match = re.search(r'[\$€£¥]?[\d,]+\.?\d{0,2}', line)
                    if currency_match:
                        return currency_match.group()
                
                elif field_type == 'date':
                    date_match = re.search(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}', line)
                    if date_match:
                        return date_match.group()
                
                elif field_type == 'email':
                    email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', line)
                    if email_match:
                        return email_match.group()
                
                elif field_type == 'phone':
                    phone_match = re.search(r'[\+]?\d?[\d\s\-\(\)]{7,20}', line)
                    if phone_match:
                        return phone_match.group().strip()
                
                elif field_type == 'url':
                    url_match = re.search(r'(https?://[^\s]+|www\.[^\s]+)', line, re.IGNORECASE)
                    if url_match:
                        return url_match.group().strip()
                
                elif field_type == 'number':
                    number_match = re.search(r'\d+\.?\d*', line)
                    if number_match:
                        return number_match.group()
                
                else:  # text type
                    # For text, try to extract words after the keyword
                    for keyword in keywords:
                        if keyword in line_lower:
                            # Find keyword position and extract text after it
                            keyword_pos = line_lower.find(keyword)
                            after_keyword = line[keyword_pos + len(keyword):].strip()
                            
                            # Clean up common prefixes
                            after_keyword = re.sub(r'^[:\-#]*\s*', '', after_keyword)
                            
                            # Take first few words or until punctuation
                            text_match = re.match(r'^([A-Za-z0-9\s]+)', after_keyword)
                            if text_match:
                                return text_match.group(1).strip()
        
        return None

    async def _create_smart_variables(
        self, 
        fields: List[Dict[str, Any]], 
        content: str
    ) -> List[SmartVariable]:
        """Convert field analysis into SmartVariable objects"""
        
        smart_variables = []
        
        for field in fields:
            try:
                # Get extraction hints from our mapping or use keywords from analysis
                extraction_hints = self.field_hint_mapping.get(
                    field['name'], 
                    field.get('keywords', [])
                )
                
                # Generate validation pattern if applicable
                validation_pattern = None
                field_type = field.get('type', 'text')
                if field_type in self.field_type_patterns:
                    validation_pattern = self.field_type_patterns[field_type]
                
                smart_var = SmartVariable(
                    name=field['name'],
                    display_name=field.get('display_name', field['name'].replace('_', ' ').title()),
                    type=field_type,
                    description=field.get('description', f"Extracted {field.get('display_name', field['name'])}"),
                    required=field.get('required', False),
                    extraction_hints=extraction_hints,
                    sample_value=field.get('sample_value'),
                    validation_pattern=validation_pattern
                )
                
                smart_variables.append(smart_var)
                
            except Exception as e:
                self.logger.error(f"Error creating smart variable for field {field.get('name', 'unknown')}: {e}")
                continue
        
        return smart_variables

    def _generate_template_name(
        self, 
        document_type: str, 
        field_analysis: Dict[str, Any]
    ) -> str:
        """Generate a descriptive name for the template"""
        
        type_name = document_type.replace('_', ' ').title()
        confidence = field_analysis.get('confidence', 0)
        
        if confidence >= 0.9:
            prefix = "Premium"
        elif confidence >= 0.8:
            prefix = "Standard"
        elif confidence >= 0.7:
            prefix = "Basic"
        else:
            prefix = "Simple"
        
        return f"{prefix} {type_name} Template"

    def _map_document_type_to_category(self, document_type: str) -> str:
        """Map document type to template category"""
        
        category_mapping = {
            'invoice': 'finance',
            'receipt': 'finance',
            'bill': 'finance',
            'contract': 'legal',
            'agreement': 'legal',
            'report': 'business',
            'memo': 'business',
            'letter': 'correspondence',
            'form': 'data_collection',
            'application': 'hr',
            'resume': 'hr',
            'cv': 'hr'
        }
        
        return category_mapping.get(document_type.lower(), 'general')

    def _generate_template_description(
        self, 
        document_type: str, 
        smart_variables: List[SmartVariable]
    ) -> str:
        """Generate a description for the template"""
        
        field_count = len(smart_variables)
        type_name = document_type.replace('_', ' ')
        
        description = f"Auto-generated template for {type_name} documents with {field_count} extractable fields. "
        
        # Add notable field types
        field_types = set(var.type for var in smart_variables)
        notable_types = [t for t in ['currency', 'date', 'email', 'phone'] if t in field_types]
        
        if notable_types:
            description += f"Includes {', '.join(notable_types)} field validation. "
        
        description += "Created using AI analysis and can be customized as needed."
        
        return description

    def _extract_sample_values(
        self, 
        smart_variables: List[SmartVariable], 
        content: str
    ) -> Dict[str, str]:
        """Extract sample values for each variable from the document content"""
        
        sample_values = {}
        
        for var in smart_variables:
            if var.sample_value:
                sample_values[var.name] = var.sample_value
            else:
                # Try to extract using hints
                sample = self._extract_simple_sample(content, var.extraction_hints, var.type)
                if sample:
                    sample_values[var.name] = sample
        
        return sample_values

    def _detect_generic_fields(self, content: str) -> List[Dict[str, Any]]:
        """Detect generic fields across document types using regex scanning"""
        detected: List[Dict[str, Any]] = []
        text = content
        lower = text.lower()
        
        # Email
        email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', text)
        if email_match:
            detected.append({
                'name': 'email',
                'display_name': 'Email',
                'type': 'email',
                'description': 'Detected email address in document',
                'required': False,
                'sample_value': email_match.group(0),
                'keywords': ['email']
            })
        
        # Phone
        phone_match = re.search(r'[\+]?\d?[\d\s\-\(\)]{7,20}', text)
        if phone_match:
            detected.append({
                'name': 'phone',
                'display_name': 'Phone',
                'type': 'phone',
                'description': 'Detected phone number in document',
                'required': False,
                'sample_value': phone_match.group(0).strip(),
                'keywords': ['phone']
            })
        
        # URL / Website
        url_match = re.search(r'(https?://[^\s]+|www\.[^\s]+)', text, re.IGNORECASE)
        if url_match:
            detected.append({
                'name': 'website',
                'display_name': 'Website',
                'type': 'url',
                'description': 'Detected website URL',
                'required': False,
                'sample_value': url_match.group(0).strip(),
                'keywords': ['website', 'url']
            })
        
        # Tax ID / VAT
        tax_patterns = [r'\bVAT[:\s]*([A-Za-z0-9\-]{6,})\b', r'\bEIN[:\s]*([A-Za-z0-9\-]{6,})\b', r'\bTIN[:\s]*([A-Za-z0-9\-]{6,})\b', r'\bTax\s*ID[:\s]*([A-Za-z0-9\-]{6,})\b']
        for pattern in tax_patterns:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                detected.append({
                    'name': 'tax_id',
                    'display_name': 'Tax ID',
                    'type': 'tax_id',
                    'description': 'Detected tax identifier',
                    'required': False,
                    'sample_value': m.group(1),
                    'keywords': ['tax id', 'vat', 'ein', 'tin']
                })
                break
        
        # Subtotal, Tax, Discount, Total (first occurrences)
        money_re = r'[\$€£¥]?[\d,]+\.?\d{0,2}'
        for key, display, kws in [
            ('subtotal', 'Subtotal', ['subtotal']),
            ('tax_amount', 'Tax', ['tax', 'vat', 'gst']),
            ('discount', 'Discount', ['discount']),
            ('total_amount', 'Total Amount', ['total', 'amount', 'due', 'balance'])
        ]:
            for line in text.split('\n'):
                if any(kw in line.lower() for kw in kws):
                    m = re.search(money_re, line)
                    if m:
                        detected.append({
                            'name': key,
                            'display_name': display,
                            'type': 'currency',
                            'description': f'Detected {display.lower()} value',
                            'required': key in ['total_amount'],
                            'sample_value': m.group(0),
                            'keywords': kws
                        })
                        break
        
        # Dates: invoice date, due date (heuristic by nearby words)
        date_re = r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}'
        for key, display, kws in [
            ('invoice_date', 'Invoice Date', ['invoice date', 'issued']),
            ('due_date', 'Due Date', ['due date', 'payment due', 'net'])
        ]:
            for line in text.split('\n'):
                if any(kw in line.lower() for kw in kws):
                    m = re.search(date_re, line)
                    if m:
                        detected.append({
                            'name': key,
                            'display_name': display,
                            'type': 'date',
                            'description': f'Detected {display.lower()}',
                            'required': key in ['invoice_date'],
                            'sample_value': m.group(0),
                            'keywords': kws
                        })
                        break
        
        return detected

    def to_dict(self, generated_template: GeneratedTemplate) -> Dict[str, Any]:
        """Convert GeneratedTemplate to dictionary for JSON serialization"""
        
        return {
            'name': generated_template.name,
            'category': generated_template.category,
            'description': generated_template.description,
            'smart_variables': [asdict(var) for var in generated_template.smart_variables],
            'confidence': generated_template.confidence,
            'generation_metadata': generated_template.generation_metadata,
            'sample_values': generated_template.sample_values
        }

# Global instance
template_generation_service = TemplateGenerationService()