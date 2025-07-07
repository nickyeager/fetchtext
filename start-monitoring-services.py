#!/usr/bin/env python3
"""
LocalAI Monitoring Services Startup Script
Based on analysis of the monitoring folder structure and compose files.
"""

import subprocess
import time
import os
import sys
from pathlib import Path

def run_command(cmd, check_output=True, timeout=30):
    """Run a command and return success status and output"""
    try:
        if check_output:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
            return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
        else:
            result = subprocess.run(cmd, shell=True, timeout=timeout)
            return result.returncode == 0, "", ""
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out"
    except Exception as e:
        return False, "", str(e)

def check_docker_running():
    """Check if Docker is running"""
    success, _, _ = run_command("docker info", timeout=10)
    return success

def check_existing_containers():
    """Check for existing monitoring containers"""
    success, output, _ = run_command("docker ps -a --format '{{.Names}}' | grep localai")
    
    if success and output:
        containers = output.split('\n')
        monitoring_containers = [c for c in containers if any(mon in c for mon in 
            ['prometheus', 'grafana', 'cadvisor', 'node-exporter', 'alertmanager', 'loki', 'promtail'])]
        return monitoring_containers
    return []

def stop_monitoring_containers():
    """Stop and remove existing monitoring containers"""
    containers = check_existing_containers()
    
    if containers:
        print(f"🛑 Found {len(containers)} existing monitoring containers")
        for container in containers:
            print(f"   Stopping: {container}")
            run_command(f"docker stop {container}", timeout=10)
            run_command(f"docker rm {container}", timeout=10)
        print("   ✅ Cleaned up existing monitoring containers")
    else:
        print("   ℹ️  No existing monitoring containers found")

def start_optimized_monitoring():
    """Start the optimized monitoring stack"""
    print("🚀 Starting Optimized Monitoring Stack...")
    
    os.chdir("monitoring")
    
    # Create necessary directories if they don't exist
    directories = ["logs", "metrics", "dashboards", "alerts"]
    for dir_name in directories:
        Path(dir_name).mkdir(exist_ok=True)
    
    # Start the optimized monitoring stack
    success, output, error = run_command(
        "docker compose -f docker-compose.optimized.yml up -d", 
        timeout=120
    )
    
    if success:
        print("   ✅ Optimized monitoring stack started successfully")
    else:
        print(f"   ❌ Failed to start monitoring stack: {error}")
        print(f"   Output: {output}")
        return False
    
    os.chdir("..")
    return True

def start_standalone_monitoring():
    """Start standalone monitoring services without docker-compose"""
    print("🏃 Starting Standalone Monitoring Services...")
    
    # Start Prometheus
    print("   Starting Prometheus...")
    success, _, error = run_command("""
        docker run -d --name localai-prometheus \\
            --restart unless-stopped \\
            -p 9090:9090 \\
            -v $(pwd)/monitoring/metrics/prometheus.yml:/etc/prometheus/prometheus.yml \\
            -v prometheus_data:/prometheus \\
            prom/prometheus:latest \\
            --config.file=/etc/prometheus/prometheus.yml \\
            --storage.tsdb.path=/prometheus \\
            --web.enable-lifecycle
    """, timeout=60)
    
    if not success:
        print(f"      ⚠️ Prometheus failed: {error}")
    
    time.sleep(5)
    
    # Start Grafana
    print("   Starting Grafana...")
    success, _, error = run_command("""
        docker run -d --name localai-grafana \\
            --restart unless-stopped \\
            -p 3002:3000 \\
            -e GF_SECURITY_ADMIN_PASSWORD=admin123 \\
            -v grafana_data:/var/lib/grafana \\
            grafana/grafana:latest
    """, timeout=60)
    
    if not success:
        print(f"      ⚠️ Grafana failed: {error}")
    
    time.sleep(5)
    
    # Start cAdvisor
    print("   Starting cAdvisor...")
    success, _, error = run_command("""
        docker run -d --name localai-cadvisor \\
            --restart unless-stopped \\
            -p 8084:8080 \\
            --privileged \\
            -v /:/rootfs:ro \\
            -v /var/run:/var/run:rw \\
            -v /sys:/sys:ro \\
            -v /var/lib/docker/:/var/lib/docker:ro \\
            -v /dev/kmsg:/dev/kmsg \\
            gcr.io/cadvisor/cadvisor:latest
    """, timeout=60)
    
    if not success:
        print(f"      ⚠️ cAdvisor failed: {error}")
    
    print("   ✅ Standalone monitoring services started")
    return True

