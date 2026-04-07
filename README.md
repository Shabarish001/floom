# floom

**The production layer for AI agents.** Deploy Python scripts as cloud automations with a shareable web UI, REST API, and MCP endpoint. No Docker, no infra, no YAML.

Tell your AI agent "deploy on floom" and your script is live in seconds.

## What floom does

You write a Python script. floom turns it into:

- A **web UI** with typed inputs and outputs anyone can use
- A **REST API** other services can call
- An **MCP endpoint** AI agents can discover
- **Managed secrets**, version history, and scheduling

No Docker. No CI/CD. No infrastructure. Just Python in, production out.

## Who it's for

- **Developers** who build Python automations and need to share them with non-technical people
- **AI agencies** deploying tools for clients
- **Anyone using Claude Code or Cursor** who wants to go from localhost to production instantly

## Quick start

### Install the Claude Code skill

```bash
git clone https://github.com/floomhq/floom.git ~/.claude/skills/floom-repo && ~/.claude/skills/floom-repo/scripts/setup
```

### Deploy your first script

1. Type `/floom` in Claude Code
2. Point it at any Python script
3. It adapts, tests in a sandbox, and deploys
4. You get a live URL to share

Or tell any MCP-capable agent: **"deploy this on floom"**

## Local Development (Dashboard)

This repository also includes the Floom dashboard built with Next.js, Convex, and Clerk.

You can run the dashboard locally for development, but some platform features require external services and additional credentials.

### 1. Install dependencies

```bash
npm install
```

### 2. Start Convex development

```bash
npx convex dev
```

This connects the app to a Convex development deployment and keeps generated files in sync.

### 3. Configure environment variables

Create a `.env.local` file and add:

```bash
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CONVEX_SITE_URL=
CONVEX_DEPLOYMENT=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_JWT_ISSUER_DOMAIN=https://<your-clerk-domain>.clerk.accounts.dev
```

### 4. Configure Convex auth environment

This repo's Convex auth requires `CLERK_JWT_ISSUER_DOMAIN`.

Set it in Convex as well:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-clerk-domain>.clerk.accounts.dev
```

### 5. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

### Notes

- Some features depend on external services such as R2, E2B, email, and scraping, and may not work locally without additional credentials.
- Workspace setup depends on successful Clerk to Convex authentication.
- If the app gets stuck during setup, verify your Clerk and Convex configuration.
- This repository supports both the dashboard and the Claude/Cursor deployment workflow. Local development primarily targets the dashboard.

### Write a script from scratch

```python
import os
from google import genai

def run(url: str) -> dict:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=f"Summarize the company at {url} in 3 sentences."
    )
    return {"summary": response.text}
```

That's it. floom handles the rest: sandbox testing, deployment, UI generation, secret injection.

## How it works

1. **Write** a Python script with a `run()` function
2. **Deploy** via Claude Code (`/floom`), Cursor, or any MCP-capable agent
3. **Test** runs automatically in an E2B sandbox (EU-hosted, SOC 2 certified)
4. **Share** the live URL with anyone

See [BUILDING.md](BUILDING.md) for the full protocol: manifest format, input/output types, API reference.

## API

All endpoints at `dashboard.floom.dev/api/`. Full reference in [BUILDING.md](BUILDING.md).

```bash
# Upload code
curl -X POST https://dashboard.floom.dev/api/artifacts \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"code": "def run(x): return {\"result\": x}", "manifest": {...}}'

# Test in sandbox
curl -X POST https://dashboard.floom.dev/api/test \
  -d '{"artifactId": "...", "inputs": {"x": "hello"}}'

# Deploy
curl -X POST https://dashboard.floom.dev/api/deploy \
  -d '{"artifactId": "..."}'
```

## Features

| Feature | Status |
|---------|--------|
| Deploy from any AI agent | Available |
| Web UI with typed inputs/outputs | Available |
| REST API per automation | Available |
| Managed secrets | Available |
| Version history and rollback | Available |
| Sandbox testing (E2B) | Available |
| Scheduling (cron) | Available |
| File uploads (PDF, CSV, XLSX) | Available |
| MCP endpoint | Coming soon |
| Multi-file projects | Coming soon |
| Workspaces and teams | Planned |

## Compared to

| | floom | n8n | Vercel | Modal |
|--|-------|-----|--------|-------|
| Deploy from AI agent | Yes | No | No | No |
| No-signup first deploy | Yes | No | No | No |
| Auto-generated UI | Yes | No | No | No |
| Python-native | Yes | Partial | No | Yes |
| Sandbox testing | Yes | No | No | No |
| 10-second deploy | Yes | No | Partial | No |

## Stack

- **Runtime**: [E2B](https://e2b.dev) sandboxes (EU-hosted, SOC 2 Type II)
- **Backend**: [Convex](https://convex.dev)
- **Auth**: [Clerk](https://clerk.com)
- **Storage**: Cloudflare R2
- **Frontend**: Next.js on Vercel

## Links

- **Dashboard**: [dashboard.floom.dev](https://dashboard.floom.dev)
- **Docs**: [docs.floom.dev](https://docs.floom.dev)
- **Protocol reference**: [BUILDING.md](BUILDING.md)

## FAQ

### What is floom?

floom is the production layer for AI agents. You write a Python script, and floom turns it into a cloud automation with a shareable web UI, REST API, and MCP endpoint. No Docker, no infra, no YAML. Tell your AI agent "deploy on floom" and your script is live in seconds.

### How is floom different from n8n, Zapier, or Make?

n8n, Zapier, and Make are visual workflow builders where you connect nodes in a GUI. floom is code-first: you write a Python function, and the platform generates the UI, API, and infrastructure automatically. There is no drag-and-drop editor. You deploy from your terminal or AI agent, and non-technical teammates use the generated web UI to run it.

### How is floom different from Vercel or Modal?

Vercel deploys full web apps. Modal deploys Python functions but requires their SDK and decorators. floom deploys a single Python `run()` function and automatically generates a web UI with typed inputs and outputs, so anyone on your team can use it without writing code or calling an API.

### Does floom work with Claude Code?

Yes. Install the skill with `git clone https://github.com/floomhq/floom.git ~/.claude/skills/floom-repo && ~/.claude/skills/floom-repo/scripts/setup`, then type `/floom` in Claude Code. It adapts your script, tests it in a sandbox, and deploys it.

### Does floom work with Cursor, Windsurf, or other AI agents?

Yes. Any MCP-capable agent can deploy to floom. The protocol is a standard REST API: upload code + manifest, test, deploy. See [BUILDING.md](BUILDING.md) for the full API reference.

### Is my data safe?

Code runs in E2B sandboxes, which are EU-hosted and SOC 2 Type II certified. Each run gets an isolated sandbox that is destroyed after execution. Secrets are encrypted at rest and injected at runtime, never exposed in logs or UI.

### How much does it cost?

floom is free to start. See [dashboard.floom.dev](https://dashboard.floom.dev) for current pricing details.

### What languages does floom support?

Python. Your script needs a `run()` function that takes typed parameters and returns a dict. Dependencies are pip-installed automatically from the manifest.

### Can I schedule automations?

Yes. Add a `schedule` field (cron syntax) to your manifest. For example, `"schedule": "0 9 * * 1"` runs every Monday at 9am. You can also set `scheduleInputs` with default values for scheduled runs.

### Can I upload files (PDF, CSV, Excel)?

Yes. Use the `file` input type in your manifest. The user uploads a file through the web UI, and your `run()` function receives an R2 URL string. Download it with `requests.get()` or `httpx.get()` inside your function.

## License

Open source. See [LICENSE](LICENSE) for details.
