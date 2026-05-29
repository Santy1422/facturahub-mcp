<p align="center">
  <img src="https://facturahub.com/logo.png" alt="FacturaHub — MCP server for invoicing, WooCommerce, expenses, POS, and business management with Claude and ChatGPT" width="80" />
</p>

<h1 align="center">FacturaHub — The MCP Server for Invoicing, WooCommerce, Expenses & Business Management</h1>

<p align="center">
  <strong>69 AI tools to run your business from Claude, ChatGPT, Cursor, or Windsurf.</strong><br/>
  Invoicing. WooCommerce sync. Expense tracking. POS &amp; inventory. Tax declarations. Team management. Admin panel. One <code>npm install</code>.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/facturahub"><img src="https://img.shields.io/npm/v/facturahub.svg?style=flat-square&color=CB3837" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/facturahub"><img src="https://img.shields.io/npm/dm/facturahub.svg?style=flat-square&color=blue" alt="npm downloads" /></a>
  <a href="https://facturahub.com"><img src="https://img.shields.io/badge/Website-facturahub.com-7C3AED?style=flat-square" alt="Website" /></a>
</p>

---

## What is FacturaHub?

FacturaHub is an **MCP server** (Model Context Protocol) that turns your AI assistant into a full business management platform. Instead of switching between tabs, spreadsheets, and accounting software — just talk to Claude or ChatGPT.

**One server. 69 tools. Every business operation covered.**

Works with: **Claude Desktop** | **Claude Code** | **ChatGPT Desktop** | **ChatGPT Web** | **Cursor** | **Windsurf** | Any MCP-compatible client

---

## MCP for WooCommerce

FacturaHub is the **WooCommerce MCP server** — manage your online store directly from Claude or ChatGPT:

| You say | What happens |
|---------|-------------|
| "Sync my WooCommerce orders" | Imports WC orders as invoices automatically |
| "Import products from my WooCommerce store" | Syncs your WC catalog with inventory tracking |
| "Push this product to WooCommerce" | Sends catalog items to your WC store |
| "Create an invoice for WooCommerce order #1234" | Generates professional invoice from WC order data |
| "How much did my store sell this month?" | Revenue report from synced WooCommerce sales |

**WooCommerce integration features:**
- **Order sync** — WooCommerce orders become FacturaHub invoices (automatic or manual)
- **Product sync** — Import your WC products into the catalog with stock tracking
- **Push products** — Send catalog items back to your WooCommerce store
- **Webhook support** — Real-time `order.updated` webhook auto-creates invoices
- **OAuth connect** — One-click WooCommerce connection via OAuth 2.0

Perfect for WooCommerce store owners who want AI-powered invoicing, expense tracking, and tax management without leaving their AI assistant.

---

## MCP for Invoicing & Billing

Create, send, and manage invoices by talking to your AI:

| You say | What happens |
|---------|-------------|
| "Create an invoice for Acme Corp for 2,500 EUR" | Creates invoice + client automatically |
| "Duplicate last month's invoice for Acme" | Copies items, generates new draft |
| "Send invoice #042 to the client" | Marks as sent, emails PDF |
| "Mark invoice #042 as paid" | Updates status and payment date |
| "Download PDF of the last invoice" | Generates professional PDF with logo and tax details |
| "Show overdue invoices" | Lists unpaid invoices past due date |
| "Send payment reminders" | Lists invoices needing follow-up |

**10 invoicing tools**: `create_invoice`, `update_invoice`, `delete_invoice`, `duplicate_invoice`, `send_invoice`, `list_invoices`, `get_invoice`, `mark_paid`, `download_pdf`, `send_reminder`

---

## MCP for Expense Tracking & Accounting

Track every business expense with AI-powered categorization:

