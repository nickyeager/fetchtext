"""
Billing router for Stripe integration

Handles:
- Creating checkout sessions for subscription upgrades
- Customer portal access for subscription management
- Subscription status queries
- Stripe webhook processing (optional - N8N handles primary flow)
"""
import logging
from fastapi import APIRouter, HTTPException, Request, Header
from typing import Optional

from app.config.settings import settings
from app.models.billing import (
    CreateCheckoutSessionRequest,
    CreateCheckoutSessionResponse,
    CustomerPortalRequest,
    CustomerPortalResponse,
    SubscriptionStatusResponse,
    WebhookEventResponse,
    BillingConfigResponse,
    BillingTier,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


def get_stripe_client():
    """Get configured Stripe client or raise error"""
    if not settings.is_stripe_configured():
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured. Set STRIPE_SECRET_KEY environment variable."
        )
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def get_price_id_for_tier(tier: BillingTier) -> str:
    """Map tier to Stripe price ID"""
    price_map = {
        BillingTier.NON_MANAGED: settings.STRIPE_PRICE_NON_MANAGED,
        BillingTier.PROFESSIONAL: settings.STRIPE_PRICE_PROFESSIONAL,
        BillingTier.ENTERPRISE: settings.STRIPE_PRICE_ENTERPRISE,
    }
    price_id = price_map.get(tier)
    if not price_id:
        raise HTTPException(
            status_code=400,
            detail=f"No Stripe price configured for tier: {tier.value}. "
                   f"Set STRIPE_PRICE_{tier.value.upper()} environment variable."
        )
    return price_id


@router.get("/config", response_model=BillingConfigResponse)
async def get_billing_config():
    """
    Get public billing configuration for frontend.
    Returns publishable key and available price IDs.
    """
    return BillingConfigResponse(
        stripe_configured=settings.is_stripe_configured(),
        publishable_key=settings.STRIPE_PUBLISHABLE_KEY,
        prices={
            "non_managed": settings.STRIPE_PRICE_NON_MANAGED,
            "professional": settings.STRIPE_PRICE_PROFESSIONAL,
            "enterprise": settings.STRIPE_PRICE_ENTERPRISE,
        }
    )


