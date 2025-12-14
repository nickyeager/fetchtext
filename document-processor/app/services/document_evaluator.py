import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import mimetypes
import json
import requests
import os

from ..services.enhanced_docling_service import enhanced_docling_service
from ..services.ai_content_classifier import ai_classifier
from .template_matching_service import template_matching_service

# Safe logger initialization 
try:
    logger = logging.getLogger(__name__)
except Exception:
    # Fallback logger
    import sys
    logging.basicConfig(stream=sys.stdout, level=logging.INFO)
    logger = logging.getLogger(__name__)


class DocumentEvaluator:
    """Service for quick document type evaluation and template matching"""
    
    def __init__(self):
        # Configuration variables
        self.document_processing_timeout = float(os.getenv('DOCUMENT_PROCESSING_TIMEOUT', 45.0))
        self.template_query_timeout = float(os.getenv('TEMPLATE_QUERY_TIMEOUT', 10.0))
        
        self.supported_formats = {
            '.pdf': 'application/pdf',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.doc': 'application/msword',
            '.html': 'text/html',
            '.htm': 'text/html',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.txt': 'text/plain',
            '.csv': 'text/csv',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
        
        # Template matching criteria
        self.template_patterns = {
            'invoice': {
                'keywords': ['invoice', 'bill', 'payment', 'due', 'total', 'amount', 'tax'],
                'required_fields': ['vendor_name', 'invoice_number', 'total_amount'],
                'category': 'Financial'
            },
            'receipt': {
                'keywords': ['receipt', 'purchase', 'transaction', 'store', 'payment'],
                'required_fields': ['merchant_name', 'total_amount', 'transaction_date'],
                'category': 'Retail'
            },
            'contract': {
                'keywords': ['agreement', 'contract', 'terms', 'party', 'signature', 'whereas'],
                'required_fields': ['party_names', 'agreement_date', 'terms'],
                'category': 'Legal'
            },
            'resume': {
                'keywords': ['experience', 'education', 'skills', 'objective', 'employment'],
                'required_fields': ['name', 'contact_info', 'experience', 'education'],
                'category': 'HR'
            },
            'report': {
                'keywords': ['summary', 'analysis', 'findings', 'conclusion', 'report'],
                'required_fields': ['title', 'author', 'date', 'summary'],
                'category': 'Business'
            }
        }
    
    async def evaluate_document(
        self,
        file_path: Path,
        filename: str,
        content_type: str,
        quick_scan: bool = True,
        content_override: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluate document type with configurable depth

        Args:
            file_path: Path to document file
            filename: Original filename
            content_type: MIME type of the file
            quick_scan: If True, performs quick analysis; if False, full analysis
            content_override: Pre-extracted clean text content (bypasses file extraction)

        Quick scan: First page/partial analysis, basic patterns
        Full scan: Complete document analysis with AI
        """
        
        # Get file info
        file_info = self._get_file_info(file_path, filename, content_type)

        if not file_info['format_supported']:
            return {
                'document_info': file_info,
                'type_evaluation': {
                    'primary_type': 'unsupported',
                    'confidence': 1.0,
                    'detection_method': 'format_check'
                },
                'processing_recommendations': {
                    'workflow': 'unsupported',
                    'suggested_action': 'Please upload a supported file format',
                    'alternative_actions': []
                }
            }

        # Perform document analysis
        if quick_scan:
            type_evaluation = await self._quick_type_detection_simple(file_path, file_info, content_override)
        else:
            type_evaluation = await self._quick_type_detection_simple(file_path, file_info, content_override)

        # Get content preview
        if content_override:
            logger.info(f"Using provided content override ({len(content_override)} chars) for content preview")
            content_preview = self._get_content_preview_from_text(content_override, quick_scan)
        else:
            content_preview = await self._get_content_preview_simple(file_path, quick_scan)
        
        # Find matching templates using the advanced template matching service
        print(f"[TEMPLATE DEBUG] Finding templates for document type: {type_evaluation['primary_type']}")
        print(f"[TEMPLATE DEBUG] Key phrases: {content_preview.get('key_phrases', [])}")
        logger.info(f"Finding templates for document type: {type_evaluation['primary_type']}")
        logger.info(f"Key phrases: {content_preview.get('key_phrases', [])}")
        template_suggestions = await template_matching_service.find_matching_templates(
            document_type=type_evaluation['primary_type'],
            content_keywords=content_preview.get('key_phrases', []),
            min_confidence=0.5  # Lower threshold for better suggestions
        )
        print(f"[TEMPLATE DEBUG] Template suggestions returned: {len(template_suggestions)} templates")
        logger.info(f"Template suggestions returned: {len(template_suggestions)} templates")
        
        # Determine processing workflow
        processing_recommendations = self._determine_workflow(
            type_evaluation,
            template_suggestions
        )
        
        return {
            'document_info': file_info,
            'type_evaluation': type_evaluation,
            'content_preview': content_preview,
            'template_suggestions': template_suggestions,
            'processing_recommendations': processing_recommendations
        }
    
    def _get_file_info(self, file_path: Path, filename: str, content_type: str) -> Dict[str, Any]:
        """Get basic file information"""
        file_extension = Path(filename).suffix.lower()
        file_size = file_path.stat().st_size if file_path.exists() else 0
        
        # Check if format is supported
        format_supported = file_extension in self.supported_formats
        
        # If content_type is not provided, try to guess it
        if not content_type:
            content_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        
        return {
            'filename': filename,
            'file_size': file_size,
            'mime_type': content_type,
            'file_extension': file_extension,
            'format_supported': format_supported
        }
    
    async def _quick_type_detection_simple(self, file_path: Path, file_info: Dict[str, Any], content_override: Optional[str] = None) -> Dict[str, Any]:
        """Simple document type detection without external services"""
        try:
            # Use content_override if provided
            if content_override:
                logger.info(f"Using provided content override ({len(content_override)} chars) for type detection")
                content = content_override[:5000]  # First 5000 chars
            # For PDFs and other binary formats, use the enhanced service with timeout
            elif file_info['file_extension'] in ['.pdf', '.docx', '.doc', '.xlsx']:
                # Use the actual document processing service for binary files with timeout
                try:
                    result = await asyncio.wait_for(
                        enhanced_docling_service.process_document(
                            file_path,
                            extract_text=True,
                            extract_metadata=True,
                            extract_structure=False
                        ),
                        timeout=self.document_processing_timeout
                    )

                    if result.get('status') != 'completed':
                        # Fallback to filename-based detection
                        logger.warning("Document processing failed, using filename detection")
                        return self._detect_from_filename(file_info['filename'])

                    content = result.get('content', {}).get('text', '')[:5000]
                except asyncio.TimeoutError:
                    logger.warning(f"Document processing timed out after {self.document_processing_timeout} seconds, using filename detection")
                    return self._detect_from_filename(file_info['filename'])
            else:
                # For text files, read directly
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()[:5000]  # First 5000 chars
            
            # Simple pattern matching
            detected_types = []
            for doc_type, patterns in self.template_patterns.items():
                score = self._calculate_pattern_score(content, patterns['keywords'])
                if score > 0.3:
                    detected_types.append((doc_type, score))
            
            # Sort by score
            detected_types.sort(key=lambda x: x[1], reverse=True)
            
            if detected_types:
                primary_type = detected_types[0][0]
                confidence = min(detected_types[0][1], 0.95)
                
                # Get alternative types
                alternatives = [
                    {'type': dt[0], 'confidence': dt[1]} 
                    for dt in detected_types[1:3]
                ]
            else:
                # If no patterns found, try filename detection
                filename_result = self._detect_from_filename(file_info['filename'])
                if filename_result['primary_type'] != 'unknown':
                    return filename_result
                    
                primary_type = 'unknown'
                confidence = 0.0
                alternatives = []
            
            return {
                'primary_type': primary_type,
                'confidence': confidence,
                'alternative_types': alternatives,
                'detection_method': 'simple_pattern_matching'
            }
            
        except Exception as e:
            logger.error(f"Error in document type detection: {str(e)}")
            # Try filename-based detection as final fallback
            return self._detect_from_filename(file_info['filename'])
    
    async def _quick_type_detection(self, file_path: Path, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Perform quick document type detection using limited content"""
        
        try:
            # Extract limited content for quick analysis
            result = await enhanced_docling_service.process_document(
                file_path,
                extract_text=True,
                extract_metadata=True,
                extract_structure=False
            )
            
            if result.get('status') != 'completed':
                return self._unknown_type_result()
            
            content = result.get('content', {}).get('text', '')[:5000]  # First 5000 chars
            metadata = result.get('metadata', {})
            
            # Quick pattern matching
            detected_types = []
            for doc_type, patterns in self.template_patterns.items():
                score = self._calculate_pattern_score(content, patterns['keywords'])
                if score > 0.3:
                    detected_types.append((doc_type, score))
            
            # Sort by score
            detected_types.sort(key=lambda x: x[1], reverse=True)
            
            if detected_types:
                primary_type = detected_types[0][0]
                confidence = min(detected_types[0][1], 0.95)
                
                # Get alternative types
                alternatives = [
                    {'type': dt[0], 'confidence': dt[1]} 
                    for dt in detected_types[1:3]
                ]
            else:
                primary_type = 'unknown'
                confidence = 0.0
                alternatives = []
            
            return {
                'primary_type': primary_type,
                'confidence': confidence,
                'alternative_types': alternatives,
                'detection_method': 'quick_pattern_matching'
            }
            
        except Exception as e:
            return self._unknown_type_result(str(e))
    
    async def _full_type_detection(self, file_path: Path, file_info: Dict[str, Any]) -> Dict[str, Any]:
        """Perform comprehensive document type detection using AI"""
        
        try:
            # Full document processing with AI
            result = await enhanced_docling_service.process_document_with_ai_enhancement(
                file_path,
                extract_text=True,
                extract_metadata=True,
                extract_structure=True,
                use_ai_enhancement=True
            )
            
            if result.get('status') != 'completed':
                return self._unknown_type_result()
            
            # Use AI classification
            ai_classification = result.get('ai_classification', {})
            
            if ai_classification:
                primary_type = ai_classification.get('primary_category', 'unknown')
                confidence = ai_classification.get('confidence', 0.5)
                
                # Map AI categories to our document types
                type_mapping = {
                    'invoice': 'invoice',
                    'financial_statement': 'invoice',
                    'legal_contract': 'contract',
                    'business_report': 'report',
                    'form': 'form',
                    'correspondence': 'letter',
                    'receipt': 'receipt'
                }
                
                primary_type = type_mapping.get(primary_type, primary_type)
                
                # Get secondary categories as alternatives
                alternatives = []
                for cat in ai_classification.get('secondary_categories', [])[:2]:
                    mapped_type = type_mapping.get(cat, cat)
                    alternatives.append({
                        'type': mapped_type,
                        'confidence': confidence * 0.7  # Lower confidence for alternatives
                    })
                
                return {
                    'primary_type': primary_type,
                    'confidence': confidence,
                    'alternative_types': alternatives,
                    'detection_method': 'ai_enhanced'
                }
            else:
                # Fallback to pattern matching
                return await self._quick_type_detection(file_path, file_info)
                
        except Exception as e:
            return self._unknown_type_result(str(e))
    
    async def _get_content_preview_simple(self, file_path: Path, quick_scan: bool) -> Dict[str, Any]:
        """Simple content preview without external services"""
        try:
            # Read file content
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()

            # Extract key phrases
            key_phrases = self._extract_key_phrases(text, limit=10 if quick_scan else 20)

            return {
                'has_tables': 'table' in text.lower() or '|' in text or '\t' in text,
                'has_images': False,  # Simple implementation doesn't detect images
                'detected_language': 'en',
                'page_count': max(1, text.count('\f') + 1),  # Count form feeds as page breaks
                'key_phrases': key_phrases
            }

        except Exception:
            return {
                'has_tables': False,
                'has_images': False,
                'detected_language': 'unknown',
                'page_count': 0,
                'key_phrases': []
            }

    def _get_content_preview_from_text(self, text: str, quick_scan: bool) -> Dict[str, Any]:
        """Generate content preview from provided text (used with content_override)"""
        try:
            # Extract key phrases
            key_phrases = self._extract_key_phrases(text, limit=10 if quick_scan else 20)

            return {
                'has_tables': 'table' in text.lower() or '|' in text or '\t' in text,
                'has_images': False,  # Cannot detect images from text alone
                'detected_language': 'en',
                'page_count': max(1, text.count('\f') + 1),  # Count form feeds as page breaks
                'key_phrases': key_phrases
            }

        except Exception:
            return {
                'has_tables': False,
                'has_images': False,
                'detected_language': 'unknown',
                'page_count': 0,
                'key_phrases': []
            }

    async def _get_content_preview(self, file_path: Path, quick_scan: bool) -> Dict[str, Any]:
        """Extract content preview information"""
        
        try:
            result = await enhanced_docling_service.process_document(
                file_path,
                extract_text=True,
                extract_metadata=True,
                extract_structure=True
            )
            
            if result.get('status') != 'completed':
                return {
                    'has_tables': False,
                    'has_images': False,
                    'detected_language': 'unknown',
                    'page_count': 0,
                    'key_phrases': []
                }
            
            content = result.get('content', {})
            metadata = result.get('metadata', {})
            
            # Extract key phrases
            text = content.get('text', '')
            key_phrases = self._extract_key_phrases(text, limit=10 if quick_scan else 20)
            
            return {
                'has_tables': len(content.get('tables', [])) > 0,
                'has_images': len(content.get('images', [])) > 0,
                'detected_language': metadata.get('language', 'en'),
                'page_count': metadata.get('pages', 1),
                'key_phrases': key_phrases
            }
            
        except Exception:
            return {
                'has_tables': False,
                'has_images': False,
                'detected_language': 'unknown',
                'page_count': 0,
                'key_phrases': []
            }
    
    
    def _determine_workflow(
        self,
        type_evaluation: Dict[str, Any],
        template_suggestions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Determine the recommended processing workflow"""
        
        confidence = type_evaluation['confidence']
        has_good_template = len(template_suggestions) > 0 and template_suggestions[0]['match_score'] > 0.7
        
        if confidence > 0.8 and has_good_template:
            # High confidence with good template match
            workflow = 'existing_template'
            suggested_action = f"Use {template_suggestions[0]['template_name']}"
            alternatives = [
                'Generate new template',
                'Select different template',
                'Manual field selection'
            ]
        elif confidence > 0.6:
            # Medium confidence
            workflow = 'template_selection'
            suggested_action = 'Select from suggested templates'
            alternatives = [
                'Generate AI template',
                'Upload different document'
            ]
        else:
            # Low confidence or unknown type
            workflow = 'generate_template'
            suggested_action = 'Generate AI-powered template'
            alternatives = [
                'Browse all templates',
                'Upload different document',
                'Manual configuration'
            ]
        
        return {
            'workflow': workflow,
            'suggested_action': suggested_action,
            'alternative_actions': alternatives,
            'confidence_level': 'high' if confidence > 0.8 else 'medium' if confidence > 0.6 else 'low'
        }
    
    def _calculate_pattern_score(self, text: str, keywords: List[str]) -> float:
        """Calculate pattern matching score based on keyword presence"""
        if not text or not keywords:
            return 0.0
        
        text_lower = text.lower()
        found_keywords = 0
        total_weight = 0
        
        # Weight keywords by importance (first keywords are more important)
        for i, keyword in enumerate(keywords):
            weight = 1.0 / (i + 1)  # Decreasing weight: 1, 0.5, 0.33, 0.25...
            total_weight += weight
            
            if keyword.lower() in text_lower:
                found_keywords += weight
        
        # Calculate score as weighted percentage
        score = found_keywords / total_weight if total_weight > 0 else 0.0
        
        # Boost score if multiple keywords found
        if found_keywords > 2:
            score = min(score * 1.2, 1.0)
        
        return score
    
    def _extract_key_phrases(self, text: str, limit: int = 10) -> List[str]:
        """Extract key phrases from text"""
        # Simple implementation - in production would use NLP
        
        # Common stop words to filter out
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
                     'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been'}
        
        # Extract words
        words = text.lower().split()
        
        # Filter and count
        word_freq = {}
        for word in words:
            # Clean word
            word = word.strip('.,!?;:"')
            
            if len(word) > 3 and word not in stop_words:
                word_freq[word] = word_freq.get(word, 0) + 1
        
        # Sort by frequency
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        
        # Return top phrases
        return [word[0] for word in sorted_words[:limit]]
    
    def _unknown_type_result(self, error: Optional[str] = None) -> Dict[str, Any]:
        """Return result for unknown document type"""
        return {
            'primary_type': 'unknown',
            'confidence': 0.0,
            'alternative_types': [],
            'detection_method': 'failed',
            'error': error
        }
    
    def _detect_from_filename(self, filename: str) -> Dict[str, Any]:
        """Detect document type from filename patterns"""
        filename_lower = filename.lower()
        
        # Common filename patterns
        if any(word in filename_lower for word in ['invoice', 'inv', 'bill']):
            return {
                'primary_type': 'invoice',
                'confidence': 0.7,
                'alternative_types': [{'type': 'receipt', 'confidence': 0.4}],
                'detection_method': 'filename_pattern'
            }
        elif any(word in filename_lower for word in ['receipt', 'rcpt', 'purchase']):
            return {
                'primary_type': 'receipt',
                'confidence': 0.7,
                'alternative_types': [{'type': 'invoice', 'confidence': 0.4}],
                'detection_method': 'filename_pattern'
            }
        elif any(word in filename_lower for word in ['contract', 'agreement', 'terms']):
            return {
                'primary_type': 'contract',
                'confidence': 0.7,
                'alternative_types': [],
                'detection_method': 'filename_pattern'
            }
        elif any(word in filename_lower for word in ['resume', 'cv', 'curriculum']):
            return {
                'primary_type': 'resume',
                'confidence': 0.8,
                'alternative_types': [],
                'detection_method': 'filename_pattern'
            }
        elif any(word in filename_lower for word in ['report', 'analysis', 'summary']):
            return {
                'primary_type': 'report',
                'confidence': 0.6,
                'alternative_types': [],
                'detection_method': 'filename_pattern'
            }
        else:
            return self._unknown_type_result()
    
    async def _get_matching_templates_direct(self, document_type: str, keywords: List[str]) -> List[Dict[str, Any]]:
        """Get matching templates using direct HTTP requests to Supabase"""
        
        # Get Supabase connection details from environment
        supabase_url = os.getenv('SUPABASE_URL', 'http://supabase-kong:8000')
        supabase_key = os.getenv('ANON_KEY', '')  # Use ANON_KEY, not SUPABASE_ANON_KEY
        
        print(f"[TEMPLATE DEBUG] Template matching - URL: {supabase_url}, Key present: {bool(supabase_key)}")
        logger.info(f"Template matching - URL: {supabase_url}, Key present: {bool(supabase_key)}")
        
        if not supabase_url or not supabase_key:
            print(f"[TEMPLATE DEBUG] Missing credentials - returning empty list")
            logger.warning("Supabase credentials not configured for template matching")
            return []
        
        headers = {
            'apikey': supabase_key,
            'Authorization': f'Bearer {supabase_key}',
            'Content-Type': 'application/json'
        }
        
        try:
            # Query templates based on document type
            if document_type == 'invoice':
                # Look for invoice and finance templates  
                url = f"{supabase_url}/rest/v1/smart_templates?select=id,name,category,description,smart_variables,usage_count&is_public=eq.true&or=(category.eq.invoice,category.eq.finance)"
            elif document_type == 'receipt':
                # Look for receipt and retail templates
                url = f"{supabase_url}/rest/v1/smart_templates?select=id,name,category,description,smart_variables,usage_count&is_public=eq.true&or=(category.eq.receipt,category.eq.retail)"
            elif document_type == 'unknown':
                # Get all public templates when type is unknown
                url = f"{supabase_url}/rest/v1/smart_templates?select=id,name,category,description,smart_variables,usage_count&is_public=eq.true&order=usage_count.desc&limit=10"
            else:
                # Generic search by category
                url = f"{supabase_url}/rest/v1/smart_templates?select=id,name,category,description,smart_variables,usage_count&is_public=eq.true&category=eq.{document_type}"
            
            logger.info(f"Querying templates with URL: {url}")
            response = requests.get(url, headers=headers, timeout=self.template_query_timeout)
            logger.info(f"Response status: {response.status_code}")
            response.raise_for_status()
            templates = response.json()
            logger.info(f"Found {len(templates)} templates for document type: {document_type}")
            logger.info(f"Template data sample: {templates[:2] if templates else 'No templates'}")
            
            # Score templates based on keywords and usage  
            scored_templates = []
            logger.info(f"Starting template scoring for {len(templates)} templates")
            
            for template in templates:
                score = 0.5  # Base score
                template_name = template.get('name', 'Unknown')
                
                # Category match bonus
                if template.get('category') == document_type:
                    score += 0.3
                    logger.debug(f"Template '{template_name}' - category match bonus: +0.3")
                
                # Keyword matching in name/description
                name = template.get('name', '').lower()
                description = template.get('description', '').lower()
                text_to_search = f"{name} {description}"
                
                if keywords:
                    keyword_matches = sum(1 for keyword in keywords if keyword.lower() in text_to_search)
                    keyword_bonus = (keyword_matches / len(keywords)) * 0.2
                    score += keyword_bonus
                    logger.debug(f"Template '{template_name}' - keyword bonus: +{keyword_bonus:.2f} ({keyword_matches}/{len(keywords)} matches)")
                
                # Usage count bonus (normalized)
                usage_count = template.get('usage_count', 0) or 0
                if usage_count > 0:
                    usage_bonus = min(usage_count / 100, 0.1)
                    score += usage_bonus
                    logger.debug(f"Template '{template_name}' - usage bonus: +{usage_bonus:.2f}")
                
                logger.info(f"Template '{template_name}' final score: {score:.2f}")
                
                # Only include templates with decent scores
                if score >= 0.6:
                    smart_vars = template.get('smart_variables', [])
                    if not isinstance(smart_vars, list):
                        smart_vars = []
                        
                    scored_templates.append({
                        'template_id': template['id'],
                        'template_name': template['name'],
                        'category': template.get('category', 'unknown'),
                        'match_score': score,
                        'confidence': score,
                        'smart_variables': smart_vars
                    })
            
            # Sort by score and return top matches
            scored_templates.sort(key=lambda x: x['match_score'], reverse=True)
            return scored_templates[:3]  # Top 3 matches
            
        except Exception as e:
            logger.error(f"Template matching failed: {str(e)}")
            # Return empty list on any error
            return []


# Global instance
document_evaluator = DocumentEvaluator()