| You say | What happens |
|---------|-------------|
| "Register a 49 EUR expense for Vercel, hosting" | Creates expense with category and tax rate |
| "How's my P&L this month?" | Profit & loss: revenue vs expenses vs net profit |
| "How much VAT do I owe this quarter?" | VAT/IVA/BTW balance: collected vs paid |
| "Show my cash flow projection" | Forecasts based on pending invoices and recurring expenses |
| "Annual income summary" | Gross, net, taxable income with quarterly breakdown |
| "Export expenses as CSV" | Download link for filtered expense data |

**5 expense tools + 8 reporting tools** covering P&L, tax summary, VAT balance, income summary, cash flow, aging report, and revenue by client.

---

## MCP for Point of Sale (POS) & Inventory

Run a retail POS and manage inventory from your AI:

| You say | What happens |
|---------|-------------|
| "Open the cash register with 200 USD" | Starts a new POS session |
| "Add a sale: 2x Coffee Mug at 15 USD, cash" | Registers sale, adjusts stock |
| "Close the register, I counted 847 USD" | Closes session with reconciliation report |
| "Add 50 units of Product X to stock" | Adjusts inventory |
| "Show low stock items" | Lists items below threshold |
| "Create a new product: Widget, 29.99 USD" | Adds to catalog with stock tracking |

**4 POS tools + 4 catalog tools** with real-time inventory tracking, stock alerts, and WooCommerce sync.

---

## MCP for Task Management & Kanban

Manage your team's work with a full Kanban board:

| You say | What happens |
|---------|-------------|
| "Create a task: review Acme contract, high priority" | Creates task in backlog |
| "My pending tasks" | Lists your assigned tasks |
| "Move the deploy task to review" | Validated status transition |
| "Assign the onboarding task to Maria" | Assigns to team member |
| "How's the team board?" | Overview: tasks by status and person |
| "Complete the design review task" | Moves from review to done |

**9 task tools** with priorities (low/medium/high/urgent), assignments, due dates, tags, and linked invoices/clients.

---

## MCP for Team Management & Admin Panel

Full admin capabilities for business owners:

| You say | What happens |
|---------|-------------|
| "Give me a dashboard overview" | KPIs: revenue, expenses, profit, overdue, open tasks |
| "Show the aging report" | Accounts receivable by days overdue (1-30, 31-60, 61-90, 90+) |
| "Revenue breakdown by client this quarter" | Per-client revenue with percentages and outstanding |
| "What happened this week?" | Activity log: who did what and when |
| "Invite maria@acme.com as finance" | Sends team invitation with role |
| "Change Juan's role to operations" | Updates team member permissions |
| "Export invoices as CSV" | Filtered data export with download link |

**5 team tools + 3 admin tools** with roles (owner, admin, finance, operations, member, viewer), activity audit log, and data export.

---

## MCP for Tax Declarations & E-Invoice

Handle tax compliance across countries:

| You say | What happens |
|---------|-------------|
| "Generate my quarterly VAT declaration" | Creates tax declaration with calculated amounts |
| "Submit this invoice to DGI Panama" | Validates RUC, submits via Factura Facil, gets CUFE |
| "Show my tax declarations this year" | Lists all generated declarations |
| "How much IVA do I owe?" | VAT balance with detail per invoice and expense |

**5 tax declaration tools + 2 e-invoice tools** supporting Panama (DGI/FEP), Spain (Modelo 303), Mexico (CFDI/SAT), Colombia (DIAN), Netherlands (BTW), Argentina (AFIP), and USA.

---

## MCP for Supplier Management & Accounts Payable

Track what you owe to vendors:

| You say | What happens |
|---------|-------------|
| "Create a vendor: AWS, cloud hosting" | Adds supplier to your vendor list |
| "Register a supplier invoice from AWS for 1,200 USD" | Creates accounts payable entry |
| "Record a 500 USD payment on the AWS invoice" | Partial payment with balance recalculation |
| "Show unpaid supplier invoices" | Lists accounts payable by status |

**4 vendor tools + 4 supplier invoice tools** with partial payments, aging, and vendor analytics.

---

## MCP for Business Memory & AI Context

Your AI remembers your business across sessions:

