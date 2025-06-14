#!/usr/bin/env python3
"""
Docker Performance Monitor
Advanced performance monitoring and analysis for Docker containers.
"""

import docker
import psutil
import time
import json
import sqlite3
import argparse
from datetime import datetime, timedelta
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Dict, List, Optional
import threading
import signal
import sys

@dataclass
class PerformanceMetrics:
    timestamp: datetime
    container_name: str
    cpu_percent: float
    memory_usage: int
    memory_limit: int
    memory_percent: float
    network_rx: int
    network_tx: int
    disk_read: int
    disk_write: int
    pids: int

class DockerPerformanceMonitor:
    def __init__(self, db_path="monitoring/performance.db", history_hours=24):
        self.client = docker.from_env()
        self.db_path = db_path
        self.history_hours = history_hours
        self.running = True
        self.metrics_queue = deque(maxlen=1000)
        self.init_database()
        
        # Performance thresholds
        self.thresholds = {
            'cpu_warning': 70.0,
            'cpu_critical': 90.0,
            'memory_warning': 80.0,
            'memory_critical': 95.0,
            'disk_io_warning': 100 * 1024 * 1024,  # 100MB/s
            'network_io_warning': 50 * 1024 * 1024   # 50MB/s
        }
        
        # Container categories for analysis
        self.container_categories = {
            'databases': ['postgres', 'redis', 'neo4j', 'clickhouse', 'elasticsearch'],
            'ai_services': ['ollama', 'flowise', 'langfuse'],
            'web_services': ['n8n', 'open-webui', 'grafana', 'portainer'],
            'infrastructure': ['caddy', 'prometheus', 'loki', 'jaeger'],
            'storage': ['minio', 'qdrant']
        }

    def init_database(self):
        """Initialize SQLite database for metrics storage"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS performance_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                container_name TEXT NOT NULL,
                cpu_percent REAL,
                memory_usage INTEGER,
                memory_limit INTEGER,
                memory_percent REAL,
                network_rx INTEGER,
                network_tx INTEGER,
                disk_read INTEGER,
                disk_write INTEGER,
                pids INTEGER
            )
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_timestamp_container 
            ON performance_metrics(timestamp, container_name)
        ''')
        
        conn.commit()
        conn.close()

    def collect_metrics(self, container) -> Optional[PerformanceMetrics]:
        """Collect performance metrics for a single container"""
        try:
            if container.status != 'running':
                return None
                
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
            
            # Memory metrics
            memory_stats = stats['memory_stats']
            memory_usage = memory_stats.get('usage', 0)
            memory_limit = memory_stats.get('limit', 1)
            memory_percent = (memory_usage / memory_limit) * 100.0
            
            # Network I/O
            network_rx = network_tx = 0
            if 'networks' in stats:
                for interface, net_stats in stats['networks'].items():
                    network_rx += net_stats['rx_bytes']
                    network_tx += net_stats['tx_bytes']
            
            # Disk I/O
            disk_read = disk_write = 0
            if 'blkio_stats' in stats and 'io_service_bytes_recursive' in stats['blkio_stats']:
                for entry in stats['blkio_stats']['io_service_bytes_recursive']:
                    if entry['op'] == 'Read':
                        disk_read += entry['value']
                    elif entry['op'] == 'Write':
                        disk_write += entry['value']
            
            # Process count
            pids = stats.get('pids_stats', {}).get('current', 0)
            
            return PerformanceMetrics(
                timestamp=datetime.now(),
                container_name=container.name,
                cpu_percent=round(cpu_percent, 2),
                memory_usage=memory_usage,
                memory_limit=memory_limit,
                memory_percent=round(memory_percent, 2),
                network_rx=network_rx,
                network_tx=network_tx,
                disk_read=disk_read,
                disk_write=disk_write,
                pids=pids
            )
            
        except Exception as e:
            print(f"Error collecting metrics for {container.name}: {e}")
            return None

    def store_metrics(self, metrics: PerformanceMetrics):
        """Store metrics in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO performance_metrics 
            (timestamp, container_name, cpu_percent, memory_usage, memory_limit, 
             memory_percent, network_rx, network_tx, disk_read, disk_write, pids)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            metrics.timestamp.isoformat(),
            metrics.container_name,
            metrics.cpu_percent,
            metrics.memory_usage,
            metrics.memory_limit,
            metrics.memory_percent,
            metrics.network_rx,
            metrics.network_tx,
            metrics.disk_read,
            metrics.disk_write,
            metrics.pids
        ))
        
        conn.commit()
        conn.close()

    def cleanup_old_data(self):
        """Remove old performance data"""
        cutoff_time = datetime.now() - timedelta(hours=self.history_hours)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            'DELETE FROM performance_metrics WHERE timestamp < ?',
            (cutoff_time.isoformat(),)
        )
        
        conn.commit()
        conn.close()

    def get_performance_summary(self, hours=1) -> Dict:
        """Get performance summary for the last N hours"""
        start_time = datetime.now() - timedelta(hours=hours)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                container_name,
                AVG(cpu_percent) as avg_cpu,
                MAX(cpu_percent) as max_cpu,
                AVG(memory_percent) as avg_memory,
                MAX(memory_percent) as max_memory,
                COUNT(*) as sample_count
            FROM performance_metrics 
            WHERE timestamp > ?
            GROUP BY container_name
            ORDER BY avg_cpu DESC
        ''', (start_time.isoformat(),))
        
        results = cursor.fetchall()
        conn.close()
        
        summary = {}
        for row in results:
            container_name, avg_cpu, max_cpu, avg_memory, max_memory, sample_count = row
            summary[container_name] = {
                'avg_cpu': round(avg_cpu, 2),
                'max_cpu': round(max_cpu, 2),
                'avg_memory': round(avg_memory, 2),
                'max_memory': round(max_memory, 2),
                'sample_count': sample_count
            }
        
        return summary

    def get_resource_trends(self, container_name: str, hours=6) -> Dict:
        """Get resource usage trends for a specific container"""
        start_time = datetime.now() - timedelta(hours=hours)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT timestamp, cpu_percent, memory_percent, network_rx, network_tx
            FROM performance_metrics 
            WHERE container_name = ? AND timestamp > ?
            ORDER BY timestamp
        ''', (container_name, start_time.isoformat()))
        
        results = cursor.fetchall()
        conn.close()
        
        if not results:
            return {}
        
        # Calculate trends (simplified linear regression)
        timestamps = [(datetime.fromisoformat(row[0]) - start_time).total_seconds() for row in results]
        cpu_values = [row[1] for row in results]
        memory_values = [row[2] for row in results]
        
        def calculate_trend(x_values, y_values):
            n = len(x_values)
            if n < 2:
                return 0
            
            sum_x = sum(x_values)
            sum_y = sum(y_values)
            sum_xy = sum(x * y for x, y in zip(x_values, y_values))
            sum_x2 = sum(x * x for x in x_values)
            
            slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
            return slope
        
        cpu_trend = calculate_trend(timestamps, cpu_values)
        memory_trend = calculate_trend(timestamps, memory_values)
        
        return {
            'cpu_trend': round(cpu_trend * 3600, 4),  # Per hour
            'memory_trend': round(memory_trend * 3600, 4),  # Per hour
            'sample_count': len(results),
            'time_range_hours': hours
        }

    def identify_performance_anomalies(self) -> List[Dict]:
        """Identify performance anomalies and bottlenecks"""
        anomalies = []
        summary = self.get_performance_summary(hours=1)
        
        for container_name, metrics in summary.items():
            # High CPU usage
            if metrics['max_cpu'] > self.thresholds['cpu_critical']:
                anomalies.append({
                    'container': container_name,
                    'type': 'cpu_spike',
                    'severity': 'critical',
                    'value': metrics['max_cpu'],
                    'description': f"CPU usage peaked at {metrics['max_cpu']}%"
                })
            elif metrics['avg_cpu'] > self.thresholds['cpu_warning']:
                anomalies.append({
                    'container': container_name,
                    'type': 'cpu_high',
                    'severity': 'warning',
                    'value': metrics['avg_cpu'],
                    'description': f"Average CPU usage: {metrics['avg_cpu']}%"
                })
            
            # High memory usage
            if metrics['max_memory'] > self.thresholds['memory_critical']:
                anomalies.append({
                    'container': container_name,
                    'type': 'memory_spike',
                    'severity': 'critical',
                    'value': metrics['max_memory'],
                    'description': f"Memory usage peaked at {metrics['max_memory']}%"
                })
            elif metrics['avg_memory'] > self.thresholds['memory_warning']:
                anomalies.append({
                    'container': container_name,
                    'type': 'memory_high',
                    'severity': 'warning',
                    'value': metrics['avg_memory'],
                    'description': f"Average memory usage: {metrics['avg_memory']}%"
                })
        
        return anomalies

    def categorize_containers(self) -> Dict[str, List[str]]:
        """Categorize containers by their function"""
        containers = self.client.containers.list()
        categorized = defaultdict(list)
        
        for container in containers:
            name = container.name.lower()
            category_found = False
            
            for category, keywords in self.container_categories.items():
                if any(keyword in name for keyword in keywords):
                    categorized[category].append(container.name)
                    category_found = True
                    break
            
            if not category_found:
                categorized['other'].append(container.name)
        
        return dict(categorized)

    def generate_performance_report(self, hours=24) -> Dict:
        """Generate comprehensive performance report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'analysis_period_hours': hours,
            'system_info': {
                'cpu_count': psutil.cpu_count(),
                'memory_total': psutil.virtual_memory().total,
                'disk_usage': psutil.disk_usage('/').percent
            },
            'container_summary': self.get_performance_summary(hours),
            'anomalies': self.identify_performance_anomalies(),
            'categories': self.categorize_containers(),
            'recommendations': []
        }
        
        # Generate recommendations
        anomalies = report['anomalies']
        high_cpu_containers = [a['container'] for a in anomalies if a['type'].startswith('cpu')]
        high_memory_containers = [a['container'] for a in anomalies if a['type'].startswith('memory')]
        
        if high_cpu_containers:
            report['recommendations'].append({
                'type': 'cpu_optimization',
                'containers': high_cpu_containers,
                'suggestion': 'Consider CPU limits, optimization, or scaling for high CPU usage containers'
            })
        
        if high_memory_containers:
            report['recommendations'].append({
                'type': 'memory_optimization',
                'containers': high_memory_containers,
                'suggestion': 'Review memory limits and optimize memory usage for these containers'
            })
        
        return report

    def monitor_continuous(self, interval=30):
        """Continuous monitoring loop"""
        print(f"🚀 Starting continuous Docker performance monitoring (interval: {interval}s)")
        
        def signal_handler(signum, frame):
            print("\n👋 Stopping monitoring...")
            self.running = False
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        while self.running:
            try:
                containers = self.client.containers.list()
                
                for container in containers:
                    metrics = self.collect_metrics(container)
                    if metrics:
                        self.store_metrics(metrics)
                        self.metrics_queue.append(metrics)
                
                # Cleanup old data periodically
                if len(self.metrics_queue) % 100 == 0:
                    self.cleanup_old_data()
                
                print(f"📊 Collected metrics for {len(containers)} containers at {datetime.now().strftime('%H:%M:%S')}")
                
                time.sleep(interval)
                
            except Exception as e:
                print(f"❌ Error in monitoring loop: {e}")
                time.sleep(interval)
        
        print("✅ Monitoring stopped")

def main():
    parser = argparse.ArgumentParser(description='Docker Performance Monitor')
    parser.add_argument('--continuous', '-c', action='store_true', help='Run continuous monitoring')
    parser.add_argument('--interval', '-i', type=int, default=30, help='Monitoring interval in seconds')
    parser.add_argument('--report', '-r', action='store_true', help='Generate performance report')
    parser.add_argument('--hours', type=int, default=24, help='Hours of data to analyze')
    parser.add_argument('--container', type=str, help='Analyze specific container trends')
    parser.add_argument('--export', '-e', type=str, help='Export report to JSON file')
    
    args = parser.parse_args()
    
    monitor = DockerPerformanceMonitor()
    
    if args.continuous:
        monitor.monitor_continuous(args.interval)
    elif args.container:
        trends = monitor.get_resource_trends(args.container, args.hours)
        print(f"📈 Resource trends for {args.container} (last {args.hours} hours):")
        print(json.dumps(trends, indent=2))
    elif args.report:
        report = monitor.generate_performance_report(args.hours)
        
        if args.export:
            with open(args.export, 'w') as f:
                json.dump(report, f, indent=2)
            print(f"📄 Report exported to: {args.export}")
        else:
            print("📊 Performance Report:")
            print("=" * 50)
            
            # Summary
            print(f"Analysis Period: {args.hours} hours")
            print(f"Containers Analyzed: {len(report['container_summary'])}")
            print(f"Anomalies Found: {len(report['anomalies'])}")
            
            # Top resource users
            if report['container_summary']:
                print("\n🔥 Top CPU Users:")
                sorted_containers = sorted(
                    report['container_summary'].items(),
                    key=lambda x: x[1]['avg_cpu'],
                    reverse=True
                )[:5]
                
                for name, metrics in sorted_containers:
                    print(f"  {name}: {metrics['avg_cpu']}% avg, {metrics['max_cpu']}% max")
            
            # Anomalies
            if report['anomalies']:
                print("\n⚠️  Performance Anomalies:")
                for anomaly in report['anomalies']:
                    severity_emoji = {'critical': '🔴', 'warning': '🟡'}.get(anomaly['severity'], '🔵')
                    print(f"  {severity_emoji} {anomaly['container']}: {anomaly['description']}")
            
            # Recommendations
            if report['recommendations']:
                print("\n💡 Recommendations:")
                for rec in report['recommendations']:
                    print(f"  • {rec['suggestion']}")
                    print(f"    Affected: {', '.join(rec['containers'])}")
    else:
        # Single snapshot
        containers = monitor.client.containers.list()
        print(f"📊 Current Performance Snapshot ({len(containers)} containers)")
        print("=" * 70)
        
        for container in containers:
            metrics = monitor.collect_metrics(container)
            if metrics:
                print(f"{container.name:20} | CPU: {metrics.cpu_percent:6.1f}% | "
                      f"Memory: {metrics.memory_percent:6.1f}% | PIDs: {metrics.pids:4d}")

if __name__ == '__main__':
    main()
