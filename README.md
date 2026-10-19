# n8n-lint

[![CI](https://github.com/vhmns14/n8n-lint/actions/workflows/ci.yml/badge.svg)](https://github.com/vhmns14/n8n-lint/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/n8n-lint.svg)](https://www.npmjs.com/package/n8n-lint)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node 20+](https://img.shields.io/badge/node-%3E%3D20-339933)

A static linter for [n8n](https://n8n.io) workflow exports. Point it at the JSON files you keep in git and it reports the mistakes that bite later: API keys typed into nodes, webhooks anyone can call, pinned customer data left in the export, HTTP calls with no retry, nodes nothing reaches.

It runs as a CLI, a GitHub Action, or a library. No n8n instance needed, no network calls, no runtime dependencies.

```sh
npx n8n-lint ./workflows
```

```text
workflows/lead-capture.json
  5:21    warning  Webhook "Webhook1" accepts unauthenticated requests on /lead-intake.  security/webhook-no-auth
                   ↳ Use Header Auth, Basic Auth, or JWT Auth, or verify the sender's signature right after the trigger.
  22:19   error    OpenAI API key in `jsCode` of "Code" (sk-p…qX (56 chars)).  security/hardcoded-secret
                   ↳ Rotate it, then move it into an n8n credential and reference that instead.
  22:19   error    Code node "Code" uses eval().  security/dangerous-code
  49:16   warning  "HTTP Request1" calls http://crm.acme-corp.io without TLS.  security/insecure-http
  55:24   error    "HTTP Request1" sends "Authorization" as a hand-typed parameter (Bear…a0 (39 chars)) instead of a credential.  security/embedded-credentials
  130:15  error    Node name "Format Reply" is used more than once.  reliability/duplicate-node-name
  152:5   warning  "Old Sheets Export" is not connected to anything.  reliability/unreachable-node
  275:15  warning  No error workflow set, and 4 node(s) that call external services have no error handling: "HTTP Request1", "Notify Ops", "Telegram", "Old Sheets Export".  reliability/unhandled-errors
  278:14  warning  Pinned data on 1 node(s) ("Webhook1"), 1 item(s) in total.  security/pin-data
                   ↳ Run with --fix to strip pinData.

✖ 24 problems (7 errors, 10 warnings, 7 info) in 1 workflow(s), 1 file(s).
  3 can be fixed with --fix (see --help for opt-in fixes).
```

That is a trimmed excerpt (some findings and hint lines cut) of `npx n8n-lint examples/bad-workflow.json`; the file is in this repo if you want to try it.

Secrets are never printed in full: findings show the first four and last two characters.

## Why

n8n workflows are code, but they are exported as one JSON blob with code inside escaped strings, so normal linters and reviewers see nothing. The usual failure modes are boring and repeatable:

- someone pastes an API key into an HTTP Request header "just to test" and exports the workflow to a public repo;
- a webhook goes live with authentication left at **None**;
- pinned test data (real customer messages) ships inside a template;
- an HTTP call fails once at 3 a.m. and nobody finds out because no error workflow was set.

n8n-lint checks for these in CI, with line numbers, before the workflow is imported anywhere.

## Install

```sh
npm install --save-dev n8n-lint     # or run it ad hoc with npx
```

Requires Node.js 20 or newer.

## CLI

```text
n8n-lint [paths...] [options]        paths default to "."

  -f, --format <name>    pretty (default), json, sarif, github
  -o, --output <file>    write the report to a file instead of stdout
      --sarif <file>     also write a SARIF report to <file>
      --fail-on <level>  exit 1 when a finding is at least: error (default), warning, info, none
  -c, --config <file>    config file (default: nearest .n8nlintrc.json)
      --rule <id=level>  override a rule, e.g. --rule hygiene/default-node-name=off (repeatable)
      --fix              apply safe fixes in place (strips pinData)
      --fix-disabled     with --fix: also remove disabled nodes, bridging their connections
      --fix-names        with --fix: rename default-named HTTP Request nodes to "METHOD host"
      --list-rules       print all rules and exit
  -q, --quiet            only report errors
```

Directories are searched recursively for `*.json`; files that are not n8n workflows (no `nodes` and `connections`) are skipped, and `node_modules`, `.git`, and `dist` are ignored. Both single-workflow exports and the array produced by `n8n export:workflow --all` are supported.

**Exit codes:** `0` nothing at or above `--fail-on`, `1` findings at or above it, `2` bad arguments, bad config, or a file that is not valid JSON.

### Output formats

| Format | Use it for |
| --- | --- |
| `pretty` | Humans. Colour when stdout is a TTY; respects `NO_COLOR`. |
| `json` | Scripts and dashboards. Includes a summary and every finding with file, line, JSON pointer, node name, and docs link. |
| `sarif` | GitHub code scanning and other SARIF viewers (SARIF 2.1.0, validated against the OASIS schema in tests). |
| `github` | GitHub Actions workflow commands: findings appear as annotations on the PR diff. |

## Rules

<!-- rules:start -->
| Rule | Default | Fix | What it catches |
| --- | --- | --- | --- |
| [`security/hardcoded-secret`](docs/rules/security-hardcoded-secret.md) | error |  | API keys, tokens, and passwords written into node parameters or Code nodes. |
| [`security/webhook-no-auth`](docs/rules/security-webhook-no-auth.md) | warning |  | Webhook (or MCP Server) trigger with authentication set to "None". |
| [`security/pin-data`](docs/rules/security-pin-data.md) | warning | ✓ | Pinned test data left in the export. |
| [`security/insecure-http`](docs/rules/security-insecure-http.md) | warning |  | Requests to plain http:// URLs on public hosts. |
| [`security/dangerous-code`](docs/rules/security-dangerous-code.md) | error |  | Code nodes using eval, child_process, or filesystem access; Execute Command nodes. |
| [`security/embedded-credentials`](docs/rules/security-embedded-credentials.md) | error |  | Credentials typed into headers/query params, or credential data inlined in the export. |
| [`reliability/unhandled-errors`](docs/rules/reliability-unhandled-errors.md) | warning |  | Nodes that call external services, with no error workflow and no per-node error handling. |
| [`reliability/http-resilience`](docs/rules/reliability-http-resilience.md) | warning |  | HTTP Request nodes without Retry On Fail or a timeout. |
| [`reliability/unreachable-node`](docs/rules/reliability-unreachable-node.md) | warning |  | Nodes no trigger can reach (orphaned or disconnected). |
| [`reliability/disabled-node`](docs/rules/reliability-disabled-node.md) | warning | opt-in | Disabled nodes left in the workflow. |
| [`reliability/duplicate-node-name`](docs/rules/reliability-duplicate-node-name.md) | error |  | Two nodes with the same name. |
| [`reliability/no-trigger`](docs/rules/reliability-no-trigger.md) | warning |  | Workflow with no enabled trigger node. |
| [`reliability/large-code-node`](docs/rules/reliability-large-code-node.md) | warning |  | Code nodes too big to review in the editor. |
| [`hygiene/default-node-name`](docs/rules/hygiene-default-node-name.md) | info | opt-in | Nodes still named "HTTP Request1", "Code", "If". |
| [`hygiene/missing-metadata`](docs/rules/hygiene-missing-metadata.md) | info |  | Workflow without a description (or sticky note) or without tags. |
| [`hygiene/outdated-type-version`](docs/rules/hygiene-outdated-type-version.md) | info |  | Nodes pinned to an old typeVersion of a node that has a newer one. |
| [`hygiene/deprecated-node`](docs/rules/hygiene-deprecated-node.md) | warning |  | Node types n8n has replaced (Function, Function Item, Cron, Interval, Start). |
<!-- rules:end -->

Each rule links to a page explaining why it exists, how to fix it, and its options. `n8n-lint --list-rules` prints the same list.

**What "risky node" means** for `reliability/unhandled-errors`: HTTP Request, LLM root nodes (AI Agent, OpenAI, Basic LLM Chain and similar), and any SaaS node (Telegram, Google Sheets, Slack, Postgres, …). Pure data nodes (Code, If, Set, Merge, …) are not counted.

**What `--fix` will and will not do.** It only makes changes that cannot alter what the workflow does:

- always: remove `pinData`;
- with `--fix-disabled`: remove disabled nodes and connect their inputs to their outputs (n8n already passes data through disabled nodes, so behaviour is unchanged). Disabled triggers are left alone;
- with `--fix-names`: rename `HTTP Request`, `HTTP Request1`, … to `POST api.example.com`, and rewrite connections, `$('…')`, `$node["…"]`, and `pinData` keys to match.

It never touches secrets. A leaked key needs rotating, not deleting.

## Configuration

Put `.n8nlintrc.json` in your repository root (or pass `--config`). Every key is optional.

```json
{
  "failOn": "error",
  "ignore": ["workflows/archive/**"],
  "rules": {
    "hygiene/default-node-name": "off",
    "security/webhook-no-auth": "error",
    "reliability/large-code-node": ["warning", { "maxLines": 250 }],
    "security/insecure-http": ["warning", { "allowHosts": ["legacy-erp.internal.example"] }],
    "hygiene/outdated-type-version": ["info", { "level": "minor" }]
  },
  "overrides": [
    { "files": ["templates/**"], "rules": { "hygiene/missing-metadata": "off" } }
  ]
}
```

Severity is `error`, `warning`, `info`, or `off`. Options for each rule are on its docs page.

### Disabling a rule inline

n8n has no comments, so n8n-lint reads the node's **Notes** field (node → Settings → Notes):

```text
Stripe signs every request; the signature is checked in "Verify Stripe Signature".
n8n-lint-disable security/webhook-no-auth
```

`n8n-lint-disable` on its own disables every rule for that node. To disable rules for a whole workflow, put `n8n-lint-disable-workflow <rule-id>` in a sticky note or in the workflow description.

## GitHub Action

```yaml
# .github/workflows/n8n-lint.yml
name: n8n-lint
on: [pull_request]
permissions:
  contents: read
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - uses: vhmns14/n8n-lint@v0
        with:
          path: workflows
```

| Input | Default | Description |
| --- | --- | --- |
| `path` | `.` | Files or directories, space-separated. |
| `fail-on` | `error` | `error`, `warning`, `info`, or `none`. |
| `format` | `github` | Console format. `github` gives inline PR annotations. |
| `config` | | Config file path. Defaults to the nearest `.n8nlintrc.json`. |
| `sarif` | `false` | `true` writes SARIF and uploads it to code scanning. Needs `security-events: write`. |
| `sarif-file` | `n8n-lint.sarif` | Where the SARIF file goes. |
| `args` | | Extra CLI flags. |

Outputs: `exit-code`, `sarif-file`.

The Action runs the bundled `dist/` with the runner's Node.js, so no `npm install` happens in your job. When `sarif` is on, the SARIF upload still runs if the lint fails, and the step fails afterwards.

### Ready-made workflows

Copy one of these into `.github/workflows/`:

- [`templates/n8n-lint-pr.yml`](templates/n8n-lint-pr.yml): annotate pull requests that touch workflow files; block merges on errors.
- [`templates/n8n-lint-code-scanning.yml`](templates/n8n-lint-code-scanning.yml): send findings to the Security tab via SARIF. Code scanning is free on public repos; private repos need GitHub Code Security.
- [`templates/n8n-lint-weekly-audit.yml`](templates/n8n-lint-weekly-audit.yml): a Monday-morning audit of every workflow, written to the job summary and kept as an artifact, so new rules catch old workflows too.

## Library

```ts
import { lintText, lintWorkflow, formatSarif } from 'n8n-lint';

const result = lintText(json, 'workflows/lead-capture.json', {
  config: { rules: { 'hygiene/default-node-name': 'off' } },
});
for (const f of result.findings) console.log(f.ruleId, f.location.line, f.message);
```

## Exporting workflows for linting

From the n8n CLI (self-hosted):

```sh
n8n export:workflow --all --separate --output=workflows/
```

or download each workflow from the editor (**⋯ → Download**). Exports never contain credential secrets, only credential ids and names, which is exactly why a secret that does show up in one is a problem.

## Limitations

- Static only. n8n-lint never runs a workflow and cannot tell whether an expression resolves to something sensible.
- Secret detection is pattern- and entropy-based. It will miss a password that looks like a word, and it can flag a random-looking ID stored under a key called `token`. Disable inline when it is wrong.
- Latest node versions come from n8n's source as of October 2026. The table lives in `src/workflow.ts` and needs an update when n8n ships new major node versions.
- Community nodes are checked with the generic rules only.

## Roadmap

- Check that `settings.errorWorkflow` points at a workflow that exists in the same repo and starts with an Error Trigger.
- Expression checks: `$('Node')` references to nodes that do not exist (renamed or deleted).
- Credential consistency: the same service authenticated with different credentials across workflows.
- AI-specific rules: agents with no max-iterations, tools with no description, LLM nodes with no token limit.
- `--fix` for HTTP Request timeouts and retry defaults (opt-in).
- A pre-commit hook and a VS Code extension.

Ideas and rule requests are welcome in the issues.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © vahmi sofyan
