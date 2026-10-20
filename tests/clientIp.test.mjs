import test from "node:test";
import assert from "node:assert/strict";
import { clientIp } from "../lib/clientIp.js";

const anfrage = (kopf) => ({ headers: new Headers(kopf) });

test("S-07: X-Real-IP von nginx gewinnt – ein gefälschtes X-Forwarded-For zählt nicht", () => {
  assert.equal(clientIp(anfrage({ "x-forwarded-for": "1.2.3.4, 203.0.113.9", "x-real-ip": "203.0.113.9" })), "203.0.113.9");
});

test("ohne X-Real-IP: der letzte, von nginx angehängte Eintrag", () => {
  assert.equal(clientIp(anfrage({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" })), "203.0.113.9");
});

test("ohne Köpfe: unbekannt", () => {
  assert.equal(clientIp(anfrage({})), "unbekannt");
});
