<p align="center">
  <img src="https://facturahub.com/logo.png" alt="FacturaHub" width="80" />
</p>

<h1 align="center">FacturaHub MCP Server</h1>

<p align="center">
  <strong>AI-powered invoicing for freelancers and small businesses</strong><br/>
  Create invoices, track expenses, and generate tax reports — all through natural language.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/facturahub"><img src="https://img.shields.io/npm/v/facturahub.svg?style=flat-square&color=CB3837" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/facturahub"><img src="https://img.shields.io/npm/dm/facturahub.svg?style=flat-square&color=blue" alt="npm downloads" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="MIT License" /></a>
  <a href="https://facturahub.com"><img src="https://img.shields.io/badge/Website-facturahub.com-7C3AED?style=flat-square" alt="Website" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#what-can-it-do">Features</a> ·
  <a href="#available-tools">Tools</a> ·
  <a href="#supported-countries">Countries</a> ·
  <a href="#pricing">Pricing</a>
</p>

---

## What is FacturaHub?

**FacturaHub** is an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that connects your AI assistant to a full invoicing & financial management platform. It works with **Claude Desktop**, **Claude Code**, **Cursor**, and any MCP-compatible client.

Instead of switching between apps, just talk to your AI:

> *"Create an invoice for Acme Corp for €2,500 for web development, due in 30 days"*

Your AI creates the invoice, auto-creates the client if it's new, applies your tax rate, and generates a professional PDF — all in one sentence.

---

## Quick Start

### Option 1: One command (recommended)

```bash
npx -y facturahub setup --api-key=YOUR_API_KEY
```

This auto-detects your installed AI clients and configures them all. Done.

### Option 2: Manual configuration

Add this JSON to your AI client's config file:

| Client | Config file |
|--------|-------------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Code | `~/.claude/settings.json` |
| Cursor | `~/.cursor/mcp.json` |

```json
{
  "mcpServers": {
    "facturahub": {
      "command": "npx",
      "args": ["-y", "facturahub@latest"],
      "env": {
        "FACTURAHUB_API_KEY": "your-api-key-here",
        "FACTURAHUB_API_URL": "https://api.facturahub.com"
      }
    }
  }
}
```

### Get your API Key

