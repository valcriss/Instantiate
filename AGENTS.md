# Project Overview

Instantiate automatically spins up per-merge-request environments for repositories using container orchestrators like Docker Compose. It listens to events from GitHub and GitLab, reads configuration templates from the repository, and deploys disposable stacks so reviewers can test features easily. When the merge request closes, the environment is torn down.

# Before each commit

- Run `npm run lint` and ensure it finishes without any errors or warnings.
- Execute `npm run test` and confirm that total coverage is **100%** with 100% for lines, branches and methods across the entire project.
- Run `npm run build` and check that it completes without errors or warnings.
