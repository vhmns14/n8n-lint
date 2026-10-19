# reliability/http-resilience

HTTP Request nodes without Retry On Fail or a timeout.

- **Category:** reliability
- **Default severity:** warning
- **Autofix:** —

## Why

Most HTTP failures are transient (a 502, a reset connection, a 429). One retry with a short wait fixes them. Without a timeout, a hung server holds the execution open until the instance-wide limit, if there is one.

## How to fix

In the node's **Settings** turn on **Retry On Fail** (3 tries, 1–5 s wait is a sane start). In **Options** add **Timeout** (e.g. 30000 ms).

## Options

| Option | Default | Description |
| --- | --- | --- |
| `requireRetry` | `true` | Report nodes without retryOnFail. |
| `requireTimeout` | `true` | Report nodes without options.timeout. |

```json
{ "rules": { "reliability/http-resilience": ["warning", { "requireRetry": true, "requireTimeout": true }] } }
```

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable reliability/http-resilience
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "reliability/http-resilience": "off" } }
```
