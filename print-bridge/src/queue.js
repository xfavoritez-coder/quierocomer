// Cola de impresión con reintentos exponenciales
const net = require('net');
const fs  = require('fs');
const os  = require('os');
const path = require('path');
const { execFile } = require('child_process');

const PS_SCRIPT = path.join(__dirname, '..', 'raw-print.ps1');
const MAX_RETRIES  = 5;
const BASE_DELAY   = 3000;

const _queue = [];
let   _busy  = false;

function enqueue(data, jobId, printerName, connection) {
  _queue.push({ data, jobId, printerName, connection, retries: 0, addedAt: new Date() });
  process();
}

function process() {
  if (_busy || _queue.length === 0) return;
  _busy = true;
  const job = _queue[0];

  printJob(job)
    .then(() => {
      console.log(`[Queue] OK: ${job.jobId}`);
      _queue.shift();
      _busy = false;
      process();
    })
    .catch((err) => {
      job.retries++;
      console.error(`[Queue] Error ${job.jobId} (intento ${job.retries}/${MAX_RETRIES}): ${err.message}`);
      if (job.retries >= MAX_RETRIES) {
        console.error(`[Queue] Descartando ${job.jobId}`);
        _queue.shift();
        _busy = false;
        process();
      } else {
        const delay = BASE_DELAY * Math.pow(2, job.retries - 1);
        setTimeout(() => { _busy = false; process(); }, delay);
      }
    });
}

function printJob(job) {
  const { connection, data, printerName } = job;
  if (connection?.type === 'tcp') {
    return printTCP(data, connection.ip, connection.port || 9100);
  }
  return printUSB(data, printerName);
}

function printUSB(data, printerName) {
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
        if ((stdout || '').trim().startsWith('OK')) resolve();
        else reject(new Error(stderr?.trim() || 'Error desconocido'));
      }
    );
  });
}

function printTCP(data, ip, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ip, port }, () => {
      socket.write(data, (err) => {
        if (err) { socket.destroy(); return reject(err); }
        socket.end(); resolve();
      });
    });
    socket.on('error', (err) => { socket.destroy(); reject(err); });
    socket.setTimeout(8000, () => { socket.destroy(); reject(new Error('Timeout TCP')); });
  });
}

function getQueueStatus() {
  return { pending: _queue.length };
}

module.exports = { enqueue, printTCP, getQueueStatus };
