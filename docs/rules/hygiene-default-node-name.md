# hygiene/default-node-name

Nodes still named "HTTP Request1", "Code", "If".

- **Category:** hygiene
- **Default severity:** info
- **Autofix:** opt-in flag

## Why

Node names show up in execution logs, error alerts, and `$('Node')` expressions. "HTTP Request3 failed" tells nobody anything at 2 a.m.

## How to fix

Rename the node after what it does ("Fetch invoice", "Is paid?"). `--fix --fix-names` renames HTTP Request nodes to METHOD + host and updates connections and expressions.

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable hygiene/default-node-name
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "hygiene/default-node-name": "off" } }
```
