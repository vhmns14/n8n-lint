# reliability/unhandled-errors

Nodes that call external services, with no error workflow and no per-node error handling.

- **Category:** reliability
- **Default severity:** warning
- **Autofix:** —

## Why

HTTP calls, LLMs, and SaaS APIs fail: rate limits, timeouts, expired tokens. With no error workflow set and no `On Error` setting on the node, a failure stops the run silently and you find out when someone complains.

## How to fix

Set **Settings → Error workflow** to a workflow that starts with an Error Trigger and alerts you, or set **On Error** on each risky node to "Continue (using error output)" and handle that branch.

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable reliability/unhandled-errors
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "reliability/unhandled-errors": "off" } }
```
