# Publish action and CLI

Validates the quizzes of a folder (one sub-folder per quiz: an unzipped QuizDock export) and the themes of another (one sub-folder per theme), builds a reproducible `.quizdock.zip` or `.quizdock-theme.zip` for each valid one, and publishes them with an `index.json`, as described in the [specification](../SPECIFICATION.md).

## GitHub Action

Used by the author template ([quizdock/quizdock-extensions](https://github.com/quizdock/quizdock-extensions)):

```yaml
permissions:
  contents: write
steps:
  - uses: actions/checkout@v4
  - uses: quizdock/quizdock-store/publish-action@main
```

`@main` until the store is stable: the action is not versioned yet.

Inputs: `directory` (default `quizzes`), `themes-directory` (default `themes`), `max-mb` (default `20`), `tag` (default `quizzes`), `token` (default the workflow token). Invalid quizzes and themes are left out and reported, and the job fails; the valid ones are published anyway. The zips exist only in the release, never in the repository.

## CLI

The same checks, zips and index, for another CI or a static folder:

```sh
node publish-action/src/cli.mjs --dir quizzes --themes-dir themes --out public \
  --base-url https://quizzes.example.org/alice --host forge.example.org --vendor alice
```

It writes `<slug>.quizdock.zip` and `<slug>.quizdock-theme.zip` files and `index.json` to `--out`, prints a report, and exits with 1 when a quiz or a theme could not be published.

## Development

```sh
npm ci
npm test
npm run build   # regenerates dist/action.mjs, which is committed
```

The bundle schemas in `schema/` are copies of QuizDock's (see `schema/SOURCE.md`).
