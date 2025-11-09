"""
Template Matching Service - Core logic for intelligent template suggestions
"""
import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
import re
from datetime import datetime

from ..config.database import db_config
from .template_cache import TemplateCache

logger = logging.getLogger(__name__)

class TemplateMatchingService:
    """Service to find and score template matches for documents"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        # Initialize template cache with 5 minute TTL
        self.template_cache = TemplateCache(default_ttl=300)
        self.cache_enabled = True  # Can be disabled for testing
        
        # Category mappings for document type -> template category matching
        self.category_mappings = {
            'invoice': ['finance', 'business', 'billing', 'invoice'],
            'receipt': ['finance', 'retail', 'transaction', 'receipt'], 
            'contract': ['legal', 'business', 'agreement', 'contract'],
            'report': ['business', 'analysis', 'corporate', 'report'],
            'form': ['data_collection', 'application', 'survey', 'form'],
            'letter': ['correspondence', 'communication', 'letter'],
            'resume': ['hr', 'recruitment', 'resume', 'cv']
        }
        
        # Field indicators for detecting field compatibility
        self.field_indicators = {
            'invoice_number': ['invoice', 'number', 'id', 'reference', 'inv'],
            'receipt_number': ['receipt', 'number', 'id', 'reference', 'ref'],
            'total_amount': ['total', 'amount', 'sum', 'due', '$', 'cost', 'price'],
            'date': ['date', 'time', 'day', 'month', 'year', 'when'],
            'company_name': ['company', 'business', 'corp', 'ltd', 'llc', 'inc'],
            'customer_name': ['customer', 'client', 'name', 'person', 'contact'],
            'email': ['email', '@', 'contact', 'mail', 'address'],
            'phone': ['phone', 'tel', 'mobile', 'call', 'number'],
            'address': ['address', 'street', 'city', 'state', 'zip', 'location'],
            'description': ['description', 'details', 'item', 'service', 'product'],
            'quantity': ['quantity', 'qty', 'amount', 'count', 'number'],
            'rate': ['rate', 'price', 'cost', 'fee', 'charge']
        }

    async def find_matching_templates(
        self,
        document_type: str,
        content_keywords: List[str],
        min_confidence: float = 0.6
    ) -> List[Dict[str, Any]]:
        """
        Find templates matching the document characteristics
        
        Args:
            document_type: AI-classified document type (invoice, receipt, etc.)
            content_keywords: Key phrases extracted from document
            min_confidence: Minimum match score to include in results
            
        Returns:
            List of template suggestions with scores
        """
        try:
            self.logger.info(f"Finding templates for document type: {document_type}")
            self.logger.debug(f"Content keywords: {content_keywords[:10]}...")  # First 10 keywords
            
            # Get templates from database (simulated for now - replace with real DB call)
            all_templates = await self._get_templates_from_database()
            
            if not all_templates:
                self.logger.warning("No templates found in database")
                return []
            
            # Score each template
            scored_templates = []
            for template in all_templates:
                try:
                    score = await self._calculate_template_score(
                        template, document_type, content_keywords
                    )
                    
                    if score >= min_confidence:
                        scored_templates.append({
                            'template_id': template['id'],
                            'template_name': template['name'],
                            'match_score': round(score, 3),
                            'category': template['category'],
                            'field_count': len(template.get('smart_variables', [])),
                            'description': template.get('description', ''),
                            'usage_count': template.get('usage_count', 0)
                        })
                        
                except Exception as e:
                    self.logger.error(f"Error scoring template {template.get('name', 'unknown')}: {e}")
                    continue
            
            # Sort by match score descending and return top 5
            scored_templates.sort(key=lambda x: x['match_score'], reverse=True)
            top_matches = scored_templates[:5]
            
            self.logger.info(f"Found {len(top_matches)} matching templates above {min_confidence} confidence")
            for match in top_matches:
                self.logger.info(f"  - {match['template_name']}: {match['match_score']} ({match['category']})")
            
            return top_matches
            
        except Exception as e:
            self.logger.error(f"Template matching failed: {str(e)}")
            return []

    async def _get_templates_from_database(self) -> List[Dict[str, Any]]:
        """
        Get templates from Supabase database with caching
        """
        # Check cache first if enabled
        if self.cache_enabled:
            cache_key = "all_public_templates"
            cached_templates = await self.template_cache.get(cache_key)
            if cached_templates is not None:
                self.logger.debug(f"Using cached templates ({len(cached_templates)} templates)")
                return cached_templates
        
        try:
            # Check if database is configured
            if not db_config.is_configured:
                self.logger.warning("Database not configured, using mock data")
                return await self._get_mock_templates()
            
            client = db_config.client
            if not client:
                self.logger.error("Failed to get database client, using mock data")
                return await self._get_mock_templates()
            
            # Query public templates from smart_templates table
            result = client.table('smart_templates').select('''
                id, name, category, description, 
                smart_variables, usage_count, is_public,
                created_at, created_by
            ''').eq('is_public', True).order('usage_count', desc=True).limit(50).execute()
            
            templates = result.data
            self.logger.info(f"Retrieved {len(templates)} public templates from Supabase database")
            
            # Validate and sanitize template data
            validated_templates = []
            for template in templates:
                try:
                    # Ensure required fields exist with defaults
                    validated_template = {
                        'id': template.get('id'),
                        'name': template.get('name', 'Unnamed Template'),
                        'category': template.get('category', 'general').lower(),
                        'description': template.get('description', ''),
                        'smart_variables': template.get('smart_variables', []),
                        'usage_count': max(0, template.get('usage_count', 0)),
                        'success_rate': 0.75,  # Default success rate since column doesn't exist
                        'is_public': template.get('is_public', False),
                        'created_at': template.get('created_at'),
                        'created_by': template.get('created_by')
                    }
                    
                    # Validate smart_variables structure
                    if not isinstance(validated_template['smart_variables'], list):
                        self.logger.warning(f"Template {validated_template['name']} has invalid smart_variables, skipping")
                        continue
                    
                    validated_templates.append(validated_template)
                    
                except Exception as e:
                    self.logger.error(f"Error validating template data: {e}")
                    continue
            
            self.logger.debug(f"Validated {len(validated_templates)} templates from database")
            
            # Cache the templates if caching is enabled
            if self.cache_enabled and validated_templates:
                cache_key = "all_public_templates"
                await self.template_cache.set(cache_key, validated_templates)
                self.logger.debug(f"Cached {len(validated_templates)} templates")
            
            return validated_templates
            
        except Exception as e:
            self.logger.error(f"Database query failed: {e}, falling back to mock data")
            return await self._get_mock_templates()
    
    async def _get_mock_templates(self) -> List[Dict[str, Any]]:
        """
        Fallback mock template data when database is unavailable
        """
        mock_templates = [
            {
                'id': 1,
                'name': 'Standard Invoice Template',
                'category': 'finance',
                'description': 'General purpose invoice template for businesses',
                'smart_variables': [
                    {'name': 'invoice_number', 'type': 'text'},
                    {'name': 'company_name', 'type': 'text'},
                    {'name': 'customer_name', 'type': 'text'},
                    {'name': 'total_amount', 'type': 'currency'},
                    {'name': 'date', 'type': 'date'},
                    {'name': 'email', 'type': 'email'}
                ],
                'usage_count': 150,
                'success_rate': 0.89,
                'is_public': True
            },
            {
                'id': 2,
                'name': 'Retail Receipt Template', 
                'category': 'retail',
                'description': 'Template for retail purchase receipts',
                'smart_variables': [
                    {'name': 'receipt_number', 'type': 'text'},
                    {'name': 'store_name', 'type': 'text'},
                    {'name': 'total_amount', 'type': 'currency'},
                    {'name': 'date', 'type': 'date'},
                    {'name': 'items', 'type': 'text'}
                ],
                'usage_count': 95,
                'success_rate': 0.85,
                'is_public': True
            },
            {
                'id': 3,
                'name': 'Service Contract Template',
                'category': 'legal',
                'description': 'Template for service agreements and contracts',
                'smart_variables': [
                    {'name': 'contract_number', 'type': 'text'},
                    {'name': 'client_name', 'type': 'text'},
                    {'name': 'service_provider', 'type': 'text'},
                    {'name': 'contract_date', 'type': 'date'},
                    {'name': 'contract_value', 'type': 'currency'},
                    {'name': 'terms', 'type': 'text'}
                ],
                'usage_count': 67,
                'success_rate': 0.78,
                'is_public': True
            }
        ]
        
        # Simulate async database call
        await asyncio.sleep(0.01)
        self.logger.debug(f"Using {len(mock_templates)} mock templates as fallback")
        return mock_templates

    async def _calculate_template_score(
        self,
        template: Dict[str, Any],
        document_type: str,
        content_keywords: List[str]
    ) -> float:
        """
        Calculate comprehensive template match score using 5 components
        
        Scoring components:
        - Category alignment (40%): How well template category matches document type
        - Field detectability (30%): How many template fields can be detected
        - Content similarity (10%): Keyword/description matching  
        - Usage popularity (10%): How often template is used
        - Historical success (10%): Template's extraction success rate
        """
        
        score_components = {}
        
        # 1. Category alignment (40% weight)
        category_score = self._score_category_match(template['category'], document_type)
        score_components['category'] = category_score * 0.4
        
        # 2. Field detectability (30% weight)
        field_score = await self._score_field_coverage(
            template.get('smart_variables', []), content_keywords
        )
        score_components['fields'] = field_score * 0.3
        
        # 3. Content similarity (10% weight)
        content_score = self._score_content_similarity(
            template.get('description', ''), content_keywords
        )
        score_components['content'] = content_score * 0.1
        
        # 4. Usage popularity (10% weight) 
        popularity_score = self._score_template_popularity(template.get('usage_count', 0))
        score_components['popularity'] = popularity_score * 0.1
        
        # 5. Historical success rate (10% weight)
        success_score = template.get('success_rate', 0.5)
        score_components['success'] = success_score * 0.1
        
        # Calculate total score
        total_score = sum(score_components.values())
        
        # Log scoring details for debugging
        self.logger.debug(f"Template '{template['name']}' scoring breakdown:")
        for component, value in score_components.items():
            self.logger.debug(f"  {component}: {value:.3f}")
        self.logger.debug(f"  Total: {total_score:.3f}")
        
        return min(total_score, 1.0)  # Cap at 1.0

    def _score_category_match(self, template_category: str, document_type: str) -> float:
        """Score how well template category matches document type"""
        
        if not template_category or not document_type:
            return 0.2
        
        template_cat = template_category.lower().strip()
        doc_type = document_type.lower().strip()
        
        # Exact match - highest score
        if template_cat == doc_type:
            return 1.0
        
        # Check if template category is in document type's compatible categories
        if doc_type in self.category_mappings:
            compatible_categories = self.category_mappings[doc_type]
            if template_cat in compatible_categories:
                return 0.8
        
        # Partial text matching
        if doc_type in template_cat or template_cat in doc_type:
            return 0.6
        
        # Check for semantic similarity (basic keyword matching)
        similar_pairs = [
            (['invoice', 'bill', 'billing'], ['finance', 'business']),
            (['receipt', 'purchase'], ['retail', 'transaction']),
            (['contract', 'agreement'], ['legal', 'business']),
            (['report', 'analysis'], ['business', 'corporate'])
        ]
        
        for doc_keywords, template_keywords in similar_pairs:
            if any(keyword in doc_type for keyword in doc_keywords):
                if any(keyword in template_cat for keyword in template_keywords):
                    return 0.5
        
        # Default low score for unrelated categories
        return 0.2

    async def _score_field_coverage(
        self,
        template_variables: List[Dict[str, Any]],
        content_keywords: List[str]
    ) -> float:
        """Score what percentage of template fields are likely detectable"""
        
        if not template_variables:
            return 0.0
        
        if not content_keywords:
            return 0.2  # Low but not zero - might still work
        
        # Convert keywords to lowercase for matching
        keywords_text = ' '.join(content_keywords).lower()
        
        detectable_fields = 0
        total_fields = len(template_variables)
        
        for variable in template_variables:
            field_name = variable.get('name', '').lower()
            field_type = variable.get('type', 'text')
            
            if self._field_likely_detectable(field_name, field_type, keywords_text):
                detectable_fields += 1
        
        coverage_ratio = detectable_fields / total_fields
        
        self.logger.debug(f"Field coverage: {detectable_fields}/{total_fields} = {coverage_ratio:.3f}")
        return coverage_ratio

    def _field_likely_detectable(
        self, 
        field_name: str, 
        field_type: str, 
        keywords_text: str
    ) -> bool:
        """Determine if a field is likely detectable in the document content"""
        
        # Check for direct field name match in indicators
        if field_name in self.field_indicators:
            indicators = self.field_indicators[field_name]
            return any(indicator in keywords_text for indicator in indicators)
        
        # Check for field name components
        field_words = field_name.replace('_', ' ').split()
        field_match_count = sum(1 for word in field_words if word in keywords_text)
        
        # If most field name words appear in content, likely detectable
        if len(field_words) > 0 and field_match_count / len(field_words) >= 0.5:
            return True
        
        # Type-specific detection patterns
        if field_type == 'currency' and any(indicator in keywords_text for indicator in ['$', 'amount', 'total', 'cost', 'price']):
            return True
        
        if field_type == 'date' and any(indicator in keywords_text for indicator in ['date', 'time', 'day', 'month', 'year']):
            return True
        
        if field_type == 'email' and ('@' in keywords_text or 'email' in keywords_text):
            return True
        
        return False

    def _score_content_similarity(self, template_description: str, content_keywords: List[str]) -> float:
        """Score similarity between template description and document content"""
        
        if not template_description or not content_keywords:
            return 0.3  # Neutral score when data is missing
        
        description_words = set(re.findall(r'\b\w+\b', template_description.lower()))
        content_words = set(' '.join(content_keywords).lower().split())
        
        if not description_words:
            return 0.3
        
        # Calculate Jaccard similarity (intersection over union)
        intersection = description_words.intersection(content_words)
        union = description_words.union(content_words)
        
        similarity = len(intersection) / len(union) if union else 0
        
        # Boost score for key business terms
        key_terms = {'invoice', 'receipt', 'contract', 'report', 'business', 'service', 'payment'}
        key_matches = description_words.intersection(content_words).intersection(key_terms)
        
        if key_matches:
            similarity += 0.2 * len(key_matches)  # Bonus for key term matches
        
        return min(similarity, 1.0)

    def _score_template_popularity(self, usage_count: int) -> float:
        """Score template based on usage popularity (more used = better)"""
        
        if usage_count <= 0:
            return 0.1  # Low score for unused templates
        
        # Normalize usage count to 0-1 scale using logarithmic scaling
        # Templates with 100+ uses get high scores, diminishing returns after that
        import math
        
        normalized_score = math.log(usage_count + 1) / math.log(101)  # log base of common usage
        return min(normalized_score, 1.0)

    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        return self.template_cache.get_stats()
    
    async def clear_cache(self) -> None:
        """Clear template cache"""
        await self.template_cache.clear()
        self.logger.info("Template cache cleared")
    
    def disable_cache(self) -> None:
        """Disable caching (useful for testing)"""
        self.cache_enabled = False
        self.logger.info("Template caching disabled")
    
    def enable_cache(self) -> None:
        """Enable caching"""
        self.cache_enabled = True
        self.logger.info("Template caching enabled")

# Global instance
template_matching_service = TemplateMatchingService()