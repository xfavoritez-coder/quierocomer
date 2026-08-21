// Cola de impresión con reintentos exponenciales
// In-memory (se pierde al reiniciar el bridge, intencional para v1)

const printer = require('./printer');

const _queue = [];
let _processing = false;

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 3000;

/**
 * Agrega un trabajo a la cola y procesa
 * @param {Buffer} data - buffer ESC/POS listo para imprimir
 * @param {string} jobId - ID único del trabajo
 */
function enqueue(data, jobId) {
  _queue.push({ data, jobId, retries: 0, addedAt: new Date() });
  processNext();
}

function processNext() {
  if (_processing || _queue.length === 0) return;
  _processing = true;
  const job = _queue[0];

  printer.print(job.data)
    .then(() => {
      console.log(`[Queue] OK: ${job.jobId}`);
      _queue.shift();
      _processing = false;
      processNext();
    })
    .catch((err) => {
      job.retries++;
      console.error(`[Queue] Error en ${job.jobId} (intento ${job.retries}/${MAX_RETRIES}):`, err.message);

      if (job.retries >= MAX_RETRIES) {
        console.error(`[Queue] Descartando ${job.jobId} tras ${MAX_RETRIES} intentos`);
        _queue.shift();
        _processing = false;
        processNext();
        return;
      }

      const delay = BASE_DELAY_MS * Math.pow(2, job.retries - 1);
      console.log(`[Queue] Reintentando ${job.jobId} en ${delay}ms...`);
      setTimeout(() => {
        _processing = false;
        processNext();
      }, delay);
    });
}

function getStatus() {
  return {
    pending: _queue.length,
    jobs: _queue.map(j => ({
      jobId: j.jobId,
      retries: j.retries,
      addedAt: j.addedAt,
    })),
  };
}

function remove(jobId) {
  const idx = _queue.findIndex(j => j.jobId === jobId);
  if (idx > 0) { // no remover el que está procesándose (idx 0)
    _queue.splice(idx, 1);
    return true;
  }
  return false;
}

module.exports = { enqueue, getStatus, remove };
