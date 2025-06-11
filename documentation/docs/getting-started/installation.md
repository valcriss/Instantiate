---
sidebar_position: 2
next: configuration-docker
---

# Installation

Instantiate is distributed as a Docker Compose stack. Clone the repository or download the latest `docker-compose.yml` from GitHub and create an `.env` file based on the provided example.

```bash
cp .env.example .env
# adjust HOST_DOMAIN and repository credentials
```

Start the services with:

```bash
docker compose up -d
```

After deployment, configure your GitHub or GitLab repository to send webhooks to `http://<host>:3000/api/update?key=<project-key>`.
