#!/usr/bin/env python3
"""
Seed a Supabase auth user (managed or local) for the dashboard.

Usage (from repo root):
    python scripts/seed_supabase_user.py \
            --email admin@fetchtext.local \
            --password CHANGEME-set-via-TEST_USER_PASSWORD-env \
            --supabase-url "$(az keyvault secret show --vault-name ft-dev-kv --name supabase-url --query value -o tsv)" \
            --service-role-key "$(az keyvault secret show --vault-name ft-dev-kv --name supabase-service-role --query value -o tsv)"
"""
import argparse
import os
import sys
from typing import Any, Dict

import requests


def create_user(supabase_url: str, service_key: str, email: str, password: str) -> Dict[str, Any]:
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {"role": "admin"},
    }
    resp = requests.post(f"{supabase_url}/auth/v1/admin/users", headers=headers, json=payload, timeout=10)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Failed to create user ({resp.status_code}): {resp.text}")
    return resp.json()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed a Supabase auth user.")
    parser.add_argument("--email", required=False, default=os.getenv("SEED_USER_EMAIL", "admin@fetchtext.local"))
    parser.add_argument("--password", required=False, default=os.getenv("SEED_USER_PASSWORD", "CHANGEME-set-via-TEST_USER_PASSWORD-env"))
    parser.add_argument("--supabase-url", required=False, default=os.getenv("SUPABASE_URL") or os.getenv("SUPABASE_INTERNAL_URL"))
    parser.add_argument("--service-role-key", required=False, default=os.getenv("SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.supabase_url:
        print("SUPABASE_URL is required (set env var or pass via --supabase-url).", file=sys.stderr)
        sys.exit(1)
    if not args.service_role_key:
        print("SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY is required (set env var or pass via --service-role-key).", file=sys.stderr)
        sys.exit(1)
    try:
        result = create_user(args.supabase_url.rstrip("/"), args.service_role_key, args.email, args.password)
    except Exception as exc:  # noqa: BLE001
        print(f"Error seeding Supabase user: {exc}", file=sys.stderr)
        sys.exit(1)
    print("Seeded Supabase user:")
    print(f"  id: {result.get('id')}")
    print(f"  email: {result.get('email')}")


if __name__ == "__main__":
    main()
