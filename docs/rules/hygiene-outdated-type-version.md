# hygiene/outdated-type-version

Nodes pinned to an old typeVersion of a node that has a newer one.

- **Category:** hygiene
- **Default severity:** info
- **Autofix:** —

## Why

n8n keeps old node versions working but stops improving them. A major version behind usually means older parameter layouts and missing options (for example HTTP Request v1–3 lack pagination and the newer auth handling). Only node types with a known latest version are checked.

## How to fix

Add a fresh copy of the node from the panel, copy the settings across, and delete the old one. Test it: major versions can change parameter names.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `level` | `"major"` | "major" reports only nodes a whole major version behind; "minor" reports any older version. |

```json
{ "rules": { "hygiene/outdated-type-version": ["info", { "level": "major" }] } }
```

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable hygiene/outdated-type-version
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "hygiene/outdated-type-version": "off" } }
```
