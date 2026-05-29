export function createCommandOutput(command, params, data, warnings = []) {
  return {
    command,
    parameters: params,
    metadata: {
      generatedAt: new Date().toISOString(),
      rowCount: getRowCount(data),
      truncated: Boolean(data?.truncated),
      warnings,
    },
    data,
  };
}

export function printOutput(output, format = "json") {
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return;
  }

  const rows = selectRows(output.data);
  if (format === "csv") {
    process.stdout.write(toCsv(rows));
    return;
  }

  if (format === "table") {
    console.table(rows.map(flattenRecord));
    return;
  }

  throw new Error(`Unsupported format: ${format}`);
}

export function printError(error, format = "json") {
  if (format === "json") {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: false,
          error: {
            message: error.message,
          },
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  process.stderr.write(`${error.message}\n`);
}

function getRowCount(data) {
  if (!data) {
    return 0;
  }
  if (Array.isArray(data)) {
    return data.length;
  }
  for (const key of [
    "points",
    "assets",
    "transactions",
    "snapshots",
    "dates",
    "coins",
  ]) {
    if (Array.isArray(data[key])) {
      return data[key].length;
    }
  }
  if (typeof data.snapshotCount === "number") {
    return data.snapshotCount;
  }
  return 1;
}

function selectRows(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (!data || typeof data !== "object") {
    return [{ value: data }];
  }
  for (const key of [
    "points",
    "assets",
    "transactions",
    "snapshots",
    "dates",
    "coins",
  ]) {
    if (Array.isArray(data[key])) {
      return data[key];
    }
  }
  return [data];
}

function toCsv(rows) {
  const flatRows = rows.map(flattenRecord);
  const headers = Array.from(
    flatRows.reduce((headerSet, row) => {
      for (const key of Object.keys(row)) {
        headerSet.add(key);
      }
      return headerSet;
    }, new Set()),
  );

  if (headers.length === 0) {
    return "";
  }

  const lines = [headers.join(",")];
  for (const row of flatRows) {
    lines.push(headers.map((header) => csvEscape(row[header] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function flattenRecord(record, prefix = "") {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { [prefix || "value"]: JSON.stringify(record) };
  }

  const result = {};
  for (const [key, value] of Object.entries(record)) {
    const outputKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenRecord(value, outputKey));
    } else if (Array.isArray(value)) {
      result[outputKey] = JSON.stringify(value);
    } else {
      result[outputKey] = value;
    }
  }
  return result;
}

function csvEscape(value) {
  const text = String(value);
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}
