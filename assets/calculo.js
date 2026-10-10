/* Calculadora laboral Colombia · motor de cálculo.
   Compara un contrato laboral con un contrato de prestación de servicios.
   Todo se calcula en el navegador; nada se envía a ningún servidor.
   Las reglas y sus fuentes están en el README (sección «Cómo se calcula»). */
(function (raiz) {
  "use strict";

  // Valores de 2026. Se actualizan cada enero (ver README, «Úsalo o adáptalo»).
  const PARAMETROS_2026 = {
    anio: 2026,
    smmlv: 1750905,          // Decreto 1469 de 2025
    auxilioTransporte: 249095, // Decreto 1470 de 2025
    uvt: 52374,              // Resolución DIAN 000238 de 2025
  };

  // Riesgos laborales (ARL) por clase de riesgo, Decreto 1295 de 1994 y Decreto 1072 de 2015.
  const ARL = { 1: 0.00522, 2: 0.01044, 3: 0.02436, 4: 0.0435, 5: 0.0696 };

  // Fondo de Solidaridad Pensional según el IBC en salarios mínimos
  // (art. 27 de la Ley 100 de 1993, modificado por la Ley 797 de 2003; Decreto 510 de 2003).
  function tasaSolidaridad(ibc, smmlv) {
    const n = ibc / smmlv;
    if (n < 4) return 0;
    if (n < 16) return 0.01;
    if (n <= 17) return 0.012;
    if (n <= 18) return 0.014;
    if (n <= 19) return 0.016;
    if (n <= 20) return 0.018;
    return 0.02;
  }

  // Tabla de retención del art. 383 del Estatuto Tributario, en UVT.
  function retencionUVT(baseUVT) {
    const b = baseUVT;
    if (b <= 95) return 0;
    if (b <= 150) return (b - 95) * 0.19;
    if (b <= 360) return (b - 150) * 0.28 + 10;
    if (b <= 640) return (b - 360) * 0.33 + 69;
    if (b <= 945) return (b - 640) * 0.35 + 162;
    if (b <= 2300) return (b - 945) * 0.37 + 268;
    return (b - 2300) * 0.39 + 770;
  }

  // Retención mensual en pesos para un ingreso de trabajo del mes.
  // ingreso: pagos gravables del mes; aportes: aportes obligatorios a salud y pensión (se restan).
  // Renta exenta del 25 % (art. 206 num. 10), con tope de 790 UVT al año (65,83 al mes).
  function retencionMensual(ingreso, aportes, uvt) {
    const neto = Math.max(0, ingreso - aportes);
    const exenta = Math.min(neto * 0.25, (790 / 12) * uvt, neto * 0.4, (1340 / 12) * uvt);
    const base = neto - exenta;
    return Math.round(retencionUVT(base / uvt) * uvt);
  }

  function acotarIBC(ibc, smmlv) {
    return Math.min(Math.max(ibc, smmlv), 25 * smmlv);
  }

  /* Contrato laboral (trabajador dependiente).
     opciones: { claseRiesgo, retencion (bool), exonerado (bool) } */
  function contratoLaboral(salario, p, op) {
    const smmlv = p.smmlv;
    const conAuxilio = salario <= 2 * smmlv;
    const auxilio = conAuxilio ? p.auxilioTransporte : 0;
    const ibc = acotarIBC(salario, smmlv);
    const fsp = tasaSolidaridad(ibc, smmlv);

    // Lo que el trabajador aporta cada mes
    const saludT = ibc * 0.04;
    const pensionT = ibc * 0.04;
    const solidaridadT = ibc * fsp;
    const aportesT = saludT + pensionT + solidaridadT;

    // Prestaciones sociales al año (la base de prima y cesantías incluye el auxilio de transporte)
    const prima = salario + auxilio;            // art. 306 CST: un mes por año, en dos pagos
    const cesantias = salario + auxilio;        // art. 249 CST: un mes por año
    const intereses = cesantias * 0.12;         // Ley 52 de 1975: 12 % anual
    const vacacionesDias = 15;                  // art. 186 CST: 15 días hábiles pagados

    // Retención en la fuente (la hace el empleador). Doce meses de salario y dos pagos de prima.
    // Cesantías e intereses se tratan como exentos (art. 206 num. 4; ver «Límites»).
    let retencion = 0;
    if (op.retencion) {
      const mes = retencionMensual(salario, aportesT, p.uvt);
      const mesConPrima = retencionMensual(salario + prima / 2, aportesT, p.uvt);
      retencion = 12 * mes + 2 * (mesConPrima - mes);
    }

    const ingresosAnio = 12 * (salario + auxilio) + prima + cesantias + intereses;
    const descuentosAnio = 12 * aportesT + retencion;
    const netoAnio = ingresosAnio - descuentosAnio;

    // Lo que paga el empleador
    const exonerado = op.exonerado && salario < 10 * smmlv; // art. 114-1 del Estatuto Tributario
    const saludE = exonerado ? 0 : ibc * 0.085;
    const pensionE = ibc * 0.12;
    const arlE = ibc * ARL[op.claseRiesgo];
    // Caja, ICBF y SENA se liquidan sobre la nómina completa, sin el tope de 25 mínimos (Ley 21 de 1982, art. 17)
    const caja = salario * 0.04;
    const icbf = exonerado ? 0 : salario * 0.03;
    const sena = exonerado ? 0 : salario * 0.02;
    const aportesE = saludE + pensionE + arlE + caja + icbf + sena;
    const costoAnio = 12 * (salario + auxilio) + prima + cesantias + intereses + 12 * aportesE;

    return {
      tipo: "contrato",
      salario, auxilio, conAuxilio, ibc, tasaSolidaridad: fsp,
      trabajador: { salud: saludT, pension: pensionT, solidaridad: solidaridadT, aportesMes: aportesT },
      prestaciones: { prima, cesantias, intereses, vacacionesDias },
      retencion, ingresosAnio, descuentosAnio, netoAnio,
      ahorroPensionAnio: 12 * (ibc * 0.16), // 4 % del trabajador + 12 % del empleador
      empleador: { exonerado, salud: saludE, pension: pensionE, arl: arlE, caja, icbf, sena, aportesMes: aportesE },
      costoAnio,
      salarioIntegralPosible: salario >= 13 * smmlv,
      bajoMinimo: salario < smmlv,
    };
  }

  /* Contrato de prestación de servicios (independiente).
     IBC: 40 % del valor mensual sin IVA (art. 89 de la Ley 2277 de 2022), mínimo 1 y máximo 25 salarios mínimos.
     En prestación de servicios no se restan costos ni gastos (UGPP). */
  function prestacionServicios(honorario, p, op) {
    const smmlv = p.smmlv;
    const ibc = acotarIBC(honorario * 0.4, smmlv);
    const fsp = tasaSolidaridad(ibc, smmlv);
    const salud = ibc * 0.125;
    const pension = ibc * 0.16;
    const solidaridad = ibc * fsp;
    // ARL: la paga el contratista en riesgos I a III; el contratante en IV y V (Decreto 723 de 2013).
    const tasaArl = ARL[op.claseRiesgo];
    const arlPagaContratista = op.claseRiesgo <= 3;
    const arl = ibc * tasaArl;
    const aportesMes = salud + pension + solidaridad + (arlPagaContratista ? arl : 0);

    // Retención: art. 383 par. 2 (se restan los aportes obligatorios a salud y pensión).
    let retencion = 0;
    if (op.retencion) retencion = 12 * retencionMensual(honorario, salud + pension + solidaridad, p.uvt);

    const ingresosAnio = 12 * honorario;
    const descuentosAnio = 12 * aportesMes + retencion;
    const netoAnio = ingresosAnio - descuentosAnio;
    const costoAnio = 12 * honorario + (arlPagaContratista ? 0 : 12 * arl);

    return {
      tipo: "prestacion",
      honorario, ibc, tasaSolidaridad: fsp,
      aportes: { salud, pension, solidaridad, arl, arlPagaContratista, mes: aportesMes },
      retencion, ingresosAnio, descuentosAnio, netoAnio,
      ahorroPensionAnio: 12 * pension,
      costoAnio,
      ibcEnMinimo: honorario * 0.4 < smmlv,
    };
  }

  // Busca el valor mensual de una figura que iguala una meta (neto o costo) de la otra.
  function buscar(f, meta, max) {
    let lo = 0, hi = max;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) < meta) lo = mid; else hi = mid;
    }
    return Math.round(hi / 1000) * 1000; // a miles de pesos
  }

  // Honorario mensual que deja el mismo neto al año que un salario dado
  function honorarioEquivalente(salario, p, op) {
    const meta = contratoLaboral(salario, p, op).netoAnio;
    return buscar(h => prestacionServicios(h, p, op).netoAnio, meta, salario * 4 + p.smmlv * 4);
  }
  // Salario mensual que deja el mismo neto al año que un honorario dado
  function salarioEquivalente(honorario, p, op) {
    const meta = prestacionServicios(honorario, p, op).netoAnio;
    return buscar(s => contratoLaboral(s, p, op).netoAnio, meta, honorario * 2 + p.smmlv * 2);
  }
  // Honorario mensual que cuesta al año lo mismo que un contrato laboral
  function honorarioMismoCosto(salario, p, op) {
    const meta = contratoLaboral(salario, p, op).costoAnio;
    return buscar(h => prestacionServicios(h, p, op).costoAnio, meta, salario * 4 + p.smmlv * 4);
  }
  // Salario mensual que cuesta al año lo mismo que un honorario
  function salarioMismoCosto(honorario, p, op) {
    const meta = prestacionServicios(honorario, p, op).costoAnio;
    return buscar(s => contratoLaboral(s, p, op).costoAnio, meta, honorario * 2 + p.smmlv * 2);
  }

  const API = {
    PARAMETROS_2026, ARL, tasaSolidaridad, retencionUVT, retencionMensual,
    contratoLaboral, prestacionServicios,
    honorarioEquivalente, salarioEquivalente, honorarioMismoCosto, salarioMismoCosto,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else raiz.Calculo = API;
})(typeof window !== "undefined" ? window : globalThis);