| You say | What happens |
|---------|-------------|
| "Remember that Acme always pays net-30" | Saves to persistent business context |
| "What do you know about my business?" | Reads the living documentation |
| "Update the business summary" | Rewrites the executive overview |

**4 business memory tools** — your AI builds a living knowledge base about your clients, processes, pricing, and preferences. Every conversation starts smarter.

---

## All 69 MCP Tools

| Category | Tools |
|----------|-------|
| **Invoices** | `create_invoice` . `update_invoice` . `delete_invoice` . `duplicate_invoice` . `send_invoice` . `list_invoices` . `get_invoice` . `mark_paid` . `download_pdf` . `send_reminder` |
| **Clients** | `create_client` . `list_clients` . `get_client` . `update_client` . `delete_client` |
| **Expenses** | `register_expense` . `list_expenses` . `get_expense` . `update_expense` . `delete_expense` |
| **Tasks** | `create_task` . `list_tasks` . `get_my_tasks` . `get_task_overview` . `move_task` . `assign_task` . `update_task` . `complete_task` . `delete_task` |
| **Catalog & Inventory** | `create_catalog_item` . `list_catalog_items` . `update_catalog_item` . `adjust_stock` |
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
| **E-Invoice** | `validate_invoice_panama` . `submit_to_dgi` |

---

## Quick Start — 3 steps, 2 minutes, free

### 1. Create your account

