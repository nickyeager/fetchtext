import asyncio
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import mimetypes
import json

from ..services.enhanced_docling_service import enhanced_docling_service
from ..services.ai_content_classifier import ai_classifier


class DocumentEvaluator:
    """Service for quick document type evaluation and template matching"""
    
    def __init__(self):
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
        quick_scan: bool = True
    ) -> Dict[str, Any]:
        """
        Evaluate document type with configurable depth
        
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
            type_evaluation = await self._quick_type_detection(file_path, file_info)
        else:
            type_evaluation = await self._full_type_detection(file_path, file_info)
        
        # Get content preview
        content_preview = await self._get_content_preview(file_path, quick_scan)
        
        # Find matching templates
        template_suggestions = await self._suggest_matching_templates(
            type_evaluation['primary_type'],
            type_evaluation['confidence'],
            content_preview.get('key_phrases', [])
        )
        
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
    
    async def _suggest_matching_templates(
        self, 
        document_type: str,
        confidence: float,
        key_phrases: List[str]
    ) -> List[Dict[str, Any]]:
        """Suggest templates that match the document"""
        
        # TODO: In production, this would query the database for actual templates
        # For now, return mock suggestions based on document type
        
        suggestions = []
        
        if document_type == 'invoice':
            suggestions.append({
                'template_id': 1,
                'template_name': 'Standard Invoice Template',
                'match_score': confidence * 0.95,
                'category': 'Financial',
                'field_count': 12
            })
            suggestions.append({
                'template_id': 4,
                'template_name': 'Simple Invoice Template',
                'match_score': confidence * 0.85,
                'category': 'Financial',
                'field_count': 8
            })
        elif document_type == 'contract':
            suggestions.append({
                'template_id': 2,
                'template_name': 'Legal Contract Template',
                'match_score': confidence * 0.9,
                'category': 'Legal',
                'field_count': 15
            })
        elif document_type == 'receipt':
            suggestions.append({
                'template_id': 9,
                'template_name': 'Receipt Parser',
                'match_score': confidence * 0.92,
                'category': 'Retail',
                'field_count': 10
            })
        elif document_type == 'report':
            suggestions.append({
                'template_id': 3,
                'template_name': 'Business Report Template',
                'match_score': confidence * 0.88,
                'category': 'Business',
                'field_count': 10
            })
        elif document_type == 'resume':
            suggestions.append({
                'template_id': 5,
                'template_name': 'Resume Parser',
                'match_score': confidence * 0.9,
                'category': 'HR',
                'field_count': 20
            })
        
        # Sort by match score
        suggestions.sort(key=lambda x: x['match_score'], reverse=True)
        
        return suggestions[:3]  # Return top 3 suggestions
    
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
    
    def _calculate_pattern_score(self, content: str, keywords: List[str]) -> float:
        """Calculate pattern matching score"""
        content_lower = content.lower()
        matches = 0
        
        for keyword in keywords:
            if keyword.lower() in content_lower:
                matches += 1
        
        return matches / len(keywords) if keywords else 0.0
    
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


# Global instance
document_evaluator = DocumentEvaluator()