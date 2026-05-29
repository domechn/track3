import { inspectTrack3Database } from "./db.mjs";

export const DEFAULT_LIMIT = 30;
export const DEFAULT_MAX_POINTS = 100;

const ASSET_TYPES = new Set(["crypto", "stock"]);
const TRANSACTION_TYPES = new Set(["buy", "sell", "deposit", "withdraw"]);

export function createTrack3HistoryService(database, context = {}) {
  return {
    queryDoctor: () => inspectTrack3Database(database, context),
    queryDates: (options = {}) => queryDates(database, options),
    querySnapshots: (options = {}) => querySnapshots(database, options),
    queryTimeline: (options = {}) => queryTimeline(database, options),
    queryLatest: (options = {}) => queryLatest(database, options),
    queryAsset: (options = {}) => queryAsset(database, options),
    queryTransactions: (options = {}) => queryTransactions(database, options),
    queryPnl: (options = {}) => queryPnl(database, options),
    queryCompare: (options = {}) => queryCompare(database, options),
    queryTop: (options = {}) => queryTop(database, options),
  };
}

export function queryDates(database, options = {}) {
  const limit = normalizeLimit(options.limit, 0);
  const limitClause = limit > 0 ? "LIMIT ?" : "";
  const params = limit > 0 ? [limit] : [];

  return database
    .prepare(
      `SELECT
        uuid,
        createdAt,
        COUNT(*) AS assetCount,
        SUM(value) AS totalValue
      FROM assets_v2
      GROUP BY uuid, createdAt
      ORDER BY createdAt DESC
      ${limitClause}`,
    )
    .all(...params)
    .map((row) => ({
      uuid: row.uuid,
      createdAt: row.createdAt,
      assetCount: Number(row.assetCount ?? 0),
      totalValue: roundMoney(row.totalValue),
    }));
}

export function querySnapshots(database, options = {}) {
  const limit = normalizeLimit(options.limit, DEFAULT_LIMIT);
  const gather = options.gather ?? true;
  const includeTransactions = options.includeTransactions ?? false;
  const dateFilter = buildDateFilter(options, "createdAt");
  const params = [...dateFilter.params];
  const limitClause = limit > 0 ? "LIMIT ?" : "";
  if (limit > 0) {
    params.push(limit);
  }

  const snapshotRows = database
    .prepare(
      `SELECT uuid, MAX(createdAt) AS createdAt
      FROM assets_v2
      WHERE 1 = 1 ${dateFilter.sql}
      GROUP BY uuid
      ORDER BY createdAt DESC
      ${limitClause}`,
    )
    .all(...params);
  const uuids = snapshotRows.map((row) => row.uuid);
  const assetsByUuid = groupBy(fetchAssetsByUuids(database, uuids), "uuid");
  const transactionsByUuid = includeTransactions
    ? groupBy(fetchTransactionsByUuids(database, uuids), "uuid")
    : new Map();

  return {
    snapshots: snapshotRows.map((row) => {
      const assets = assetsByUuid.get(row.uuid) ?? [];
      const snapshotAssets = gather ? groupAssetsByIdentity(assets) : assets;
      return {
        id: row.uuid,
        uuid: row.uuid,
        createdAt: row.createdAt,
        total: roundMoney(sumBy(snapshotAssets, "value")),
        assets: sortAssets(snapshotAssets),
        transactions: transactionsByUuid.get(row.uuid) ?? [],
      };
    }),
  };
}

export function queryTimeline(database, options = {}) {
  const maxPoints = normalizeLimit(options.maxPoints, DEFAULT_MAX_POINTS);
  const dateFilter = buildDateFilter(options, "createdAt");
  const rows = database
    .prepare(
      `SELECT uuid, createdAt, SUM(value) AS totalValue
      FROM assets_v2
      WHERE 1 = 1 ${dateFilter.sql}
      GROUP BY uuid, createdAt
      ORDER BY createdAt ASC`,
    )
    .all(...dateFilter.params)
    .map((row) => ({
      uuid: row.uuid,
      createdAt: row.createdAt,
      timestamp: new Date(row.createdAt).getTime(),
      totalValue: roundMoney(row.totalValue),
    }));

  const points = downsample(rows, maxPoints);
  return {
    points,
    totalPoints: rows.length,
    truncated: points.length < rows.length,
  };
}

