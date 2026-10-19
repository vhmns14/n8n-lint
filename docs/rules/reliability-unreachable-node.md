# reliability/unreachable-node

Nodes no trigger can reach (orphaned or disconnected).

- **Category:** reliability
- **Default severity:** warning
- **Autofix:** —

## Why

A node with no path from a trigger never runs. It usually means a connection was deleted by accident, which silently drops a step (the "send confirmation email" that stopped happening).

## How to fix

Reconnect the node, or delete it if it is left over.

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable reliability/unreachable-node
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "reliability/unreachable-node": "off" } }
```
