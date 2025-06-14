# LocalAI Stack Monitoring Tools

This directory contains comprehensive monitoring tools for the LocalAI Docker stack, including container health checks, port verification, resource monitoring, and alerting capabilities.

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
- Custom dashboards for LocalAI stack
- Alerting rules and notifications

### ELK Stack (Elasticsearch, Logstash, Kibana)
- Centralized log management
- Log analysis and search
- Custom log dashboards

### Third-Party Services
- **Datadog** - Full-stack monitoring
- **New Relic** - APM and infrastructure monitoring
- **Sentry** - Error tracking and performance monitoring
- **Uptime Robot** - External uptime monitoring

## 🔍 Troubleshooting

### Common Issues
1. **Port conflicts** - Use the port mapping reference in `../PORT_CONFIGURATION.md`
2. **Network connectivity** - Check Docker network configuration
3. **Resource constraints** - Monitor memory and CPU usage
4. **Service dependencies** - Verify startup order and health checks

### Debug Commands
```bash
# Check container logs
docker logs <container_name>

# Inspect container details
docker inspect <container_name>

# Check network connectivity
docker exec <container> ping <target_container>

# Monitor resource usage
docker stats

# Check Docker events
docker events
```

## 📋 Monitoring Checklist

- [ ] All containers running
- [ ] All ports accessible
- [ ] Health checks passing
- [ ] Resource usage within limits
- [ ] No error patterns in logs
- [ ] Network connectivity working
- [ ] Database connections healthy
- [ ] API endpoints responding
- [ ] Inter-service communication working
- [ ] Backup systems operational

## 🚨 Alert Types

### Critical Alerts
- Container stopped unexpectedly
- Service completely unavailable
- Database connection failures
- Ollama model loading failures
- Disk space critically low

### Warning Alerts
- High resource usage (>80%)
- Slow response times
- Increasing error rates
- Health check intermittent failures
- Log error patterns detected

### Info Alerts
- Container restarts
- Configuration changes
- Scheduled maintenance
- Performance benchmarks
- Resource usage reports

---

For more information about the LocalAI stack configuration, see the main project documentation.
