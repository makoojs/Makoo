# Makoo Documentation Rules

Use these rules when editing public README files or documentation-site content.

- Describe the current framework: supported APIs, observable behavior, usage, constraints, and examples.
- Keep implementation history and migration rationale in changesets, changelogs, ADRs, commit messages, or pull-request descriptions. Do not turn user documentation into a record of superseded technical decisions.
- Describe current behavior positively and with terms users already know. For example, say that `hooks`, `callback`, and `activitySignal` may be declared inline or imported from browser-compatible files instead of inventing an umbrella term such as "runtime functions."
- Keep config resolution and plugin wiring in architecture or internal CLI documentation unless users need those details to use or debug a feature. Explain the observable result and required user action in usage guides.
- Use negative wording for a current user-facing requirement or boundary, not merely to contrast the current architecture with an abandoned implementation.
- When synchronizing paired documentation languages, treat the version edited by the user as the source. Preserve its meaning and structure while updating the other language; do not rewrite the source beyond necessary correctness fixes.
- Before finishing, scan affected public docs for stale migration language such as `now`, `no longer`, `formerly`, `instead of the old`, `不再`, or `以前`. Review matches in context rather than replacing them blindly.