Sign up at **[facturahub.com](https://facturahub.com/register)** -- free, no credit card.

### 2. Install in your AI

```bash
npx -y facturahub setup --api-key=YOUR_API_KEY
```

Auto-detects Claude Desktop, ChatGPT Desktop, Claude Code, and Cursor.

### 3. Talk to your AI

> *"Create an invoice for Acme Corp for 2,500 EUR for web development"*
> *"Sync my WooCommerce orders and generate invoices"*
> *"How's my P&L this quarter?"*

---

## Manual installation

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

```bash
FACTURAHUB_API_KEY=your-api-key npx -y facturahub serve
```

Starts at `http://localhost:8080/mcp`. In ChatGPT: **Settings** > **Connectors** > **Add MCP Server** > URL: `http://localhost:8080/mcp`

---

## Multi-user teams

1. **Create your team** at [facturahub.com](https://facturahub.com)
2. **Invite members** with specific roles (admin, finance, operations, member, viewer)
3. **Each member gets their own API Key** -- inherits permissions from their role

| Role | Access |
|------|--------|
| Owner / Admin | Everything: invoices, expenses, tasks, reports, team, settings |
| Finance | Invoices, clients, expenses, reports |
| Operations | Tasks, clients |
| Member | Tasks, clients, invoices, expenses |
| Viewer | Reports (read-only) |

---

## Countries & tax compliance

Works anywhere. Specialized tax automation for:

| Country | Currency | Tax | E-Invoice / Compliance |
|---------|----------|-----|------------------------|
| Panama | USD | ITBMS 7% | FEP via Factura Facil / DGI |
| Spain | EUR | IVA 21% | Modelo 303 / TicketBAI / VeriFactu |
| Mexico | MXN | IVA 16% | CFDI 4.0 / SAT |
| Colombia | COP | IVA 19% | DIAN electronic invoicing |
| Argentina | ARS | IVA 21% | AFIP / Factura electronica |
| Netherlands | EUR | BTW 21% | Peppol / UBL |
| United States | USD | Sales Tax | PDF invoicing |
| Chile | CLP | IVA 19% | SII / DTE |
| Peru | PEN | IGV 18% | SUNAT / Factura electronica |
| Uruguay | UYU | IVA 22% | DGI / CFE |

---

## Use cases: connect with your stack

FacturaHub is an MCP server — combine it with other MCPs:

| Use case | How it works |
|----------|-------------|
| **WooCommerce store management** | Sync orders, products, and inventory between WC and FacturaHub via AI |
| **Expenses from Telegram** | Your team sends "Expense 49 EUR on AWS" from their phone via Claude Channels |
| **Invoices from Gmail** | "Find this month's supplier invoices and register them as expenses" — Claude reads the PDFs |
| **Slack notifications** | Claude notifies on Slack when an invoice is overdue or a task is completed |
| **Tasks from GitHub** | A PR gets merged -> Claude creates the deploy task and assigns it |
| **Shopify / Stripe sync** | Combine with Stripe MCP to reconcile payments automatically |
| **Import from Excel** | Paste your spreadsheet — Claude parses and registers everything |
| **WhatsApp invoicing** | Create invoices and register expenses from WhatsApp messages |

---

## Pricing

| Plan | Price | Includes |
|------|-------|----------|
| **Free** | $0/mo | Core features, 1 member, 10 invoices/mo |
| **Starter** | $29/mo | 50 invoices, 1 member, WooCommerce sync |
| **Growth** | $49/mo | 200 invoices, 2 members, full reports |
| **Pro** | $79/mo | 400 invoices, 3 members, e-invoice, priority support |
| **Business** | $199/mo | 1,500 invoices, 10 members, unlimited e-invoices |

**[Create free account ->](https://facturahub.com/register)**

---

## CLI

```bash
npx -y facturahub setup --api-key=XXX   # Install in all AI clients
npx -y facturahub setup --target=cursor  # Install only in Cursor
npx -y facturahub setup --target=chatgpt # Install in ChatGPT Desktop
npx -y facturahub serve                  # HTTP server for ChatGPT Web
npx -y facturahub status                 # Verify installation
npx -y facturahub version                # Current version
npx -y facturahub update                 # Update to latest
npx -y facturahub uninstall              # Remove from all clients
```

---

## Why FacturaHub?

- **69 MCP tools** — the most complete business MCP server on npm
- **WooCommerce native** — sync orders, products, and inventory with your online store
- **AI-native** — built for Claude, ChatGPT, Cursor, and Windsurf from day one
- **Team-ready** — roles, permissions, activity logs, and shared business context
- **Multi-country** — tax compliance for 10+ countries across LATAM, Europe, and USA
- **Free forever tier** — start for free, no credit card, upgrade when you grow
- **Business Memory** — your AI learns about your business and gets smarter over time
- **E-invoice compliant** — DGI Panama, SAT Mexico, DIAN Colombia, AFIP Argentina, SII Chile, SUNAT Peru
- **Real-time POS** — cash register, inventory tracking, stock alerts, consumer invoices
- **Admin panel** — dashboard KPIs, aging reports, revenue analytics, activity audit log, CSV export

---

## Links

- **Website**: [facturahub.com](https://facturahub.com)
- **npm**: [npmjs.com/package/facturahub](https://www.npmjs.com/package/facturahub)
- **GitHub**: [github.com/Santy1422/facturahub-mcp](https://github.com/Santy1422/facturahub-mcp)

---

Built by [Santiago Garcia](https://github.com/Santy1422) in Haarlem, Netherlands.

**Tags**: MCP server, Model Context Protocol, WooCommerce MCP, WooCommerce invoicing, WooCommerce AI, AI invoicing, Claude MCP server, ChatGPT MCP server, Cursor MCP, invoice automation, expense tracker, accounting AI, bookkeeping AI, freelancer invoicing, small business invoicing, startup invoicing, facturacion electronica, factura electronica, CFDI, SAT Mexico, DGI Panama, DIAN Colombia, AFIP Argentina, SII Chile, SUNAT Peru, AEAT Spain, VeriFactu, TicketBAI, Peppol, UBL, BTW, IVA, ITBMS, IGV, VAT, sales tax, tax declarations, tax compliance, accounts receivable, accounts payable, aging report, POS system, point of sale, cash register, inventory management, stock tracking, catalog management, task management, kanban board, team collaboration, team management, admin panel, dashboard, KPIs, business intelligence, revenue analytics, profit and loss, P&L report, cash flow, business memory, AI context, multi-tenant, multi-currency, PDF invoices, CSV export, WhatsApp invoicing, e-commerce invoicing, online store management
