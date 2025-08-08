"""
Integration tests for model configuration and service integration
"""
import pytest
import tempfile
import os
from pathlib import Path
from app.config.models import ModelConfig
from app.services.enhanced_docling_service import EnhancedDoclingService
from app.services.ai_content_classifier import AIContentClassifier

class TestModelIntegration:
    """Test model configuration integration across services"""

    def test_model_config_initialization(self):
        """Test that ModelConfig initializes with correct default"""
        # Create a temporary config for testing
        with tempfile.TemporaryDirectory() as temp_dir:
            config_file = Path(temp_dir) / "active_model.json"
            
            # Mock the config file path
            original_config_file = ModelConfig.__dict__.get('config_file', None)
            
            config = ModelConfig()
            config.config_file = config_file
            
            # Should use default model
            assert config.current_model == "qwen2.5:7b-instruct-q4_K_M"

    def test_model_config_persistence(self):
        """Test that model changes are persisted"""
        with tempfile.TemporaryDirectory() as temp_dir:
            config_file = Path(temp_dir) / "active_model.json"
            
            config = ModelConfig()
            config.config_file = config_file
            
            # Change model
            config.current_model = "llama2:7b"
            
            # Create new instance and verify persistence
            config2 = ModelConfig()
            config2.config_file = config_file
            config2._load_config()
            
            assert config2.current_model == "llama2:7b"

    def test_enhanced_docling_service_uses_config(self):
        """Test that EnhancedDoclingService uses global model config"""
        service = EnhancedDoclingService()
        
        # Should have model property that uses config
        assert hasattr(service, 'model')
        assert isinstance(service.model, str)
        
        # Should be able to change model
        original_model = service.model
        service.model = "test:model"
        assert service.model == "test:model"
        
        # Reset for other tests
        service.model = original_model

    def test_ai_classifier_uses_config(self):
        """Test that AIContentClassifier uses global model config"""
        classifier = AIContentClassifier()
        
        # Should have model property that uses config
        assert hasattr(classifier, 'model')
        assert isinstance(classifier.model, str)
        
        # Should be able to change model
        original_model = classifier.model
        classifier.model = "test:model"
        assert classifier.model == "test:model"
        
        # Reset for other tests
        classifier.model = original_model

    def test_model_synchronization(self):
        """Test that all services use the same model when changed"""
        service = EnhancedDoclingService()
        classifier = AIContentClassifier()
        
        # Both should start with the same model
        assert service.model == classifier.model
        
        # Change model through one service
        test_model = "test:sync"
        service.model = test_model
        
        # Both should reflect the change
        assert service.model == test_model
        assert classifier.model == test_model
        
        # Reset for other tests
        service.model = "qwen2.5:7b-instruct-q4_K_M"

    def test_environment_variable_override(self):
        """Test that environment variable overrides config file"""
        with tempfile.TemporaryDirectory() as temp_dir:
            config_file = Path(temp_dir) / "active_model.json"
            
            # Set environment variable
            os.environ["OLLAMA_MODEL"] = "env:model"
            
            try:
                config = ModelConfig()
                config.config_file = config_file
                config._load_config()
                
                assert config.current_model == "env:model"
                
            finally:
                # Clean up environment
                if "OLLAMA_MODEL" in os.environ:
                    del os.environ["OLLAMA_MODEL"]

if __name__ == "__main__":
    pytest.main([__file__])