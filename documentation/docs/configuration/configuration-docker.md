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
    behavior: match
expose_ports:
  - service: app
    port: 3000
    name: APP_PORT
```

The `behavior` property controls how Instantiate selects the branch to clone:

- `fixed` (default) always clones the branch specified in `branch` (or the repository's default branch if `branch` is omitted).
- `match` tries to clone a branch with the same name as the merge request. If that branch does not exist, the value of `branch` or the default branch is used instead.

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
