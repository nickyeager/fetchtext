#!/usr/bin/env python3
"""
Docker Image Management Monitor
Monitors Docker images, tags, layers, vulnerabilities, and optimization opportunities.
"""

import docker
import json
import sqlite3
import subprocess
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from collections import defaultdict
import argparse

class DockerImageMonitor:
    def __init__(self, db_path="monitoring/images.db"):
        self.client = docker.from_env()
        self.db_path = db_path
        self.init_database()
        
    def init_database(self):
        """Initialize SQLite database for image tracking"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS image_scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_date TEXT NOT NULL,
                image_id TEXT NOT NULL,
                image_name TEXT NOT NULL,
                image_size INTEGER,
                layer_count INTEGER,
                vulnerabilities TEXT,
                efficiency_score REAL,
                recommendations TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS image_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                image_id TEXT NOT NULL,
                image_name TEXT NOT NULL,
                container_count INTEGER,
                disk_usage INTEGER,
                last_used TEXT
            )
        ''')
        
        conn.commit()
        conn.close()
        
    def scan_all_images(self) -> Dict:
        """Scan all Docker images for analysis"""
        images = self.client.images.list()
        scan_results = {
            'total_images': len(images),
            'total_size': 0,
            'images': [],
            'vulnerabilities': {},
            'optimization_opportunities': [],
            'dangling_images': [],
            'large_images': [],
            'old_images': []
        }
        
        print(f"🔍 Scanning {len(images)} Docker images...")
        
        for image in images:
            image_data = self.analyze_image(image)
            scan_results['images'].append(image_data)
            scan_results['total_size'] += image_data['size']
            
            # Categorize images
            if not image.tags:  # Dangling images
                scan_results['dangling_images'].append(image_data)
            
            if image_data['size'] > 1024 * 1024 * 1024:  # > 1GB
                scan_results['large_images'].append(image_data)
                
            if image_data['age_days'] > 180:  # > 6 months
                scan_results['old_images'].append(image_data)
                
            # Check for optimization opportunities
            optimization = self.check_optimization_opportunities(image, image_data)
            if optimization:
                scan_results['optimization_opportunities'].extend(optimization)
                
        # Sort by size
        scan_results['images'].sort(key=lambda x: x['size'], reverse=True)
        
        return scan_results
        
    def analyze_image(self, image) -> Dict:
        """Analyze individual Docker image"""
        try:
            attrs = image.attrs
            config = attrs.get('Config', {})
            
            # Basic information
            image_data = {
                'id': image.id,
                'short_id': image.short_id,
                'tags': image.tags or ['<none>'],
                'size': attrs.get('Size', 0),
                'size_mb': round(attrs.get('Size', 0) / (1024 * 1024), 2),
                'created': attrs.get('Created'),
                'age_days': self.calculate_age_days(attrs.get('Created')),
                'layers': len(attrs.get('RootFS', {}).get('Layers', [])),
                'architecture': attrs.get('Architecture', 'unknown'),
                'os': attrs.get('Os', 'unknown')
            }
            
            # Dockerfile analysis
            history = attrs.get('History', [])
            image_data['instruction_count'] = len(history)
            image_data['dockerfile_layers'] = self.analyze_dockerfile_layers(history)
            
            # Security analysis
            image_data['exposed_ports'] = list(config.get('ExposedPorts', {}).keys())
            image_data['env_vars'] = len(config.get('Env', []))
            image_data['user'] = config.get('User', 'root')
            image_data['working_dir'] = config.get('WorkingDir', '/')
            
            # Usage analysis
            image_data['container_usage'] = self.get_image_usage(image.id)
            
            return image_data
            
        except Exception as e:
            print(f"Error analyzing image {image.short_id}: {e}")
            return {
                'id': image.id,
                'short_id': image.short_id,
                'error': str(e)
            }
            
    def calculate_age_days(self, created_str: str) -> int:
        """Calculate image age in days"""
        try:
            created = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
            age = datetime.now(created.tzinfo) - created
            return age.days
        except:
            return 0
            
    def analyze_dockerfile_layers(self, history: List) -> Dict:
        """Analyze Dockerfile layers for optimization"""
        layer_analysis = {
            'total_layers': len(history),
            'large_layers': [],
            'inefficient_layers': [],
            'cache_busting_layers': []
        }
        
        for i, layer in enumerate(history):
            created_by = layer.get('created_by', '')
            size = layer.get('size', 0)
            
            # Identify large layers (> 100MB)
            if size > 100 * 1024 * 1024:
                layer_analysis['large_layers'].append({
                    'index': i,
                    'size_mb': round(size / (1024 * 1024), 2),
                    'command': created_by[:100] + '...' if len(created_by) > 100 else created_by
                })
                
            # Identify potentially inefficient patterns
            if any(pattern in created_by.lower() for pattern in [
                'apt-get update', 'yum update', 'apk update'
            ]) and 'apt-get clean' not in created_by.lower():
                layer_analysis['inefficient_layers'].append({
                    'index': i,
                    'issue': 'Package cache not cleaned',
                    'command': created_by[:100] + '...' if len(created_by) > 100 else created_by
                })
                
        return layer_analysis
        
    def get_image_usage(self, image_id: str) -> Dict:
        """Get usage statistics for an image"""
        try:
            containers = self.client.containers.list(all=True, 
                                                    filters={'ancestor': image_id})
            
            running_containers = [c for c in containers if c.status == 'running']
            
            return {
                'total_containers': len(containers),
                'running_containers': len(running_containers),
                'container_names': [c.name for c in containers]
            }
        except:
            return {'total_containers': 0, 'running_containers': 0, 'container_names': []}
            
    def check_optimization_opportunities(self, image, image_data: Dict) -> List[Dict]:
        """Check for image optimization opportunities"""
        opportunities = []
        
        # Large image size
        if image_data['size'] > 500 * 1024 * 1024:  # > 500MB
            opportunities.append({
                'type': 'large_image',
                'severity': 'medium',
                'image': image_data['tags'][0],
                'current_size_mb': image_data['size_mb'],
                'recommendation': 'Consider using alpine-based images or multi-stage builds'
            })
            
        # Too many layers
        if image_data['layers'] > 20:
            opportunities.append({
                'type': 'many_layers',
                'severity': 'low',
                'image': image_data['tags'][0],
                'layer_count': image_data['layers'],
                'recommendation': 'Combine RUN commands to reduce layer count'
            })
            
        # Running as root
        if image_data['user'] == 'root':
            opportunities.append({
                'type': 'security_risk',
                'severity': 'high',
                'image': image_data['tags'][0],
                'issue': 'Running as root user',
                'recommendation': 'Create and use non-root user'
            })
            
        # Unused image
        if image_data['container_usage']['total_containers'] == 0:
            opportunities.append({
                'type': 'unused_image',
                'severity': 'low',
                'image': image_data['tags'][0],
                'size_mb': image_data['size_mb'],
                'recommendation': 'Consider removing unused image to save space'
            })
            
        return opportunities
        
    def scan_vulnerabilities(self, image_name: str) -> Dict:
        """Scan image for vulnerabilities using Trivy"""
        try:
            # Run Trivy scan
            result = subprocess.run([
                'docker', 'run', '--rm', '-v', '/var/run/docker.sock:/var/run/docker.sock',
                'aquasec/trivy:latest', 'image', '--format', 'json', image_name
            ], capture_output=True, text=True, timeout=300)
            
            if result.returncode == 0:
                scan_data = json.loads(result.stdout)
                return self.parse_vulnerability_scan(scan_data)
            else:
                return {'error': result.stderr, 'available': False}
                
        except subprocess.TimeoutExpired:
            return {'error': 'Scan timeout', 'available': False}
        except FileNotFoundError:
            return {'error': 'Trivy not available', 'available': False}
        except Exception as e:
            return {'error': str(e), 'available': False}
            
    def parse_vulnerability_scan(self, scan_data: Dict) -> Dict:
        """Parse Trivy vulnerability scan results"""
        vulnerabilities = {
            'total_vulnerabilities': 0,
            'by_severity': {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0},
            'vulnerable_packages': [],
            'recommendations': []
        }
        
        results = scan_data.get('Results', [])
        
        for result in results:
            target = result.get('Target', 'unknown')
            vulns = result.get('Vulnerabilities', [])
            
            for vuln in vulns:
                severity = vuln.get('Severity', 'UNKNOWN')
                if severity in vulnerabilities['by_severity']:
                    vulnerabilities['by_severity'][severity] += 1
                    vulnerabilities['total_vulnerabilities'] += 1
                    
                # Collect package info for critical/high vulnerabilities
                if severity in ['CRITICAL', 'HIGH']:
                    vulnerabilities['vulnerable_packages'].append({
                        'package': vuln.get('PkgName', 'unknown'),
                        'version': vuln.get('InstalledVersion', 'unknown'),
                        'fixed_version': vuln.get('FixedVersion', 'none'),
                        'severity': severity,
                        'cve_id': vuln.get('VulnerabilityID', 'unknown')
                    })
                    
        # Generate recommendations
        if vulnerabilities['by_severity']['CRITICAL'] > 0:
            vulnerabilities['recommendations'].append(
                f"URGENT: {vulnerabilities['by_severity']['CRITICAL']} critical vulnerabilities found. Update base image immediately."
            )
            
        if vulnerabilities['by_severity']['HIGH'] > 5:
            vulnerabilities['recommendations'].append(
                f"High priority: {vulnerabilities['by_severity']['HIGH']} high-severity vulnerabilities. Plan security update."
            )
            
        return vulnerabilities
        
    def get_image_efficiency_metrics(self) -> Dict:
        """Calculate image efficiency metrics"""
        images = self.client.images.list()
        
        metrics = {
            'total_images': len(images),
            'total_disk_usage': 0,
            'average_image_size': 0,
            'layer_distribution': defaultdict(int),
            'size_distribution': {'small': 0, 'medium': 0, 'large': 0, 'huge': 0},
            'usage_efficiency': {}
        }
        
        total_size = 0
        
        for image in images:
            size = image.attrs.get('Size', 0)
            total_size += size
            layers = len(image.attrs.get('RootFS', {}).get('Layers', []))
            
            # Layer distribution
            layer_range = f"{(layers // 5) * 5}-{(layers // 5 + 1) * 5 - 1}"
            metrics['layer_distribution'][layer_range] += 1
            
            # Size distribution
            size_mb = size / (1024 * 1024)
            if size_mb < 50:
                metrics['size_distribution']['small'] += 1
            elif size_mb < 200:
                metrics['size_distribution']['medium'] += 1
            elif size_mb < 1000:
                metrics['size_distribution']['large'] += 1
            else:
                metrics['size_distribution']['huge'] += 1
                
            # Usage efficiency (containers per image)
            containers = self.client.containers.list(all=True, 
                                                    filters={'ancestor': image.id})
            usage_ratio = len(containers) if containers else 0
            
            if image.tags:
                metrics['usage_efficiency'][image.tags[0]] = {
                    'size_mb': round(size_mb, 2),
                    'containers': len(containers),
                    'efficiency': round(len(containers) / size_mb * 1000, 2) if size_mb > 0 else 0
                }
                
        metrics['total_disk_usage'] = total_size
        metrics['average_image_size'] = total_size / len(images) if images else 0
        
        return metrics
        
    def cleanup_recommendations(self) -> Dict:
        """Generate cleanup recommendations"""
        recommendations = {
            'dangling_images': [],
            'unused_images': [],
            'old_images': [],
            'potential_savings_mb': 0
        }
        
        images = self.client.images.list()
        containers = self.client.containers.list(all=True)
        used_images = {c.image.id for c in containers}
        
        for image in images:
            size_mb = round(image.attrs.get('Size', 0) / (1024 * 1024), 2)
            age_days = self.calculate_age_days(image.attrs.get('Created', ''))
            
            # Dangling images (no tags)
            if not image.tags:
                recommendations['dangling_images'].append({
                    'id': image.short_id,
                    'size_mb': size_mb,
                    'age_days': age_days
                })
                recommendations['potential_savings_mb'] += size_mb
                
            # Unused images
            elif image.id not in used_images:
                recommendations['unused_images'].append({
                    'id': image.short_id,
                    'tags': image.tags,
                    'size_mb': size_mb,
                    'age_days': age_days
                })
                recommendations['potential_savings_mb'] += size_mb
                
            # Old images (> 1 year and not used recently)
            elif age_days > 365 and image.id not in used_images:
                recommendations['old_images'].append({
                    'id': image.short_id,
                    'tags': image.tags,
                    'size_mb': size_mb,
                    'age_days': age_days
                })
                
        return recommendations
        
    def generate_image_report(self, include_vulnerabilities: bool = False) -> Dict:
        """Generate comprehensive image analysis report"""
        print("🔍 Generating Docker Image Report...")
        
        scan_results = self.scan_all_images()
        efficiency_metrics = self.get_image_efficiency_metrics()
        cleanup_recommendations = self.cleanup_recommendations()
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'total_images': scan_results['total_images'],
                'total_size_gb': round(scan_results['total_size'] / (1024 * 1024 * 1024), 2),
                'dangling_images': len(scan_results['dangling_images']),
                'large_images': len(scan_results['large_images']),
                'old_images': len(scan_results['old_images']),
                'optimization_opportunities': len(scan_results['optimization_opportunities'])
            },
            'images': scan_results['images'][:20],  # Top 20 by size
            'efficiency_metrics': efficiency_metrics,
            'optimization_opportunities': scan_results['optimization_opportunities'],
            'cleanup_recommendations': cleanup_recommendations
        }
        
        # Add vulnerability scans if requested
        if include_vulnerabilities:
            print("🔒 Scanning for vulnerabilities...")
            report['vulnerability_scans'] = {}
            
            # Scan top 10 images by usage
            for image_data in scan_results['images'][:10]:
                if image_data['container_usage']['total_containers'] > 0:
                    tag = image_data['tags'][0] if image_data['tags'][0] != '<none>' else image_data['short_id']
                    vuln_scan = self.scan_vulnerabilities(tag)
                    report['vulnerability_scans'][tag] = vuln_scan
                    
        return report
        
    def store_scan_results(self, image_data: Dict, vulnerabilities: Dict = None):
        """Store scan results in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO image_scans 
            (scan_date, image_id, image_name, image_size, layer_count, vulnerabilities, efficiency_score, recommendations)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            datetime.now().isoformat(),
            image_data['id'],
            image_data['tags'][0] if image_data['tags'] else 'unknown',
            image_data['size'],
            image_data['layers'],
            json.dumps(vulnerabilities) if vulnerabilities else None,
            0.0,  # TODO: Calculate efficiency score
            json.dumps([])  # TODO: Add recommendations
        ))
        
        conn.commit()
        conn.close()

