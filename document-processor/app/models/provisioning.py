"""
Pydantic models for Azure OpenAI provisioning
"""
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class ProvisioningAction(str, Enum):
    """Actions that can be logged during provisioning"""
    CREATE_RESOURCE = "create_resource"
    DEPLOY_MODEL = "deploy_model"
    GET_KEYS = "get_keys"
    STORE_CREDENTIALS = "store_credentials"
    DELETE_RESOURCE = "delete_resource"
    RETRY = "retry"


class ProvisioningLogStatus(str, Enum):
    """Status of a provisioning action"""
    STARTED = "started"
    COMPLETED = "completed"
    FAILED = "failed"


class ProvisioningStatus(str, Enum):
    """
    Overall provisioning status for an organization.

    Status meanings:
    - PENDING: Initial state, waiting to start provisioning
    - PROVISIONING: Azure resource creation in progress
    - ACTIVE: Stable state - no operation in progress. Check tier to determine
              if org has dedicated resources (enterprise) or not (non_managed)
    - FAILED: Last provisioning/deprovisioning operation failed
    - DEPROVISIONING: Azure resource deletion in progress
    """
    PENDING = "pending"
    PROVISIONING = "provisioning"
    ACTIVE = "active"
    FAILED = "failed"
    DEPROVISIONING = "deprovisioning"


class ProvisioningRequest(BaseModel):
    """Request to provision an Azure OpenAI instance"""
    selected_model: str = Field(
        default="gpt-4o-mini",
        description="Model to deploy (gpt-4o, gpt-4o-mini)"
    )


class ProvisioningStatusResponse(BaseModel):
    """Response with current provisioning status"""
    organization_id: str
    status: ProvisioningStatus
    model: Optional[str] = None
    region: str = "eastus"
    error_message: Optional[str] = None
    provisioned_at: Optional[datetime] = None
    progress_steps: List[Dict[str, Any]] = Field(default_factory=list)


class ProvisioningResult(BaseModel):
    """Result of a provisioning operation"""
    success: bool
    status: ProvisioningStatus
    message: str
    endpoint: Optional[str] = None
    error: Optional[str] = None
    api_key: Optional[str] = None
    deployment_name: Optional[str] = None


class ProvisioningLogEntry(BaseModel):
    """A single provisioning log entry"""
    id: str
    organization_id: str
    action: ProvisioningAction
    status: ProvisioningLogStatus
    details: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    created_at: datetime


class DeprovisioningResponse(BaseModel):
    """Response for deprovisioning request"""
    status: str
    message: str
    organization_id: str


class ProvisioningLogsResponse(BaseModel):
    """Response containing provisioning logs"""
    organization_id: str
    logs: List[ProvisioningLogEntry] = Field(default_factory=list)
