#!/usr/bin/env python3
"""
Docker Container Lifecycle Monitor
Monitors container lifecycle events, restarts, and health changes.
"""

import docker
import json
import sqlite3
import time
import signal
import sys
from datetime import datetime, timedelta
from typing import Dict, List
from collections import defaultdict
import threading

class DockerLifecycleMonitor:
    def __init__(self, db_path="monitoring/lifecycle.db"):
        self.client = docker.from_env()
        self.db_path = db_path
        self.running = True
        self.event_counters = defaultdict(int)
        self.container_states = {}
        self.init_database()
        
    def init_database(self):
        """Initialize SQLite database for lifecycle events"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS lifecycle_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                container_name TEXT NOT NULL,
                container_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                event_action TEXT NOT NULL,
                status TEXT,
                exit_code INTEGER,
                metadata TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS container_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                container_name TEXT NOT NULL,
                uptime_seconds INTEGER,
                restart_count INTEGER,
                last_restart TEXT,
                health_status TEXT,
                resource_usage TEXT
            )
        ''')
        
        conn.commit()
        conn.close()
        
    def log_event(self, container_name: str, container_id: str, event_type: str, 
                  event_action: str, status: str = None, exit_code: int = None, 
                  metadata: Dict = None):
        """Log lifecycle event to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO lifecycle_events 
            (timestamp, container_name, container_id, event_type, event_action, status, exit_code, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            datetime.now().isoformat(),
            container_name,
            container_id,
            event_type,
            event_action,
            status,
            exit_code,
            json.dumps(metadata) if metadata else None
        ))
        
        conn.commit()
        conn.close()
        
    def monitor_events(self):
        """Monitor Docker events in real-time"""
        try:
            for event in self.client.events(decode=True):
                if not self.running:
                    break
                    
                self.process_event(event)
                
        except Exception as e:
            print(f"Error monitoring events: {e}")
            
    def process_event(self, event: Dict):
        """Process individual Docker event"""
        event_type = event.get('Type', 'unknown')
        action = event.get('Action', 'unknown')
        
        if event_type == 'container':
            attributes = event.get('Actor', {}).get('Attributes', {})
            container_name = attributes.get('name', 'unknown')
            container_id = event.get('Actor', {}).get('ID', 'unknown')
            
            # Log significant events
            significant_actions = [
                'start', 'stop', 'restart', 'die', 'kill', 'pause', 'unpause',
                'health_status', 'oom', 'create', 'destroy'
            ]
            
            if action in significant_actions:
                # Get additional container info
                metadata = self.get_container_metadata(container_id)
                exit_code = attributes.get('exitCode')
                
                self.log_event(
                    container_name=container_name,
                    container_id=container_id,
                    event_type=event_type,
                    event_action=action,
                    status=attributes.get('status'),
                    exit_code=int(exit_code) if exit_code else None,
                    metadata=metadata
                )
                
                # Update event counters
                self.event_counters[f"{container_name}_{action}"] += 1
                
                # Print real-time event
                timestamp = datetime.fromtimestamp(event.get('time', time.time()))
                print(f"[{timestamp.strftime('%H:%M:%S')}] "
                      f"{self.get_event_emoji(action)} "
                      f"{container_name}: {action}")
                
                # Special handling for specific events
                if action == 'die':
                    self.handle_container_death(container_name, container_id, metadata)
                elif action == 'health_status':
                    self.handle_health_change(container_name, attributes.get('health_status'))
                    
    def get_container_metadata(self, container_id: str) -> Dict:
        """Get additional container metadata"""
        try:
            container = self.client.containers.get(container_id)
            return {
                'image': container.image.tags[0] if container.image.tags else 'unknown',
                'status': container.status,
                'created': container.attrs.get('Created'),
                'restart_count': container.attrs.get('RestartCount', 0),
                'memory_limit': container.attrs.get('HostConfig', {}).get('Memory', 0),
                'cpu_shares': container.attrs.get('HostConfig', {}).get('CpuShares', 0)
            }
        except:
            return {}
            
    def get_event_emoji(self, action: str) -> str:
        """Get emoji for event type"""
        emoji_map = {
            'start': '🟢',
            'stop': '🔴',
            'restart': '🔄',
            'die': '💀',
            'kill': '⚡',
            'pause': '⏸️',
            'unpause': '▶️',
            'health_status': '🏥',
            'oom': '💥',
            'create': '🆕',
            'destroy': '🗑️'
        }
        return emoji_map.get(action, '📝')
        
    def handle_container_death(self, container_name: str, container_id: str, metadata: Dict):
        """Handle container death events"""
        exit_code = metadata.get('exit_code', 0)
        
        if exit_code != 0:
            print(f"⚠️  Container {container_name} died with exit code {exit_code}")
            
            # Check restart policy
            try:
                container = self.client.containers.get(container_id)
                restart_policy = container.attrs.get('HostConfig', {}).get('RestartPolicy', {})
                if restart_policy.get('Name') == '':
                    print(f"🚨 {container_name} has no restart policy - manual intervention needed")
            except:
                pass
                
    def handle_health_change(self, container_name: str, health_status: str):
        """Handle container health status changes"""
        if health_status == 'unhealthy':
            print(f"🔴 {container_name} is now UNHEALTHY")
        elif health_status == 'healthy':
            print(f"🟢 {container_name} is now HEALTHY")
            
    def get_lifecycle_summary(self, hours: int = 24) -> Dict:
        """Get lifecycle event summary"""
        start_time = datetime.now() - timedelta(hours=hours)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get event counts by type
        cursor.execute('''
            SELECT event_action, COUNT(*) as count
            FROM lifecycle_events 
            WHERE timestamp > ?
            GROUP BY event_action
            ORDER BY count DESC
        ''', (start_time.isoformat(),))
        
        event_counts = dict(cursor.fetchall())
        
        # Get most restarted containers
        cursor.execute('''
            SELECT container_name, COUNT(*) as restart_count
            FROM lifecycle_events 
            WHERE event_action = 'restart' AND timestamp > ?
            GROUP BY container_name
            ORDER BY restart_count DESC
            LIMIT 10
        ''', (start_time.isoformat(),))
        
        restart_counts = dict(cursor.fetchall())
        
        # Get containers that died
        cursor.execute('''
            SELECT container_name, exit_code, timestamp
            FROM lifecycle_events 
            WHERE event_action = 'die' AND timestamp > ?
            ORDER BY timestamp DESC
            LIMIT 10
        ''', (start_time.isoformat(),))
        
        deaths = cursor.fetchall()
        
        conn.close()
        
        return {
            'period_hours': hours,
            'event_counts': event_counts,
            'most_restarted': restart_counts,
            'recent_deaths': deaths,
            'total_events': sum(event_counts.values())
        }
        
    def get_container_uptime_report(self) -> Dict:
        """Get container uptime report"""
        containers = self.client.containers.list(all=True)
        uptime_data = {}
        
        for container in containers:
            try:
                created = datetime.fromisoformat(
                    container.attrs['Created'].replace('Z', '+00:00')
                )
                
                if container.status == 'running':
                    started = datetime.fromisoformat(
                        container.attrs['State']['StartedAt'].replace('Z', '+00:00')
                    )
                    uptime = datetime.now(started.tzinfo) - started
                    uptime_seconds = int(uptime.total_seconds())
                else:
                    uptime_seconds = 0
                    
                uptime_data[container.name] = {
                    'status': container.status,
                    'uptime_seconds': uptime_seconds,
                    'uptime_hours': round(uptime_seconds / 3600, 2),
                    'restart_count': container.attrs.get('RestartCount', 0),
                    'created': created.isoformat(),
                    'image': container.image.tags[0] if container.image.tags else 'unknown'
                }
                
            except Exception as e:
                print(f"Error getting uptime for {container.name}: {e}")
                
        return uptime_data
        
    def monitor_container_resources(self):
        """Monitor container resource usage continuously"""
        while self.running:
            try:
                containers = self.client.containers.list()
                
                for container in containers:
                    try:
                        stats = container.stats(stream=False)
                        
                        # Calculate basic metrics
                        cpu_stats = stats['cpu_stats']
                        memory_stats = stats['memory_stats']
                        
                        cpu_percent = 0.0
                        if 'cpu_usage' in cpu_stats and 'system_cpu_usage' in cpu_stats:
                            cpu_delta = cpu_stats['cpu_usage']['total_usage'] - \
                                       stats['precpu_stats']['cpu_usage']['total_usage']
                            system_delta = cpu_stats['system_cpu_usage'] - \
                                          stats['precpu_stats']['system_cpu_usage']
                            if system_delta > 0:
                                cpu_percent = (cpu_delta / system_delta) * \
                                            len(cpu_stats['cpu_usage']['percpu_usage']) * 100
                        
                        memory_usage = memory_stats.get('usage', 0)
                        memory_limit = memory_stats.get('limit', 1)
                        memory_percent = (memory_usage / memory_limit) * 100
                        
                        # Store metrics
                        self.store_container_metrics(
                            container.name,
                            cpu_percent,
                            memory_percent,
                            container.attrs.get('RestartCount', 0)
                        )
                        
                    except Exception as e:
                        print(f"Error collecting metrics for {container.name}: {e}")
                        
                time.sleep(60)  # Collect every minute
                
            except Exception as e:
                print(f"Error in resource monitoring: {e}")
                time.sleep(60)
                
    def store_container_metrics(self, container_name: str, cpu_percent: float, 
                               memory_percent: float, restart_count: int):
        """Store container metrics in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO container_metrics 
            (timestamp, container_name, restart_count, resource_usage)
            VALUES (?, ?, ?, ?)
        ''', (
            datetime.now().isoformat(),
            container_name,
            restart_count,
            json.dumps({
                'cpu_percent': round(cpu_percent, 2),
                'memory_percent': round(memory_percent, 2)
            })
        ))
        
        conn.commit()
        conn.close()
        
    def generate_lifecycle_report(self, hours: int = 24) -> Dict:
        """Generate comprehensive lifecycle report"""
        summary = self.get_lifecycle_summary(hours)
        uptime_data = self.get_container_uptime_report()
        
        # Calculate reliability metrics
        total_restarts = sum(summary['most_restarted'].values())
        running_containers = len([c for c, data in uptime_data.items() 
                                 if data['status'] == 'running'])
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'analysis_period_hours': hours,
            'summary': summary,
            'uptime_data': uptime_data,
            'reliability_metrics': {
                'total_containers': len(uptime_data),
                'running_containers': running_containers,
                'total_restarts': total_restarts,
                'average_uptime_hours': sum(d['uptime_hours'] for d in uptime_data.values()) / len(uptime_data) if uptime_data else 0
            },
            'alerts': self.generate_alerts(summary, uptime_data)
        }
        
        return report
        
    def generate_alerts(self, summary: Dict, uptime_data: Dict) -> List[Dict]:
        """Generate alerts based on lifecycle analysis"""
        alerts = []
        
        # Check for frequently restarting containers
        for container, count in summary['most_restarted'].items():
            if count > 5:  # More than 5 restarts
                alerts.append({
                    'severity': 'warning',
                    'type': 'frequent_restarts',
                    'container': container,
                    'message': f"Container restarted {count} times in the last {summary['period_hours']} hours"
                })
                
        # Check for containers that died with non-zero exit codes
        for container, exit_code, timestamp in summary['recent_deaths']:
            if exit_code != 0:
                alerts.append({
                    'severity': 'critical',
                    'type': 'abnormal_exit',
                    'container': container,
                    'message': f"Container died with exit code {exit_code} at {timestamp}"
                })
                
        # Check for low uptime containers
        for container, data in uptime_data.items():
            if data['status'] == 'running' and data['uptime_hours'] < 1:
                alerts.append({
                    'severity': 'info',
                    'type': 'recent_restart',
                    'container': container,
                    'message': f"Container has low uptime: {data['uptime_hours']} hours"
                })
                
        return alerts
        
    def run_monitoring(self):
        """Run complete monitoring (events + resources)"""
        print("🚀 Starting Docker Lifecycle Monitor...")
        
        def signal_handler(signum, frame):
            print("\n👋 Stopping monitoring...")
            self.running = False
            
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # Start resource monitoring in separate thread
        resource_thread = threading.Thread(target=self.monitor_container_resources)
        resource_thread.daemon = True
        resource_thread.start()
        
        # Start event monitoring (blocks)
        self.monitor_events()
        
        print("✅ Monitoring stopped")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Docker Lifecycle Monitor')
    parser.add_argument('--monitor', '-m', action='store_true', help='Start continuous monitoring')
    parser.add_argument('--report', '-r', action='store_true', help='Generate lifecycle report')
    parser.add_argument('--hours', type=int, default=24, help='Hours of data to analyze')
    parser.add_argument('--uptime', '-u', action='store_true', help='Show container uptime report')
    parser.add_argument('--export', '-e', type=str, help='Export report to JSON file')
    
    args = parser.parse_args()
    
    monitor = DockerLifecycleMonitor()
    
    if args.monitor:
        monitor.run_monitoring()
    elif args.uptime:
        uptime_data = monitor.get_container_uptime_report()
        print("📊 Container Uptime Report")
        print("=" * 60)
        
        for container, data in sorted(uptime_data.items(), 
                                     key=lambda x: x[1]['uptime_hours'], 
                                     reverse=True):
            status_emoji = "🟢" if data['status'] == 'running' else "🔴"
            print(f"{status_emoji} {container:25} | "
                  f"Uptime: {data['uptime_hours']:8.1f}h | "
                  f"Restarts: {data['restart_count']:3d} | "
                  f"Status: {data['status']}")
                  
    elif args.report:
        report = monitor.generate_lifecycle_report(args.hours)
        
        if args.export:
            with open(args.export, 'w') as f:
                json.dump(report, f, indent=2)
            print(f"📄 Report exported to: {args.export}")
        else:
            print("📊 Docker Lifecycle Report")
            print("=" * 50)
            
            metrics = report['reliability_metrics']
            print(f"Analysis Period: {args.hours} hours")
            print(f"Total Containers: {metrics['total_containers']}")
            print(f"Running Containers: {metrics['running_containers']}")
            print(f"Total Restarts: {metrics['total_restarts']}")
            print(f"Average Uptime: {metrics['average_uptime_hours']:.1f} hours")
            
            # Show most frequent events
            if report['summary']['event_counts']:
                print("\n🔥 Most Frequent Events:")
                for event, count in sorted(report['summary']['event_counts'].items(), 
                                         key=lambda x: x[1], reverse=True)[:5]:
                    print(f"  {event}: {count}")
            
            # Show alerts
            if report['alerts']:
                print(f"\n⚠️  Alerts ({len(report['alerts'])}):")
                for alert in report['alerts']:
                    severity_emoji = {
                        'critical': '🔴', 
                        'warning': '🟡', 
                        'info': '🔵'
                    }.get(alert['severity'], '📝')
                    print(f"  {severity_emoji} {alert['container']}: {alert['message']}")
    else:
        # Show current status
        uptime_data = monitor.get_container_uptime_report()
        running = len([c for c, d in uptime_data.items() if d['status'] == 'running'])
        total = len(uptime_data)
        
        print(f"📊 Current Status: {running}/{total} containers running")
        
        # Show recent events from last hour
        summary = monitor.get_lifecycle_summary(1)
        if summary['total_events'] > 0:
            print(f"📝 Events in last hour: {summary['total_events']}")
            for event, count in summary['event_counts'].items():
                print(f"  {event}: {count}")

if __name__ == '__main__':
    main()