export function queryLatest(database, options = {}) {
  const assetType = normalizeAssetType(options.assetType, { optional: true });
  const includeZero = Boolean(options.includeZero);
  const groupByWallet = Boolean(options.groupByWallet);
  const dateFilter = buildDateFilter(options, "createdAt");
  const latest = database
    .prepare(
      `SELECT uuid, createdAt
      FROM assets_v2
      WHERE 1 = 1 ${dateFilter.sql}
      ORDER BY createdAt DESC
      LIMIT 1`,
    )
    .get(...dateFilter.params);

  if (!latest) {
    return { uuid: null, createdAt: null, totalValue: 0, assets: [] };
  }

  const whereParts = ["uuid = ?"];
  const params = [latest.uuid];
  if (assetType) {
    whereParts.push("asset_type = ?");
    params.push(assetType);
  }

  const assets = database
    .prepare(`SELECT * FROM assets_v2 WHERE ${whereParts.join(" AND ")}`)
    .all(...params)
    .map(normalizeAsset);
  const totalValue = roundMoney(sumBy(assets, "value"));
  const groupedAssets = groupByWallet
    ? groupAssetsByWallet(assets)
    : groupAssetsByIdentity(assets);
  const visibleAssets = includeZero
    ? groupedAssets
    : groupedAssets.filter((asset) => asset.amount !== 0);

  return {
    uuid: latest.uuid,
    createdAt: latest.createdAt,
    totalValue,
    assets: sortAssets(visibleAssets).map((asset) =>
      addPercentage(asset, totalValue),
    ),
  };
}

export function queryAsset(database, options = {}) {
  const symbol = requireSymbol(options.symbol);
  const assetType = normalizeAssetType(options.assetType, { optional: true });
  const maxPoints = normalizeLimit(options.maxPoints, DEFAULT_MAX_POINTS);
  const dateFilter = buildDateFilter(options, "createdAt");
  const whereParts = ["symbol = ?", toWherePart(dateFilter)].filter(Boolean);
  const params = [symbol, ...dateFilter.params];
  if (assetType) {
    whereParts.push("asset_type = ?");
    params.push(assetType);
  }

  const assets = database
    .prepare(
      `SELECT * FROM assets_v2
      WHERE ${whereParts.join(" AND ")}
      ORDER BY createdAt ASC`,
    )
    .all(...params)
    .map(normalizeAsset);
  const summaries = Array.from(groupByIdentity(assets).values()).map(
    (identityAssets) => buildAssetDetail(identityAssets, maxPoints),
  );
  const transactions = queryTransactions(database, {
    start: options.start,
    end: options.end,
    symbol,
    assetType,
    limit: options.transactionLimit ?? 100,
  }).transactions;
  const result = {
    symbol,
    assetType: assetType ?? null,
    assets: summaries,
    transactions,
  };

  if (summaries.length === 1) {
    Object.assign(result, summaries[0]);
  }

  return result;
}

export function queryTransactions(database, options = {}) {
  const dateFilter = buildDateFilter(options, "txnCreatedAt");
  const whereParts = ["1 = 1", toWherePart(dateFilter)].filter(Boolean);
  const params = [...dateFilter.params];
  const assetType = normalizeAssetType(options.assetType, { optional: true });
  const txnType = normalizeTransactionType(options.txnType, { optional: true });
  const limit = normalizeLimit(options.limit, DEFAULT_LIMIT);

  if (options.symbol) {
    whereParts.push("symbol = ?");
    params.push(String(options.symbol).toUpperCase());
  }
  if (assetType) {
    whereParts.push("asset_type = ?");
    params.push(assetType);
  }
  if (options.wallet) {
    whereParts.push("wallet = ?");
    params.push(String(options.wallet));
  }
  if (txnType) {
    whereParts.push("txnType = ?");
    params.push(txnType);
  }

  const limitClause = limit > 0 ? "LIMIT ?" : "";
  if (limit > 0) {
    params.push(limit);
  }

  const transactions = database
    .prepare(
      `SELECT * FROM transactions
      WHERE ${whereParts.join(" AND ")}
      ORDER BY txnCreatedAt DESC
      ${limitClause}`,
    )
    .all(...params)
    .map(normalizeTransaction);

  return { transactions };
}

