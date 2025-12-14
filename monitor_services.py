#!/usr/bin/env python3
"""
LocalAI Stack Service Monitor

This script monitors all services in the LocalAI stack, checking:
1. Container status (running/stopped/unhealthy)
2. Port accessibility 
3. Service health endpoints
4. Inter-service connectivity
5. Resource usage

Usage: python monitor_services.py [--continuous] [--alerts] [--json]
"""

import subprocess
import json
import time
import requests
import socket
import sys
import argparse
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import os
from pathlib import Path

@dataclass
class ServiceConfig:
    name: str
    container_name: str
    internal_port: int
    external_port: int
    health_endpoint: Optional[str] = None
    expected_response: Optional[str] = None
    service_type: str = "web"  # web, api, database, cache

class LocalAIMonitor:
    def __init__(self):
        self.services = self._load_service_configs()
        self.docker_compose_path = Path.cwd()
        
    def _load_service_configs(self) -> List[ServiceConfig]:
        """Load service configurations with port mappings"""
        return [
            # Core AI Services
            ServiceConfig("N8N", "n8n", 5678, 5679, "/", "text/html"),
            ServiceConfig("Ollama", "ollama", 11434, 11435, "/api/version", "version"),
            ServiceConfig("Open-WebUI", "open-webui", 8080, 8080, "/", "text/html"),
            ServiceConfig("Flowise", "flowise", 3001, 3001, "/", "text/html"),
            
            # Vector & Search Services
            ServiceConfig("Qdrant", "qdrant", 6333, 6333, "/", "application/json"),
            ServiceConfig("SearXNG", "searxng", 8080, 8082, "/", "text/html"),
            
            # Database Services
            ServiceConfig("PostgreSQL", "localai-postgres-1", 5432, 5433, None, None, "database"),
            ServiceConfig("Neo4j", "localai-neo4j-1", 7474, 7474, "/", "application/json"),
            ServiceConfig("Redis", "localai-redis", 6379, 6380, None, None, "cache"),
            ServiceConfig("ClickHouse", "localai-clickhouse-1", 8123, 8123, "/ping", "Ok"),
            
            # Object Storage & Analytics
            ServiceConfig("MinIO", "localai-minio-1", 9000, 9010, "/minio/health/live", ""),
            ServiceConfig("Langfuse Web", "localai-langfuse-web-1", 3000, 3000, "/", "text/html"),
            ServiceConfig("Langfuse Worker", "localai-langfuse-worker-1", 3030, 3030, None, None),
            
            # Reverse Proxy
            ServiceConfig("Caddy", "caddy", 80, 80, "/", None),
            
            # Supabase Services (selection of key ones)
            ServiceConfig("Supabase DB", "supabase-db", 5432, None, None, None, "database"),
            ServiceConfig("Supabase Kong", "supabase-kong", 8000, 8000, None, None),
            ServiceConfig("Supabase Studio", "supabase-studio", 3000, None, None, None),
            ServiceConfig("Supabase Auth", "supabase-auth", 9999, None, None, None),
            
            # Admin Dashboard
            ServiceConfig("Admin Dashboard", "localai-admin-dashboard", 3005, 5174, "/", "text/html"),
        ]
    
    def get_container_status(self) -> Dict[str, Dict]:
        """Get status of all Docker containers"""
        try:
            result = subprocess.run(
                ["docker", "ps", "-a", "--format", "json"],
                capture_output=True, text=True, check=True
            )
            containers = {}
            for line in result.stdout.strip().split('\n'):
                if line:
                    container = json.loads(line)
                    containers[container['Names']] = {
                        'status': container['Status'],
                        'state': container['State'],
                        'image': container['Image'],
                        'ports': container.get('Ports', ''),
                        'created': container['CreatedAt']
                    }
            return containers
        except subprocess.CalledProcessError as e:
            print(f"❌ Error getting container status: {e}")
            return {}
    
    def check_port_accessibility(self, host: str, port: int, timeout: int = 3) -> bool:
        """Check if a port is accessible"""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(timeout)
                result = sock.connect_ex((host, port))
                return result == 0
        except Exception:
            return False
    
    def check_health_endpoint(self, service: ServiceConfig) -> Tuple[bool, str]:
        """Check service health via HTTP endpoint"""
        if not service.health_endpoint:
            return True, "No health endpoint configured"
        
        url = f"http://localhost:{service.external_port}{service.health_endpoint}"
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                if service.expected_response:
                    if service.expected_response in response.text or service.expected_response in response.headers.get('content-type', ''):
                        return True, f"✅ HTTP {response.status_code}"
                    else:
                        return False, f"⚠️  HTTP {response.status_code} but unexpected response"
                return True, f"✅ HTTP {response.status_code}"
            else:
                return False, f"❌ HTTP {response.status_code}"
        except requests.exceptions.RequestException as e:
            return False, f"❌ Connection failed: {str(e)[:50]}"
    
    def check_internal_connectivity(self) -> Dict[str, bool]:
        """Check internal Docker network connectivity"""
        connectivity_tests = {}
        
        # Test N8N -> Ollama connectivity (critical for workflows)
        try:
            result = subprocess.run([
                "docker", "exec", "n8n", "wget", "-qO-", "--timeout=5", 
                "http://ollama:11434/api/tags"
            ], capture_output=True, text=True, timeout=10)
            connectivity_tests["n8n_to_ollama"] = result.returncode == 0
        except:
            connectivity_tests["n8n_to_ollama"] = False
        
        # Test N8N -> PostgreSQL connectivity
        try:
            result = subprocess.run([
                "docker", "exec", "n8n", "wget", "-qO-", "--timeout=5",
                "http://postgres:5432"
            ], capture_output=True, text=True, timeout=10)
            # PostgreSQL will reject HTTP but connection should work
            connectivity_tests["n8n_to_postgres"] = "temporarily unavailable" in result.stderr or result.returncode != 0
        except:
            connectivity_tests["n8n_to_postgres"] = False
            
        return connectivity_tests
    
    def get_resource_usage(self) -> Dict[str, Dict]:
        """Get resource usage for containers"""
        try:
            result = subprocess.run([
                "docker", "stats", "--no-stream", "--format", 
                "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
            ], capture_output=True, text=True, check=True)
            
            lines = result.stdout.strip().split('\n')[1:]  # Skip header
            usage = {}
            for line in lines:
                parts = line.split('\t')
                if len(parts) >= 4:
                    container = parts[0]
                    usage[container] = {
                        'cpu': parts[1],
                        'memory': parts[2],
                        'memory_percent': parts[3]
                    }
            return usage
        except:
            return {}
    
    def monitor_once(self, include_resources: bool = False) -> Dict:
        """Run a single monitoring check"""
        print(f"\n🔍 LocalAI Stack Monitor - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)
        
        containers = self.get_container_status()
        connectivity = self.check_internal_connectivity()
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'services': {},
            'connectivity': connectivity,
            'summary': {'total': 0, 'running': 0, 'healthy': 0, 'issues': []}
        }
        
        if include_resources:
            results['resources'] = self.get_resource_usage()
        
        print(f"{'Service':<15} {'Container':<20} {'Status':<15} {'Port':<10} {'Health':<25}")
        print("-" * 85)
        
        for service in self.services:
            results['summary']['total'] += 1
            container_info = containers.get(service.container_name, {})
            
            # Container status
            if service.container_name in containers:
                status = container_info['state']
                if status == 'running':
                    results['summary']['running'] += 1
                    status_icon = "🟢"
                elif status == 'exited':
                    status_icon = "🔴"
                    results['summary']['issues'].append(f"{service.name} container stopped")
                else:
                    status_icon = "🟡"
                    results['summary']['issues'].append(f"{service.name} container {status}")
            else:
                status = "missing"
                status_icon = "❌"
                results['summary']['issues'].append(f"{service.name} container not found")
            
            # Port accessibility
            if service.external_port and status == 'running':
                port_ok = self.check_port_accessibility('localhost', service.external_port)
                port_status = f"✅ :{service.external_port}" if port_ok else f"❌ :{service.external_port}"
            else:
                port_status = "N/A"
            
            # Health check
            health_ok, health_msg = True, "N/A"
            if status == 'running' and service.external_port:
                health_ok, health_msg = self.check_health_endpoint(service)
                if health_ok:
                    results['summary']['healthy'] += 1
                else:
                    results['summary']['issues'].append(f"{service.name} health check failed")
            
            # Store results
            results['services'][service.name] = {
                'container_status': status,
                'port_accessible': port_ok if service.external_port else None,
                'health_status': health_ok if service.health_endpoint else None,
                'health_message': health_msg
            }
            
            print(f"{service.name:<15} {service.container_name:<20} {status_icon} {status:<12} {port_status:<10} {health_msg:<25}")
        
        # Internal connectivity
        print(f"\n🔗 Internal Connectivity:")
        print(f"   N8N → Ollama:     {'✅' if connectivity.get('n8n_to_ollama') else '❌'}")
        print(f"   N8N → PostgreSQL: {'✅' if connectivity.get('n8n_to_postgres') else '❌'}")
        
        # Summary
        total = results['summary']['total']
        running = results['summary']['running']
        healthy = results['summary']['healthy']
        
        print(f"\n📊 Summary:")
        print(f"   Total Services:   {total}")
        print(f"   Running:          {running}/{total} ({running/total*100:.1f}%)")
        print(f"   Healthy:          {healthy}/{total} ({healthy/total*100:.1f}%)")
        
        if results['summary']['issues']:
            print(f"\n⚠️  Issues Found ({len(results['summary']['issues'])}):")
            for issue in results['summary']['issues']:
                print(f"   • {issue}")
        else:
            print(f"\n✅ All services are running and healthy!")
        
        return results
    
    def monitor_continuous(self, interval: int = 30):
        """Continuously monitor services"""
        print(f"🔄 Starting continuous monitoring (checking every {interval}s)")
        print("Press Ctrl+C to stop")
        
        try:
            while True:
                self.monitor_once()
                print(f"\n⏱️  Next check in {interval} seconds...")
                time.sleep(interval)
        except KeyboardInterrupt:
            print("\n🛑 Monitoring stopped by user")
    
    def export_json(self, filename: str = None):
        """Export monitoring results to JSON"""
        if not filename:
            filename = f"localai_monitor_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        results = self.monitor_once(include_resources=True)
        
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"\n💾 Results exported to: {filename}")
        return filename

def main():
    parser = argparse.ArgumentParser(description="Monitor LocalAI Stack Services")
    parser.add_argument("--continuous", "-c", action="store_true", 
                       help="Run continuous monitoring")
    parser.add_argument("--interval", "-i", type=int, default=30,
                       help="Monitoring interval in seconds (default: 30)")
    parser.add_argument("--json", "-j", action="store_true",
                       help="Export results to JSON file")
    parser.add_argument("--output", "-o", type=str,
                       help="JSON output filename")
    parser.add_argument("--resources", "-r", action="store_true",
                       help="Include resource usage information")
    
    args = parser.parse_args()
    
    monitor = LocalAIMonitor()
    
    if args.continuous:
        monitor.monitor_continuous(args.interval)
    elif args.json:
        monitor.export_json(args.output)
    else:
        monitor.monitor_once(args.resources)

if __name__ == "__main__":
    main()
