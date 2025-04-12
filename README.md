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
  - service: web
    port: 3000
    name: WEB_PORT
```

```yaml
# .instantiate/docker-compose.yml
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '${WEB_PORT}:3000'
```

### 2. Set Up Instantiate

**Work in progress**

### 3. Configure Webhooks

For each repository:
- Go to GitHub or GitLab
- Add a webhook:
  - URL: `http://<your-host>:3000/api/update?key=<project-key>`
  - Event: Merge Request or Pull Request events

---

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

