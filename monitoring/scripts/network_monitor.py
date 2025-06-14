#!/usr/bin/env python3
"""
LocalAI Stack Network Monitor
Monitor Docker network connectivity, latency, and inter-service communication.
"""

import subprocess
import socket
import time
import json
import asyncio
import aiohttp
import docker
from datetime import datetime
from typing import Dict, List, Tuple
import ping3
import psutil
import threading
from collections import defaultdict

class NetworkMonitor:
    def __init__(self):
        self.client = docker.from_env()
        self.networks = {}
        self.connectivity_matrix = defaultdict(dict)
        self.latency_history = defaultdict(list)
        
        # Service endpoints for testing
        self.service_endpoints = {
            'n8n': {'host': 'localhost', 'port': 5679, 'path': '/'},
            'ollama': {'host': 'localhost', 'port': 11435, 'path': '/api/version'},
            'open-webui': {'host': 'localhost', 'port': 8080, 'path': '/'},
            'flowise': {'host': 'localhost', 'port': 3001, 'path': '/'},
            'qdrant': {'host': 'localhost', 'port': 6333, 'path': '/'},
            'supabase-kong': {'host': 'localhost', 'port': 8000, 'path': '/'},
            'neo4j': {'host': 'localhost', 'port': 7474, 'path': '/'},
            'clickhouse': {'host': 'localhost', 'port': 8123, 'path': '/ping'},
            'minio': {'host': 'localhost', 'port': 9011, 'path': '/'},
            'langfuse': {'host': 'localhost', 'port': 3000, 'path': '/'},
            'redis': {'host': 'localhost', 'port': 6380, 'path': None},
            'postgres': {'host': 'localhost', 'port': 5433, 'path': None},
        }

    def discover_docker_networks(self) -> Dict:
        """Discover all Docker networks and their configurations"""
        networks = {}
        for network in self.client.networks.list():
            if network.name != 'none':
                networks[network.name] = {
                    'id': network.id,
                    'driver': network.attrs.get('Driver', 'unknown'),
                    'scope': network.attrs.get('Scope', 'unknown'),
                    'subnet': self.extract_subnet(network),
                    'containers': self.get_network_containers(network),
                    'created': network.attrs.get('Created', 'unknown')
                }
        return networks

    def extract_subnet(self, network) -> str:
        """Extract subnet from network configuration"""
        try:
            ipam = network.attrs.get('IPAM', {})
            config = ipam.get('Config', [])
            if config:
                return config[0].get('Subnet', 'unknown')
        except:
            pass
        return 'unknown'

    def get_network_containers(self, network) -> List[Dict]:
        """Get containers connected to a network"""
        containers = []
        network_containers = network.attrs.get('Containers', {})
        
        for container_id, container_info in network_containers.items():
            try:
                container = self.client.containers.get(container_id)
                containers.append({
                    'name': container.name,
                    'id': container_id[:12],
                    'ip': container_info.get('IPv4Address', '').split('/')[0],
                    'status': container.status
                })
            except:
                continue
        
        return containers

    def test_port_connectivity(self, host: str, port: int, timeout: int = 3) -> Tuple[bool, float]:
        """Test TCP connectivity to a specific port"""
        start_time = time.time()
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            sock.close()
            
            latency = (time.time() - start_time) * 1000  # Convert to ms
            return result == 0, latency
        except Exception:
            return False, -1

    async def test_http_connectivity(self, session: aiohttp.ClientSession, 
                                   host: str, port: int, path: str = '/', 
                                   timeout: int = 5) -> Dict:
        """Test HTTP connectivity and response time"""
        url = f"http://{host}:{port}{path}"
        start_time = time.time()
        
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
                latency = (time.time() - start_time) * 1000
                return {
                    'success': True,
                    'status_code': response.status,
                    'latency_ms': round(latency, 2),
                    'url': url,
                    'response_size': len(await response.text())
                }
        except asyncio.TimeoutError:
            return {
                'success': False,
                'error': 'timeout',
                'latency_ms': timeout * 1000,
                'url': url
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'latency_ms': (time.time() - start_time) * 1000,
                'url': url
            }

    def test_ping_connectivity(self, host: str, count: int = 3) -> Dict:
        """Test ICMP ping connectivity"""
        try:
            latencies = []
            for _ in range(count):
                latency = ping3.ping(host, timeout=2)
                if latency is not None:
                    latencies.append(latency * 1000)  # Convert to ms
                else:
                    latencies.append(-1)
                time.sleep(0.1)
            
            successful_pings = [l for l in latencies if l > 0]
            
            return {
                'success': len(successful_pings) > 0,
                'packet_loss': (count - len(successful_pings)) / count * 100,
                'avg_latency_ms': round(sum(successful_pings) / len(successful_pings), 2) if successful_pings else -1,
                'min_latency_ms': round(min(successful_pings), 2) if successful_pings else -1,
                'max_latency_ms': round(max(successful_pings), 2) if successful_pings else -1,
                'latencies': latencies
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'packet_loss': 100
            }

    async def test_inter_service_connectivity(self) -> Dict:
        """Test connectivity between all services"""
        results = {}
        
        async with aiohttp.ClientSession() as session:
            for service, endpoint in self.service_endpoints.items():
                print(f"Testing {service}...")
                
                # Test port connectivity
                port_result = self.test_port_connectivity(
                    endpoint['host'], 
                    endpoint['port']
                )
                
                # Test HTTP connectivity if path is provided
                http_result = None
                if endpoint['path'] is not None:
                    http_result = await self.test_http_connectivity(
                        session,
                        endpoint['host'],
                        endpoint['port'],
                        endpoint['path']
                    )
                
                # Test ping connectivity
                ping_result = self.test_ping_connectivity(endpoint['host'])
                
                results[service] = {
                    'endpoint': f"{endpoint['host']}:{endpoint['port']}",
                    'port_connectivity': {
                        'success': port_result[0],
                        'latency_ms': round(port_result[1], 2) if port_result[1] > 0 else -1
                    },
                    'http_connectivity': http_result,
                    'ping_connectivity': ping_result,
                    'overall_status': 'healthy' if port_result[0] and (http_result is None or http_result['success']) else 'unhealthy'
                }
        
        return results

    def test_docker_internal_connectivity(self) -> Dict:
        """Test connectivity within Docker networks"""
        results = {}
        
        try:
            # Get containers in LocalAI networks
            containers = self.client.containers.list(filters={'status': 'running'})
            localai_containers = [
                c for c in containers 
                if any(name in c.name.lower() for name in [
                    'localai', 'n8n', 'ollama', 'flowise', 'supabase',
                    'qdrant', 'searxng', 'caddy', 'neo4j'
                ])
            ]
            
            for container in localai_containers:
                container_results = {}
                
                # Test connectivity to other containers
                for target_container in localai_containers:
                    if container.id != target_container.id:
                        # Get container IP in shared network
                        target_ip = self.get_container_ip(target_container)
                        if target_ip:
                            # Test common ports
                            common_ports = [80, 443, 5432, 6379, 3000, 8080]
                            port_results = {}
                            
                            for port in common_ports:
                                success, latency = self.test_port_connectivity(target_ip, port, timeout=1)
                                if success:
                                    port_results[port] = {
                                        'success': True,
                                        'latency_ms': round(latency, 2)
                                    }
                            
                            if port_results:
                                container_results[target_container.name] = {
                                    'ip': target_ip,
                                    'accessible_ports': port_results
                                }
                
                results[container.name] = container_results
        
        except Exception as e:
            results['error'] = str(e)
        
        return results

    def get_container_ip(self, container) -> str:
        """Get container IP address in the first network"""
        try:
            network_settings = container.attrs['NetworkSettings']
            networks = network_settings.get('Networks', {})
            
            for network_name, network_info in networks.items():
                ip = network_info.get('IPAddress')
                if ip:
                    return ip
        except:
            pass
        return None

    def monitor_network_traffic(self, duration: int = 60) -> Dict:
        """Monitor network traffic for specified duration"""
        print(f"Monitoring network traffic for {duration} seconds...")
        
        # Get initial network stats
        initial_stats = psutil.net_io_counters(pernic=True)
        time.sleep(duration)
        final_stats = psutil.net_io_counters(pernic=True)
        
        traffic_stats = {}
        
        for interface, initial in initial_stats.items():
            if interface in final_stats:
                final = final_stats[interface]
                
                bytes_sent = final.bytes_sent - initial.bytes_sent
                bytes_recv = final.bytes_recv - initial.bytes_recv
                packets_sent = final.packets_sent - initial.packets_sent
                packets_recv = final.packets_recv - initial.packets_recv
                
                traffic_stats[interface] = {
                    'bytes_sent': bytes_sent,
                    'bytes_recv': bytes_recv,
                    'packets_sent': packets_sent,
                    'packets_recv': packets_recv,
                    'mbps_sent': round((bytes_sent * 8) / (duration * 1024 * 1024), 2),
                    'mbps_recv': round((bytes_recv * 8) / (duration * 1024 * 1024), 2),
                    'errors_in': final.errin - initial.errin,
                    'errors_out': final.errout - initial.errout,
                    'drops_in': final.dropin - initial.dropin,
                    'drops_out': final.dropout - initial.dropout
                }
        
        return traffic_stats

    def generate_network_report(self, connectivity_results: Dict, 
                              docker_networks: Dict, 
                              traffic_stats: Dict = None) -> str:
        """Generate comprehensive network monitoring report"""
        
        report = f"""
# LocalAI Stack Network Monitoring Report
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Service Connectivity Summary
"""
        
        healthy_services = sum(1 for r in connectivity_results.values() if r.get('overall_status') == 'healthy')
        total_services = len(connectivity_results)
        
        report += f"- **Total Services:** {total_services}\n"
        report += f"- **Healthy Services:** {healthy_services}/{total_services}\n"
        report += f"- **Success Rate:** {(healthy_services/total_services)*100:.1f}%\n\n"
        
        # Service details
        report += "## Service Details\n\n"
        for service, results in connectivity_results.items():
            status_emoji = "🟢" if results['overall_status'] == 'healthy' else "🔴"
            report += f"### {status_emoji} {service}\n"
            report += f"- **Endpoint:** {results['endpoint']}\n"
            
            # Port connectivity
            port_conn = results['port_connectivity']
            port_status = "✅" if port_conn['success'] else "❌"
            latency = f" ({port_conn['latency_ms']}ms)" if port_conn['latency_ms'] > 0 else ""
            report += f"- **Port Connectivity:** {port_status}{latency}\n"
            
            # HTTP connectivity
            if results['http_connectivity']:
                http_conn = results['http_connectivity']
                http_status = "✅" if http_conn['success'] else "❌"
                if http_conn['success']:
                    report += f"- **HTTP Response:** {http_status} {http_conn['status_code']} ({http_conn['latency_ms']}ms)\n"
                else:
                    report += f"- **HTTP Response:** {http_status} {http_conn.get('error', 'unknown error')}\n"
            
            # Ping connectivity
            ping_conn = results['ping_connectivity']
            if ping_conn['success']:
                report += f"- **Ping:** ✅ {ping_conn['avg_latency_ms']}ms avg, {ping_conn['packet_loss']}% loss\n"
            else:
                report += f"- **Ping:** ❌ {ping_conn['packet_loss']}% packet loss\n"
            
            report += "\n"
        
        # Docker networks
        report += "## Docker Networks\n\n"
        for name, network in docker_networks.items():
            report += f"### {name}\n"
            report += f"- **Driver:** {network['driver']}\n"
            report += f"- **Subnet:** {network['subnet']}\n"
            report += f"- **Containers:** {len(network['containers'])}\n"
            
            if network['containers']:
                report += "- **Connected Containers:**\n"
                for container in network['containers']:
                    status_emoji = "🟢" if container['status'] == 'running' else "🔴"
                    report += f"  - {status_emoji} {container['name']} ({container['ip']})\n"
            report += "\n"
        
        # Traffic statistics
        if traffic_stats:
            report += "## Network Traffic Statistics\n\n"
            for interface, stats in traffic_stats.items():
                if stats['bytes_sent'] > 0 or stats['bytes_recv'] > 0:
                    report += f"### {interface}\n"
                    report += f"- **Data Sent:** {stats['bytes_sent']:,} bytes ({stats['mbps_sent']} Mbps)\n"
                    report += f"- **Data Received:** {stats['bytes_recv']:,} bytes ({stats['mbps_recv']} Mbps)\n"
                    report += f"- **Packets Sent:** {stats['packets_sent']:,}\n"
                    report += f"- **Packets Received:** {stats['packets_recv']:,}\n"
                    
                    if stats['errors_in'] > 0 or stats['errors_out'] > 0:
                        report += f"- **Errors:** {stats['errors_in']} in, {stats['errors_out']} out\n"
                    if stats['drops_in'] > 0 or stats['drops_out'] > 0:
                        report += f"- **Drops:** {stats['drops_in']} in, {stats['drops_out']} out\n"
                    report += "\n"
        
        return report

    async def run_comprehensive_test(self, monitor_traffic: bool = False, 
                                   traffic_duration: int = 60) -> Dict:
        """Run comprehensive network monitoring test"""
        print("🔍 Starting comprehensive network monitoring...")
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'docker_networks': self.discover_docker_networks(),
            'service_connectivity': await self.test_inter_service_connectivity(),
            'docker_internal': self.test_docker_internal_connectivity()
        }
        
        if monitor_traffic:
            results['traffic_stats'] = self.monitor_network_traffic(traffic_duration)
        
        return results

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='LocalAI Stack Network Monitor')
    parser.add_argument('--traffic', '-t', action='store_true', help='Monitor network traffic')
    parser.add_argument('--duration', '-d', type=int, default=60, help='Traffic monitoring duration (seconds)')
    parser.add_argument('--report', '-r', action='store_true', help='Generate detailed report')
    parser.add_argument('--output', '-o', help='Output file for report')
    parser.add_argument('--json', '-j', action='store_true', help='Output results as JSON')
    
    args = parser.parse_args()
    
    monitor = NetworkMonitor()
    
    async def run_test():
        results = await monitor.run_comprehensive_test(
            monitor_traffic=args.traffic,
            traffic_duration=args.duration
        )
        
        if args.json:
            print(json.dumps(results, indent=2, default=str))
        elif args.report or args.output:
            report = monitor.generate_network_report(
                results['service_connectivity'],
                results['docker_networks'],
                results.get('traffic_stats')
            )
            
            if args.output:
                with open(args.output, 'w') as f:
                    f.write(report)
                print(f"Report saved to: {args.output}")
            else:
                print(report)
        else:
            # Print summary
            connectivity = results['service_connectivity']
            healthy = sum(1 for r in connectivity.values() if r.get('overall_status') == 'healthy')
            total = len(connectivity)
            
            print(f"\n📊 Network Monitoring Summary:")
            print(f"   Services: {healthy}/{total} healthy")
            print(f"   Docker Networks: {len(results['docker_networks'])}")
            
            if results.get('traffic_stats'):
                total_traffic = sum(
                    stats['bytes_sent'] + stats['bytes_recv'] 
                    for stats in results['traffic_stats'].values()
                )
                print(f"   Total Traffic: {total_traffic:,} bytes")
    
    # Run the async test
    asyncio.run(run_test())

if __name__ == '__main__':
    main()