export function queryPnl(database, options = {}) {
  const assetType = normalizeAssetType(options.assetType, { optional: true });
  const symbol = options.symbol
    ? String(options.symbol).toUpperCase()
    : undefined;
  const start = normalizeDate(options.start, { optional: true });
  const end = normalizeDate(options.end, { optional: true });
  const latestAssets = listBoundaryAssets(database, {
    boundary: "MAX",
    start,
    end,
    symbol,
    assetType,
  });
  const earliestAssets = listBoundaryAssets(database, {
    boundary: "MIN",
    start,
    end,
    symbol,
    assetType,
  });
  const transactions = queryTransactions(database, {
    start,
    end,
    symbol,
    assetType,
    limit: 0,
  }).transactions;

  const latestByIdentity = groupByIdentity(latestAssets);
  const earliestByIdentity = groupByIdentity(earliestAssets);
  const transactionsByIdentity = groupByIdentity(transactions);
  const identities = new Set([
    ...latestByIdentity.keys(),
    ...earliestByIdentity.keys(),
    ...transactionsByIdentity.keys(),
  ]);
  const coins = [];

  for (const identity of identities) {
    const latestGroup = latestByIdentity.get(identity) ?? [];
    if (latestGroup.length === 0) {
      continue;
    }
    const earliestGroup = earliestByIdentity.get(identity) ?? [];
    const transactionGroup = transactionsByIdentity.get(identity) ?? [];
    const firstAsset =
      latestGroup[0] ?? earliestGroup[0] ?? transactionGroup[0];
    const latestAmount = roundAmount(sumBy(latestGroup, "amount"));
    const latestValue = roundMoney(sumBy(latestGroup, "value"));
    const latestPrice =
      latestAmount === 0
        ? (latestGroup[0]?.price ?? 0)
        : latestValue / latestAmount;
    const earliestAmount = roundAmount(sumBy(earliestGroup, "amount"));
    const earliestCost = roundMoney(sumBy(earliestGroup, "value"));
    const earliestCreatedAt = minDateString(
      earliestGroup.map((asset) => asset.createdAt),
    );
    const buySellTransactions = transactionGroup
      .filter(
        (transaction) =>
          transaction.txnType === "buy" || transaction.txnType === "sell",
      )
      .filter(
        (transaction) =>
          !earliestCreatedAt || transaction.txnCreatedAt > earliestCreatedAt,
      );
    const buyAmount =
      earliestAmount +
      sumBy(
        buySellTransactions.filter(
          (transaction) => transaction.txnType === "buy",
        ),
        "amount",
      );
    const sellAmount = sumBy(
      buySellTransactions.filter(
        (transaction) => transaction.txnType === "sell",
      ),
      "amount",
    );
    const buyCost = sumTransactionValue(
      buySellTransactions.filter(
        (transaction) => transaction.txnType === "buy",
      ),
    );
    const sellValue = sumTransactionValue(
      buySellTransactions.filter(
        (transaction) => transaction.txnType === "sell",
      ),
    );
    const totalCost = earliestCost + buyCost;
    const costAvgPrice = buyAmount === 0 ? 0 : totalCost / buyAmount;
    const sellAvgPrice = sellAmount === 0 ? 0 : sellValue / sellAmount;
    const realizedProfit = sellAmount * (sellAvgPrice - costAvgPrice);
    const unrealizedProfit = latestAmount * (latestPrice - costAvgPrice);
    const value = roundMoney(realizedProfit + unrealizedProfit);

    coins.push({
      symbol: firstAsset.symbol,
      assetType: firstAsset.assetType,
      value,
      percentage: totalCost === 0 ? null : (value / totalCost) * 100,
      realizedProfit: roundMoney(realizedProfit),
      unrealizedProfit: roundMoney(unrealizedProfit),
      latestAmount,
      latestValue,
      latestPrice,
      buyAmount: roundAmount(buyAmount),
      sellAmount: roundAmount(sellAmount),
      costAvgPrice,
      sellAvgPrice,
      costBasis: roundMoney(totalCost),
      transactionCount: buySellTransactions.length,
    });
  }

  const total = roundMoney(sumBy(coins, "value"));
  const costBasis = roundMoney(sumBy(coins, "costBasis"));
  return {
    total,
    percentage: costBasis === 0 ? null : (total / costBasis) * 100,
    costBasis,
    coins: coins.sort(
      (leftAsset, rightAsset) =>
        Math.abs(rightAsset.value) - Math.abs(leftAsset.value),
    ),
  };
}

