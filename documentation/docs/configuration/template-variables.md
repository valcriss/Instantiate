---
sidebar_position: 7
---

# Template Variables

Instantiate renders the stack template defined in `.instantiate/config.yml` using Mustache. By default the file is `docker-compose.yml` (or `all.yml` for Kubernetes). The following variables are available when the template is processed:

- `PROJECT_KEY` - unique identifier for the repository defined in the webhook URL.
- `MR_ID` - identifier of the merge request being deployed.
- `HOST_DOMAIN` - value from the `HOST_DOMAIN` environment variable.
- `HOST_SCHEME` - value from the `HOST_SCHEME` environment variable.
- `HOST_DNS` - combination of `HOST_SCHEME` and `HOST_DOMAIN`.
- Port variables defined in `.instantiate/config.yml` under `expose_ports` (for example `WEB_PORT`, `API_PORT`, ...). Each variable receives a dynamic port allocated for the stack.

Example usage:

```yaml
services:
  web:
    image: nginx
    ports:
      - "{{WEB_PORT}}:80"
```
