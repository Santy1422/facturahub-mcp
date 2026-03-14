import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// HTTP client for FacturaHub API
// ---------------------------------------------------------------------------

const API_URL = process.env.FACTURAHUB_API_URL || 'https://api.facturahub.com';
const API_KEY = process.env.FACTURAHUB_API_KEY;

async function api<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY!,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as Record<string, string>;
    throw new Error(body.error || body.message || res.statusText);
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/pdf')) {
    const buf = Buffer.from(await res.arrayBuffer());
    return buf as unknown as T;
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: string | Date): string {
  return new Date(d).toISOString().split('T')[0];
}

function formatMoney(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    EUR: '€', USD: '$', GBP: '£', MXN: 'MX$', ARS: 'AR$',
    COP: 'COP', CLP: 'CLP', BRL: 'R$', PEN: 'S/', UYU: '$U',
  };
  return `${symbols[currency] || currency}${amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function err(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

function registerTools(server: McpServer, user: any): void {
  server.tool(
    'create_invoice',
    'Create an invoice. You can specify the client by name, email, or ID — if the client does not exist yet, it will be created automatically.',
    {
      clientName: z.string().optional().describe('Client name (e.g. "DGuard"). Will find or create the client.'),
      clientEmail: z.string().optional().describe('Client email. Used to match existing client or set email on new one.'),
      clientId: z.string().optional().describe('Client ID if you already know it. Takes priority over name/email.'),
      clientCompany: z.string().optional().describe('Company name for new client (optional).'),
      clientCountry: z.string().optional().describe('Country for new client (optional).'),
      items: z.array(
        z.object({
          description: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
        }),
      ).describe('Line items for the invoice'),
      currency: z.string().optional().describe('Currency code (EUR, USD, etc). Defaults to user currency.'),
      dueDate: z.string().describe('Due date YYYY-MM-DD'),
      taxRate: z.number().optional().describe('Tax % (e.g. 21 for 21%). Default 0.'),
      notes: z.string().optional().describe('Optional notes on the invoice'),
    },
    async (params) => {
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
      } catch (e: unknown) {
        return err(`Error creating invoice: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    'duplicate_invoice',
    'Create a copy of an existing invoice with a new date. Useful for recurring billing.',
    {
      invoiceId: z.string().describe('ID of the invoice to copy'),
      dueDate: z.string().optional().describe('New due date YYYY-MM-DD. Defaults to 30 days from now.'),
      notes: z.string().optional().describe('Override notes (optional)'),
    },
    async ({ invoiceId, dueDate, notes }) => {
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
      } catch (e: unknown) {
        return err(`Error duplicating invoice: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    'send_invoice',
    'Mark an invoice as sent',
    { invoiceId: z.string().describe('Invoice ID') },
    async ({ invoiceId }) => {
      try {
        const invoice = await api(`/api/invoices/${invoiceId}/send`, { method: 'PATCH' });
        const client = invoice.clientId;
        return ok(`Invoice ${invoice.invoiceNumber} marked as sent.\n  Client: ${client?.name} (${client?.email})\n  Total: ${formatMoney(invoice.total, invoice.currency)}`);
      } catch (e: unknown) {
        return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    'list_invoices',
    'List invoices. Filter by client name, status, or date range.',
    {
      clientName: z.string().optional().describe('Filter by client name (partial match)'),
      status: z.enum(['draft', 'sent', 'paid', 'overdue']).optional().describe('Filter by status'),
      dateFrom: z.string().optional().describe('From date YYYY-MM-DD'),
      dateTo: z.string().optional().describe('To date YYYY-MM-DD'),
    },
    async ({ clientName, status, dateFrom, dateTo }) => {
      try {
        let clientId: string | undefined;
        if (clientName) {
          const clients = await api(`/api/clients?search=${encodeURIComponent(clientName)}`);
          if (clients.length > 0) clientId = clients[0]._id;
        }

        const params = new URLSearchParams();
        if (clientId) params.set('clientId', clientId);
        if (status) params.set('status', status);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);

        const qs = params.toString() ? `?${params.toString()}` : '';
        const invoices = await api(`/api/invoices${qs}`);

        if (invoices.length === 0) return ok('No invoices found.');

        const lines = invoices.map((inv: any) => {
          const client = inv.clientId?.name ?? 'Unknown';
          return `- ${inv.invoiceNumber} | ${client} | ${formatMoney(inv.total, inv.currency)} | ${inv.status} | Due: ${formatDate(inv.dueDate)} | ID: ${inv._id}`;
        });

        return ok(`${invoices.length} invoice(s):\n\n${lines.join('\n')}`);
      } catch (e: unknown) {
        return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    'get_invoice',
    'Get full details of an invoice',
    { invoiceId: z.string().describe('Invoice ID') },
    async ({ invoiceId }) => {
      try {
        const invoice = await api(`/api/invoices/${invoiceId}`);
        const client = invoice.clientId;
        const itemLines = invoice.items
          .map((item: any, i: number) => `  ${i + 1}. ${item.description} — ${item.quantity} x ${formatMoney(item.unitPrice, invoice.currency)} = ${formatMoney(item.amount, invoice.currency)}`)
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
      } catch (e: unknown) {
        return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    'mark_paid',
    'Mark an invoice as paid',
    { invoiceId: z.string().describe('Invoice ID') },
    async ({ invoiceId }) => {
      try {
        const invoice = await api(`/api/invoices/${invoiceId}/pay`, { method: 'PATCH' });
        return ok(`Invoice ${invoice.invoiceNumber} marked as paid.\n  Total: ${formatMoney(invoice.total, invoice.currency)}\n  Paid: ${formatDate(invoice.paidAt)}`);
      } catch (e: unknown) {
        return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    'create_client',
    'Create a new client (you can also just use create_invoice with a client name and it will auto-create)',
    {
      name: z.string().describe('Client name'),
      email: z.string().describe('Client email'),
      company: z.string().optional().describe('Company name'),
      taxId: z.string().optional().describe('Tax ID (NIF/CIF)'),
      address: z.string().optional().describe('Address'),
      country: z.string().optional().describe('Country'),
      notes: z.string().optional().describe('Notes'),
    },
    async (params) => {
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
      } catch (e: unknown) {
        return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    'list_clients',
    'List all your clients',
    { search: z.string().optional().describe('Search by name or email (partial match)') },
    async ({ search }) => {
      try {
        const qs = search ? `?search=${encodeURIComponent(search)}` : '';
        const clients = await api(`/api/clients${qs}`);
        if (clients.length === 0) return ok('No clients found.');
        const lines = clients.map((c: any) =>
          `- ${c.name}${c.company ? ` (${c.company})` : ''} | ${c.email} | ID: ${c._id}`
        );
        return ok(`${clients.length} client(s):\n\n${lines.join('\n')}`);
      } catch (e: unknown) {
        return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    'get_context',
    'Financial summary: pending totals, overdue, monthly income, invoice lists',
    async () => {
      try {
        const ctx = await api('/api/invoices/context');

        const pendingLines = ctx.pendingInvoices.length > 0
          ? ctx.pendingInvoices.map((inv: any) =>
              `  - ${inv.invoiceNumber} | ${inv.client} | ${formatMoney(inv.total, user.currency)} | Due: ${formatDate(inv.dueDate)}`
            ).join('\n')
          : '  (none)';

        const overdueLines = ctx.overdueInvoices.length > 0
          ? ctx.overdueInvoices.map((inv: any) =>
              `  - ${inv.invoiceNumber} | ${inv.client} | ${formatMoney(inv.total, user.currency)} | ${inv.daysOverdue} days overdue`
            ).join('\n')
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
      } catch (e: unknown) {
        return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    'send_reminder',
    'List overdue invoices needing reminders',
    {
      clientName: z.string().optional().describe('Filter by client name'),
      daysOverdue: z.number().optional().describe('Min days overdue (default 0)'),
    },
    async ({ clientName, daysOverdue }) => {
      try {
        const minDays = daysOverdue ?? 0;
        const params = new URLSearchParams({ status: 'overdue' });
        if (clientName) {
          const clients = await api(`/api/clients?search=${encodeURIComponent(clientName)}`);
          if (clients.length > 0) params.set('clientId', clients[0]._id);
        }
        const invoices = await api(`/api/invoices?${params.toString()}`);
        const now = new Date();
        const filtered = invoices
          .map((inv: any) => ({
            ...inv,
            daysOverdue: Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000),
          }))
          .filter((inv: any) => inv.daysOverdue >= minDays)
          .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);

        if (filtered.length === 0) return ok('No overdue invoices found. No reminders needed.');

        const lines = filtered.map((inv: any) => {
          const client = inv.clientId;
          return `- ${inv.invoiceNumber} | ${client?.name} (${client?.email}) | ${formatMoney(inv.total, inv.currency)} | ${inv.daysOverdue} days overdue`;
        });
        const total = filtered.reduce((sum: number, inv: any) => sum + inv.total, 0);
        return ok([`${filtered.length} overdue invoice(s):`, ``, ...lines, ``, `Total overdue: ${formatMoney(total, user.currency)}`].join('\n'));
      } catch (e: unknown) {
        return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    'download_pdf',
    'Generate and return a PDF for an invoice',
    { invoiceId: z.string().describe('Invoice ID') },
    async ({ invoiceId }) => {
      try {
        const pdfBuffer: Buffer = await api(`/api/invoices/${invoiceId}/pdf`);
        const base64 = pdfBuffer.toString('base64');
        const invoice = await api(`/api/invoices/${invoiceId}`);
        return {
          content: [
            {
              type: 'resource' as const,
              resource: {
                uri: `invoice://${invoiceId}/pdf`,
                mimeType: 'application/pdf',
                blob: base64,
              },
            },
            {
              type: 'text' as const,
              text: `PDF generated for invoice ${invoice.invoiceNumber} (${formatMoney(invoice.total, invoice.currency)}).`,
            },
          ],
        };
      } catch (e: unknown) {
        return err(`Error generating PDF: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    'register_expense',
    'Register an expense (subscription, tool, travel, etc.) with a category',
    {
      description: z.string().describe('What the expense is for'),
      amount: z.number().describe('Amount of the expense'),
      currency: z.string().optional().describe('Currency (EUR, USD, etc). Defaults to user currency.'),
      category: z.enum(['software', 'hosting', 'travel', 'office', 'professional_services', 'marketing', 'taxes', 'salary', 'equipment', 'other']).describe('Expense category'),
      date: z.string().optional().describe('Expense date YYYY-MM-DD. Defaults to today.'),
      vendor: z.string().optional().describe('Who you paid (vendor/supplier name)'),
      recurring: z.boolean().optional().describe('Whether this is a recurring expense'),
      notes: z.string().optional().describe('Additional notes'),
    },
    async (params) => {
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
      } catch (e: unknown) {
        return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    'get_profit_loss',
    'Get profit & loss report — how much you earned vs spent in a period',
    {
      month: z.number().optional().describe('Month number (1-12). Defaults to current month.'),
      year: z.number().optional().describe('Year. Defaults to current year.'),
    },
    async ({ month, year }) => {
      try {
        const params = new URLSearchParams();
        if (month) params.set('month', String(month));
        if (year) params.set('year', String(year));
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
          ...report.expensesByCategory.map((c: any) =>
            `  - ${c.category}: ${formatMoney(c.total, user.currency)}`
          ),
        ].filter(Boolean).join('\n'));
      } catch (e: unknown) {
        return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    'get_tax_summary',
    'Tax summary for declarations — VAT/IVA collected, income totals, expense deductions',
    {
      quarter: z.number().optional().describe('Quarter (1-4). If omitted, returns current quarter.'),
      year: z.number().optional().describe('Year. Defaults to current year.'),
    },
    async ({ quarter, year }) => {
      try {
        const params = new URLSearchParams();
        if (quarter) params.set('quarter', String(quarter));
        if (year) params.set('year', String(year));
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
      } catch (e: unknown) {
        return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );

  server.tool(
    'get_cashflow',
    'Cash flow projection based on pending invoices and recurring expenses',
    { months: z.number().optional().describe('How many months to project (default 3)') },
    async ({ months }) => {
      try {
        const params = new URLSearchParams();
        if (months) params.set('months', String(months));
        const qs = params.toString() ? `?${params.toString()}` : '';
        const report = await api(`/api/expenses/cashflow${qs}`);
        const monthLines = report.months.map((m: any) =>
          `  ${m.month}: +${formatMoney(m.expectedIncome, user.currency)} / -${formatMoney(m.expectedExpenses, user.currency)} = ${formatMoney(m.net, user.currency)}`
        );
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
      } catch (e: unknown) {
        return err(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Main — run MCP server
// ---------------------------------------------------------------------------

export async function startServer(): Promise<void> {
  if (!API_KEY) {
    console.error('FACTURAHUB_API_KEY environment variable is required');
    process.exit(1);
  }

  const { user } = await api('/auth/me');
  if (!user) {
    console.error('Invalid API key: authentication failed');
    process.exit(1);
  }

  const server = new McpServer({
    name: 'facturahub',
    version: '1.0.0',
  });

  registerTools(server, user);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`FacturaHub MCP running for ${user.name} (${user.email})`);
}