export function queryCompare(database, options = {}) {
  const leftSnapshot = resolveSnapshot(database, {
    uuid: options.leftUuid,
    date: options.leftDate,
    fallback: "previous",
  });
  const rightSnapshot = resolveSnapshot(database, {
    uuid: options.rightUuid,
    date: options.rightDate,
    fallback: "latest",
  });

  if (!leftSnapshot || !rightSnapshot) {
    throw new Error("Not enough snapshots to compare");
  }

  const leftAssets = groupAssetsByIdentity(
    fetchAssetsByUuids(database, [leftSnapshot.uuid]),
  );
  const rightAssets = groupAssetsByIdentity(
    fetchAssetsByUuids(database, [rightSnapshot.uuid]),
  );
  const leftMap = new Map(
    leftAssets.map((asset) => [assetIdentity(asset), asset]),
  );
  const rightMap = new Map(
    rightAssets.map((asset) => [assetIdentity(asset), asset]),
  );
  const identities = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const assets = Array.from(identities).map((identity) => {
    const leftAsset = leftMap.get(identity);
    const rightAsset = rightMap.get(identity);
    const baseAsset = rightAsset ?? leftAsset;
    return {
      symbol: baseAsset.symbol,
      assetType: baseAsset.assetType,
      leftAmount: roundAmount(leftAsset?.amount ?? 0),
      rightAmount: roundAmount(rightAsset?.amount ?? 0),
      amountDelta: roundAmount(
        (rightAsset?.amount ?? 0) - (leftAsset?.amount ?? 0),
      ),
      leftValue: roundMoney(leftAsset?.value ?? 0),
      rightValue: roundMoney(rightAsset?.value ?? 0),
      valueDelta: roundMoney(
        (rightAsset?.value ?? 0) - (leftAsset?.value ?? 0),
      ),
      leftPrice: leftAsset?.price ?? null,
      rightPrice: rightAsset?.price ?? null,
      priceDelta:
        leftAsset && rightAsset
          ? roundMoney(rightAsset.price - leftAsset.price)
          : null,
    };
  });
  const sortedAssets = assets.sort(
    (leftAsset, rightAsset) =>
      Math.abs(rightAsset.valueDelta) - Math.abs(leftAsset.valueDelta),
  );
  const leftTotalValue = roundMoney(sumBy(leftAssets, "value"));
  const rightTotalValue = roundMoney(sumBy(rightAssets, "value"));

  return {
    left: {
      uuid: leftSnapshot.uuid,
      createdAt: leftSnapshot.createdAt,
      totalValue: leftTotalValue,
    },
    right: {
      uuid: rightSnapshot.uuid,
      createdAt: rightSnapshot.createdAt,
      totalValue: rightTotalValue,
    },
    totalDelta: roundMoney(rightTotalValue - leftTotalValue),
    assets: sortedAssets,
    newPositions: sortedAssets.filter(
      (asset) => asset.leftAmount === 0 && asset.rightAmount !== 0,
    ),
    removedPositions: sortedAssets.filter(
      (asset) => asset.leftAmount !== 0 && asset.rightAmount === 0,
    ),
  };
}

