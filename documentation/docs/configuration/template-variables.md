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
- Port variables defined in `.instantiate/config.yml` under `services`. For each service defining `ports`, Instantiate exposes variables like `APP_PORT` or `APP_PORT_1`, `APP_PORT_2`, etc. The number provided for `ports` determines how many dynamic ports are reserved.
- `*_PATH` - path on disk of repositories defined for services under `services`. The variable name is the service key uppercased followed by `_PATH` (e.g. `BACKEND_PATH`).

Example usage:

```yaml
services:
  web:
    image: nginx
    ports:
      - "{{WEB_PORT}}:80"
```
