"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const node_http_1 = require("node:http");
const node_crypto_1 = require("node:crypto");
const zod_1 = require("zod");
// ---------------------------------------------------------------------------
// HTTP client for FacturaHub API
// ---------------------------------------------------------------------------
const API_URL = process.env.FACTURAHUB_API_URL || 'https://api.facturahub.com';
const API_KEY = process.env.FACTURAHUB_API_KEY;
async function api(path, options) {
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            ...options?.headers,
        },
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: res.statusText })));
        throw new Error(body.error || body.message || res.statusText);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/pdf')) {
        const buf = Buffer.from(await res.arrayBuffer());
        return buf;
    }
    return res.json();
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(d) {
    return new Date(d).toISOString().split('T')[0];
}
function formatMoney(amount, currency) {
    const symbols = {
        EUR: '€', USD: '$', GBP: '£', MXN: 'MX$', ARS: 'AR$',
        COP: 'COP', CLP: 'CLP', BRL: 'R$', PEN: 'S/', UYU: '$U',
    };
    return `${symbols[currency] || currency}${amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function ok(text) {
    return { content: [{ type: 'text', text }] };
}
function err(text) {
    return { content: [{ type: 'text', text }], isError: true };
}
// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
function registerTools(server, user) {
    server.tool('create_invoice', `[FacturaHub] Create an invoice. You can specify the client by name, email, or ID — if the client does not exist yet, it will be created automatically.

IMPORTANT — E-INVOICE COMPLIANCE: After creating the invoice, if the user's country requires electronic invoicing, you MUST proactively offer to run the e-invoice workflow:

• Panama (PA): "¿Quieres que envíe esta factura a la DGI vía Factura Fácil?" → validate_invoice_panama → submit_to_dgi
  Required by law for all commercial transactions in Panama. Always offer this.

• Netherlands (NL) and US: PDF-only invoices, no e-invoice submission required.

Always offer the e-invoice step for PA users — don't wait for the user to remember.`, {
        clientName: zod_1.z.string().optional().describe('Client name (e.g. "DGuard"). Will find or create the client.'),
        clientEmail: zod_1.z.string().optional().describe('Client email. Used to match existing client or set email on new one.'),
        clientId: zod_1.z.string().optional().describe('Client ID if you already know it. Takes priority over name/email.'),
        clientCompany: zod_1.z.string().optional().describe('Company name for new client (optional).'),
        clientCountry: zod_1.z.string().optional().describe('Country for new client (optional).'),
        items: zod_1.z.array(zod_1.z.object({
            description: zod_1.z.string(),
            quantity: zod_1.z.number(),
            unitPrice: zod_1.z.number(),
        })).describe('Line items for the invoice'),
        currency: zod_1.z.string().optional().describe('Currency code (EUR, USD, etc). Defaults to user currency.'),
        dueDate: zod_1.z.string().describe('Due date YYYY-MM-DD'),
        taxRate: zod_1.z.number().optional().describe('Tax % (e.g. 21 for 21%). Default 0.'),
        notes: zod_1.z.string().optional().describe('Optional notes on the invoice'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async (params) => {
        try {
            const invoice = await api('/api/invoices', {
                method: 'POST',
                body: JSON.stringify({
                    clientId: params.clientId,
                    clientName: params.clientName,
                    clientEmail: params.clientEmail,
                    clientCompany: params.clientCompany,
                    clientCountry: params.clientCountry,
                    items: params.items,
                    currency: params.currency,
                    dueDate: params.dueDate,
                    taxRate: params.taxRate,
                    notes: params.notes,
                }),
            });
            return ok([
                `Invoice created successfully.`,
                `  Number: ${invoice.invoiceNumber}`,
                `  Total: ${formatMoney(invoice.total, invoice.currency)}`,
                `  Due: ${formatDate(invoice.dueDate)}`,
                `  Status: ${invoice.status}`,
                `  ID: ${invoice._id}`,
            ].join('\n'));
        }
        catch (e) {
            return err(`Error creating invoice: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('duplicate_invoice', '[FacturaHub] Create a copy of an existing FacturaHub invoice with a new date. Useful for recurring billing.', {
        invoiceId: zod_1.z.string().describe('ID of the invoice to copy'),
        dueDate: zod_1.z.string().optional().describe('New due date YYYY-MM-DD. Defaults to 30 days from now.'),
        notes: zod_1.z.string().optional().describe('Override notes (optional)'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async ({ invoiceId, dueDate, notes }) => {
        try {
            const invoice = await api(`/api/invoices/${invoiceId}/duplicate`, {
                method: 'POST',
                body: JSON.stringify({ dueDate, notes }),
            });
            return ok([
                `Invoice duplicated.`,
                `  New number: ${invoice.invoiceNumber}`,
                `  Total: ${formatMoney(invoice.total, invoice.currency)}`,
                `  Due: ${formatDate(invoice.dueDate)}`,
                `  ID: ${invoice._id}`,
            ].join('\n'));
        }
        catch (e) {
            return err(`Error duplicating invoice: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('send_invoice', '[FacturaHub] Mark an invoice as sent', { invoiceId: zod_1.z.string().describe('Invoice ID') }, { readOnlyHint: false, destructiveHint: false, openWorldHint: true }, async ({ invoiceId }) => {
        try {
            const invoice = await api(`/api/invoices/${invoiceId}/send`, { method: 'PATCH' });
            const client = invoice.clientId;
            return ok(`Invoice ${invoice.invoiceNumber} marked as sent.\n  Client: ${client?.name} (${client?.email})\n  Total: ${formatMoney(invoice.total, invoice.currency)}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('list_invoices', '[FacturaHub] List invoices. Filter by client name, status, or date range.', {
        clientName: zod_1.z.string().optional().describe('Filter by client name (partial match)'),
        status: zod_1.z.enum(['draft', 'sent', 'paid', 'overdue']).optional().describe('Filter by status'),
        dateFrom: zod_1.z.string().optional().describe('From date YYYY-MM-DD'),
        dateTo: zod_1.z.string().optional().describe('To date YYYY-MM-DD'),
    }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ clientName, status, dateFrom, dateTo }) => {
        try {
            let clientId;
            if (clientName) {
                const clients = await api(`/api/clients?search=${encodeURIComponent(clientName)}`);
                if (clients.length > 0)
                    clientId = clients[0]._id;
            }
            const params = new URLSearchParams();
            if (clientId)
                params.set('clientId', clientId);
            if (status)
                params.set('status', status);
            if (dateFrom)
                params.set('dateFrom', dateFrom);
            if (dateTo)
                params.set('dateTo', dateTo);
            const qs = params.toString() ? `?${params.toString()}` : '';
            const invoices = await api(`/api/invoices${qs}`);
            if (invoices.length === 0)
                return ok('No invoices found.');
            const lines = invoices.map((inv) => {
                const client = inv.clientId?.name ?? 'Unknown';
                return `- ${inv.invoiceNumber} | ${client} | ${formatMoney(inv.total, inv.currency)} | ${inv.status} | Due: ${formatDate(inv.dueDate)} | ID: ${inv._id}`;
            });
            return ok(`${invoices.length} invoice(s):\n\n${lines.join('\n')}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_invoice', '[FacturaHub] Get full details of an invoice', { invoiceId: zod_1.z.string().describe('Invoice ID') }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ invoiceId }) => {
        try {
            const invoice = await api(`/api/invoices/${invoiceId}`);
            const client = invoice.clientId;
            const itemLines = invoice.items
                .map((item, i) => `  ${i + 1}. ${item.description} — ${item.quantity} x ${formatMoney(item.unitPrice, invoice.currency)} = ${formatMoney(item.amount, invoice.currency)}`)
                .join('\n');
            return ok([
                `Invoice: ${invoice.invoiceNumber}`,
                `Status: ${invoice.status}`,
                `Client: ${client?.name ?? 'Unknown'} (${client?.email ?? ''})${client?.company ? ` — ${client.company}` : ''}`,
                `Issued: ${formatDate(invoice.issueDate)}`,
                `Due: ${formatDate(invoice.dueDate)}`,
                invoice.paidAt ? `Paid: ${formatDate(invoice.paidAt)}` : null,
                ``,
                `Items:`,
                itemLines,
                ``,
                `Subtotal: ${formatMoney(invoice.subtotal, invoice.currency)}`,
                invoice.taxRate > 0 ? `Tax (${invoice.taxRate}%): ${formatMoney(invoice.tax, invoice.currency)}` : null,
                `Total: ${formatMoney(invoice.total, invoice.currency)}`,
                invoice.notes ? `\nNotes: ${invoice.notes}` : null,
                `\nID: ${invoice._id}`,
            ].filter(Boolean).join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('mark_paid', '[FacturaHub] Mark an invoice as paid', { invoiceId: zod_1.z.string().describe('Invoice ID') }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async ({ invoiceId }) => {
        try {
            const invoice = await api(`/api/invoices/${invoiceId}/pay`, { method: 'PATCH' });
            return ok(`Invoice ${invoice.invoiceNumber} marked as paid.\n  Total: ${formatMoney(invoice.total, invoice.currency)}\n  Paid: ${formatDate(invoice.paidAt)}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('create_client', '[FacturaHub] Create a new client (you can also just use create_invoice with a client name and it will auto-create)', {
        name: zod_1.z.string().describe('Client name'),
        email: zod_1.z.string().describe('Client email'),
        company: zod_1.z.string().optional().describe('Company name'),
        taxId: zod_1.z.string().optional().describe('Tax ID (NIF/CIF)'),
        address: zod_1.z.string().optional().describe('Address'),
        country: zod_1.z.string().optional().describe('Country'),
        notes: zod_1.z.string().optional().describe('Notes'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async (params) => {
        try {
            const client = await api('/api/clients', { method: 'POST', body: JSON.stringify(params) });
            return ok([
                `Client created.`,
                `  Name: ${client.name}`,
                `  Email: ${client.email}`,
                client.company ? `  Company: ${client.company}` : null,
                client.taxId ? `  Tax ID: ${client.taxId}` : null,
                client.country ? `  Country: ${client.country}` : null,
                `  ID: ${client._id}`,
            ].filter(Boolean).join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('list_clients', '[FacturaHub] List all your clients', { search: zod_1.z.string().optional().describe('Search by name or email (partial match)') }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ search }) => {
        try {
            const qs = search ? `?search=${encodeURIComponent(search)}` : '';
            const clients = await api(`/api/clients${qs}`);
            if (clients.length === 0)
                return ok('No clients found.');
            const lines = clients.map((c) => `- ${c.name}${c.company ? ` (${c.company})` : ''} | ${c.email} | ID: ${c._id}`);
            return ok(`${clients.length} client(s):\n\n${lines.join('\n')}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_client', '[FacturaHub] Get a single client by ID with full details', { clientId: zod_1.z.string().describe('Client ID') }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ clientId }) => {
        try {
            const data = await api(`/api/clients/${clientId}`);
            return ok(JSON.stringify(data, null, 2));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('update_client', '[FacturaHub] Update client details (name, email, company, taxId, country, address, phone)', {
        clientId: zod_1.z.string().describe('Client ID'),
        name: zod_1.z.string().optional(),
        email: zod_1.z.string().optional(),
        company: zod_1.z.string().optional(),
        taxId: zod_1.z.string().optional(),
        country: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async ({ clientId, ...updates }) => {
        try {
            const data = await api(`/api/clients/${clientId}`, { method: 'PUT', body: JSON.stringify(updates) });
            return ok(`Client updated: ${data.name}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('delete_client', '[FacturaHub] Delete a client', { clientId: zod_1.z.string().describe('Client ID') }, { readOnlyHint: false, destructiveHint: true, openWorldHint: false }, async ({ clientId }) => {
        try {
            await api(`/api/clients/${clientId}`, { method: 'DELETE' });
            return ok('Client deleted.');
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_context', '[FacturaHub] Financial summary: pending totals, overdue, monthly income, invoice lists', { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async () => {
        try {
            const ctx = await api('/api/invoices/context');
            const pendingLines = ctx.pendingInvoices.length > 0
                ? ctx.pendingInvoices.map((inv) => `  - ${inv.invoiceNumber} | ${inv.client} | ${formatMoney(inv.total, user.currency)} | Due: ${formatDate(inv.dueDate)}`).join('\n')
                : '  (none)';
            const overdueLines = ctx.overdueInvoices.length > 0
                ? ctx.overdueInvoices.map((inv) => `  - ${inv.invoiceNumber} | ${inv.client} | ${formatMoney(inv.total, user.currency)} | ${inv.daysOverdue} days overdue`).join('\n')
                : '  (none)';
            return ok([
                `=== Financial Summary ===`,
                ``,
                `Total pending: ${formatMoney(ctx.totalPending, user.currency)}`,
                `Total overdue: ${formatMoney(ctx.totalOverdue, user.currency)} (${ctx.overdueCount} invoices)`,
                `Monthly income: ${formatMoney(ctx.monthlyIncome, user.currency)}`,
                `Invoices sent this month: ${ctx.invoicesSentThisMonth}`,
                ``,
                `Pending:`,
                pendingLines,
                ``,
                `Overdue:`,
                overdueLines,
            ].join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('send_reminder', '[FacturaHub] List overdue invoices needing reminders', {
        clientName: zod_1.z.string().optional().describe('Filter by client name'),
        daysOverdue: zod_1.z.number().optional().describe('Min days overdue (default 0)'),
    }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ clientName, daysOverdue }) => {
        try {
            const minDays = daysOverdue ?? 0;
            const params = new URLSearchParams({ status: 'overdue' });
            if (clientName) {
                const clients = await api(`/api/clients?search=${encodeURIComponent(clientName)}`);
                if (clients.length > 0)
                    params.set('clientId', clients[0]._id);
            }
            const invoices = await api(`/api/invoices?${params.toString()}`);
            const now = new Date();
            const filtered = invoices
                .map((inv) => ({
                ...inv,
                daysOverdue: Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000),
            }))
                .filter((inv) => inv.daysOverdue >= minDays)
                .sort((a, b) => b.daysOverdue - a.daysOverdue);
            if (filtered.length === 0)
                return ok('No overdue invoices found. No reminders needed.');
            const lines = filtered.map((inv) => {
                const client = inv.clientId;
                return `- ${inv.invoiceNumber} | ${client?.name} (${client?.email}) | ${formatMoney(inv.total, inv.currency)} | ${inv.daysOverdue} days overdue`;
            });
            const total = filtered.reduce((sum, inv) => sum + inv.total, 0);
            return ok([`${filtered.length} overdue invoice(s):`, ``, ...lines, ``, `Total overdue: ${formatMoney(total, user.currency)}`].join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('download_pdf', '[FacturaHub] Generate and return a PDF for an invoice', { invoiceId: zod_1.z.string().describe('Invoice ID') }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ invoiceId }) => {
        try {
            const pdfBuffer = await api(`/api/invoices/${invoiceId}/pdf`);
            const base64 = pdfBuffer.toString('base64');
            const invoice = await api(`/api/invoices/${invoiceId}`);
            return {
                content: [
                    {
                        type: 'resource',
                        resource: {
                            uri: `invoice://${invoiceId}/pdf`,
                            mimeType: 'application/pdf',
                            blob: base64,
                        },
                    },
                    {
                        type: 'text',
                        text: `PDF generated for invoice ${invoice.invoiceNumber} (${formatMoney(invoice.total, invoice.currency)}).`,
                    },
                ],
            };
        }
        catch (e) {
            return err(`Error generating PDF: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('update_invoice', '[FacturaHub] Update a draft invoice — change items, notes, tax rate, currency, or dates.', {
        invoiceId: zod_1.z.string().describe('Invoice ID'),
        items: zod_1.z.array(zod_1.z.object({
            description: zod_1.z.string(),
            quantity: zod_1.z.number(),
            unitPrice: zod_1.z.number(),
            amount: zod_1.z.number(),
        })).optional().describe('Replace invoice line items'),
        notes: zod_1.z.string().optional().describe('Invoice notes'),
        taxRate: zod_1.z.number().optional().describe('Tax rate percentage'),
        currency: zod_1.z.string().optional().describe('Currency code'),
        issueDate: zod_1.z.string().optional().describe('Issue date (YYYY-MM-DD)'),
        dueDate: zod_1.z.string().optional().describe('Due date (YYYY-MM-DD)'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async ({ invoiceId, ...updates }) => {
        try {
            const data = await api(`/api/invoices/${invoiceId}`, { method: 'PUT', body: JSON.stringify(updates) });
            return ok(`Invoice ${data.invoiceNumber} updated. Total: ${formatMoney(data.total, data.currency)}`);
        }
        catch (e) {
            return err(`Error updating invoice: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('delete_invoice', '[FacturaHub] Delete a draft invoice.', { invoiceId: zod_1.z.string().describe('Invoice ID') }, { readOnlyHint: false, destructiveHint: true, openWorldHint: false }, async ({ invoiceId }) => {
        try {
            await api(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
            return ok('Invoice deleted.');
        }
        catch (e) {
            return err(`Error deleting invoice: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('register_expense', '[FacturaHub] Register an expense with category and VAT/BTW rate. The taxRate is critical for quarterly VAT declarations — it calculates how much VAT you can recover.', {
        description: zod_1.z.string().describe('What the expense is for'),
        amount: zod_1.z.number().describe('Total amount INCLUDING VAT/BTW (bruto bedrag)'),
        currency: zod_1.z.string().optional().describe('Currency (EUR, USD, etc). Defaults to user currency.'),
        category: zod_1.z.enum(['software', 'hosting', 'travel', 'office', 'professional_services', 'marketing', 'taxes', 'salary', 'equipment', 'other']).describe('Expense category'),
        date: zod_1.z.string().optional().describe('Expense date YYYY-MM-DD. Defaults to today.'),
        vendor: zod_1.z.string().optional().describe('Who you paid (vendor/supplier name)'),
        recurring: zod_1.z.boolean().optional().describe('Whether this is a recurring expense'),
        taxRate: zod_1.z.number().optional().describe('VAT/BTW/IVA rate in % (e.g. 21 for 21%, 9 for 9%). Use 0 for VAT-exempt. This is used to calculate recoverable VAT.'),
        notes: zod_1.z.string().optional().describe('Additional notes'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async (params) => {
        try {
            const expense = await api('/api/expenses', {
                method: 'POST',
                body: JSON.stringify({
                    ...params,
                    currency: params.currency ?? user.currency,
                    date: params.date ?? new Date().toISOString().split('T')[0],
                }),
            });
            const vatInfo = expense.taxRate > 0
                ? `  VAT ${expense.taxRate}%: ${formatMoney(expense.amount * expense.taxRate / (100 + expense.taxRate), expense.currency)} (recoverable)`
                : null;
            return ok([
                `Expense registered.`,
                `  Description: ${expense.description}`,
                `  Amount (incl. VAT): ${formatMoney(expense.amount, expense.currency)}`,
                vatInfo,
                `  Category: ${expense.category}`,
                `  Date: ${formatDate(expense.date)}`,
                expense.vendor ? `  Vendor: ${expense.vendor}` : null,
                expense.recurring ? `  Recurring: Yes` : null,
                `  ID: ${expense._id}`,
            ].filter(Boolean).join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_profit_loss', '[FacturaHub] Get profit & loss report — how much you earned vs spent in a period', {
        month: zod_1.z.number().optional().describe('Month number (1-12). Defaults to current month.'),
        year: zod_1.z.number().optional().describe('Year. Defaults to current year.'),
    }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ month, year }) => {
        try {
            const params = new URLSearchParams();
            if (month)
                params.set('month', String(month));
            if (year)
                params.set('year', String(year));
            const qs = params.toString() ? `?${params.toString()}` : '';
            const report = await api(`/api/expenses/profit-loss${qs}`);
            return ok([
                `=== Profit & Loss ===`,
                `Period: ${report.period}`,
                ``,
                `Income (paid invoices): ${formatMoney(report.income, user.currency)}`,
                `Expenses: ${formatMoney(report.expenses, user.currency)}`,
                ``,
                `Net Profit: ${formatMoney(report.profit, user.currency)}`,
                `Margin: ${report.margin}%`,
                ``,
                report.expensesByCategory.length > 0 ? `Expenses by category:` : null,
                ...report.expensesByCategory.map((c) => `  - ${c.category}: ${formatMoney(c.total, user.currency)}`),
            ].filter(Boolean).join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_tax_summary', '[FacturaHub] Tax summary for declarations — VAT/IVA collected, income totals, expense deductions', {
        quarter: zod_1.z.number().optional().describe('Quarter (1-4). If omitted, returns current quarter.'),
        year: zod_1.z.number().optional().describe('Year. Defaults to current year.'),
    }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ quarter, year }) => {
        try {
            const params = new URLSearchParams();
            if (quarter)
                params.set('quarter', String(quarter));
            if (year)
                params.set('year', String(year));
            const qs = params.toString() ? `?${params.toString()}` : '';
            const report = await api(`/api/expenses/tax-summary${qs}`);
            return ok([
                `=== Tax Summary ===`,
                `Period: ${report.period}`,
                ``,
                `Total invoiced: ${formatMoney(report.totalInvoiced, user.currency)}`,
                `VAT/IVA collected: ${formatMoney(report.vatCollected, user.currency)}`,
                `Net income (before tax): ${formatMoney(report.netIncome, user.currency)}`,
                ``,
                `Deductible expenses: ${formatMoney(report.deductibleExpenses, user.currency)}`,
                `VAT/IVA on expenses: ${formatMoney(report.vatOnExpenses, user.currency)}`,
                ``,
                `VAT/IVA to pay: ${formatMoney(report.vatToPay, user.currency)}`,
                `Taxable income: ${formatMoney(report.taxableIncome, user.currency)}`,
            ].join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_cashflow', '[FacturaHub] Cash flow projection based on pending invoices and recurring expenses', { months: zod_1.z.number().optional().describe('How many months to project (default 3)') }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ months }) => {
        try {
            const params = new URLSearchParams();
            if (months)
                params.set('months', String(months));
            const qs = params.toString() ? `?${params.toString()}` : '';
            const report = await api(`/api/expenses/cashflow${qs}`);
            const monthLines = report.months.map((m) => `  ${m.month}: +${formatMoney(m.expectedIncome, user.currency)} / -${formatMoney(m.expectedExpenses, user.currency)} = ${formatMoney(m.net, user.currency)}`);
            return ok([
                `=== Cash Flow Projection ===`,
                ``,
                `Current balance (this month): ${formatMoney(report.currentBalance, user.currency)}`,
                ``,
                `Projections:`,
                ...monthLines,
                ``,
                `Pending invoices: ${formatMoney(report.totalPendingIncome, user.currency)}`,
                `Recurring expenses/month: ${formatMoney(report.recurringExpensesMonthly, user.currency)}`,
            ].join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('list_expenses', '[FacturaHub] List all expenses with IDs, amounts, vendors, categories, and dates. Filter by category or date range.', {
        category: zod_1.z.string().optional().describe('Filter by category'),
        dateFrom: zod_1.z.string().optional().describe('Filter from date (YYYY-MM-DD)'),
        dateTo: zod_1.z.string().optional().describe('Filter to date (YYYY-MM-DD)'),
    }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ category, dateFrom, dateTo }) => {
        try {
            const params = new URLSearchParams();
            if (category)
                params.set('category', category);
            if (dateFrom)
                params.set('dateFrom', dateFrom);
            if (dateTo)
                params.set('dateTo', dateTo);
            const qs = params.toString() ? `?${params.toString()}` : '';
            const expenses = await api(`/api/expenses${qs}`);
            if (expenses.length === 0)
                return ok('No expenses found.');
            const lines = expenses.map((e) => {
                const vatInfo = e.taxRate > 0 ? ` | VAT ${e.taxRate}%` : '';
                return `- ${formatDate(e.date)} | ${e.description} | ${formatMoney(e.amount, e.currency)}${vatInfo} | ${e.category}${e.vendor ? ` | ${e.vendor}` : ''} | ID: ${e._id}`;
            });
            const total = expenses.reduce((sum, e) => sum + e.amount, 0);
            return ok([`${expenses.length} expense(s):`, '', ...lines, '', `Total: ${formatMoney(total, user.currency)}`].join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_expense', '[FacturaHub] Get a single expense by ID with full details', { expenseId: zod_1.z.string().describe('Expense ID') }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ expenseId }) => {
        try {
            const data = await api(`/api/expenses/${expenseId}`);
            return ok(JSON.stringify(data, null, 2));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('update_expense', '[FacturaHub] Update an existing expense — correct amounts, dates, categories, vendors, tax rates, or add notes', {
        expenseId: zod_1.z.string().describe('Expense ID'),
        description: zod_1.z.string().optional(),
        amount: zod_1.z.number().optional(),
        currency: zod_1.z.string().optional(),
        category: zod_1.z.enum(['software', 'hosting', 'travel', 'office', 'professional_services', 'marketing', 'taxes', 'salary', 'equipment', 'other']).optional(),
        date: zod_1.z.string().optional(),
        vendor: zod_1.z.string().optional(),
        recurring: zod_1.z.boolean().optional(),
        taxRate: zod_1.z.number().optional(),
        notes: zod_1.z.string().optional(),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async ({ expenseId, ...updates }) => {
        try {
            const data = await api(`/api/expenses/${expenseId}`, { method: 'PUT', body: JSON.stringify(updates) });
            return ok(`Expense updated: "${data.description}" — ${formatMoney(data.amount, data.currency)} [${data.category}]`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('delete_expense', '[FacturaHub] Delete an expense by ID', { expenseId: zod_1.z.string().describe('Expense ID to delete') }, { readOnlyHint: false, destructiveHint: true, openWorldHint: false }, async ({ expenseId }) => {
        try {
            await api(`/api/expenses/${expenseId}`, { method: 'DELETE' });
            return ok(`Expense ${expenseId} deleted.`);
        }
        catch (e) {
            return err(`Error deleting expense: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_vat_balance', '[FacturaHub] Get your VAT/IVA/BTW balance — how much tax you collected vs paid, and whether you owe or have credit. Essential for quarterly tax declarations.', {
        quarter: zod_1.z.number().optional().describe('Quarter (1-4). Defaults to current quarter.'),
        year: zod_1.z.number().optional().describe('Year. Defaults to current year.'),
    }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ quarter, year }) => {
        try {
            const params = new URLSearchParams();
            if (quarter)
                params.set('quarter', String(quarter));
            if (year)
                params.set('year', String(year));
            const qs = params.toString() ? `?${params.toString()}` : '';
            const report = await api(`/api/expenses/vat-balance${qs}`);
            const lines = [
                `=== VAT/IVA/BTW Balance ===`,
                `Period: ${report.period}`,
                ``,
                `VAT collected (from invoices): ${formatMoney(report.vatCollected, user.currency)}`,
                `VAT paid (on expenses): ${formatMoney(report.vatPaid, user.currency)}`,
                ``,
            ];
            if (report.status === 'to_pay') {
                lines.push(`VAT to pay: ${formatMoney(report.vatBalance, user.currency)}`);
            }
            else if (report.status === 'in_favor') {
                lines.push(`VAT credit (in your favor): ${formatMoney(Math.abs(report.vatBalance), user.currency)}`);
            }
            else {
                lines.push(`VAT balance: ${formatMoney(0, user.currency)} (neutral)`);
            }
            if (report.invoiceDetails.length > 0) {
                lines.push(``, `Invoices with VAT:`);
                for (const inv of report.invoiceDetails) {
                    lines.push(`  - ${inv.number} | VAT: ${formatMoney(inv.vat, user.currency)} | Total: ${formatMoney(inv.total, user.currency)}`);
                }
            }
            if (report.expenseDetails.length > 0) {
                lines.push(``, `Expenses with deductible VAT:`);
                for (const exp of report.expenseDetails) {
                    lines.push(`  - ${exp.description}${exp.vendor ? ` (${exp.vendor})` : ''} | VAT ${exp.vatRate}%: ${formatMoney(exp.vat, user.currency)} | Total: ${formatMoney(exp.total, user.currency)}`);
                }
            }
            return ok(lines.join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_income_summary', '[FacturaHub] Annual income/earnings summary (ganancias) — gross income, net income, expenses, taxable income, with quarterly breakdown. Use this for income tax planning.', {
        year: zod_1.z.number().optional().describe('Year. Defaults to current year.'),
    }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ year }) => {
        try {
            const params = new URLSearchParams();
            if (year)
                params.set('year', String(year));
            const qs = params.toString() ? `?${params.toString()}` : '';
            const report = await api(`/api/expenses/income-summary${qs}`);
            const lines = [
                `=== Income Summary ${report.year} ===`,
                ``,
                `Gross income (paid invoices): ${formatMoney(report.grossIncome, user.currency)}`,
                `  VAT collected: ${formatMoney(report.vatCollected, user.currency)}`,
                `  Net income (excl. VAT): ${formatMoney(report.netIncome, user.currency)}`,
                ``,
                `Total expenses: ${formatMoney(report.totalExpenses, user.currency)}`,
                `  VAT on expenses: ${formatMoney(report.vatOnExpenses, user.currency)}`,
                `  Net expenses (excl. VAT): ${formatMoney(report.netExpenses, user.currency)}`,
                ``,
                `Taxable income: ${formatMoney(report.taxableIncome, user.currency)}`,
                ``,
                `Quarterly breakdown:`,
            ];
            for (const q of report.quarters) {
                lines.push(`  ${q.quarter}: Income ${formatMoney(q.income, user.currency)} | Expenses ${formatMoney(q.expenses, user.currency)} | Profit ${formatMoney(q.profit, user.currency)}`);
            }
            return ok(lines.join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_profile', '[FacturaHub] Get your business profile — company info, address, tax details, bank info, currency, and plan', { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async () => {
        try {
            const { user: profile } = await api('/auth/me');
            return ok([
                `=== Your Profile ===`,
                ``,
                `Name: ${profile.name}`,
                `Email: ${profile.email}`,
                profile.company ? `Company: ${profile.company}` : null,
                profile.taxId ? `Tax ID: ${profile.taxId}` : null,
                profile.country ? `Country: ${profile.country}` : null,
                profile.currency ? `Currency: ${profile.currency}` : null,
                profile.taxRate != null ? `Tax rate: ${profile.taxRate}%` : null,
                ``,
                profile.address || profile.city || profile.postalCode ? `Address: ${[profile.address, profile.city, profile.postalCode].filter(Boolean).join(', ')}` : null,
                profile.phone ? `Phone: ${profile.phone}` : null,
                ``,
                profile.bankName || profile.bankIban ? `=== Bank Details ===` : null,
                profile.bankName ? `Bank: ${profile.bankName}` : null,
                profile.bankIban ? `IBAN: ${profile.bankIban}` : null,
                profile.bankSwift ? `SWIFT/BIC: ${profile.bankSwift}` : null,
                profile.bankAccountHolder ? `Account holder: ${profile.bankAccountHolder}` : null,
                ``,
                `Plan: ${profile.plan}`,
            ].filter(Boolean).join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('update_profile', '[FacturaHub] Update your business profile — company name, address, tax ID, bank details, currency, tax rate, etc.', {
        company: zod_1.z.string().optional().describe('Company or business name'),
        taxId: zod_1.z.string().optional().describe('Tax ID (NIF, CIF, RFC, CUIT, etc.)'),
        country: zod_1.z.string().optional().describe('Country code (e.g. ES, MX, US, AR)'),
        currency: zod_1.z.string().optional().describe('Currency code (EUR, USD, MXN, ARS, etc.)'),
        taxRate: zod_1.z.number().optional().describe('Default tax rate % (e.g. 21 for 21%)'),
        address: zod_1.z.string().optional().describe('Street address'),
        city: zod_1.z.string().optional().describe('City'),
        postalCode: zod_1.z.string().optional().describe('Postal / ZIP code'),
        phone: zod_1.z.string().optional().describe('Phone number'),
        bankName: zod_1.z.string().optional().describe('Bank name'),
        bankIban: zod_1.z.string().optional().describe('IBAN or account number'),
        bankSwift: zod_1.z.string().optional().describe('SWIFT / BIC code'),
        bankAccountHolder: zod_1.z.string().optional().describe('Account holder name'),
    }, { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }, async (params) => {
        try {
            const body = {};
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined)
                    body[key] = value;
            }
            if (Object.keys(body).length === 0) {
                return err('No fields provided to update. Specify at least one field.');
            }
            const { user: updated } = await api('/auth/profile', {
                method: 'PUT',
                body: JSON.stringify(body),
            });
            const changed = Object.keys(body).map(k => `  ${k}: ${body[k]}`).join('\n');
            return ok(`Profile updated successfully.\n\nFields changed:\n${changed}`);
        }
        catch (e) {
            return err(`Error updating profile: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    // =========================================================================
    // PANAMA — DGI / SFEP tools (Factura Facil integration)
    // =========================================================================
    server.tool('validate_invoice_panama', `[FacturaHub] Validate a Panamanian invoice: checks RUC and verifies arithmetic (ITBMS). Use before sending to DGI.

After validation passes, offer: "¿Quieres que envíe esta factura a la DGI?"`, {
        invoiceId: zod_1.z.string().optional().describe('FacturaHub invoice ID.'),
        seller_ruc: zod_1.z.string().optional().describe('Seller RUC (e.g. 1-184-921). Required if no invoiceId.'),
        buyer_ruc: zod_1.z.string().optional().describe('Buyer RUC. Required if no invoiceId.'),
        lines: zod_1.z.array(zod_1.z.object({
            description: zod_1.z.string(),
            qty: zod_1.z.number(),
            unit_price: zod_1.z.number(),
            tax_rate: zod_1.z.number().describe('ITBMS rate: 0, 7, 10, or 15'),
        })).optional().describe('Invoice lines. Required if no invoiceId.'),
        totals: zod_1.z.object({
            base: zod_1.z.number(),
            tax: zod_1.z.number(),
            grand_total: zod_1.z.number(),
        }).optional().describe('Totals to validate.'),
    }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async (params) => {
        try {
            if (params.invoiceId) {
                const result = await api(`/api/verifactu/validate/${params.invoiceId}`, { method: 'POST' });
                const status = result.ok ? 'VÁLIDA' : 'ERRORES ENCONTRADOS';
                const lines = [`=== Validación DGI: ${status} ===`, ``, `Emisor: ${result.detected.seller_type}`, `Receptor: ${result.detected.buyer_type}`];
                if (result.errors.length > 0) {
                    lines.push(``, `Errores:`);
                    result.errors.forEach((e) => lines.push(`  - ${e}`));
                }
                return ok(lines.join('\n'));
            }
            const result = await api('/api/verifactu/validate', {
                method: 'POST',
                body: JSON.stringify({
                    series: 'TEMP', number: '000', issue_date: new Date().toISOString().split('T')[0], currency: 'USD',
                    seller: { name: 'Emisor', tax_id: params.seller_ruc, country: 'PA' },
                    buyer: { name: 'Receptor', tax_id: params.buyer_ruc, country: 'PA' },
                    lines: params.lines,
                    totals: { ...params.totals, surcharge: 0 },
                }),
            });
            const status = result.ok ? 'VÁLIDA' : 'ERRORES ENCONTRADOS';
            const lines = [`=== Validación DGI: ${status} ===`, ``, `Emisor: ${result.detected.seller_type}`, `Receptor: ${result.detected.buyer_type}`];
            if (result.errors.length > 0) {
                lines.push(``, `Errores:`);
                result.errors.forEach((e) => lines.push(`  - ${e}`));
            }
            return ok(lines.join('\n'));
        }
        catch (e) {
            return err(`Error validating: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('submit_to_dgi', `[FacturaHub] Submit a FacturaHub invoice to DGI Panama via Factura Facil PAC. Generates FE XML, signs, and obtains CUFE/CAFE.`, {
        invoiceId: zod_1.z.string().describe('FacturaHub invoice ID to submit'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: true }, async ({ invoiceId }) => {
        try {
            const result = await api(`/api/einvoice/emit`, { method: 'POST', body: JSON.stringify({ invoiceId }) });
            return ok([
                `=== Factura electrónica — Emitida ===`,
                ``,
                `Factura: ${result.docNumber || invoiceId}`,
                `ID Fiscal: ${result.fiscalId || 'Pendiente'}`,
                `Proveedor: ${result.provider || 'N/A'}`,
                ``,
                `La factura fue procesada y emitida ante la autoridad fiscal.`,
            ].join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    // =========================================================================
    // TASK MANAGEMENT — Kanban-style task board for startup teams
    // =========================================================================
    server.tool('create_task', '[FacturaHub] Create a new task on the team board. Tasks start in "backlog" status. Can assign to a team member and link to invoices or clients.', {
        title: zod_1.z.string().describe('Task title'),
        description: zod_1.z.string().optional().describe('Detailed description'),
        priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Priority level. Defaults to medium.'),
        assignedTo: zod_1.z.string().optional().describe('User ID of the team member to assign to'),
        dueDate: zod_1.z.string().optional().describe('Due date YYYY-MM-DD'),
        tags: zod_1.z.array(zod_1.z.string()).optional().describe('Tags for categorization (e.g. ["bug", "frontend"])'),
        linkedInvoiceId: zod_1.z.string().optional().describe('Link to an invoice ID'),
        linkedClientId: zod_1.z.string().optional().describe('Link to a client ID'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async (params) => {
        try {
            const task = await api('/api/tasks', {
                method: 'POST',
                body: JSON.stringify(params),
            });
            const assignee = task.assignedTo ? ` → assigned to ${task.assignedTo.name || task.assignedTo}` : '';
            return ok(`Task created: "${task.title}" [${task.priority}] in backlog${assignee}`);
        }
        catch (e) {
            return err(`Error creating task: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('list_tasks', '[FacturaHub] List tasks with optional filters by status, assignee, priority, or tag.', {
        status: zod_1.z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']).optional().describe('Filter by status'),
        assignedTo: zod_1.z.string().optional().describe('Filter by assigned user ID'),
        priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Filter by priority'),
        tag: zod_1.z.string().optional().describe('Filter by tag'),
    }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async (params) => {
        try {
            const qs = new URLSearchParams();
            if (params.status)
                qs.set('status', params.status);
            if (params.assignedTo)
                qs.set('assignedTo', params.assignedTo);
            if (params.priority)
                qs.set('priority', params.priority);
            if (params.tag)
                qs.set('tag', params.tag);
            const tasks = await api(`/api/tasks?${qs}`);
            if (!tasks.length)
                return ok('No tasks found with these filters.');
            const lines = tasks.map((t) => {
                const assignee = t.assignedTo?.name ? ` → ${t.assignedTo.name}` : '';
                const due = t.dueDate ? ` (due ${formatDate(t.dueDate)})` : '';
                const tags = t.tags?.length ? ` [${t.tags.join(', ')}]` : '';
                return `• [${t.status}] ${t.title} (${t.priority})${assignee}${due}${tags} — ID: ${t._id}`;
            });
            return ok(`=== Tasks (${tasks.length}) ===\n\n${lines.join('\n')}`);
        }
        catch (e) {
            return err(`Error listing tasks: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_my_tasks', '[FacturaHub] Get tasks assigned to the current user.', {}, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async () => {
        try {
            const tasks = await api('/api/tasks/my');
            if (!tasks.length)
                return ok('No tasks assigned to you.');
            const lines = tasks.map((t) => {
                const due = t.dueDate ? ` (due ${formatDate(t.dueDate)})` : '';
                return `• [${t.status}] ${t.title} (${t.priority})${due} — ID: ${t._id}`;
            });
            return ok(`=== My Tasks (${tasks.length}) ===\n\n${lines.join('\n')}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_task_overview', '[FacturaHub] Get a high-level overview of the task board: counts by status and by assignee.', {}, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async () => {
        try {
            const data = await api('/api/tasks/overview');
            const statusLines = Object.entries(data.byStatus || {}).map(([status, count]) => `  ${status}: ${count}`);
            const assigneeLines = (data.byAssignee || []).map((a) => `  ${a.name || a.email}: ${a.count} tasks`);
            return ok([
                '=== Task Board Overview ===',
                '',
                'By status:',
                ...statusLines,
                '',
                'By assignee:',
                ...(assigneeLines.length ? assigneeLines : ['  No assigned tasks']),
            ].join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('move_task', `[FacturaHub] Move a task to a new status. Valid transitions:
• backlog → todo
• todo → in_progress, backlog
• in_progress → review, todo
• review → done, in_progress
• done → (no transitions)`, {
        taskId: zod_1.z.string().describe('Task ID'),
        status: zod_1.z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']).describe('Target status'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async ({ taskId, status }) => {
        try {
            const task = await api(`/api/tasks/${taskId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            });
            return ok(`Task "${task.title}" moved to ${status}.`);
        }
        catch (e) {
            return err(`Error moving task: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('assign_task', '[FacturaHub] Assign a task to a team member.', {
        taskId: zod_1.z.string().describe('Task ID'),
        assignedTo: zod_1.z.string().describe('User ID of the team member'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async ({ taskId, assignedTo }) => {
        try {
            const task = await api(`/api/tasks/${taskId}/assign`, {
                method: 'PATCH',
                body: JSON.stringify({ assignedTo }),
            });
            const name = task.assignedTo?.name || assignedTo;
            return ok(`Task "${task.title}" assigned to ${name}.`);
        }
        catch (e) {
            return err(`Error assigning task: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('update_task', '[FacturaHub] Update task fields (title, description, priority, due date, tags).', {
        taskId: zod_1.z.string().describe('Task ID'),
        title: zod_1.z.string().optional().describe('New title'),
        description: zod_1.z.string().optional().describe('New description'),
        priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('New priority'),
        dueDate: zod_1.z.string().optional().describe('New due date YYYY-MM-DD'),
        tags: zod_1.z.array(zod_1.z.string()).optional().describe('New tags (replaces existing)'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async ({ taskId, ...updates }) => {
        try {
            const body = {};
            for (const [key, value] of Object.entries(updates)) {
                if (value !== undefined)
                    body[key] = value;
            }
            if (Object.keys(body).length === 0) {
                return err('No fields provided to update.');
            }
            const task = await api(`/api/tasks/${taskId}`, {
                method: 'PUT',
                body: JSON.stringify(body),
            });
            return ok(`Task "${task.title}" updated. Fields changed: ${Object.keys(body).join(', ')}`);
        }
        catch (e) {
            return err(`Error updating task: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('complete_task', '[FacturaHub] Mark a task as done. The task must be in "review" status.', {
        taskId: zod_1.z.string().describe('Task ID'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async ({ taskId }) => {
        try {
            const task = await api(`/api/tasks/${taskId}/complete`, { method: 'PATCH' });
            return ok(`Task "${task.title}" completed!`);
        }
        catch (e) {
            return err(`Error completing task: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('delete_task', '[FacturaHub] Delete a task. Only tasks in "backlog" or "todo" status can be deleted.', {
        taskId: zod_1.z.string().describe('Task ID'),
    }, { readOnlyHint: false, destructiveHint: true, openWorldHint: false }, async ({ taskId }) => {
        try {
            await api(`/api/tasks/${taskId}`, { method: 'DELETE' });
            return ok('Task deleted.');
        }
        catch (e) {
            return err(`Error deleting task: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    // --- Business Context tools (living documentation) ---
    server.tool('get_business_context', '[FacturaHub] Get the living documentation of this business — what the company does, clients, financial patterns, operations, and team. Always read this at the start of a conversation to understand the full context.', {}, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async () => {
        try {
            const data = await api('/api/context/markdown');
            if (!data.markdown) {
                return ok('No business context documented yet. As you learn about this business, use save_business_context to build up the documentation.');
            }
            return ok(`# Business Context (${data.entryCount} entries)\n\n${data.markdown}`);
        }
        catch (e) {
            return err(`Error reading business context: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('save_business_context', '[FacturaHub] Save or update a piece of business knowledge. Use this PROACTIVELY whenever you learn something new about the business — a new client pattern, financial insight, operational process, product/service detail, or team structure. This builds the living documentation that makes you smarter over time.', {
        key: zod_1.z.string().describe('Unique identifier for this entry (e.g., "client:acme", "pattern:monthly-saas", "process:invoice-approval"). Use lowercase with colons.'),
        title: zod_1.z.string().describe('Human-readable title (e.g., "Acme Corp - Main Client", "Monthly SaaS Revenue Pattern")'),
        content: zod_1.z.string().describe('Detailed description in natural language. Include numbers, dates, and specifics. Write as documentation that your future self will read.'),
        category: zod_1.z.enum(['company', 'clients', 'financial', 'operations', 'products', 'team', 'notes']).describe('Category: company (profile, mission), clients (relationships, patterns), financial (revenue, expenses, patterns), operations (processes, workflows), products (what they sell/do), team (structure, roles), notes (misc)'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async ({ key, title, content, category }) => {
        try {
            const data = await api('/api/context/entry', {
                method: 'PUT',
                body: JSON.stringify({ key, title, content, category }),
            });
            return ok(`Business context saved: "${title}" [${category}]. ${data.message}.`);
        }
        catch (e) {
            return err(`Error saving business context: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('remove_business_context', '[FacturaHub] Remove an outdated or incorrect business context entry.', {
        key: zod_1.z.string().describe('The key of the entry to remove'),
    }, { readOnlyHint: false, destructiveHint: true, openWorldHint: false }, async ({ key }) => {
        try {
            await api(`/api/context/entry/${encodeURIComponent(key)}`, { method: 'DELETE' });
            return ok(`Entry "${key}" removed from business context.`);
        }
        catch (e) {
            return err(`Error removing entry: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('save_business_summary', '[FacturaHub] Update the executive summary of the business. This is the first thing read in every conversation — a 2-3 paragraph overview of who they are, what they do, and their current situation.', {
        summary: zod_1.z.string().describe('Executive summary of the business in 2-3 paragraphs. Include: what the company does, main revenue sources, team size, current priorities.'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async ({ summary }) => {
        try {
            await api('/api/context/summary', { method: 'PUT', body: JSON.stringify({ summary }) });
            return ok('Business summary updated. This will be included in every future conversation.');
        }
        catch (e) {
            return err(`Error updating summary: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    // ── Tax Declarations ──
    server.tool('generate_tax_declaration', '[FacturaHub] Generate a tax declaration for a period. Supported countries: NL (BTW quarterly), ES (Modelo 303 quarterly), PA (ITBMS bimonthly), MX (IVA monthly), CO (IVA bimonthly).', {
        country: zod_1.z.string().describe('Country code: NL, ES, PA, MX, or CO'),
        year: zod_1.z.number().describe('Tax year'),
        period: zod_1.z.number().describe('Period index (1-based): quarter for NL/ES, bimonth for PA/CO, month for MX'),
    }, async ({ country, year, period }) => {
        try {
            const result = await api('/api/tax-declarations/generate', {
                method: 'POST',
                body: JSON.stringify({ country, year, period }),
            });
            const d = result.declaration;
            const f = d.fields instanceof Map ? Object.fromEntries(d.fields) : (d.fields || {});
            const lines = [
                `**${d.formName}** — ${d.periodLabel}`,
                `Status: ${d.status}`,
                ``,
                `**Totals (${d.totals.currency})**`,
                `  Tax collected: ${d.totals.taxCollected}`,
                `  Tax deductible: ${d.totals.taxDeductible}`,
                `  Net tax: ${d.totals.netTax}`,
                `  Taxable income: ${d.totals.taxableIncome}`,
                `  Total expenses: ${d.totals.totalExpenses}`,
                ``,
                `**Fields**`,
                ...Object.entries(f).map(([k, v]) => `  ${k}: ${v}`),
            ];
            if (d.warnings?.length) {
                lines.push('', '**Warnings**', ...d.warnings.map((w) => `  - ${w}`));
            }
            lines.push('', `Based on ${result.invoiceCount} invoices and ${result.expenseCount} expenses.`);
            lines.push(`Declaration ID: ${d._id}`);
            return ok(lines.join('\n'));
        }
        catch (e) {
            return err(`Error generating declaration: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('list_tax_declarations', '[FacturaHub] List tax declarations with optional filters.', {
        country: zod_1.z.string().optional().describe('Filter by country code'),
        year: zod_1.z.number().optional().describe('Filter by year'),
    }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ country, year }) => {
        try {
            const params = new URLSearchParams();
            if (country)
                params.set('country', country);
            if (year)
                params.set('year', String(year));
            const result = await api(`/api/tax-declarations?${params}`);
            if (!result.declarations?.length) {
                return ok('No tax declarations found.');
            }
            const lines = result.declarations.map((d) => `- [${d.status}] ${d.formName} — ${d.periodLabel} | Net: ${d.totals.netTax} ${d.totals.currency} (ID: ${d._id})`);
            return ok(lines.join('\n'));
        }
        catch (e) {
            return err(`Error listing declarations: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_tax_declaration', '[FacturaHub] Get full details of a specific tax declaration.', {
        id: zod_1.z.string().describe('Tax declaration ID'),
    }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ id }) => {
        try {
            const result = await api(`/api/tax-declarations/${id}`);
            return ok(JSON.stringify(result.declaration, null, 2));
        }
        catch (e) {
            return err(`Error fetching declaration: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('update_tax_declaration', '[FacturaHub] Update manual overrides or notes on a draft tax declaration.', {
        id: zod_1.z.string().describe('Tax declaration ID'),
        manualOverrides: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional().describe('Manual field overrides'),
        notes: zod_1.z.string().optional().describe('Notes about this declaration'),
    }, async ({ id, manualOverrides, notes }) => {
        try {
            const body = {};
            if (manualOverrides)
                body.manualOverrides = manualOverrides;
            if (notes)
                body.notes = notes;
            await api(`/api/tax-declarations/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
            return ok('Tax declaration updated.');
        }
        catch (e) {
            return err(`Error updating declaration: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('submit_tax_declaration', '[FacturaHub] Mark a tax declaration as submitted.', {
        id: zod_1.z.string().describe('Tax declaration ID'),
    }, async ({ id }) => {
        try {
            const result = await api(`/api/tax-declarations/${id}/submit`, { method: 'PATCH' });
            return ok(`Declaration "${result.declaration.formName} — ${result.declaration.periodLabel}" marked as submitted.`);
        }
        catch (e) {
            return err(`Error submitting declaration: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    // =========================================================================
    // CATALOG MANAGEMENT — Products & services catalog with inventory
    // =========================================================================
    server.tool('list_catalog_items', '[FacturaHub] List catalog items (products and services). Filter by type, category, or search by name.', {
        type: zod_1.z.enum(['product', 'service']).optional().describe('Filter by item type'),
        category: zod_1.z.string().optional().describe('Filter by category'),
        search: zod_1.z.string().optional().describe('Search by name (partial match)'),
        includeInactive: zod_1.z.boolean().optional().describe('Include inactive/deactivated items (default false)'),
    }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ type, category, search, includeInactive }) => {
        try {
            const params = new URLSearchParams();
            if (type)
                params.set('type', type);
            if (category)
                params.set('category', category);
            if (search)
                params.set('search', search);
            if (includeInactive)
                params.set('active', 'all');
            const qs = params.toString() ? `?${params.toString()}` : '';
            const items = await api(`/api/catalog${qs}`);
            if (items.length === 0)
                return ok('No catalog items found.');
            const lines = items.map((item) => {
                const stock = item.trackInventory ? ` | Stock: ${item.stock}` : '';
                const cost = item.costPrice ? ` | Cost: ${formatMoney(item.costPrice, item.currency)}` : '';
                return `- ${item.name} (${item.type}) | ${formatMoney(item.unitPrice, item.currency)}${cost}${stock}${item.category ? ` | ${item.category}` : ''}${item.sku ? ` | SKU: ${item.sku}` : ''} | ID: ${item._id}`;
            });
            return ok(`${items.length} catalog item(s):\n\n${lines.join('\n')}`);
        }
        catch (e) {
            return err(`Error listing catalog: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('create_catalog_item', '[FacturaHub] Create a new product or service in the catalog. Products can track inventory with stock levels and low-stock alerts.', {
        name: zod_1.z.string().describe('Item name'),
        type: zod_1.z.enum(['product', 'service']).describe('Item type: product (physical good) or service'),
        unitPrice: zod_1.z.number().describe('Sale price per unit'),
        description: zod_1.z.string().optional().describe('Item description'),
        sku: zod_1.z.string().optional().describe('SKU code (must be unique if provided)'),
        barcode: zod_1.z.string().optional().describe('Barcode (EAN, UPC, etc.)'),
        costPrice: zod_1.z.number().optional().describe('Cost price (what you pay the supplier)'),
        currency: zod_1.z.string().optional().describe('Currency code. Defaults to user currency.'),
        taxRate: zod_1.z.number().optional().describe('Tax rate % for this item'),
        category: zod_1.z.string().optional().describe('Category for grouping (e.g. "electronics", "consulting")'),
        trackInventory: zod_1.z.boolean().optional().describe('Enable stock tracking (default false)'),
        stock: zod_1.z.number().optional().describe('Initial stock quantity (default 0)'),
        lowStockAlert: zod_1.z.number().optional().describe('Stock threshold to trigger low-stock alert'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async (params) => {
        try {
            const item = await api('/api/catalog', {
                method: 'POST',
                body: JSON.stringify(params),
            });
            const stock = item.trackInventory ? `\n  Stock: ${item.stock}${item.lowStockAlert != null ? ` (alert at ${item.lowStockAlert})` : ''}` : '';
            return ok([
                `Catalog item created.`,
                `  Name: ${item.name}`,
                `  Type: ${item.type}`,
                `  Price: ${formatMoney(item.unitPrice, item.currency)}`,
                item.costPrice ? `  Cost: ${formatMoney(item.costPrice, item.currency)}` : null,
                item.sku ? `  SKU: ${item.sku}` : null,
                item.category ? `  Category: ${item.category}` : null,
                stock || null,
                `  ID: ${item._id}`,
            ].filter(Boolean).join('\n'));
        }
        catch (e) {
            return err(`Error creating catalog item: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('update_catalog_item', '[FacturaHub] Update an existing catalog item — change name, price, description, category, stock settings, etc.', {
        itemId: zod_1.z.string().describe('Catalog item ID'),
        name: zod_1.z.string().optional().describe('New name'),
        type: zod_1.z.enum(['product', 'service']).optional().describe('New type'),
        unitPrice: zod_1.z.number().optional().describe('New sale price'),
        description: zod_1.z.string().optional().describe('New description'),
        sku: zod_1.z.string().optional().describe('New SKU'),
        barcode: zod_1.z.string().optional().describe('New barcode'),
        costPrice: zod_1.z.number().optional().describe('New cost price'),
        currency: zod_1.z.string().optional().describe('New currency'),
        taxRate: zod_1.z.number().optional().describe('New tax rate %'),
        category: zod_1.z.string().optional().describe('New category'),
        trackInventory: zod_1.z.boolean().optional().describe('Enable/disable stock tracking'),
        stock: zod_1.z.number().optional().describe('Set stock quantity directly'),
        lowStockAlert: zod_1.z.number().optional().describe('New low-stock alert threshold'),
        active: zod_1.z.boolean().optional().describe('Set active/inactive status'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async ({ itemId, ...updates }) => {
        try {
            const body = {};
            for (const [key, value] of Object.entries(updates)) {
                if (value !== undefined)
                    body[key] = value;
            }
            if (Object.keys(body).length === 0) {
                return err('No fields provided to update.');
            }
            const item = await api(`/api/catalog/${itemId}`, {
                method: 'PUT',
                body: JSON.stringify(body),
            });
            return ok(`Catalog item "${item.name}" updated. Fields changed: ${Object.keys(body).join(', ')}`);
        }
        catch (e) {
            return err(`Error updating catalog item: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('adjust_stock', '[FacturaHub] Adjust inventory stock for a catalog item. Use positive numbers to add stock (restock) and negative numbers to remove stock (damage, loss, correction). For sales, use add_movement instead.', {
        itemId: zod_1.z.string().describe('Catalog item ID'),
        adjustment: zod_1.z.number().describe('Stock adjustment: positive to add, negative to remove (e.g. 10 to add 10 units, -3 to remove 3)'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async ({ itemId, adjustment }) => {
        try {
            const item = await api(`/api/catalog/${itemId}/stock`, {
                method: 'PATCH',
                body: JSON.stringify({ adjustment }),
            });
            const direction = adjustment > 0 ? 'added' : 'removed';
            return ok(`Stock ${direction}: ${Math.abs(adjustment)} unit(s) for "${item.name}". New stock: ${item.stock}`);
        }
        catch (e) {
            return err(`Error adjusting stock: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    // =========================================================================
    // VENDOR MANAGEMENT — Suppliers and vendors
    // =========================================================================
    server.tool('list_vendors', '[FacturaHub] List all vendors/suppliers. Search by name, email, or category.', {
        search: zod_1.z.string().optional().describe('Search by name, email, or category (partial match)'),
    }, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async ({ search }) => {
        try {
            const qs = search ? `?search=${encodeURIComponent(search)}` : '';
            const vendors = await api(`/api/vendors${qs}`);
            if (vendors.length === 0)
                return ok('No vendors found.');
            const lines = vendors.map((v) => {
                const details = [v.email, v.phone, v.country].filter(Boolean).join(' | ');
                const stats = v.expenseCount ? ` | ${v.expenseCount} expenses, ${formatMoney(v.totalSpent || 0, user.currency)}` : '';
                return `- ${v.name}${v.category ? ` (${v.category})` : ''}${details ? ` | ${details}` : ''}${stats} | ID: ${v._id}`;
            });
            return ok(`${vendors.length} vendor(s):\n\n${lines.join('\n')}`);
        }
        catch (e) {
            return err(`Error listing vendors: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('create_vendor', '[FacturaHub] Create a new vendor/supplier. Vendors are linked to expenses for tracking who you pay.', {
        name: zod_1.z.string().describe('Vendor/supplier name'),
        email: zod_1.z.string().optional().describe('Vendor email'),
        phone: zod_1.z.string().optional().describe('Phone number'),
        taxId: zod_1.z.string().optional().describe('Tax ID (NIF, RUC, RFC, etc.)'),
        address: zod_1.z.string().optional().describe('Address'),
        country: zod_1.z.string().optional().describe('Country code'),
        category: zod_1.z.string().optional().describe('Category (e.g. "office supplies", "cloud services")'),
        notes: zod_1.z.string().optional().describe('Notes about this vendor'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async (params) => {
        try {
            const vendor = await api('/api/vendors', {
                method: 'POST',
                body: JSON.stringify(params),
            });
            return ok([
                `Vendor created.`,
                `  Name: ${vendor.name}`,
                vendor.email ? `  Email: ${vendor.email}` : null,
                vendor.taxId ? `  Tax ID: ${vendor.taxId}` : null,
                vendor.country ? `  Country: ${vendor.country}` : null,
                vendor.category ? `  Category: ${vendor.category}` : null,
                `  ID: ${vendor._id}`,
            ].filter(Boolean).join('\n'));
        }
        catch (e) {
            return err(`Error creating vendor: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    // =========================================================================
    // POS — Point of Sale / Cash Register operations
    // =========================================================================
    server.tool('get_open_register', '[FacturaHub] Get the currently open cash register. Returns null if no register is open. Use this to check POS status before adding sales.', {}, { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, async () => {
        try {
            const register = await api('/api/cash-register/current');
            if (!register) {
                return ok('No open register. Open one first with the dashboard or ask the user to open a register.');
            }
            const movCount = register.movements?.length || 0;
            return ok([
                `=== Open Cash Register ===`,
                ``,
                `Opening amount: ${formatMoney(register.openingAmount, register.currency)}`,
                `Sales: ${register.salesCount} (${formatMoney(register.salesTotal, register.currency)})`,
                `  Cash: ${formatMoney(register.cashPayments, register.currency)}`,
                `  Card: ${formatMoney(register.cardPayments, register.currency)}`,
                `  Transfer: ${formatMoney(register.transferPayments, register.currency)}`,
                `Movements: ${movCount}`,
                `Opened: ${formatDate(register.openedAt)}`,
                register.notes ? `Notes: ${register.notes}` : null,
                ``,
                `Register ID: ${register._id}`,
            ].filter(Boolean).join('\n'));
        }
        catch (e) {
            return err(`Error getting register: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('add_movement', '[FacturaHub] Add a sale (or other movement) to the open cash register. For sales, you can include line items with product details. Consumer-final sales are grouped into a single invoice when the register is closed.', {
        registerId: zod_1.z.string().describe('Cash register ID (get from get_open_register)'),
        type: zod_1.z.enum(['sale', 'refund', 'cash_in', 'cash_out']).describe('Movement type: sale (customer purchase), refund, cash_in (manual cash deposit), cash_out (manual cash withdrawal)'),
        amount: zod_1.z.number().describe('Total amount of the movement (must be positive)'),
        description: zod_1.z.string().describe('Description of the movement (e.g. "2x Coffee, 1x Sandwich")'),
        consumerFinal: zod_1.z.boolean().optional().describe('Mark as consumer-final sale (anonymous customer). These are grouped into one invoice on register close.'),
        lineItems: zod_1.z.array(zod_1.z.object({
            description: zod_1.z.string().describe('Line item description'),
            quantity: zod_1.z.number().describe('Quantity sold'),
            unitPrice: zod_1.z.number().describe('Unit price'),
            taxRate: zod_1.z.number().optional().describe('Tax rate % for this item'),
            catalogItemId: zod_1.z.string().optional().describe('Catalog item ID for stock tracking'),
        })).optional().describe('Detailed line items for the sale. If provided, stock will be adjusted for catalog items.'),
    }, { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, async ({ registerId, type, amount, description, consumerFinal, lineItems }) => {
        try {
            const register = await api(`/api/cash-register/${registerId}/movement`, {
                method: 'POST',
                body: JSON.stringify({ type, amount, description, consumerFinal, lineItems }),
            });
            const typeLabels = {
                sale: 'Sale',
                refund: 'Refund',
                cash_in: 'Cash in',
                cash_out: 'Cash out',
            };
            return ok([
                `${typeLabels[type]} recorded: ${formatMoney(amount, register.currency)}`,
                `  Description: ${description}`,
                consumerFinal ? `  Consumer final: Yes` : null,
                lineItems?.length ? `  Line items: ${lineItems.length}` : null,
                ``,
                `Register totals:`,
                `  Sales: ${register.salesCount} (${formatMoney(register.salesTotal, register.currency)})`,
                `  Movements: ${register.movements?.length || 0}`,
            ].filter(Boolean).join('\n'));
        }
        catch (e) {
            return err(`Error adding movement: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    // ─── Supplier Invoices (Accounts Payable) ───
    server.tool('list_supplier_invoices', '[FacturaHub] List supplier/vendor invoices (accounts payable), optionally filtered by status.', {
        status: zod_1.z.enum(['pending', 'partial', 'paid', 'overdue', 'cancelled']).optional().describe('Filter by payment status'),
        limit: zod_1.z.number().optional().describe('Max results (default 20)'),
    }, { readOnlyHint: true }, async ({ status, limit }) => {
        try {
            const params = new URLSearchParams();
            if (status)
                params.set('status', status);
            if (limit)
                params.set('limit', String(limit));
            const data = await api(`/api/supplier-invoices?${params}`);
            if (!data.length)
                return ok('No supplier invoices found.');
            const lines = data.map((inv) => `- ${inv.invoiceNumber} | ${inv.vendorId?.name || '?'} | ${formatMoney(inv.total, inv.currency)} | status: ${inv.status} | balance: ${formatMoney(inv.balance, inv.currency)}`);
            return ok(`${data.length} supplier invoice(s):\n${lines.join('\n')}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('create_supplier_invoice', '[FacturaHub] Register a supplier/vendor invoice (account payable). Auto-creates vendor if not found.', {
        vendorName: zod_1.z.string().describe('Vendor name (auto-finds or creates)'),
        invoiceNumber: zod_1.z.string().describe('Supplier invoice number'),
        total: zod_1.z.number().describe('Total amount'),
        currency: zod_1.z.string().optional().describe('Currency (default: user currency)'),
        dueDate: zod_1.z.string().optional().describe('Due date YYYY-MM-DD (default: 30 days)'),
        taxRate: zod_1.z.number().optional().describe('Tax rate % (default 0)'),
        notes: zod_1.z.string().optional(),
    }, { readOnlyHint: false }, async ({ vendorName, invoiceNumber, total, currency, dueDate, taxRate, notes }) => {
        try {
            const result = await api('/api/supplier-invoices', {
                method: 'POST',
                body: JSON.stringify({ vendorName, invoiceNumber, total, currency, dueDate, taxRate, notes }),
            });
            return ok(`Supplier invoice created:\n  Vendor: ${vendorName}\n  Invoice: ${invoiceNumber}\n  Total: ${formatMoney(total, result.currency || currency || user.currency)}\n  Due: ${dueDate || '30 days'}\n  Status: pending`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_supplier_invoice', '[FacturaHub] Get full details of a supplier invoice including payment history.', {
        invoiceId: zod_1.z.string().describe('Supplier invoice ID'),
    }, { readOnlyHint: true }, async ({ invoiceId }) => {
        try {
            const inv = await api(`/api/supplier-invoices/${invoiceId}`);
            const payments = (inv.payments || []).map((p) => `  - ${formatDate(p.paymentDate)}: ${formatMoney(p.amount, inv.currency)} via ${p.paymentMethod}`);
            return ok([
                `Supplier Invoice: ${inv.invoiceNumber}`,
                `Vendor: ${inv.vendorId?.name || '?'}`,
                `Date: ${formatDate(inv.invoiceDate)}`,
                `Due: ${formatDate(inv.dueDate)}`,
                `Total: ${formatMoney(inv.total, inv.currency)}`,
                `Paid: ${formatMoney(inv.totalPaid, inv.currency)}`,
                `Balance: ${formatMoney(inv.balance, inv.currency)}`,
                `Status: ${inv.status}`,
                payments.length ? `\nPayments:\n${payments.join('\n')}` : 'No payments yet.',
                inv.notes ? `Notes: ${inv.notes}` : null,
            ].filter(Boolean).join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('record_supplier_payment', '[FacturaHub] Record a payment against a supplier invoice.', {
        invoiceId: zod_1.z.string().describe('Supplier invoice ID'),
        amount: zod_1.z.number().describe('Payment amount'),
        paymentMethod: zod_1.z.enum(['transfer', 'cash', 'check', 'card', 'other']).optional().describe('Payment method (default: transfer)'),
        reference: zod_1.z.string().optional().describe('Payment reference/transaction ID'),
        notes: zod_1.z.string().optional(),
    }, { readOnlyHint: false }, async ({ invoiceId, amount, paymentMethod, reference, notes }) => {
        try {
            const result = await api(`/api/supplier-invoices/${invoiceId}/payments`, {
                method: 'POST',
                body: JSON.stringify({ amount, paymentMethod: paymentMethod || 'transfer', reference, notes }),
            });
            return ok(`Payment recorded: ${formatMoney(amount, result.currency)}\n  Invoice: ${result.invoiceNumber}\n  Total paid: ${formatMoney(result.totalPaid, result.currency)}\n  Balance: ${formatMoney(result.balance, result.currency)}\n  Status: ${result.status}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    // ─── Teams ───
    server.tool('list_teams', '[FacturaHub] List teams you belong to.', {}, { readOnlyHint: true }, async () => {
        try {
            const teams = await api('/api/teams/my');
            if (!teams.length)
                return ok('You are not a member of any team.');
            const lines = teams.map((t) => `- ${t.name} (${t.role}) — ${t.memberCount || '?'} members`);
            return ok(`Your teams:\n${lines.join('\n')}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('list_team_members', '[FacturaHub] List members of the current active team.', {}, { readOnlyHint: true }, async () => {
        try {
            const members = await api('/api/teams/members');
            if (!members.length)
                return ok('No team members found.');
            const lines = members.map((m) => {
                const user = m.userId || {};
                return `- ${user.name || m.invitedEmail || '?'} (${user.email || m.invitedEmail || '?'}) — ${m.role}`;
            });
            return ok(`${members.length} member(s):\n${lines.join('\n')}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('invite_team_member', '[FacturaHub] Invite a new member to the current team by email.', {
        email: zod_1.z.string().describe('Email of the person to invite'),
        role: zod_1.z.enum(['admin', 'finance', 'operations', 'member', 'viewer']).describe('Role to assign'),
    }, { readOnlyHint: false }, async ({ email, role }) => {
        try {
            await api('/api/teams/invite', {
                method: 'POST',
                body: JSON.stringify({ email, role }),
            });
            return ok(`Invited ${email} as "${role}".`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    // ─── Admin Panel ───
    server.tool('remove_team_member', '[FacturaHub] Remove a member from the current team. Requires admin or owner role.', {
        memberId: zod_1.z.string().describe('Team member ID to remove'),
    }, { readOnlyHint: false, destructiveHint: true }, async ({ memberId }) => {
        try {
            await api(`/api/teams/members/${memberId}`, { method: 'DELETE' });
            return ok('Team member removed.');
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('change_member_role', '[FacturaHub] Change the role of a team member. Requires admin or owner role.', {
        memberId: zod_1.z.string().describe('Team member ID'),
        role: zod_1.z.enum(['admin', 'finance', 'operations', 'member', 'viewer']).describe('New role to assign'),
    }, { readOnlyHint: false }, async ({ memberId, role }) => {
        try {
            const member = await api(`/api/teams/members/${memberId}/role`, {
                method: 'PATCH',
                body: JSON.stringify({ role }),
            });
            const name = member.userId?.name || member.invitedEmail || memberId;
            return ok(`Role updated: ${name} is now "${role}".`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_dashboard_summary', '[FacturaHub] Get a comprehensive dashboard summary with KPIs: total revenue, outstanding amount, expenses, net profit, overdue invoices, and recent activity counts. Perfect for a quick business overview.', {
        period: zod_1.z.enum(['month', 'quarter', 'year']).optional().describe('Time period for the summary. Defaults to current month.'),
    }, { readOnlyHint: true }, async ({ period }) => {
        try {
            const qs = period ? `?period=${period}` : '';
            const summary = await api(`/api/dashboard/summary${qs}`);
            return ok([
                `Dashboard Summary${period ? ` (${period})` : ''}:`,
                ``,
                `  Revenue:      ${formatMoney(summary.revenue || 0, summary.currency || 'EUR')}`,
                `  Expenses:     ${formatMoney(summary.expenses || 0, summary.currency || 'EUR')}`,
                `  Net Profit:   ${formatMoney((summary.revenue || 0) - (summary.expenses || 0), summary.currency || 'EUR')}`,
                ``,
                `  Invoices:     ${summary.invoiceCount || 0} total`,
                `  Outstanding:  ${formatMoney(summary.outstanding || 0, summary.currency || 'EUR')} (${summary.unpaidCount || 0} unpaid)`,
                `  Overdue:      ${summary.overdueCount || 0} invoice(s) — ${formatMoney(summary.overdueAmount || 0, summary.currency || 'EUR')}`,
                ``,
                `  Clients:      ${summary.clientCount || 0}`,
                `  Tasks:        ${summary.openTasks || 0} open / ${summary.completedTasks || 0} completed`,
                summary.topClient ? `  Top Client:   ${summary.topClient.name} (${formatMoney(summary.topClient.revenue || 0, summary.currency || 'EUR')})` : null,
            ].filter(Boolean).join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_activity_log', '[FacturaHub] Get the recent activity/audit log. Shows who did what and when — useful for team oversight and accountability.', {
        limit: zod_1.z.number().optional().describe('Number of entries to return (default 20, max 100)'),
        action: zod_1.z.string().optional().describe('Filter by action type (e.g. "invoice.created", "expense.registered", "task.completed")'),
    }, { readOnlyHint: true }, async ({ limit, action }) => {
        try {
            const params = new URLSearchParams();
            if (limit)
                params.set('limit', String(limit));
            if (action)
                params.set('action', action);
            const qs = params.toString() ? `?${params.toString()}` : '';
            const logs = await api(`/api/activity${qs}`);
            if (!logs.length)
                return ok('No activity found.');
            const lines = logs.map((entry) => {
                const date = formatDate(entry.createdAt || entry.timestamp);
                const actor = entry.userName || entry.userEmail || 'System';
                return `- [${date}] ${actor}: ${entry.action} — ${entry.description || entry.details || ''}`;
            });
            return ok(`Recent activity (${logs.length} entries):\n\n${lines.join('\n')}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_aging_report', '[FacturaHub] Get accounts receivable aging report — breaks down unpaid invoices by how overdue they are (current, 1-30 days, 31-60, 61-90, 90+). Essential for cash flow management.', {}, { readOnlyHint: true }, async () => {
        try {
            const aging = await api('/api/reports/aging');
            const c = aging.currency || 'EUR';
            const lines = [
                `Accounts Receivable Aging Report:`,
                ``,
                `  Current (not due):  ${formatMoney(aging.current || 0, c)}  (${aging.currentCount || 0} invoices)`,
                `  1–30 days overdue:  ${formatMoney(aging.days1to30 || 0, c)}  (${aging.days1to30Count || 0})`,
                `  31–60 days:         ${formatMoney(aging.days31to60 || 0, c)}  (${aging.days31to60Count || 0})`,
                `  61–90 days:         ${formatMoney(aging.days61to90 || 0, c)}  (${aging.days61to90Count || 0})`,
                `  90+ days:           ${formatMoney(aging.days90plus || 0, c)}  (${aging.days90plusCount || 0})`,
                ``,
                `  Total Outstanding:  ${formatMoney(aging.total || 0, c)}`,
            ];
            return ok(lines.join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_revenue_by_client', '[FacturaHub] Get revenue breakdown by client — shows how much each client has paid and owes. Useful for identifying top clients and concentration risk.', {
        dateFrom: zod_1.z.string().optional().describe('From date YYYY-MM-DD'),
        dateTo: zod_1.z.string().optional().describe('To date YYYY-MM-DD'),
        limit: zod_1.z.number().optional().describe('Max number of clients to return (default all)'),
    }, { readOnlyHint: true }, async ({ dateFrom, dateTo, limit }) => {
        try {
            const params = new URLSearchParams();
            if (dateFrom)
                params.set('dateFrom', dateFrom);
            if (dateTo)
                params.set('dateTo', dateTo);
            if (limit)
                params.set('limit', String(limit));
            const qs = params.toString() ? `?${params.toString()}` : '';
            const report = await api(`/api/reports/revenue-by-client${qs}`);
            const clients = report.clients || report;
            if (!Array.isArray(clients) || !clients.length)
                return ok('No revenue data found for this period.');
            const c = report.currency || clients[0]?.currency || 'EUR';
            const lines = clients.map((cl, i) => {
                const pct = cl.percentage ? ` (${cl.percentage.toFixed(1)}%)` : '';
                return `  ${i + 1}. ${cl.name || 'Unknown'} — ${formatMoney(cl.revenue || cl.total || 0, c)}${pct}  |  Paid: ${formatMoney(cl.paid || 0, c)}  |  Outstanding: ${formatMoney(cl.outstanding || 0, c)}`;
            });
            const totalRevenue = clients.reduce((s, cl) => s + (cl.revenue || cl.total || 0), 0);
            return ok([
                `Revenue by Client:`,
                ``,
                ...lines,
                ``,
                `  Total: ${formatMoney(totalRevenue, c)} across ${clients.length} client(s)`,
            ].join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('export_data', '[FacturaHub] Export invoices or expenses as CSV. Returns a download link.', {
        type: zod_1.z.enum(['invoices', 'expenses']).describe('What to export'),
        dateFrom: zod_1.z.string().optional().describe('From date YYYY-MM-DD'),
        dateTo: zod_1.z.string().optional().describe('To date YYYY-MM-DD'),
        status: zod_1.z.string().optional().describe('Filter by status (e.g. "paid", "draft")'),
    }, { readOnlyHint: true, openWorldHint: true }, async ({ type, dateFrom, dateTo, status }) => {
        try {
            const params = new URLSearchParams();
            if (dateFrom)
                params.set('dateFrom', dateFrom);
            if (dateTo)
                params.set('dateTo', dateTo);
            if (status)
                params.set('status', status);
            const qs = params.toString() ? `?${params.toString()}` : '';
            const result = await api(`/api/export/${type}${qs}`);
            return ok(`Export ready:\n  Type: ${type}\n  Records: ${result.count || '?'}\n  Download: ${result.url || result.downloadUrl}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    // ─── Billing ───
    server.tool('get_billing_info', '[FacturaHub] Get current plan and billing status.', {}, { readOnlyHint: true }, async () => {
        try {
            const billing = await api('/api/billing/status');
            return ok([
                `Plan: ${billing.plan || 'free'}`,
                `Usage: ${billing.currentUsage || 0} / ${billing.limit || '∞'} movements`,
                billing.trialEndsAt ? `Trial ends: ${formatDate(billing.trialEndsAt)}` : null,
                billing.nextBillingDate ? `Next billing: ${formatDate(billing.nextBillingDate)}` : null,
            ].filter(Boolean).join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('upgrade_plan', '[FacturaHub] Generate a checkout link to upgrade plan.', {
        plan: zod_1.z.enum(['starter', 'growth', 'pro', 'business']).describe('Target plan'),
    }, { readOnlyHint: false, openWorldHint: true }, async ({ plan }) => {
        try {
            const result = await api('/api/billing/checkout', {
                method: 'POST',
                body: JSON.stringify({ plan }),
            });
            return ok(`Checkout link for ${plan} plan:\n${result.url}\n\nOpen this link to complete payment.`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    // ─── Vendor management (complete) ───
    server.tool('update_vendor', '[FacturaHub] Update vendor/supplier details.', {
        vendorId: zod_1.z.string().describe('Vendor ID'),
        name: zod_1.z.string().optional(),
        email: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        taxId: zod_1.z.string().optional(),
        category: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
    }, { readOnlyHint: false }, async ({ vendorId, ...fields }) => {
        try {
            const vendor = await api(`/api/vendors/${vendorId}`, {
                method: 'PATCH',
                body: JSON.stringify(fields),
            });
            return ok(`Vendor updated: ${vendor.name}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('delete_vendor', '[FacturaHub] Delete a vendor/supplier.', {
        vendorId: zod_1.z.string().describe('Vendor ID'),
    }, { readOnlyHint: false, destructiveHint: true }, async ({ vendorId }) => {
        try {
            await api(`/api/vendors/${vendorId}`, { method: 'DELETE' });
            return ok('Vendor deleted.');
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    // ─── Cash Register (complete) ───
    server.tool('open_register', '[FacturaHub] Open a new cash register session with initial cash amount.', {
        openingCash: zod_1.z.number().describe('Initial cash in register'),
        currency: zod_1.z.string().optional().describe('Currency (default: user currency)'),
    }, { readOnlyHint: false }, async ({ openingCash, currency }) => {
        try {
            const register = await api('/api/cash-register/open', {
                method: 'POST',
                body: JSON.stringify({ openingCash, currency }),
            });
            return ok(`Register opened:\n  ID: ${register._id}\n  Opening cash: ${formatMoney(openingCash, register.currency)}\n  Status: open`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('close_register', '[FacturaHub] Close the current cash register session. Provide the actual cash count for reconciliation.', {
        registerId: zod_1.z.string().describe('Cash register ID'),
        closingCash: zod_1.z.number().describe('Actual cash counted in register'),
    }, { readOnlyHint: false }, async ({ registerId, closingCash }) => {
        try {
            const result = await api(`/api/cash-register/${registerId}/close`, {
                method: 'POST',
                body: JSON.stringify({ closingCash }),
            });
            const diff = result.difference || 0;
            return ok([
                `Register closed.`,
                `  Opening: ${formatMoney(result.openingCash, result.currency)}`,
                `  Sales: ${result.salesCount} (${formatMoney(result.salesTotal, result.currency)})`,
                `  Closing cash: ${formatMoney(closingCash, result.currency)}`,
                `  Expected: ${formatMoney(result.expectedCash, result.currency)}`,
                diff !== 0 ? `  Difference: ${formatMoney(diff, result.currency)} ${diff > 0 ? '(overage)' : '(shortage)'}` : '  Balanced ✓',
            ].join('\n'));
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
}
// ---------------------------------------------------------------------------
// Main — run MCP server
// ---------------------------------------------------------------------------
async function buildInstructions(user) {
    // Try to load business context
    let businessCtx = '';
    try {
        const ctx = await api('/api/context/markdown');
        if (ctx.markdown) {
            businessCtx = `\n\n--- BUSINESS CONTEXT (${ctx.entryCount} documented facts) ---\n${ctx.markdown}`;
        }
    }
    catch { /* context not available, continue without it */ }
    // Check if user can write to business context (owner/admin or solo user)
    let canWriteContext = true;
    let roleInfo = '';
    try {
        const role = await api('/api/teams/my-role');
        if (role.role) {
            roleInfo = ` Your role is "${role.role}".`;
            canWriteContext = ['owner', 'admin'].includes(role.role);
        }
    }
    catch { /* solo user, can write */ }
    const contextDirective = canWriteContext
        ? `\n\nIMPORTANT: Whenever you learn something new about this business (a client relationship, financial pattern, process, product detail, or team structure), PROACTIVELY save it using save_business_context. This builds a living documentation that makes you more helpful over time. At the start of conversations, use get_business_context to recall what you already know.`
        : `\n\nYou have read-only access to the business documentation. Use get_business_context to understand the business, but do NOT attempt to save or modify business context — only the owner or admin can do that.`;
    return `FacturaHub is a startup operations platform — invoicing, expenses, task management, team collaboration, inventory, supplier management, billing, and admin panel. Use these tools when the user asks to create invoices, manage clients, register expenses, check finances, manage tasks, handle inventory/catalog, manage suppliers/vendor invoices (accounts payable), manage team members, view dashboard/KPIs, check activity logs, generate aging or revenue reports, export data, check billing/plan, or handle e-invoicing.

DO NOT use FacturaHub tools for general questions, coding tasks, file operations, or anything unrelated to the platform. These tools call an external REST API — they are NOT local utilities or skills.

The user "${user.name}" (${user.email}) is authenticated. Their country is "${user.country || 'not set'}" and currency is "${user.currency || 'EUR'}".${roleInfo}${contextDirective}${businessCtx}`;
}
async function authenticateApiKey(apiKey) {
    const res = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    });
    if (!res.ok)
        return null;
    const data = await res.json();
    return data.user || null;
}
async function startServer(mode = 'stdio') {
    if (mode === 'http') {
        // HTTP mode: supports per-request auth via Bearer token (multi-tenant)
        // OR a fixed API key via env var (single-tenant / self-hosted)
        await startHttpServer();
        return;
    }
    // Stdio mode: requires FACTURAHUB_API_KEY env var
    if (!API_KEY) {
        console.error('FACTURAHUB_API_KEY environment variable is required');
        process.exit(1);
    }
    const user = await authenticateApiKey(API_KEY);
    if (!user) {
        console.error('Invalid API key: authentication failed');
        process.exit(1);
    }
    const instructions = await buildInstructions(user);
    const server = new mcp_js_1.McpServer({ name: 'facturahub', version: '1.9.2' }, { instructions });
    registerTools(server, user);
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error(`FacturaHub MCP running for ${user.name} (${user.email}) [stdio]`);
}
// ---------------------------------------------------------------------------
// HTTP mode — Streamable HTTP transport for remote clients
// ---------------------------------------------------------------------------
async function startHttpServer() {
    const port = parseInt(process.env.PORT || '8080', 10);
    const fixedApiKey = API_KEY; // optional: set via env for single-tenant mode
    // If a fixed API key is set, validate it at startup
    let fixedUser = null;
    if (fixedApiKey) {
        fixedUser = await authenticateApiKey(fixedApiKey);
        if (!fixedUser) {
            console.error('Invalid FACTURAHUB_API_KEY: authentication failed');
            process.exit(1);
        }
    }
    // Map of session ID → { server, transport, apiKey } for Streamable HTTP
    const sessions = new Map();
    // Map of session ID → SSE transport for legacy SSE connections (remote MCP clients)
    const sseSessions = new Map();
    // Extract API key from request: Bearer token, x-api-key header, query param, or env var
    function extractApiKey(req, url) {
        const auth = req.headers['authorization'];
        if (auth?.startsWith('Bearer '))
            return auth.slice(7);
        const xApiKey = req.headers['x-api-key'];
        if (xApiKey)
            return xApiKey;
        const queryKey = url.searchParams.get('api_key') || url.searchParams.get('apiKey');
        if (queryKey)
            return queryKey;
        return fixedApiKey || null;
    }
    const httpServer = (0, node_http_1.createServer)(async (req, res) => {
        const url = new URL(req.url || '/', `http://localhost:${port}`);
        // CORS headers for remote clients
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, mcp-session-id');
        res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        // Health check
        if (url.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                mode: fixedApiKey ? 'single-tenant' : 'multi-tenant',
                user: fixedUser?.name || null,
            }));
            return;
        }
        // ── SSE endpoint (legacy, for remote MCP clients) ──
        if (url.pathname === '/sse' && req.method === 'GET') {
            try {
                const apiKey = extractApiKey(req, url);
                if (!apiKey) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'API key required' }));
                    return;
                }
                let user;
                if (fixedApiKey && apiKey === fixedApiKey && fixedUser) {
                    user = fixedUser;
                }
                else {
                    user = await authenticateApiKey(apiKey);
                    if (!user) {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid API key' }));
                        return;
                    }
                }
                const transport = new sse_js_1.SSEServerTransport('/messages', res);
                const server = new mcp_js_1.McpServer({ name: 'facturahub', version: '1.9.2' }, { instructions: await buildInstructions(user) });
                registerTools(server, user);
                await server.connect(transport);
                sseSessions.set(transport.sessionId, { server, transport, apiKey });
                transport.onclose = () => { sseSessions.delete(transport.sessionId); };
            }
            catch (error) {
                console.error('SSE connection error:', error);
                if (!res.headersSent) {
                    res.writeHead(500);
                    res.end('Internal server error');
                }
            }
            return;
        }
        // ── SSE messages endpoint ──
        if (url.pathname === '/messages' && req.method === 'POST') {
            const sessionId = url.searchParams.get('sessionId');
            if (!sessionId || !sseSessions.has(sessionId)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'SSE session not found' }));
                return;
            }
            const session = sseSessions.get(sessionId);
            await session.transport.handlePostMessage(req, res);
            return;
        }
        if (url.pathname !== '/mcp') {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        try {
            // Check for existing session
            const sessionId = req.headers['mcp-session-id'];
            if (sessionId && sessions.has(sessionId)) {
                const session = sessions.get(sessionId);
                // Handle DELETE — session termination
                if (req.method === 'DELETE') {
                    await session.transport.close();
                    sessions.delete(sessionId);
                    res.writeHead(200);
                    res.end();
                    return;
                }
                await session.transport.handleRequest(req, res);
                return;
            }
            if (sessionId && !sessions.has(sessionId)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Session not found' }));
                return;
            }
            // New session — only on POST (initialization)
            if (req.method !== 'POST') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'New sessions require POST with initialization request' }));
                return;
            }
            // Authenticate: use Bearer token, x-api-key, query param, or env var
            const apiKey = extractApiKey(req, url);
            if (!apiKey) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: 'API key required. Pass via Authorization: Bearer <key>, x-api-key header, or ?api_key= query param.',
                }));
                return;
            }
            // Use cached user for fixed key, otherwise authenticate per-request
            let user;
            if (fixedApiKey && apiKey === fixedApiKey && fixedUser) {
                user = fixedUser;
            }
            else {
                user = await authenticateApiKey(apiKey);
                if (!user) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid API key' }));
                    return;
                }
            }
            const instructions = await buildInstructions(user);
            const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
                sessionIdGenerator: () => (0, node_crypto_1.randomUUID)(),
            });
            const server = new mcp_js_1.McpServer({ name: 'facturahub', version: '1.9.2' }, { instructions });
            registerTools(server, user);
            await server.connect(transport);
            const newSessionId = transport.sessionId;
            if (newSessionId) {
                sessions.set(newSessionId, { server, transport, apiKey });
                transport.onclose = () => {
                    sessions.delete(newSessionId);
                };
            }
            await transport.handleRequest(req, res);
        }
        catch (error) {
            console.error('MCP request error:', error);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        }
    });
    httpServer.listen(port, () => {
        console.error('');
        console.error(`  FacturaHub MCP — HTTP mode`);
        console.error(`  ──────────────────────────`);
        if (fixedUser) {
            console.error(`  Mode:     Single-tenant (fixed API key)`);
            console.error(`  User:     ${fixedUser.name} (${fixedUser.email})`);
        }
        else {
            console.error(`  Mode:     Multi-tenant (per-request auth)`);
            console.error(`  Auth:     Bearer token, x-api-key, or ?api_key=`);
        }
        console.error(`  Endpoints:`);
        console.error(`    Streamable HTTP: http://localhost:${port}/mcp`);
        console.error(`    SSE (legacy):    http://localhost:${port}/sse`);
        console.error(`    Health:          http://localhost:${port}/health`);
        console.error('');
        console.error(`  remote MCP clients → Settings > Connectors > Add MCP Server`);
        console.error(`  URL: http://localhost:${port}/sse`);
        console.error('');
    });
    // Graceful shutdown
    const shutdown = async () => {
        console.error('\n  Shutting down...');
        for (const [id, session] of sessions) {
            await session.transport.close().catch(() => { });
            sessions.delete(id);
        }
        for (const [id, session] of sseSessions) {
            await session.transport.close().catch(() => { });
            sseSessions.delete(id);
        }
        httpServer.close();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