def start_python_health_dashboard():
    """Start the Python health dashboard"""
    print("📊 Starting Python Health Dashboard...")
    
    # Check if we can start the health dashboard
    dashboard_path = Path("monitoring/health_dashboard.py")
    if dashboard_path.exists():
        print("   Starting health dashboard on port 8888...")
        # Run in background
        success, _, error = run_command(
            "cd monitoring && python3 health_dashboard.py --port 8888 &",
            timeout=10
        )
        
        if success:
            print("   ✅ Health dashboard started on http://localhost:8888")
        else:
            print(f"   ⚠️ Health dashboard failed: {error}")
    else:
        print("   ❌ Health dashboard not found")

def start_service_monitor():
    """Start the service monitoring script"""
    print("🔍 Starting Service Monitor...")
    
    monitor_path = Path("monitoring/scripts/monitor_services.py")
    if monitor_path.exists():
        print("   Running initial service check...")
        success, output, error = run_command(
            "cd monitoring/scripts && python3 monitor_services.py",
            timeout=30
        )
        
        if success:
            print("   ✅ Service monitor completed initial check")
            print(f"      Output preview: {output[:200]}...")
        else:
            print(f"   ⚠️ Service monitor failed: {error}")
    else:
        print("   ❌ Service monitor script not found")

def wait_for_services():
    """Wait for monitoring services to be ready"""
    print("⏳ Waiting for monitoring services to be ready...")
    
    services_to_check = [
        ("Prometheus", "http://localhost:9090/-/ready"),
        ("Grafana", "http://localhost:3002/api/health"),
        ("cAdvisor", "http://localhost:8084/healthz")
    ]
    
    for service_name, url in services_to_check:
        for attempt in range(10):  # Try for ~30 seconds
            success, _, _ = run_command(f"curl -s {url}", timeout=5)
            if success:
                print(f"   ✅ {service_name} is ready")
                break
            time.sleep(3)
        else:
            print(f"   ⚠️ {service_name} not responding after 30 seconds")

def show_monitoring_urls():
    """Show URLs for monitoring services"""
    print("\n🌐 Monitoring Service URLs:")
    print("=" * 50)
    print("   📊 Prometheus:      http://localhost:9090")
    print("   📈 Grafana:         http://localhost:3002")
    print("      └─ User: admin, Pass: admin123")
    print("   🐳 cAdvisor:        http://localhost:8084")
    print("   📋 Health Dashboard: http://localhost:8888")
    print("   🔍 Portainer:       http://localhost:9000")
    print("   ⏰ Uptime Kuma:     http://localhost:3003")
    print("\n💡 Tips:")
    print("   • Check monitoring/scripts/monitor_services.py for service health")
    print("   • Use 'docker logs localai-<service>' to troubleshoot issues")
    print("   • Monitoring data is persisted in Docker volumes")

def main():
    print("🔧 LocalAI Monitoring Services Startup")
    print("=" * 50)
    
    # Step 1: Check Docker
    if not check_docker_running():
        print("❌ Docker is not running. Please start Docker first.")
        return 1
    
    print("✅ Docker is running")
    
    # Step 2: Clean up existing containers
    print("\n🧹 Cleaning up existing monitoring containers...")
    stop_monitoring_containers()
    
    # Step 3: Try optimized monitoring first
    print("\n📊 Starting monitoring services...")
    
    # Check if optimized compose file exists
    optimized_compose = Path("monitoring/docker-compose.optimized.yml")
    if optimized_compose.exists():
        print("   Found optimized monitoring compose file")
        success = start_optimized_monitoring()
        
        if not success:
            print("   Optimized startup failed, trying standalone...")
            success = start_standalone_monitoring()
    else:
        print("   Optimized compose not found, starting standalone...")
        success = start_standalone_monitoring()
    
    if not success:
        print("❌ Failed to start monitoring services")
        return 1
    
    # Step 4: Wait for services
    wait_for_services()
    
    # Step 5: Start additional monitoring tools
    start_python_health_dashboard()
    start_service_monitor()
    
    # Step 6: Show URLs
    show_monitoring_urls()
    
    print("\n✅ Monitoring services are ready!")
    print("🎯 The monitoring stack will help you:")
    print("   • Track container health and performance")
    print("   • Monitor authentication issues between services")
    print("   • Visualize system metrics and alerts")
    print("   • Debug network connectivity problems")
    
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n🛑 Startup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1) 