(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MomentumDetector = api;
})(typeof window === "object" ? window : globalThis, function () {
  "use strict";
  const MAX_ROWS = 1000;
  const normalize = text => text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  function cells(line, delimiter) {
    const values = []; let value = "", quoted = false, closed = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') { value += '"'; i++; }
        else if (quoted) { quoted = false; closed = true; }
        else if (!value.trim() && !closed) quoted = true;
        else throw new Error("Comillas incorrectas en el CSV.");
      } else if (c === delimiter && !quoted) { values.push(value.trim()); value = ""; closed = false; }
      else if (closed && c.trim()) throw new Error("Contenido después de cerrar comillas.");
      else value += c;
    }
    if (quoted) throw new Error("Falta cerrar una comilla. Usa una fila por fecha.");
    values.push(value.trim()); return values;
  }

  function parseCSV(text, today = new Date().toISOString().slice(0, 10)) {
    if (typeof text !== "string" || text.length > 256000) throw new Error("El CSV supera el límite de 256 KB.");
    const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 3) throw new Error("Incluye la cabecera y al menos dos cierres diarios.");
    if (lines.length > MAX_ROWS + 1) throw new Error("El máximo es 1.000 cierres diarios por activo.");
    const delimiter = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
    const header = cells(lines[0], delimiter).map(normalize);
    function column(aliases, required) {
      const indexes = header.flatMap((name, index) => aliases.includes(name) ? [index] : []);
      if (indexes.length > 1) throw new Error("Hay columnas repetidas para fecha, cierre o volumen.");
      if (!indexes.length && required) throw new Error("Faltan las columnas fecha y cierre (o Date y Close).");
      return indexes[0] ?? -1;
    }
    const dateIndex = column(["date", "fecha"], true);
    const closeIndex = column(["close", "cierre"], true);
    const volumeIndex = column(["volume", "volumen"], false);
    const symbolIndex = column(["symbol", "simbolo", "ticker"], false);
    const dates = new Set(), symbols = new Set();
    function number(value, positive, row) {
      const raw = delimiter !== "," ? value.replace(",", ".") : value;
      if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new Error(`Número incorrecto en la fila ${row}. Usa decimales sin separador de miles.`);
      const n = Number(raw);
      if (!Number.isFinite(n) || (positive ? n <= 0 : n < 0)) throw new Error(`Precio o volumen incorrecto en la fila ${row}.`);
      return n;
    }
    const rows = lines.slice(1).map((line, index) => {
      const rowNumber = index + 2, values = cells(line, delimiter);
      if (values.length !== header.length) throw new Error(`La fila ${rowNumber} no tiene el mismo número de columnas que la cabecera.`);
      const date = values[dateIndex], time = Date.parse(`${date}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date || date > today)
        throw new Error(`Fecha incorrecta o futura en la fila ${rowNumber}. Usa AAAA-MM-DD.`);
      if (dates.has(date)) throw new Error(`Fecha repetida: ${date}. Solo un cierre diario por fecha.`);
      dates.add(date);
      if (symbolIndex >= 0) {
        if (!values[symbolIndex]) throw new Error(`Falta el símbolo en la fila ${rowNumber}.`);
        symbols.add(values[symbolIndex].toUpperCase());
      }
      return { date, close: number(values[closeIndex], true, rowNumber), volume: volumeIndex >= 0 && values[volumeIndex] !== "" ? number(values[volumeIndex], false, rowNumber) : null };
    });
    if (symbols.size > 1) throw new Error("El archivo mezcla varios activos. Importa un único activo cada vez.");
    return { rows: rows.sort((a, b) => a.date.localeCompare(b.date)), symbol: [...symbols][0] || null };
  }

  function analyze(rows, rules) {
    const { move, drawdown, lookback, confirmation, requireVolume } = rules;
    if (!Number.isFinite(move) || move <= 0 || move > 100 || !Number.isFinite(drawdown) || drawdown <= 0 || drawdown > 100 || !Number.isInteger(lookback) || lookback < 2 || lookback > 252 || ![1, 2, 3].includes(confirmation))
      throw new Error("Revisa los umbrales (0–100 %), la ventana (2–252 cierres) y la confirmación (1–3 cierres).");
    if (!Array.isArray(rows) || rows.length < 2 || rows.length > MAX_ROWS) throw new Error("Faltan cierres diarios para analizar.");
    rows.forEach((row, i) => {
      if (!Number.isFinite(row.close) || row.close <= 0 || (row.volume !== null && (!Number.isFinite(row.volume) || row.volume < 0)) || (i && row.date <= rows[i - 1].date)) throw new Error("Los cierres deben ser positivos, únicos y ordenados por fecha.");
    });
    const last = rows.at(-1), previous = rows.at(-2);
    const change = (last.close / previous.close - 1) * 100;
    const peakRows = rows.slice(-lookback);
    const peak = Math.max(...peakRows.map(row => row.close));
    const peakDrop = (last.close / peak - 1) * 100;
    const previousVolumes = rows.slice(-21, -1).map(row => row.volume);
    const volumeReady = previousVolumes.length === 20 && previousVolumes.every(v => v !== null) && last.volume !== null;
    const averageVolume = volumeReady ? previousVolumes.reduce((a, b) => a + b, 0) / 20 : null;
    const volumeRatio = averageVolume > 0 ? last.volume / averageVolume : null;
    const volumePass = !requireVolume || (volumeRatio !== null && volumeRatio >= 1.5);
    const changes = rows.slice(-confirmation).map((row, j) => {
      const i = rows.length - confirmation + j;
      return i > 0 ? (row.close / rows[i - 1].close - 1) * 100 : null;
    });
    const sustained = sign => changes.length === confirmation && changes.every(value => value !== null && sign * value >= move - 1e-9);
    const signals = [];
    if (volumePass && sustained(1)) signals.push({ kind: "up", title: "Subida detectada", detail: `Cada uno de los últimos ${confirmation} cambios entre cierres alcanza +${move} %.` });
    if (volumePass && sustained(-1)) signals.push({ kind: "down", title: "Caída detectada", detail: `Cada uno de los últimos ${confirmation} cambios entre cierres alcanza −${move} %.` });
    if (volumePass && peakRows.length === lookback && peakDrop <= -drawdown + 1e-9) signals.push({ kind: "drawdown", title: "Pérdida desde máximos", detail: `El último cierre cae al menos ${drawdown} % desde el mayor cierre de los últimos ${lookback}. Esta regla usa el último cierre, sin confirmación adicional.` });
    const sma20 = rows.length >= 20 ? rows.slice(-20).reduce((sum, row) => sum + row.close, 0) / 20 : null;
    const previousSma20 = rows.length >= 21 ? rows.slice(-21, -1).reduce((sum, row) => sum + row.close, 0) / 20 : null;
    const crossing = sma20 !== null && previousSma20 !== null
      ? previous.close <= previousSma20 && last.close > sma20 ? "up" : previous.close >= previousSma20 && last.close < sma20 ? "down" : null
      : null;
    const history = [];
    for (let i = Math.max(1, rows.length - 30); i < rows.length; i++) {
      const percent = (rows[i].close / rows[i - 1].close - 1) * 100;
      if (Math.abs(percent) >= move - 1e-9) history.push({ date: rows[i].date, percent });
    }
    return { date: last.date, close: last.close, previousClose: previous.close, change, peakDrop, peak, peakCount: peakRows.length, sma20, crossing, volumeRatio, volumePass, signals, history, count: rows.length };
  }
  return { parseCSV, analyze };
});
