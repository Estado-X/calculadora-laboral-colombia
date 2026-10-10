// Pruebas del motor de cálculo. Correr con: node --test pruebas/
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../assets/calculo.js");

const P = C.PARAMETROS_2026;
const OP = { claseRiesgo: 1, retencion: true, exonerado: true };
const cerca = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test("Ejemplo de la UGPP: honorario de $5.000.000, riesgo I", () => {
  const r = C.prestacionServicios(5000000, P, OP);
  assert.equal(r.ibc, 2000000);
  cerca(r.aportes.salud, 250000);
  cerca(r.aportes.pension, 320000);
  cerca(r.aportes.arl, 10440);
  cerca(r.aportes.mes, 580440);
});

test("IBC del independiente nunca baja de un salario mínimo ni pasa de 25", () => {
  assert.equal(C.prestacionServicios(2000000, P, OP).ibc, P.smmlv);
  assert.equal(C.prestacionServicios(500000000, P, OP).ibc, 25 * P.smmlv);
});

test("Tabla del art. 383", () => {
  assert.equal(C.retencionUVT(95), 0);
  cerca(C.retencionUVT(150), 55 * 0.19, 1e-9);
  cerca(C.retencionUVT(360), 210 * 0.28 + 10, 1e-9);
  cerca(C.retencionUVT(640), 280 * 0.33 + 69, 1e-9);
  cerca(C.retencionUVT(945), 305 * 0.35 + 162, 1e-9);
  cerca(C.retencionUVT(2300), 1355 * 0.37 + 268, 1e-9);
  cerca(C.retencionUVT(2400), 100 * 0.39 + 770, 1e-9);
});

test("Los saltos entre rangos son los de la tabla oficial (menos de 1 UVT)", () => {
  // La tabla de la ley redondea el impuesto acumulado de cada rango (p. ej. 10 UVT en vez de 10,45).
  for (const b of [150, 360, 640, 945, 2300]) cerca(C.retencionUVT(b), C.retencionUVT(b + 1e-9), 1);
});

test("Solidaridad pensional desde 4 salarios mínimos", () => {
  assert.equal(C.tasaSolidaridad(3.99 * P.smmlv, P.smmlv), 0);
  assert.equal(C.tasaSolidaridad(4 * P.smmlv, P.smmlv), 0.01);
  assert.equal(C.tasaSolidaridad(16.5 * P.smmlv, P.smmlv), 0.012);
  assert.equal(C.tasaSolidaridad(21 * P.smmlv, P.smmlv), 0.02);
});

test("Salario mínimo: auxilio de transporte, prestaciones y sin retención", () => {
  const r = C.contratoLaboral(P.smmlv, P, OP);
  assert.equal(r.auxilio, P.auxilioTransporte);
  assert.equal(r.prestaciones.prima, P.smmlv + P.auxilioTransporte);
  cerca(r.prestaciones.intereses, (P.smmlv + P.auxilioTransporte) * 0.12);
  assert.equal(r.retencion, 0);
  cerca(r.trabajador.aportesMes, P.smmlv * 0.08);
});

test("Sin auxilio de transporte por encima de 2 salarios mínimos", () => {
  assert.equal(C.contratoLaboral(2 * P.smmlv + 1, P, OP).auxilio, 0);
});

test("Exoneración del art. 114-1 solo por debajo de 10 salarios mínimos", () => {
  assert.equal(C.contratoLaboral(9 * P.smmlv, P, OP).empleador.salud, 0);
  assert.ok(C.contratoLaboral(10 * P.smmlv, P, OP).empleador.salud > 0);
  assert.ok(C.contratoLaboral(3 * P.smmlv, P, { ...OP, exonerado: false }).empleador.salud > 0);
});

test("ARL de riesgo IV la paga el contratante", () => {
  const r = C.prestacionServicios(5000000, P, { ...OP, claseRiesgo: 4 });
  assert.equal(r.aportes.arlPagaContratista, false);
  cerca(r.costoAnio, 12 * 5000000 + 12 * 2000000 * 0.0435);
});

test("La equivalencia iguala el neto (a mil pesos)", () => {
  for (const s of [P.smmlv, 3000000, 6000000, 15000000]) {
    const h = C.honorarioEquivalente(s, P, OP);
    const a = C.contratoLaboral(s, P, OP).netoAnio;
    const b = C.prestacionServicios(h, P, OP).netoAnio;
    assert.ok(Math.abs(a - b) < 12 * 1000, `salario ${s}: ${a} vs ${b}`);
    assert.ok(h > s, "el honorario equivalente debe ser mayor que el salario");
  }
});

test("Retención apagada da cero", () => {
  const op = { ...OP, retencion: false };
  assert.equal(C.contratoLaboral(20000000, P, op).retencion, 0);
  assert.equal(C.prestacionServicios(20000000, P, op).retencion, 0);
});

test("Caja, ICBF y SENA sin el tope de 25 mínimos; salud y pensión con tope", () => {
  const s = 30 * P.smmlv;
  const r = C.contratoLaboral(s, P, OP);
  cerca(r.empleador.caja, s * 0.04);
  cerca(r.empleador.icbf + r.empleador.sena, s * 0.05); // no exonerado por pasar de 10 mínimos
  cerca(r.empleador.pension, 25 * P.smmlv * 0.12);
});
