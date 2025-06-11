---
sidebar_position: 2
---

# Configuration Docker

Set `orchestrator: compose` in `.instantiate/config.yml` and provide a standard Compose template in `.instantiate/docker-compose.yml`.

Example:

```yaml
# .instantiate/config.yml
orchestrator: compose
expose_ports:
  - service: app
    port: 3000
    name: APP_PORT
```

```yaml
# .instantiate/docker-compose.yml
services:
  app:
    build: .
    ports:
      - "{{APP_PORT}}:3000"
```
