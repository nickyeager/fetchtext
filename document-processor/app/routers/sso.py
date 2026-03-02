"""
SSO router — manages SAML 2.0 identity providers.

Endpoints for configuring, removing, and checking SSO status.
The actual SAML login flow is handled by Supabase Auth (not this router).
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..middleware.admin_auth import admin_auth
from ..services.sso_service import sso_service, SSOProviderConfig

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sso", tags=["sso"])


# ── Pydantic Models ──────────────────────────────────────

class SSOConfigureRequest(BaseModel):
    domain: str
    idp_name: str = ""
    metadata_url: Optional[str] = None
    metadata_xml: Optional[str] = None
    auto_provision: bool = True
    default_role: str = "member"


class SSOStatusResponse(BaseModel):
    configured: bool
    domain: Optional[str] = None
    idp_name: Optional[str] = None
    sso_provider_id: Optional[str] = None
    auto_provision: bool = True
    default_role: str = "member"
    # SP metadata for IdP configuration
    acs_url: str = ""
    metadata_url: str = ""
    entity_id: str = ""


class SSOUpdateRequest(BaseModel):
    idp_name: Optional[str] = None
    metadata_url: Optional[str] = None
    auto_provision: Optional[bool] = None
    default_role: Optional[str] = None


class SSODomainCheckResponse(BaseModel):
    domain: str
    has_sso: bool
    organization_name: Optional[str] = None


class SSOProvisionRequest(BaseModel):
    sso_provider_id: str


# ── Endpoints ─────────────────────────────────────────────

@router.get("/status", response_model=SSOStatusResponse)
async def get_sso_status(
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Check if SSO is configured for the organization."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    info = await sso_service.get_org_sso_status(organization_id)

    return SSOStatusResponse(
        configured=info is not None,
        domain=info.domain if info else None,
        idp_name=info.idp_name if info else None,
        sso_provider_id=info.sso_provider_id if info else None,
        auto_provision=info.auto_provision if info else True,
        default_role=info.default_role if info else "member",
        acs_url=sso_service.get_acs_url(),
        metadata_url=sso_service.get_metadata_url(),
        entity_id=sso_service.get_entity_id(),
    )


@router.post("/configure", response_model=SSOStatusResponse)
async def configure_sso(
    request: SSOConfigureRequest,
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Register a SAML IdP for the organization."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    if not request.metadata_url and not request.metadata_xml:
        raise HTTPException(status_code=400, detail="Either metadata_url or metadata_xml is required")

    config = SSOProviderConfig(
        domain=request.domain,
        idp_name=request.idp_name,
        metadata_url=request.metadata_url,
        metadata_xml=request.metadata_xml,
    )

    try:
        info = await sso_service.register_provider(organization_id, config)
    except Exception as e:
        logger.error(f"Failed to register SSO provider: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to configure SSO: {str(e)}")

    return SSOStatusResponse(
        configured=True,
        domain=info.domain,
        idp_name=info.idp_name,
        sso_provider_id=info.sso_provider_id,
        auto_provision=request.auto_provision,
        default_role=request.default_role,
        acs_url=sso_service.get_acs_url(),
        metadata_url=sso_service.get_metadata_url(),
        entity_id=sso_service.get_entity_id(),
    )


@router.patch("/update")
async def update_sso(
    request: SSOUpdateRequest,
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Update SSO configuration (JIT settings, IdP metadata)."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    from ..config.database import db_config
    supabase = db_config.client

    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.table("sso_provider_mappings") \
        .update(updates) \
        .eq("organization_id", organization_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="No SSO configuration found")

    return {"status": "updated", "updated_fields": list(updates.keys())}


@router.delete("/remove")
async def remove_sso(
    organization_id: str = Query(...),
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """Remove SSO configuration for the organization."""
    await admin_auth.verify_org_membership(current_user["user_id"], organization_id)

    info = await sso_service.get_org_sso_status(organization_id)
    if not info:
        raise HTTPException(status_code=404, detail="No SSO configuration found")

    success = await sso_service.remove_provider(organization_id, info.sso_provider_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to remove SSO provider from Supabase Auth")

    return {"status": "removed", "domain": info.domain}


@router.get("/check-domain", response_model=SSODomainCheckResponse)
async def check_domain(
    domain: str = Query(...),
):
    """Check if a domain has SSO configured (public endpoint for login page)."""
    mapping = await sso_service.get_domain_mapping(domain)

    if mapping:
        from ..config.database import db_config
        supabase = db_config.client
        org = supabase.table("organizations") \
            .select("name") \
            .eq("id", mapping["organization_id"]) \
            .single() \
            .execute()
        org_name = org.data.get("name", "") if org.data else None
    else:
        org_name = None

    return SSODomainCheckResponse(
        domain=domain,
        has_sso=mapping is not None,
        organization_name=org_name,
    )


@router.post("/provision")
async def provision_sso_user(
    request: SSOProvisionRequest,
    current_user: dict = Depends(admin_auth.get_current_user),
):
    """JIT provision: add the current SSO user to their organization."""
    result = await sso_service.provision_user(
        user_id=current_user["user_id"],
        sso_provider_id=request.sso_provider_id,
    )

    if not result:
        raise HTTPException(status_code=404, detail="No organization mapping found for this SSO provider")

    return result
