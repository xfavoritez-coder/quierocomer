// POS QuieroComer — Puente de impresión
// El usuario solo hace doble clic. El resto es automático.

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const { execFile, exec } = require('child_process');

// ── Config ────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const PS_SCRIPT   = path.join(__dirname, '..', 'raw-print.ps1');
const PORT        = 7777;

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

// ── Listar impresoras Windows ─────────────────────────────────────

function listPrinters() {
  return new Promise((resolve) => {
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command',
       'Get-Printer | Select-Object Name,DriverName,PortName | ConvertTo-Json'],
      { timeout: 8000 },
      (err, stdout) => {
        if (err || !stdout.trim()) return resolve([]);
        try {
          const raw = JSON.parse(stdout.trim());
          const arr = Array.isArray(raw) ? raw : [raw];
          resolve(arr.map(p => ({ name: p.Name, driver: p.DriverName, port: p.PortName })));
        } catch { resolve([]); }
      }
    );
  });
}

// ── Imprimir (USB via PowerShell RAW) ────────────────────────────

function doPrint(data, printerName) {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `pos_${Date.now()}.bin`);
    fs.writeFileSync(tmp, data);
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
       '-File', PS_SCRIPT, tmp, printerName],
      { timeout: 12000 },
      (err, stdout, stderr) => {
        try { fs.unlinkSync(tmp); } catch {}
        if (err) return reject(new Error(stderr?.trim() || err.message));
        if (stdout?.trim().startsWith('OK')) resolve();
        else reject(new Error('No se pudo imprimir: ' + (stderr?.trim() || stdout?.trim())));
      }
    );
  });
}

// ── ESC/POS encoder (sin librerías) ──────────────────────────────

const { encodeComanda, encodeTest } = require('./encoder');

// ── Cola de impresión ─────────────────────────────────────────────

const { enqueue, getQueueStatus } = require('./queue');

// ── App ───────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors());

// ── GET / — Página de configuración (UI para el usuario) ──────────

