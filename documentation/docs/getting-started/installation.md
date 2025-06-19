---
sidebar_position: 2
next: configuration-docker
---

# Installation

Instantiate is distributed as a Docker Compose stack. Clone the repository or download the latest [`docker-compose.yml`](https://raw.githubusercontent.com/valcriss/Instantiate/refs/heads/main/docker-compose.yml) from GitHub and modify the environment section of the instantiate service.

```yaml
    environment:
      - NODE_ENV=production
      # - LOG_LEVEL=info
      - HOST_DOMAIN=localhost
      - HOST_SCHEME=http
      # ----------------------------------------------------------------------------------------------------
      #   Uncomment the following lines and set the values if you want to use GitLab authentication
      #   REPOSITORY_GITLAB_TOKEN is required for Gitlab comment on merge requests
      #   You can create a personal access token in GitLab with the "api" and "read_repository" scope.
      # ----------------------------------------------------------------------------------------------------
      # - REPOSITORY_GITLAB_USERNAME=username
      # - REPOSITORY_GITLAB_TOKEN=token
      # ----------------------------------------------------------------------------------------------------
      #   Uncomment the following lines and set the values if you want to use GitHub authentication
      #   REPOSITORY_GITHUB_TOKEN is required for GitHub comment on merge requests
      #   You can create a personal access token in GitHub with the "repo" scope.
      # ----------------------------------------------------------------------------------------------------
      # - REPOSITORY_GITHUB_USERNAME=username
      # - REPOSITORY_GITHUB_TOKEN=token
      # ----------------------------------------------------------------------------------------------------
      - DATABASE_URL=postgresql://instantiate:instantiate@database:5432/instantiate
      - MQTT_BROKER_URL=mqtt://broker:1883
```

When running the services via Docker you must also mount the `/tmp` directory so prebuild commands can access cloned repositories:

```yaml
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /tmp:/tmp
```

Start the services with:

```bash
docker compose up -d
```

After deployment, configure your GitHub or GitLab repository to send webhooks to `http://<host>:3000/api/update?key=<project-key>`.
