#!/usr/bin/env python3
"""
LocalAI Stack Web Monitoring Dashboard
Real-time web-based dashboard for monitoring Docker container health and metrics.
Enhanced with template gallery integration and optimized monitoring.
"""

import json
import asyncio
import aiohttp
from aiohttp import web, WSMsgType
import aiohttp_cors
import docker
import psutil
import time
from datetime import datetime
import socket
import weakref
import signal
import sys
import os
import requests
from collections import defaultdict, deque

class WebMonitoringDashboard:
    def __init__(self, port=8888):
        self.port = port
        self.client = docker.from_env()
        self.websockets = weakref.WeakSet()
        self.monitoring_task = None
        self.app = None
        
        # Template gallery metrics
        self.template_metrics = {
            'n8n_workflows': {},
            'flowise_chatflows': {},
            'template_usage': defaultdict(int),
            'last_template_check': None
        }
        
        # Resource thresholds for alerts
        self.thresholds = {
            'cpu_warning': 70,
            'cpu_critical': 85,
            'memory_warning': 75,
            'memory_critical': 90,
            'disk_warning': 80,
            'disk_critical': 95
        }
        
        # Expected containers for LocalAI stack (consolidated from container_monitor.py)
        self.expected_containers = {
            'n8n': {'ports': [5679], 'health_endpoint': '/healthz', 'category': 'workflow'},
            'ollama': {'ports': [11435], 'health_endpoint': '/api/tags', 'category': 'ai'},
            'open-webui': {'ports': [8080], 'health_endpoint': '/health', 'category': 'ui'},
            'flowise': {'ports': [3001], 'health_endpoint': '/api/v1/ping', 'category': 'ai'},
            'qdrant': {'ports': [6333, 6334], 'health_endpoint': '/health', 'category': 'database'},
            'localai-redis': {'ports': [6380], 'health_endpoint': None, 'category': 'database'},
            'searxng': {'ports': [8082], 'health_endpoint': '/config', 'category': 'search'},
            'caddy': {'ports': [80, 443], 'health_endpoint': '/health', 'category': 'proxy'},
            'localai-neo4j-1': {'ports': [7474, 7687], 'health_endpoint': '/browser/', 'category': 'database'},
            'localai-postgres-1': {'ports': [5433], 'health_endpoint': None, 'category': 'database'},
            'localai-clickhouse-1': {'ports': [8123, 9100, 9009], 'health_endpoint': '/ping', 'category': 'database'},
            'localai-minio-1': {'ports': [9010, 9011], 'health_endpoint': '/minio/health/live', 'category': 'storage'},
            'localai-langfuse-web-1': {'ports': [3000], 'health_endpoint': '/api/public/health', 'category': 'monitoring'},
            'localai-langfuse-worker-1': {'ports': [3030], 'health_endpoint': None, 'category': 'monitoring'},
            # Template Gallery specific monitoring
            'localai-admin-dashboard': {'ports': [5174], 'health_endpoint': '/health', 'category': 'template_gallery'}
        }

    async def collect_template_metrics(self):
        """Collect metrics from template services (N8N, Flowise)"""
        try:
            # N8N workflow metrics
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get('http://localhost:5679/rest/workflows', timeout=5) as resp:
                        if resp.status == 200:
                            workflows = await resp.json()
                            self.template_metrics['n8n_workflows'] = {
                                'total': len(workflows.get('data', [])),
                                'active': len([w for w in workflows.get('data', []) if w.get('active', False)]),
                                'last_updated': datetime.now().isoformat()
                            }
            except Exception as e:
                self.template_metrics['n8n_workflows']['error'] = str(e)

            # Flowise chatflow metrics  
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get('http://localhost:3001/api/v1/chatflows', timeout=5) as resp:
                        if resp.status == 200:
                            chatflows = await resp.json()
                            self.template_metrics['flowise_chatflows'] = {
                                'total': len(chatflows),
                                'categories': len(set(cf.get('category', 'default') for cf in chatflows)),
                                'last_updated': datetime.now().isoformat()
                            }
            except Exception as e:
                self.template_metrics['flowise_chatflows']['error'] = str(e)

            self.template_metrics['last_template_check'] = datetime.now().isoformat()
            
        except Exception as e:
            print(f"Error collecting template metrics: {e}")

    async def get_enhanced_container_metrics(self, container):
        """Enhanced container metrics with resource monitoring"""
        try:
            container.reload()
            stats = container.stats(stream=False)
            
            # Calculate CPU percentage
            cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - stats['precpu_stats']['cpu_usage']['total_usage']
            system_delta = stats['cpu_stats']['system_cpu_usage'] - stats['precpu_stats']['system_cpu_usage']
            cpu_percent = (cpu_delta / system_delta) * len(stats['cpu_stats']['cpu_usage']['percpu_usage']) * 100 if system_delta > 0 else 0
            
            # Calculate memory usage
            memory_usage = stats['memory_stats']['usage']
            memory_limit = stats['memory_stats']['limit']
            memory_percent = (memory_usage / memory_limit) * 100 if memory_limit > 0 else 0
            
            # Network I/O
            networks = stats.get('networks', {})
            rx_bytes = sum(net['rx_bytes'] for net in networks.values())
            tx_bytes = sum(net['tx_bytes'] for net in networks.values())
            
            # Block I/O
            blkio_stats = stats.get('blkio_stats', {})
            read_bytes = sum(stat['value'] for stat in blkio_stats.get('io_service_bytes_recursive', []) if stat['op'] == 'Read')
            write_bytes = sum(stat['value'] for stat in blkio_stats.get('io_service_bytes_recursive', []) if stat['op'] == 'Write')

            return {
                'name': container.name,
                'status': container.status,
                'image': container.image.tags[0] if container.image.tags else 'unknown',
                'cpu_percent': round(cpu_percent, 2),
                'memory_usage_mb': round(memory_usage / 1024 / 1024, 2),
                'memory_percent': round(memory_percent, 2),
                'network_rx_mb': round(rx_bytes / 1024 / 1024, 2),
                'network_tx_mb': round(tx_bytes / 1024 / 1024, 2),
                'block_read_mb': round(read_bytes / 1024 / 1024, 2),
                'block_write_mb': round(write_bytes / 1024 / 1024, 2),
                'pids': stats.get('pids_stats', {}).get('current', 0),
                'restart_count': container.attrs['RestartCount'],
                'health_status': self.get_container_health(container),
                'ports': self.get_container_ports(container),
                'category': self.expected_containers.get(container.name, {}).get('category', 'unknown'),
                'alerts': self.generate_container_alerts(container.name, cpu_percent, memory_percent)
            }
            
        except Exception as e:
            return {'name': container.name, 'error': str(e)}

    def get_container_health(self, container):
        """Get container health status"""
        health = container.attrs.get('State', {}).get('Health', {})
        if health:
            return health.get('Status', 'unknown')
        return 'no-healthcheck'

    def get_container_ports(self, container):
        """Get container port mappings"""
        ports = container.attrs.get('NetworkSettings', {}).get('Ports', {})
        port_list = []
        for internal, external in ports.items():
            if external:
                port_list.append(f"{external[0]['HostPort']}:{internal.split('/')[0]}")
        return port_list

    def generate_container_alerts(self, name, cpu_percent, memory_percent):
        """Generate alerts for container resource usage"""
        alerts = []
        
        if cpu_percent > self.thresholds['cpu_critical']:
            alerts.append(f"🔥 CRITICAL: {name} CPU usage critical ({cpu_percent:.1f}%)")
        elif cpu_percent > self.thresholds['cpu_warning']:
            alerts.append(f"⚠️ WARNING: {name} CPU usage high ({cpu_percent:.1f}%)")
            
        if memory_percent > self.thresholds['memory_critical']:
            alerts.append(f"🔥 CRITICAL: {name} memory usage critical ({memory_percent:.1f}%)")
        elif memory_percent > self.thresholds['memory_warning']:
            alerts.append(f"⚠️ WARNING: {name} memory usage high ({memory_percent:.1f}%)")
            
        return alerts

    async def check_service_health(self, service_name, config):
        """Check individual service health endpoint"""
        if not config.get('health_endpoint'):
            return {'status': 'no-check', 'message': 'No health endpoint configured'}
            
        port = config['ports'][0] if config['ports'] else 80
        url = f"http://localhost:{port}{config['health_endpoint']}"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=5) as resp:
                    return {
                        'status': 'healthy' if resp.status == 200 else 'unhealthy',
                        'status_code': resp.status,
                        'response_time_ms': resp.headers.get('X-Response-Time', 'unknown')
                    }
        except Exception as e:
            return {'status': 'error', 'message': str(e)}

    async def get_container_metrics(self):
        """Get metrics for all containers"""
        try:
            containers = self.client.containers.list(all=True)
            localai_containers = [c for c in containers if any(name in c.name for name in self.expected_containers.keys())]
            
            metrics = {
                'timestamp': datetime.now().isoformat(),
                'system': self.get_system_metrics(),
                'containers': {}
            }
            
            for container in localai_containers:
                container_data = await self.get_single_container_metrics(container)
                metrics['containers'][container.name] = container_data
            
            return metrics
            
        except Exception as e:
            return {'error': str(e), 'timestamp': datetime.now().isoformat()}
    
    def get_system_metrics(self):
        """Get system-wide metrics"""
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            'cpu_percent': psutil.cpu_percent(interval=0.1),
            'memory': {
                'total': memory.total,
                'used': memory.used,
                'available': memory.available,
                'percent': memory.percent
            },
            'disk': {
                'total': disk.total,
                'used': disk.used,
                'free': disk.free,
                'percent': (disk.used / disk.total) * 100
            },
            'load_avg': list(os.getloadavg()) if hasattr(os, 'getloadavg') else [0, 0, 0]
        }
    
    async def get_single_container_metrics(self, container):
        """Get metrics for a single container"""
        try:
            container.reload()
            
            # Basic container info
            container_info = {
                'name': container.name,
                'status': container.status,
                'image': container.image.tags[0] if container.image.tags else 'unknown',
                'created': container.attrs['Created'],
                'started_at': container.attrs['State'].get('StartedAt', ''),
                'restart_count': container.attrs['RestartCount'],
                'category': self.expected_containers.get(container.name, {}).get('category', 'other')
            }
            
            # Health status
            health = container.attrs.get('State', {}).get('Health', {})
            container_info['health_status'] = health.get('Status', 'unknown')
            
            # Port connectivity
            expected_ports = self.expected_containers.get(container.name, {}).get('ports', [])
            accessible_ports = await self.check_ports_async(expected_ports)
            container_info['ports'] = {
                'expected': expected_ports,
                'accessible': accessible_ports,
                'status': 'healthy' if len(accessible_ports) == len(expected_ports) and len(expected_ports) > 0 else 'degraded' if len(accessible_ports) > 0 else 'unhealthy'
            }
            
            # Resource metrics (only if container is running)
            if container.status == 'running':
                try:
                    stats = container.stats(stream=False)
                    resource_metrics = self.calculate_resource_metrics(stats)
                    container_info.update(resource_metrics)
                except:
                    container_info['metrics_error'] = 'Unable to get resource metrics'
            
            # Health endpoint check
            health_endpoint = self.expected_containers.get(container.name, {}).get('health_endpoint')
            if health_endpoint:
                expected_ports = self.expected_containers.get(container.name, {}).get('ports', [])
                if expected_ports:
                    port = expected_ports[0]
                    full_url = f"http://localhost:{port}{health_endpoint}"
                    endpoint_status = await self.check_health_endpoint(full_url)
                    container_info['endpoint_health'] = endpoint_status
            
            return container_info
            
        except Exception as e:
            return {'name': container.name, 'error': str(e)}
    
    def calculate_resource_metrics(self, stats):
        """Calculate resource usage metrics from Docker stats"""
        try:
            # CPU calculation
            cpu_stats = stats['cpu_stats']
            precpu_stats = stats['precpu_stats']
            
            cpu_delta = cpu_stats['cpu_usage']['total_usage'] - precpu_stats['cpu_usage']['total_usage']
            system_cpu_delta = cpu_stats['system_cpu_usage'] - precpu_stats['system_cpu_usage']
            number_cpus = len(cpu_stats['cpu_usage']['percpu_usage'])
            
            cpu_percent = 0.0
            if system_cpu_delta > 0 and cpu_delta > 0:
                cpu_percent = (cpu_delta / system_cpu_delta) * number_cpus * 100.0
            
            # Memory calculation
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
                'cpu_percent': round(cpu_percent, 2),
                'memory_usage': memory_usage,
                'memory_limit': memory_limit,
                'memory_percent': round(memory_percent, 2),
                'network_rx': network_rx,
                'network_tx': network_tx,
                'block_read': block_read,
                'block_write': block_write,
                'pids': stats.get('pids_stats', {}).get('current', 0)
            }
            
        except Exception as e:
            return {'metrics_error': str(e)}
    
    async def check_ports_async(self, ports):
        """Asynchronously check port connectivity"""
        accessible_ports = []
        
        async def check_port(port):
            try:
                _, writer = await asyncio.wait_for(
                    asyncio.open_connection('127.0.0.1', port),
                    timeout=1.0
                )
                writer.close()
                await writer.wait_closed()
                return port
            except:
                return None
        
        tasks = [check_port(port) for port in ports]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, int):
                accessible_ports.append(result)
        
        return accessible_ports
    
    async def check_health_endpoint(self, endpoint):
        """Check if health endpoint is responding"""
        try:
            timeout = aiohttp.ClientTimeout(total=3)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(endpoint) as response:
                    return {
                        'status': 'healthy' if response.status == 200 else 'unhealthy',
                        'status_code': response.status,
                        'response_time': response.headers.get('X-Response-Time', 'unknown')
                    }
        except asyncio.TimeoutError:
            return {'status': 'timeout', 'error': 'Request timeout'}
        except Exception as e:
            return {'status': 'error', 'error': str(e)}
    
    async def websocket_handler(self, request):
        """Handle WebSocket connections"""
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        
        self.websockets.add(ws)
        print(f"📱 WebSocket client connected. Total clients: {len(self.websockets)}")
        
        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                        if data.get('type') == 'ping':
                            await ws.send_str(json.dumps({'type': 'pong'}))
                    except json.JSONDecodeError:
                        pass
                elif msg.type == WSMsgType.ERROR:
                    print(f"WebSocket error: {ws.exception()}")
        except Exception as e:
            print(f"WebSocket handler error: {e}")
        finally:
            print(f"📱 WebSocket client disconnected. Total clients: {len(self.websockets)}")
        
        return ws
    
    async def broadcast_metrics(self):
        """Broadcast metrics to all connected WebSocket clients"""
        if not self.websockets:
            return
        
        try:
            metrics = await self.get_container_metrics()
            message = json.dumps({
                'type': 'metrics',
                'data': metrics
            })
            
            # Send to all connected clients
            disconnected = []
            for ws in self.websockets:
                try:
                    await ws.send_str(message)
                except ConnectionResetError:
                    disconnected.append(ws)
                except Exception as e:
                    print(f"Error sending to websocket: {e}")
                    disconnected.append(ws)
            
            # Remove disconnected clients
            for ws in disconnected:
                self.websockets.discard(ws)
                
        except Exception as e:
            print(f"Error broadcasting metrics: {e}")
    
    async def monitoring_loop(self):
        """Main monitoring loop that broadcasts metrics"""
        while True:
            try:
                await self.broadcast_metrics()
                await asyncio.sleep(5)  # Update every 5 seconds
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Monitoring loop error: {e}")
                await asyncio.sleep(5)
    
    async def static_handler(self, request):
        """Serve the main dashboard HTML"""
        html_content = self.get_dashboard_html()
        return web.Response(text=html_content, content_type='text/html')

    async def metrics_api_handler(self, request):
        """API endpoint for metrics data"""
        try:
            metrics = await self.get_container_metrics()
            
            # Add template metrics
            await self.collect_template_metrics()
            metrics['template_gallery'] = self.template_metrics
            
            return web.json_response(metrics)
        except Exception as e:
            return web.json_response({'error': str(e)}, status=500)

    async def health_api_handler(self, request):
        """API endpoint for health status"""
        try:
            containers = self.client.containers.list(all=True)
            localai_containers = [c for c in containers if any(name in c.name for name in self.expected_containers.keys())]
            
            health_status = {
                'timestamp': datetime.now().isoformat(),
                'total_containers': len(localai_containers),
                'running_containers': len([c for c in localai_containers if c.status == 'running']),
                'healthy_containers': 0,
                'services': {}
            }
            
            for container in localai_containers:
                container_name = container.name
                health = self.get_container_health(container)
                if health == 'healthy':
                    health_status['healthy_containers'] += 1
                
                health_status['services'][container_name] = {
                    'status': container.status,
                    'health': health,
                    'category': self.expected_containers.get(container_name, {}).get('category', 'unknown')
                }
            
            return web.json_response(health_status)
        except Exception as e:
            return web.json_response({'error': str(e)}, status=500)
    
    def get_dashboard_html(self):
        """Generate the HTML dashboard"""
        return '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FetchText Stack Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #1a1a1a; 
            color: #ffffff; 
            line-height: 1.6;
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            padding: 1rem; 
            text-align: center; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        .header h1 { margin-bottom: 0.5rem; }
        .connection-status { 
            display: inline-block; 
            padding: 0.25rem 0.5rem; 
            border-radius: 20px; 
            font-size: 0.8rem; 
            margin-left: 1rem;
        }
        .connected { background: #28a745; }
        .disconnected { background: #dc3545; }
        .main-container { display: flex; min-height: calc(100vh - 120px); }
        .sidebar { 
            width: 300px; 
            background: #2d2d2d; 
            padding: 1rem; 
            border-right: 1px solid #444;
        }
        .content { flex: 1; padding: 1rem; }
        .system-overview { 
            background: #333; 
            padding: 1rem; 
            border-radius: 8px; 
            margin-bottom: 1rem;
        }
        .metric-card { 
            background: #444; 
            padding: 0.5rem; 
            border-radius: 4px; 
            margin-bottom: 0.5rem;
        }
        .containers-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); 
            gap: 1rem;
        }
        .container-card { 
            background: #333; 
            border-radius: 8px; 
            padding: 1rem; 
            border-left: 4px solid #666;
        }
        .container-card.running { border-left-color: #28a745; }
        .container-card.stopped { border-left-color: #dc3545; }
        .container-card.restarting { border-left-color: #ffc107; }
        .container-header { 
            display: flex; 
            justify-content: between; 
            align-items: center; 
            margin-bottom: 0.5rem;
        }
        .container-name { font-weight: bold; font-size: 1.1rem; }
        .status-badge { 
            padding: 0.2rem 0.5rem; 
            border-radius: 12px; 
            font-size: 0.8rem; 
            margin-left: auto;
        }
        .status-running { background: #28a745; }
        .status-stopped { background: #dc3545; }
        .status-restarting { background: #ffc107; color: #000; }
        .metrics-row { 
            display: flex; 
            justify-content: space-between; 
            margin: 0.25rem 0;
        }
        .progress-bar { 
            width: 100%; 
            height: 8px; 
            background: #555; 
            border-radius: 4px; 
            overflow: hidden; 
            margin: 0.25rem 0;
        }
        .progress-fill { 
            height: 100%; 
            background: linear-gradient(90deg, #28a745, #ffc107, #dc3545); 
            transition: width 0.3s ease;
        }
        .ports-info { 
            font-size: 0.9rem; 
            color: #ccc; 
            margin-top: 0.5rem;
        }
        .category-section { margin-bottom: 2rem; }
        .category-header { 
            background: #444; 
            padding: 0.5rem 1rem; 
            border-radius: 4px; 
            margin-bottom: 1rem; 
            font-weight: bold;
        }
        .loading { text-align: center; padding: 2rem; color: #666; }
        .error { background: #dc3545; color: white; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 FetchText Stack Monitor</h1>
        <span id="lastUpdate">Last updated: Never</span>
        <span id="connectionStatus" class="connection-status disconnected">Disconnected</span>
    </div>
    
    <div class="main-container">
        <div class="sidebar">
            <div class="system-overview">
                <h3>🖥️ System Overview</h3>
                <div id="systemMetrics" class="loading">Loading...</div>
            </div>
            
            <div class="stats-summary">
                <h3>📊 Summary</h3>
                <div id="summaryStats" class="loading">Loading...</div>
            </div>
        </div>
        
        <div class="content">
            <div id="containersGrid" class="loading">
                Connecting to monitoring service...
            </div>
        </div>
    </div>

    <script>
        class MonitoringDashboard {
            constructor() {
                this.ws = null;
                this.reconnectInterval = 5000;
                this.connect();
            }
            
            connect() {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/ws`;
                
                try {
                    this.ws = new WebSocket(wsUrl);
                    
                    this.ws.onopen = () => {
                        console.log('Connected to monitoring service');
                        this.updateConnectionStatus(true);
                    };
                    
                    this.ws.onmessage = (event) => {
                        const data = JSON.parse(event.data);
                        if (data.type === 'metrics') {
                            this.updateDashboard(data.data);
                        }
                    };
                    
                    this.ws.onclose = () => {
                        console.log('Disconnected from monitoring service');
                        this.updateConnectionStatus(false);
                        setTimeout(() => this.connect(), this.reconnectInterval);
                    };
                    
                    this.ws.onerror = (error) => {
                        console.error('WebSocket error:', error);
                        this.updateConnectionStatus(false);
                    };
                } catch (error) {
                    console.error('Failed to connect:', error);
                    this.updateConnectionStatus(false);
                    setTimeout(() => this.connect(), this.reconnectInterval);
                }
            }
            
            updateConnectionStatus(connected) {
                const statusEl = document.getElementById('connectionStatus');
                statusEl.textContent = connected ? 'Connected' : 'Disconnected';
                statusEl.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
            }
            
            updateDashboard(data) {
                if (data.error) {
                    document.getElementById('containersGrid').innerHTML = 
                        `<div class="error">Error: ${data.error}</div>`;
                    return;
                }
                
                this.updateSystemMetrics(data.system);
                this.updateContainers(data.containers);
                this.updateSummary(data.containers);
                
                document.getElementById('lastUpdate').textContent = 
                    `Last updated: ${new Date(data.timestamp).toLocaleTimeString()}`;
            }
            
            updateSystemMetrics(system) {
                const systemEl = document.getElementById('systemMetrics');
                systemEl.innerHTML = `
                    <div class="metric-card">
                        <div>CPU: ${system.cpu_percent.toFixed(1)}%</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${system.cpu_percent}%"></div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div>Memory: ${system.memory.percent.toFixed(1)}% (${this.formatBytes(system.memory.used)}/${this.formatBytes(system.memory.total)})</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${system.memory.percent}%"></div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div>Disk: ${system.disk.percent.toFixed(1)}% (${this.formatBytes(system.disk.used)}/${this.formatBytes(system.disk.total)})</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${system.disk.percent}%"></div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div>Load: ${system.load_avg.map(l => l.toFixed(2)).join(', ')}</div>
                    </div>
                `;
            }
            
            updateContainers(containers) {
                const categories = {
                    'workflow': '🔄 Workflow',
                    'ai': '🤖 AI Services', 
                    'ui': '🎨 User Interface',
                    'template_gallery': '🎨 Template Gallery',
                    'database': '🗄️ Databases',
                    'storage': '💾 Storage',
                    'monitoring': '📊 Monitoring',
                    'search': '🔍 Search',
                    'proxy': '🌐 Proxy',
                    'other': '🔧 Other'
                };
                
                const containersByCategory = {};
                Object.values(containers).forEach(container => {
                    const category = container.category || 'other';
                    if (!containersByCategory[category]) {
                        containersByCategory[category] = [];
                    }
                    containersByCategory[category].push(container);
                });
                
                let html = '';
                Object.entries(categories).forEach(([category, title]) => {
                    if (containersByCategory[category]) {
                        html += `
                            <div class="category-section">
                                <div class="category-header">${title}</div>
                                <div class="containers-grid">
                                    ${containersByCategory[category].map(container => this.renderContainer(container)).join('')}
                                </div>
                            </div>
                        `;
                    }
                });
                
                document.getElementById('containersGrid').innerHTML = html || '<div class="loading">No containers found</div>';
            }
            
            renderContainer(container) {
                const statusClass = container.status || 'unknown';
                const healthEmoji = container.health_status === 'healthy' ? '💚' : 
                                   container.health_status === 'unhealthy' ? '❤️' : '💛';
                
                let metricsHtml = '';
                if (container.cpu_percent !== undefined) {
                    metricsHtml = `
                        <div class="metrics-row">
                            <span>CPU: ${container.cpu_percent}%</span>
                            <span>Memory: ${container.memory_percent.toFixed(1)}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.max(container.cpu_percent, container.memory_percent)}%"></div>
                        </div>
                        <div class="metrics-row">
                            <span>Memory: ${this.formatBytes(container.memory_usage)}</span>
                            <span>PIDs: ${container.pids}</span>
                        </div>
                    `;
                }
                
                let portsHtml = '';
                if (container.ports) {
                    const portStatus = container.ports.status === 'healthy' ? '🟢' : 
                                     container.ports.status === 'degraded' ? '🟡' : '🔴';
                    portsHtml = `
                        <div class="ports-info">
                            ${portStatus} Ports: ${container.ports.accessible.join(', ') || 'None'} 
                            ${container.ports.expected.length > 0 ? `(expected: ${container.ports.expected.join(', ')})` : ''}
                        </div>
                    `;
                }
                
                return `
                    <div class="container-card ${statusClass}">
                        <div class="container-header">
                            <div class="container-name">${container.name}</div>
                            <div class="status-badge status-${statusClass}">${container.status}</div>
                        </div>
                        <div class="metrics-row">
                            <span>${healthEmoji} Health: ${container.health_status || 'unknown'}</span>
                            <span>Restarts: ${container.restart_count || 0}</span>
                        </div>
                        ${metricsHtml}
                        ${portsHtml}
                        ${container.endpoint_health ? `
                            <div class="metrics-row">
                                <span>Endpoint: ${container.endpoint_health.status}</span>
                                ${container.endpoint_health.status_code ? `<span>Status: ${container.endpoint_health.status_code}</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            
            updateSummary(containers) {
                const total = Object.keys(containers).length;
                const running = Object.values(containers).filter(c => c.status === 'running').length;
                const healthy = Object.values(containers).filter(c => c.health_status === 'healthy').length;
                
                document.getElementById('summaryStats').innerHTML = `
                    <div class="metric-card">
                        <div>Total Containers: ${total}</div>
                    </div>
                    <div class="metric-card">
                        <div>Running: ${running}/${total}</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(running/total)*100}%"></div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div>Healthy: ${healthy}/${total}</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(healthy/total)*100}%"></div>
                        </div>
                    </div>
                `;
            }
            
            formatBytes(bytes) {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
            }
        }
        
        // Initialize dashboard when page loads
        document.addEventListener('DOMContentLoaded', () => {
            new MonitoringDashboard();
        });
    </script>
</body>
</html>
        '''
    
    async def init_app(self):
        """Initialize the web application"""
        self.app = web.Application()
        
        # Add CORS support
        cors = aiohttp_cors.setup(self.app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*"
            )
        })
        
        # Routes
        self.app.router.add_get('/', self.static_handler)
        self.app.router.add_get('/ws', self.websocket_handler)
        self.app.router.add_get('/api/metrics', self.metrics_api_handler)
        self.app.router.add_get('/api/health', self.health_api_handler)
        
        # Add CORS to all routes
        for route in list(self.app.router.routes()):
            cors.add(route)
        
        return self.app
    
    async def start_server(self):
        """Start the web server and monitoring"""
        app = await self.init_app()
        
        # Start monitoring task
        self.monitoring_task = asyncio.create_task(self.monitoring_loop())
        
        # Start web server
        runner = web.AppRunner(app)
        await runner.setup()
        
        site = web.TCPSite(runner, '127.0.0.1', self.port)
        await site.start()
        
        print(f"🌐 Web dashboard started at http://127.0.0.1:{self.port}")
        print("📊 Real-time container monitoring active")
        print("💡 Press Ctrl+C to stop the server")
        
        # Keep server running
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            print("\n🛑 Shutting down monitoring dashboard...")
            if self.monitoring_task:
                self.monitoring_task.cancel()
            await runner.cleanup()

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='LocalAI Stack Web Monitoring Dashboard')
    parser.add_argument('--port', '-p', type=int, default=8888, help='Web server port (default: 8888)')
    
    args = parser.parse_args()
    
    dashboard = WebMonitoringDashboard(port=args.port)
    
    try:
        asyncio.run(dashboard.start_server())
    except KeyboardInterrupt:
        print("\n👋 Dashboard stopped")

if __name__ == '__main__':
    main()
