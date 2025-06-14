#!/usr/bin/env python3
"""
LocalAI Stack Prometheus Metrics Exporter
Export custom metrics for the LocalAI stack to Prometheus.
"""

import time
import docker
import psutil
import requests
from prometheus_client import start_http_server, Gauge, Counter, Histogram, Info
from collections import defaultdict
import threading
import logging
import argparse
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LocalAIMetricsExporter:
    def __init__(self, port=8000):
        self.port = port
        self.client = docker.from_env()
        self.running = True
        
        # Define Prometheus metrics
        self.container_up = Gauge(
            'localai_container_up', 
            'Container is running', 
            ['container_name', 'service_type']
        )
        
        self.container_cpu_usage = Gauge(
            'localai_container_cpu_usage_percent', 
            'Container CPU usage percentage', 
            ['container_name', 'service_type']
        )
        
        self.container_memory_usage = Gauge(
            'localai_container_memory_usage_bytes', 
            'Container memory usage in bytes', 
            ['container_name', 'service_type']
        )
        
        self.container_memory_limit = Gauge(
            'localai_container_memory_limit_bytes', 
            'Container memory limit in bytes', 
            ['container_name', 'service_type']
        )
        
        self.container_network_rx = Counter(
            'localai_container_network_receive_bytes_total', 
            'Container network bytes received', 
            ['container_name', 'service_type']
        )
        
        self.container_network_tx = Counter(
            'localai_container_network_transmit_bytes_total', 
            'Container network bytes transmitted', 
            ['container_name', 'service_type']
        )
        
        self.container_restarts = Counter(
            'localai_container_restarts_total', 
            'Container restart count', 
            ['container_name', 'service_type']
        )
        
        self.container_disk_read = Counter(
            'localai_container_disk_read_bytes_total', 
            'Container disk bytes read', 
            ['container_name', 'service_type']
        )
        
        self.container_disk_write = Counter(
            'localai_container_disk_write_bytes_total', 
            'Container disk bytes written', 
            ['container_name', 'service_type']
        )
        
        # Service-specific metrics
        self.service_response_time = Histogram(
            'localai_service_response_time_seconds', 
            'Service HTTP response time', 
            ['service_name', 'endpoint']
        )
        
        self.service_up = Gauge(
            'localai_service_up', 
            'Service endpoint is responding', 
            ['service_name', 'endpoint']
        )
        
        self.service_requests_total = Counter(
            'localai_service_requests_total', 
            'Total service requests', 
            ['service_name', 'method', 'status_code']
        )
        
        # System metrics
        self.system_cpu_usage = Gauge(
            'localai_system_cpu_usage_percent', 
            'System CPU usage percentage'
        )
        
        self.system_memory_usage = Gauge(
            'localai_system_memory_usage_bytes', 
            'System memory usage in bytes'
        )
        
        self.system_disk_usage = Gauge(
            'localai_system_disk_usage_percent', 
            'System disk usage percentage', 
            ['mountpoint']
        )
        
        self.system_load_average = Gauge(
            'localai_system_load_average', 
            'System load average', 
            ['period']
        )
        
        # Ollama-specific metrics
        self.ollama_models_loaded = Gauge(
            'localai_ollama_models_loaded', 
            'Number of models loaded in Ollama'
        )
        
        self.ollama_inference_time = Histogram(
            'localai_ollama_inference_time_seconds', 
            'Ollama inference time', 
            ['model_name']
        )
        
        # N8N-specific metrics
        self.n8n_workflows_active = Gauge(
            'localai_n8n_workflows_active', 
            'Number of active N8N workflows'
        )
        
        self.n8n_executions_total = Counter(
            'localai_n8n_executions_total', 
            'Total N8N workflow executions', 
            ['workflow_name', 'status']
        )
        
        # Database metrics
        self.database_connections = Gauge(
            'localai_database_connections', 
            'Database connection count', 
            ['database_type', 'database_name']
        )
        
        self.database_query_time = Histogram(
            'localai_database_query_time_seconds', 
            'Database query execution time', 
            ['database_type', 'operation']
        )
        
        # Stack info
        self.stack_info = Info(
            'localai_stack_info', 
            'LocalAI stack information'
        )
        
        # Service endpoints for health checks
        self.service_endpoints = {
            'n8n': {'url': 'http://localhost:5679', 'path': '/healthz'},
            'ollama': {'url': 'http://localhost:11435', 'path': '/api/version'},
            'open-webui': {'url': 'http://localhost:8080', 'path': '/'},
            'flowise': {'url': 'http://localhost:3001', 'path': '/api/v1/ping'},
            'qdrant': {'url': 'http://localhost:6333', 'path': '/'},
            'langfuse': {'url': 'http://localhost:3000', 'path': '/api/public/health'},
            'neo4j': {'url': 'http://localhost:7474', 'path': '/'},
            'clickhouse': {'url': 'http://localhost:8123', 'path': '/ping'},
            'minio': {'url': 'http://localhost:9011', 'path': '/'},
        }
        
        # Initialize stack info
        self.stack_info.info({
            'version': '1.0.0',
            'components': 'ollama,n8n,flowise,supabase,qdrant,neo4j',
            'monitoring_port': str(self.port)
        })

    def get_service_type(self, container_name: str) -> str:
        """Determine service type from container name"""
        name_lower = container_name.lower()
        
        if 'n8n' in name_lower:
            return 'workflow'
        elif 'ollama' in name_lower:
            return 'ai'
        elif any(x in name_lower for x in ['flowise', 'open-webui']):
            return 'ui'
        elif any(x in name_lower for x in ['postgres', 'redis', 'neo4j', 'clickhouse', 'qdrant']):
            return 'database'
        elif any(x in name_lower for x in ['minio', 'storage']):
            return 'storage'
        elif 'supabase' in name_lower:
            return 'backend'
        elif any(x in name_lower for x in ['caddy', 'kong', 'proxy']):
            return 'proxy'
        else:
            return 'other'

    def collect_container_metrics(self):
        """Collect metrics from Docker containers"""
        try:
            containers = self.client.containers.list(all=True)
            localai_containers = [
                c for c in containers 
                if any(name in c.name.lower() for name in [
                    'localai', 'n8n', 'ollama', 'flowise', 'supabase',
                    'qdrant', 'searxng', 'caddy', 'neo4j', 'clickhouse',
                    'minio', 'langfuse', 'redis', 'open-webui'
                ])
            ]
            
            for container in localai_containers:
                container_name = container.name
                service_type = self.get_service_type(container_name)
                
                # Container status
                is_running = container.status == 'running'
                self.container_up.labels(
                    container_name=container_name, 
                    service_type=service_type
                ).set(1 if is_running else 0)
                
                # Restart count
                restart_count = container.attrs.get('RestartCount', 0)
                self.container_restarts.labels(
                    container_name=container_name, 
                    service_type=service_type
                )._value._value = restart_count
                
                if is_running:
                    try:
                        # Get container stats
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
                        
                        self.container_cpu_usage.labels(
                            container_name=container_name, 
                            service_type=service_type
                        ).set(cpu_percent)
                        
                        # Memory usage
                        memory_stats = stats['memory_stats']
                        memory_usage = memory_stats.get('usage', 0)
                        memory_limit = memory_stats.get('limit', 0)
                        
                        self.container_memory_usage.labels(
                            container_name=container_name, 
                            service_type=service_type
                        ).set(memory_usage)
                        
                        self.container_memory_limit.labels(
                            container_name=container_name, 
                            service_type=service_type
                        ).set(memory_limit)
                        
                        # Network I/O
                        network_rx = 0
                        network_tx = 0
                        if 'networks' in stats:
                            for interface, net_stats in stats['networks'].items():
                                network_rx += net_stats['rx_bytes']
                                network_tx += net_stats['tx_bytes']
                        
                        self.container_network_rx.labels(
                            container_name=container_name, 
                            service_type=service_type
                        )._value._value = network_rx
                        
                        self.container_network_tx.labels(
                            container_name=container_name, 
                            service_type=service_type
                        )._value._value = network_tx
                        
                        # Disk I/O
                        block_read = 0
                        block_write = 0
                        if 'blkio_stats' in stats and 'io_service_bytes_recursive' in stats['blkio_stats']:
                            for entry in stats['blkio_stats']['io_service_bytes_recursive']:
                                if entry['op'] == 'Read':
                                    block_read += entry['value']
                                elif entry['op'] == 'Write':
                                    block_write += entry['value']
                        
                        self.container_disk_read.labels(
                            container_name=container_name, 
                            service_type=service_type
                        )._value._value = block_read
                        
                        self.container_disk_write.labels(
                            container_name=container_name, 
                            service_type=service_type
                        )._value._value = block_write
                        
                    except Exception as e:
                        logger.warning(f"Error collecting stats for {container_name}: {e}")
            
        except Exception as e:
            logger.error(f"Error collecting container metrics: {e}")

    def collect_system_metrics(self):
        """Collect system-wide metrics"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            self.system_cpu_usage.set(cpu_percent)
            
            # Memory usage
            memory = psutil.virtual_memory()
            self.system_memory_usage.set(memory.used)
            
            # Disk usage
            for disk in psutil.disk_partitions():
                try:
                    usage = psutil.disk_usage(disk.mountpoint)
                    disk_percent = (usage.used / usage.total) * 100
                    self.system_disk_usage.labels(mountpoint=disk.mountpoint).set(disk_percent)
                except:
                    continue
            
            # Load average
            load_avg = psutil.getloadavg()
            self.system_load_average.labels(period='1m').set(load_avg[0])
            self.system_load_average.labels(period='5m').set(load_avg[1])
            self.system_load_average.labels(period='15m').set(load_avg[2])
            
        except Exception as e:
            logger.error(f"Error collecting system metrics: {e}")

    def collect_service_metrics(self):
        """Collect service-specific metrics"""
        for service_name, config in self.service_endpoints.items():
            try:
                url = f"{config['url']}{config['path']}"
                start_time = time.time()
                
                response = requests.get(url, timeout=5)
                response_time = time.time() - start_time
                
                # Record response time
                self.service_response_time.labels(
                    service_name=service_name, 
                    endpoint=config['path']
                ).observe(response_time)
                
                # Service up status
                is_up = response.status_code < 500
                self.service_up.labels(
                    service_name=service_name, 
                    endpoint=config['path']
                ).set(1 if is_up else 0)
                
                # Request count
                self.service_requests_total.labels(
                    service_name=service_name, 
                    method='GET', 
                    status_code=str(response.status_code)
                ).inc()
                
            except requests.exceptions.RequestException:
                # Service is down
                self.service_up.labels(
                    service_name=service_name, 
                    endpoint=config['path']
                ).set(0)
                
                self.service_requests_total.labels(
                    service_name=service_name, 
                    method='GET', 
                    status_code='000'
                ).inc()
            except Exception as e:
                logger.warning(f"Error checking {service_name}: {e}")

    def collect_ollama_metrics(self):
        """Collect Ollama-specific metrics"""
        try:
            # Try to get Ollama models
            response = requests.get('http://localhost:11435/api/tags', timeout=5)
            if response.status_code == 200:
                data = response.json()
                models = data.get('models', [])
                self.ollama_models_loaded.set(len(models))
            else:
                self.ollama_models_loaded.set(0)
        except:
            self.ollama_models_loaded.set(0)

    def collect_database_metrics(self):
        """Collect database-specific metrics"""
        # PostgreSQL (Supabase)
        try:
            # This would require a database connection
            # For now, we'll use a placeholder
            self.database_connections.labels(
                database_type='postgresql', 
                database_name='supabase'
            ).set(10)  # Placeholder
        except:
            pass
        
        # Redis
        try:
            # This would require a Redis connection
            self.database_connections.labels(
                database_type='redis', 
                database_name='localai'
            ).set(5)  # Placeholder
        except:
            pass

    def metrics_collection_loop(self):
        """Main metrics collection loop"""
        while self.running:
            try:
                logger.info("Collecting metrics...")
                
                self.collect_container_metrics()
                self.collect_system_metrics()
                self.collect_service_metrics()
                self.collect_ollama_metrics()
                self.collect_database_metrics()
                
                logger.info("Metrics collection completed")
                
            except Exception as e:
                logger.error(f"Error in metrics collection: {e}")
            
            time.sleep(15)  # Collect metrics every 15 seconds

    def start(self):
        """Start the metrics exporter"""
        logger.info(f"Starting LocalAI metrics exporter on port {self.port}")
        
        # Start Prometheus HTTP server
        start_http_server(self.port)
        
        # Start metrics collection in background thread
        collection_thread = threading.Thread(target=self.metrics_collection_loop)
        collection_thread.daemon = True
        collection_thread.start()
        
        logger.info(f"Metrics available at http://localhost:{self.port}/metrics")
        
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutting down metrics exporter...")
            self.running = False

def main():
    parser = argparse.ArgumentParser(description='LocalAI Stack Prometheus Metrics Exporter')
    parser.add_argument('--port', '-p', type=int, default=8000, help='Port to serve metrics on')
    parser.add_argument('--log-level', '-l', default='INFO', help='Log level')
    
    args = parser.parse_args()
    
    # Configure logging
    logging.getLogger().setLevel(getattr(logging, args.log_level.upper()))
    
    exporter = LocalAIMetricsExporter(port=args.port)
    exporter.start()

if __name__ == '__main__':
    main()
