#!/usr/bin/env node
import { startServer } from './server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

// ---------------------------------------------------------------------------
// CLI Colors
// ---------------------------------------------------------------------------

const green = (t: string) => `\x1b[32m${t}\x1b[0m`;
const yellow = (t: string) => `\x1b[33m${t}\x1b[0m`;
const red = (t: string) => `\x1b[31m${t}\x1b[0m`;
const bold = (t: string) => `\x1b[1m${t}\x1b[0m`;
const dim = (t: string) => `\x1b[2m${t}\x1b[0m`;
const cyan = (t: string) => `\x1b[36m${t}\x1b[0m`;

// ---------------------------------------------------------------------------
// Config paths
// ---------------------------------------------------------------------------

interface Target {
  id: string;
  name: string;
  configPath: string;
  detected: boolean;
}

function getTargets(): Target[] {
  const home = os.homedir();
  const platform = os.platform();

  const claudeDesktop =
    platform === 'darwin'
      ? path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
      : platform === 'win32'
      ? path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json')
      : path.join(home, '.config', 'claude', 'claude_desktop_config.json');

  return [
    { id: 'claude-desktop', name: 'Claude Desktop', configPath: claudeDesktop, detected: fs.existsSync(path.dirname(claudeDesktop)) },
    { id: 'claude-code', name: 'Claude Code', configPath: path.join(home, '.claude', 'settings.json'), detected: fs.existsSync(path.join(home, '.claude')) },
    { id: 'cursor', name: 'Cursor', configPath: path.join(home, '.cursor', 'mcp.json'), detected: fs.existsSync(path.join(home, '.cursor')) },
  ];
}

// ---------------------------------------------------------------------------
// JSON file helpers
// ---------------------------------------------------------------------------

function readJson(filePath: string): Record<string, any> {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {}
  return {};
}

