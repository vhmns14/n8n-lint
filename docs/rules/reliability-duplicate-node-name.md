# reliability/duplicate-node-name

Two nodes with the same name.

- **Category:** reliability
- **Default severity:** error
- **Autofix:** —

## Why

n8n keys connections and `$('Node')` expressions by node name. Duplicate names (usually from hand-edited or merged JSON) make connections and expressions resolve to the wrong node, or fail on import.

## How to fix

Rename one of the nodes and update any expressions that referenced it.

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable reliability/duplicate-node-name
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "reliability/duplicate-node-name": "off" } }
```
