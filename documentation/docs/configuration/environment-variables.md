---
sidebar_position: 6
---

# Environment Variables

Instantiate is configured through several environment variables. These values
can be defined in a `.env` file or directly in your deployment files. The
`.env.example` file in the project root provides a starting point.

## List of variables

- `HOST_DOMAIN` - domain used to build service URLs. Defaults to `localhost`.
- `HOST_SCHEME` - scheme for service URLs (`http` or `https`). Defaults to `http`.
- `PORT_MIN` - lowest port number available for exposed services. Defaults to `10000`.
- `PORT_MAX` - highest port number available for exposed services. Defaults to `11000`.
- `EXCLUDED_PORTS` - comma-separated list of ports that will never be allocated even if free.
- `REPOSITORY_GITLAB_USERNAME` and `REPOSITORY_GITLAB_TOKEN` - credentials for GitLab access and comments.
- `REPOSITORY_GITHUB_USERNAME` and `REPOSITORY_GITHUB_TOKEN` - credentials for GitHub access and comments.
- `DATABASE_URL` - PostgreSQL connection string used by the application.
- `MQTT_BROKER_URL` - URL of the MQTT broker for asynchronous workers.
- `LOG_LEVEL` - logging level for the server (e.g. `info`, `debug`). Default is `info`.
- `IGNORE_SSL_ERRORS` - set to `true` to disable SSL verification when cloning repositories or contacting GitLab.
- `NODE_ENV` - set to `development` for local testing. It alters clone URLs so containers can reach the host machine.
- `PORT` - HTTP port for the web server. Defaults to `3000`.
- `WORKING_PATH` - base directory where repositories are cloned. Defaults to `/tmp`.