export function queryTop(database, options = {}) {
  const limit = normalizeLimit(options.limit, 10);
  const by = options.by === "latest" ? "latest" : "cumulative";
  const assetType = normalizeAssetType(options.assetType, { optional: true });
  const dateFilter = buildDateFilter(options, "createdAt");
  const whereParts = ["1 = 1", toWherePart(dateFilter)].filter(Boolean);
  const params = [...dateFilter.params];
  if (assetType) {
    whereParts.push("asset_type = ?");
    params.push(assetType);
  }

  if (by === "latest") {
    return {
      by,
      assets: queryLatest(database, {
        assetType,
        includeZero: false,
        start: options.start,
        end: options.end,
      }).assets.slice(0, limit),
    };
  }

  const assets = database
    .prepare(
      `SELECT
        asset_type AS assetType,
        symbol,
        SUM(value) AS totalValue,
        AVG(value) AS averageValue,
        MAX(value) AS maxValue,
        COUNT(DISTINCT uuid) AS snapshotCount
      FROM assets_v2
      WHERE ${whereParts.join(" AND ")}
      GROUP BY asset_type, symbol
      ORDER BY totalValue DESC, symbol ASC
      LIMIT ?`,
    )
    .all(...params, limit)
    .map((row) => ({
      symbol: row.symbol,
      assetType: row.assetType ?? "crypto",
      totalValue: roundMoney(row.totalValue),
      averageValue: roundMoney(row.averageValue),
      maxValue: roundMoney(row.maxValue),
      snapshotCount: Number(row.snapshotCount ?? 0),
    }));

  return { by, assets };
}

function buildAssetDetail(assets, maxPoints) {
  const groupedByUuid = groupBy(assets, "uuid");
  const series = Array.from(groupedByUuid.values())
    .map((snapshotAssets) => {
      const firstAsset = snapshotAssets[0];
      const amount = roundAmount(sumBy(snapshotAssets, "amount"));
      const value = roundMoney(sumBy(snapshotAssets, "value"));
      return {
        uuid: firstAsset.uuid,
        createdAt: firstAsset.createdAt,
        timestamp: new Date(firstAsset.createdAt).getTime(),
        assetType: firstAsset.assetType,
        symbol: firstAsset.symbol,
        amount,
        value,
        price: amount === 0 ? firstAsset.price : value / amount,
      };
    })
    .sort(
      (leftPoint, rightPoint) => leftPoint.timestamp - rightPoint.timestamp,
    );
  const points = downsample(series, maxPoints);
  const latest = points[points.length - 1] ?? null;
  const firstAsset = assets[0];

  return {
    symbol: firstAsset?.symbol ?? null,
    assetType: firstAsset?.assetType ?? null,
    latest,
    maxAmount: points.length
      ? Math.max(...points.map((point) => point.amount))
      : 0,
    maxValue: points.length
      ? Math.max(...points.map((point) => point.value))
      : 0,
    series: points,
    totalPoints: series.length,
    truncated: points.length < series.length,
  };
}

function listBoundaryAssets(database, options) {
  const dateFilter = buildDateFilter(options, "createdAt");
  const whereParts = ["1 = 1", toWherePart(dateFilter)].filter(Boolean);
  const params = [...dateFilter.params];
  if (options.symbol) {
    whereParts.push("symbol = ?");
    params.push(options.symbol);
  }
  if (options.assetType) {
    whereParts.push("asset_type = ?");
    params.push(options.assetType);
  }
  const boundaryFunction = options.boundary === "MIN" ? "MIN" : "MAX";
  return database
    .prepare(
      `WITH boundary AS (
        SELECT asset_type, symbol, ${boundaryFunction}(createdAt) AS createdAt
        FROM assets_v2
        WHERE ${whereParts.join(" AND ")}
        GROUP BY asset_type, symbol
      )
      SELECT assets_v2.*
      FROM assets_v2
      JOIN boundary
        ON assets_v2.asset_type = boundary.asset_type
       AND assets_v2.symbol = boundary.symbol
       AND assets_v2.createdAt = boundary.createdAt
      ORDER BY assets_v2.createdAt ASC`,
    )
    .all(...params)
    .map(normalizeAsset);
}

