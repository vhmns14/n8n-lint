# security/webhook-no-auth

Webhook (or MCP Server) trigger with authentication set to "None".

- **Category:** security
- **Default severity:** warning
- **Autofix:** —

## Why

A production webhook URL is reachable by anyone who learns it, and the path is often guessable or leaks through logs and browser history. Without authentication, any caller can start the workflow, burn API credits, or inject data.

## How to fix

Set **Authentication** to Header Auth, Basic Auth, or JWT Auth and create the matching credential. If the caller signs its requests instead (Stripe, GitHub, Telegram secret token), verify the signature in the first node after the trigger and disable this rule for that node with a note: `n8n-lint-disable security/webhook-no-auth`.

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable security/webhook-no-auth
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "security/webhook-no-auth": "off" } }
```
