import aiohttp
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid

from .docling_service import DoclingService
from .ai_content_classifier import ai_classifier, ContentCategory
from ..models.document import DocumentMetadata
from .llm_service import llm_service

logger = logging.getLogger(__name__)

class EnhancedDoclingService(DoclingService):
    """Enhanced DoclingService with AI-powered content optimization"""
    
    def __init__(self):
        super().__init__()
        self.ai_classifier = ai_classifier
        self.llm_service = llm_service
        self.logger = logging.getLogger(__name__)
    
    async def process_document_with_ai_enhancement(
        self,
        file_path: Path,
        extract_text: bool = True,
        extract_metadata: bool = True,
        extract_structure: bool = True,
        use_ai_enhancement: bool = True
    ) -> Dict[str, Any]:
        """Process document with AI enhancement"""
        
        start_time = datetime.utcnow()
        job_id = str(uuid.uuid4())
        
        try:
            self.logger.info(f"Starting AI-enhanced processing: {file_path.name} (job_id: {job_id})")
            
                        # Handle text files directly (Docling doesn't support them)
            if file_path.suffix.lower() in ['.txt', '.text']:
                self.logger.info(f"Processing text file directly: {file_path.name}")
                
                try:
                    # Enhanced text file processing with better structure detection
                    basic_result = await self._process_text_file_enhanced(file_path, start_time, job_id)
                except Exception as e:
                    self.logger.error(f"Failed to read text file: {e}")
                    return {
                        'job_id': job_id,
                        'status': 'failed',
                        'error_message': f'Failed to read text file: {str(e)}',
                        'created_at': start_time.isoformat(),
                        'completed_at': datetime.utcnow().isoformat()
                    }
            else:
                # Step 1: Basic Docling processing (original code)
                basic_result = await self.process_document(
                    file_path, extract_text, extract_metadata, extract_structure
                )
            
            if not use_ai_enhancement or basic_result.get('status') != 'completed':
                basic_result['ai_enhancement_enabled'] = False
                return basic_result
            
            # Step 2: AI Content Classification
            content = basic_result.get('content', {})
            metadata = basic_result.get('metadata', {})
            text_content = content.get('text', '')
            
            if text_content:
                self.logger.info(f"Starting AI classification for: {file_path.name}")
                classification = await self.ai_classifier.classify_document_content(
                    text_content, metadata
                )
                
                # Step 3: Enhanced Structure Extraction
                enhanced_content = await self._ai_enhanced_structure_extraction(
                    content, classification
                )
                
                # Step 4: Context-Aware Data Extraction
                extracted_data = await self._ai_guided_data_extraction(
                    text_content, classification
                )
                
                # Step 5: Content Quality Assessment
                quality_assessment = await self._assess_content_quality(
                    text_content, classification
                )
                
                # Combine results
                end_time = datetime.utcnow()
                processing_time = (end_time - start_time).total_seconds()
                
                enhanced_result = {
                    **basic_result,
                    'content': enhanced_content,
                    'ai_classification': classification,
                    'extracted_data': extracted_data,
                    'quality_assessment': quality_assessment,
                    'ai_enhancement_enabled': True,
                    'ai_processing_time': processing_time - basic_result.get('processing_time', 0),
                    'processing_method': 'ai_enhanced_docling'
                }
                
                self.logger.info(f"AI enhancement completed for: {file_path.name} in {processing_time:.2f}s")
                return enhanced_result
            else:
                self.logger.warning(f"No text content found for AI enhancement: {file_path.name}")
                basic_result['ai_enhancement_enabled'] = False
                basic_result['ai_enhancement_note'] = 'No text content available for AI analysis'
                return basic_result
            
        except Exception as e:
            self.logger.error(f"Error in AI enhancement: {e}")
            # Return basic result with error information
            basic_result = await self.process_document(
                file_path, extract_text, extract_metadata, extract_structure
            )
            basic_result['ai_enhancement_enabled'] = False
            basic_result['ai_enhancement_error'] = str(e)
            return basic_result
    
    async def _ai_enhanced_structure_extraction(
        self,
        content: Dict[str, Any],
        classification: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Enhance structure extraction using AI insights"""
        
        enhanced_content = content.copy()
        
        # Get AI recommendations for structure patterns
        recommendations = classification.get('extraction_recommendations', {})
        structure_patterns = recommendations.get('structure_patterns', [])
        
        # Apply AI-guided structure enhancement
        if structure_patterns:
            enhanced_content['ai_structure_analysis'] = {
                'detected_patterns': structure_patterns,
                'confidence': classification.get('confidence_score', 0.5),
                'enhancement_applied': True,
                'category_specific_analysis': await self._category_specific_structure_analysis(
                    content, classification
                )
            }
        
        # Enhance existing structure data with AI insights
        if 'layout_info' in enhanced_content:
            enhanced_content['layout_info']['ai_enhanced'] = True
            enhanced_content['layout_info']['structure_confidence'] = classification.get('confidence_score', 0.5)
        
        return enhanced_content
    
    async def _category_specific_structure_analysis(
        self,
        content: Dict[str, Any],
        classification: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Perform category-specific structure analysis"""
        
        category = classification.get('primary_category', 'unknown')
        text_content = content.get('text', '')
        
        analysis = {
            'category': category,
            'specific_elements': [],
            'data_regions': [],
            'processing_recommendations': []
        }
        
        if category == 'invoice':
            analysis.update(await self._analyze_invoice_structure(text_content))
        elif category == 'business_report':
            analysis.update(await self._analyze_report_structure(text_content))
        elif category == 'legal_contract':
            analysis.update(await self._analyze_contract_structure(text_content))
        elif category == 'financial_statement':
            analysis.update(await self._analyze_financial_structure(text_content))
        
        return analysis
    
    async def _analyze_invoice_structure(self, content: str) -> Dict[str, Any]:
        """Analyze invoice-specific structure elements"""
        return {
            'specific_elements': ['header', 'vendor_info', 'billing_info', 'line_items', 'totals'],
            'data_regions': ['amounts', 'dates', 'item_descriptions'],
            'processing_recommendations': ['extract_line_items', 'validate_totals', 'identify_due_date']
        }
    
    async def _analyze_report_structure(self, content: str) -> Dict[str, Any]:
        """Analyze business report structure elements"""
        return {
            'specific_elements': ['executive_summary', 'sections', 'conclusions', 'appendices'],
            'data_regions': ['metrics', 'charts', 'recommendations'],
            'processing_recommendations': ['extract_key_metrics', 'identify_trends', 'summarize_findings']
        }
    
    async def _analyze_contract_structure(self, content: str) -> Dict[str, Any]:
        """Analyze legal contract structure elements"""
        return {
            'specific_elements': ['parties', 'recitals', 'terms', 'conditions', 'signatures'],
            'data_regions': ['dates', 'obligations', 'monetary_terms'],
            'processing_recommendations': ['identify_parties', 'extract_key_terms', 'validate_signatures']
        }
    
    async def _analyze_financial_structure(self, content: str) -> Dict[str, Any]:
        """Analyze financial statement structure elements"""
        return {
            'specific_elements': ['balance_sheet', 'income_statement', 'cash_flow', 'notes'],
            'data_regions': ['financial_figures', 'ratios', 'comparisons'],
            'processing_recommendations': ['extract_key_figures', 'calculate_ratios', 'identify_trends']
        }
    
    async def _ai_guided_data_extraction(
        self,
        text_content: str,
        classification: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Extract structured data using AI guidance"""
        
        category = classification.get('primary_category', 'unknown')
        recommendations = classification.get('extraction_recommendations', {})
        key_data_points = recommendations.get('key_data_points', [])
        
        if not key_data_points:
            return {
                'extraction_method': 'skipped',
                'reason': 'No key data points identified'
            }
        
        # Create extraction prompt based on document type
        extraction_prompt = self._build_extraction_prompt(
            text_content, category, key_data_points
        )
        
        try:
            # Use AI for guided extraction
            extracted_data = await self._call_ollama_for_extraction(extraction_prompt)
            
            return {
                'extraction_method': 'ai_guided',
                'target_data_points': key_data_points,
                'extracted_values': extracted_data.get('extracted_data', {}),
                'confidence_scores': extracted_data.get('confidence_scores', {}),
                'extraction_notes': extracted_data.get('extraction_notes', ''),
                'overall_confidence': classification.get('confidence_score', 0.5)
            }
            
        except TimeoutError as e:
            self.logger.warning(f"AI extraction timed out: {e}")
            # Provide pattern-based fallback for timeout
            fallback_data = self._pattern_based_extraction(text_content, category, key_data_points)
            return {
                'extraction_method': 'pattern_fallback',
                'target_data_points': key_data_points,
                'extracted_values': fallback_data,
                'confidence_scores': {field: 0.3 for field in key_data_points},  # Lower confidence
                'extraction_notes': 'AI extraction timed out, used pattern matching fallback',
                'fallback_reason': 'timeout',
                'overall_confidence': 0.3
            }
            
        except Exception as e:
            self.logger.error(f"Error in AI-guided extraction: {e}")
            # Provide pattern-based fallback for other errors
            fallback_data = self._pattern_based_extraction(text_content, category, key_data_points)
            return {
                'extraction_method': 'pattern_fallback',
                'target_data_points': key_data_points,
                'extracted_values': fallback_data,
                'confidence_scores': {field: 0.2 for field in key_data_points},  # Even lower confidence
                'extraction_notes': f'AI extraction failed: {str(e)}, used pattern matching fallback',
                'fallback_reason': 'error',
                'error': str(e),
                'overall_confidence': 0.2
            }
    
    def _build_extraction_prompt(
        self,
        content: str,
        category: str,
        data_points: List[str]
    ) -> str:
        """Build context-specific extraction prompt"""
        
        category_instructions = {
            'invoice': 'Focus on amounts, dates, vendor information, and line items. Look for totals, tax amounts, and payment terms.',
            'business_report': 'Extract key metrics, conclusions, financial data, and recommendations. Focus on quantitative data and insights.',
            'legal_contract': 'Identify parties, terms, dates, obligations, and monetary amounts. Look for key clauses and conditions.',
            'financial_statement': 'Extract financial figures, ratios, key indicators, and performance metrics. Focus on numerical data.',
            'technical_document': 'Extract specifications, requirements, procedures, and technical parameters.',
            'form': 'Extract field values, selections, and user-provided information.',
            'correspondence': 'Extract key points, dates, contacts, and action items.'
        }
        
        instruction = category_instructions.get(category, 'Extract key information and data points relevant to the document type.')
        
        # Build simple, direct prompt that works reliably
        fields_str = ', '.join(data_points)
        
        return f"""Extract {fields_str} from this {category}:

{content[:1000]}

Return ONLY JSON:
{{
    "extracted_data": {{{', '.join(f'"{field}": "value"' for field in data_points)}}},
    "confidence_scores": {{{', '.join(f'"{field}": 0.9' for field in data_points)}}},
    "extraction_notes": "brief note"
}}"""
    
    async def _call_ollama_for_extraction(self, prompt: str) -> Dict[str, Any]:
        """Call LLM for data extraction with robust JSON parsing"""
        
        try:
            # Use the unified LLM service with optimized parameters and timeout
            response_text = await self.llm_service.complete(
                prompt,
                temperature=0.0,  # Deterministic output
                max_tokens=300,   # Force concise responses
                timeout=10.0      # 10 second timeout for template generation
            )
            
            # Log raw response for debugging
            self.logger.debug(f"Raw LLM response: {response_text[:500]}...")
            
            # Try multiple parsing strategies
            parsed_response = await self._parse_json_response(response_text)
            
            if parsed_response:
                return parsed_response
            else:
                # If all parsing fails, return structured error
                self.logger.error(f"Failed to parse any valid JSON from response")
                return {
                    'extracted_data': {},
                    'confidence_scores': {},
                    'extraction_notes': 'Failed to parse LLM response as JSON'
                }
                        
        except Exception as e:
            self.logger.error(f"LLM API call failed: {e}")
            raise
    
    async def _parse_json_response(self, response_text: str) -> Optional[Dict[str, Any]]:
        """Try multiple strategies to parse JSON from LLM response"""
        
        # Strategy 1: Direct JSON parsing
        try:
            return json.loads(response_text.strip())
        except json.JSONDecodeError:
            pass
        
        # Strategy 2: Extract JSON from between curly braces
        import re
        json_pattern = r'\{[^{}]*\{[^{}]*\}[^{}]*\}'
        matches = re.findall(json_pattern, response_text, re.DOTALL)
        
        for match in matches:
            try:
                return json.loads(match)
            except json.JSONDecodeError:
                continue
        
        # Strategy 3: Clean common issues and retry
        cleaned_text = response_text.strip()
        
        # Remove markdown code blocks
        if "```json" in cleaned_text:
            cleaned_text = cleaned_text.split("```json")[1].split("```")[0]
        elif "```" in cleaned_text:
            cleaned_text = cleaned_text.split("```")[1].split("```")[0]
        
        # Remove common prefixes/suffixes
        prefixes = ["Here is the JSON:", "JSON:", "Response:", "Output:"]
        for prefix in prefixes:
            if cleaned_text.startswith(prefix):
                cleaned_text = cleaned_text[len(prefix):].strip()
        
        try:
            return json.loads(cleaned_text)
        except json.JSONDecodeError:
            pass
        
        # Strategy 4: Try to fix common JSON errors
        # Fix single quotes
        fixed_text = cleaned_text.replace("'", '"')
        
        # Fix trailing commas
        fixed_text = re.sub(r',\s*}', '}', fixed_text)
        fixed_text = re.sub(r',\s*]', ']', fixed_text)
        
        try:
            return json.loads(fixed_text)
        except json.JSONDecodeError:
            pass
        
        return None
    
    async def _assess_content_quality(
        self,
        content: str,
        classification: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Assess the quality and completeness of extracted content"""
        
        quality_metrics = {
            'content_length': len(content),
            'word_count': len(content.split()),
            'completeness_score': 0.0,
            'readability_score': 0.0,
            'structure_score': 0.0,
            'overall_quality': 'unknown'
        }
        
        # Basic completeness assessment
        if quality_metrics['word_count'] > 100:
            quality_metrics['completeness_score'] = min(1.0, quality_metrics['word_count'] / 1000)
        
        # Simple readability assessment
        sentences = content.count('.') + content.count('!') + content.count('?')
        if sentences > 0:
            avg_words_per_sentence = quality_metrics['word_count'] / sentences
            # Ideal range: 15-20 words per sentence
            if 10 <= avg_words_per_sentence <= 25:
                quality_metrics['readability_score'] = 0.8
            else:
                quality_metrics['readability_score'] = 0.5
        
        # Structure assessment based on classification confidence
        classification_confidence = classification.get('confidence_score', 0.5)
        quality_metrics['structure_score'] = classification_confidence
        
        # Overall quality calculation
        overall_score = (
            quality_metrics['completeness_score'] * 0.4 +
            quality_metrics['readability_score'] * 0.3 +
            quality_metrics['structure_score'] * 0.3
        )
        
        if overall_score >= 0.8:
            quality_metrics['overall_quality'] = 'high'
        elif overall_score >= 0.6:
            quality_metrics['overall_quality'] = 'medium'
        else:
            quality_metrics['overall_quality'] = 'low'
        
        # Add quality insights
        quality_insights = []
        
        if quality_metrics['word_count'] < 50:
            quality_insights.append('Document may be too short for comprehensive analysis')
        
        if classification_confidence < 0.6:
            quality_insights.append('Document classification has low confidence')
        
        if quality_metrics['readability_score'] < 0.5:
            quality_insights.append('Document may have readability issues')
        
        quality_metrics['insights'] = quality_insights
        quality_metrics['assessment_timestamp'] = datetime.utcnow().isoformat()
        
        return quality_metrics
    
    async def batch_process_with_ai_enhancement(
        self,
        file_paths: List[Path],
        extract_text: bool = True,
        extract_metadata: bool = True,
        extract_structure: bool = True,
        use_ai_enhancement: bool = True
    ) -> List[Dict[str, Any]]:
        """Process multiple documents with AI enhancement"""
        
        self.logger.info(f"Starting AI-enhanced batch processing of {len(file_paths)} documents")
        
        results = []
        
        for file_path in file_paths:
            try:
                result = await self.process_document_with_ai_enhancement(
                    file_path,
                    extract_text=extract_text,
                    extract_metadata=extract_metadata,
                    extract_structure=extract_structure,
                    use_ai_enhancement=use_ai_enhancement
                )
                results.append(result)
                
            except Exception as e:
                self.logger.error(f"Error processing {file_path}: {e}")
                results.append({
                    'job_id': str(uuid.uuid4()),
                    'status': 'failed',
                    'filename': file_path.name,
                    'error_message': str(e),
                    'created_at': datetime.utcnow().isoformat(),
                    'completed_at': datetime.utcnow().isoformat(),
                    'ai_enhancement_enabled': False
                })
        
        self.logger.info(f"AI-enhanced batch processing completed: {len(results)} results")
        return results
    
    async def _process_text_file_enhanced(
        self,
        file_path: Path,
        start_time: datetime,
        job_id: str
    ) -> Dict[str, Any]:
        """Enhanced text file processing with structure detection"""
        
        # Read file with encoding detection
        try:
            import chardet
        except ImportError:
            self.logger.warning("chardet not available, using utf-8 encoding")
            chardet = None
        
        # Detect encoding if chardet is available
        encoding = 'utf-8'
        if chardet:
            try:
                with open(file_path, 'rb') as f:
                    raw_data = f.read()
                    detected = chardet.detect(raw_data)
                    encoding = detected['encoding'] or 'utf-8'
            except Exception:
                encoding = 'utf-8'
        
        # Read text content with proper encoding
        with open(file_path, 'r', encoding=encoding, errors='replace') as f:
            text_content = f.read().strip()
        
        if not text_content:
            raise ValueError("Text file is empty")
        
        # Enhanced structure detection for text files
        structure_analysis = await self._analyze_text_structure(text_content)
        
        # Extract metadata from file
        stat = file_path.stat()
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        return {
            'job_id': job_id,
            'status': 'completed',
            'content': {
                'text': text_content,
                'markdown': text_content,  # For text files, use as-is
                'layout_info': structure_analysis,
                'word_count': len(text_content.split()),
                'character_count': len(text_content),
                'line_count': len(text_content.splitlines())
            },
            'metadata': {
                'filename': file_path.name,
                'file_size': stat.st_size,
                'mime_type': 'text/plain',
                'format': 'text/plain',
                'document_type': 'TXT',
                'created_at': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'title': file_path.stem,
                'pages': 1,
                'word_count': len(text_content.split()),
                'character_count': len(text_content),
                'line_count': len(text_content.splitlines()),
                'encoding': encoding,
                'processing_method': 'enhanced_text_analysis'
            },
            'structure': {
                'sections': structure_analysis.get('sections', []),
                'tables': [],  # Text files typically don't have structured tables
                'images': [],
                'headings': structure_analysis.get('headings', [])
            },
            'created_at': start_time.isoformat(),
            'completed_at': datetime.utcnow().isoformat(),
            'processing_time': processing_time,
            'processing_method': 'enhanced_text_analysis'
        }
    
    async def _analyze_text_structure(self, content: str) -> Dict[str, Any]:
        """Analyze text structure to detect headings, sections, paragraphs"""
        
        lines = content.splitlines()
        structure = {
            'headings': [],
            'paragraphs': [],
            'sections': [],
            'layout_detected': True,
            'pages': 1
        }
        
        current_section = None
        paragraph_text = ""
        line_number = 0
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:  # Empty line - end of paragraph
                if paragraph_text:
                    structure['paragraphs'].append({
                        'text': paragraph_text.strip(),
                        'position': line_number,
                        'section': current_section
                    })
                    paragraph_text = ""
                continue
            
            # Detect headings (lines that are short, capitalized, or have special formatting)
            if self._is_likely_heading(line, i, lines):
                # Save current paragraph before heading
                if paragraph_text:
                    structure['paragraphs'].append({
                        'text': paragraph_text.strip(),
                        'position': line_number,
                        'section': current_section
                    })
                    paragraph_text = ""
                
                # Add heading
                heading_level = self._determine_heading_level(line)
                structure['headings'].append({
                    'text': line,
                    'level': heading_level,
                    'position': i,
                    'line_number': i + 1
                })
                
                # Start new section
                current_section = line
                structure['sections'].append({
                    'title': line,
                    'start_line': i + 1,
                    'level': heading_level
                })
            else:
                # Regular content line
                if paragraph_text:
                    paragraph_text += " " + line
                else:
                    paragraph_text = line
                    line_number = i + 1
        
        # Add final paragraph if exists
        if paragraph_text:
            structure['paragraphs'].append({
                'text': paragraph_text.strip(),
                'position': line_number,
                'section': current_section
            })
        
        return structure
    
    def _is_likely_heading(self, line: str, index: int, all_lines: list) -> bool:
        """Determine if a line is likely a heading"""
        
        # Skip very long lines (probably paragraphs)
        if len(line) > 100:
            return False
        
        # Import re here to avoid import issues
        import re
        
        # Check for common heading patterns
        patterns = [
            line.isupper() and len(line.split()) <= 8,  # ALL CAPS short lines
            line.startswith('#'),  # Markdown headings
            line.endswith(':') and len(line.split()) <= 6,  # Colon endings
            bool(re.match(r'^[0-9]+\.?\s+', line)),  # Numbered headings
            bool(re.match(r'^[A-Z][a-z]*(\s+[A-Z][a-z]*)*$', line)) and len(line.split()) <= 5,  # Title Case
        ]
        
        # Check if followed by content (not another heading)
        has_content_after = (
            index + 1 < len(all_lines) and 
            all_lines[index + 1].strip() and 
            not self._looks_like_heading_pattern(all_lines[index + 1])
        )
        
        return any(patterns) and (has_content_after or index == len(all_lines) - 1)
    
    def _looks_like_heading_pattern(self, line: str) -> bool:
        """Quick check if line looks like a heading"""
        import re
        line = line.strip()
        return (
            line.isupper() or 
            line.startswith('#') or 
            line.endswith(':') or
            bool(re.match(r'^[0-9]+\.?\s+', line))
        )
    
    def _determine_heading_level(self, line: str) -> int:
        """Determine heading level (1-6)"""
        import re
        
        if line.startswith('#'):
            return min(line.count('#'), 6)
        elif line.isupper():
            return 1  # ALL CAPS likely main headings
        elif re.match(r'^[0-9]+\.?\s+', line):
            return 2  # Numbered headings
        elif line.endswith(':'):
            return 3  # Colon headings
        else:
            return 2  # Default level
    
    def _pattern_based_extraction(
        self,
        content: str,
        category: str,
        data_points: List[str]
    ) -> Dict[str, Any]:
        """Pattern-based fallback extraction when AI fails or times out"""
        
        import re
        content_lower = content.lower()
        extracted = {}
        
        # Common patterns for different data types
        patterns = {
            'date': [
                r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b',  # MM/DD/YYYY or DD/MM/YYYY
                r'\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b',    # YYYY/MM/DD
                r'\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b'
            ],
            'currency': [
                r'\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\b',  # $1,234.56
                r'\b(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|usd)\b'
            ],
            'number': [
                r'\b(\d+(?:,\d{3})*(?:\.\d{2})?)\b'
            ],
            'email': [
                r'\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b'
            ],
            'phone': [
                r'\b(\(\d{3}\)\s*\d{3}-\d{4})\b',  # (123) 456-7890
                r'\b(\d{3}[-.]?\d{3}[-.]?\d{4})\b'  # 123-456-7890 or 123.456.7890
            ]
        }
        
        # Category-specific extraction logic
        if category in ['invoice', 'bill', 'receipt']:
            extracted.update(self._extract_invoice_patterns(content, content_lower, patterns))
        elif category == 'contract':
            extracted.update(self._extract_contract_patterns(content, content_lower, patterns))
        elif category == 'correspondence':
            extracted.update(self._extract_correspondence_patterns(content, content_lower, patterns))
        
        # Generic extraction for any remaining fields
        for field in data_points:
            if field not in extracted:
                extracted[field] = self._extract_generic_field(field, content, content_lower, patterns)
        
        return extracted
    
    def _extract_invoice_patterns(self, content: str, content_lower: str, patterns: dict) -> dict:
        """Extract invoice-specific patterns"""
        extracted = {}
        
        # Look for invoice number
        invoice_patterns = [
            r'invoice\s*#?\s*:?\s*([a-zA-Z0-9-]+)',
            r'inv\s*#?\s*:?\s*([a-zA-Z0-9-]+)',
            r'bill\s*#?\s*:?\s*([a-zA-Z0-9-]+)'
        ]
        for pattern in invoice_patterns:
            match = __import__('re').search(pattern, content_lower)
            if match:
                extracted['invoice_number'] = match.group(1)
                break
        
        # Look for total amount (usually largest currency value)
        currency_matches = []
        for pattern in patterns['currency']:
            matches = __import__('re').findall(pattern, content, __import__('re').IGNORECASE)
            currency_matches.extend([float(m.replace(',', '')) for m in matches if m])
        
        if currency_matches:
            extracted['total_amount'] = f"${max(currency_matches):.2f}"
        
        # Look for dates
        for pattern in patterns['date']:
            match = __import__('re').search(pattern, content, __import__('re').IGNORECASE)
            if match:
                extracted['invoice_date'] = match.group(1)
                break
        
        return extracted
    
    def _extract_contract_patterns(self, content: str, content_lower: str, patterns: dict) -> dict:
        """Extract contract-specific patterns"""
        extracted = {}
        
        # Look for party names (often after "between" or before "party")
        party_patterns = [
            r'between\s+([^,\n]+?)\s+and\s+([^,\n]+)',
            r'party\s+1:?\s*([^,\n]+)',
            r'party\s+2:?\s*([^,\n]+)'
        ]
        
        for pattern in party_patterns:
            match = __import__('re').search(pattern, content_lower)
            if match and 'party_1_name' not in extracted:
                if len(match.groups()) >= 2:
                    extracted['party_1_name'] = match.group(1).strip()
                    extracted['party_2_name'] = match.group(2).strip()
                else:
                    extracted['party_1_name'] = match.group(1).strip()
                break
        
        # Look for effective date
        effective_patterns = [
            r'effective\s+(?:date:?\s*)?([^,\n]+)',
            r'dated\s+([^,\n]+)'
        ]
        for pattern in effective_patterns:
            match = __import__('re').search(pattern, content_lower)
            if match:
                extracted['effective_date'] = match.group(1).strip()
                break
        
        return extracted
    
    def _extract_correspondence_patterns(self, content: str, content_lower: str, patterns: dict) -> dict:
        """Extract correspondence-specific patterns"""
        extracted = {}
        
        # Look for recipient (after "Dear")
        dear_match = __import__('re').search(r'dear\s+([^,\n]+)', content_lower)
        if dear_match:
            extracted['recipient_name'] = dear_match.group(1).strip()
        
        # Look for sender (before "Sincerely" or "Regards")
        signature_patterns = [
            r'(?:sincerely|regards|best\s+regards),?\s*\n\s*([^,\n]+)',
            r'(?:sincerely|regards|best\s+regards),?\s*([^,\n]+)'
        ]
        for pattern in signature_patterns:
            match = __import__('re').search(pattern, content_lower)
            if match:
                extracted['sender_name'] = match.group(1).strip()
                break
        
        return extracted
    
    def _extract_generic_field(self, field_name: str, content: str, content_lower: str, patterns: dict) -> str:
        """Extract generic field using field name hints"""
        
        # Try to find field by name proximity
        field_lower = field_name.lower().replace('_', ' ')
        
        # Look for "field_name: value" pattern
        field_patterns = [
            rf'{field_lower}\s*:?\s*([^\n,]+)',
            rf'{field_name.replace("_", " ")}\s*:?\s*([^\n,]+)'
        ]
        
        for pattern in field_patterns:
            match = __import__('re').search(pattern, content_lower)
            if match:
                return match.group(1).strip()
        
        # Try type-specific patterns based on field name
        if any(word in field_lower for word in ['date', 'when', 'time']):
            for pattern in patterns['date']:
                match = __import__('re').search(pattern, content)
                if match:
                    return match.group(1)
        
        elif any(word in field_lower for word in ['amount', 'total', 'cost', 'price']):
            for pattern in patterns['currency']:
                match = __import__('re').search(pattern, content)
                if match:
                    return f"${match.group(1)}"
        
        elif any(word in field_lower for word in ['email', 'mail']):
            for pattern in patterns['email']:
                match = __import__('re').search(pattern, content)
                if match:
                    return match.group(1)
        
        elif any(word in field_lower for word in ['phone', 'tel', 'number']):
            for pattern in patterns['phone']:
                match = __import__('re').search(pattern, content)
                if match:
                    return match.group(1)
        
        return ""  # Return empty string if no pattern found

# Global enhanced service instance
enhanced_docling_service = EnhancedDoclingService()