function resolveSnapshot(database, options = {}) {
  if (options.uuid) {
    return database
      .prepare(
        `SELECT uuid, MAX(createdAt) AS createdAt
        FROM assets_v2
        WHERE uuid = ?
        GROUP BY uuid`,
      )
      .get(String(options.uuid));
  }

  if (options.date) {
    const date = normalizeDate(options.date);
    return database
      .prepare(
        `SELECT uuid, MAX(createdAt) AS createdAt
        FROM assets_v2
        WHERE createdAt <= ?
        GROUP BY uuid
        ORDER BY createdAt DESC
        LIMIT 1`,
      )
      .get(date.toISOString());
  }

  const offset = options.fallback === "previous" ? 1 : 0;
  return database
    .prepare(
      `SELECT uuid, MAX(createdAt) AS createdAt
      FROM assets_v2
      GROUP BY uuid
      ORDER BY createdAt DESC
      LIMIT 1 OFFSET ?`,
    )
    .get(offset);
}

function fetchAssetsByUuids(database, uuids) {
  if (uuids.length === 0) {
    return [];
  }
  const placeholders = uuids.map(() => "?").join(", ");
  return database
    .prepare(
      `SELECT * FROM assets_v2
      WHERE uuid IN (${placeholders})
      ORDER BY createdAt DESC, value DESC, symbol ASC`,
    )
    .all(...uuids)
    .map(normalizeAsset);
}

function fetchTransactionsByUuids(database, uuids) {
  if (uuids.length === 0) {
    return [];
  }
  const placeholders = uuids.map(() => "?").join(", ");
  return database
    .prepare(
      `SELECT * FROM transactions
      WHERE uuid IN (${placeholders})
      ORDER BY txnCreatedAt DESC`,
    )
    .all(...uuids)
    .map(normalizeTransaction);
}

function buildDateFilter(options, columnName) {
  const start = normalizeDate(options.start ?? options.from, {
    optional: true,
  });
  const end = normalizeDate(options.end ?? options.to, { optional: true });
  const sqlParts = [];
  const params = [];

  if (start) {
    sqlParts.push(`AND ${columnName} >= ?`);
    params.push(start.toISOString());
  }
  if (end) {
    sqlParts.push(`AND ${columnName} <= ?`);
    params.push(end.toISOString());
  }

  return {
    sql: sqlParts.join(" "),
    params,
  };
}

function toWherePart(dateFilter) {
  return dateFilter.sql.replace(/^AND\s+/, "");
}

function normalizeAsset(row) {
  return {
    id: Number(row.id),
    uuid: row.uuid,
    createdAt: row.createdAt,
    assetType: row.assetType ?? row.asset_type ?? "crypto",
    symbol: row.symbol,
    amount: Number(row.amount ?? 0),
    value: Number(row.value ?? 0),
    price: Number(row.price ?? 0),
    wallet: row.wallet ?? "",
  };
}

