# reliability/disabled-node

Disabled nodes left in the workflow.

- **Category:** reliability
- **Default severity:** warning
- **Autofix:** opt-in flag

## Why

A disabled node passes data through untouched. Left in a production workflow it hides a skipped step, and it often marks debugging that was never cleaned up.

## How to fix

Delete the node, or re-enable it. `--fix --fix-disabled` removes disabled nodes and wires their inputs straight to their outputs, which is what n8n already does at run time.

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable reliability/disabled-node
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "reliability/disabled-node": "off" } }
```
