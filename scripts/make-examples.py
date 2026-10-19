"""Regenerates examples/bad-workflow.json and examples/good-workflow.json.

Every secret below is invented for this file and has never been valid anywhere.
"""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent / "examples"
root.mkdir(exist_ok=True)

big = "\n".join(f"  row{i} = String(row{i} ?? '').trim(); // normalise field {i}" for i in range(190))
big_code = (
    "// Hand-rolled CSV cleanup that grew over time\nconst rows = $input.all();\nlet "
    + ", ".join(f"row{i}" for i in range(190))
    + ";\n"
    + big
    + "\nreturn rows;"
)
tg = "7123456789:AA" + "Hq3vZt8LpRkX2mN9cW4bY7dJ1sF6gT0uE"
assert len(tg.split(":AA")[1]) == 33

bad = {
    "name": "Lead Capture (DO NOT SHIP)",
    "nodes": [
        {"parameters": {"httpMethod": "POST", "path": "lead-intake", "options": {}},
         "id": "a1", "name": "Webhook1", "type": "n8n-nodes-base.webhook", "typeVersion": 1,
         "position": [0, 300], "webhookId": "3f1d9c2e-0000-4000-8000-000000000001"},
        {"parameters": {"jsCode": "const OPENAI_KEY = 'sk-proj-Rk82hQmZ7xLw3VtN9pYc4BdF6gJ1sK5aU0eH2iO8rT7yW3qX';\n"
                                  "const rules = eval($json.body.rules);\n"
                                  "const { execSync } = require('child_process');\n"
                                  "execSync('echo ' + $json.body.email + ' >> /tmp/leads.txt');\n"
                                  "return [{ json: { ...$json.body, rules, key: OPENAI_KEY } }];"},
         "id": "a2", "name": "Code", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [220, 300]},
        {"parameters": {"functionCode": "items[0].json.source = 'web';\nreturn items;"},
         "id": "a3", "name": "Legacy Transform", "type": "n8n-nodes-base.function", "typeVersion": 1, "position": [440, 300]},
        {"parameters": {"method": "POST", "url": "http://crm.acme-corp.io/api/v1/leads", "sendHeaders": True,
                        "headerParameters": {"parameters": [{"name": "Authorization", "value": "Bearer 9f8e7d6c5b4a39281706f5e4d3c2b1a0"}]},
                        "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json) }}", "options": {}},
         "id": "a4", "name": "HTTP Request1", "type": "n8n-nodes-base.httpRequest", "typeVersion": 3, "position": [660, 300]},
        {"parameters": {"method": "POST", "url": "https://ops:Pa55w0rd-2024!@hooks.acme-corp.io/notify", "options": {}},
         "id": "a5", "name": "Notify Ops", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [880, 200],
         "retryOnFail": True, "maxTries": 3},
        {"parameters": {"chatId": "123456789", "text": "=New lead: {{ $json.email }}", "additionalFields": {}},
         "id": "a6", "name": "Telegram", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [880, 400],
         "credentials": {"telegramApi": {"id": "1", "name": "Telegram account", "accessToken": tg}}},
        {"parameters": {"jsCode": "return [{ json: { ok: true } }];"},
         "id": "a7", "name": "Format Reply", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1100, 200]},
        {"parameters": {"jsCode": "return [{ json: { ok: true, channel: 'telegram' } }];"},
         "id": "a8", "name": "Format Reply", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1100, 400]},
        {"parameters": {"jsCode": "console.log(JSON.stringify($input.all()));\nreturn $input.all();"},
         "id": "a9", "name": "Debug Logger", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1320, 300], "disabled": True},
        {"parameters": {"operation": "append",
                        "documentId": {"__rl": True, "value": "1AbCdEf", "mode": "id"},
                        "sheetName": {"__rl": True, "value": "gid=0", "mode": "list"}, "options": {}},
         "id": "a10", "name": "Old Sheets Export", "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.5, "position": [660, 600]},
        {"parameters": {"jsCode": big_code},
         "id": "a11", "name": "Clean CSV", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1540, 300]},
    ],
    "connections": {
        "Webhook1": {"main": [[{"node": "Code", "type": "main", "index": 0}]]},
        "Code": {"main": [[{"node": "Legacy Transform", "type": "main", "index": 0}]]},
        "Legacy Transform": {"main": [[{"node": "HTTP Request1", "type": "main", "index": 0}]]},
        "HTTP Request1": {"main": [[{"node": "Notify Ops", "type": "main", "index": 0},
                                    {"node": "Telegram", "type": "main", "index": 0}]]},
        "Notify Ops": {"main": [[{"node": "Format Reply", "type": "main", "index": 0}]]},
        "Format Reply": {"main": [[{"node": "Debug Logger", "type": "main", "index": 0}]]},
        "Debug Logger": {"main": [[{"node": "Clean CSV", "type": "main", "index": 0}]]},
    },
    "active": False,
    "settings": {"executionOrder": "v1"},
    "pinData": {"Webhook1": [{"json": {"body": {"name": "Rina Wulandari", "email": "rina.w@customer-mail.co.id",
                                                "phone": "+62 812 0000 0000", "rules": "[]"}}}]},
    "tags": [],
}