@router.post("/checkout", response_model=CreateCheckoutSessionResponse)
async def create_checkout_session(request: CreateCheckoutSessionRequest):
    """
    Create a Stripe Checkout session for subscription upgrade.

    The organization_id and tier are stored in session metadata,
    which Stripe sends to the N8N webhook on successful payment.
    """
    stripe = get_stripe_client()

    if request.tier == BillingTier.FREE:
        raise HTTPException(
            status_code=400,
            detail="Cannot create checkout session for free tier"
        )

    price_id = get_price_id_for_tier(request.tier)

    # Build success/cancel URLs
    base_url = settings.FRONTEND_URL
    success_url = request.success_url or f"{base_url}/settings/billing?success=true&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = request.cancel_url or f"{base_url}/settings/billing?canceled=true"

    try:
        # Create Stripe checkout session
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[
                {
                    "price": price_id,
                    "quantity": 1,
                }
            ],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "organization_id": request.organization_id,
                "tier": request.tier.value,
                "selected_model": request.selected_model.value if request.selected_model else "gpt-4o-mini",
            },
            subscription_data={
                "metadata": {
                    "organization_id": request.organization_id,
                    "tier": request.tier.value,
                    "selected_model": request.selected_model.value if request.selected_model else "gpt-4o-mini",
                }
            },
            allow_promotion_codes=True,
        )

        logger.info(f"Created checkout session {session.id} for org {request.organization_id}, tier {request.tier.value}")

        return CreateCheckoutSessionResponse(
            checkout_url=session.url,
            session_id=session.id
        )

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating checkout session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/portal", response_model=CustomerPortalResponse)
async def create_customer_portal_session(request: CustomerPortalRequest):
    """
    Create a Stripe Customer Portal session for managing subscription.

    Allows customers to:
    - Update payment method
    - View invoices
    - Cancel subscription
    - Change plan
    """
    stripe = get_stripe_client()

    # Look up customer ID from organization
    # For now, we need to query Supabase to get the stripe_customer_id
    # This would be stored when the first checkout completes

    # TODO: Implement customer lookup from Supabase
    # For now, require customer_id to be passed or stored

    return_url = request.return_url or f"{settings.FRONTEND_URL}/settings/billing"

    try:
        # First, find customer by organization metadata
        customers = stripe.Customer.search(
            query=f"metadata['organization_id']:'{request.organization_id}'"
        )

        if not customers.data:
            raise HTTPException(
                status_code=404,
                detail="No Stripe customer found for this organization. "
                       "Please complete a subscription checkout first."
            )

        customer = customers.data[0]

        session = stripe.billing_portal.Session.create(
            customer=customer.id,
            return_url=return_url,
        )

        return CustomerPortalResponse(portal_url=session.url)

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating portal session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subscription/{organization_id}", response_model=SubscriptionStatusResponse)
async def get_subscription_status(organization_id: str):
    """
    Get current subscription status for an organization.

    Queries Stripe to get the most up-to-date subscription info.
    """
    stripe = get_stripe_client()

    try:
        # Find customer by organization metadata
        customers = stripe.Customer.search(
            query=f"metadata['organization_id']:'{organization_id}'"
        )

        if not customers.data:
            # No customer found - they're on free tier
            return SubscriptionStatusResponse(
                organization_id=organization_id,
                tier=BillingTier.FREE,
                status="none",
            )

        customer = customers.data[0]

        # Get active subscriptions for this customer
        subscriptions = stripe.Subscription.list(
            customer=customer.id,
            status="all",
            limit=1,
        )

        if not subscriptions.data:
            return SubscriptionStatusResponse(
                organization_id=organization_id,
                tier=BillingTier.FREE,
                status="none",
                stripe_customer_id=customer.id,
            )

        sub = subscriptions.data[0]
        tier_str = sub.metadata.get("tier", "non_managed")

        return SubscriptionStatusResponse(
            organization_id=organization_id,
            tier=BillingTier(tier_str),
            status=sub.status,
            current_period_end=sub.current_period_end,
            cancel_at_period_end=sub.cancel_at_period_end,
            stripe_customer_id=customer.id,
            stripe_subscription_id=sub.id,
        )

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error getting subscription status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook", response_model=WebhookEventResponse)
async def handle_stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature")
):
    """
    Handle Stripe webhooks (backup to N8N workflow).

    Primary webhook handling is done by N8N for provisioning flow.
    This endpoint provides a backup/alternative for simple events.

    Note: For production, configure Stripe to send webhooks to N8N:
    POST https://your-n8n-domain/webhook/stripe-subscription
    """
    stripe = get_stripe_client()

    payload = await request.body()

    # Verify webhook signature if secret is configured
    if settings.STRIPE_WEBHOOK_SECRET and stripe_signature:
        try:
            event = stripe.Webhook.construct_event(
                payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
            )
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        # For development without signature verification
        import json
        event = json.loads(payload)

    event_type = event.get("type", "unknown")

    logger.info(f"Received Stripe webhook: {event_type}")

    # Log the event - actual handling done by N8N
    # This is here as a fallback or for events N8N doesn't handle

    return WebhookEventResponse(
        received=True,
        event_type=event_type,
        message=f"Event {event_type} received. Primary processing handled by N8N workflow."
    )


@router.post("/cancel/{organization_id}")
async def cancel_subscription(organization_id: str):
    """
    Cancel an organization's subscription at period end.

    The subscription remains active until the current billing period ends.
    """
    stripe = get_stripe_client()

    try:
        # Find customer
        customers = stripe.Customer.search(
            query=f"metadata['organization_id']:'{organization_id}'"
        )

        if not customers.data:
            raise HTTPException(
                status_code=404,
                detail="No subscription found for this organization"
            )

        customer = customers.data[0]

        # Get active subscription
        subscriptions = stripe.Subscription.list(
            customer=customer.id,
            status="active",
            limit=1,
        )

        if not subscriptions.data:
            raise HTTPException(
                status_code=404,
                detail="No active subscription found"
            )

        sub = subscriptions.data[0]

        # Cancel at period end (not immediately)
        updated_sub = stripe.Subscription.modify(
            sub.id,
            cancel_at_period_end=True,
        )

        logger.info(f"Scheduled cancellation for subscription {sub.id}, org {organization_id}")

        return {
            "message": "Subscription will be canceled at the end of the current billing period",
            "cancel_at": updated_sub.current_period_end,
            "subscription_id": sub.id,
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error canceling subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))