function normalizeTransaction(row) {
  return {
    id: Number(row.id),
    uuid: row.uuid,
    assetID: Number(row.assetID),
    assetType: row.assetType ?? row.asset_type ?? "crypto",
    wallet: row.wallet ?? "",
    symbol: row.symbol,
    amount: Number(row.amount ?? 0),
    price: Number(row.price ?? 0),
    txnType: row.txnType,
    txnCreatedAt: row.txnCreatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function groupAssetsByIdentity(assets) {
  return Array.from(groupByIdentity(assets).values()).map((identityAssets) => {
    const firstAsset = identityAssets[0];
    const amount = roundAmount(sumBy(identityAssets, "amount"));
    const value = roundMoney(sumBy(identityAssets, "value"));
    return {
      ...firstAsset,
      amount,
      value,
      price: firstAsset.price,
      wallets: Array.from(
        new Set(identityAssets.map((asset) => asset.wallet)),
      ).filter(Boolean),
    };
  });
}

function groupAssetsByWallet(assets) {
  return Array.from(
    groupBy(
      assets,
      (asset) => `${asset.assetType}:${asset.symbol}:${asset.wallet}`,
    ).values(),
  ).map((walletAssets) => {
    const firstAsset = walletAssets[0];
    return {
      ...firstAsset,
      amount: roundAmount(sumBy(walletAssets, "amount")),
      value: roundMoney(sumBy(walletAssets, "value")),
    };
  });
}

function groupByIdentity(items) {
  return groupBy(items, (item) => assetIdentity(item));
}

function groupBy(items, keyOrAccessor) {
  const grouped = new Map();
  const accessor =
    typeof keyOrAccessor === "function"
      ? keyOrAccessor
      : (item) => item[keyOrAccessor];

  for (const item of items) {
    const key = accessor(item);
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }

  return grouped;
}

function assetIdentity(item) {
  return `${item.assetType ?? "crypto"}:${item.symbol}`;
}

function sortAssets(assets) {
  return [...assets].sort((leftAsset, rightAsset) => {
    if (rightAsset.value !== leftAsset.value) {
      return rightAsset.value - leftAsset.value;
    }
    if (leftAsset.symbol !== rightAsset.symbol) {
      return leftAsset.symbol.localeCompare(rightAsset.symbol);
    }
    return leftAsset.assetType.localeCompare(rightAsset.assetType);
  });
}

function addPercentage(asset, totalValue) {
  return {
    ...asset,
    percentage: totalValue === 0 ? 0 : (asset.value / totalValue) * 100,
  };
}

function downsample(items, maxPoints) {
  if (!maxPoints || maxPoints <= 0 || items.length <= maxPoints) {
    return items;
  }

  if (maxPoints === 1) {
    return [items[items.length - 1]];
  }

  const selected = [];
  const lastIndex = items.length - 1;
  for (let pointIndex = 0; pointIndex < maxPoints; pointIndex += 1) {
    const sourceIndex = Math.round((pointIndex * lastIndex) / (maxPoints - 1));
    selected.push(items[sourceIndex]);
  }
  return selected;
}

function normalizeDate(value, options = {}) {
  if (value === undefined || value === null || value === "") {
    if (options.optional) {
      return undefined;
    }
    throw new Error("Date value is required");
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

function normalizeAssetType(value, options = {}) {
  if (value === undefined || value === null || value === "") {
    if (options.optional) {
      return undefined;
    }
    throw new Error("assetType is required");
  }
  const assetType = String(value).toLowerCase();
  if (!ASSET_TYPES.has(assetType)) {
    throw new Error(`Invalid asset type: ${value}`);
  }
  return assetType;
}

function normalizeTransactionType(value, options = {}) {
  if (value === undefined || value === null || value === "") {
    if (options.optional) {
      return undefined;
    }
    throw new Error("txnType is required");
  }
  const txnType = String(value).toLowerCase();
  if (!TRANSACTION_TYPES.has(txnType)) {
    throw new Error(`Invalid transaction type: ${value}`);
  }
  return txnType;
}

function normalizeLimit(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error(`Invalid limit: ${value}`);
  }
  return limit;
}

function requireSymbol(value) {
  if (!value) {
    throw new Error("--symbol is required");
  }
  return String(value).toUpperCase();
}

function sumBy(items, key) {
  return items.reduce((total, item) => total + Number(item[key] ?? 0), 0);
}

function sumTransactionValue(transactions) {
  return transactions.reduce(
    (total, transaction) => total + transaction.amount * transaction.price,
    0,
  );
}

function minDateString(values) {
  return values.filter(Boolean).sort()[0];
}

function roundMoney(value) {
  return Math.round(Number(value ?? 0) * 100000000) / 100000000;
}

function roundAmount(value) {
  return Math.round(Number(value ?? 0) * 1000000000000) / 1000000000000;
}
