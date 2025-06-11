---
sidebar_position: 4
---

# Configuration Swarm

To deploy stacks on Docker Swarm set `orchestrator: swarm` and use a Compose file with Swarm specific options.

```yaml
# .instantiate/config.yml
orchestrator: swarm
expose_ports:
  - service: web
    port: 80
    name: WEB_PORT
```

```yaml
# .instantiate/docker-compose.yml
services:
  web:
    image: nginx
    deploy:
      replicas: 1
    ports:
      - "{{WEB_PORT}}:80"
```
