#!/usr/bin/env python3
"""
Docker Security Monitor
Monitors Docker containers for security compliance and vulnerabilities.
"""

import docker
import subprocess
import json
import sys
import time
from datetime import datetime
from pathlib import Path
import argparse

class DockerSecurityMonitor:
    def __init__(self):
        self.client = docker.from_env()
        self.security_checks = {
            'privileged_containers': self.check_privileged_containers,
            'exposed_docker_socket': self.check_docker_socket_exposure,
            'running_as_root': self.check_running_as_root,
            'no_restart_policy': self.check_restart_policies,
            'large_containers': self.check_container_sizes,
            'outdated_images': self.check_image_freshness,
            'insecure_registries': self.check_insecure_registries,
            'resource_limits': self.check_resource_limits,
            'network_mode': self.check_network_modes,
            'capabilities': self.check_linux_capabilities
        }
    
    def check_privileged_containers(self):
        """Check for containers running in privileged mode"""
        issues = []
        for container in self.client.containers.list():
            if container.attrs.get('HostConfig', {}).get('Privileged', False):
                issues.append({
                    'container': container.name,
                    'severity': 'HIGH',
                    'issue': 'Running in privileged mode',
                    'recommendation': 'Remove --privileged flag and use specific capabilities'
                })
        return issues
    
    def check_docker_socket_exposure(self):
        """Check for containers with Docker socket mounted"""
        issues = []
        for container in self.client.containers.list():
            mounts = container.attrs.get('Mounts', [])
            for mount in mounts:
                if mount.get('Source') == '/var/run/docker.sock':
                    issues.append({
                        'container': container.name,
                        'severity': 'HIGH',
                        'issue': 'Docker socket mounted',
                        'recommendation': 'Use Docker API or specific tools instead of socket mounting'
                    })
        return issues
    
    def check_running_as_root(self):
        """Check for containers running as root user"""
        issues = []
        for container in self.client.containers.list():
            try:
                exec_result = container.exec_run(['id', '-u'], stdout=True, stderr=True)
                if exec_result.exit_code == 0 and exec_result.output.decode().strip() == '0':
                    issues.append({
                        'container': container.name,
                        'severity': 'MEDIUM',
                        'issue': 'Running as root user',
                        'recommendation': 'Use non-root user with USER directive in Dockerfile'
                    })
            except:
                # Container might not support exec or id command
                pass
        return issues
    
    def check_restart_policies(self):
        """Check for containers without proper restart policies"""
        issues = []
        for container in self.client.containers.list():
            restart_policy = container.attrs.get('HostConfig', {}).get('RestartPolicy', {})
            if restart_policy.get('Name') == '':
                issues.append({
                    'container': container.name,
                    'severity': 'LOW',
                    'issue': 'No restart policy configured',
                    'recommendation': 'Set appropriate restart policy (unless-stopped, on-failure, etc.)'
                })
        return issues
    
    def check_container_sizes(self):
        """Check for unusually large containers"""
        issues = []
        for container in self.client.containers.list():
            try:
                stats = container.stats(stream=False)
                size_mb = stats['storage_stats']['size_rw'] / (1024 * 1024) if 'storage_stats' in stats else 0
                if size_mb > 1000:  # > 1GB
                    issues.append({
                        'container': container.name,
                        'severity': 'INFO',
                        'issue': f'Large container size: {size_mb:.1f}MB',
                        'recommendation': 'Consider optimizing image layers and removing unnecessary files'
                    })
            except:
                pass
        return issues
    
    def check_image_freshness(self):
        """Check for containers using outdated images"""
        issues = []
        for container in self.client.containers.list():
            image = container.image
            created = datetime.fromisoformat(image.attrs['Created'].replace('Z', '+00:00'))
            days_old = (datetime.now(created.tzinfo) - created).days
            
            if days_old > 90:  # More than 3 months old
                issues.append({
                    'container': container.name,
                    'severity': 'MEDIUM',
                    'issue': f'Using old image: {days_old} days old',
                    'recommendation': 'Update to newer image version for security patches'
                })
        return issues
    
    def check_insecure_registries(self):
        """Check for images from insecure registries"""
        issues = []
        for container in self.client.containers.list():
            image_name = container.image.tags[0] if container.image.tags else 'unknown'
            if image_name.startswith('localhost:') or not image_name.startswith(('docker.io/', 'gcr.io/', 'quay.io/')):
                if not image_name.startswith(('localhost:', 'registry.', 'harbor.')):
                    issues.append({
                        'container': container.name,
                        'severity': 'LOW',
                        'issue': f'Using non-standard registry: {image_name}',
                        'recommendation': 'Verify registry security and use trusted registries'
                    })
        return issues
    
    def check_resource_limits(self):
        """Check for containers without resource limits"""
        issues = []
        for container in self.client.containers.list():
            host_config = container.attrs.get('HostConfig', {})
            memory_limit = host_config.get('Memory', 0)
            cpu_limit = host_config.get('CpuQuota', -1)
            
            if memory_limit == 0:
                issues.append({
                    'container': container.name,
                    'severity': 'MEDIUM',
                    'issue': 'No memory limit set',
                    'recommendation': 'Set memory limits to prevent resource exhaustion'
                })
            
            if cpu_limit == -1:
                issues.append({
                    'container': container.name,
                    'severity': 'LOW',
                    'issue': 'No CPU limit set',
                    'recommendation': 'Set CPU limits for better resource management'
                })
        return issues
    
    def check_network_modes(self):
        """Check for containers using host network mode"""
        issues = []
        for container in self.client.containers.list():
            network_mode = container.attrs.get('HostConfig', {}).get('NetworkMode', '')
            if network_mode == 'host':
                issues.append({
                    'container': container.name,
                    'severity': 'HIGH',
                    'issue': 'Using host network mode',
                    'recommendation': 'Use bridge or custom networks instead of host network'
                })
        return issues
    
    def check_linux_capabilities(self):
        """Check for containers with excessive capabilities"""
        issues = []
        for container in self.client.containers.list():
            host_config = container.attrs.get('HostConfig', {})
            cap_add = host_config.get('CapAdd', [])
            
            dangerous_caps = ['SYS_ADMIN', 'SYS_PTRACE', 'SYS_MODULE', 'DAC_OVERRIDE']
            for cap in cap_add:
                if cap in dangerous_caps:
                    issues.append({
                        'container': container.name,
                        'severity': 'HIGH',
                        'issue': f'Dangerous capability: {cap}',
                        'recommendation': f'Remove {cap} capability if not essential'
                    })
        return issues
    
    def run_docker_bench_security(self):
        """Run Docker Bench Security if available"""
        try:
            result = subprocess.run([
                'docker', 'run', '--rm', '--net', 'host', '--pid', 'host', '--userns', 'host',
                '--cap-add', 'audit_control',
                '-e', 'DOCKER_CONTENT_TRUST=$DOCKER_CONTENT_TRUST',
                '-v', '/etc:/etc:ro',
                '-v', '/usr/bin/containerd:/usr/bin/containerd:ro',
                '-v', '/usr/bin/runc:/usr/bin/runc:ro',
                '-v', '/usr/lib/systemd:/usr/lib/systemd:ro',
                '-v', '/var/lib:/var/lib:ro',
                '-v', '/var/run/docker.sock:/var/run/docker.sock:ro',
                '--label', 'docker_bench_security',
                'docker/docker-bench-security'
            ], capture_output=True, text=True, timeout=300)
            
            return {
                'available': True,
                'exit_code': result.returncode,
                'output': result.stdout,
                'errors': result.stderr
            }
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return {'available': False, 'error': 'Docker Bench Security not available'}
    
    def scan_for_vulnerabilities(self, container_name):
        """Scan container for vulnerabilities using Trivy if available"""
        try:
            result = subprocess.run([
                'docker', 'run', '--rm', '-v', '/var/run/docker.sock:/var/run/docker.sock',
                'aquasec/trivy:latest', 'image', container_name
            ], capture_output=True, text=True, timeout=300)
            
            return {
                'available': True,
                'exit_code': result.returncode,
                'output': result.stdout,
                'errors': result.stderr
            }
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return {'available': False, 'error': 'Trivy scanner not available'}
    
    def generate_security_report(self, output_format='console'):
        """Generate comprehensive security report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'total_containers': len(self.client.containers.list()),
            'security_issues': {},
            'summary': {'HIGH': 0, 'MEDIUM': 0, 'LOW': 0, 'INFO': 0},
            'recommendations': []
        }
        
        print("🔒 Running Docker Security Assessment...")
        print("=" * 60)
        
        # Run all security checks
        for check_name, check_func in self.security_checks.items():
            print(f"Checking: {check_name.replace('_', ' ').title()}...")
            issues = check_func()
            report['security_issues'][check_name] = issues
            
            for issue in issues:
                severity = issue['severity']
                report['summary'][severity] += 1
                
                if output_format == 'console':
                    severity_emoji = {
                        'HIGH': '🔴',
                        'MEDIUM': '🟡', 
                        'LOW': '🟠',
                        'INFO': '🔵'
                    }
                    print(f"  {severity_emoji[severity]} {issue['container']}: {issue['issue']}")
        
        # Run Docker Bench Security
        print("\nRunning Docker Bench Security...")
        bench_result = self.run_docker_bench_security()
        report['docker_bench'] = bench_result
        
        if bench_result.get('available'):
            print("✅ Docker Bench Security completed")
        else:
            print("⚠️  Docker Bench Security not available")
        
        # Print summary
        print(f"\n📊 Security Assessment Summary:")
        print(f"   🔴 High Severity: {report['summary']['HIGH']}")
        print(f"   🟡 Medium Severity: {report['summary']['MEDIUM']}")
        print(f"   🟠 Low Severity: {report['summary']['LOW']}")
        print(f"   🔵 Info: {report['summary']['INFO']}")
        
        # Generate recommendations
        if report['summary']['HIGH'] > 0:
            print(f"\n⚠️  URGENT: {report['summary']['HIGH']} high-severity issues found!")
            print("   Immediate action recommended for security.")
        
        return report
    
    def export_report(self, report, filename):
        """Export report to JSON file"""
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\n📄 Report exported to: {filename}")

def main():
    parser = argparse.ArgumentParser(description='Docker Security Monitor')
    parser.add_argument('--export', '-e', type=str, help='Export report to JSON file')
    parser.add_argument('--container', '-c', type=str, help='Scan specific container for vulnerabilities')
    parser.add_argument('--format', '-f', choices=['console', 'json'], default='console', help='Output format')
    
    args = parser.parse_args()
    
    monitor = DockerSecurityMonitor()
    
    if args.container:
        print(f"🔍 Scanning container: {args.container}")
        result = monitor.scan_for_vulnerabilities(args.container)
        if result.get('available'):
            print(result['output'])
        else:
            print(result.get('error', 'Vulnerability scanning failed'))
        return
    
    # Generate full security report
    report = monitor.generate_security_report(args.format)
    
    if args.export:
        monitor.export_report(report, args.export)

if __name__ == '__main__':
    main()
