"""
Billing models for Stripe integration
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum


class BillingTier(str, Enum):
    """Available billing tiers"""
    FREE = "free"
    NON_MANAGED = "non_managed"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class AIModel(str, Enum):
    """Available AI models for enterprise tier"""
    GPT_4O = "gpt-4o"
    GPT_4O_MINI = "gpt-4o-mini"


class CreateCheckoutSessionRequest(BaseModel):
    """Request to create a Stripe checkout session"""
    organization_id: str = Field(..., description="The organization upgrading")
    tier: BillingTier = Field(..., description="The tier to subscribe to")
    selected_model: Optional[AIModel] = Field(
        default=AIModel.GPT_4O_MINI,
        description="AI model for enterprise tier"
    )
    success_url: Optional[str] = Field(
        default=None,
        description="URL to redirect after successful payment"
    )
    cancel_url: Optional[str] = Field(
        default=None,
        description="URL to redirect if payment is cancelled"
    )


class CreateCheckoutSessionResponse(BaseModel):
    """Response with Stripe checkout session details"""
    checkout_url: str = Field(..., description="URL to redirect user to Stripe Checkout")
    session_id: str = Field(..., description="Stripe session ID for reference")


class CustomerPortalRequest(BaseModel):
    """Request to create a customer portal session"""
    organization_id: str = Field(..., description="The organization's ID")
    return_url: Optional[str] = Field(
        default=None,
        description="URL to return to after portal session"
    )


class CustomerPortalResponse(BaseModel):
    """Response with customer portal URL"""
    portal_url: str = Field(..., description="URL to Stripe Customer Portal")


class SubscriptionStatusResponse(BaseModel):
    """Current subscription status for an organization"""
    organization_id: str
    tier: BillingTier
    status: Literal["active", "trialing", "past_due", "canceled", "none"]
    current_period_end: Optional[str] = None
    cancel_at_period_end: bool = False
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None


class WebhookEventResponse(BaseModel):
    """Response for webhook processing"""
    received: bool = True
    event_type: str
    message: str


class BillingConfigResponse(BaseModel):
    """Public billing configuration (safe for frontend)"""
    stripe_configured: bool
    publishable_key: Optional[str] = None
    prices: dict = Field(default_factory=dict)
