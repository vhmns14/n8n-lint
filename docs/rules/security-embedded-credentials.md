# security/embedded-credentials

Credentials typed into headers/query params, or credential data inlined in the export.

- **Category:** security
- **Default severity:** error
- **Autofix:** —

## Why

n8n exports reference credentials by id and name only; the secret stays encrypted in the instance. An `Authorization` header or `api_key` query parameter typed by hand, or a `credentials` block carrying secret fields, bypasses that and ships the secret with the file.

## How to fix

Create a credential (Header Auth, Query Auth, Basic Auth, or the service's own type), set **Authentication** on the node to use it, and delete the hand-typed parameter.

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable security/embedded-credentials
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "security/embedded-credentials": "off" } }
```
