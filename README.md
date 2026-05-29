<p align="center">
  <img src="https://facturahub.com/logo.png" alt="FacturaHub — AI invoicing MCP server" width="80" />
</p>

<h1 align="center">FacturaHub — AI Invoicing & Business Management via MCP</h1>

<p align="center">
  <strong>The complete MCP server for invoicing, expenses, tasks, team management, POS, inventory, reports, and admin panel.</strong><br/>
  Run your entire business from Claude, ChatGPT, Cursor, or Windsurf. 69 tools. One npm install.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/facturahub"><img src="https://img.shields.io/npm/v/facturahub.svg?style=flat-square&color=CB3837" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/facturahub"><img src="https://img.shields.io/npm/dm/facturahub.svg?style=flat-square&color=blue" alt="npm downloads" /></a>
  <a href="https://facturahub.com"><img src="https://img.shields.io/badge/Website-facturahub.com-7C3AED?style=flat-square" alt="Website" /></a>
</p>

---

## Who is FacturaHub for?

Freelancers, consultants, agencies, and startups (1-30 people) who want to run their business from their AI assistant — create invoices, track expenses, manage tasks, generate reports, and handle taxes, all by talking to Claude or ChatGPT. One MCP server the whole team shares.

**Roles and permissions**: each member sees only what they need.

| Role | Access |
|------|--------|
| Owner / Admin | Everything |
| Finance | Invoices, clients, expenses, reports |
| Operations | Tasks, clients |
| Member | Tasks |
| Viewer | Reports (read-only) |

---

## 3 steps. 2 minutes. Free.

### 1. Create your account

