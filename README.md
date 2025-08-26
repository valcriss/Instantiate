# Instantiate

![CI](https://github.com/valcriss/Instantiate/actions/workflows/ci.yml/badge.svg)

Instantiate automatically provisions disposable environments for every merge request. It listens to your GitHub or GitLab repository events, deploys your stack using Docker or Kubernetes and cleans everything once the review is done.

## Documentation

Detailed guides for installation and configuration are available in the [documentation](https://valcriss.github.io/Instantiate/) site. Start with the **Introduction** and **Getting Started** sections. Configuration options, such as the `IGNORE_BRANCH_PREFIX` environment variable to skip branches with a specific prefix, are documented there as well.

## Development

```bash
npm run dev            # start the API
npm run worker:mqtt    # start the MQTT worker
npm run test           # run the test suite
```

## Integrating AI into the Developer Workflow

As part of the development of Instantiate, I actively use AI tools such as OpenAI's Codex to assist with coding, debugging, and design decisions. In my view, it's no longer reasonable to deny the role that artificial intelligence plays in modern software development. Just as version control or continuous integration became essential tools of the trade, AI is now becoming a natural extension of a developer’s toolkit.

Rather than resisting this shift, I believe it's far more productive, and necessary, to learn how to harness these tools effectively. By understanding their strengths and limitations, we can use AI not only to accelerate development but also to deepen our own knowledge, challenge our assumptions, and explore new possibilities. For me, integrating AI into my workflow is not about replacing human effort but about enhancing it. It’s a new skill set that, when mastered, can lead to better results, faster iterations, and more thoughtful software design.

## License

This project is licensed under the [MIT License](LICENSE).

Maintained by [@valcriss](https://github.com/valcriss).
