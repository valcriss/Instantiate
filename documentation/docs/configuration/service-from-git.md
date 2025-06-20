---
sidebar_position: 9
---

# Service from git

Services can be built from separate repositories. Use the `repository` block to tell Instantiate where to clone the source code.

```yaml
services:
  backend:
    repository:
      repo: git@github.com:org/backend.git
      branch: develop
      behavior: match
    ports: 1
```

**Properties**

- `repo` – Git URL of the repository.
- `branch` – branch to clone. If omitted the repository's default branch is used.
- `behavior` – how Instantiate selects the branch:
  - `fixed` (default) always uses the branch defined in `branch` or the default branch.
  - `match` checks if a branch with the same name as the merge request exists. If found that branch is cloned, otherwise it falls back to `branch` or the default branch.

Credentials for cloning can be provided through the environment variables `REPOSITORY_GITLAB_USERNAME`/`REPOSITORY_GITLAB_TOKEN` or `REPOSITORY_GITHUB_USERNAME`/`REPOSITORY_GITHUB_TOKEN`.
