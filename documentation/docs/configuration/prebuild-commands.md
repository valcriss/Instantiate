---
sidebar_position: 8
---

# Prebuild Commands

Prebuild commands let you prepare the source code of a service before its image is built. They execute inside a temporary container using the image you specify.

Add a `prebuild` block under a service in `.instantiate/config.yml`:

```yaml
services:
  api:
    prebuild:
      image: node:23
      commands:
        - npm ci
        - npm run build
    ports: 1
```

**Properties**

- `image` – Docker image used to run the commands.
- `commands` – list of shell commands executed sequentially with `sh -c`.
- `mountpath` – optional path where the repository is mounted inside the container. Defaults to `/app`.

If the service defines a `repository` section, Instantiate clones that repository and mounts it when running the commands. Otherwise the main project directory is mounted. When using Docker you must also mount `/tmp` on the host so these cloned repositories are accessible.
