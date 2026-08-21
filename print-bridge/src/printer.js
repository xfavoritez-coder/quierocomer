// Abstracción de conexión: USB (Windows via PowerShell RAW) o TCP (red/Ethernet)
// Ambos modos devuelven Promise<void>

const net    = require('net');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const { execFile, execFileSync } = require('child_process');

let _config = null;

// Ruta al script PowerShell (junto a este archivo en dev, o en el exe empaquetado)
const PS_SCRIPT = path.join(__dirname, '..', 'raw-print.ps1');

function init(config) {
  _config = config;
}

// ── TCP ───────────────────────────────────────────────────────────

function printTCP(data) {
  const { ip, port = 9100 } = _config.connection;
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ip, port }, () => {
      socket.write(data, (err) => {
        if (err) { socket.destroy(); return reject(err); }
        socket.end();
        resolve();
      });
    });
    socket.on('error', (err) => { socket.destroy(); reject(err); });
    socket.setTimeout(8000, () => {
      socket.destroy();
      reject(new Error('Timeout conectando a impresora TCP'));
    });
  });
}

// ── USB / Windows (PowerShell RAW) ────────────────────────────────
// Sin módulos nativos: escribe bytes a archivo temporal y llama
// powershell.exe con raw-print.ps1 que usa la Win32 Printing API.

function printUSB(data) {
  const { printerName } = _config.connection;

  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `pos_${Date.now()}.bin`);

    try {
      fs.writeFileSync(tmpFile, data);
    } catch (e) {
      return reject(new Error('No se pudo escribir archivo temporal: ' + e.message));
    }

    const psArgs = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', PS_SCRIPT,
      tmpFile,
      printerName,
    ];

    execFile('powershell.exe', psArgs, { timeout: 10000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(tmpFile); } catch {}

      if (err) {
        const msg = stderr?.trim() || err.message;
        return reject(new Error(`Error de impresión USB: ${msg}`));
      }

      const out = stdout?.trim() || '';
      if (out.startsWith('OK')) {
        resolve();
      } else {
        reject(new Error(`PowerShell no devolvió OK: ${out} ${stderr?.trim()}`));
      }
    });
  });
}

// ── Estado de la impresora ────────────────────────────────────────

async function getStatus() {
  const { type } = _config.connection;

  if (type === 'tcp') {
    const { ip, port = 9100 } = _config.connection;
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: ip, port }, () => {
        socket.destroy();
        resolve({ ok: true, mode: 'tcp', ip, port });
      });
      socket.on('error', (err) => {
        resolve({ ok: false, mode: 'tcp', ip, port, error: err.message });
      });
      socket.setTimeout(3000, () => {
        socket.destroy();
        resolve({ ok: false, mode: 'tcp', ip, port, error: 'Timeout' });
      });
    });
  }

  // USB: verificar que la impresora existe usando PowerShell
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command',
       `Get-Printer | Select-Object -ExpandProperty Name`],
      { timeout: 5000 },
      (err, stdout) => {
        if (err) {
          return resolve({ ok: true, mode: 'usb', printerName: _config.connection.printerName, note: 'No se pudo listar impresoras' });
        }
        const printers = stdout.trim().split('\n').map(s => s.trim()).filter(Boolean);
        const found = printers.some(p => p === _config.connection.printerName);
        if (found) {
          resolve({ ok: true, mode: 'usb', printerName: _config.connection.printerName });
        } else {
          resolve({
            ok: false,
            mode: 'usb',
            error: `Impresora "${_config.connection.printerName}" no encontrada`,
            availablePrinters: printers,
          });
        }
      }
    );
  });
}

// ── Print (entry point) ───────────────────────────────────────────

function print(data) {
  const { type } = _config.connection;
  if (type === 'tcp') return printTCP(data);
  return printUSB(data);
}

module.exports = { init, print, getStatus };
