/* Calculadora laboral Colombia · interfaz. Usa window.Calculo (assets/calculo.js). */
(function () {
  "use strict";
  const C = window.Calculo;
  const $ = (id) => document.getElementById(id);

  // ---------- Formato colombiano ----------
  function miles(n) {
    const s = String(Math.round(Math.abs(n)));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  const pesos = (n) => (n < 0 ? "−$" : "$") + miles(n);
  const pct = (x, dec = 1) => (x * 100).toFixed(dec).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "").replace(".", ",") + " %";
  const leer = (el) => {
    const d = String(el.value || "").replace(/[^\d]/g, "");
    return d ? parseInt(d, 10) : 0;
  };
  const escribir = (el, n) => { el.value = n ? miles(n) : ""; };

  // ---------- Estado ----------
  let mirada = "persona";
  const P0 = C.PARAMETROS_2026;

  function parametros() {
    return {
      anio: P0.anio,
      smmlv: leer($("p-smmlv")) || P0.smmlv,
      auxilioTransporte: leer($("p-aux")) || 0,
      uvt: leer($("p-uvt")) || P0.uvt,
    };
  }
  function opciones() {
    return {
      claseRiesgo: parseInt($("riesgo").value, 10),
      retencion: $("retencion").checked,
      exonerado: $("exonerado").checked,
    };
  }

  // ---------- Piezas de la vista ----------
  function fila(texto, valor, { sub = "", signo = "+", clase = "" } = {}) {
    const cl = clase || (signo === "−" ? "menos" : "");
    const v = signo === "−" && Math.round(valor) !== 0 ? "−" + pesos(valor) : pesos(valor);
    return `<tr class="${cl}"><td>${texto}${sub ? `<span class="sub">${sub}</span>` : ""}</td><td class="n">${v}</td></tr>`;
  }
  function extras(items) {
    return items.filter(Boolean).map(([tipo, t]) => `<li class="${tipo}">${t}</li>`).join("");
  }
  function barra(nombre, segmentos, max) {
    const partes = segmentos.map(([v, color, etq]) =>
      `<i style="width:${Math.max(0, (v / max) * 100).toFixed(2)}%;background:${color}" title="${etq}: ${pesos(v)}"></i>`).join("");
    return `<div class="barra"><span class="barra__nombre">${nombre}</span><div class="barra__pista">${partes}</div></div>`;
  }
  const COL = { oliva: "#73704f", tierra: "#ca8248", vino: "#603338" };
  function leyenda(items) {
    return `<div class="leyenda">${items.map(([c, t]) => `<span><b style="background:${c}"></b>${t}</span>`).join("")}</div>`;
  }

  // ---------- Render ----------
  function render() {
    const p = parametros();
    const op = opciones();
    const s = leer($("salario"));
    const h = leer($("honorario"));
    document.querySelectorAll("[data-anio]").forEach((e) => (e.textContent = p.anio));

    if (!s || !h) {
      $("v-cifra").textContent = "…";
      $("v-per").textContent = "";
      $("v-texto").textContent = "Escribe el salario y el honorario para hacer la cuenta.";
      ["barras", "c-tabla", "p-tabla", "c-extras", "p-extras", "equiv-texto", "c-mes", "p-mes", "c-total-etq", "p-total-etq"].forEach((id) => ($(id).innerHTML = ""));
      $("c-total").textContent = "…";
      $("p-total").textContent = "…";
      return;
    }
    const c = C.contratoLaboral(s, p, op);
    const ps = C.prestacionServicios(h, p, op);

    // Ayudas de los campos
    const aS = $("ayuda-salario");
    aS.classList.toggle("alerta", c.bajoMinimo);
    aS.textContent = c.bajoMinimo
      ? `Es menos que el salario mínimo (${pesos(p.smmlv)}). Un contrato laboral de tiempo completo no puede pagar menos.`
      : c.conAuxilio ? `Con auxilio de transporte de ${pesos(c.auxilio)} al mes.` : "Sin auxilio de transporte (más de dos mínimos).";
    $("ayuda-honorario").textContent = ps.ibcEnMinimo
      ? `Cotiza sobre un salario mínimo (${pesos(p.smmlv)}), porque el 40 % es menor.`
      : `Cotiza sobre ${pesos(ps.ibc)} al mes (el 40 %).`;

    if (mirada === "persona") renderPersona(c, ps, s, h, p, op);
    else renderEmpresa(c, ps, s, h, p, op);

    try { history.replaceState(null, "", `#mirada=${mirada}&salario=${s}&honorario=${h}`); } catch (e) { /* sin efecto */ }
  }

  function renderPersona(c, ps, s, h, p, op) {
    const dif = ps.netoAnio - c.netoAnio;
    const rel = c.netoAnio ? Math.abs(dif) / c.netoAnio : 0;
    $("v-etq").textContent = "Diferencia al año en tu bolsillo";
    $("v-cifra").textContent = (dif < 0 ? "−" : "+") + pesos(Math.abs(dif)).replace("−", "");
    $("v-per").textContent = `unos ${pesos(Math.abs(dif) / 12)} ${dif < 0 ? "menos" : "más"} al mes`;
    $("v-texto").innerHTML = Math.abs(dif) < 12000
      ? "Las dos opciones te dejan prácticamente lo mismo al año."
      : `Con prestación de servicios te quedan <strong>${pesos(Math.abs(dif))} ${dif < 0 ? "menos" : "más"}</strong> al año que con el contrato laboral${rel <= 1 ? ` (${pct(rel, 0)} ${dif < 0 ? "menos" : "más"})` : ""}.` + (ps.netoAnio <= 0 ? " Con este honorario, los aportes se comen todo el ingreso." : "");

    $("ayuda-comparacion").textContent = "Lo que recibes en el año y lo que se descuenta. Las cesantías cuentan como tuyas aunque van a un fondo; el ahorro para pensión se muestra aparte.";

    // Barras
    const max = Math.max(c.ingresosAnio, ps.ingresosAnio);
    const apC = 12 * c.trabajador.aportesMes, apP = 12 * ps.aportes.mes;
    $("barras").innerHTML =
      barra("Contrato laboral", [[c.netoAnio, COL.oliva, "Te queda"], [apC, COL.tierra, "Aportes"], [c.retencion, COL.vino, "Retención"]], max) +
      barra("Prestación de servicios", [[ps.netoAnio, COL.oliva, "Te queda"], [apP, COL.tierra, "Aportes"], [ps.retencion, COL.vino, "Retención"]], max) +
      leyenda([[COL.oliva, "Te queda"], [COL.tierra, "Aportes a salud, pensión y ARL"], [COL.vino, "Retención en la fuente"]]);

    // Contrato laboral
    $("c-total").textContent = pesos(c.netoAnio);
    $("c-total-etq").textContent = "te quedan al año";
    $("c-mes").textContent = `Unos ${pesos(c.netoAnio / 12)} al mes en promedio`;
    $("c-tabla").innerHTML =
      fila("Salario", 12 * s, { sub: `12 meses de ${pesos(s)}` }) +
      (c.auxilio ? fila("Auxilio de transporte", 12 * c.auxilio, { sub: `12 meses de ${pesos(c.auxilio)}` }) : "") +
      fila("Prima de servicios", c.prestaciones.prima, { sub: "Un mes al año, en junio y diciembre" }) +
      fila("Cesantías", c.prestaciones.cesantias, { sub: "Un mes al año; van a tu fondo de cesantías" }) +
      fila("Intereses sobre cesantías", c.prestaciones.intereses, { sub: "12 % al año, se pagan en enero" }) +
      fila("Salud", 12 * c.trabajador.salud, { sub: "4 % del salario", signo: "−" }) +
      fila("Pensión", 12 * c.trabajador.pension, { sub: "4 % del salario", signo: "−" }) +
      (c.trabajador.solidaridad ? fila("Fondo de Solidaridad Pensional", 12 * c.trabajador.solidaridad, { sub: pct(c.tasaSolidaridad), signo: "−" }) : "") +
      (op.retencion ? fila("Retención en la fuente", c.retencion, { sub: c.retencion ? "La descuenta el empleador" : "Con este salario no hay retención", signo: "−" }) : "") +
      fila("Te queda al año", c.netoAnio, { clase: "total" });
    $("c-extras").innerHTML = extras([
      ["bien", "15 días hábiles de vacaciones pagadas al año."],
      ["bien", `Quien te contrata paga tu salud, tu ARL y el 12 % de tu pensión. Tu ahorro para pensión es de ${pesos(c.ahorroPensionAnio)} al año.`],
      c.salarioIntegralPosible && ["ojo", "Con este salario se puede pactar salario integral, que no está en esta cuenta."],
    ]);

    // Prestación de servicios
    $("p-total").textContent = pesos(ps.netoAnio);
    $("p-total-etq").textContent = "te quedan al año";
    $("p-mes").textContent = `Unos ${pesos(ps.netoAnio / 12)} al mes en promedio`;
    $("p-tabla").innerHTML =
      fila("Honorarios", 12 * h, { sub: `12 meses de ${pesos(h)}` }) +
      fila("Salud", 12 * ps.aportes.salud, { sub: `12,5 % sobre ${pesos(ps.ibc)}`, signo: "−" }) +
      fila("Pensión", 12 * ps.aportes.pension, { sub: `16 % sobre ${pesos(ps.ibc)}`, signo: "−" }) +
      (ps.aportes.solidaridad ? fila("Fondo de Solidaridad Pensional", 12 * ps.aportes.solidaridad, { sub: pct(ps.tasaSolidaridad), signo: "−" }) : "") +
      (ps.aportes.arlPagaContratista ? fila("Riesgos laborales (ARL)", 12 * ps.aportes.arl, { sub: `Clase ${op.claseRiesgo}: ${pct(C.ARL[op.claseRiesgo], 3)}`, signo: "−" }) : "") +
      (op.retencion ? fila("Retención en la fuente", ps.retencion, { sub: ps.retencion ? "La descuenta quien te paga" : "Con este honorario no hay retención", signo: "−" }) : "") +
      fila("Te queda al año", ps.netoAnio, { clase: "total" });
    $("p-extras").innerHTML = extras([
      ["ojo", "Sin prima, cesantías ni vacaciones pagadas: si descansas, no facturas."],
      ["ojo", `Tú pagas toda la salud y la pensión en la planilla PILA, mes vencido. Tu ahorro para pensión es de ${pesos(ps.ahorroPensionAnio)} al año.`],
      !ps.aportes.arlPagaContratista && ["bien", "En riesgo IV o V, la ARL la paga quien contrata."],
    ]);

    // Equivalencia
    const heq = C.honorarioEquivalente(s, p, op);
    const seq = C.salarioEquivalente(h, p, op);
    $("equiv-texto").innerHTML =
      `Para que la prestación de servicios te deje lo mismo que un salario de ${pesos(s)}, el honorario debe ser de al menos <strong>${pesos(heq)} al mes</strong>, un ${pct(heq / s - 1, 0)} más. ` +
      (seq > 0 && !C.contratoLaboral(seq, p, op).bajoMinimo
        ? `Visto al revés, un honorario de ${pesos(h)} te deja lo mismo que un salario de <strong>${pesos(seq)}</strong>.`
        : `Visto al revés, un honorario de ${pesos(h)} deja menos que cualquier contrato laboral de tiempo completo con salario mínimo.`);
    $("equivalente").textContent = "Poner el honorario equivalente";
    $("equivalente").dataset.valor = heq;
  }

  function renderEmpresa(c, ps, s, h, p, op) {
    const dif = ps.costoAnio - c.costoAnio;
    const rel = c.costoAnio ? Math.abs(dif) / c.costoAnio : 0;
    $("v-etq").textContent = "Diferencia de costo al año";
    $("v-cifra").textContent = (dif < 0 ? "−" : "+") + pesos(Math.abs(dif)).replace("−", "");
    $("v-per").textContent = `unos ${pesos(Math.abs(dif) / 12)} ${dif < 0 ? "menos" : "más"} al mes`;
    $("v-texto").innerHTML = Math.abs(dif) < 12000
      ? "Las dos opciones cuestan prácticamente lo mismo al año."
      : `La prestación de servicios te cuesta <strong>${pesos(Math.abs(dif))} ${dif < 0 ? "menos" : "más"}</strong> al año que el contrato laboral (${pct(rel, 0)} ${dif < 0 ? "menos" : "más"}).`;

    $("ayuda-comparacion").textContent = "Lo que paga en el año quien contrata, con prestaciones, aportes y parafiscales.";

    const e = c.empleador;
    const directoC = 12 * (s + c.auxilio);
    const prestC = c.prestaciones.prima + c.prestaciones.cesantias + c.prestaciones.intereses;
    const aportesC = 12 * e.aportesMes;
    const max = Math.max(c.costoAnio, ps.costoAnio);
    $("barras").innerHTML =
      barra("Contrato laboral", [[directoC, COL.oliva, "Pago mensual"], [prestC, COL.tierra, "Prestaciones"], [aportesC, COL.vino, "Aportes"]], max) +
      barra("Prestación de servicios", [[12 * h, COL.oliva, "Pago mensual"], [ps.costoAnio - 12 * h, COL.vino, "Aportes"]], max) +
      leyenda([[COL.oliva, "Salario o honorarios"], [COL.tierra, "Prestaciones sociales"], [COL.vino, "Aportes y parafiscales"]]);

    $("c-total").textContent = pesos(c.costoAnio);
    $("c-total-etq").textContent = "cuesta al año";
    $("c-mes").textContent = `Unos ${pesos(c.costoAnio / 12)} al mes, ${pct(c.costoAnio / (12 * s) - 1, 0)} más que el salario`;
    $("c-tabla").innerHTML =
      fila("Salario", 12 * s, { sub: `12 meses de ${pesos(s)}` }) +
      (c.auxilio ? fila("Auxilio de transporte", 12 * c.auxilio) : "") +
      fila("Prima de servicios", c.prestaciones.prima) +
      fila("Cesantías", c.prestaciones.cesantias) +
      fila("Intereses sobre cesantías", c.prestaciones.intereses, { sub: "12 % al año" }) +
      fila("Salud", 12 * e.salud, { sub: e.exonerado ? "Exonerada (art. 114-1)" : "8,5 %" }) +
      fila("Pensión", 12 * e.pension, { sub: "12 %" }) +
      fila("Riesgos laborales (ARL)", 12 * e.arl, { sub: `Clase ${op.claseRiesgo}: ${pct(C.ARL[op.claseRiesgo], 3)}` }) +
      fila("Caja de compensación", 12 * e.caja, { sub: "4 %" }) +
      fila("ICBF y SENA", 12 * (e.icbf + e.sena), { sub: e.exonerado ? "Exonerados (art. 114-1)" : "3 % y 2 %" }) +
      fila("Cuesta al año", c.costoAnio, { clase: "total" });
    $("c-extras").innerHTML = extras([
      ["bien", "Los 12 salarios ya incluyen 15 días hábiles de vacaciones pagadas."],
      e.exonerado && ["bien", "Sin salud del empleador, ICBF ni SENA por la exoneración del art. 114-1."],
      c.bajoMinimo && ["ojo", "El salario es menor que el mínimo."],
    ]);

    $("p-total").textContent = pesos(ps.costoAnio);
    $("p-total-etq").textContent = "cuesta al año";
    $("p-mes").textContent = `Unos ${pesos(ps.costoAnio / 12)} al mes`;
    $("p-tabla").innerHTML =
      fila("Honorarios", 12 * h, { sub: `12 meses de ${pesos(h)}` }) +
      (!ps.aportes.arlPagaContratista ? fila("Riesgos laborales (ARL)", 12 * ps.aportes.arl, { sub: `Clase ${op.claseRiesgo}: la paga quien contrata` }) : "") +
      fila("Cuesta al año", ps.costoAnio, { clase: "total" });
    $("p-extras").innerHTML = extras([
      ["ojo", "Antes de cada pago debes verificar que el contratista pagó su salud, pensión y ARL."],
      ["ojo", "Si la relación tiene subordinación, horario y continuidad, la ley la trata como contrato laboral."],
    ]);

    const hc = C.honorarioMismoCosto(s, p, op);
    $("equiv-texto").innerHTML =
      `Lo que cuesta al año un contrato laboral con salario de ${pesos(s)} alcanza para un honorario de <strong>${pesos(hc)} al mes</strong>. ` +
      `Con ese honorario, el contratista recibiría lo mismo que con un salario de <strong>${pesos(C.salarioEquivalente(hc, p, op))}</strong>.`;
    $("equivalente").textContent = "Poner el honorario de igual costo";
    $("equivalente").dataset.valor = hc;
  }

  // ---------- Eventos ----------
  function ponerMirada(m) {
    mirada = m === "empresa" ? "empresa" : "persona";
    document.querySelectorAll(".mirada__op").forEach((b) => {
      const on = b.dataset.mirada === mirada;
      b.classList.toggle("activa", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    render();
  }
  document.querySelectorAll(".mirada__op").forEach((b) => b.addEventListener("click", () => ponerMirada(b.dataset.mirada)));
  document.querySelector(".mirada").addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowRight" || ev.key === "ArrowLeft" || ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      ponerMirada(mirada === "persona" ? "empresa" : "persona");
      document.querySelector(".mirada__op.activa").focus();
    }
  });

  const numericos = ["salario", "honorario", "p-smmlv", "p-aux", "p-uvt"];
  numericos.forEach((id) => {
    const el = $(id);
    el.addEventListener("input", () => {
      const pos = el.value.length - el.selectionStart;
      escribir(el, leer(el));
      const np = Math.max(0, el.value.length - pos);
      try { el.setSelectionRange(np, np); } catch (e) { /* sin efecto */ }
      render();
    });
  });
  ["riesgo", "retencion", "exonerado"].forEach((id) => $(id).addEventListener("change", render));

  $("igualar").addEventListener("click", () => { escribir($("honorario"), leer($("salario"))); render(); });
  $("equivalente").addEventListener("click", () => {
    const v = parseInt($("equivalente").dataset.valor || "0", 10);
    if (v) { escribir($("honorario"), v); render(); }
  });
  function restablecer() {
    escribir($("p-smmlv"), P0.smmlv);
    escribir($("p-aux"), P0.auxilioTransporte);
    escribir($("p-uvt"), P0.uvt);
  }
  $("restablecer").addEventListener("click", () => { restablecer(); render(); });

  // ---------- Inicio (los valores pueden venir en el enlace) ----------
  function desdeEnlace() {
    const q = new URLSearchParams(location.hash.slice(1));
    if (q.get("salario")) escribir($("salario"), parseInt(q.get("salario"), 10) || 0);
    if (q.get("honorario")) escribir($("honorario"), parseInt(q.get("honorario"), 10) || 0);
    ponerMirada(q.get("mirada") || mirada);
  }
  restablecer();
  desdeEnlace();
  window.addEventListener("hashchange", desdeEnlace);
})();
