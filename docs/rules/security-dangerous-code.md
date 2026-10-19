# security/dangerous-code

Code nodes using eval, child_process, or filesystem access; Execute Command nodes.

- **Category:** security
- **Default severity:** error
- **Autofix:** —

## Why

Code nodes run on the n8n host. `eval` on workflow data turns any webhook payload into code execution; `child_process` and `fs` reach the server itself. n8n blocks most of these unless `NODE_FUNCTION_ALLOW_BUILTIN` is set, so finding them usually means the instance was opened up to make them work.

## How to fix

Parse data with `JSON.parse` instead of `eval`. Move shell or file work out of the workflow into a dedicated service you call over HTTP, or use the built-in Read/Write Files node with a restricted path.

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable security/dangerous-code
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "security/dangerous-code": "off" } }
```
