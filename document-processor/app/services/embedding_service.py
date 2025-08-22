import asyncio
import logging
import os
from typing import List, Optional, Dict, Any
import hashlib
import time

try:
    import openai
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    openai = None
    AsyncOpenAI = None

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    np = None

logger = logging.getLogger(__name__)

class EmbeddingService:
    """Service for generating embeddings with support for multiple providers"""
    
    def __init__(self):
        self.azure_client = None
        self.openai_client = None
        # Use deployment name from environment for Azure, model name for OpenAI
        self.default_model = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small")
        self.fallback_model = os.getenv("AZURE_OPENAI_EMBEDDING_FALLBACK", "text-embedding-ada-002")
        self.max_tokens = 8192  # Max tokens for embedding models
        self.batch_size = 100   # Process embeddings in batches
        
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize embedding clients based on available configuration"""
        
        if not OPENAI_AVAILABLE:
            logger.warning("OpenAI library not available - embeddings will not work")
            return
        
        # Try to initialize Azure OpenAI first (preferred for enterprise)
        azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        azure_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        
        if azure_endpoint and azure_api_key:
            try:
                from openai import AsyncAzureOpenAI
                self.azure_client = AsyncAzureOpenAI(
                    api_key=azure_api_key,
                    azure_endpoint=azure_endpoint,
                    api_version="2024-02-01"
                )
                self.provider = "azure"
                logger.info("Azure OpenAI client initialized for embeddings")
                return
            except Exception as e:
                logger.warning(f"Failed to initialize Azure OpenAI client: {e}")
        
        # Fallback to regular OpenAI
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if openai_api_key:
            try:
                self.openai_client = AsyncOpenAI(api_key=openai_api_key)
                self.provider = "openai"
                logger.info("OpenAI client initialized for embeddings")
                return
            except Exception as e:
                logger.warning(f"Failed to initialize OpenAI client: {e}")
        
        logger.error("No embedding provider available - check API keys")
        self.provider = None
    
    async def generate_embeddings(self, 
                                texts: List[str],
                                model: Optional[str] = None) -> Optional[List[List[float]]]:
        """Generate embeddings for a list of texts"""
        
        if not texts:
            return []
        
        if not self.provider:
            logger.error("No embedding provider available")
            return None
        
        model = model or self.default_model
        
        try:
            # Process in batches to avoid API limits
            all_embeddings = []
            
            for i in range(0, len(texts), self.batch_size):
                batch_texts = texts[i:i + self.batch_size]
                
                # Clean and truncate texts
                cleaned_texts = [self._clean_text(text) for text in batch_texts]
                
                batch_embeddings = await self._generate_batch_embeddings(
                    cleaned_texts, model
                )
                
                if batch_embeddings is None:
                    logger.error(f"Failed to generate embeddings for batch {i//self.batch_size + 1}")
                    return None
                
                all_embeddings.extend(batch_embeddings)
                
                # Small delay between batches to respect rate limits
                if i + self.batch_size < len(texts):
                    await asyncio.sleep(0.1)
            
            logger.info(f"Successfully generated {len(all_embeddings)} embeddings")
            return all_embeddings
            
        except Exception as e:
            logger.error(f"Error generating embeddings: {e}")
            return None
    
    async def _generate_batch_embeddings(self, 
                                       texts: List[str], 
                                       model: str) -> Optional[List[List[float]]]:
        """Generate embeddings for a batch of texts"""
        
        max_retries = 3
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                if self.provider == "azure" and self.azure_client:
                    response = await self.azure_client.embeddings.create(
                        input=texts,
                        model=model
                    )
                elif self.provider == "openai" and self.openai_client:
                    response = await self.openai_client.embeddings.create(
                        input=texts,
                        model=model
                    )
                else:
                    logger.error("No valid client available")
                    return None
                
                # Extract embeddings from response
                embeddings = [data.embedding for data in response.data]
                
                logger.debug(f"Generated {len(embeddings)} embeddings using {model}")
                return embeddings
                
            except openai.RateLimitError as e:
                wait_time = retry_delay * (2 ** attempt)
                logger.warning(f"Rate limit hit, waiting {wait_time}s before retry {attempt + 1}")
                await asyncio.sleep(wait_time)
                
            except openai.APIError as e:
                if attempt == 0 and model == self.default_model:
                    # Try fallback model
                    logger.warning(f"API error with {model}, trying {self.fallback_model}")
                    model = self.fallback_model
                    continue
                else:
                    logger.error(f"API error generating embeddings: {e}")
                    break
                    
            except Exception as e:
                logger.error(f"Unexpected error generating embeddings: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                else:
                    break
        
        return None
    
    def _clean_text(self, text: str) -> str:
        """Clean and prepare text for embedding generation"""
        
        if not text or not isinstance(text, str):
            return ""
        
        # Remove excessive whitespace
        cleaned = " ".join(text.split())
        
        # Truncate if too long (approximate token limit)
        # Rough estimate: 4 characters per token
        max_chars = self.max_tokens * 4
        if len(cleaned) > max_chars:
            cleaned = cleaned[:max_chars]
            logger.debug(f"Truncated text from {len(text)} to {len(cleaned)} characters")
        
        return cleaned
    
    async def generate_single_embedding(self, 
                                      text: str,
                                      model: Optional[str] = None) -> Optional[List[float]]:
        """Generate embedding for a single text"""
        
        embeddings = await self.generate_embeddings([text], model)
        return embeddings[0] if embeddings else None
    
    def calculate_similarity(self, 
                           embedding1: List[float], 
                           embedding2: List[float]) -> float:
        """Calculate cosine similarity between two embeddings"""
        
        if not NUMPY_AVAILABLE:
            # Simple dot product similarity without numpy
            return self._simple_cosine_similarity(embedding1, embedding2)
        
        try:
            vec1 = np.array(embedding1)
            vec2 = np.array(embedding2)
            
            # Cosine similarity
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            return dot_product / (norm1 * norm2)
            
        except Exception as e:
            logger.error(f"Error calculating similarity: {e}")
            return 0.0
    
    def _simple_cosine_similarity(self, 
                                embedding1: List[float], 
                                embedding2: List[float]) -> float:
        """Simple cosine similarity calculation without numpy"""
        
        try:
            # Dot product
            dot_product = sum(a * b for a, b in zip(embedding1, embedding2))
            
            # Norms
            norm1 = sum(a * a for a in embedding1) ** 0.5
            norm2 = sum(b * b for b in embedding2) ** 0.5
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            return dot_product / (norm1 * norm2)
            
        except Exception as e:
            logger.error(f"Error in simple cosine similarity: {e}")
            return 0.0
    
    def get_embedding_dimension(self, model: Optional[str] = None) -> int:
        """Get the dimension of embeddings for a given model"""
        
        model = model or self.default_model
        
        # Known dimensions for common models
        model_dimensions = {
            "text-embedding-3-small": 1536,
            "text-embedding-3-large": 3072,
            "text-embedding-ada-002": 1536,
            "text-embedding-2": 1536
        }
        
        return model_dimensions.get(model, 1536)  # Default to 1536
    
    async def get_service_status(self) -> Dict[str, Any]:
        """Get embedding service status"""
        
        return {
            "service": "embedding",
            "provider": self.provider,
            "openai_available": OPENAI_AVAILABLE,
            "numpy_available": NUMPY_AVAILABLE,
            "azure_configured": bool(os.getenv("AZURE_OPENAI_ENDPOINT") and os.getenv("AZURE_OPENAI_API_KEY")),
            "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
            "default_model": self.default_model,
            "fallback_model": self.fallback_model,
            "max_tokens": self.max_tokens,
            "batch_size": self.batch_size
        }
    
    async def test_embedding_generation(self) -> Dict[str, Any]:
        """Test embedding generation with a simple text"""
        
        test_text = "This is a test sentence for embedding generation."
        
        start_time = time.time()
        embedding = await self.generate_single_embedding(test_text)
        end_time = time.time()
        
        if embedding:
            return {
                "status": "success",
                "test_text": test_text,
                "embedding_dimension": len(embedding),
                "generation_time": end_time - start_time,
                "first_few_values": embedding[:5],
                "provider": self.provider,
                "model": self.default_model
            }
        else:
            return {
                "status": "failed",
                "error": "Could not generate embedding",
                "provider": self.provider
            }


# Global service instance
embedding_service = EmbeddingService()