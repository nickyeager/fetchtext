# FetchText Stack Monitoring Tools

This directory contains comprehensive monitoring tools for the FetchText Docker stack, including container health checks, port verification, resource monitoring, and alerting capabilities.

## 🛠️ Available Monitoring Tools

### Basic Health Monitoring
- **`quick_health_check.sh`** - Fast shell script for basic service availability
- **`monitor_services.py`** - Python script with detailed container and port checking
- **`container_monitor.py`** - Real-time container resource monitoring
- **`health_dashboard.py`** - Web-based monitoring dashboard

### Advanced Monitoring
- **`docker_metrics.py`** - Container metrics collection and analysis
- **`log_analyzer.py`** - Log aggregation and error detection
- **`network_monitor.py`** - Docker network connectivity testing
- **`alerting_system.py`** - Configurable alerting for service failures

### Continuous Monitoring
- **`monitoring_daemon.py`** - Background service for continuous monitoring
- **`prometheus_exporter.py`** - Prometheus metrics exporter for the stack
- **`grafana_config/`** - Pre-configured Grafana dashboards

## 🚀 Quick Start

### Run Basic Health Check
```bash
./monitoring/quick_health_check.sh
```

### Run Detailed Monitoring
```bash
python3 monitoring/monitor_services.py
```

### Start Web Dashboard
```bash
python3 monitoring/health_dashboard.py
```

### Start Continuous Monitoring
```bash
python3 monitoring/monitoring_daemon.py --config monitoring/config.yaml
```

## 📊 Monitoring Features

### Container Health
- ✅ Container status (running/stopped/restarting)
- ✅ Health check status
- ✅ Restart count and patterns
- ✅ Resource usage (CPU, Memory, Disk)
- ✅ Network connectivity

### Service Availability
- ✅ Port accessibility testing
- ✅ HTTP endpoint health checks
- ✅ API response validation
- ✅ Database connectivity
- ✅ Inter-service communication

### Performance Monitoring
- ✅ Response time tracking
- ✅ Resource utilization trends
- ✅ Error rate monitoring
- ✅ Throughput analysis
- ✅ Capacity planning metrics

### Alerting
- ✅ Email notifications
- ✅ Slack integration
- ✅ Custom webhook alerts
- ✅ SMS notifications (via Twilio)
- ✅ PagerDuty integration

## 🔧 Configuration

### Environment Variables
```bash
# Alerting Configuration
MONITORING_EMAIL_SMTP_SERVER=smtp.gmail.com
MONITORING_EMAIL_FROM=alerts@yourdomain.com
MONITORING_EMAIL_TO=admin@yourdomain.com
MONITORING_SLACK_WEBHOOK=https://hooks.slack.com/services/...

# Monitoring Intervals
MONITORING_CHECK_INTERVAL=30  # seconds
MONITORING_ALERT_COOLDOWN=300  # seconds
MONITORING_LOG_RETENTION=7  # days
```

### Configuration File
See `monitoring/config.yaml` for detailed configuration options.

## 📈 Integration Options

### Prometheus + Grafana
- Metrics collection and visualization
- Custom dashboards for FetchText stack
- Alerting rules and notifications
