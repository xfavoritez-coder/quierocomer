// ESC/POS encoder manual — sin dependencias externas
// Impresora 80mm, 48 caracteres por línea

const ESC = 0x1b;
const GS = 0x1d;

function buf(...bytes) {
  return Buffer.from(bytes);
}

function text(str, encoding = 'latin1') {
  // Reemplazar caracteres latinos comunes
  const normalized = str
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u').replace(/[ÁÀÄ]/g, 'A')
    .replace(/[ÉÈË]/g, 'E').replace(/[ÍÌÏ]/g, 'I')
    .replace(/[ÓÒÖ]/g, 'O').replace(/[ÚÙÜ]/g, 'U')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/[""]/g, '"').replace(/['']/g, "'");
  return Buffer.from(normalized + '\n', 'ascii');
}

function textRaw(str) {
  const normalized = str
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u').replace(/[ÁÀÄ]/g, 'A')
    .replace(/[ÉÈË]/g, 'E').replace(/[ÍÌÏ]/g, 'I')
    .replace(/[ÓÒÖ]/g, 'O').replace(/[ÚÙÜ]/g, 'U')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/[""]/g, '"').replace(/['']/g, "'");
  return Buffer.from(normalized, 'ascii');
}

// ── Comandos básicos ──────────────────────────────────────────────
const CMD = {
  init:        buf(ESC, 0x40),
  alignLeft:   buf(ESC, 0x61, 0x00),
  alignCenter: buf(ESC, 0x61, 0x01),
  alignRight:  buf(ESC, 0x61, 0x02),
  boldOn:      buf(ESC, 0x45, 0x01),
  boldOff:     buf(ESC, 0x45, 0x00),
  doubleOn:    buf(GS,  0x21, 0x11),  // 2x alto y ancho
  doubleOff:   buf(GS,  0x21, 0x00),
  bigOn:       buf(GS,  0x21, 0x01),  // solo 2x alto
  bigOff:      buf(GS,  0x21, 0x00),
  lf:          buf(0x0a),
  cut:         buf(GS,  0x56, 0x42, 0x05), // corte parcial con avance
};

// ── Helpers de formato ────────────────────────────────────────────

const WIDTH = 48;

function padRight(str, len) {
  return str.substring(0, len).padEnd(len, ' ');
}

function padLeft(str, len) {
  return str.substring(0, len).padStart(len, ' ');
}

function lineColumns(left, right, width = WIDTH) {
  const maxLeft = width - right.length - 1;
  const l = left.substring(0, maxLeft).padEnd(maxLeft, ' ');
  return l + ' ' + right;
}

function separator(char = '-', width = WIDTH) {
  return char.repeat(width);
}

function wrapText(str, width = WIDTH, indent = 0) {
  const words = str.split(' ');
  const lines = [];
  let current = ' '.repeat(indent);
  for (const word of words) {
    if (current.length + word.length + 1 > width) {
      lines.push(current);
      current = ' '.repeat(indent) + word;
    } else {
      current += (current.trim() ? ' ' : '') + word;
    }
  }
  if (current.trim()) lines.push(current);
  return lines.join('\n');
}

// ── Encoder principal ─────────────────────────────────────────────

/**
 * Genera buffer ESC/POS para una comanda
 * @param {Object} comanda
 * @param {string} comanda.type - 'mesa' | 'mostrador' | 'retiro'
 * @param {string} [comanda.tableNumber] - número de mesa
 * @param {string} [comanda.customerName] - nombre cliente (retiro)
 * @param {string} [comanda.pickupTime] - hora retiro
 * @param {string} comanda.accountId - ID cuenta (últimos 4 chars)
 * @param {number} comanda.roundNumber - número de ronda
 * @param {string} comanda.sentBy - garzón
 * @param {Array}  comanda.items - ítems de la ronda
 */
function encodeComanda(comanda) {
  const parts = [];

  const now = new Date();
  const hora = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const cuenta = comanda.accountId ? '#' + comanda.accountId.slice(-4).toUpperCase() : '';

  // Título según tipo
  let titulo = '';
  if (comanda.type === 'mesa') {
    titulo = 'MESA ' + (comanda.tableNumber || '?');
  } else if (comanda.type === 'retiro') {
    titulo = 'RETIRO' + (comanda.customerName ? ' - ' + comanda.customerName.toUpperCase() : '');
  } else {
    titulo = 'MOSTRADOR';
  }

  // ── Cabecera ──
  parts.push(CMD.init);
  parts.push(CMD.alignCenter);
  parts.push(CMD.doubleOn);
  parts.push(text(titulo));
  parts.push(CMD.doubleOff);

  // Hora y hora de retiro
  let subline = hora + '  ' + cuenta;
  if (comanda.type === 'retiro' && comanda.pickupTime) {
    subline = 'Retiro: ' + comanda.pickupTime + '  ' + hora;
  }
  parts.push(CMD.boldOff);
  parts.push(text(subline));

  // Garzón y ronda
  const rondaLine = lineColumns(
    'Garzon: ' + (comanda.sentBy || 'sistema'),
    'Ronda ' + (comanda.roundNumber || 1),
    WIDTH
  );
  parts.push(CMD.alignLeft);
  parts.push(text(rondaLine));

  // Separador grueso
  parts.push(text('='.repeat(WIDTH)));

  // ── Ítems ──
  for (const item of comanda.items) {
    // Línea principal: cantidad × nombre
    const qty = item.quantity.toString();
    const nameWidth = WIDTH - qty.length - 2;
    const name = item.dish_name.toUpperCase();

    parts.push(CMD.boldOn);
    const itemLine = qty + 'x ' + name.substring(0, nameWidth);
    parts.push(text(itemLine));
    parts.push(CMD.boldOff);

    // Modificadores
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        const modLine = '  + ' + mod.name + (mod.price_adjustment > 0 ? ' (+$' + mod.price_adjustment.toLocaleString('es-CL') + ')' : '');
        parts.push(text(wrapText(modLine, WIDTH, 4)));
      }
    }

    // Nota especial
    if (item.note) {
      parts.push(CMD.boldOn);
      const noteLine = wrapText('  !! ' + item.note.toUpperCase(), WIDTH, 5);
      parts.push(text(noteLine));
      parts.push(CMD.boldOff);
    }
  }

  // Separador final
  parts.push(text('-'.repeat(WIDTH)));
  parts.push(CMD.lf);
  parts.push(CMD.lf);
  parts.push(CMD.lf);

  // Corte
  parts.push(CMD.cut);

  return Buffer.concat(parts);
}

/**
 * Genera buffer para una comanda de prueba
 */
function encodeTest() {
  return encodeComanda({
    type: 'mesa',
    tableNumber: '5',
    accountId: 'ABCD1234',
    roundNumber: 1,
    sentBy: 'garzon',
    items: [
      {
        quantity: 2,
        dish_name: 'Special Roll Salmon',
        modifiers: [{ name: 'Sin palta', price_adjustment: 0 }],
        note: null,
      },
      {
        quantity: 1,
        dish_name: 'Gyoza Vegetariana',
        modifiers: [],
        note: 'Sin salsa de soya por favor',
      },
    ],
  });
}

module.exports = { encodeComanda, encodeTest };