Sign up at **[facturahub.com](https://facturahub.com/register)** -- free, no credit card.

After onboarding you get your **API Key** and your team is ready.

### 2. Install in your AI

```bash
npx -y facturahub setup --api-key=YOUR_API_KEY
```

Auto-detects Claude Desktop, ChatGPT Desktop, Claude Code and Cursor.

### 3. Talk to your AI

Open your AI client and try:

> *"Create an invoice for Acme Corp for 2,500 EUR for web development"*
> *"Create a task to review the staging deploy, assign to Juan, high priority"*

The AI creates everything automatically -- invoices, clients, tasks, expenses.

---

## What can I do?

Talk to your AI in natural language — FacturaHub handles the rest. Here are examples by category:

### Invoicing and finances

| You say | What happens |
|---------|-------------|
| "Create an invoice for Acme for 2,500 EUR" | Creates invoice + client automatically |
| "Register a 49 EUR expense for Vercel, hosting" | Registers expense with category and tax |
| "How's my P&L this month?" | Revenue, expenses, net profit |
| "How much VAT do I owe this quarter?" | VAT balance: collected vs paid |
| "Pending invoices" | Lists overdue invoices |
| "Mark invoice #001 as paid" | Updates status and payment date |
| "Download PDF of the last invoice" | Generates professional PDF |

### Task management

| You say | What happens |
|---------|-------------|
| "Create a task: review Acme contract, high priority" | Creates task in backlog |
| "My pending tasks" | Lists your assigned tasks |
| "Move the deploy task to review" | Validated status transition |
| "Assign the onboarding task to Maria" | Assigns to team member |
| "How's the team board?" | Overview: tasks by status and person |

### Admin panel & reports

| You say | What happens |
|---------|-------------|
| "Give me a dashboard overview" | Revenue, expenses, profit, overdue, open tasks |
| "Show the aging report" | Unpaid invoices by days overdue (1-30, 31-60, 61-90, 90+) |
| "Revenue by client this quarter" | Breakdown per client with percentages |
| "What happened this week?" | Activity log: who did what and when |
| "Export my invoices as CSV" | Download link for filtered data |
| "Remove Juan from the team" | Removes team member (admin only) |
| "Change Maria's role to finance" | Updates permissions |

### E-Invoice (Panama)

| You say | What happens |
|---------|-------------|
| "Emit this invoice to DGI" | Validates RUC and submits to DGI via Factura Facil |

---

## Use cases: connect with your stack

FacturaHub is an MCP server. Combine it with other MCPs to automate your business:

| Use case | How it works |
|----------|-------------|
| **Expenses from Telegram** | Connect Claude Code Channels to Telegram. Your team sends "Expense 49 EUR on AWS" from their phone. |
| **Invoices from Gmail** | Connect Gmail MCP. "Find this month's supplier invoices and register them as expenses". Claude reads the PDFs and imports them. |
| **Slack notifications** | Claude notifies you on Slack when an invoice is overdue or when someone completes a task. |
| **Tasks from GitHub** | A PR gets merged -> Claude creates the deploy task and assigns it. Connect your repo via GitHub MCP. |
| **Import from Excel** | Paste your spreadsheet of invoices or expenses. Claude parses and registers everything. |

---

## 69 MCP tools

| Category | Tools |
|----------|-------|
| **Invoices** | `create_invoice` . `update_invoice` . `delete_invoice` . `duplicate_invoice` . `send_invoice` . `list_invoices` . `get_invoice` . `mark_paid` . `download_pdf` . `send_reminder` |
| **Clients** | `create_client` . `list_clients` . `get_client` . `update_client` . `delete_client` |
| **Expenses** | `register_expense` . `list_expenses` . `get_expense` . `update_expense` . `delete_expense` |
| **Tasks** | `create_task` . `list_tasks` . `get_my_tasks` . `get_task_overview` . `move_task` . `assign_task` . `update_task` . `complete_task` . `delete_task` |
| **Catalog** | `create_catalog_item` . `list_catalog_items` . `update_catalog_item` . `adjust_stock` |
| **Vendors** | `create_vendor` . `list_vendors` . `update_vendor` . `delete_vendor` |
| **Supplier Invoices** | `create_supplier_invoice` . `list_supplier_invoices` . `get_supplier_invoice` . `record_supplier_payment` |
| **POS / Cash Register** | `open_register` . `close_register` . `get_open_register` . `add_movement` |
| **Reports & Analytics** | `get_context` . `get_profit_loss` . `get_tax_summary` . `get_vat_balance` . `get_income_summary` . `get_cashflow` . `get_aging_report` . `get_revenue_by_client` |
| **Admin Panel** | `get_dashboard_summary` . `get_activity_log` . `export_data` |
| **Team Management** | `list_teams` . `list_team_members` . `invite_team_member` . `remove_team_member` . `change_member_role` |
| **Billing** | `get_billing_info` . `upgrade_plan` |
| **Tax Declarations** | `generate_tax_declaration` . `list_tax_declarations` . `get_tax_declaration` . `update_tax_declaration` . `submit_tax_declaration` |
| **Profile** | `get_profile` . `update_profile` |
| **Business Memory** | `get_business_context` . `save_business_context` . `remove_business_context` . `save_business_summary` |
| **E-Invoice Panama** | `validate_invoice_panama` . `submit_to_dgi` |

---

## Manual installation

If you prefer to configure manually, add this JSON to your client's config file:

| Client | Config file |
|--------|-------------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Code | `~/.claude/settings.json` |
| Cursor | `~/.cursor/mcp.json` |
| ChatGPT Desktop | `~/Library/Application Support/com.openai.chat/mcp.json` |

```json
{
  "mcpServers": {
    "facturahub": {
      "command": "npx",
      "args": ["-y", "facturahub@latest"],
      "env": {
        "FACTURAHUB_API_KEY": "your-api-key",
        "FACTURAHUB_API_URL": "https://api.facturahub.com"
      }
    }
  }
}
```

### ChatGPT Web (Developer Mode)

To use FacturaHub with ChatGPT in the browser, launch the remote HTTP server:

```bash
FACTURAHUB_API_KEY=your-api-key npx -y facturahub serve
```

This starts a server at `http://localhost:8080/mcp`. Then in ChatGPT:

1. **Settings** > **Connectors** > **Developer Mode** (enable)
2. **Add MCP Server** > URL: `http://localhost:8080/mcp`

---

## Multi-user teams

1. **Create your team** at [facturahub.com](https://facturahub.com)
2. **Invite members** with specific roles (finance, operations, member)
3. **Each member gets their own API Key** -- inherits permissions from their role

A dev only sees tasks. Finance sees invoices and expenses. The CEO sees everything.

---

## Countries supported

Works anywhere, with specialized tax compliance for:

| Country | Currency | Tax | E-Invoice |
|---------|----------|-----|-----------|
| Panama | USD | ITBMS 7% | FEP via Factura Facil / DGI |
| Netherlands | EUR | BTW 21% | Peppol / PDF |
| United States | USD | Sales Tax | PDF only |
| Spain | EUR | IVA 21% | Modelo 303 quarterly |
| Mexico | MXN | IVA 16% | CFDI / SAT |
| Colombia | COP | IVA 19% | DIAN |
| Argentina | ARS | IVA 21% | AFIP |

---

## Pricing

| Plan | Price | Includes |
|------|-------|----------|
| **Free** | $0/mo | Core features, 1 member |
| **Starter** | $19/mo | Extended limits, up to 5 members |
| **Pro** | $39/mo | Unlimited, up to 20 members, e-invoice, priority support |

**[Create free account ->](https://facturahub.com/register)**

---

## CLI

```bash
npx -y facturahub setup --api-key=XXX   # Install in all your AI clients
npx -y facturahub setup --target=cursor  # Install only in Cursor
npx -y facturahub setup --target=chatgpt # Install in ChatGPT Desktop
npx -y facturahub serve                  # HTTP server for ChatGPT Web
npx -y facturahub status                 # Verify installation
npx -y facturahub version                # Current version
npx -y facturahub update                 # Update to latest version
npx -y facturahub uninstall              # Uninstall from all clients
```

---

## Links

- **Web**: [facturahub.com](https://facturahub.com)
- **npm**: [npmjs.com/package/facturahub](https://www.npmjs.com/package/facturahub)

---

## Why FacturaHub?

- **69 MCP tools** — the most complete business MCP server available
- **AI-native** — built for Claude, ChatGPT, Cursor, and Windsurf from day one
- **Team-ready** — roles, permissions, activity logs, and shared context
- **Multi-country** — tax compliance for Panama, Spain, Mexico, Colombia, Netherlands, USA, and more
- **Free tier** — get started with no credit card required
- **Business Memory** — your AI remembers your clients, processes, and preferences across sessions

---

Built by [Santiago Garcia](https://github.com/Santy1422) in Haarlem, Netherlands.

**Keywords**: MCP server, Model Context Protocol, AI invoicing, Claude invoicing, ChatGPT invoicing, invoice automation, expense tracking, freelancer tools, small business AI, facturacion electronica, factura electronica, CFDI, SAT, DGI, DIAN, AFIP, AEAT, BTW, IVA, ITBMS, VAT, tax declarations, accounts receivable, accounts payable, POS, point of sale, inventory management, task management, team collaboration, business intelligence, admin panel, dashboard KPIs
