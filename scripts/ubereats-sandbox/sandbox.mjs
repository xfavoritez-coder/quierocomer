#!/usr/bin/env node
// ───────────────────────────────────────────────────────────
//  Utilidades del SANDBOX de Uber Eats (test store).
//  Usar SOLO en sandbox (base test-api.uber.com). Requiere en el
//  entorno (o en .env.local) UBEREATS_CLIENT_ID y UBEREATS_CLIENT_SECRET.
//
//  Uso:
//    node --env-file=.env.local scripts/ubereats-sandbox/sandbox.mjs token
//    node --env-file=.env.local scripts/ubereats-sandbox/sandbox.mjs info  <store_id>
//    node --env-file=.env.local scripts/ubereats-sandbox/sandbox.mjs open  <store_id>
//    node --env-file=.env.local scripts/ubereats-sandbox/sandbox.mjs close <store_id>
//    node --env-file=.env.local scripts/ubereats-sandbox/sandbox.mjs menu  <store_id>
//
//  ⚠️ Los endpoints/paths y el formato del menú se confirman contra la
//  respuesta real del sandbox al correrlos (la API devuelve errores de
//  validación que indican qué ajustar). Ver README.md.
// ───────────────────────────────────────────────────────────
import fs from "node:fs";

const BASE = "https://test-api.uber.com";
const TOKEN_URL = "https://sandbox-login.uber.com/oauth/v2/token";
// En sandbox los scopes se otorgan automáticamente; se puede sobreescribir con UBEREATS_SCOPES.
const SCOPES = process.env.UBEREATS_SCOPES || "eats.store eats.order";

async function getToken() {
  const id = process.env.UBEREATS_CLIENT_ID || "";
  const secret = process.env.UBEREATS_CLIENT_SECRET || "";
  if (!id || !secret) throw new Error("Faltan UBEREATS_CLIENT_ID / UBEREATS_CLIENT_SECRET en el entorno (.env.local)");
  const body = new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials", scope: SCOPES });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  const txt = await r.text();
  if (!r.ok) throw new Error(`token ${r.status}: ${txt}`);
  return JSON.parse(txt).access_token;
}

async function api(method, path, body, tk) {
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  console.log(`\n${method} ${path} → ${r.status}`);
  console.log(txt.slice(0, 4000));
  return { status: r.status, txt };
}

const [cmd, storeId] = process.argv.slice(2);
if (!cmd) {
  console.log("cmd: token | info <store_id> | open <store_id> | close <store_id> | menu <store_id>");
  process.exit(1);
}

const tk = await getToken();
if (cmd === "token") {
  console.log("Access token OK (len " + tk.length + "). Scopes:", SCOPES);
} else if (!storeId) {
  console.log("Falta <store_id>");
} else if (cmd === "info") {
  await api("GET", `/v1/delivery/stores/${storeId}`, null, tk);
} else if (cmd === "open") {
  // Deja la tienda ONLINE para que aparezca y acepte pedidos de prueba.
  await api("PATCH", `/v1/eats/stores/${storeId}/status`, { status: "ONLINE" }, tk);
} else if (cmd === "close") {
  await api("PATCH", `/v1/eats/stores/${storeId}/status`, { status: "OFFLINE" }, tk);
} else if (cmd === "menu") {
  const menu = JSON.parse(fs.readFileSync(new URL("./dummy-menu.json", import.meta.url), "utf8"));
  // Endpoint estándar de menú (v2). Si el sandbox pide otro (p.ej. POST
  // /v1/delivery/stores/{id}/menus), cambiar aquí según el error que devuelva.
  await api("PUT", `/v2/eats/stores/${storeId}/menus`, menu, tk);
}
