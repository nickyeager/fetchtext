#!/usr/bin/env python3
"""
Kill and Restart Local AI Services
Handles container conflicts and ensures proper networking between services.
"""

import subprocess
import time
import sys
import json
from typing import List, Dict

def run_command(cmd: str, check_output: bool = True) -> tuple:
    """Run a shell command and return (success, output)"""
    try:
        if check_output:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
        else:
            result = subprocess.run(cmd, shell=True)
            return result.returncode == 0, "", ""
    except Exception as e:
        return False, "", str(e)

def get_running_containers() -> List[Dict]:
    """Get list of running containers"""
    success, output, error = run_command('docker ps --format "{{.Names}},{{.Status}},{{.Ports}}"')
    
    containers = []
    if success and output:
        for line in output.split('\n'):
            if line.strip():
                parts = line.split(',')
                if len(parts) >= 2:
                    containers.append({
                        'name': parts[0],
                        'status': parts[1],
                        'ports': parts[2] if len(parts) > 2 else ""
                    })
    
    return containers

def get_all_containers() -> List[Dict]:
    """Get list of all containers (running and stopped)"""
    success, output, error = run_command('docker ps -a --format "{{.Names}},{{.Status}},{{.Ports}}"')
    
    containers = []
    if success and output:
        for line in output.split('\n'):
            if line.strip():
                parts = line.split(',')
                if len(parts) >= 2:
                    containers.append({
                        'name': parts[0],
                        'status': parts[1],
                        'ports': parts[2] if len(parts) > 2 else ""
                    })
    
    return containers

def kill_container(container_name: str) -> bool:
    """Kill a specific container"""
    print(f"🔴 Killing container: {container_name}")
    success, output, error = run_command(f'docker kill {container_name}')
    
    if success:
        print(f"   ✅ Killed {container_name}")
    else:
        print(f"   ⚠️  Failed to kill {container_name}: {error}")
    
    return success

def remove_container(container_name: str) -> bool:
    """Remove a specific container"""
    print(f"🗑️  Removing container: {container_name}")
    success, output, error = run_command(f'docker rm {container_name}')
    
    if success:
        print(f"   ✅ Removed {container_name}")
    else:
        print(f"   ⚠️  Failed to remove {container_name}: {error}")
    
    return success

def stop_compose_services() -> bool:
    """Stop all docker-compose services"""
    print("🛑 Stopping all docker-compose services...")
    success, output, error = run_command('docker compose down')
    
    if success:
        print("   ✅ Docker-compose services stopped")
    else:
        print(f"   ⚠️  Failed to stop services: {error}")
    
    return success

def check_networks() -> List[str]:
    """Check existing Docker networks"""
    success, output, error = run_command('docker network ls --format "{{.Name}}"')
    
    networks = []
    if success and output:
        networks = [name.strip() for name in output.split('\n') if name.strip()]
    
    return networks

def create_shared_network() -> bool:
    """Create a shared network for all services"""
    network_name = "local-ai-shared"
    
    # Check if network already exists
    success, output, error = run_command(f'docker network inspect {network_name}')
    
    if success:
        print(f"   ℹ️  Network {network_name} already exists")
        return True
    
    print(f"🌐 Creating shared network: {network_name}")
    success, output, error = run_command(f'docker network create {network_name}')
    
    if success:
        print(f"   ✅ Created network {network_name}")
    else:
        print(f"   ⚠️  Failed to create network: {error}")
    
    return success

def start_monitoring_services() -> bool:
    """Start monitoring services"""
    print("📊 Starting monitoring services...")
    success, output, error = run_command('cd monitoring && docker compose -f docker-compose.monitoring.yml up -d')
    
    if success:
        print("   ✅ Monitoring services started")
    else:
        print(f"   ⚠️  Failed to start monitoring: {error}")
    
    return success

def start_main_services() -> bool:
    """Start main local-ai services"""
    print("🚀 Starting main local-ai services...")
    success, output, error = run_command('docker compose up -d')
    
    if success:
        print("   ✅ Main services started")
    else:
        print(f"   ⚠️  Failed to start main services: {error}")
    
    return success

def wait_for_services(timeout: int = 300) -> bool:
    """Wait for services to be healthy"""
    print(f"⏳ Waiting for services to be healthy (timeout: {timeout}s)...")
    
    start_time = time.time()
    key_services = [
        'supabase-kong',
        'supabase-auth', 
        'dashboard',
        'supabase-db'
    ]
    
    while time.time() - start_time < timeout:
        running_containers = get_running_containers()
        running_names = [c['name'] for c in running_containers]
        
        healthy_services = 0
        for service in key_services:
            if service in running_names:
                # Check if service is actually responding
                if service == 'supabase-kong':
                    success, _, _ = run_command('curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health')
                    if success:
                        healthy_services += 1
                elif service == 'dashboard':
                    success, _, _ = run_command('curl -s -o /dev/null -w "%{http_code}" http://localhost:5174/health')
                    if success:
                        healthy_services += 1
                else:
                    healthy_services += 1
        
        print(f"   📈 {healthy_services}/{len(key_services)} key services healthy")
        
        if healthy_services == len(key_services):
            print("   ✅ All key services are healthy!")
            return True
        
        time.sleep(10)
    
    print(f"   ⚠️  Timeout waiting for services")
    return False

def main():
    print("🔧 Local AI Services Restart Script")
    print("=" * 50)
    
    # Step 1: Show current state
    print("\n1️⃣ Checking current container state...")
    containers = get_all_containers()
    print(f"   Found {len(containers)} containers:")
    for container in containers[:10]:  # Show first 10
        print(f"     • {container['name']}: {container['status']}")
    
    # Step 2: Stop all services cleanly
    print("\n2️⃣ Stopping all services...")
    stop_compose_services()
    
    # Give services time to stop gracefully
    time.sleep(5)
    
    # Step 3: Force kill any remaining containers
    print("\n3️⃣ Force killing any remaining containers...")
    remaining = get_running_containers()
    
    problem_containers = [
        'qdrant', 'supabase-kong', 'supabase-auth', 
        'dashboard', 'supabase-db'
    ]
    
    for container in remaining:
        if any(prob in container['name'] for prob in problem_containers):
            kill_container(container['name'])
            time.sleep(2)
            remove_container(container['name'])
    
    # Step 4: Clean up networks
    print("\n4️⃣ Setting up networking...")
    networks = check_networks()
    print(f"   Existing networks: {', '.join(networks)}")
    
    # Step 5: Start monitoring services first
    print("\n5️⃣ Starting monitoring services...")
    if start_monitoring_services():
        time.sleep(10)  # Let monitoring start first
    
    # Step 6: Start main services
    print("\n6️⃣ Starting main services...")
    if start_main_services():
        # Step 7: Wait for services to be healthy
        print("\n7️⃣ Waiting for services...")
        if wait_for_services():
            print("\n✅ All services started successfully!")
            
            # Show final status
            print("\n📊 Final Status:")
            final_containers = get_running_containers()
            for container in final_containers:
                print(f"   • {container['name']}: {container['status']}")
                
            print("\n🌐 Service URLs:")
            print("   • Supabase: http://localhost:8000")
            print("   • Admin Dashboard: http://localhost:5174")
            print("   • N8N: http://localhost:5678") 
            print("   • Open WebUI: http://localhost:8002")
            print("   • Grafana: http://localhost:3002")
            
        else:
            print("\n⚠️  Some services may not be fully ready. Check logs:")
            print("   docker logs supabase-kong")
            print("   docker logs dashboard")
    else:
        print("\n❌ Failed to start main services")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 