good = {
    "name": "Lead Capture",
    "description": "Receives website leads over an authenticated webhook, scores them with an LLM, and posts hot leads to Telegram.",
    "nodes": [
        {"parameters": {"httpMethod": "POST", "path": "lead-intake", "authentication": "headerAuth", "options": {}},
         "id": "b1", "name": "Lead Webhook", "type": "n8n-nodes-base.webhook", "typeVersion": 2.2, "position": [0, 300],
         "webhookId": "3f1d9c2e-0000-4000-8000-000000000002",
         "credentials": {"httpHeaderAuth": {"id": "Xy12", "name": "Lead webhook secret"}}},
        {"parameters": {"jsCode": "const b = $json.body ?? {};\nreturn [{ json: { email: String(b.email ?? '').trim(), message: String(b.message ?? '').slice(0, 2000) } }];"},
         "id": "b2", "name": "Normalize Lead", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [220, 300]},
        {"parameters": {"method": "POST", "url": "https://api.openai.com/v1/chat/completions",
                        "authentication": "predefinedCredentialType", "nodeCredentialType": "openAiApi",
                        "sendBody": True, "specifyBody": "json",
                        "jsonBody": "={{ JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: $json.message }] }) }}",
                        "options": {"timeout": 30000}},
         "id": "b3", "name": "Score Lead", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [440, 300],
         "retryOnFail": True, "maxTries": 3, "waitBetweenTries": 2000,
         "credentials": {"openAiApi": {"id": "Ab34", "name": "OpenAI"}}},
        {"parameters": {"chatId": "={{ $vars.LEADS_CHAT_ID }}", "text": "=New lead: {{ $('Normalize Lead').first().json.email }}", "additionalFields": {}},
         "id": "b4", "name": "Post to Telegram", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [660, 300],
         "retryOnFail": True, "maxTries": 3,
         "credentials": {"telegramApi": {"id": "Cd56", "name": "Leads bot"}}},
    ],
    "connections": {
        "Lead Webhook": {"main": [[{"node": "Normalize Lead", "type": "main", "index": 0}]]},
        "Normalize Lead": {"main": [[{"node": "Score Lead", "type": "main", "index": 0}]]},
        "Score Lead": {"main": [[{"node": "Post to Telegram", "type": "main", "index": 0}]]},
    },
    "active": False,
    "settings": {"executionOrder": "v1", "errorWorkflow": "errAlertTelegram"},
    "pinData": {},
    "tags": [{"name": "leads"}, {"name": "production"}],
}

for name, wf in (("bad-workflow.json", bad), ("good-workflow.json", good)):
    (root / name).write_text(json.dumps(wf, indent=2) + "\n")
print("wrote", root)
