"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
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
    server.tool('create_invoice', 'Create an invoice. You can specify the client by name, email, or ID — if the client does not exist yet, it will be created automatically.', {
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
    }, async (params) => {
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
    server.tool('duplicate_invoice', 'Create a copy of an existing invoice with a new date. Useful for recurring billing.', {
        invoiceId: zod_1.z.string().describe('ID of the invoice to copy'),
        dueDate: zod_1.z.string().optional().describe('New due date YYYY-MM-DD. Defaults to 30 days from now.'),
        notes: zod_1.z.string().optional().describe('Override notes (optional)'),
    }, async ({ invoiceId, dueDate, notes }) => {
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
    server.tool('send_invoice', 'Mark an invoice as sent', { invoiceId: zod_1.z.string().describe('Invoice ID') }, async ({ invoiceId }) => {
        try {
            const invoice = await api(`/api/invoices/${invoiceId}/send`, { method: 'PATCH' });
            const client = invoice.clientId;
            return ok(`Invoice ${invoice.invoiceNumber} marked as sent.\n  Client: ${client?.name} (${client?.email})\n  Total: ${formatMoney(invoice.total, invoice.currency)}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('list_invoices', 'List invoices. Filter by client name, status, or date range.', {
        clientName: zod_1.z.string().optional().describe('Filter by client name (partial match)'),
        status: zod_1.z.enum(['draft', 'sent', 'paid', 'overdue']).optional().describe('Filter by status'),
        dateFrom: zod_1.z.string().optional().describe('From date YYYY-MM-DD'),
        dateTo: zod_1.z.string().optional().describe('To date YYYY-MM-DD'),
    }, async ({ clientName, status, dateFrom, dateTo }) => {
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
    server.tool('get_invoice', 'Get full details of an invoice', { invoiceId: zod_1.z.string().describe('Invoice ID') }, async ({ invoiceId }) => {
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
    server.tool('mark_paid', 'Mark an invoice as paid', { invoiceId: zod_1.z.string().describe('Invoice ID') }, async ({ invoiceId }) => {
        try {
            const invoice = await api(`/api/invoices/${invoiceId}/pay`, { method: 'PATCH' });
            return ok(`Invoice ${invoice.invoiceNumber} marked as paid.\n  Total: ${formatMoney(invoice.total, invoice.currency)}\n  Paid: ${formatDate(invoice.paidAt)}`);
        }
        catch (e) {
            return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('create_client', 'Create a new client (you can also just use create_invoice with a client name and it will auto-create)', {
        name: zod_1.z.string().describe('Client name'),
        email: zod_1.z.string().describe('Client email'),
        company: zod_1.z.string().optional().describe('Company name'),
        taxId: zod_1.z.string().optional().describe('Tax ID (NIF/CIF)'),
        address: zod_1.z.string().optional().describe('Address'),
        country: zod_1.z.string().optional().describe('Country'),
        notes: zod_1.z.string().optional().describe('Notes'),
    }, async (params) => {
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
    server.tool('list_clients', 'List all your clients', { search: zod_1.z.string().optional().describe('Search by name or email (partial match)') }, async ({ search }) => {
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
    server.tool('get_context', 'Financial summary: pending totals, overdue, monthly income, invoice lists', async () => {
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
    server.tool('send_reminder', 'List overdue invoices needing reminders', {
        clientName: zod_1.z.string().optional().describe('Filter by client name'),
        daysOverdue: zod_1.z.number().optional().describe('Min days overdue (default 0)'),
    }, async ({ clientName, daysOverdue }) => {
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
    server.tool('download_pdf', 'Generate and return a PDF for an invoice', { invoiceId: zod_1.z.string().describe('Invoice ID') }, async ({ invoiceId }) => {
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
    server.tool('register_expense', 'Register an expense (subscription, tool, travel, etc.) with a category', {
        description: zod_1.z.string().describe('What the expense is for'),
        amount: zod_1.z.number().describe('Amount of the expense'),
        currency: zod_1.z.string().optional().describe('Currency (EUR, USD, etc). Defaults to user currency.'),
        category: zod_1.z.enum(['software', 'hosting', 'travel', 'office', 'professional_services', 'marketing', 'taxes', 'salary', 'equipment', 'other']).describe('Expense category'),
        date: zod_1.z.string().optional().describe('Expense date YYYY-MM-DD. Defaults to today.'),
        vendor: zod_1.z.string().optional().describe('Who you paid (vendor/supplier name)'),
        recurring: zod_1.z.boolean().optional().describe('Whether this is a recurring expense'),
        notes: zod_1.z.string().optional().describe('Additional notes'),
    }, async (params) => {
        try {
            const expense = await api('/api/expenses', {
                method: 'POST',
                body: JSON.stringify({
                    ...params,
                    currency: params.currency ?? user.currency,
                    date: params.date ?? new Date().toISOString().split('T')[0],
                }),
            });
            return ok([
                `Expense registered.`,
                `  Description: ${expense.description}`,
                `  Amount: ${formatMoney(expense.amount, expense.currency)}`,
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
    server.tool('get_profit_loss', 'Get profit & loss report — how much you earned vs spent in a period', {
        month: zod_1.z.number().optional().describe('Month number (1-12). Defaults to current month.'),
        year: zod_1.z.number().optional().describe('Year. Defaults to current year.'),
    }, async ({ month, year }) => {
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
    server.tool('get_tax_summary', 'Tax summary for declarations — VAT/IVA collected, income totals, expense deductions', {
        quarter: zod_1.z.number().optional().describe('Quarter (1-4). If omitted, returns current quarter.'),
        year: zod_1.z.number().optional().describe('Year. Defaults to current year.'),
    }, async ({ quarter, year }) => {
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
    server.tool('get_cashflow', 'Cash flow projection based on pending invoices and recurring expenses', { months: zod_1.z.number().optional().describe('How many months to project (default 3)') }, async ({ months }) => {
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
    server.tool('delete_expense', 'Delete an expense by ID', { expenseId: zod_1.z.string().describe('Expense ID to delete') }, async ({ expenseId }) => {
        try {
            await api(`/api/expenses/${expenseId}`, { method: 'DELETE' });
            return ok(`Expense ${expenseId} deleted.`);
        }
        catch (e) {
            return err(`Error deleting expense: ${e instanceof Error ? e.message : String(e)}`);
        }
    });
    server.tool('get_vat_balance', 'Get your VAT/IVA/BTW balance — how much tax you collected vs paid, and whether you owe or have credit. Essential for quarterly tax declarations.', {
        quarter: zod_1.z.number().optional().describe('Quarter (1-4). Defaults to current quarter.'),
        year: zod_1.z.number().optional().describe('Year. Defaults to current year.'),
    }, async ({ quarter, year }) => {
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
    server.tool('get_income_summary', 'Annual income/earnings summary (ganancias) — gross income, net income, expenses, taxable income, with quarterly breakdown. Use this for income tax planning.', {
        year: zod_1.z.number().optional().describe('Year. Defaults to current year.'),
    }, async ({ year }) => {
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
    server.tool('get_profile', 'Get your business profile — company info, address, tax details, bank info, currency, and plan', async () => {
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
    server.tool('update_profile', 'Update your business profile — company name, address, tax ID, bank details, currency, tax rate, etc.', {
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
    }, async (params) => {
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
}
// ---------------------------------------------------------------------------
// Main — run MCP server
// ---------------------------------------------------------------------------
async function startServer() {
    if (!API_KEY) {
        console.error('FACTURAHUB_API_KEY environment variable is required');
        process.exit(1);
    }
    const { user } = await api('/auth/me');
    if (!user) {
        console.error('Invalid API key: authentication failed');
        process.exit(1);
    }
    const server = new mcp_js_1.McpServer({
        name: 'facturahub',
        version: '1.0.0',
    });
    registerTools(server, user);
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error(`FacturaHub MCP running for ${user.name} (${user.email})`);
}
