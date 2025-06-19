---
sidebar_position: 4
---

# Configuration Swarm

To deploy stacks on Docker Swarm set `orchestrator: swarm` and use a Compose file with Swarm specific options. The stack template defaults to `.instantiate/docker-compose.yml` and can be changed with the `stackfile` option.

```yaml
# .instantiate/config.yml
orchestrator: swarm
stackfile: docker-compose.yml

services:
  web:
    prebuild:
      image: node:23
      commands:
        - npm install
        - npm run build
    ports: 1
```

Use the optional `prebuild` object to run commands before Docker builds the image. Commands execute inside a temporary container defined by `image`. The service code is mounted in `/app` by default and can be changed using `mountpath`.

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
