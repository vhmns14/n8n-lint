# hygiene/deprecated-node

Node types n8n has replaced (Function, Function Item, Cron, Interval, Start).

- **Category:** hygiene
- **Default severity:** warning
- **Autofix:** —

## Why

These nodes are hidden from the node panel and kept only so old workflows load. They get no fixes, and their behaviour differs from the replacements.

## How to fix

Function / Function Item → Code. Cron / Interval → Schedule Trigger. Start → Manual Trigger.

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable hygiene/deprecated-node
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "hygiene/deprecated-node": "off" } }
```
