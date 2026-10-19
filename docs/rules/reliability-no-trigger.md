# reliability/no-trigger

Workflow with no enabled trigger node.

- **Category:** reliability
- **Default severity:** warning
- **Autofix:** —

## Why

Without a trigger the workflow can only be run by hand from the editor. That is fine for scratch work, but in a repo of production workflows it usually means the trigger was deleted or disabled.

## How to fix

Add a trigger (Schedule, Webhook, an app trigger, or Execute Workflow Trigger for sub-workflows), or enable the disabled one.

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable reliability/no-trigger
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "reliability/no-trigger": "off" } }
```
