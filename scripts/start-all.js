/**
 * start-all.js — Multi-service launcher
 * Starts all AI services, gateway, and frontend dev server.
 * Usage: node scripts/start-all.js
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SERVICES = [
  {
    name: 'STT Service',
    port: 5001,
    cwd: path.join(ROOT, 'services', 'stt-service'),
    cmd: 'python',
    args: ['stt_server.py'],
    color: '\x1b[36m', // cyan
  },
  {
    name: 'Translation Service',
    port: 5002,
    cwd: path.join(ROOT, 'services', 'translation-service'),
    cmd: 'node',
    args: ['index.js'],
    color: '\x1b[33m', // yellow
  },
  {
    name: 'LLM Service',
    port: 5003,
    cwd: path.join(ROOT, 'services', 'llm-service'),
    cmd: 'node',
    args: ['index.js'],
    color: '\x1b[35m', // magenta
  },
  {
    name: 'TTS Service',
    port: 5004,
    cwd: path.join(ROOT, 'services', 'tts-service'),
    cmd: 'python',
    args: ['tts_server.py'],
    color: '\x1b[32m', // green
  },
  {
    name: 'Avatar Service',
    port: 5005,
    cwd: path.join(ROOT, 'services', 'avatar-service'),
    cmd: 'node',
    args: ['index.js'],
    color: '\x1b[34m', // blue
  },
  {
    name: 'Gateway API',
    port: 4000,
    cwd: path.join(ROOT, 'backend', 'gateway-api'),
    cmd: 'node',
    args: ['app.js'],
    color: '\x1b[31m', // red
  },
  {
    name: 'Frontend Dev',
    port: 5173,
    cwd: path.join(ROOT, 'frontend', 'web-client'),
    cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['vite', '--host'],
    color: '\x1b[37m', // white
  },
];

const RESET = '\x1b[0m';
const processes = [];

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║    🇮🇳  AI Avatar Civic Communication Platform           ║');
console.log('║         India Innovates 2026                            ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log('║  Starting all services...                               ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

for (const svc of SERVICES) {
  console.log(`${svc.color}[${svc.name}]${RESET} Starting on port ${svc.port}...`);

  const child = spawn(svc.cmd, svc.args, {
    cwd: svc.cwd,
    env: { ...process.env, PORT: String(svc.port) },
    shell: true,
    stdio: 'pipe',
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      console.log(`${svc.color}[${svc.name}]${RESET} ${line}`);
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      // Filter out common non-error stderr output
      if (!line.includes('ExperimentalWarning') && !line.includes('DeprecationWarning')) {
        console.log(`${svc.color}[${svc.name}]${RESET} ${line}`);
      }
    });
  });

  child.on('exit', (code) => {
    console.log(`${svc.color}[${svc.name}]${RESET} Exited with code ${code}`);
  });

  processes.push(child);
}

// Health check after 5 seconds
setTimeout(async () => {
  console.log('\n─── Health Check ───');
  for (const svc of SERVICES) {
    try {
      const res = await fetch(`http://localhost:${svc.port}/health`, {
        signal: AbortSignal.timeout(2000)
      });
      console.log(`${svc.color}[${svc.name}]${RESET} ✅ Port ${svc.port} — OK`);
    } catch {
      console.log(`${svc.color}[${svc.name}]${RESET} ⏳ Port ${svc.port} — Starting...`);
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  🌐 Open http://localhost:5173 in your browser          ║');
  console.log('║  📡 API Gateway: http://localhost:4000/api/health       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}, 5000);

// Graceful shutdown
function shutdown() {
  console.log('\n🛑 Shutting down all services...');
  processes.forEach(p => {
    try { p.kill('SIGTERM'); } catch {}
  });
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);