1. Sign up at **[facturahub.com](https://facturahub.com)**
2. Complete onboarding (select your country, company details)
3. Copy your API key from **Dashboard → API Key**

---

## What Can It Do?

Talk to your AI in natural language. FacturaHub handles the rest.

| You say | What happens |
|---------|-------------|
| "Create an invoice for Acme Corp for €2,500" | Creates the invoice, auto-creates client if new |
| "What's my P&L this month?" | Shows income, expenses, net profit |
| "Log an expense of €49 on Vercel, hosting" | Registers expense with category |
| "Show me overdue invoices" | Lists overdue invoices with days overdue |
| "Tax summary for Q1" | VAT/IVA collected, deductible expenses, taxable income |
| "Duplicate last invoice for Acme" | Creates a copy with a new date |
| "Cash flow projection for 3 months" | Projects income/expenses based on pending invoices |
| "Mark invoice #INV-012 as paid" | Updates status and records payment date |
| "Generate PDF for the last invoice" | Creates a professional PDF document |
| "Create a client: John Doe, john@example.com" | Adds a new client to your database |
| "List all clients" | Shows all your registered clients |
| "Send reminder for overdue invoices" | Lists invoices that need follow-up |
| "What's my VAT balance for Q1?" | Shows VAT collected vs paid, credit or payable |
| "Income summary for 2026" | Annual earnings with quarterly breakdown |
| "Delete expense abc123" | Removes an incorrect expense entry |
| "Show my profile" | Displays your company info, tax ID, bank details |
| "Update my IBAN to ES12 3456 7890" | Updates your bank details on profile |
| "Change my company name to Acme SL" | Updates your business profile |

---

## Available Tools

FacturaHub exposes **20 MCP tools** that your AI can use:

### Invoicing

| Tool | Description |
|------|-------------|
| `create_invoice` | Create an invoice with line items, tax, and auto-client resolution |
| `duplicate_invoice` | Copy an existing invoice with a new date (great for recurring billing) |
| `send_invoice` | Mark an invoice as sent |
| `list_invoices` | List and filter invoices by client, status, or date range |
| `get_invoice` | Get full details of a specific invoice |
| `mark_paid` | Mark an invoice as paid |
| `download_pdf` | Generate a professional PDF for an invoice |
| `send_reminder` | List overdue invoices that need reminders |

### Clients

| Tool | Description |
|------|-------------|
| `create_client` | Create a new client (or let `create_invoice` auto-create) |
| `list_clients` | List and search your clients |

### Expenses & Reports

| Tool | Description |
|------|-------------|
| `register_expense` | Log an expense with category, vendor, and optional recurrence |
| `delete_expense` | Delete an expense by ID |
| `get_context` | Financial summary dashboard: pending, overdue, monthly income |
| `get_profit_loss` | Profit & Loss report for any month |
| `get_tax_summary` | Tax summary for quarterly declarations (VAT/IVA) |
| `get_vat_balance` | VAT/IVA/BTW balance: collected vs paid, credit or payable |
| `get_income_summary` | Annual earnings: gross/net income, expenses, taxable income by quarter |
| `get_cashflow` | Cash flow projection based on pending invoices & recurring expenses |

### Profile

| Tool | Description |
|------|-------------|
| `get_profile` | View your business profile: company, tax ID, address, bank details |
| `update_profile` | Update company info, address, tax rate, currency, bank details |

---

## Supported Countries

FacturaHub supports **20+ countries** with localized tax rates and currency:

🇪🇸 Spain · 🇲🇽 Mexico · 🇦🇷 Argentina · 🇨🇴 Colombia · 🇨🇱 Chile · 🇵🇪 Peru · 🇺🇾 Uruguay · 🇧🇷 Brazil · 🇨🇷 Costa Rica · 🇪🇨 Ecuador · 🇵🇦 Panama · 🇩🇴 Dominican Republic · 🇳🇱 Netherlands · 🇩🇪 Germany · 🇫🇷 France · 🇮🇹 Italy · 🇵🇹 Portugal · 🇺🇸 United States · 🇬🇧 United Kingdom · and more

---

## CLI Commands

```bash
facturahub                          # Start MCP server (used by AI clients)
facturahub setup                    # Interactive setup — auto-detects clients
facturahub setup --api-key=XXX      # Non-interactive setup with API key
facturahub setup --target=cursor    # Install for a specific client only
facturahub status                   # Check installation across all clients
facturahub uninstall                # Remove from all clients
facturahub help                     # Show help
```

---

## How It Works

```
┌─────────────────┐      stdio       ┌──────────────────┐      HTTPS      ┌──────────────────┐
│   Claude /       │ ◄──────────────► │   FacturaHub     │ ◄─────────────► │   FacturaHub     │
│   Cursor /       │   MCP Protocol   │   MCP Server     │   REST API      │   Cloud API      │
│   Any MCP Client │                  │   (this package)  │                 │                  │
└─────────────────┘                  └──────────────────┘                  └──────────────────┘
```

1. Your AI client starts the FacturaHub MCP server via `npx`
2. The server authenticates with your API key
3. Your AI gets access to all 15 invoicing tools
4. When you ask for something, the AI calls the right tool
5. The server talks to the FacturaHub API and returns the result

---

## Pricing

| Plan | Price | Invoices/month | Features |
|------|-------|----------------|----------|
| **Free** | €0 | 5 | All tools, 5 invoices/month |
| **Starter** | €4.99/mo | 30 | All tools, 30 invoices/month |
| **Pro** | €19/mo | Unlimited | All tools, unlimited invoices |

All plans include: expense tracking, P&L reports, tax summaries, cash flow projections, PDF generation, and multi-currency support.

**[Start free →](https://facturahub.com)**

---

## Tech Stack

- **Protocol**: [Model Context Protocol (MCP)](https://modelcontextprotocol.io) via `@modelcontextprotocol/sdk`
- **Transport**: stdio (standard for MCP servers)
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Validation**: Zod schemas for all tool inputs

---

## Development

```bash
git clone https://github.com/Santy1422/facturahub-mcp.git
cd facturahub-mcp
npm install
npm run build
```

To test locally:

```bash
FACTURAHUB_API_KEY=your-key node dist/cli.js
```

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the repo
2. Create your branch (`git checkout -b feature/awesome`)
3. Commit your changes
4. Push and open a PR

---

## Links

- **Website**: [facturahub.com](https://facturahub.com)
- **npm**: [npmjs.com/package/facturahub](https://www.npmjs.com/package/facturahub)
- **Issues**: [GitHub Issues](https://github.com/Santy1422/facturahub-mcp/issues)

---

## License

[MIT](LICENSE) — Made with care by [FacturaHub](https://facturahub.com)
