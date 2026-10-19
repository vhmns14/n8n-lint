# Contributing

Thanks for helping. Bug reports with a workflow that reproduces the problem are
the most useful thing you can send. **Strip real secrets and personal data from
any workflow you attach.**

## Setup

```sh
git clone https://github.com/vhmns14/n8n-lint && cd n8n-lint
npm ci
npm test          # vitest; builds dist/ first for the CLI tests
npm run typecheck
```

Node.js 20 or newer.

## Layout

```
src/
  rules/security.ts      security/* rules
  rules/reliability.ts   reliability/* rules
  rules/hygiene.ts       hygiene/* rules
  workflow.ts            n8n format helpers: triggers, graph, node version table
  secrets.ts             secret patterns and entropy
  linter.ts              runs rules, inline disables, file discovery
  fix.ts                 --fix
  formatters/            pretty, json, sarif, github
  cli.ts                 argument parsing and exit codes
test/
  rules/*.test.ts        one describe block per rule, positive and negative cases
  fixtures/real/         real exported workflows (regression fixtures)
docs/rules/              generated, one page per rule
```

## Adding a rule

1. Add a `Rule` object to the right file in `src/rules/` and to that file's
   exported list. Fill in every `meta` field: `rationale` and `fix` become the
   docs page and the SARIF help text.
2. Report through `ctx.report({ node, pointer, message, hint })`. The pointer is
   a JSON pointer into the workflow (`ctx.nodePointer(node) + '/parameters/url'`);
   it is what turns into a line number.
3. Add tests in `test/rules/<category>.test.ts`: at least one case that fires and
   one realistic case that must not. False positives cost more trust than misses.
4. If the rule should match n8n behaviour, link the n8n source or docs you used
   in the PR description.
5. `npm run build && npm run docs` regenerates `docs/rules/` and the README table.
6. Update the CLI snapshot if the bad example output changes:
   `npx vitest run -u`, then read the diff.

## Test secrets

Never commit a string that a secret scanner would recognise as a real token,
even a fake one; GitHub push protection will block it and it trains people to
ignore alerts. Build test tokens from parts at runtime (see `j()` in
`test/helpers.ts`).

## dist/

The GitHub Action runs `dist/cli.js` directly, so `dist/` is committed. Run
`npm run build` and commit the result with your change; CI fails if it is stale.

## Commits and releases

Small focused commits, imperative mood (`add rule for …`, `fix false positive in …`).
Maintainers tag releases `vX.Y.Z` and move the `v0` tag along.
