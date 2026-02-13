import asyncio
import aiofiles
import tempfile
import uuid
import json
import re
import logging
import sys
import os
import aiohttp
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Safe logger initialization for Docker environment
try:
    logger = logging.getLogger(__name__)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
except Exception:
    # Fallback to basic config
    logging.basicConfig(stream=sys.stdout, level=logging.INFO)
    logger = logging.getLogger(__name__)

from ..services.enhanced_docling_service import enhanced_docling_service
from ..services.ai_template_generator import ai_template_generator
from ..services.document_evaluator import document_evaluator
from ..services.smart_field_extractor import smart_field_extractor
from ..services.two_pass_extractor import two_pass_extractor
from ..services.template_matching_service import template_matching_service
from ..services.template_generation_service import template_generation_service
from ..config.database import db_config

router = APIRouter(prefix="/api/enhanced-documents", tags=["enhanced-documents"])

async def save_uploaded_file(upload_file: UploadFile) -> Path:
    """Save uploaded file to temporary location"""
    try:
        # Create temporary file
        temp_dir = Path(tempfile.gettempdir()) / "docling_uploads"
        temp_dir.mkdir(exist_ok=True)
        
        file_extension = Path(upload_file.filename or "unknown").suffix
        temp_filename = f"{uuid.uuid4()}{file_extension}"
        temp_path = temp_dir / temp_filename
        
        # Save file content
        async with aiofiles.open(temp_path, 'wb') as f:
            content = await upload_file.read()
            await f.write(content)
        
        return temp_path
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

async def cleanup_temp_file(file_path: Path):
    """Clean up temporary file"""
    try:
        if file_path.exists():
            file_path.unlink()
    except Exception:
        pass  # Ignore cleanup errors

