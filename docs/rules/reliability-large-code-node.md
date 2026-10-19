# reliability/large-code-node

Code nodes too big to review in the editor.

- **Category:** reliability
- **Default severity:** warning
- **Autofix:** —

## Why

Hundreds of lines in a Code node are untested, unreviewed, and invisible in diffs of the export (one escaped JSON string). Logic that size belongs in a sub-workflow, a small service, or at least several smaller nodes.

## How to fix

Split the node, move shared logic into a sub-workflow, or move it into a versioned service you call over HTTP.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `maxLines` | `150` | Lines allowed in one Code node. |
| `maxChars` | `8000` | Characters allowed in one Code node. |

```json
{ "rules": { "reliability/large-code-node": ["warning", { "maxLines": 150, "maxChars": 8000 }] } }
```

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable reliability/large-code-node
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "reliability/large-code-node": "off" } }
```