app.get('/', async (req, res) => {
  const cfg = loadConfig();
  const selectedPrinter = cfg.connection?.printerName || '';
  const printers = await listPrinters();

  const printerCards = printers.length === 0
    ? `<p class="warn">No se encontraron impresoras. Asegúrate de tener los drivers instalados y la impresora conectada.</p>`
    : printers.map(p => {
        const isSelected = p.name === selectedPrinter;
        return `
          <button class="printer-card ${isSelected ? 'selected' : ''}"
                  onclick="selectPrinter('${escHtml(p.name)}')">
            <span class="printer-icon">🖨️</span>
            <span class="printer-name">${escHtml(p.name)}</span>
            ${isSelected ? '<span class="check">✓ Seleccionada</span>' : '<span class="pick">Usar esta</span>'}
          </button>`;
      }).join('');

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>POS QuieroComer — Impresora</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f5f4f1; color: #1b1a17; min-height: 100vh;
           display: flex; flex-direction: column; align-items: center; padding: 40px 16px; }
    .logo { font-size: 1.1rem; font-weight: 800; color: #1b1a17; margin-bottom: 4px; }
    .logo span { color: #de7c00; }
    .subtitle { font-size: 0.82rem; color: #6e6b64; margin-bottom: 32px; }
    .card { background: #fff; border: 1px solid #eae8e2; border-radius: 18px;
            padding: 28px; width: 100%; max-width: 480px; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
    h1 { font-size: 1.15rem; font-weight: 700; margin-bottom: 6px; }
    .desc { font-size: 0.82rem; color: #6e6b64; margin-bottom: 20px; line-height: 1.5; }
    .printer-card { display: flex; align-items: center; gap: 12px; width: 100%;
                    padding: 14px 16px; border: 1.5px solid #eae8e2; border-radius: 12px;
                    background: #faf9f7; cursor: pointer; margin-bottom: 8px;
                    transition: .15s; text-align: left; }
    .printer-card:hover { border-color: #de7c00; background: #fdf7ec; }
    .printer-card.selected { border-color: #2f8f6b; background: #e7f1ec; }
    .printer-icon { font-size: 1.4rem; }
    .printer-name { flex: 1; font-size: 0.88rem; font-weight: 600; }
    .check { font-size: 0.75rem; color: #2f8f6b; font-weight: 700; }
    .pick { font-size: 0.75rem; color: #de7c00; font-weight: 600; }
    .divider { border: none; border-top: 1px solid #eae8e2; margin: 20px 0; }
    .btn { width: 100%; padding: 14px; border: none; border-radius: 12px;
           font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: .15s; }
    .btn-primary { background: #de7c00; color: #fff; }
    .btn-primary:hover { background: #b86500; }
    .btn-secondary { background: #f5f4f1; color: #1b1a17; border: 1px solid #eae8e2; margin-top: 8px; }
    .btn-secondary:hover { background: #eae8e2; }
    .status-ok  { color: #2f8f6b; font-weight: 600; font-size: 0.85rem; text-align: center; margin-top: 12px; }
    .status-err { color: #e05252; font-weight: 600; font-size: 0.85rem; text-align: center; margin-top: 12px; }
    .warn { color: #a19d94; font-size: 0.82rem; padding: 16px; background: #faf9f7;
            border-radius: 10px; border: 1px solid #eae8e2; }
    .badge { display: inline-block; background: #2f8f6b; color: #fff; font-size: 0.7rem;
             font-weight: 700; padding: 2px 8px; border-radius: 99px; margin-left: 8px; }
    #msg { margin-top: 14px; text-align: center; font-size: 0.85rem; font-weight: 600;
           min-height: 24px; }
  </style>
</head>
<body>
  <div class="logo">Quiero<span>Comer</span> <small style="font-weight:400;color:#a19d94">POS</small></div>
  <div class="subtitle">Puente de impresión ${selectedPrinter ? '· <b style="color:#2f8f6b">Activo</b>' : ''}</div>

  <div class="card">
    <h1>Impresora de cocina ${selectedPrinter ? '<span class="badge">Configurada</span>' : ''}</h1>
    <p class="desc">
      ${selectedPrinter
        ? `Usando <b>${escHtml(selectedPrinter)}</b>. Puedes cambiarla eligiendo otra abajo.`
        : 'Elige la impresora que usarás para las comandas de cocina.'}
    </p>

    ${printerCards}

    <hr class="divider">

    <button class="btn btn-primary" onclick="testPrint()" ${selectedPrinter ? '' : 'disabled style="opacity:.5;cursor:not-allowed"'}>
      🖨️ Imprimir comanda de prueba
    </button>
    <button class="btn btn-secondary" onclick="location.reload()">
      ↺ Actualizar lista
    </button>

    <div id="msg"></div>
  </div>

  <p style="margin-top:24px;font-size:0.75rem;color:#a19d94;text-align:center">
    Este programa debe estar abierto mientras usas el POS.<br>
    Puedes minimizar esta ventana.
  </p>

  <script>
    function msg(text, ok) {
      const el = document.getElementById('msg');
      el.textContent = text;
      el.style.color = ok ? '#2f8f6b' : '#e05252';
    }

    async function selectPrinter(name) {
      msg('Guardando...', true);
      const r = await fetch('/setup/printer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printerName: name })
      });
      const d = await r.json();
      if (d.ok) { msg('✓ Impresora guardada', true); setTimeout(() => location.reload(), 800); }
      else msg('Error: ' + d.error, false);
    }

    async function testPrint() {
      msg('Enviando comanda de prueba...', true);
      const r = await fetch('/test', { method: 'POST' });
      const d = await r.json();
      if (d.ok) msg('✓ Revisa la impresora', true);
      else msg('Error: ' + d.error, false);
    }
  </script>
</body>
</html>`);
});

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── POST /setup/printer — guardar impresora seleccionada ──────────

app.post('/setup/printer', (req, res) => {
  const { printerName } = req.body;
  if (!printerName) return res.status(400).json({ ok: false, error: 'Falta printerName' });

  const cfg = loadConfig();
  cfg.connection = { type: 'usb', printerName };
  saveConfig(cfg);
  console.log('[Bridge] Impresora configurada:', printerName);
  res.json({ ok: true });
});

// ── POST /setup/tcp — guardar modo TCP ────────────────────────────

app.post('/setup/tcp', (req, res) => {
  const { ip, port } = req.body;
  if (!ip) return res.status(400).json({ ok: false, error: 'Falta IP' });
  const cfg = loadConfig();
  cfg.connection = { type: 'tcp', ip, port: port || 9100 };
  saveConfig(cfg);
  console.log('[Bridge] Modo TCP configurado:', ip);
  res.json({ ok: true });
});

// ── POST /print — recibir comanda del POS ─────────────────────────

app.post('/print', (req, res) => {
  const cfg = loadConfig();
  if (!cfg.connection?.printerName && cfg.connection?.type !== 'tcp') {
    return res.status(400).json({ ok: false, error: 'Impresora no configurada. Abre http://localhost:7777 en este PC.' });
  }
  const body = req.body;
  if (!body?.items?.length) return res.status(400).json({ ok: false, error: 'Sin ítems' });

  const jobId = body.jobId || `job_${Date.now()}`;
  let data;
  try { data = encodeComanda(body); }
  catch (e) { return res.status(422).json({ ok: false, error: e.message }); }

  const printerName = cfg.connection.type === 'tcp'
    ? null
    : cfg.connection.printerName;

  enqueue(data, jobId, printerName, cfg.connection);
  console.log(`[Bridge] Comanda ${jobId}: ${body.items.length} ítems`);
  res.json({ ok: true, jobId });
});

// ── POST /test ────────────────────────────────────────────────────

app.post('/test', async (req, res) => {
  const cfg = loadConfig();
  if (!cfg.connection?.printerName && cfg.connection?.type !== 'tcp') {
    return res.status(400).json({ ok: false, error: 'Primero selecciona una impresora' });
  }
  try {
    const data = encodeTest();
    if (cfg.connection.type === 'tcp') {
      const { printTCP } = require('./printer');
      await printTCP(data, cfg.connection.ip, cfg.connection.port || 9100);
    } else {
      await doPrint(data, cfg.connection.printerName);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── GET /status — para el POS ─────────────────────────────────────

app.get('/status', (req, res) => {
  const cfg = loadConfig();
  const q = getQueueStatus();
  res.json({
    ok: true,
    configured: !!(cfg.connection?.printerName || cfg.connection?.ip),
    connection: cfg.connection || null,
    queue: q,
    version: '1.0.0',
  });
});

// ── GET /printers — lista de impresoras disponibles ───────────────

app.get('/printers', async (req, res) => {
  const printers = await listPrinters();
  res.json({ ok: true, printers });
});

// ── Start ─────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nPOS QuieroComer — Puente de impresión`);
  console.log(`→ Abre http://localhost:${PORT} para configurar tu impresora\n`);

  // Abrir el navegador automáticamente
  const url = `http://localhost:${PORT}`;
  const cmd = process.platform === 'win32' ? `start ${url}` : `open ${url}`;
  exec(cmd).unref();
});

process.on('uncaughtException', (err) => {
  console.error('[Bridge] Error:', err.message);
});
