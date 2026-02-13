#!/usr/bin/env python3
"""Export OpenAPI specification to JSON file.

This script generates the OpenAPI specification from the FastAPI application
and exports it to a JSON file for use with documentation tools like Redocly.

Usage:
    python scripts/export_openapi.py
    python scripts/export_openapi.py --output custom_path.json
"""
import json
import sys
import argparse
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app


def export_openapi(output_path: Path = None, pretty: bool = True) -> dict:
    """Export the OpenAPI schema to a JSON file.

    Args:
        output_path: Path for output file. Defaults to openapi.json in project root.
        pretty: Whether to pretty-print the JSON output.

    Returns:
        The OpenAPI schema dictionary.
    """
    # Generate OpenAPI schema
    openapi_schema = app.openapi()

    # Default output path
    if output_path is None:
        output_path = Path(__file__).parent.parent / "openapi.json"

    # Write to file
    with open(output_path, "w") as f:
        if pretty:
            json.dump(openapi_schema, f, indent=2, ensure_ascii=False)
        else:
            json.dump(openapi_schema, f, ensure_ascii=False)

    return openapi_schema


def print_summary(schema: dict) -> None:
    """Print a summary of the exported OpenAPI spec."""
    paths = schema.get("paths", {})
    tags = schema.get("tags", [])

    print("\n" + "=" * 60)
    print("FetchText API - OpenAPI Export Summary")
    print("=" * 60)

    print(f"\nTitle: {schema.get('info', {}).get('title', 'N/A')}")
    print(f"Version: {schema.get('info', {}).get('version', 'N/A')}")
    print(f"Exported: {datetime.now().isoformat()}")

    print(f"\nEndpoints: {len(paths)}")
    print(f"Tags: {len(tags)}")

    # Count methods
    method_counts = {}
    for path, methods in paths.items():
        for method in methods.keys():
            if method.upper() in ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']:
                method_counts[method.upper()] = method_counts.get(method.upper(), 0) + 1

    print("\nMethods:")
    for method, count in sorted(method_counts.items()):
        print(f"  {method}: {count}")

    print("\nTags:")
    for tag in tags:
        print(f"  - {tag.get('name', 'Unknown')}")

    # List servers
    servers = schema.get("servers", [])
    if servers:
        print("\nServers:")
        for server in servers:
            print(f"  - {server.get('url', 'N/A')} ({server.get('description', '')})")

    print("\n" + "=" * 60)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Export FetchText API OpenAPI specification"
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=None,
        help="Output file path (default: openapi.json in project root)"
    )
    parser.add_argument(
        "--minify",
        action="store_true",
        help="Minify JSON output (no pretty printing)"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress summary output"
    )

    args = parser.parse_args()

    # Export the schema
    output_path = args.output or Path(__file__).parent.parent / "openapi.json"
    schema = export_openapi(output_path, pretty=not args.minify)

    print(f"OpenAPI spec exported to: {output_path}")

    if not args.quiet:
        print_summary(schema)


if __name__ == "__main__":
    main()
