#!/usr/bin/env python3
"""
LocalAI Stack Container Resource Monitor
Real-time monitoring of Docker container resources, performance metrics, and health status.
"""

import docker
import psutil
import time
import json
import sys
import argparse
from datetime import datetime, timedelta
from collections import defaultdict, deque
import threading
import signal
import os

class ContainerMonitor:
    def __init__(self, refresh_interval=5, history_size=100):
        self.client = docker.from_env()
        self.refresh_interval = refresh_interval
        self.history_size = history_size
        self.running = True
        self.metrics_history = defaultdict(lambda: deque(maxlen=history_size))
        
        # Expected containers for LocalAI stack
        self.expected_containers = {
            'n8n': {'ports': [5679], 'health_endpoint': 'http://localhost:5679'},
            'ollama': {'ports': [11435], 'health_endpoint': 'http://localhost:11435/api/tags'},
            'open-webui': {'ports': [8080], 'health_endpoint': 'http://localhost:8080'},
            'flowise': {'ports': [3001], 'health_endpoint': 'http://localhost:3001'},
            'qdrant': {'ports': [6333, 6334], 'health_endpoint': 'http://localhost:6333'},
            'localai-redis': {'ports': [6380], 'health_endpoint': None},
            'searxng': {'ports': [8082], 'health_endpoint': 'http://localhost:8082'},
            'caddy': {'ports': [80, 443], 'health_endpoint': 'http://localhost:80'},
            'localai-neo4j-1': {'ports': [7474, 7687], 'health_endpoint': 'http://localhost:7474'},
            'localai-postgres-1': {'ports': [5433], 'health_endpoint': None},
            'localai-clickhouse-1': {'ports': [8123, 9100, 9009], 'health_endpoint': 'http://localhost:8123/ping'},
            'localai-minio-1': {'ports': [9010, 9011], 'health_endpoint': 'http://localhost:9011'},
            'localai-langfuse-web-1': {'ports': [3000], 'health_endpoint': 'http://localhost:3000'},
            'localai-langfuse-worker-1': {'ports': [3030], 'health_endpoint': None},
            # Supabase containers
            'supabase-db': {'ports': [], 'health_endpoint': None},
            'supabase-studio': {'ports': [], 'health_endpoint': None},
            'supabase-kong': {'ports': [8000, 8443], 'health_endpoint': 'http://localhost:8000'},
            'supabase-auth': {'ports': [], 'health_endpoint': None},
            'supabase-rest': {'ports': [], 'health_endpoint': None},
            'supabase-storage': {'ports': [], 'health_endpoint': None},
            'supabase-imgproxy': {'ports': [], 'health_endpoint': None},
            'supabase-meta': {'ports': [], 'health_endpoint': None},
            'supabase-pooler': {'ports': [5432, 6543], 'health_endpoint': None},
            'supabase-edge-functions': {'ports': [], 'health_endpoint': None},
            'supabase-analytics': {'ports': [4000], 'health_endpoint': None},
            'supabase-vector': {'ports': [], 'health_endpoint': None},
            'realtime-dev.supabase-realtime': {'ports': [], 'health_endpoint': None},
        }
        
        # Resource thresholds for alerts
        self.thresholds = {
            'cpu_warning': 80.0,
            'cpu_critical': 95.0,
            'memory_warning': 80.0,
            'memory_critical': 95.0,
            'disk_warning': 80.0,
            'disk_critical': 95.0
        }
        
    def signal_handler(self, signum, frame):
        print("\n🛑 Monitoring stopped by user")
        self.running = False
        
    def get_container_stats(self, container):
        """Get comprehensive stats for a container"""
        try:
            stats = container.stats(stream=False)
            
            # Calculate CPU percentage
            cpu_stats = stats['cpu_stats']
            precpu_stats = stats['precpu_stats']
            
            cpu_delta = cpu_stats['cpu_usage']['total_usage'] - precpu_stats['cpu_usage']['total_usage']
            system_cpu_delta = cpu_stats['system_cpu_usage'] - precpu_stats['system_cpu_usage']
            number_cpus = len(cpu_stats['cpu_usage']['percpu_usage'])
            
            cpu_percent = 0.0
            if system_cpu_delta > 0 and cpu_delta > 0:
                cpu_percent = (cpu_delta / system_cpu_delta) * number_cpus * 100.0
            
            # Calculate memory usage
            memory_stats = stats['memory_stats']
            memory_usage = memory_stats.get('usage', 0)
            memory_limit = memory_stats.get('limit', 1)
            memory_percent = (memory_usage / memory_limit) * 100.0
            
            # Network I/O
            network_rx = 0
            network_tx = 0
            if 'networks' in stats:
                for interface, net_stats in stats['networks'].items():
                    network_rx += net_stats['rx_bytes']
                    network_tx += net_stats['tx_bytes']
            
            # Block I/O
            block_read = 0
            block_write = 0
            if 'blkio_stats' in stats and 'io_service_bytes_recursive' in stats['blkio_stats']:
                for entry in stats['blkio_stats']['io_service_bytes_recursive']:
                    if entry['op'] == 'Read':
                        block_read += entry['value']
                    elif entry['op'] == 'Write':
                        block_write += entry['value']
            
            return {
                'timestamp': datetime.now(),
                'cpu_percent': round(cpu_percent, 2),
                'memory_usage_mb': round(memory_usage / 1024 / 1024, 2),
                'memory_limit_mb': round(memory_limit / 1024 / 1024, 2),
                'memory_percent': round(memory_percent, 2),
                'network_rx_mb': round(network_rx / 1024 / 1024, 2),
                'network_tx_mb': round(network_tx / 1024 / 1024, 2),
                'block_read_mb': round(block_read / 1024 / 1024, 2),
                'block_write_mb': round(block_write / 1024 / 1024, 2),
                'pids': stats.get('pids_stats', {}).get('current', 0)
            }
            
        except Exception as e:
            return {'error': str(e), 'timestamp': datetime.now()}
    
    def get_container_health(self, container):
        """Get container health status"""
        try:
            container.reload()
            status = container.status
            health = container.attrs.get('State', {}).get('Health', {})
            
            return {
                'status': status,
                'health_status': health.get('Status', 'unknown'),
                'restart_count': container.attrs['RestartCount'],
                'started_at': container.attrs['State']['StartedAt'],
                'finished_at': container.attrs['State'].get('FinishedAt', ''),
                'exit_code': container.attrs['State'].get('ExitCode', 0)
            }
        except Exception as e:
            return {'error': str(e)}
    
    def check_port_connectivity(self, ports):
        """Check if ports are accessible"""
        import socket
        accessible_ports = []
        
        for port in ports:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex(('127.0.0.1', port))
                sock.close()
                if result == 0:
                    accessible_ports.append(port)
            except:
                pass
                
        return accessible_ports
    
    def format_bytes(self, bytes_value):
        """Format bytes in human readable format"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes_value < 1024.0:
                return f"{bytes_value:.1f}{unit}"
            bytes_value /= 1024.0
        return f"{bytes_value:.1f}PB"
    
    def get_system_info(self):
        """Get system-wide resource information"""
        return {
            'cpu_percent': psutil.cpu_percent(interval=1),
            'memory': psutil.virtual_memory(),
            'disk': psutil.disk_usage('/'),
            'load_avg': os.getloadavg() if hasattr(os, 'getloadavg') else (0, 0, 0)
        }
    
    def print_header(self):
        """Print monitoring header"""
        print("=" * 120)
        print("🔍 LocalAI Stack Container Monitor")
        print(f"📅 Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🔄 Refresh interval: {self.refresh_interval} seconds")
        print("=" * 120)
    
    def print_system_info(self, system_info):
        """Print system-wide information"""
        memory = system_info['memory']
        disk = system_info['disk']
        
        print(f"\n🖥️  SYSTEM OVERVIEW")
        print(f"   CPU: {system_info['cpu_percent']:.1f}% | "
              f"Memory: {memory.percent:.1f}% ({self.format_bytes(memory.used)}/{self.format_bytes(memory.total)}) | "
              f"Disk: {disk.percent:.1f}% ({self.format_bytes(disk.used)}/{self.format_bytes(disk.total)}) | "
              f"Load: {system_info['load_avg'][0]:.2f}")
    
    def print_container_info(self, container, stats, health, ports_status):
        """Print detailed container information"""
        name = container.name
        
        # Status indicators
        status_emoji = "🟢" if health['status'] == 'running' else "🔴"
        health_emoji = "💚" if health.get('health_status') == 'healthy' else "❤️" if health.get('health_status') == 'unhealthy' else "💛"
        
        # Resource status
        cpu_emoji = "🔥" if stats.get('cpu_percent', 0) > self.thresholds['cpu_critical'] else "⚠️" if stats.get('cpu_percent', 0) > self.thresholds['cpu_warning'] else "✅"
        mem_emoji = "🔥" if stats.get('memory_percent', 0) > self.thresholds['memory_critical'] else "⚠️" if stats.get('memory_percent', 0) > self.thresholds['memory_warning'] else "✅"
        
        # Port status
        expected_ports = self.expected_containers.get(name, {}).get('ports', [])
        port_emoji = "🟢" if len(ports_status) == len(expected_ports) and len(expected_ports) > 0 else "🟡" if len(ports_status) > 0 else "🔴"
        
        print(f"\n{status_emoji} {name}")
        print(f"   Status: {health['status']} {health_emoji} | Restarts: {health.get('restart_count', 0)}")
        
        if 'error' not in stats:
            print(f"   {cpu_emoji} CPU: {stats['cpu_percent']}% | "
                  f"{mem_emoji} Memory: {stats['memory_percent']:.1f}% ({stats['memory_usage_mb']:.1f}MB) | "
                  f"PIDs: {stats['pids']}")
            print(f"   📊 Network: ↓{stats['network_rx_mb']:.1f}MB ↑{stats['network_tx_mb']:.1f}MB | "
                  f"Disk: R{stats['block_read_mb']:.1f}MB W{stats['block_write_mb']:.1f}MB")
        
        if expected_ports:
            ports_str = f"{port_emoji} Ports: {'/'.join(map(str, ports_status))} (expected: {'/'.join(map(str, expected_ports))})"
            print(f"   {ports_str}")
    
    def generate_alerts(self, container, stats, health):
        """Generate alerts based on thresholds"""
        alerts = []
        name = container.name
        
        if health['status'] != 'running':
            alerts.append(f"🚨 CRITICAL: {name} is not running (status: {health['status']})")
        
        if health.get('health_status') == 'unhealthy':
            alerts.append(f"🚨 CRITICAL: {name} health check failing")
        
        if 'error' not in stats:
            if stats['cpu_percent'] > self.thresholds['cpu_critical']:
                alerts.append(f"🔥 CRITICAL: {name} CPU usage critical ({stats['cpu_percent']}%)")
            elif stats['cpu_percent'] > self.thresholds['cpu_warning']:
                alerts.append(f"⚠️ WARNING: {name} CPU usage high ({stats['cpu_percent']}%)")
            
            if stats['memory_percent'] > self.thresholds['memory_critical']:
                alerts.append(f"🔥 CRITICAL: {name} memory usage critical ({stats['memory_percent']:.1f}%)")
            elif stats['memory_percent'] > self.thresholds['memory_warning']:
                alerts.append(f"⚠️ WARNING: {name} memory usage high ({stats['memory_percent']:.1f}%)")
        
        return alerts
    
    def save_metrics_to_file(self, filename="monitoring/metrics.json"):
        """Save current metrics to file"""
        try:
            os.makedirs(os.path.dirname(filename), exist_ok=True)
            metrics_data = {
                'timestamp': datetime.now().isoformat(),
                'containers': {}
            }
            
            for container_name, history in self.metrics_history.items():
                if history:
                    latest = history[-1]
                    # Convert datetime to string for JSON serialization
                    if 'timestamp' in latest:
                        latest['timestamp'] = latest['timestamp'].isoformat()
                    metrics_data['containers'][container_name] = latest
            
            with open(filename, 'w') as f:
                json.dump(metrics_data, f, indent=2)
                
        except Exception as e:
            print(f"Error saving metrics: {e}")
    
    def monitor(self, save_metrics=False, show_alerts=True):
        """Main monitoring loop"""
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        self.print_header()
        
        while self.running:
            try:
                # Clear screen for real-time display
                os.system('clear' if os.name == 'posix' else 'cls')
                self.print_header()
                
                # Get system information
                system_info = self.get_system_info()
                self.print_system_info(system_info)
                
                # Get all containers
                containers = self.client.containers.list(all=True)
                
                # Filter LocalAI stack containers
                localai_containers = [c for c in containers if any(name in c.name for name in self.expected_containers.keys())]
                
                all_alerts = []
                
                for container in sorted(localai_containers, key=lambda x: x.name):
                    stats = self.get_container_stats(container)
                    health = self.get_container_health(container)
                    
                    # Check port connectivity
                    expected_ports = self.expected_containers.get(container.name, {}).get('ports', [])
                    accessible_ports = self.check_port_connectivity(expected_ports)
                    
                    self.print_container_info(container, stats, health, accessible_ports)
                    
                    # Store metrics in history
                    if 'error' not in stats:
                        self.metrics_history[container.name].append(stats)
                    
                    # Generate alerts
                    if show_alerts:
                        alerts = self.generate_alerts(container, stats, health)
                        all_alerts.extend(alerts)
                
                # Print alerts
                if all_alerts:
                    print(f"\n🚨 ALERTS ({len(all_alerts)})")
                    for alert in all_alerts:
                        print(f"   {alert}")
                
                # Show summary
                running_count = len([c for c in localai_containers if c.status == 'running'])
                total_count = len(localai_containers)
                
                print(f"\n📊 SUMMARY: {running_count}/{total_count} containers running | "
                      f"{len(all_alerts)} alerts | "
                      f"Last updated: {datetime.now().strftime('%H:%M:%S')}")
                
                print(f"\n💡 Press Ctrl+C to stop monitoring")
                
                # Save metrics if requested
                if save_metrics:
                    self.save_metrics_to_file()
                
                time.sleep(self.refresh_interval)
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"Monitoring error: {e}")
                time.sleep(self.refresh_interval)
        
        print("\n👋 Monitoring stopped")

def main():
    parser = argparse.ArgumentParser(description='LocalAI Stack Container Monitor')
    parser.add_argument('--interval', '-i', type=int, default=5, help='Refresh interval in seconds (default: 5)')
    parser.add_argument('--save-metrics', '-s', action='store_true', help='Save metrics to file')
    parser.add_argument('--no-alerts', action='store_true', help='Disable alert generation')
    parser.add_argument('--history-size', type=int, default=100, help='Number of historical data points to keep')
    
    args = parser.parse_args()
    
    monitor = ContainerMonitor(
        refresh_interval=args.interval,
        history_size=args.history_size
    )
    
    monitor.monitor(
        save_metrics=args.save_metrics,
        show_alerts=not args.no_alerts
    )

if __name__ == '__main__':
    main()
