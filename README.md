# Instantiate

[![Coverage](https://img.shields.io/badge/Coverage-Report-blue)](https://valcriss.github.io/Instantiate/) ![CI](https://github.com/valcriss/Instantiate/actions/workflows/ci.yml/badge.svg)

## Overview

**Instantiate** is a DevTool for automatically provisioning full-stack development environments for Merge Requests (MRs). It detects the type of project in a Git repository, spins up ephemeral environments in containers, and exposes services with dynamic port management. It supports both GitHub and GitLab via webhook integrations and is designed to work across many tech stacks (Node.js, Java, Python, etc).

---

## Key Features

- ✨ **Automatic stack instantiation** on each MR
- 📚 Configuration via `.instantiate/config.yml` and Docker templates
- 🌐 GitHub and GitLab webhook integration
- 📉 Dynamic port allocation with collision prevention
- 🛠️ Live build and runtime logs
- ⚡ **(not yet implemented)** Healthcheck and status tracking for deployed services
- ❌ Automatic teardown when MRs are closed
- 🚀 Async processing via MQTT queue

---

## How It Works

1. A Merge Request is created in GitHub or GitLab.
2. A webhook sends the event to the Instantiate backend.
3. Instantiate reads the `.instantiate/config.yml` and `.instantiate/docker-compose.yml` templates.
4. A new environment is created using Docker.
5. Dynamic ports are assigned to avoid conflicts.
6. A comment is added to the merge request with Instantiate links 
7. The environment is accessible via `<base-url>:<dynamic-port>` links.
8. When the MR is closed, the stack is automatically destroyed.

![Workflow](./docs/workflow.svg)

---

## Project Structure

- `src/api` – HTTP endpoints (e.g. `/api/update`)
- `src/core` – Core logic: StackManager, PortAllocator, TemplateEngine
- `src/docker` – DockerService wrapper (compose up/down)
- `src/mqtt` – MQTT publisher and worker (async queueing)
- `tests/` – Unit tests for all core services

---

## Usage

### 1. Prepare Your Project

Inside your Git repository:

```yaml
# .instantiate/config.yml
expose_ports:
  - service: front
    port: 3000 # internal port
    name: FRONT_PORT # external port name
  - service: backend
    port: 4200 # internal port
    name: BACKEND_PORT # external port name
```

```yaml
# .instantiate/docker-compose.yml
services:
  front:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - BACKEND_URL:{{HOST_DNS}}:{{BACKEND_PORT}}
    ports:
      - '{{FRONT_PORT}}:3000'
  backend:
    image: awesome/backend:latest
    ports:
      - '{{BACKEND_PORT}}:4200'
  database:
    image: postgres:latest
    container_name: database
    restart: unless-stopped
    environment:
      - POSTGRES_USER=username
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=database
    volumes:
      - db_data:/var/lib/postgresql/data
```

### 2. Set Up Instantiate

To run Instantiate locally or on a server, you need to:

1. **Download** the [`docker-compose.yml`](https://raw.githubusercontent.com/valcriss/Instantiate/refs/heads/main/docker-compose.yml) file and place it at the root of your deployment folder.
2. **Set environment variables** in **instantiate** service to configure Instantiate according to your needs (see table below).
3. **Launch the stack** with:

```bash
docker compose up -d
```
#### Environment Variables

| Variable                   | Required                                       | Description                                                                                |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| NODE_ENV                   | Yes                                            | Should be set to production to enable production mode behavior.                            |
| LOG_LEVEL                  | Default info                                   | Logging verbosity (info, warn, debug, error). Default is info.                             |
| HOST_DOMAIN                | Default localhost                              | Public domain name or IP where Instantiate build stacks are accessible (e.g. localhost).   |
| HOST_SCHEME                | Default http                                   | URL scheme to use (http or https). Used to build stack URLs.                               |
| REPOSITORY_GITLAB_USERNAME | Required for private repositories              | GitLab username with access to the repositories being deployed (for private repositories). |
| REPOSITORY_GITLAB_TOKEN    | Required for private repositories and comments | GitLab personal access token for commenting on merge requests.                             |
| REPOSITORY_GITHUB_USERNAME | Required for private repositories              | GitHub username with access to the repositories being deployed (for private repositories). |
| REPOSITORY_GITHUB_TOKEN    | Required for private repositories and comments | GitHub personal access token for commenting on merge requests                              |


### 3. Configure Webhooks

For each repository:
- Go to GitHub or GitLab
- Add a webhook:
  - URL: `http://<your-host>:3000/api/update?key=<project-key>`
  - Event: Merge Request or Pull Request events

---

### 4. Stack Overview Page

Instantiate provides a lightweight, server-rendered web page at /stacks that displays all currently running stacks.

Each stack entry includes:
- The project key and merge request ID
- The source control provider (GitHub or GitLab)
- A list of clickable service URLs
- The creation date and time

This page offers a quick and human-friendly overview of all deployed environments, without requiring a separate frontend or dashboard service.

![Dashboard](./docs/dashboard.png)

## Development

```bash
npm run dev            # Starts the api
npm run worker:mqtt    # Starts the mqtt worker
npm run lint           # Lint the code
npm run format         # Format with Prettier
npm run test           # Run tests
npm run test:coverage  # Run tests with coverage
```

---

## License

MIT

---

## Author

Maintained by [@valcriss](https://github.com/valcriss)