function writeJson(filePath: string, data: Record<string, any>): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function ask(rl: readline.Interface, question: string, defaultVal?: string): Promise<string> {
  const suffix = defaultVal ? ` [${defaultVal}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultVal || '');
    });
  });
}

// ---------------------------------------------------------------------------
// MCP config that gets written to client config files
// ---------------------------------------------------------------------------

function mcpEntry(apiKey: string) {
  return {
    command: 'npx',
    args: ['-y', 'facturahub@latest'],
    env: {
      FACTURAHUB_API_KEY: apiKey,
      FACTURAHUB_API_URL: 'https://api.facturahub.com',
    },
  };
}

// ---------------------------------------------------------------------------
// Setup command
// ---------------------------------------------------------------------------

async function setup(args: Record<string, string>): Promise<void> {
  console.log('');
  console.log(bold('  ⚡ FacturaHub MCP Setup'));
  console.log(dim('  ────────────────────────'));
  console.log('');

  const targets = getTargets();
  const detected = targets.filter((t) => t.detected);

  // Show detected
  console.log('  AI clients detected:\n');
  for (const t of targets) {
    const icon = t.detected ? green('●') : dim('○');
    const label = t.detected ? 'found' : 'not found';
    console.log(`    ${icon} ${t.name} — ${t.detected ? green(label) : dim(label)}`);
  }
  console.log('');

  if (detected.length === 0) {
    console.log(yellow('  No AI clients detected.'));
    console.log('  Install Claude Desktop, Claude Code, or Cursor first.\n');
    process.exit(1);
  }

  // Resolve target(s)
  let selected: Target[];

  if (args.target) {
    const match = targets.find((t) => t.id === args.target);
    if (!match) {
      console.log(red(`  Unknown target "${args.target}". Options: ${targets.map((t) => t.id).join(', ')}`));
      process.exit(1);
    }
    selected = [match];
  } else {
    // Auto-install to all detected
    selected = detected;
  }

  // API key
  let apiKey = args['api-key'];

  if (!apiKey) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    apiKey = await ask(rl, `  ${cyan('?')} Your FacturaHub API Key`);
    rl.close();
    if (!apiKey) {
      console.log(red('\n  API Key is required. Get it from your dashboard → API Key.\n'));
      process.exit(1);
    }
  }

  // Install
  const config = mcpEntry(apiKey);

  console.log('');
  for (const target of selected) {
    const json = readJson(target.configPath);
    if (!json.mcpServers) json.mcpServers = {};
    const existed = !!json.mcpServers.facturahub;
    json.mcpServers.facturahub = config;
    writeJson(target.configPath, json);

    console.log(`  ${green('✓')} ${target.name} — ${existed ? 'updated' : 'installed'}`);
    console.log(`    ${dim(target.configPath)}`);
  }

  console.log('');
  console.log(bold('  Done! Next steps:'));
  console.log(`  1. Restart ${selected.map((t) => t.name).join(' / ')}`);
  console.log(`  2. Say: ${cyan('"Create an invoice for Acme Corp for €2,500"')}`);
  console.log('');
}

// ---------------------------------------------------------------------------
// Status command
// ---------------------------------------------------------------------------

function showStatus(): void {
  console.log('');
  console.log(bold('  FacturaHub MCP — Status'));
  console.log('');

  for (const target of getTargets()) {
    const json = readJson(target.configPath);
    const installed = !!json.mcpServers?.facturahub;
    const icon = installed ? green('●') : dim('○');
    console.log(`  ${icon} ${target.name} — ${installed ? green('installed') : dim('not installed')}`);
    if (installed) {
      const key = json.mcpServers.facturahub.env?.FACTURAHUB_API_KEY || '';
      const masked = key.length > 8 ? key.slice(0, 4) + '••••' + key.slice(-4) : '••••';
      console.log(`    ${dim(`API Key: ${masked}`)}`);
    }
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Uninstall command
// ---------------------------------------------------------------------------

function uninstall(): void {
  console.log('');
  console.log(bold('  FacturaHub MCP — Uninstall'));
  console.log('');

  let removed = 0;
  for (const target of getTargets()) {
    const json = readJson(target.configPath);
    if (json.mcpServers?.facturahub) {
      delete json.mcpServers.facturahub;
      writeJson(target.configPath, json);
      console.log(`  ${green('✓')} Removed from ${target.name}`);
      removed++;
    }
  }

  if (removed === 0) console.log(dim('  FacturaHub not found in any client.'));
  else console.log(`\n  ${removed} config(s) removed. Restart your AI clients.`);
  console.log('');
}

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------

function parseArgs(): { command: string; flags: Record<string, string> } {
  const argv = process.argv.slice(2);
  const flags: Record<string, string> = {};
  let command = '';

  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, ...val] = arg.slice(2).split('=');
      flags[key] = val.join('=') || 'true';
    } else if (!command) {
      command = arg;
    }
  }

  return { command, flags };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { command, flags } = parseArgs();

  if (command === 'setup' || flags.setup) {
    await setup(flags);
    return;
  }

  if (command === 'status' || flags.status) {
    showStatus();
    return;
  }

  if (command === 'uninstall' || flags.uninstall) {
    uninstall();
    return;
  }

  if (command === 'version' || flags.version) {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    console.log(`facturahub v${pkg.version}`);
    return;
  }

  if (command === 'update' || flags.update) {
    console.log('');
    console.log(bold('  ⚡ Updating FacturaHub...'));
    console.log('');
    const { execSync } = await import('child_process');
    try {
      execSync('npm install -g facturahub@latest', { stdio: 'inherit' });
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
      console.log('');
      console.log(`  ${green('✓')} Updated to v${pkg.version}`);
      console.log(`  Restart your AI clients to use the new version.`);
      console.log('');
    } catch {
      console.log(yellow('  Tip: if permission denied, run with sudo:'));
      console.log(`  ${cyan('sudo npm install -g facturahub@latest')}`);
      console.log('');
    }
    return;
  }

  if (command === 'help' || flags.help) {
    console.log(`
  ${bold('facturahub')} — AI invoicing MCP server

  ${bold('Commands:')}
    facturahub                    Start MCP server (used by AI clients)
    facturahub setup              Install in your AI clients
    facturahub setup --api-key=X  Install with API key
    facturahub setup --target=X   Install in specific client only
    facturahub status             Check installation status
    facturahub update             Update to latest version
    facturahub version            Show current version
    facturahub uninstall          Remove from all clients
    facturahub help               Show this help

  ${bold('Targets:')}
    claude-desktop, claude-code, cursor

  ${bold('More info:')} https://facturahub.com
`);
    return;
  }

  // Default: run MCP server
  await startServer();
}

main().catch((e) => {
  console.error(red(`Error: ${e instanceof Error ? e.message : String(e)}`));
  process.exit(1);
});