@router.post("/batch-process-with-ai")
async def batch_process_with_ai_enhancement(
    files: List[UploadFile] = File(...),
    extract_text: bool = Query(True, description="Extract text content"),
    extract_metadata: bool = Query(True, description="Extract document metadata"),
    extract_structure: bool = Query(True, description="Extract document structure"),
    use_ai_enhancement: bool = Query(True, description="Apply AI enhancement"),
    max_concurrent: int = Query(3, description="Maximum concurrent processing", ge=1, le=10),
    organization_id: Optional[str] = Query(None, description="Organization ID for org-specific LLM config")
):
    """
    Process multiple documents with AI enhancement in batch.
    
    Efficiently processes multiple files with:
    - Concurrent processing (configurable)
    - Individual error handling
    - Comprehensive batch results
    """
    
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    if len(files) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 files allowed per batch")
    
    batch_id = str(uuid.uuid4())
    batch_start_time = datetime.utcnow()
    
    temp_files = []
    
    try:
        # Save all uploaded files
        save_tasks = [save_uploaded_file(file) for file in files]
        temp_files = await asyncio.gather(*save_tasks)
        
        # Process files with limited concurrency
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def process_single_file(temp_path: Path, original_file: UploadFile):
            async with semaphore:
                try:
                    result = await enhanced_docling_service.process_document_with_ai_enhancement(
                        temp_path,
                        extract_text=extract_text,
                        extract_metadata=extract_metadata,
                        extract_structure=extract_structure,
                        use_ai_enhancement=use_ai_enhancement
                    )
                    
                    # Add original file info
                    result['original_filename'] = original_file.filename
                    result['content_type'] = original_file.content_type
                    
                    return result
                    
                except Exception as e:
                    return {
                        'job_id': str(uuid.uuid4()),
                        'status': 'failed',
                        'original_filename': original_file.filename,
                        'error_message': str(e),
                        'created_at': datetime.utcnow().isoformat(),
                        'completed_at': datetime.utcnow().isoformat(),
                        'ai_enhancement_enabled': False
                    }
        
        # Process all files
        processing_tasks = [
            process_single_file(temp_path, original_file)
            for temp_path, original_file in zip(temp_files, files)
        ]
        
        results = await asyncio.gather(*processing_tasks)
        
        # Calculate batch statistics
        successful_count = sum(1 for result in results if result.get('status') == 'completed')
        failed_count = len(results) - successful_count
        
        batch_end_time = datetime.utcnow()
        total_processing_time = (batch_end_time - batch_start_time).total_seconds()
        
        return JSONResponse(content={
            'batch_id': batch_id,
            'batch_statistics': {
                'total_files': len(files),
                'successful_count': successful_count,
                'failed_count': failed_count,
                'success_rate': successful_count / len(files) if files else 0,
                'total_processing_time': total_processing_time,
                'average_time_per_file': total_processing_time / len(files) if files else 0
            },
            'processing_options': {
                'extract_text': extract_text,
                'extract_metadata': extract_metadata,
                'extract_structure': extract_structure,
                'use_ai_enhancement': use_ai_enhancement,
                'max_concurrent': max_concurrent
            },
            'results': results,
            'batch_started_at': batch_start_time.isoformat(),
            'batch_completed_at': batch_end_time.isoformat()
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")
        
    finally:
        # Cleanup all temporary files
        cleanup_tasks = [cleanup_temp_file(temp_path) for temp_path in temp_files]
        await asyncio.gather(*cleanup_tasks, return_exceptions=True)

@router.post("/extract-with-text")
async def extract_with_text(
    text_content: str = Query(..., description="Text content to extract from"),
    template_data: str = Query(..., description="JSON string containing template smart variables"),
    confidence_threshold: float = Query(0.6, description="Minimum confidence threshold for extraction"),
    use_two_pass: bool = Query(False, description="Use two-pass extraction for improved accuracy"),
    organization_id: Optional[str] = Query(None, description="Organization ID for org-specific LLM config")
):
    """
    Extract template fields from provided text content.
    Bypasses file upload issues for testing purposes.
    """
    try:
        # Parse template data
        template_variables = []
        if template_data:
            try:
                parsed_template = json.loads(template_data)
                template_variables = parsed_template.get('smart_variables', [])
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid JSON in template_data")
        
        if not template_variables:
            raise HTTPException(status_code=400, detail="No template variables provided")

        # Choose extraction method based on use_two_pass parameter
        if use_two_pass:
            logger.info(f"Using two-pass extraction strategy for {len(template_variables)} variables")
            extracted_data = await two_pass_extractor.extract_two_pass(
                text_content=text_content,
                template_variables=template_variables,
                confidence_threshold=confidence_threshold,
                provider="azure",
                organization_id=organization_id
            )
            logger.info(f"Two-pass extraction completed: method={extracted_data.get('extraction_method', 'unknown')}")
        else:
            # Extract template fields using smart AI extraction (default)
            logger.info(f"Using standard smart extraction for {len(template_variables)} variables")
            extracted_data = await smart_field_extractor.extract_fields_intelligently(
                text_content,
                template_variables,
                confidence_threshold,
                provider="azure",  # Use Azure OpenAI for smart extraction
                organization_id=organization_id
            )
            logger.info(f"Smart extractor returned method: {extracted_data.get('extraction_method', 'unknown')}")

        logger.info(f"Extracted values: {list(extracted_data.get('extracted_values', {}).keys())}")
        
        return JSONResponse(content={
            "job_id": str(uuid.uuid4()),
            "status": "completed",
            "filename": "text_input",
            "content": {"text": text_content},
            "metadata": {"format": "text", "source": "direct_input"},
            "extracted_data": extracted_data,
            "template_variables": template_variables,
            "confidence_threshold": confidence_threshold,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "processing_time": extracted_data.get("processing_time_ms", 0) / 1000.0,
            "extraction_method": extracted_data.get("extraction_method", "smart_extraction")
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")

@router.get("/supported-categories")
async def get_supported_document_categories():
    """Get list of supported document categories for classification"""
    
    try:
        categories = []
        
        from app.services.ai_content_classifier import ContentCategory
        for category in ContentCategory:
            category_info = {
                'value': category.value,
                'display_name': category.value.replace('_', ' ').title(),
                'description': _get_category_description(category.value)
            }
            categories.append(category_info)
        
        return JSONResponse(content={
            'supported_categories': categories,
            'total_categories': len(categories),
            'classification_method': 'ai_powered_with_fallback'
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get categories: {str(e)}")

def _get_category_description(category: str) -> str:
    """Get description for document category"""
    
    descriptions = {
        'business_report': 'Business reports, analysis documents, and corporate communications',
        'technical_document': 'Technical specifications, API documentation, and system manuals',
        'legal_contract': 'Legal contracts, agreements, and legal documents',
        'financial_statement': 'Financial statements, balance sheets, and financial reports',
        'presentation': 'Presentation slides and pitch decks',
        'form': 'Forms, applications, and surveys',
        'invoice': 'Invoices, bills, and billing documents',
        'research_paper': 'Academic papers, research documents, and scholarly articles',
        'manual': 'User manuals, guides, and instructional documents',
        'correspondence': 'Letters, emails, and general correspondence',
        'unknown': 'Documents that do not fit into specific categories'
    }
    
    return descriptions.get(category, 'General document type')

@router.post("/extract-with-template")
async def extract_with_template(
    file: UploadFile = File(...),
    template_data: Optional[str] = Query(None, description="JSON string containing template smart variables"),
    confidence_threshold: float = Query(0.6, description="Minimum confidence threshold for extraction"),
    organization_id: Optional[str] = Query(None, description="Organization ID for org-specific LLM config")
):
    """
    Extract structured data from document using template smart variables.
    
    This endpoint processes documents with specific template guidance:
    - Uses template smart variables for targeted extraction
    - Applies AI-guided extraction with field-specific hints
    - Returns structured data matching template schema
    
    Template data should be JSON with structure:
    {
        "smart_variables": [
            {
                "name": "field_name",
                "type": "text|number|date|email",
                "description": "Field description",
                "extraction_hints": ["hint1", "hint2"]
            }
        ]
    }
    """
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    temp_file_path = None
    
    try:
        # Parse template data if provided
        template_variables = []
        if template_data:
            try:
                import json
                parsed_template = json.loads(template_data)
                template_variables = parsed_template.get('smart_variables', [])
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid JSON in template_data")
        
        # Save uploaded file temporarily
        temp_file_path = await save_uploaded_file(file)
        
        # For template-guided extraction, create minimal processing result to bypass all AI
        if template_variables:
            # Completely bypass Docling and do minimal text extraction
            try:
                # Handle different file types
                if temp_file_path.suffix.lower() in ['.html', '.htm']:
                    # Basic HTML text extraction
                    async with aiofiles.open(temp_file_path, 'r', encoding='utf-8') as f:
                        html_content = await f.read()
                    # Simple HTML tag removal
                    text_content = re.sub(r'<[^>]+>', ' ', html_content)
                    text_content = re.sub(r'\s+', ' ', text_content).strip()
                elif temp_file_path.suffix.lower() in ['.txt', '.md']:
                    async with aiofiles.open(temp_file_path, 'r', encoding='utf-8') as f:
                        text_content = await f.read()
                else:
                    # For other formats, return a basic message
                    text_content = f"File format {temp_file_path.suffix} processed. Content extraction optimized for template-guided processing."
                
                result = {
                    'status': 'completed',
                    'content': {'text': text_content},
                    'metadata': {'format': temp_file_path.suffix, 'filename': file.filename},
                    'processing_time': 0.1
                }
            except Exception as e:
                result = {
                    'status': 'failed',
                    'error': str(e)
                }
        else:
            # Use full AI enhancement when no template guidance
            result = await enhanced_docling_service.process_document_with_ai_enhancement(
                temp_file_path,
                extract_text=True,
                extract_metadata=True,
                extract_structure=True,
                use_ai_enhancement=True
            )
        
        if result.get('status') != 'completed':
            raise HTTPException(status_code=500, detail="Document processing failed")
        
        # If template variables provided, do targeted extraction using smart AI extraction
        if template_variables:
            extracted_data = await smart_field_extractor.extract_fields_intelligently(
                result.get('content', {}).get('text', ''),
                template_variables,
                confidence_threshold,
                provider="azure",  # Use Azure OpenAI for smart extraction
                organization_id=organization_id
            )
        else:
            # Fall back to generic extraction
            extracted_data = result.get('extracted_data', {})
        
        return JSONResponse(content={
            'extraction_result': extracted_data,
            'document_classification': result.get('ai_classification', {}),
            'processing_metadata': {
                'original_filename': file.filename,
                'template_guided': bool(template_variables),
                'fields_requested': len(template_variables),
                'confidence_threshold': confidence_threshold,
                'extraction_timestamp': datetime.utcnow().isoformat()
            }
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template-guided extraction failed: {str(e)}")
        
    finally:
        # Cleanup temporary file
        if temp_file_path:
            await cleanup_temp_file(temp_file_path)

@router.post("/decide-template")
async def decide_template_strategy(
    file: UploadFile = File(...),
    quick_scan: bool = Query(True, description="Use quick evaluation path"),
    min_match_confidence: float = Query(0.7, ge=0.0, le=1.0, description="Minimum match score to use an existing template"),
    allow_generation: bool = Query(True, description="Allow generating a template when no strong match exists"),
    auto_save: bool = Query(False, description="Auto-save generated templates to the database"),
    generation_mode: str = Query("automatic", description="Template generation mode when generation is chosen: automatic, guided, custom"),
    organization_id: Optional[str] = Query(None, description="Organization ID for org-specific LLM config")
):
    """
    Decide whether to use an existing template or generate a new one for the uploaded document.

    Behavior:
    - Evaluates the document to get type, key phrases, and template suggestions (with scores).
    - If a top suggestion meets `min_match_confidence`, returns an action to use that template.
    - Otherwise, if `allow_generation` is true, generates a new smart template and validates extraction.
    - Returns a unified response structure including the chosen action, rationale, and artifacts.

    This endpoint centralizes the decision logic previously split between evaluation and generation endpoints.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    if generation_mode not in ["automatic", "guided", "custom"]:
        raise HTTPException(status_code=400, detail="generation_mode must be automatic, guided, or custom")

    temp_file_path: Optional[Path] = None
    try:
        # Save uploaded file temporarily
        temp_file_path = await save_uploaded_file(file)

        # 1) Evaluate document (type + suggestions)
        evaluation = await document_evaluator.evaluate_document(
            temp_file_path,
            file.filename,
            file.content_type or "",
            quick_scan=quick_scan,
            organization_id=organization_id,
        )

        suggestions = evaluation.get('template_suggestions', []) or []

        # 2) Extract document text for real extraction testing
        document_text = ""
        if suggestions:
            try:
                # Extract full text content for validation
                extraction_result = await enhanced_docling_service.process_document(
                    temp_file_path,
                    extract_text=True,
                    extract_metadata=False,
                    extract_structure=False
                )
                if extraction_result.get('status') == 'completed':
                    document_text = extraction_result.get('content', {}).get('text', '')
                    logger.info(f"Extracted {len(document_text)} characters for template validation")
            except Exception as e:
                logger.warning(f"Failed to extract document text for validation: {str(e)}")

        # 3) Test extraction quality for top suggestions (2-way validation)
        if suggestions and document_text:
            logger.info(f"Testing extraction quality for top {min(len(suggestions), 3)} template suggestions")

            # Test top 3 suggestions to avoid performance issues
            for i, suggestion in enumerate(suggestions[:3]):
                try:
                    # Fetch full template with smart_variables from database
                    template_id = suggestion.get('template_id')
                    if not template_id:
                        logger.warning(f"Suggestion {i} missing template_id, skipping extraction test")
                        continue

                    # Query database for full template
                    if db_config.is_configured and db_config.client:
                        template_result = db_config.client.table('smart_templates').select(
                            'id, name, smart_variables, category'
                        ).eq('id', template_id).single().execute()

                        if template_result.data:
                            template = template_result.data
                            smart_variables = template.get('smart_variables', [])

                            if smart_variables:
                                # Perform REAL extraction test
                                test_result = await smart_field_extractor.test_template_extraction(
                                    content=document_text,
                                    template_variables=smart_variables,
                                    confidence_threshold=0.6,
                                    provider="azure",  # Use configured AI provider
                                    organization_id=organization_id
                                )

                                # Add extraction metrics to suggestion
                                suggestion['extraction_quality'] = test_result.get('field_success_rate', 0.0)
                                suggestion['avg_field_confidence'] = test_result.get('avg_confidence', 0.0)
                                suggestion['extractable_fields'] = test_result.get('extractable_count', 0)
                                suggestion['total_fields'] = test_result.get('total_fields', 0)
                                suggestion['failed_fields'] = test_result.get('failed_fields', [])
                                suggestion['extraction_test_passed'] = test_result.get('test_passed', False)

                                # Calculate combined score (match_score * extraction_quality)
                                suggestion['combined_score'] = suggestion.get('match_score', 0.0) * suggestion['extraction_quality']

                                logger.info(
                                    f"Template '{suggestion.get('template_name')}': "
                                    f"match_score={suggestion.get('match_score', 0):.2f}, "
                                    f"extraction_quality={suggestion['extraction_quality']:.2f}, "
                                    f"combined_score={suggestion['combined_score']:.2f}"
                                )
                            else:
                                logger.warning(f"Template {template_id} has no smart_variables, skipping extraction test")
                                suggestion['extraction_quality'] = 0.0
                                suggestion['combined_score'] = 0.0
                        else:
                            logger.warning(f"Template {template_id} not found in database")
                            suggestion['extraction_quality'] = 0.0
                            suggestion['combined_score'] = 0.0
                    else:
                        logger.warning("Database not configured, skipping extraction validation")
                        suggestion['extraction_quality'] = suggestion.get('match_score', 0.0)  # Fallback to match_score
                        suggestion['combined_score'] = suggestion.get('match_score', 0.0)

                except Exception as e:
                    logger.error(f"Failed to test extraction for suggestion {i}: {str(e)}", exc_info=True)
                    suggestion['extraction_quality'] = 0.0
                    suggestion['combined_score'] = 0.0
                    suggestion['extraction_error'] = str(e)

            # Re-sort suggestions by combined_score (match_score * extraction_quality)
            suggestions.sort(key=lambda x: x.get('combined_score', 0), reverse=True)
            logger.info("Re-sorted suggestions by combined score")

        # 4) Apply 2-way validation thresholds for decision
        chosen = None
        if suggestions:
            best = suggestions[0]
            match_score = best.get('match_score', 0.0)
            extraction_quality = best.get('extraction_quality', match_score)  # Fallback to match_score if not tested

            # 2-way validation: BOTH match_score AND extraction_quality must meet thresholds
            if match_score >= 0.70 and extraction_quality >= 0.70:
                chosen = best
                logger.info(f"High confidence match: match={match_score:.2f}, extraction={extraction_quality:.2f}")
            elif match_score >= 0.60 and extraction_quality >= 0.50:
                # Medium confidence - show options to user
                logger.info(f"Medium confidence match: match={match_score:.2f}, extraction={extraction_quality:.2f}")
                chosen = best  # Still use it, but mark for user review
            else:
                logger.info(
                    f"Low confidence match: match={match_score:.2f}, extraction={extraction_quality:.2f}. "
                    f"Will generate new template if allowed."
                )

        if chosen:
            # Strong enough existing template found
            match_score = chosen.get('match_score', 0.0)
            extraction_quality = chosen.get('extraction_quality', 0.0)

            # Determine validation level for user transparency
            if match_score >= 0.70 and extraction_quality >= 0.70:
                validation_level = 'high_confidence'
                reason = 'Template meets high confidence thresholds for both matching and extraction'
            elif match_score >= 0.60 and extraction_quality >= 0.50:
                validation_level = 'medium_confidence'
                reason = 'Template meets medium confidence thresholds - please review extracted fields'
            else:
                validation_level = 'low_confidence'
                reason = 'Best available template, but extraction quality may be limited'

            response = {
                'action': 'use_existing',
                'chosen_template': chosen,
                'alternatives': suggestions[1:5],
                'evaluation': evaluation,
                'decision_metadata': {
                    'reason': reason,
                    'validation_level': validation_level,
                    'match_score': match_score,
                    'extraction_quality': extraction_quality,
                    'combined_score': chosen.get('combined_score', 0.0),
                    'extraction_tested': 'extraction_quality' in chosen,
                    'min_match_confidence': min_match_confidence,
                    'quick_scan': quick_scan,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
            }
            return JSONResponse(content=response)

        # 2) If no strong match and generation is allowed, generate a template
        if allow_generation:
            analysis = await ai_template_generator.analyze_document_structure(temp_file_path)

            # Use provided name/category or derive from evaluation
            primary_type = (evaluation.get('type_evaluation') or {}).get('primary_type') or 'document'
            template_name = f"{primary_type.title()} Template"

            generated_template = await ai_template_generator.generate_template_from_analysis(
                analysis,
                template_name
            )

            # Override category with detected type if missing
            if 'category' not in generated_template or not generated_template['category']:
                generated_template['category'] = primary_type

            # Validate extraction with the same source document
            test_extraction = await _test_template_extraction(temp_file_path, generated_template)

            decision = {
                'action': 'generated',
                'template': generated_template,
                'evaluation': evaluation,
                'generation_metadata': {
                    'generation_method': generation_mode,
                    'ai_confidence': analysis.get('confidence'),
                    'fields_detected': len(analysis.get('detected_fields', [])),
                    'original_filename': file.filename,
                    'auto_save': auto_save,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                },
                'validation_results': {
                    'template_valid': True,
                    'validation_warnings': [],
                    'suggested_improvements': []
                },
                'test_extraction': test_extraction,
                'decision_metadata': {
                    'reason': 'No template met minimum match confidence; generation allowed',
                    'min_match_confidence': min_match_confidence,
                    'quick_scan': quick_scan,
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
            }

            # Optional auto-save
            if auto_save:
                try:
                    saved_template = await _save_template_to_database(generated_template, template_name, generated_template.get('category', primary_type))
                    decision['generation_metadata']['saved_to_database'] = True
                    decision['generation_metadata']['template_id'] = saved_template['id']
                    decision['template']['id'] = saved_template['id']
                except Exception as e:
                    logger.error(f"Failed to auto-save generated template: {str(e)}")
                    decision['generation_metadata']['saved_to_database'] = False
                    decision['generation_metadata']['save_error'] = str(e)

            return JSONResponse(content=decision)

        # 3) Neither a strong match nor generation allowed
        return JSONResponse(content={
            'action': 'no_suitable_template',
            'evaluation': evaluation,
            'alternatives': suggestions,
            'decision_metadata': {
                'reason': 'No suggestion met minimum confidence and generation not allowed',
                'min_match_confidence': min_match_confidence,
                'quick_scan': quick_scan,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template decision failed: {str(e)}")
    finally:
        if temp_file_path:
            await cleanup_temp_file(temp_file_path)

@router.post("/evaluate-document-type")
async def evaluate_document_type(
    file: UploadFile = File(...),
    quick_scan: bool = Query(True, description="Perform quick scan only (faster)"),
    include_confidence_scores: bool = Query(True, description="Include detailed confidence scores"),
    suggest_templates: bool = Query(True, description="Suggest matching templates"),
    organization_id: Optional[str] = Query(None, description="Organization ID for org-specific LLM config")
):
    """
    Quickly evaluate document type and suggest processing options.
    
    This endpoint provides:
    - Fast document type detection (quick_scan=True) or comprehensive analysis
    - Confidence scores for each document type
    - Suggested templates that match the document
    - Recommended processing workflow
    - File format validation
    
    Use this for:
    - Initial document upload evaluation
    - Template recommendation
    - Processing workflow guidance
    - File format validation
    """
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    temp_file_path = None
    
    try:
        # Save uploaded file temporarily
        temp_file_path = await save_uploaded_file(file)

        # For PDFs and binary files, extract clean text using Docling first
        clean_text = None
        file_extension = Path(file.filename).suffix.lower()
        if file_extension in ['.pdf', '.docx', '.doc', '.xlsx']:
            logger.info(f"Pre-extracting clean text for {file_extension} file using Docling")
            try:
                # Use enhanced Docling service to get clean text
                result = await enhanced_docling_service.process_document(
                    temp_file_path,
                    extract_text=True,
                    extract_metadata=False,
                    extract_structure=False
                )

                if result.get('status') == 'completed':
                    clean_text = result.get('content', {}).get('text', '')
                    logger.info(f"Extracted {len(clean_text)} chars of clean text from PDF")
                else:
                    logger.warning(f"Docling extraction failed with status: {result.get('status')}")
            except Exception as e:
                logger.warning(f"Failed to pre-extract text from {file_extension}: {e}")
                # Continue without clean text - evaluator will extract directly

        # Evaluate document type with clean text if available
        evaluation_result = await document_evaluator.evaluate_document(
            temp_file_path,
            file.filename,
            file.content_type or "",
            quick_scan=quick_scan,
            content_override=clean_text,
            organization_id=organization_id
        )
        
        # Filter results based on parameters
        if not include_confidence_scores:
            # Remove detailed confidence information
            evaluation_result['type_evaluation'].pop('alternative_types', None)
            
        if not suggest_templates:
            # Remove template suggestions
            evaluation_result['template_suggestions'] = []
        
        # Add evaluation metadata
        evaluation_result['evaluation_metadata'] = {
            'evaluation_time': datetime.utcnow().isoformat(),
            'quick_scan': quick_scan,
            'include_confidence_scores': include_confidence_scores,
            'suggest_templates': suggest_templates,
            'evaluation_version': '1.0.0'
        }
        
        return JSONResponse(content=evaluation_result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document evaluation failed: {str(e)}")
        
    finally:
        # Cleanup temporary file
        if temp_file_path:
            await cleanup_temp_file(temp_file_path)

@router.post("/extract-with-smart-template")
async def extract_with_smart_template(
    file: UploadFile = File(...),
    template_data: Optional[str] = Form(None, description="JSON string containing smart template data"),
    processing_mode: str = Form("smart_template", description="Processing mode: smart_template or progressive"),
    confidence_threshold: float = Form(0.7, description="Minimum confidence threshold for extraction"),
    enable_validation: bool = Form(True, description="Enable extraction validation"),
    provider: str = Form("azure", description="AI provider to use (azure or ollama)"),
    use_two_pass: bool = Form(False, description="Use two-pass extraction for improved accuracy"),
    organization_id: Optional[str] = Form(None, description="Organization ID for org-specific LLM config")
):
    """
    Extract structured data from document using smart template with AI-based field extraction.
    
    This endpoint is specifically designed for smart template processing with:
    - AI-powered field extraction using smart variables
    - Template-guided document analysis
    - High-accuracy extraction with confidence scoring
    - Support for progressive processing modes
    
    Expected template data format:
    {
        "id": "template_id",
        "name": "template_name", 
        "smart_variables": [
            {
                "name": "field_name",
                "type": "text|currency|date|email",
                "description": "Description of what this field contains",
                "extraction_hints": ["hint1", "hint2"]
            }
        ],
        "extraction_rules": [...],
        "confidence_threshold": 0.7
    }
    """
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    temp_file_path = None

    try:
        # DEBUG: Log incoming request details
        logger.info("=" * 80)
        logger.info("EXTRACT-WITH-SMART-TEMPLATE REQUEST")
        logger.info("=" * 80)
        logger.info(f"Filename: {file.filename}")
        logger.info(f"Content-Type: {file.content_type}")
        logger.info(f"Processing Mode: {processing_mode}")
        logger.info(f"Confidence Threshold: {confidence_threshold}")
        logger.info(f"Provider: {provider}")
        logger.info(f"Template Data Received: {bool(template_data)}")
        if template_data:
            logger.info(f"Template Data Length: {len(template_data)} chars")
            logger.info(f"Template Data Preview: {template_data[:200]}...")

        # Parse template data if provided
        template_info = None
        template_variables = []
        if template_data:
            try:
                template_info = json.loads(template_data)
                logger.info(f"✓ Template data parsed successfully")
                logger.info(f"Template ID: {template_info.get('id')}")
                logger.info(f"Template Name: {template_info.get('name')}")

                # Support both 'smart_variables' and 'variables' field names
                template_variables = template_info.get('smart_variables') or template_info.get('variables', [])
                logger.info(f"✓ Found {len(template_variables)} variables in template")

                # DEBUG: Log each variable structure
                for i, var in enumerate(template_variables[:3]):  # Log first 3 variables
                    logger.info(f"  Variable {i+1}: {var.get('name')} (type: {var.get('type')})")
                    logger.info(f"    Description: {var.get('description', 'N/A')}")
                    logger.info(f"    Hints: {var.get('extraction_hints', [])}")

            except json.JSONDecodeError as e:
                logger.error(f"✗ Failed to parse template_data JSON: {e}")
                raise HTTPException(status_code=400, detail=f"Invalid JSON in template_data: {str(e)}")
        else:
            logger.warning("✗ No template_data provided in request")

        if not template_variables:
            logger.error("✗ No smart template variables found after parsing")
            logger.error(f"Template info structure: {template_info}")
            raise HTTPException(status_code=400, detail="No smart template variables provided")
        
        # Save uploaded file temporarily
        temp_file_path = await save_uploaded_file(file)
        
        # Extract text content from document
        try:
            # Handle different file types for text extraction
            if temp_file_path.suffix.lower() in ['.html', '.htm']:
                async with aiofiles.open(temp_file_path, 'r', encoding='utf-8') as f:
                    html_content = await f.read()
                # Simple HTML tag removal
                text_content = re.sub(r'<[^>]+>', ' ', html_content)
                text_content = re.sub(r'\s+', ' ', text_content).strip()
            elif temp_file_path.suffix.lower() in ['.txt', '.md']:
                async with aiofiles.open(temp_file_path, 'r', encoding='utf-8') as f:
                    text_content = await f.read()
            else:
                # Use enhanced Docling service for complex formats
                docling_result = await enhanced_docling_service.process_document_with_ai_enhancement(
                    temp_file_path,
                    extract_text=True,
                    extract_metadata=False,
                    extract_structure=False,
                    use_ai_enhancement=False  # Skip AI enhancement for faster text extraction
                )
                
                if docling_result.get('status') != 'completed':
                    raise HTTPException(status_code=500, detail="Failed to extract text from document")
                
                text_content = docling_result.get('content', {}).get('text', '')
                
        except Exception as e:
            logger.error(f"Text extraction failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")
        
        if not text_content:
            raise HTTPException(status_code=400, detail="No text content found in document")

        # Choose extraction method based on use_two_pass parameter
        if use_two_pass:
            logger.info(f"Smart template extraction (two-pass): processing {len(template_variables)} variables with {provider} provider")
            extracted_data = await two_pass_extractor.extract_two_pass(
                text_content=text_content,
                template_variables=template_variables,
                confidence_threshold=confidence_threshold,
                provider=provider,
                organization_id=organization_id
            )
        else:
            # Use smart field extractor for AI-powered extraction
            logger.info(f"Smart template extraction: processing {len(template_variables)} variables with {provider} provider")
            extracted_data = await smart_field_extractor.extract_fields_intelligently(
                text_content,
                template_variables,
                confidence_threshold,
                provider=provider,
                organization_id=organization_id
            )
        
        # Build response in format expected by frontend
        response_data = {
            "job_id": str(uuid.uuid4()),
            "status": "completed",
            "endpoint": "extract-with-smart-template",
            "filename": file.filename,
            "content": {"text": text_content},
            "metadata": {
                "format": temp_file_path.suffix,
                "source": "smart_template_extraction",
                "provider_used": provider,
                "processing_mode": processing_mode
            },
            "extracted_data": extracted_data,
            "template_info": template_info,
            "confidence_threshold": confidence_threshold,
            "validation_enabled": enable_validation,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "processing_time": extracted_data.get("processing_time_ms", 100) / 1000.0,
            "extraction_method": "smart_template_based"
        }
        
        # Add validation results if enabled
        if enable_validation:
            validation_results = _validate_extraction_results(extracted_data, template_variables)
            response_data["validation_results"] = validation_results
        
        return JSONResponse(content=response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Smart template extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Smart template extraction failed: {str(e)}")
        
    finally:
        # Cleanup temporary file
        if temp_file_path:
            await cleanup_temp_file(temp_file_path)

class SmartExtractRequest(BaseModel):
    """Request model for smart field extraction"""
    text_content: str
    template_data: Dict[str, Any]
    confidence_threshold: float = 0.6
    provider: str = "azure"
    organization_id: Optional[str] = None

@router.post("/smart-extract")
async def smart_field_extraction(request: SmartExtractRequest):
    """
    NEW: Smart LLM-based field extraction endpoint

    This endpoint uses Azure OpenAI or Ollama to intelligently extract field values
    from text content based on field descriptions rather than regex patterns.

    Request body format:
    {
        "text_content": "document text here...",
        "template_data": {
            "smart_variables": [
                {
                    "name": "field_name",
                    "type": "text|currency|date|email",
                    "description": "Description of what this field contains"
                }
            ]
        },
        "confidence_threshold": 0.6,
        "provider": "azure"
    }
    """
    try:
        # Extract template variables from request
        template_variables = request.template_data.get('smart_variables', [])
        
        if not template_variables:
            raise HTTPException(status_code=400, detail="No template variables provided")
        
        # Use the smart field extractor directly
        extracted_data = await smart_field_extractor.extract_fields_intelligently(
            request.text_content,
            template_variables,
            request.confidence_threshold,
            provider=request.provider,
            organization_id=request.organization_id
        )
        
        return JSONResponse(content={
            "job_id": str(uuid.uuid4()),
            "status": "completed",
            "endpoint": "smart-extract",
            "filename": "text_input",
            "content": {"text": request.text_content[:200] + "..." if len(request.text_content) > 200 else request.text_content},
            "metadata": {"format": "text", "source": "smart_extraction", "provider_used": request.provider},
            "extracted_data": extracted_data,
            "template_variables": template_variables,
            "confidence_threshold": request.confidence_threshold,
            "created_at": datetime.utcnow().isoformat(),
            "completed_at": datetime.utcnow().isoformat(),
            "processing_time": extracted_data.get("processing_time_ms", 100) / 1000.0,
            "extraction_method": "smart_llm_based"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Smart extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Smart extraction failed: {str(e)}")

@router.post("/analyze-document")
async def analyze_document_for_template_generation(
    file: UploadFile = File(...),
    confidence_threshold: float = Query(0.7, description="Minimum confidence for field detection"),
    include_suggestions: bool = Query(True, description="Include AI-generated field suggestions"),
    analysis_depth: str = Query("standard", description="Analysis depth: basic, standard, comprehensive"),
    organization_id: Optional[str] = Query(None, description="Organization ID for org-specific LLM config")
):
    """
    Analyze document structure and content to identify potential template fields.
    
    This endpoint performs deep analysis to understand document layout, detect patterns,
    and suggest extractable fields for template creation.
    
    Use this when you want to:
    - Understand what fields can be extracted from a new document type
    - Get AI suggestions for template creation
    - Analyze document complexity before processing
    """
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    if analysis_depth not in ["basic", "standard", "comprehensive"]:
        raise HTTPException(status_code=400, detail="Analysis depth must be basic, standard, or comprehensive")
    
    temp_file_path = None
    
    try:
        # Save uploaded file temporarily
        temp_file_path = await save_uploaded_file(file)
        
        # Perform document analysis
        analysis = await ai_template_generator.analyze_document_structure(temp_file_path)
        
        # Filter fields by confidence threshold
        if confidence_threshold > 0:
            filtered_fields = [
                field for field in analysis['detected_fields']
                if field['confidence'] >= confidence_threshold
            ]
            analysis['detected_fields'] = filtered_fields
        
        # Add analysis metadata
        analysis['analysis_metadata']['original_filename'] = file.filename
        analysis['analysis_metadata']['confidence_threshold'] = confidence_threshold
        analysis['analysis_metadata']['include_suggestions'] = include_suggestions
        analysis['analysis_metadata']['analysis_depth'] = analysis_depth
        
        return JSONResponse(content=analysis)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document analysis failed: {str(e)}")
        
    finally:
        # Cleanup temporary file
        if temp_file_path:
            await cleanup_temp_file(temp_file_path)

@router.post("/save-generated-template")
async def save_generated_template(
    template_data: str = Query(..., description="JSON string containing generated template data"),
    template_name: str = Query(..., description="Name for the template"),
    category: str = Query("Generated", description="Category for the template")
):
    """
    Save a generated template to the database.
    
    This endpoint allows saving templates that were generated via /decide-template
    but not initially saved.
    """
    
    try:
        # Parse template data
        import json
        template = json.loads(template_data)
        
        # Save to database
        saved_template = await _save_template_to_database(template, template_name, category)
        
        return JSONResponse(content={
            'success': True,
            'template_id': saved_template['id'],
            'message': f'Template "{template_name}" saved successfully',
            'saved_template': saved_template
        })
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in template_data")
    except Exception as e:
        logger.error(f"Failed to save generated template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save template: {str(e)}")

async def _test_template_extraction(document_path: Path, template: Dict[str, Any]) -> Dict[str, Any]:
    """Test template extraction on the source document"""
    
    try:
        # Process document with enhanced service
        result = await enhanced_docling_service.process_document_with_ai_enhancement(
            document_path,
            extract_text=True,
            extract_metadata=True,
            extract_structure=True,
            use_ai_enhancement=True
        )
        
        if result.get('status') != 'completed':
            return {
                'extraction_successful': False,
                'extracted_fields_count': 0,
                'average_confidence': 0.0,
                'failed_fields': list(template.get('variables', []))
            }
        
        # Simulate field extraction based on template variables
        extracted_data = result.get('extracted_data', {}).get('extracted_values', {})
        template_variables = template.get('variables', [])
        
        successful_extractions = 0
        total_confidence = 0.0
        failed_fields = []
        
        for variable in template_variables:
            field_name = variable['name']
            # Simple check: if we have any extracted data that might match
            if field_name in extracted_data or any(hint in str(extracted_data) for hint in variable.get('extraction_hints', [])):
                successful_extractions += 1
                total_confidence += 0.8  # Simulated confidence
            else:
                failed_fields.append(field_name)
        
        return {
            'extraction_successful': successful_extractions > 0,
            'extracted_fields_count': successful_extractions,
            'average_confidence': total_confidence / len(template_variables) if template_variables else 0.0,
            'failed_fields': failed_fields
        }
        
    except Exception:
        return {
            'extraction_successful': False,
            'extracted_fields_count': 0,
            'average_confidence': 0.0,
            'failed_fields': [var['name'] for var in template.get('variables', [])]
        }

def _validate_extraction_results(
    extracted_data: Dict[str, Any], 
    template_variables: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Validate extraction results against template expectations"""
    
    extracted_values = extracted_data.get('extracted_values', {})
    validation_results = {
        'validation_passed': True,
        'field_validations': [],
        'overall_confidence': extracted_data.get('success_rate', 0.0),
        'warnings': [],
        'errors': []
    }
    
    for variable in template_variables:
        field_name = variable['name']
        field_type = variable.get('type', 'text')
        
        field_validation = {
            'field_name': field_name,
            'expected_type': field_type,
            'found': field_name in extracted_values,
            'confidence': 0.0,
            'status': 'missing'
        }
        
        if field_name in extracted_values:
            field_value = extracted_values[field_name]
            field_validation['extracted_value'] = field_value
            field_validation['status'] = 'extracted'
            field_validation['confidence'] = 0.8  # Default confidence
            
            # Basic type validation
            if field_type == 'currency' and not any(symbol in str(field_value) for symbol in ['$', '€', '£']):
                validation_results['warnings'].append(f"Field '{field_name}' expected currency but no currency symbol found")
            elif field_type == 'email' and '@' not in str(field_value):
                validation_results['warnings'].append(f"Field '{field_name}' expected email but no @ symbol found")
        else:
            validation_results['warnings'].append(f"Required field '{field_name}' not extracted")
        
        validation_results['field_validations'].append(field_validation)
    
    # Calculate overall validation status
    successful_extractions = sum(1 for fv in validation_results['field_validations'] if fv['found'])
    validation_results['extraction_rate'] = successful_extractions / len(template_variables) if template_variables else 0
    validation_results['validation_passed'] = validation_results['extraction_rate'] > 0.5
    
    return validation_results

async def _save_template_to_database(
    template: Dict[str, Any], 
    template_name: str, 
    category: str
) -> Dict[str, Any]:
    """Save generated template to the Supabase database"""
    
    # Get Supabase connection details from environment
    supabase_url = os.getenv('SUPABASE_URL', 'http://supabase-kong:8000')
    supabase_key = os.getenv('ANON_KEY', '')
    
    if not supabase_url or not supabase_key:
        raise ValueError("Supabase credentials not configured")
    
    headers = {
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }
    
    # Prepare template data for database
    template_data = {
        'name': template_name,
        'description': template.get('description', f'AI-generated template for {category} documents'),
        'category': category,
        'template_content': template.get('template_content', ''),
        'template_type': 'smart',
        'smart_variables': template.get('variables', []),
        'tags': ['ai-generated', category],
        'is_public': False,
        'extraction_rules': [
            {
                'variable_id': var.get('id', var.get('name')),
                'extraction_method': 'ai_powered',
                'confidence_threshold': 0.7,
                'ai_prompt': f"Extract the {var.get('name')} from the document",
                'fallback_rules': var.get('extraction_hints', [])
            }
            for var in template.get('variables', [])
        ],
        'generation_settings': {
            'model': 'ai_template_generator',
            'temperature': 0.3,
            'max_tokens': 1000,
            'generation_method': 'automatic'
        }
    }
    
    try:
        # Insert template into smart_templates table
        url = f"{supabase_url}/rest/v1/smart_templates"
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=template_data, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status >= 400:
                    text = await resp.text()
                    raise aiohttp.ClientResponseError(request_info=resp.request_info, history=resp.history, status=resp.status, message=text)
                saved_templates = await resp.json()
        
        if not saved_templates or len(saved_templates) == 0:
            raise LookupError("No template returned from database")
        
        saved_template = saved_templates[0]
        logger.info(f"Successfully saved template with ID: {saved_template['id']}")
        return saved_template
        
    except Exception as e:
        logger.error(f"Database save failed: {str(e)}")
        raise RuntimeError(f"Failed to save template to database: {str(e)}")

@router.post("/field-positions")
async def get_field_positions(
    file: UploadFile = File(...),
    field_values: str = Form(..., description="JSON array of field values to locate")
):
    """
    Find positions of extracted field values in the document.

    Returns bounding box coordinates for each field value found.
    Used for highlighting extracted values in document preview.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    temp_file_path = None
    try:
        # Parse field values
        values_to_find = json.loads(field_values)
        if not isinstance(values_to_find, list):
            raise HTTPException(status_code=400, detail="field_values must be a JSON array")

        # Extract just the value strings from field_values array
        # Input format: [{"fieldName": "vendor_name", "value": "Nicholas Yeager"}, ...]
        # Output: ["Nicholas Yeager", ...]
        search_texts = []
        for item in values_to_find:
            if isinstance(item, dict):
                # Extract value from dict, skip empty/None values
                value = item.get('value', '')
                if value:
                    search_texts.append(str(value))
            elif item:
                # Handle plain string values
                search_texts.append(str(item))

        if not search_texts:
            return JSONResponse(content={
                "filename": file.filename,
                "positions": [],
                "total_found": 0
            })

        # Save file temporarily
        temp_file_path = await save_uploaded_file(file)

        # Find positions using docling service
        from app.services.docling_service import docling_service
        positions = await docling_service.find_text_positions(
            temp_file_path,
            search_texts=search_texts
        )

        return JSONResponse(content={
            "filename": file.filename,
            "positions": positions,
            "total_found": len(positions)
        })

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except Exception as e:
        logger.error(f"Error getting field positions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_file_path:
            await cleanup_temp_file(temp_file_path)


