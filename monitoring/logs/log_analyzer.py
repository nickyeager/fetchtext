#!/usr/bin/env python3
"""
Docker Log Analyzer
Advanced log analysis and pattern detection for Docker containers.
"""

import docker
import re
import json
import sqlite3
import argparse
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from typing import Dict, List, Tuple, Optional
import threading
import time

class DockerLogAnalyzer:
    def __init__(self, db_path="monitoring/logs.db"):
        self.client = docker.from_env()
        self.db_path = db_path
        self.init_database()
        
        # Error patterns to detect
        self.error_patterns = {
            'critical_errors': [
                r'FATAL|CRITICAL|EMERGENCY',
                r'Out of memory|OOM',
                r'Connection refused|Connection timeout',
                r'Database connection failed',
                r'Permission denied',
                r'No space left on device',
                r'Segmentation fault|segfault'
            ],
            'warnings': [
                r'WARNING|WARN',
                r'deprecated|deprecation',
                r'retry|retrying',
                r'timeout|timed out',
                r'slow query|performance',
                r'rate limit|throttle'
            ],
            'authentication': [
                r'authentication failed|auth failed',
                r'unauthorized|forbidden',
                r'invalid token|token expired',
                r'login failed|login attempt'
            ],
            'network_issues': [
                r'network unreachable|host unreachable',
                r'dns resolution failed',
                r'connection reset|connection aborted',
                r'proxy error|gateway timeout'
            ],
            'resource_issues': [
                r'cpu throttle|cpu limit',
                r'memory limit|memory pressure',
                r'disk full|storage full',
                r'too many open files'
            ]
        }
        
        # Performance indicators
        self.performance_patterns = {
            'response_times': r'(\d+\.?\d*)\s*(ms|milliseconds|seconds|s)\s*response',
            'request_counts': r'(\d+)\s*(requests?|req)',
            'error_rates': r'(\d+\.?\d*)%?\s*error',
            'throughput': r'(\d+\.?\d*)\s*(rps|requests/s|ops/s)'
        }

    def init_database(self):
        """Initialize database for log storage and analysis"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS log_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                container_name TEXT NOT NULL,
                log_level TEXT,
                message TEXT NOT NULL,
                pattern_matches TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS log_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern_name TEXT NOT NULL,
                pattern_regex TEXT NOT NULL,
                container_name TEXT NOT NULL,
                match_count INTEGER DEFAULT 0,
                last_seen TEXT,
                severity TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_log_timestamp_container 
            ON log_entries(timestamp, container_name)
        ''')
        
        conn.commit()
        conn.close()

    def extract_log_level(self, log_line: str) -> str:
        """Extract log level from log line"""
        log_levels = ['DEBUG', 'INFO', 'WARN', 'WARNING', 'ERROR', 'FATAL', 'CRITICAL', 'TRACE']
        
        for level in log_levels:
            if re.search(rf'\b{level}\b', log_line, re.IGNORECASE):
                return level.upper()
        
        return 'UNKNOWN'

    def extract_timestamp(self, log_line: str) -> Optional[datetime]:
        """Extract timestamp from log line"""
        timestamp_patterns = [
            r'(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})',
            r'(\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2})',
            r'(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2})',
            r'(\w{3} \d{2} \d{2}:\d{2}:\d{2})'
        ]
        
        for pattern in timestamp_patterns:
            match = re.search(pattern, log_line)
            if match:
                try:
                    timestamp_str = match.group(1)
                    # Try different formats
                    formats = [
                        '%Y-%m-%d %H:%M:%S',
                        '%Y-%m-%dT%H:%M:%S',
                        '%m/%d/%Y %H:%M:%S',
                        '%Y/%m/%d %H:%M:%S'
                    ]
                    
                    for fmt in formats:
                        try:
                            return datetime.strptime(timestamp_str, fmt)
                        except ValueError:
                            continue
                except:
                    pass
        
        return datetime.now()

    def analyze_log_patterns(self, container_name: str, log_lines: List[str]) -> Dict:
        """Analyze log patterns for anomalies and issues"""
        analysis = {
            'total_lines': len(log_lines),
            'error_patterns': defaultdict(list),
            'log_levels': Counter(),
            'performance_metrics': {},
            'anomalies': [],
            'timeline': []
        }
        
        for line in log_lines:
            # Extract log level
            log_level = self.extract_log_level(line)
            analysis['log_levels'][log_level] += 1
            
            # Extract timestamp
            timestamp = self.extract_timestamp(line)
            
            # Check error patterns
            for category, patterns in self.error_patterns.items():
                for pattern in patterns:
                    matches = re.findall(pattern, line, re.IGNORECASE)
                    if matches:
                        analysis['error_patterns'][category].append({
                            'line': line.strip(),
                            'timestamp': timestamp.isoformat() if timestamp else None,
                            'pattern': pattern,
                            'matches': matches
                        })
            
            # Check performance patterns
            for metric, pattern in self.performance_patterns.items():
                matches = re.findall(pattern, line, re.IGNORECASE)
                if matches:
                    if metric not in analysis['performance_metrics']:
                        analysis['performance_metrics'][metric] = []
                    analysis['performance_metrics'][metric].extend(matches)
            
            # Store in timeline
            analysis['timeline'].append({
                'timestamp': timestamp.isoformat() if timestamp else None,
                'level': log_level,
                'message': line.strip()[:200]  # Truncate long messages
            })
        
        # Detect anomalies
        error_rate = (analysis['log_levels']['ERROR'] + analysis['log_levels']['FATAL']) / max(analysis['total_lines'], 1)
        if error_rate > 0.1:  # More than 10% errors
            analysis['anomalies'].append({
                'type': 'high_error_rate',
                'severity': 'warning',
                'description': f'High error rate: {error_rate:.1%}',
                'recommendation': 'Investigate error patterns and root causes'
            })
        
        # Check for log flooding
        if analysis['total_lines'] > 10000:
            analysis['anomalies'].append({
                'type': 'log_flooding',
                'severity': 'warning',
                'description': f'Excessive logging: {analysis["total_lines"]} lines',
                'recommendation': 'Review log levels and implement log rotation'
            })
        
        return analysis

    def get_container_logs(self, container_name: str, hours: int = 1, lines: int = None) -> List[str]:
        """Get logs from a specific container"""
        try:
            container = self.client.containers.get(container_name)
            since = datetime.now() - timedelta(hours=hours)
            
            logs = container.logs(
                since=since,
                until=datetime.now(),
                tail=lines,
                timestamps=True
            ).decode('utf-8', errors='ignore')
            
            return logs.strip().split('\n') if logs.strip() else []
            
        except docker.errors.NotFound:
            print(f"Container '{container_name}' not found")
            return []
        except Exception as e:
            print(f"Error getting logs for {container_name}: {e}")
            return []

    def analyze_all_containers(self, hours: int = 1) -> Dict:
        """Analyze logs for all running containers"""
        containers = self.client.containers.list()
        results = {}
        
        print(f"🔍 Analyzing logs for {len(containers)} containers (last {hours} hours)")
        
        for container in containers:
            print(f"Analyzing: {container.name}")
            logs = self.get_container_logs(container.name, hours)
            
            if logs:
                analysis = self.analyze_log_patterns(container.name, logs)
                results[container.name] = analysis
                
                # Store in database
                self.store_log_analysis(container.name, analysis)
        
        return results

    def store_log_analysis(self, container_name: str, analysis: Dict):
        """Store log analysis results in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Store error patterns
        for category, errors in analysis['error_patterns'].items():
            for error in errors:
                cursor.execute('''
                    INSERT INTO log_entries (timestamp, container_name, log_level, message, pattern_matches)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    error.get('timestamp'),
                    container_name,
                    'ERROR',
                    error['line'],
                    json.dumps({category: error['pattern']})
                ))
        
        conn.commit()
        conn.close()

    def generate_log_report(self, hours: int = 24) -> Dict:
        """Generate comprehensive log analysis report"""
        analysis_results = self.analyze_all_containers(hours)
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'analysis_period_hours': hours,
            'containers_analyzed': len(analysis_results),
            'summary': {
                'total_errors': 0,
                'total_warnings': 0,
                'containers_with_issues': 0,
                'critical_issues': 0
            },
            'container_analyses': analysis_results,
            'top_issues': [],
            'recommendations': []
        }
        
        # Calculate summary statistics
        for container_name, analysis in analysis_results.items():
            error_count = analysis['log_levels'].get('ERROR', 0) + analysis['log_levels'].get('FATAL', 0)
            warning_count = analysis['log_levels'].get('WARNING', 0) + analysis['log_levels'].get('WARN', 0)
            
            report['summary']['total_errors'] += error_count
            report['summary']['total_warnings'] += warning_count
            
            if error_count > 0 or warning_count > 0:
                report['summary']['containers_with_issues'] += 1
            
            if len(analysis['anomalies']) > 0:
                report['summary']['critical_issues'] += len(analysis['anomalies'])
            
            # Collect top issues
            for category, errors in analysis['error_patterns'].items():
                if errors:
                    report['top_issues'].append({
                        'container': container_name,
                        'category': category,
                        'count': len(errors),
                        'severity': 'critical' if category == 'critical_errors' else 'warning'
                    })
        
        # Sort top issues by severity and count
        report['top_issues'].sort(key=lambda x: (x['severity'] == 'critical', x['count']), reverse=True)
        
        # Generate recommendations
        if report['summary']['total_errors'] > 100:
            report['recommendations'].append({
                'type': 'error_investigation',
                'priority': 'high',
                'description': f"High error count ({report['summary']['total_errors']}) requires immediate investigation"
            })
        
        if report['summary']['containers_with_issues'] > len(analysis_results) * 0.5:
            report['recommendations'].append({
                'type': 'widespread_issues',
                'priority': 'high',
                'description': 'More than 50% of containers have logging issues - check system health'
            })
        
        return report

    def search_logs(self, pattern: str, container_name: str = None, hours: int = 24) -> List[Dict]:
        """Search for specific patterns in logs"""
        results = []
        containers = [self.client.containers.get(container_name)] if container_name else self.client.containers.list()
        
        for container in containers:
            logs = self.get_container_logs(container.name, hours)
            
            for i, line in enumerate(logs):
                if re.search(pattern, line, re.IGNORECASE):
                    results.append({
                        'container': container.name,
                        'line_number': i + 1,
                        'timestamp': self.extract_timestamp(line),
                        'message': line.strip(),
                        'log_level': self.extract_log_level(line)
                    })
        
        return results

    def tail_logs_live(self, container_name: str, pattern: str = None):
        """Live tail of container logs with optional pattern filtering"""
        try:
            container = self.client.containers.get(container_name)
            print(f"🔄 Live tailing logs for {container_name}")
            
            if pattern:
                print(f"   Filtering for pattern: {pattern}")
            
            print("   Press Ctrl+C to stop")
            print("-" * 60)
            
            for log_line in container.logs(stream=True, follow=True):
                line = log_line.decode('utf-8', errors='ignore').strip()
                
                if pattern:
                    if re.search(pattern, line, re.IGNORECASE):
                        timestamp = datetime.now().strftime('%H:%M:%S')
                        level = self.extract_log_level(line)
                        print(f"[{timestamp}] [{level}] {line}")
                else:
                    timestamp = datetime.now().strftime('%H:%M:%S')
                    level = self.extract_log_level(line)
                    print(f"[{timestamp}] [{level}] {line}")
                    
        except KeyboardInterrupt:
            print("\n👋 Stopped log tailing")
        except docker.errors.NotFound:
            print(f"Container '{container_name}' not found")
        except Exception as e:
            print(f"Error tailing logs: {e}")

def main():
    parser = argparse.ArgumentParser(description='Docker Log Analyzer')
    parser.add_argument('--container', '-c', type=str, help='Analyze specific container')
    parser.add_argument('--hours', type=int, default=1, help='Hours of logs to analyze')
    parser.add_argument('--report', '-r', action='store_true', help='Generate full log report')
    parser.add_argument('--search', '-s', type=str, help='Search for pattern in logs')
    parser.add_argument('--tail', '-t', action='store_true', help='Live tail container logs')
    parser.add_argument('--pattern', '-p', type=str, help='Filter pattern for live tail')
    parser.add_argument('--export', '-e', type=str, help='Export report to JSON file')
    
    args = parser.parse_args()
    
    analyzer = DockerLogAnalyzer()
    
    if args.tail and args.container:
        analyzer.tail_logs_live(args.container, args.pattern)
    elif args.search:
        results = analyzer.search_logs(args.search, args.container, args.hours)
        print(f"🔍 Found {len(results)} matches for '{args.search}':")
        
        for result in results[:50]:  # Limit to 50 results
            timestamp = result['timestamp'].strftime('%H:%M:%S') if result['timestamp'] else 'N/A'
            print(f"[{timestamp}] {result['container']}: {result['message']}")
    elif args.report:
        report = analyzer.generate_log_report(args.hours)
        
        if args.export:
            with open(args.export, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            print(f"📄 Report exported to: {args.export}")
        else:
            print("📋 Log Analysis Report")
            print("=" * 50)
            print(f"Period: {args.hours} hours")
            print(f"Containers: {report['containers_analyzed']}")
            print(f"Total Errors: {report['summary']['total_errors']}")
            print(f"Total Warnings: {report['summary']['total_warnings']}")
            print(f"Containers with Issues: {report['summary']['containers_with_issues']}")
            
            if report['top_issues']:
                print("\n🔥 Top Issues:")
                for issue in report['top_issues'][:10]:
                    severity_emoji = '🔴' if issue['severity'] == 'critical' else '🟡'
                    print(f"  {severity_emoji} {issue['container']}: {issue['category']} ({issue['count']} occurrences)")
            
            if report['recommendations']:
                print("\n💡 Recommendations:")
                for rec in report['recommendations']:
                    priority_emoji = '🔴' if rec['priority'] == 'high' else '🟡'
                    print(f"  {priority_emoji} {rec['description']}")
    elif args.container:
        logs = analyzer.get_container_logs(args.container, args.hours)
        if logs:
            analysis = analyzer.analyze_log_patterns(args.container, logs)
            
            print(f"📊 Log Analysis for {args.container} ({args.hours} hours)")
            print("=" * 50)
            print(f"Total Lines: {analysis['total_lines']}")
            
            print("\nLog Levels:")
            for level, count in analysis['log_levels'].items():
                print(f"  {level}: {count}")
            
            if analysis['error_patterns']:
                print("\nError Patterns:")
                for category, errors in analysis['error_patterns'].items():
                    if errors:
                        print(f"  {category}: {len(errors)} occurrences")
            
            if analysis['anomalies']:
                print("\nAnomalies:")
                for anomaly in analysis['anomalies']:
                    print(f"  🚨 {anomaly['description']}")
        else:
            print(f"No logs found for container: {args.container}")
    else:
        # Quick overview
        containers = analyzer.client.containers.list()
        print(f"📋 Docker Log Overview ({len(containers)} containers)")
        print("=" * 60)
        
        for container in containers:
            logs = analyzer.get_container_logs(container.name, 1, 100)  # Last hour, max 100 lines
            if logs:
                analysis = analyzer.analyze_log_patterns(container.name, logs)
                error_count = analysis['log_levels'].get('ERROR', 0) + analysis['log_levels'].get('FATAL', 0)
                warning_count = analysis['log_levels'].get('WARNING', 0) + analysis['log_levels'].get('WARN', 0)
                
                status_emoji = '🔴' if error_count > 0 else '🟡' if warning_count > 0 else '🟢'
                print(f"{status_emoji} {container.name:20} | Lines: {analysis['total_lines']:4d} | "
                      f"Errors: {error_count:3d} | Warnings: {warning_count:3d}")

if __name__ == '__main__':
    main()