def main():
    parser = argparse.ArgumentParser(description='Docker Image Monitor')
    parser.add_argument('--scan', '-s', action='store_true', help='Scan all images')
    parser.add_argument('--vulnerabilities', '-v', action='store_true', help='Include vulnerability scans')
    parser.add_argument('--cleanup', '-c', action='store_true', help='Show cleanup recommendations')
    parser.add_argument('--efficiency', '-e', action='store_true', help='Show efficiency metrics')
    parser.add_argument('--export', type=str, help='Export report to JSON file')
    
    args = parser.parse_args()
    
    monitor = DockerImageMonitor()
    
    if args.scan:
        report = monitor.generate_image_report(include_vulnerabilities=args.vulnerabilities)
        
        if args.export:
            with open(args.export, 'w') as f:
                json.dump(report, f, indent=2)
            print(f"📄 Report exported to: {args.export}")
        else:
            print("🐳 Docker Image Analysis Report")
            print("=" * 50)
            
            summary = report['summary']
            print(f"Total Images: {summary['total_images']}")
            print(f"Total Size: {summary['total_size_gb']} GB")
            print(f"Dangling Images: {summary['dangling_images']}")
            print(f"Large Images (>1GB): {summary['large_images']}")
            print(f"Old Images (>6mo): {summary['old_images']}")
            print(f"Optimization Opportunities: {summary['optimization_opportunities']}")
            
            # Top largest images
            print("\n📦 Largest Images:")
            for img in report['images'][:5]:
                tags = ', '.join(img['tags'])
                print(f"  {img['size_mb']:8.1f} MB | {tags[:50]}")
                
            # Optimization opportunities
            if report['optimization_opportunities']:
                print(f"\n⚡ Optimization Opportunities:")
                for opp in report['optimization_opportunities'][:5]:
                    severity_emoji = {'high': '🔴', 'medium': '🟡', 'low': '🔵'}.get(opp['severity'], '📝')
                    print(f"  {severity_emoji} {opp['type']}: {opp['recommendation']}")
                    
    elif args.cleanup:
        cleanup = monitor.cleanup_recommendations()
        
        print("🧹 Docker Image Cleanup Recommendations")
        print("=" * 50)
        print(f"Potential Space Savings: {cleanup['potential_savings_mb']:.1f} MB")
        
        if cleanup['dangling_images']:
            print(f"\n🗑️  Dangling Images ({len(cleanup['dangling_images'])}):")
            for img in cleanup['dangling_images'][:10]:
                print(f"  {img['id']} | {img['size_mb']:.1f} MB | {img['age_days']} days old")
                
        if cleanup['unused_images']:
            print(f"\n📦 Unused Images ({len(cleanup['unused_images'])}):")
            for img in cleanup['unused_images'][:10]:
                tags = ', '.join(img['tags'])
                print(f"  {tags[:40]:40} | {img['size_mb']:8.1f} MB | {img['age_days']} days old")
                
    elif args.efficiency:
        metrics = monitor.get_image_efficiency_metrics()
        
        print("📊 Docker Image Efficiency Metrics")
        print("=" * 50)
        print(f"Total Images: {metrics['total_images']}")
        print(f"Total Disk Usage: {metrics['total_disk_usage'] / (1024**3):.2f} GB")
        print(f"Average Image Size: {metrics['average_image_size'] / (1024**2):.1f} MB")
        
        print("\n📏 Size Distribution:")
        for size_cat, count in metrics['size_distribution'].items():
            print(f"  {size_cat:10}: {count:3d} images")
            
        print("\n🔄 Most Efficient Images (containers per MB):")
        efficient_images = sorted(
            metrics['usage_efficiency'].items(),
            key=lambda x: x[1]['efficiency'],
            reverse=True
        )[:10]
        
        for name, data in efficient_images:
            if data['containers'] > 0:  # Only show used images
                print(f"  {name[:40]:40} | {data['efficiency']:6.2f} | "
                      f"{data['containers']} containers | {data['size_mb']:.1f} MB")
    else:
        # Quick status
        images = monitor.client.images.list()
        total_size = sum(img.attrs.get('Size', 0) for img in images)
        dangling = len([img for img in images if not img.tags])
        
        print(f"🐳 Docker Images: {len(images)} images, {total_size / (1024**3):.2f} GB total")
        if dangling > 0:
            print(f"🗑️  Dangling images: {dangling}")
            
        print("\nUse --scan for detailed analysis")
        print("Use --cleanup for cleanup recommendations")
        print("Use --efficiency for efficiency metrics")

if __name__ == '__main__':
    main()
