---
sidebar_position: 3
---

# Configuration Docker

Set `orchestrator: compose` in `.instantiate/config.yml` and provide a standard Compose template. By default Instantiate reads `.instantiate/docker-compose.yml` but you can override this path with the `stackfile` property.

Example:

```yaml
# .instantiate/config.yml
orchestrator: compose
stackfile: docker-compose.yml
repositories:
  backend:
    repo: git@github.com:org/backend.git
    branch: develop
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
  backend:
    build:
      context: {{BACKEND_PATH}}
```
