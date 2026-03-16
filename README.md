<p align="center">
  <img src="https://facturahub.com/logo.png" alt="FacturaHub" width="80" />
</p>

<h1 align="center">FacturaHub</h1>

<p align="center">
  <strong>Factura con tu IA. Gratis.</strong><br/>
  Crea facturas, registra gastos y genera reportes fiscales hablando con Claude, Cursor o Windsurf.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/facturahub"><img src="https://img.shields.io/npm/v/facturahub.svg?style=flat-square&color=CB3837" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/facturahub"><img src="https://img.shields.io/npm/dm/facturahub.svg?style=flat-square&color=blue" alt="npm downloads" /></a>
  <a href="https://facturahub.com"><img src="https://img.shields.io/badge/Website-facturahub.com-7C3AED?style=flat-square" alt="Website" /></a>
</p>

---

## 3 pasos. 2 minutos. Gratis.

### 1. Crea tu cuenta

Registrate en **[facturahub.com](https://facturahub.com/register)** — es gratis, sin tarjeta de credito, sin limites.

Al terminar el onboarding vas a tener tu **API Key**.

### 2. Instala en tu IA

```bash
npx -y facturahub setup --api-key=TU_API_KEY
```

Eso es todo. Detecta automaticamente Claude Desktop, Claude Code y Cursor.

### 3. Habla con tu IA

Abri tu cliente de IA y proba:

> *"Crea una factura para Acme Corp por €2,500 por desarrollo web"*

La IA crea la factura, crea el cliente si es nuevo, aplica tu tasa de IVA, y genera un PDF profesional.

---

## Que puedo hacer?

Hablale a tu IA en lenguaje natural:

| Tu dices | Que pasa |
|----------|----------|
| "Crea una factura para Acme por €2,500" | Crea factura + cliente automaticamente |
| "Registra un gasto de €49 en Vercel, hosting" | Registra gasto con categoria e IVA |
| "Como va mi P&L este mes?" | Ingresos, gastos, ganancia neta |
| "Cuanto IVA debo este trimestre?" | Balance IVA: cobrado vs pagado |
| "Facturas pendientes de cobro" | Lista facturas vencidas |
| "Marca la factura #001 como pagada" | Actualiza estado y fecha de pago |
| "Descarga PDF de la ultima factura" | Genera PDF profesional |
| "Mis ganancias del 2026" | Resumen anual con desglose trimestral |

### Importa tus datos

Venis de Excel, Holded, Wave o cualquier otra plataforma? Pegale tus datos a Claude:

> *"Tengo este Excel con mis facturas de 2025. Importa todo a FacturaHub."*

Claude crea los clientes y las facturas automaticamente.

---

## 20 herramientas MCP

| Categoria | Herramientas |
|-----------|-------------|
| **Facturas** | `create_invoice` · `duplicate_invoice` · `send_invoice` · `list_invoices` · `get_invoice` · `mark_paid` · `download_pdf` · `send_reminder` |
| **Clientes** | `create_client` · `list_clients` |
| **Gastos** | `register_expense` · `delete_expense` |
| **Reportes** | `get_context` · `get_profit_loss` · `get_tax_summary` · `get_vat_balance` · `get_income_summary` · `get_cashflow` |
| **Perfil** | `get_profile` · `update_profile` |

---

## Instalacion manual

Si preferis configurar manualmente, agrega este JSON al archivo de tu cliente:

| Cliente | Archivo de config |
|---------|-------------------|
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
        "FACTURAHUB_API_KEY": "tu-api-key",
        "FACTURAHUB_API_URL": "https://api.facturahub.com"
      }
    }
  }
}
```

---

## 20+ paises

🇪🇸 Espana · 🇲🇽 Mexico · 🇦🇷 Argentina · 🇨🇴 Colombia · 🇨🇱 Chile · 🇵🇪 Peru · 🇺🇾 Uruguay · 🇧🇷 Brasil · 🇨🇷 Costa Rica · 🇪🇨 Ecuador · 🇵🇦 Panama · 🇩🇴 Rep. Dominicana · 🇳🇱 Paises Bajos · 🇩🇪 Alemania · 🇫🇷 Francia · 🇮🇹 Italia · 🇵🇹 Portugal · 🇺🇸 Estados Unidos · 🇬🇧 Reino Unido

IVA, BTW, IRPF y mas — configuracion fiscal automatica por pais.

---

## Precio

**Gratis.** Sin limites. Facturas ilimitadas, gastos ilimitados, reportes, PDF, MCP — todo incluido.

**[Crear cuenta gratis →](https://facturahub.com/register)**

---

## CLI

```bash
npx -y facturahub setup --api-key=XXX   # Instala en todos tus clientes de IA
npx -y facturahub setup --target=cursor  # Instala solo en Cursor
npx -y facturahub status                 # Verifica la instalacion
npx -y facturahub version                # Version actual
npx -y facturahub update                 # Actualizar a la ultima version
npx -y facturahub uninstall              # Desinstalar de todos los clientes
```

---

## Links

- **Web**: [facturahub.com](https://facturahub.com)
- **npm**: [npmjs.com/package/facturahub](https://www.npmjs.com/package/facturahub)

---

Hecho por [Santiago Garcia](https://github.com/Santy1422) para freelancers que odian facturar.
