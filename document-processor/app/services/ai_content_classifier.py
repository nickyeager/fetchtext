import aiohttp
import json
import logging
from typing import Dict, Any, List, Optional
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)

class ContentCategory(Enum):
    BUSINESS_REPORT = "business_report"
    TECHNICAL_DOCUMENT = "technical_document"
    LEGAL_CONTRACT = "legal_contract"
    FINANCIAL_STATEMENT = "financial_statement"
    PRESENTATION = "presentation"
    FORM = "form"
    INVOICE = "invoice"
    RESEARCH_PAPER = "research_paper"
    MANUAL = "manual"
    CORRESPONDENCE = "correspondence"
    UNKNOWN = "unknown"

class AIContentClassifier:
    """AI-powered content classification service using LLM service"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.fallback_enabled = True
        
        # Import model config and LLM service
        from ..config import model_config, provider_config, AIProvider
        from .llm_service import llm_service
        self._model_config = model_config
        self._provider_config = provider_config
        self.llm_service = llm_service
    
    @property
    def model(self) -> str:
        """Get the current active model"""
        return self._model_config.current_model
    
    @model.setter
    def model(self, value: str):
        """Set the current active model"""
        self._model_config.current_model = value
    
    async def classify_document_content(
        self, 
        content: str, 
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Classify document content using AI with fallback to rule-based classification"""
        
        try:
            # Try AI classification first
            return await self._ai_classify_content(content, metadata)
                
        except Exception as e:
            self.logger.error(f"Error in AI classification: {e}")
            if self.fallback_enabled:
                self.logger.warning("Using fallback classification")
                return self._fallback_classification(content, metadata)
            else:
                raise
    
    async def _is_llm_available(self) -> bool:
        """Check if LLM service is available"""
        try:
            # Use the test functionality from models endpoint
            if self._provider_config.current_provider == AIProvider.OLLAMA:
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                    async with session.get("http://ollama-cpu:11434/api/tags") as response:
                        return response.status == 200
            else:
                # For Azure, assume available if configured
                from ..config import settings
                return settings.is_azure_configured()
        except Exception:
            return False
    
    async def _ai_classify_content(
        self, 
        content: str, 
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Perform AI-powered content classification"""
        
        classification_prompt = self._build_classification_prompt(content, metadata)
        
        try:
            # Use the unified LLM service with optimized parameters
            response_text = await self.llm_service.complete(
                classification_prompt,
                temperature=0.0,  # Deterministic 
                max_tokens=300    # Force concise responses
            )
            
            # Parse JSON response
            classification = json.loads(response_text)
            
            # Validate and enhance classification
            validated = self._validate_classification(classification)
            validated['classification_method'] = 'ai_powered'
            validated['timestamp'] = datetime.utcnow().isoformat()
            validated['provider'] = self._provider_config.current_provider.value
            
            self.logger.info(f"AI classification completed with confidence: {validated.get('confidence_score', 0)}")
            return validated
                        
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse LLM JSON response: {e}")
            return self._fallback_classification(content, metadata)
        except Exception as e:
            self.logger.error(f"Error in AI classification: {e}")
            return self._fallback_classification(content, metadata)
    
    def _build_classification_prompt(self, content: str, metadata: Dict[str, Any]) -> str:
        """Build the classification prompt for the AI model"""
        
        # Build simple classification prompt
        filename = metadata.get('filename', 'unknown')
        
        return f"""Classify this document:

{content[:800]}

File: {filename}

Return ONLY JSON:
{{
    "primary_category": "invoice|business_report|legal_contract|financial_statement|form|correspondence|unknown",
    "confidence_score": 0.8,
    "extraction_recommendations": {{
        "key_data_points": ["total_amount", "due_date", "invoice_number"],
        "processing_priority": "high"
    }}
}}"""
    
    def _validate_classification(self, classification: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and enhance AI classification results"""
        
        # Ensure required fields exist with defaults
        defaults = {
            'primary_category': 'unknown',
            'secondary_categories': [],
            'confidence_score': 0.5,
            'content_type': 'informational',
            'complexity_level': 'moderate',
            'industry_domain': 'general',
            'key_topics': [],
            'document_purpose': 'General document',
            'language': 'unknown',
            'formality_level': 'formal'
        }
        
        for field, default in defaults.items():
            if field not in classification:
                classification[field] = default
        
        # Validate confidence score
        confidence = classification.get('confidence_score', 0.5)
        if not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1:
            classification['confidence_score'] = 0.5
        
        # Ensure extraction recommendations exist
        if 'extraction_recommendations' not in classification:
            classification['extraction_recommendations'] = {
                'key_data_points': [],
                'structure_patterns': [],
                'processing_priority': 'medium'
            }
        
        # Validate primary category
        valid_categories = [cat.value for cat in ContentCategory]
        if classification['primary_category'] not in valid_categories:
            classification['primary_category'] = 'unknown'
        
        return classification
    
    def _fallback_classification(
        self, 
        content: str, 
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Fallback rule-based classification when AI is unavailable"""
        
        filename = metadata.get('filename', '').lower()
        content_lower = content.lower()
        
        # Rule-based classification logic
        primary_category = self._determine_category_by_rules(filename, content_lower)
        confidence = self._calculate_rule_confidence(filename, content_lower, primary_category)
        
        # Extract key topics using simple keyword matching
        key_topics = self._extract_topics_by_keywords(content_lower)
        
        # Determine complexity based on content length and structure
        complexity = self._assess_complexity(content, metadata)
        
        return {
            'primary_category': primary_category,
            'secondary_categories': [],
            'confidence_score': confidence,
            'content_type': 'informational',
            'complexity_level': complexity,
            'industry_domain': self._determine_industry_domain(filename, content_lower),
            'key_topics': key_topics,
            'document_purpose': f"Document classified as {primary_category.replace('_', ' ')}",
            'extraction_recommendations': self._get_category_recommendations(primary_category),
            'language': 'unknown',
            'formality_level': 'formal',
            'classification_method': 'rule_based',
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def _determine_category_by_rules(self, filename: str, content: str) -> str:
        """Determine document category using rule-based logic"""
        
        # Filename-based rules
        filename_rules = {
            'invoice': ['invoice', 'bill', 'receipt', 'billing'],
            'legal_contract': ['contract', 'agreement', 'legal', 'terms', 'conditions'],
            'business_report': ['report', 'analysis', 'summary', 'quarterly', 'annual'],
            'financial_statement': ['financial', 'balance', 'income', 'cash_flow', 'statement'],
            'manual': ['manual', 'guide', 'instruction', 'handbook', 'tutorial'],
            'presentation': ['presentation', 'slides', 'deck', 'ppt'],
            'form': ['form', 'application', 'registration', 'survey'],
            'technical_document': ['technical', 'specification', 'api', 'documentation'],
            'research_paper': ['research', 'paper', 'study', 'journal', 'academic']
        }
        
        # Check filename patterns
        for category, keywords in filename_rules.items():
            if any(keyword in filename for keyword in keywords):
                return category
        
        # Content-based rules
        content_rules = {
            'invoice': ['total amount', 'due date', 'invoice number', 'vendor', 'billing'],
            'legal_contract': ['whereas', 'parties agree', 'terms and conditions', 'hereby'],
            'financial_statement': ['assets', 'liabilities', 'revenue', 'expenses', 'profit'],
            'business_report': ['executive summary', 'recommendations', 'findings', 'conclusion'],
            'technical_document': ['implementation', 'algorithm', 'system', 'configuration']
        }
        
        # Check content patterns
        for category, keywords in content_rules.items():
            if sum(1 for keyword in keywords if keyword in content) >= 2:
                return category
        
        return 'unknown'
    
    def _calculate_rule_confidence(self, filename: str, content: str, category: str) -> float:
        """Calculate confidence score for rule-based classification"""
        
        confidence = 0.3  # Base confidence for rule-based
        
        # Boost confidence based on filename match
        category_keywords = {
            'invoice': ['invoice', 'bill'],
            'legal_contract': ['contract', 'agreement'],
            'business_report': ['report', 'analysis'],
            'financial_statement': ['financial', 'statement']
        }
        
        if category in category_keywords:
            keywords = category_keywords[category]
            if any(keyword in filename for keyword in keywords):
                confidence += 0.3
            
            # Additional boost for content keywords
            content_matches = sum(1 for keyword in keywords if keyword in content)
            confidence += min(0.3, content_matches * 0.1)
        
        return min(0.9, confidence)  # Cap at 0.9 for rule-based
    
    def _extract_topics_by_keywords(self, content: str) -> List[str]:
        """Extract key topics using keyword matching"""
        
        topic_keywords = {
            'finance': ['financial', 'money', 'cost', 'budget', 'revenue', 'profit'],
            'legal': ['legal', 'law', 'regulation', 'compliance', 'contract'],
            'technology': ['software', 'system', 'technical', 'implementation', 'api'],
            'business': ['business', 'strategy', 'market', 'customer', 'sales'],
            'healthcare': ['medical', 'health', 'patient', 'treatment', 'clinical'],
            'education': ['education', 'learning', 'training', 'course', 'academic']
        }
        
        topics = []
        for topic, keywords in topic_keywords.items():
            if sum(1 for keyword in keywords if keyword in content) >= 2:
                topics.append(topic)
        
        return topics[:5]  # Limit to top 5 topics
    
    def _assess_complexity(self, content: str, metadata: Dict[str, Any]) -> str:
        """Assess document complexity based on content and metadata"""
        
        word_count = len(content.split())
        file_size = metadata.get('file_size', 0)
        
        if word_count > 5000 or file_size > 1000000:  # 1MB
            return 'complex'
        elif word_count > 1000 or file_size > 100000:  # 100KB
            return 'moderate'
        else:
            return 'simple'
    
    def _determine_industry_domain(self, filename: str, content: str) -> str:
        """Determine industry domain from filename and content"""
        
        domain_keywords = {
            'finance': ['financial', 'bank', 'investment', 'accounting'],
            'healthcare': ['medical', 'health', 'patient', 'clinical'],
            'legal': ['legal', 'law', 'court', 'attorney'],
            'technology': ['software', 'tech', 'system', 'programming'],
            'education': ['education', 'academic', 'university', 'school']
        }
        
        for domain, keywords in domain_keywords.items():
            if any(keyword in filename or keyword in content for keyword in keywords):
                return domain
        
        return 'general'
    
    def _get_category_recommendations(self, category: str) -> Dict[str, Any]:
        """Get processing recommendations based on document category"""
        
        recommendations = {
            'invoice': {
                'key_data_points': ['total_amount', 'due_date', 'vendor_name', 'invoice_number', 'line_items'],
                'structure_patterns': ['header_info', 'line_items_table', 'totals_section'],
                'processing_priority': 'high'
            },
            'business_report': {
                'key_data_points': ['executive_summary', 'key_metrics', 'recommendations', 'conclusions'],
                'structure_patterns': ['sections', 'charts', 'tables', 'appendices'],
                'processing_priority': 'medium'
            },
            'legal_contract': {
                'key_data_points': ['parties', 'terms', 'dates', 'obligations', 'signatures'],
                'structure_patterns': ['clauses', 'sections', 'exhibits'],
                'processing_priority': 'high'
            },
            'financial_statement': {
                'key_data_points': ['assets', 'liabilities', 'revenue', 'expenses', 'ratios'],
                'structure_patterns': ['financial_tables', 'notes', 'summaries'],
                'processing_priority': 'high'
            }
        }
        
        return recommendations.get(category, {
            'key_data_points': ['content', 'metadata'],
            'structure_patterns': ['sections'],
            'processing_priority': 'medium'
        })
    
    async def get_classification_confidence(self, classification: Dict[str, Any]) -> Dict[str, Any]:
        """Get detailed confidence analysis for a classification"""
        
        confidence_score = classification.get('confidence_score', 0.5)
        method = classification.get('classification_method', 'unknown')
        
        confidence_analysis = {
            'overall_confidence': confidence_score,
            'classification_method': method,
            'confidence_level': 'low' if confidence_score < 0.5 else 'medium' if confidence_score < 0.8 else 'high',
            'reliability_factors': []
        }
        
        # Add reliability factors based on classification method
        if method == 'ai_powered':
            confidence_analysis['reliability_factors'].extend([
                'AI model analysis',
                'Semantic understanding',
                'Context awareness'
            ])
        elif method == 'rule_based':
            confidence_analysis['reliability_factors'].extend([
                'Keyword matching',
                'Pattern recognition',
                'Filename analysis'
            ])
        
        # Add confidence boosters
        if confidence_score > 0.8:
            confidence_analysis['reliability_factors'].append('High confidence indicators')
        
        if classification.get('key_topics'):
            confidence_analysis['reliability_factors'].append('Topic identification')
        
        return confidence_analysis

# Global classifier instance
ai_classifier = AIContentClassifier()