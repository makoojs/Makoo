# Makoo Release Rules

Use this reference only for explicitly requested changeset, versioning, changelog, publishing, release-workflow, or release-failure work.

- Makoo uses Changesets for published package versioning and changelogs.
- Published packages maintain package-level changelogs under `packages/*/CHANGELOG.md`. The root `CHANGELOG.md` is a legacy project-level archive, not the current release source.
- Do not manually edit package versions except in Changesets-generated version pull requests.
- The release workflow is `.github/workflows/changesets-release.yml`: it creates a `Version Packages` pull request, then publishes after that pull request merges.
- Publishing uses npm trusted publishing through GitHub Actions. Preserve `id-token: write`; do not pass `NPM_TOKEN` or `NODE_AUTH_TOKEN` to publishing steps, and do not use `npm whoami` as an authentication check.
- Configure the npm trusted publisher for each published package with workflow filename `changesets-release.yml`.
- If Actions cannot create the version pull request, inspect repository or organization workflow permissions for pull-request creation before changing release code.
