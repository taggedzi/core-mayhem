# Contributing to Core Mayhem

Contributions are welcome: bug reports, documentation, accessibility improvements,
tests, gameplay fixes, and feature ideas all help. Please follow the
[Code of Conduct](CODE_OF_CONDUCT.md) in project discussions and reviews.

## Report a problem or suggest an idea

Search [existing issues](https://github.com/taggedzi/core-mayhem/issues) first,
then use the appropriate form on the
[new issue page](https://github.com/taggedzi/core-mayhem/issues/new/choose).

- **Bugs:** include reproduction steps, expected and actual behavior, browser and
  operating system, and the game URL or version. Console errors and recordings help.
- **Simulation or balance:** include the matchup, configuration, seed if known,
  and results across multiple rounds when available.
- **Features:** explain the problem or player need and the behavior you propose.

For substantial features, new dependencies, or broad refactors, open an issue to
discuss the approach before investing in implementation. Small fixes can go
straight to a pull request. Never include credentials or private information in
public reports.

For suspected security vulnerabilities, follow the [Security Policy](SECURITY.md)
and use private reporting rather than a public issue.

## Set up a development checkout

Use Git, npm, and **Node.js 24**, matching the GitHub Actions checks. Fork the
repository on GitHub if you do not have write access, then clone your fork:

```bash
git clone https://github.com/YOUR-USERNAME/core-mayhem.git
cd core-mayhem
git switch -c codex/describe-your-change
cd core-mayhem
npm ci
npm run dev
```

Replace `YOUR-USERNAME` with your GitHub username and choose a descriptive branch
name. Open the local URL printed by Vite.

**Run npm commands from the inner `core-mayhem/` directory**, where `package.json`
lives. The repository root contains the README and GitHub configuration.

Ollama and a model download are optional; built-in banter works without them.
See the [README](README.md#development) for the source layout, configuration,
debugging controls, and other commands.

## Make a focused change

Follow the surrounding TypeScript style and keep each pull request focused on
one problem. Avoid unrelated formatting or cleanup. Add or update tests when
changing simulation behavior, and explain intentional changes in gameplay.

For balance changes, record the relevant configuration, seed when available,
number of rounds, and results. `npm run sim` runs the batch simulation configured
by `batch.config.json` and writes reports to the application's `stats/` directory.

Do not commit dependency folders, build output, coverage output, TypeScript build
caches (`*.tsbuildinfo`), local settings, or generated simulation reports unless
they are specifically needed as reviewed project fixtures. If you change npm
dependencies, include the application `package-lock.json` update.

## Validate your changes

Before submitting, run the same checks used by GitHub Actions from the application
directory:

```bash
npm run format
npm run test:release
npm run ci
```

`npm run ci` checks TypeScript, runs ESLint and coverage tests, and builds the
production site. Formatting and release-script tests are separate checks.
The full test suite includes batch simulations and may generate reports.

For gameplay or interface changes, also check the affected behavior in a browser.
Use `npm run preview` after a build to inspect the production version. Include
screenshots or recordings for visible changes and describe your manual checks.
For documentation-only changes, check links and formatting; application tests
are generally unnecessary. State any checks you could not run and why.

## Submit a pull request

Commit and push your branch, then open a pull request against `main`. Fill out
the pull request template with:

- The problem and what changes for users or developers.
- Related issues, using `Closes #123` when the change resolves an issue.
- Validation results and any known limitations or follow-up work.

Keep the description current as the change evolves. Respond to review feedback
and resolve failing checks before requesting another review. You do not need to
publish a release or change the package version to contribute; maintainers handle
releases through the [release workflow](core-mayhem/docs/RELEASE_PROCESS.md).

## Code and asset licensing

Original project code and documentation use the [MIT license](LICENSE).
Contributions to those files are provided under the same license. Only submit
work you have the right to contribute.

Media can have different terms. Before adding or replacing audio, images, or other
assets, document their source and license in [MEDIA_LICENSES.md](MEDIA_LICENSES.md)
and update notices as needed. The existing background music is separately
copyrighted and is not licensed for redistribution by downstream users.
