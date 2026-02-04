"""
Template Matching Service - Core logic for intelligent template suggestions

Uses semantic embeddings for improved matching accuracy.
"""
import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
import re
from datetime import datetime

from ..config.database import db_config
from .template_cache import TemplateCache
from .embedding_service import embedding_service

logger = logging.getLogger(__name__)

class TemplateMatchingService:
    """Service to find and score template matches for documents

    Uses a multi-factor scoring algorithm:
    - Category alignment (30%): How well template category matches document type
    - Field detectability (25%): How many template fields can be detected in document
    - Semantic similarity (35%): Embedding-based similarity between document and template
    - Historical success (10%): Template's extraction success rate
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        # Initialize template cache with 5 minute TTL
        self.template_cache = TemplateCache(default_ttl=300)
        self.cache_enabled = True  # Can be disabled for testing

        # Cache for template embeddings (template_id -> embedding)
        self._template_embeddings_cache: Dict[int, List[float]] = {}
        self._embeddings_available = embedding_service.provider is not None
        
        # Category mappings for document type -> template category matching
        # Keys are document types (from AI classification), values are compatible template categories
        self.category_mappings = {
            'invoice': ['finance', 'business', 'billing', 'invoice'],
            'receipt': ['finance', 'retail', 'transaction', 'receipt'],
            'contract': ['legal', 'business', 'agreement', 'contract'],
            'legal_contract': ['legal', 'business', 'agreement', 'contract'],  # Added for legal_contract type
            'legal': ['legal', 'contract', 'agreement'],  # Added for legal documents
            'report': ['business', 'analysis', 'corporate', 'report'],
            'form': ['data_collection', 'application', 'survey', 'form'],
            'letter': ['correspondence', 'communication', 'letter'],
            'resume': ['hr', 'recruitment', 'resume', 'cv'],
            'proposal': ['legal', 'business', 'contract', 'proposal'],  # Added for proposals
        }
        
        # Field indicators for detecting field compatibility
        self.field_indicators = {
            'invoice_number': ['invoice', 'number', 'id', 'reference', 'inv'],
            'receipt_number': ['receipt', 'number', 'id', 'reference', 'ref'],
            'total_amount': ['total', 'amount', 'sum', 'due', '$', 'cost', 'price'],
            'total_cost': ['total', 'cost', 'amount', 'price', 'sum', 'payment'],
            'date': ['date', 'time', 'day', 'month', 'year', 'when'],
            'date_of_proposal': ['date', 'proposal', 'submitted', 'day', 'month'],
            'company_name': ['company', 'business', 'corp', 'ltd', 'llc', 'inc'],
            'customer_name': ['customer', 'client', 'name', 'person', 'contact'],
            'contractor_name': ['contractor', 'vendor', 'provider', 'company', 'business'],
            'submitted_to': ['submitted', 'client', 'customer', 'owner', 'property'],
            'job_location': ['location', 'address', 'site', 'property', 'street', 'city'],
            'work_scope': ['work', 'scope', 'service', 'installation', 'project', 'description'],
            'email': ['email', '@', 'contact', 'mail'],
            'phone': ['phone', 'tel', 'mobile', 'call', 'number'],
            'address': ['address', 'street', 'city', 'state', 'zip', 'location'],
            'description': ['description', 'details', 'item', 'service', 'product'],
            'quantity': ['quantity', 'qty', 'amount', 'count', 'number'],
            'rate': ['rate', 'price', 'cost', 'fee', 'charge'],
            # Contract-specific fields
            'party_name': ['party', 'parties', 'contractor', 'client', 'owner'],
            'effective_date': ['effective', 'date', 'commence', 'start', 'begin'],
            'terms': ['terms', 'conditions', 'agreement', 'provisions'],
            'signature': ['signature', 'signed', 'authorized', 'witness']
        }

    async def find_matching_templates(
        self,
        document_type: str,
        content_keywords: List[str],
        min_confidence: float = 0.6,
        user_id: Optional[str] = None,
        document_text: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Find templates matching the document characteristics using semantic embeddings.

        Args:
            document_type: AI-classified document type (invoice, receipt, etc.)
            content_keywords: Key phrases extracted from document
            min_confidence: Minimum match score to include in results
            user_id: Optional user ID to include their private templates in search
            document_text: Optional document text for semantic embedding similarity

        Returns:
            List of template suggestions with scores
        """
        try:
            self.logger.info(f"Finding templates for document type: {document_type}")
            self.logger.debug(f"Content keywords: {content_keywords[:10]}...")  # First 10 keywords
            if user_id:
                self.logger.info(f"Including private templates for user: {user_id}")

            # Get templates from database - includes public AND user's private templates
            all_templates = await self._get_templates_from_database(user_id=user_id)

            if not all_templates:
                self.logger.warning("No templates found in database")
                return []

            # Generate document embedding for semantic similarity (if text provided)
            document_embedding = None
            if document_text and self._embeddings_available:
                try:
                    # Use first 2000 chars for embedding (captures document essence)
                    doc_text_for_embedding = document_text[:2000]
                    document_embedding = await embedding_service.generate_single_embedding(doc_text_for_embedding)
                    if document_embedding:
                        self.logger.info(f"Generated document embedding ({len(document_embedding)} dims)")
                except Exception as e:
                    self.logger.warning(f"Failed to generate document embedding: {e}")

            # Score each template
            scored_templates = []
            self.logger.info(f"Scoring {len(all_templates)} templates against document type '{document_type}'")
            for template in all_templates:
                try:
                    score = await self._calculate_template_score(
                        template, document_type, content_keywords, document_embedding
                    )
                    self.logger.info(f"  Template '{template['name']}' (cat={template['category']}): score={score:.3f}")

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

    async def _get_templates_from_database(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get templates from Supabase database with caching.

        Queries both public templates AND the user's own private templates.

        Args:
            user_id: Optional user ID to include their private templates
        """
        # Check cache first if enabled (only for public templates without user context)
        if self.cache_enabled and not user_id:
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

            # Query templates: public OR created by user (if user_id provided)
            # This ensures users can match against their own saved private templates
            if user_id:
                # Use OR filter: is_public=true OR created_by=user_id
                result = client.table('smart_templates').select('''
                    id, name, category, description,
                    smart_variables, usage_count, is_public,
                    created_at, created_by
                ''').or_(f'is_public.eq.true,created_by.eq.{user_id}').order('usage_count', desc=True).limit(50).execute()
                self.logger.info(f"Querying public templates + user's private templates (user_id: {user_id})")
            else:
                # No user context - only query public templates
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
        content_keywords: List[str],
        document_embedding: Optional[List[float]] = None
    ) -> float:
        """
        Calculate comprehensive template match score using 4 components.

        Scoring components (weights total 100%):
        - Category alignment (30%): How well template category matches document type
        - Field detectability (25%): How many template fields can be detected
        - Semantic similarity (35%): Embedding-based similarity between doc and template
        - Historical success (10%): Template's extraction success rate
        """

        score_components = {}

        # 1. Category alignment (30% weight)
        category_score = self._score_category_match(template['category'], document_type)
        score_components['category'] = category_score * 0.30

        # 2. Field detectability (25% weight)
        field_score = await self._score_field_coverage(
            template.get('smart_variables', []), content_keywords
        )
        score_components['fields'] = field_score * 0.25

        # 3. Semantic similarity (35% weight) - uses embeddings if available
        semantic_score = await self._score_semantic_similarity(template, document_embedding)
        score_components['semantic'] = semantic_score * 0.35

        # 4. Historical success rate (10% weight)
        success_score = template.get('success_rate', 0.5)
        score_components['success'] = success_score * 0.10

        # Calculate total score
        total_score = sum(score_components.values())

        # Log scoring details for debugging
        self.logger.info(
            f"Template '{template['name']}' scoring: "
            f"cat={score_components['category']:.2f}, "
            f"field={score_components['fields']:.2f}, "
            f"semantic={score_components['semantic']:.2f}, "
            f"success={score_components['success']:.2f} "
            f"-> total={total_score:.2f}"
        )

        return min(total_score, 1.0)  # Cap at 1.0

    def _score_category_match(self, template_category: str, document_type: str) -> float:
        """Score how well template category matches document type"""

        if not template_category or not document_type:
            self.logger.debug(f"Category match: empty category or doc_type -> 0.2")
            return 0.2

        template_cat = template_category.lower().strip()
        doc_type = document_type.lower().strip()

        # Exact match - highest score
        if template_cat == doc_type:
            self.logger.info(f"Category match: exact '{template_cat}' == '{doc_type}' -> 1.0")
            return 1.0

        # Check if template category is in document type's compatible categories
        if doc_type in self.category_mappings:
            compatible_categories = self.category_mappings[doc_type]
            if template_cat in compatible_categories:
                self.logger.info(f"Category match: '{template_cat}' in compatible list for '{doc_type}' -> 0.8")
                return 0.8

        # Partial text matching
        if doc_type in template_cat or template_cat in doc_type:
            self.logger.info(f"Category match: partial '{template_cat}' / '{doc_type}' -> 0.6")
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

    async def _score_semantic_similarity(
        self,
        template: Dict[str, Any],
        document_embedding: Optional[List[float]]
    ) -> float:
        """
        Score semantic similarity between document and template using embeddings.

        Creates a text representation of the template (name + description + field names)
        and compares it to the document embedding using cosine similarity.

        Returns:
            Float between 0.0 and 1.0 representing semantic similarity
        """
        # If no document embedding available, fall back to neutral score
        if not document_embedding or not self._embeddings_available:
            self.logger.debug(f"No embedding available for template '{template['name']}', using neutral score")
            return 0.5  # Neutral fallback

        template_id = template.get('id')

        # Check cache for template embedding
        if template_id and template_id in self._template_embeddings_cache:
            template_embedding = self._template_embeddings_cache[template_id]
            self.logger.debug(f"Using cached embedding for template '{template['name']}'")
        else:
            # Generate template text representation for embedding
            template_text = self._create_template_text_for_embedding(template)

            try:
                template_embedding = await embedding_service.generate_single_embedding(template_text)
                if template_embedding and template_id:
                    self._template_embeddings_cache[template_id] = template_embedding
                    self.logger.debug(f"Generated and cached embedding for template '{template['name']}'")
            except Exception as e:
                self.logger.warning(f"Failed to generate embedding for template '{template['name']}': {e}")
                return 0.5  # Neutral fallback on error

        if not template_embedding:
            return 0.5

        # Calculate cosine similarity
        similarity = embedding_service.calculate_similarity(document_embedding, template_embedding)

        # Normalize similarity to 0-1 range (cosine similarity can be -1 to 1)
        # Most document comparisons will be in the 0.3-0.9 range, so we scale
        normalized_similarity = max(0.0, min(1.0, (similarity + 1) / 2))

        self.logger.debug(
            f"Semantic similarity for '{template['name']}': "
            f"raw={similarity:.3f}, normalized={normalized_similarity:.3f}"
        )

        return normalized_similarity

    def _create_template_text_for_embedding(self, template: Dict[str, Any]) -> str:
        """
        Create a text representation of a template for embedding generation.

        Combines template name, description, category, and field names into
        a single text string that captures the template's semantic meaning.
        """
        parts = []

        # Template name and category
        name = template.get('name', '')
        if name:
            parts.append(f"Template: {name}")

        category = template.get('category', '')
        if category:
            parts.append(f"Category: {category}")

        # Description
        description = template.get('description', '')
        if description:
            parts.append(f"Description: {description}")

        # Field names and types
        smart_variables = template.get('smart_variables', [])
        if smart_variables:
            field_names = []
            for var in smart_variables:
                field_name = var.get('name', var.get('id', ''))
                field_type = var.get('type', 'text')
                field_desc = var.get('description', '')
                if field_name:
                    if field_desc:
                        field_names.append(f"{field_name} ({field_type}): {field_desc}")
                    else:
                        field_names.append(f"{field_name} ({field_type})")
            if field_names:
                parts.append(f"Fields: {', '.join(field_names)}")

        return " | ".join(parts)

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

    async def validate_template_extraction(
        self,
        content: str,
        templates: List[Dict[str, Any]],
        confidence_threshold: float = 0.6,
        provider: str = "azure"
    ) -> List[Dict[str, Any]]:
        """
        Validate extraction quality for multiple templates in parallel.

        This method performs REAL extraction tests on multiple templates simultaneously
        using asyncio.gather() for optimal performance.

        Args:
            content: Document text content to test extraction on
            templates: List of template dicts with smart_variables
            confidence_threshold: Minimum confidence for extraction (default: 0.6)
            provider: AI provider to use ("azure" or "ollama")

        Returns:
            List of templates with extraction validation results added:
            - extraction_quality: Field success rate (0.0-1.0)
            - avg_field_confidence: Average confidence of extracted fields
            - extractable_fields: Number of fields successfully extracted
            - failed_fields: List of field names that couldn't be extracted
            - extraction_error: Error message if validation failed

        Example:
            templates = [
                {'id': 4, 'name': 'Contract Template', 'smart_variables': [...]},
                {'id': 5, 'name': 'Invoice Template', 'smart_variables': [...]}
            ]

            validated = await service.validate_template_extraction(
                content=document_text,
                templates=templates,
                confidence_threshold=0.6
            )

            # validated[0] now includes:
            # {
            #     'id': 4,
            #     'name': 'Contract Template',
            #     'extraction_quality': 0.85,
            #     'avg_field_confidence': 0.82,
            #     'extractable_fields': 6,
            #     'failed_fields': ['warranty_period']
            # }
        """
        from .smart_field_extractor import smart_field_extractor

        self.logger.info(f"Validating extraction for {len(templates)} templates in parallel")

        validated_templates = []

        # Create async tasks for parallel extraction testing
        async def test_single_template(template: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
            """Test extraction for a single template and return (template, result)"""
            try:
                smart_variables = template.get('smart_variables', [])

                if not smart_variables:
                    self.logger.warning(f"Template '{template.get('name')}' has no smart_variables")
                    return (template, {
                        'field_success_rate': 0.0,
                        'avg_confidence': 0.0,
                        'extractable_count': 0,
                        'total_fields': 0,
                        'failed_fields': [],
                        'extraction_quality': 0.0
                    })

                # Perform real extraction test
                result = await smart_field_extractor.test_template_extraction(
                    content=content,
                    template_variables=smart_variables,
                    confidence_threshold=confidence_threshold,
                    provider=provider
                )

                return (template, result)

            except Exception as e:
                self.logger.error(f"Extraction test failed for template '{template.get('name')}': {str(e)}")
                return (template, {
                    'field_success_rate': 0.0,
                    'avg_confidence': 0.0,
                    'extractable_count': 0,
                    'total_fields': len(template.get('smart_variables', [])),
                    'failed_fields': [var.get('name', var.get('id', '')) for var in template.get('smart_variables', [])],
                    'extraction_quality': 0.0,
                    'extraction_error': str(e)
                })

        # Execute all tests in parallel
        tasks = [test_single_template(template) for template in templates]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Combine results with templates
        for result in results:
            if isinstance(result, Exception):
                self.logger.error(f"Template validation task failed: {result}")
                continue

            template, extraction_result = result

            # Add extraction metrics to template
            template['extraction_quality'] = extraction_result.get('field_success_rate', 0.0)
            template['avg_field_confidence'] = extraction_result.get('avg_confidence', 0.0)
            template['extractable_fields'] = extraction_result.get('extractable_count', 0)
            template['total_fields'] = extraction_result.get('total_fields', 0)
            template['failed_fields'] = extraction_result.get('failed_fields', [])

            if 'extraction_error' in extraction_result:
                template['extraction_error'] = extraction_result['extraction_error']

            validated_templates.append(template)

            self.logger.debug(
                f"Template '{template.get('name')}': "
                f"extraction_quality={template['extraction_quality']:.2f}, "
                f"fields={template['extractable_fields']}/{template['total_fields']}"
            )

        self.logger.info(
            f"Completed parallel validation for {len(validated_templates)} templates "
            f"(avg quality: {sum(t['extraction_quality'] for t in validated_templates) / len(validated_templates):.2f})"
        )

        return validated_templates

# Global instance
template_matching_service = TemplateMatchingService()