/** Remitente formateado para todos los correos de QuieroComer. */
export const FROM_QC = process.env.FROM_EMAIL
  ? `QuieroComer <${process.env.FROM_EMAIL}>`
  : "QuieroComer <hola@quierocomer.cl>";
