# security/hardcoded-secret

API keys, tokens, and passwords written into node parameters or Code nodes.

- **Category:** security
- **Default severity:** error
- **Autofix:** —

## Why

Workflow exports get committed to git, pasted into forums, and shared as templates. Anything typed into a parameter travels with the file. n8n credentials are stored encrypted and are never part of an export, so a secret in a parameter is the one place it leaks.

## How to fix

Rotate the key first: assume it is already public. Then move it into an n8n credential (Header Auth, a service credential, or a Custom Auth credential) and select that credential on the node. In Code nodes, read values from an earlier node or `$env` (when `N8N_BLOCK_ENV_ACCESS_IN_NODE` allows it) instead of literals.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `minEntropy` | `3.5` | Shannon entropy (bits/char) a value under a secret-looking key must reach to be reported. |

```json
{ "rules": { "security/hardcoded-secret": ["error", { "minEntropy": 3.5 }] } }
```

## Disabling

For one node, add this line to the node's **Notes** (Settings → Notes):

```
n8n-lint-disable security/hardcoded-secret
```

For the whole project, in `.n8nlintrc.json`:

```json
{ "rules": { "security/hardcoded-secret": "off" } }
```
