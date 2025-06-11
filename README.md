# Instantiate

![CI](https://github.com/valcriss/Instantiate/actions/workflows/ci.yml/badge.svg)

Instantiate automatically provisions disposable environments for every merge request. It listens to your GitHub or GitLab repository events, deploys your stack using Docker or Kubernetes and cleans everything once the review is done.

## Documentation

Detailed guides for installation and configuration are available in the [documentation](https://valcriss.github.io/Instantiate/) site. Start with the **Introduction** and **Getting Started** sections.

## Development

```bash
npm run dev            # start the API
npm run worker:mqtt    # start the MQTT worker
npm run test           # run the test suite
```

## License

This project is licensed under the [MIT License](LICENSE).

Maintained by [@valcriss](https://github.com/valcriss).
