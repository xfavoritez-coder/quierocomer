// POS QuieroComer — Puente de impresión ESC/POS
// Expone HTTP local en el puerto 7777
// POST /print   → imprime una comanda
// POST /test    → imprime una comanda de prueba
// GET  /status  → estado del puente e impresora
// DELETE /queue/:jobId → cancela un trabajo pendiente

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ── Config ────────────────────────────────────────────────────────

const configPath = path.join(__dirname, '..', 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('ERROR: config.json no encontrado en', configPath);
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const PORT = config.port || 7777;

// ── Módulos ───────────────────────────────────────────────────────

const printer = require('./printer');
const queue   = require('./queue');
const { encodeComanda, encodeTest } = require('./encoder');

printer.init(config);

// ── App ───────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: config.cors_origin || '*' }));

// ── POST /print ───────────────────────────────────────────────────
// Body: {
//   jobId: string,         // ID único (usar round_id del POS)
//   type: 'mesa'|'mostrador'|'retiro',
//   tableNumber?: string,
//   customerName?: string,
//   pickupTime?: string,
//   accountId: string,
//   roundNumber: number,
//   sentBy: string,
//   items: [{
//     quantity: number,
//     dish_name: string,
//     modifiers: [{name, price_adjustment}],
//     note?: string
//   }]
// }

app.post('/print', (req, res) => {
  const body = req.body;

  if (!body || !body.items || !Array.isArray(body.items)) {
    return res.status(400).json({ error: 'Body inválido: falta items[]' });
  }

  const jobId = body.jobId || `job_${Date.now()}`;

  let data;
  try {
    data = encodeComanda(body);
  } catch (err) {
    return res.status(422).json({ error: 'Error al codificar comanda: ' + err.message });
  }

  queue.enqueue(data, jobId);
  console.log(`[Bridge] Comanda recibida: ${jobId} (${body.items.length} items, tipo: ${body.type})`);

  res.json({ ok: true, jobId, queued: queue.getStatus().pending });
});

// ── POST /test ────────────────────────────────────────────────────

app.post('/test', (req, res) => {
  const jobId = `test_${Date.now()}`;
  const data = encodeTest();
  queue.enqueue(data, jobId);
  console.log('[Bridge] Comanda de prueba enviada:', jobId);
  res.json({ ok: true, jobId, message: 'Comanda de prueba en cola' });
});

// ── GET /status ───────────────────────────────────────────────────

app.get('/status', async (req, res) => {
  try {
    const printerStatus = await printer.getStatus();
    const queueStatus = queue.getStatus();
    res.json({
      ok: true,
      bridge: { version: '1.0.0', port: PORT },
      printer: printerStatus,
      queue: queueStatus,
      config: {
        connection: config.connection,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DELETE /queue/:jobId ──────────────────────────────────────────

app.delete('/queue/:jobId', (req, res) => {
  const removed = queue.remove(req.params.jobId);
  res.json({ ok: removed, message: removed ? 'Trabajo cancelado' : 'No encontrado o en proceso' });
});

// ── Start ─────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   POS QuieroComer — Print Bridge     ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║   Puerto: ${PORT}                        ║`);
  console.log(`║   Modo:   ${(config.connection.type + '                    ').substring(0, 24)}║`);
  if (config.connection.type === 'usb') {
    console.log(`║   Impresora: ${(config.connection.printerName + '               ').substring(0, 20)}║`);
  } else {
    console.log(`║   IP: ${(config.connection.ip + ':' + (config.connection.port||9100) + '                   ').substring(0, 27)}║`);
  }
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('Listo. Esperando comandas del POS...');
  console.log(`Estado: http://localhost:${PORT}/status`);
  console.log('');
});

process.on('uncaughtException', (err) => {
  console.error('[Bridge] Error no capturado:', err.message);
});
