# security/insecure-http

Requests to plain http:// URLs on public hosts.

- **Category:** security
- **Default severity:** warning
- **Autofix:** —

## Why

Plain HTTP sends headers (including API keys from credentials) and bodies in clear text across every network hop. Calls to local or Docker-internal hosts are a different matter and are skipped.

## How to fix

Switch the URL to https://. If the service has no TLS, put it behind a reverse proxy that does, or keep it on a private network.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `allowPrivate` | `true` | Skip localhost, private IP ranges, single-label Docker hostnames, and .local/.internal names. |
| `allowHosts` | `[]` | Extra hostnames that may use http://. |

```json
{ "rules": { "security/insecure-http": ["warning", { "allowPrivate": true, "allowHosts": [] }] } }
```

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable security/insecure-http
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "security/insecure-http": "off" } }
```
