#!/usr/bin/env python3
"""
Docker Container Health Monitor
Advanced health monitoring with custom health checks and recovery actions.
"""

import docker
import requests
import socket
import time
import json
import sqlite3
import subprocess
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from collections import defaultdict
import threading
import signal
import argparse

class DockerHealthMonitor:
    def __init__(self, db_path="monitoring/health.db"):
        self.client = docker.from_env()
        self.db_path = db_path
        self.running = True
        self.health_checks = {}
        self.failed_checks = defaultdict(int)
        self.init_database()
        self.setup_custom_health_checks()
        
    def init_database(self):
        """Initialize SQLite database for health monitoring"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS health_checks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                container_name TEXT NOT NULL,
                check_type TEXT NOT NULL,
                status TEXT NOT NULL,
                response_time_ms INTEGER,
                error_message TEXT,
                metadata TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS recovery_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                container_name TEXT NOT NULL,
                action_type TEXT NOT NULL,
                reason TEXT NOT NULL,
                success BOOLEAN,
                details TEXT
            )
        ''')
        
        conn.commit()
        conn.close()
        
    def setup_custom_health_checks(self):
        """Setup custom health checks for different service types"""
        self.health_checks = {
            # HTTP service checks
            'http_endpoint': self.check_http_endpoint,
            'api_health': self.check_api_health,
            
            # Database checks
            'postgres_connection': self.check_postgres_connection,
            'redis_connection': self.check_redis_connection,
            'elasticsearch_cluster': self.check_elasticsearch_cluster,
            
            # Service-specific checks
            'prometheus_targets': self.check_prometheus_targets,
            'grafana_datasources': self.check_grafana_datasources,
            'ollama_models': self.check_ollama_models,
            
            # System checks
            'container_resources': self.check_container_resources,
            'disk_space': self.check_disk_space,
            'network_connectivity': self.check_network_connectivity
        }
        
    def run_health_check(self, container, check_type: str, config: Dict) -> Dict:
        """Run a specific health check"""
        start_time = time.time()
        
        try:
            check_func = self.health_checks.get(check_type)
            if not check_func:
                return {
                    'status': 'unknown',
                    'error': f'Unknown check type: {check_type}',
                    'response_time_ms': 0
                }
                
            result = check_func(container, config)
            response_time = int((time.time() - start_time) * 1000)
            
            return {
                'status': result.get('status', 'unknown'),
                'response_time_ms': response_time,
                'message': result.get('message', ''),
                'metadata': result.get('metadata', {})
            }
            
        except Exception as e:
            response_time = int((time.time() - start_time) * 1000)
            return {
                'status': 'error',
                'error': str(e),
                'response_time_ms': response_time
            }
            
    def check_http_endpoint(self, container, config: Dict) -> Dict:
        """Check HTTP endpoint health"""
        url = config.get('url', f'http://localhost:{config.get("port", 80)}')
        timeout = config.get('timeout', 5)
        expected_status = config.get('expected_status', 200)
        
        try:
            response = requests.get(url, timeout=timeout)
            
            if response.status_code == expected_status:
                return {
                    'status': 'healthy',
                    'message': f'HTTP {response.status_code}',
                    'metadata': {
                        'status_code': response.status_code,
                        'response_size': len(response.content)
                    }
                }
            else:
                return {
                    'status': 'unhealthy',
                    'message': f'HTTP {response.status_code} (expected {expected_status})',
                    'metadata': {'status_code': response.status_code}
                }
                
        except requests.exceptions.Timeout:
            return {
                'status': 'unhealthy',
                'message': f'Timeout after {timeout}s'
            }
        except requests.exceptions.ConnectionError:
            return {
                'status': 'unhealthy',
                'message': 'Connection refused'
            }
            
    def check_api_health(self, container, config: Dict) -> Dict:
        """Check API health endpoint"""
        health_endpoint = config.get('health_endpoint', '/health')
        base_url = config.get('base_url', f'http://localhost:{config.get("port", 80)}')
        url = f"{base_url.rstrip('/')}{health_endpoint}"
        
        try:
            response = requests.get(url, timeout=config.get('timeout', 5))
            
            if response.status_code == 200:
                try:
                    health_data = response.json()
                    status = health_data.get('status', 'unknown')
                    
                    if status.lower() in ['healthy', 'ok', 'up']:
                        return {
                            'status': 'healthy',
                            'message': f'API reports: {status}',
                            'metadata': health_data
                        }
                    else:
                        return {
                            'status': 'unhealthy',
                            'message': f'API reports: {status}',
                            'metadata': health_data
                        }
                except:
                    return {
                        'status': 'healthy',
                        'message': 'Health endpoint responding'
                    }
            else:
                return {
                    'status': 'unhealthy',
                    'message': f'Health endpoint returned {response.status_code}'
                }
                
        except Exception as e:
            return {
                'status': 'unhealthy',
                'message': f'Health check failed: {str(e)}'
            }
            
    def check_postgres_connection(self, container, config: Dict) -> Dict:
        """Check PostgreSQL connection"""
        try:
            # Try to connect using psql within the container
            exec_result = container.exec_run([
                'psql', '-h', 'localhost', '-U', 'postgres', '-c', 'SELECT 1;'
            ], stdout=True, stderr=True)
            
            if exec_result.exit_code == 0:
                return {
                    'status': 'healthy',
                    'message': 'PostgreSQL connection successful'
                }
            else:
                return {
                    'status': 'unhealthy',
                    'message': f'PostgreSQL connection failed: {exec_result.output.decode()}'
                }
                
        except Exception as e:
            return {
                'status': 'unhealthy',
                'message': f'PostgreSQL check error: {str(e)}'
            }
            
    def check_redis_connection(self, container, config: Dict) -> Dict:
        """Check Redis connection"""
        try:
            # Try to ping Redis within the container
            exec_result = container.exec_run([
                'redis-cli', 'ping'
            ], stdout=True, stderr=True)
            
            if exec_result.exit_code == 0 and b'PONG' in exec_result.output:
                return {
                    'status': 'healthy',
                    'message': 'Redis connection successful'
                }
            else:
                return {
                    'status': 'unhealthy',
                    'message': f'Redis ping failed: {exec_result.output.decode()}'
                }
                
        except Exception as e:
            return {
                'status': 'unhealthy',
                'message': f'Redis check error: {str(e)}'
            }
            
    def check_elasticsearch_cluster(self, container, config: Dict) -> Dict:
        """Check Elasticsearch cluster health"""
        port = config.get('port', 9200)
        url = f'http://localhost:{port}/_cluster/health'
        
        try:
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                health_data = response.json()
                status = health_data.get('status', 'unknown')
                
                return {
                    'status': 'healthy' if status in ['green', 'yellow'] else 'unhealthy',
                    'message': f'Cluster status: {status}',
                    'metadata': {
                        'cluster_name': health_data.get('cluster_name'),
                        'number_of_nodes': health_data.get('number_of_nodes'),
                        'active_shards': health_data.get('active_shards')
                    }
                }
            else:
                return {
                    'status': 'unhealthy',
                    'message': f'Elasticsearch API returned {response.status_code}'
                }
                
        except Exception as e:
            return {
                'status': 'unhealthy',
                'message': f'Elasticsearch check failed: {str(e)}'
            }
            
    def check_prometheus_targets(self, container, config: Dict) -> Dict:
        """Check Prometheus targets health"""
        port = config.get('port', 9090)
        url = f'http://localhost:{port}/api/v1/targets'
        
        try:
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                targets = data.get('data', {}).get('activeTargets', [])
                
                healthy_targets = len([t for t in targets if t.get('health') == 'up'])
                total_targets = len(targets)
                
                if total_targets == 0:
                    return {
                        'status': 'unknown',
                        'message': 'No targets configured'
                    }
                    
                if healthy_targets == total_targets:
                    return {
                        'status': 'healthy',
                        'message': f'All {total_targets} targets healthy',
                        'metadata': {'healthy_targets': healthy_targets, 'total_targets': total_targets}
                    }
                else:
                    return {
                        'status': 'unhealthy',
                        'message': f'{healthy_targets}/{total_targets} targets healthy',
                        'metadata': {'healthy_targets': healthy_targets, 'total_targets': total_targets}
                    }
            else:
                return {
                    'status': 'unhealthy',
                    'message': f'Prometheus API returned {response.status_code}'
                }
                
        except Exception as e:
            return {
                'status': 'unhealthy',
                'message': f'Prometheus check failed: {str(e)}'
            }
            
    def check_grafana_datasources(self, container, config: Dict) -> Dict:
        """Check Grafana datasources health"""
        port = config.get('port', 3000)
        username = config.get('username', 'admin')
        password = config.get('password', 'admin123')
        
        url = f'http://localhost:{port}/api/datasources'
        
        try:
            response = requests.get(url, auth=(username, password), timeout=5)
            
            if response.status_code == 200:
                datasources = response.json()
                
                # Test each datasource
                healthy_sources = 0
                for ds in datasources:
                    test_url = f'http://localhost:{port}/api/datasources/{ds["id"]}/health'
                    test_response = requests.get(test_url, auth=(username, password), timeout=3)
                    
                    if test_response.status_code == 200:
                        test_data = test_response.json()
                        if test_data.get('status') == 'OK':
                            healthy_sources += 1
                            
                total_sources = len(datasources)
                
                if healthy_sources == total_sources:
                    return {
                        'status': 'healthy',
                        'message': f'All {total_sources} datasources healthy',
                        'metadata': {'healthy_sources': healthy_sources, 'total_sources': total_sources}
                    }
                else:
                    return {
                        'status': 'unhealthy',
                        'message': f'{healthy_sources}/{total_sources} datasources healthy',
                        'metadata': {'healthy_sources': healthy_sources, 'total_sources': total_sources}
                    }
            else:
                return {
                    'status': 'unhealthy',
                    'message': f'Grafana API returned {response.status_code}'
                }
                
        except Exception as e:
            return {
                'status': 'unhealthy',
                'message': f'Grafana check failed: {str(e)}'
            }
            
    def check_ollama_models(self, container, config: Dict) -> Dict:
        """Check Ollama models availability"""
        port = config.get('port', 11434)
        url = f'http://localhost:{port}/api/tags'
        
        try:
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                models = data.get('models', [])
                
                if models:
                    return {
                        'status': 'healthy',
                        'message': f'{len(models)} models available',
                        'metadata': {
                            'model_count': len(models),
                            'models': [m.get('name', 'unknown') for m in models[:5]]
                        }
                    }
                else:
                    return {
                        'status': 'unhealthy',
                        'message': 'No models available'
                    }
            else:
                return {
                    'status': 'unhealthy',
                    'message': f'Ollama API returned {response.status_code}'
                }
                
        except Exception as e:
            return {
                'status': 'unhealthy',
                'message': f'Ollama check failed: {str(e)}'
            }
            
    def check_container_resources(self, container, config: Dict) -> Dict:
        """Check container resource usage"""
        try:
            stats = container.stats(stream=False)
            
            # CPU usage
            cpu_stats = stats['cpu_stats']
            precpu_stats = stats['precpu_stats']
            
            cpu_delta = cpu_stats['cpu_usage']['total_usage'] - precpu_stats['cpu_usage']['total_usage']
            system_cpu_delta = cpu_stats['system_cpu_usage'] - precpu_stats['system_cpu_usage']
            number_cpus = len(cpu_stats['cpu_usage']['percpu_usage'])
            
            cpu_percent = 0.0
            if system_cpu_delta > 0 and cpu_delta > 0:
                cpu_percent = (cpu_delta / system_cpu_delta) * number_cpus * 100.0
                
            # Memory usage
            memory_stats = stats['memory_stats']
            memory_usage = memory_stats.get('usage', 0)
            memory_limit = memory_stats.get('limit', 1)
            memory_percent = (memory_usage / memory_limit) * 100.0
            
            # Thresholds
            cpu_threshold = config.get('cpu_threshold', 90)
            memory_threshold = config.get('memory_threshold', 90)
            
            issues = []
            if cpu_percent > cpu_threshold:
                issues.append(f'High CPU: {cpu_percent:.1f}%')
            if memory_percent > memory_threshold:
                issues.append(f'High Memory: {memory_percent:.1f}%')
                
            if issues:
                return {
                    'status': 'unhealthy',
                    'message': ', '.join(issues),
                    'metadata': {
                        'cpu_percent': round(cpu_percent, 2),
                        'memory_percent': round(memory_percent, 2)
                    }
                }
            else:
                return {
                    'status': 'healthy',
                    'message': f'CPU: {cpu_percent:.1f}%, Memory: {memory_percent:.1f}%',
                    'metadata': {
                        'cpu_percent': round(cpu_percent, 2),
                        'memory_percent': round(memory_percent, 2)
                    }
                }
                
        except Exception as e:
            return {
                'status': 'unhealthy',
                'message': f'Resource check failed: {str(e)}'
            }
            
    def check_disk_space(self, container, config: Dict) -> Dict:
        """Check container disk space"""
        try:
            exec_result = container.exec_run(['df', '-h', '/'], stdout=True, stderr=True)
            
            if exec_result.exit_code == 0:
                output = exec_result.output.decode()
                lines = output.strip().split('\n')
                
                if len(lines) >= 2:
                    fields = lines[1].split()
                    if len(fields) >= 5:
                        used_percent = fields[4].replace('%', '')
                        
                        threshold = config.get('disk_threshold', 80)
                        
                        if int(used_percent) > threshold:
                            return {
                                'status': 'unhealthy',
                                'message': f'Disk usage: {used_percent}%',
                                'metadata': {'disk_usage_percent': int(used_percent)}
                            }
                        else:
                            return {
                                'status': 'healthy',
                                'message': f'Disk usage: {used_percent}%',
                                'metadata': {'disk_usage_percent': int(used_percent)}
                            }
                            
            return {
                'status': 'unknown',
                'message': 'Could not parse disk usage'
            }
            
        except Exception as e:
            return {
                'status': 'unknown',
                'message': f'Disk check failed: {str(e)}'
            }
            
    def check_network_connectivity(self, container, config: Dict) -> Dict:
        """Check network connectivity"""
        targets = config.get('targets', ['8.8.8.8', 'google.com'])
        
        try:
            failed_targets = []
            
            for target in targets:
                exec_result = container.exec_run([
                    'ping', '-c', '1', '-W', '3', target
                ], stdout=True, stderr=True)
                
                if exec_result.exit_code != 0:
                    failed_targets.append(target)
                    
            if failed_targets:
                return {
                    'status': 'unhealthy',
                    'message': f'Cannot reach: {", ".join(failed_targets)}',
                    'metadata': {'failed_targets': failed_targets}
                }
            else:
                return {
                    'status': 'healthy',
                    'message': f'All targets reachable: {", ".join(targets)}',
                    'metadata': {'tested_targets': targets}
                }
                
        except Exception as e:
            return {
                'status': 'unknown',
                'message': f'Network check failed: {str(e)}'
            }
            
    def get_container_health_config(self, container) -> Dict:
        """Get health check configuration for container"""
        # Default configurations based on container name patterns
        name = container.name.lower()
        
        configs = {}
        
        # HTTP services
        if any(service in name for service in ['grafana', 'prometheus', 'n8n', 'open-webui']):
            port_map = {
                'grafana': 3000,
                'prometheus': 9090,
                'n8n': 5678,
                'open-webui': 8080
            }
            
            for service, port in port_map.items():
                if service in name:
                    configs['http_endpoint'] = {'port': port}
                    if service == 'grafana':
                        configs['grafana_datasources'] = {'port': port}
                    elif service == 'prometheus':
                        configs['prometheus_targets'] = {'port': port}
                    break
                    
        # Databases
        if 'postgres' in name:
            configs['postgres_connection'] = {}
            
        if 'redis' in name:
            configs['redis_connection'] = {}
            
        if 'elasticsearch' in name:
            configs['elasticsearch_cluster'] = {'port': 9200}
            
        # AI services
        if 'ollama' in name:
            configs['ollama_models'] = {'port': 11434}
            
        # Always check resources
        configs['container_resources'] = {
            'cpu_threshold': 90,
            'memory_threshold': 90
        }
        
        return configs
        
    def perform_recovery_action(self, container, action_type: str, reason: str) -> Dict:
        """Perform recovery action on unhealthy container"""
        try:
            success = False
            details = {}
            
            if action_type == 'restart':
                container.restart()
                time.sleep(5)  # Wait for restart
                success = container.status == 'running'
                details = {'action': 'container_restart'}
                
            elif action_type == 'stop_start':
                container.stop()
                time.sleep(2)
                container.start()
                time.sleep(5)
                success = container.status == 'running'
                details = {'action': 'stop_then_start'}
                
            elif action_type == 'recreate':
                # This would require more complex logic to recreate with same config
                details = {'action': 'recreate_not_implemented'}
                
            # Log recovery action
            self.log_recovery_action(container.name, action_type, reason, success, details)
            
            return {
                'success': success,
                'action': action_type,
                'details': details
            }
            
        except Exception as e:
            self.log_recovery_action(container.name, action_type, reason, False, {'error': str(e)})
            return {
                'success': False,
                'action': action_type,
                'error': str(e)
            }
            
    def log_health_check(self, container_name: str, check_type: str, result: Dict):
        """Log health check result to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO health_checks 
            (timestamp, container_name, check_type, status, response_time_ms, error_message, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            datetime.now().isoformat(),
            container_name,
            check_type,
            result['status'],
            result.get('response_time_ms', 0),
            result.get('error', result.get('message', '')),
            json.dumps(result.get('metadata', {}))
        ))
        
        conn.commit()
        conn.close()
        
    def log_recovery_action(self, container_name: str, action_type: str, reason: str, 
                           success: bool, details: Dict):
        """Log recovery action to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO recovery_actions 
            (timestamp, container_name, action_type, reason, success, details)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            datetime.now().isoformat(),
            container_name,
            action_type,
            reason,
            success,
            json.dumps(details)
        ))
        
        conn.commit()
        conn.close()
        
    def monitor_health_continuous(self, interval: int = 60, auto_recovery: bool = False):
        """Continuous health monitoring"""
        print(f"🏥 Starting Docker Health Monitor (interval: {interval}s, auto-recovery: {auto_recovery})")
        
        def signal_handler(signum, frame):
            print("\n👋 Stopping health monitoring...")
            self.running = False
            
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        while self.running:
            try:
                containers = self.client.containers.list()
                unhealthy_containers = []
                
                print(f"\n🔍 Health check at {datetime.now().strftime('%H:%M:%S')}")
                
                for container in containers:
                    health_configs = self.get_container_health_config(container)
                    container_healthy = True
                    
                    for check_type, config in health_configs.items():
                        result = self.run_health_check(container, check_type, config)
                        self.log_health_check(container.name, check_type, result)
                        
                        status_emoji = {
                            'healthy': '🟢',
                            'unhealthy': '🔴',
                            'unknown': '🟡',
                            'error': '💥'
                        }.get(result['status'], '❓')
                        
                        if result['status'] in ['unhealthy', 'error']:
                            container_healthy = False
                            self.failed_checks[container.name] += 1
                            
                            print(f"  {status_emoji} {container.name} ({check_type}): {result.get('message', result.get('error', 'Unknown issue'))}")
                            
                            # Auto-recovery logic
                            if auto_recovery and self.failed_checks[container.name] >= 3:
                                print(f"    🔧 Attempting recovery for {container.name}...")
                                recovery_result = self.perform_recovery_action(
                                    container, 'restart', f'Failed {check_type} check 3 times'
                                )
                                
                                if recovery_result['success']:
                                    print(f"    ✅ Recovery successful for {container.name}")
                                    self.failed_checks[container.name] = 0
                                else:
                                    print(f"    ❌ Recovery failed for {container.name}")
                        else:
                            # Reset failure count on success
                            if container.name in self.failed_checks:
                                del self.failed_checks[container.name]
                                
                    if not container_healthy:
                        unhealthy_containers.append(container.name)
                        
                # Summary
                total_containers = len(containers)
                healthy_containers = total_containers - len(unhealthy_containers)
                
                print(f"📊 Health Summary: {healthy_containers}/{total_containers} containers healthy")
                
                if unhealthy_containers:
                    print(f"⚠️  Unhealthy containers: {', '.join(unhealthy_containers)}")
                    
                time.sleep(interval)
                
            except Exception as e:
                print(f"❌ Error in health monitoring: {e}")
                time.sleep(interval)
                
        print("✅ Health monitoring stopped")
        
    def generate_health_report(self, hours: int = 24) -> Dict:
        """Generate health monitoring report"""
        start_time = datetime.now() - timedelta(hours=hours)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get health check summary
        cursor.execute('''
            SELECT container_name, check_type, status, COUNT(*) as count
            FROM health_checks 
            WHERE timestamp > ?
            GROUP BY container_name, check_type, status
            ORDER BY container_name, check_type
        ''', (start_time.isoformat(),))
        
        health_summary = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        for row in cursor.fetchall():
            container, check_type, status, count = row
            health_summary[container][check_type][status] = count
            
        # Get recovery actions
        cursor.execute('''
            SELECT container_name, action_type, success, COUNT(*) as count
            FROM recovery_actions 
            WHERE timestamp > ?
            GROUP BY container_name, action_type, success
            ORDER BY container_name
        ''', (start_time.isoformat(),))
        
        recovery_summary = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        for row in cursor.fetchall():
            container, action_type, success, count = row
            recovery_summary[container][action_type][success] = count
            
        conn.close()
        
        # Calculate reliability metrics
        container_reliability = {}
        
        for container, checks in health_summary.items():
            total_checks = 0
            successful_checks = 0
            
            for check_type, statuses in checks.items():
                for status, count in statuses.items():
                    total_checks += count
                    if status == 'healthy':
                        successful_checks += count
                        
            if total_checks > 0:
                reliability = (successful_checks / total_checks) * 100
                container_reliability[container] = round(reliability, 2)
                
        report = {
            'timestamp': datetime.now().isoformat(),
            'analysis_period_hours': hours,
            'health_summary': dict(health_summary),
            'recovery_summary': dict(recovery_summary),
            'container_reliability': container_reliability,
            'most_reliable': sorted(container_reliability.items(), 
                                   key=lambda x: x[1], reverse=True)[:5],
            'least_reliable': sorted(container_reliability.items(), 
                                    key=lambda x: x[1])[:5]
        }
        
        return report

def main():
    parser = argparse.ArgumentParser(description='Docker Health Monitor')
    parser.add_argument('--monitor', '-m', action='store_true', help='Start continuous monitoring')
    parser.add_argument('--interval', '-i', type=int, default=60, help='Monitoring interval in seconds')
    parser.add_argument('--auto-recovery', action='store_true', help='Enable automatic recovery actions')
    parser.add_argument('--report', '-r', action='store_true', help='Generate health report')
    parser.add_argument('--hours', type=int, default=24, help='Hours of data to analyze')
    parser.add_argument('--test', '-t', type=str, help='Test health checks for specific container')
    parser.add_argument('--export', '-e', type=str, help='Export report to JSON file')
    
    args = parser.parse_args()
    
    monitor = DockerHealthMonitor()
    
    if args.monitor:
        monitor.monitor_health_continuous(args.interval, args.auto_recovery)
    elif args.test:
        containers = monitor.client.containers.list()
        target_container = None
        
        for container in containers:
            if args.test.lower() in container.name.lower():
                target_container = container
                break
                
        if target_container:
            print(f"🧪 Testing health checks for {target_container.name}")
            health_configs = monitor.get_container_health_config(target_container)
            
            for check_type, config in health_configs.items():
                result = monitor.run_health_check(target_container, check_type, config)
                
                status_emoji = {
                    'healthy': '🟢',
                    'unhealthy': '🔴',
                    'unknown': '🟡',
                    'error': '💥'
                }.get(result['status'], '❓')
                
                print(f"  {status_emoji} {check_type}: {result.get('message', result.get('error', 'Unknown'))}")
                if result.get('response_time_ms'):
                    print(f"    Response time: {result['response_time_ms']}ms")
        else:
            print(f"❌ Container matching '{args.test}' not found")
            
    elif args.report:
        report = monitor.generate_health_report(args.hours)
        
        if args.export:
            with open(args.export, 'w') as f:
                json.dump(report, f, indent=2)
            print(f"📄 Report exported to: {args.export}")
        else:
            print("🏥 Docker Health Report")
            print("=" * 50)
            print(f"Analysis Period: {args.hours} hours")
            
            # Container reliability
            if report['container_reliability']:
                print("\n📊 Container Reliability:")
                for container, reliability in report['most_reliable']:
                    reliability_emoji = "🟢" if reliability > 95 else "🟡" if reliability > 80 else "🔴"
                    print(f"  {reliability_emoji} {container:25}: {reliability:6.1f}%")
                    
            # Recovery actions
            recovery_count = sum(
                sum(actions.values())
                for container_actions in report['recovery_summary'].values()
                for actions in container_actions.values()
            )
            
            if recovery_count > 0:
                print(f"\n🔧 Recovery Actions: {recovery_count} total")
                for container, actions in report['recovery_summary'].items():
                    for action_type, results in actions.items():
                        successful = results.get(True, 0)
                        failed = results.get(False, 0)
                        print(f"  {container}: {action_type} ({successful} successful, {failed} failed)")
    else:
        # Quick status check
        containers = monitor.client.containers.list()
        print(f"🏥 Quick Health Check for {len(containers)} containers")
        
        for container in containers:
            # Simple status check
            if container.status == 'running':
                print(f"🟢 {container.name}: running")
            else:
                print(f"🔴 {container.name}: {container.status}")
                
        print("\nUse --monitor for continuous monitoring")
        print("Use --test <container> to test specific container")
        print("Use --report for detailed health analysis")

if __name__ == '__main__':
    main()
