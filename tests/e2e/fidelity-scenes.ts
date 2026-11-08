import type { Page } from "@playwright/test";
import type { FakeS3 } from "../../src/middlelayers/sync/object-store";
import { installTauriBridge as installBaseBridge } from "./fidelity-captures";
import md5 from "md5";

type BaseOptions = Exclude<Parameters<typeof installBaseBridge>[1], FakeS3>;
type SampleMode = "full" | "empty" | "loading" | "BTC" | "NVDA" | "NOVA";
type Sample = {
  sources: { id: string; name: string; kind: string; hue: string; refreshed: string; pos: Record<string, number> }[];
  prices: Record<string, number[]>;
  months: { ym: string; end: number; dep: number; up: number; down: number }[];
  start: number;
  ath: { value: number; date: string; days: number };
  meta: { sym: string; name: string; type: string }[];
  monthMarket: Record<string, Record<string, number>>;
  marketTargets: Record<string, number>;
  transactions: { id: string; d: string; time: string; sym: string; type: string; qty: number; price: number | null; src: string; ref: string; edited?: boolean; imported?: string; unpaired?: boolean }[];
};

const sample = {
  "sources": [
    {
      "id": "binance",
      "name": "Binance",
      "kind": "Exchange",
      "hue": "amber",
      "refreshed": "09:41",
      "pos": {
        "BTC": 1.2,
        "ETH": 20,
        "USDT": 112446.74,
        "BNB": 85.8796,
        "SOL": 410
      }
    },
    {
      "id": "okx",
      "name": "OKX",
      "kind": "Exchange",
      "hue": "sky",
      "refreshed": "09:41",
      "pos": {
        "ETH": 12.8508,
        "USDT": 70000,
        "USDC": 40000
      }
    },
    {
      "id": "ledger",
      "name": "Ledger cold wallet",
      "kind": "Wallet",
      "hue": "mint",
      "refreshed": "09:40",
      "pos": {
        "BTC": 2.0226
      }
    },
    {
      "id": "onchain",
      "name": "0x4f…a91c",
      "kind": "Wallet",
      "hue": "violet",
      "refreshed": "09:40",
      "pos": {
        "ETH": 27
      }
    },
    {
      "id": "ibkr",
      "name": "Interactive Brokers",
      "kind": "Broker",
      "hue": "rose",
      "refreshed": "09:41",
      "pos": {
        "NVDA": 220,
        "AAPL": 150
      }
    }
  ],
  "prices": {
    "BTC": [
      59485.37,
      58634.52,
      58439.4,
      58372.35,
      59469.09,
      60054.9,
      59062.19,
      58504.97,
      58893.35,
      58553.12,
      58052.76,
      57826.12,
      57830.92,
      57379.31,
      58580.6,
      58268.61,
      59502.25,
      59173.25,
      59035.2,
      59105.33,
      58885.37,
      57995.08,
      58752.48,
      60029.57,
      61095.25,
      60997.26,
      61912.84,
      62222.82,
      63169.96,
      63875.02,
      63842.11
    ],
    "ETH": [
      2367.06,
      2332.83,
      2356.13,
      2360.56,
      2384.02,
      2423.06,
      2395.93,
      2373.82,
      2367.22,
      2402.48,
      2444.43,
      2451.69,
      2465.18,
      2422.73,
      2410.35,
      2373.52,
      2342.28,
      2301.07,
      2321.56,
      2341.66,
      2353.47,
      2398.92,
      2415.16,
      2451.83,
      2438.8,
      2465.96,
      2524.33,
      2473.32,
      2535.86,
      2497.7,
      2527.14
    ],
    "SOL": [
      150.23,
      150.66,
      155.43,
      152.72,
      154.05,
      150.28,
      146.55,
      149.96,
      147.86,
      147.11,
      144.53,
      144.74,
      141.4,
      144.66,
      142.02,
      146.42,
      143.35,
      144.07,
      146.19,
      144.87,
      144.07,
      144.86,
      149.38,
      147.27,
      151.89,
      155.79,
      157.99,
      162.32,
      167.01,
      165.87,
      168.4
    ],
    "BNB": [
      549.09,
      557.49,
      556.09,
      552.9,
      557.67,
      560.8,
      565.73,
      562.81,
      570.32,
      570.74,
      580.31,
      576.03,
      569.88,
      566.61,
      570.34,
      565.35,
      560.95,
      561.81,
      560.76,
      555.38,
      549.28,
      553.31,
      561.64,
      564.16,
      562.8,
      561.44,
      569.66,
      567.39,
      576.29,
      585.3,
      579.58
    ],
    "USDT": [
      1.0001,
      1,
      0.9999,
      0.9999,
      0.9998,
      0.9997,
      0.9996,
      0.9994,
      0.9994,
      0.9993,
      0.9992,
      0.9993,
      0.9995,
      0.9996,
      0.9995,
      0.9997,
      0.9998,
      0.9997,
      0.9999,
      0.9997,
      0.9998,
      0.9998,
      0.9996,
      0.9997,
      0.9998,
      0.9998,
      0.9997,
      0.9998,
      1,
      0.9999,
      1
    ],
    "USDC": [
      1.0001,
      1.0003,
      1.0003,
      1.0001,
      1,
      1,
      0.9999,
      0.9998,
      0.9997,
      0.9998,
      0.9997,
      0.9999,
      0.9998,
      0.9998,
      0.9998,
      0.9997,
      0.9996,
      0.9997,
      0.9998,
      1,
      1,
      0.9999,
      0.9998,
      1,
      1,
      1,
      1.0003,
      1.0001,
      1.0001,
      1,
      1
    ],
    "NVDA": [
      135.77,
      137.13,
      138.86,
      136.16,
      137.17,
      139.34,
      138.07,
      138.27,
      140.64,
      140.89,
      138.68,
      137.91,
      135.46,
      134.08,
      132.06,
      131.59,
      133.73,
      133.64,
      134.71,
      137.45,
      138.66,
      141.33,
      140.49,
      138.83,
      139.92,
      138.59,
      138.2,
      140.23,
      142.11,
      143.33,
      141.25
    ],
    "AAPL": [
      231.41,
      233.97,
      234.91,
      234.38,
      235.86,
      236.15,
      236.1,
      237.93,
      240.36,
      239.23,
      238.93,
      239.03,
      239.27,
      237.17,
      235.17,
      237.46,
      238.53,
      239.64,
      239.38,
      240.42,
      242.5,
      241.93,
      240.58,
      238.92,
      237.64,
      235.56,
      237.16,
      236.31,
      233.9,
      231.4,
      229.87
    ]
  },
  "months": [
    {
      "ym": "2025-07",
      "end": 35240000,
      "dep": 4000000,
      "up": 4,
      "down": 2
    },
    {
      "ym": "2025-08",
      "end": 38190000,
      "dep": 2500000,
      "up": 2,
      "down": 4
    },
    {
      "ym": "2025-09",
      "end": 44120000,
      "dep": 3000000,
      "up": 5,
      "down": 1
    },
    {
      "ym": "2025-10",
      "end": 52060000,
      "dep": 3000000,
      "up": 6,
      "down": 0
    },
    {
      "ym": "2025-11",
      "end": 61230000,
      "dep": 2000000,
      "up": 6,
      "down": 0
    },
    {
      "ym": "2025-12",
      "end": 59870000,
      "dep": 1500000,
      "up": 1,
      "down": 5
    },
    {
      "ym": "2026-01",
      "end": 65540000,
      "dep": 2500000,
      "up": 5,
      "down": 1
    },
    {
      "ym": "2026-02",
      "end": 61280000,
      "dep": 0,
      "up": 0,
      "down": 6
    },
    {
      "ym": "2026-03",
      "end": 74410000,
      "dep": 3000000,
      "up": 6,
      "down": 0
    },
    {
      "ym": "2026-04",
      "end": 70250000,
      "dep": 0,
      "up": 2,
      "down": 4
    },
    {
      "ym": "2026-05",
      "end": 73190000,
      "dep": 2000000,
      "up": 4,
      "down": 2
    },
    {
      "ym": "2026-06",
      "end": 70630000,
      "dep": 1000000,
      "up": 2,
      "down": 4
    },
    {
      "ym": "2026-07",
      "end": 74460000,
      "dep": 0,
      "up": 5,
      "down": 1
    },
    {
      "ym": "2026-08",
      "end": 74880000,
      "dep": 2000000,
      "up": 3,
      "down": 3
    },
    {
      "ym": "2026-09",
      "end": 72916779,
      "dep": 0,
      "up": 2,
      "down": 4
    },
    {
      "ym": "2026-10",
      "end": 76380927,
      "dep": 0,
      "up": 5,
      "down": 1
    }
  ],
  "start": 31000000,
  "ath": {
    "value": 80124050,
    "date": "19 Mar 2026",
    "days": 226
  },
  "meta": [
    {
      "sym": "BTC",
      "name": "Bitcoin",
      "type": "crypto"
    },
    {
      "sym": "USDT",
      "name": "Tether",
      "type": "stable"
    },
    {
      "sym": "ETH",
      "name": "Ethereum",
      "type": "crypto"
    },
    {
      "sym": "SOL",
      "name": "Solana",
      "type": "crypto"
    },
    {
      "sym": "BNB",
      "name": "BNB",
      "type": "crypto"
    },
    {
      "sym": "USDC",
      "name": "USD Coin",
      "type": "stable"
    },
    {
      "sym": "AAPL",
      "name": "Apple",
      "type": "stock"
    },
    {
      "sym": "NVDA",
      "name": "NVIDIA",
      "type": "stock"
    }
  ],
  "transactions": [
    {
      "time": "13:30",
      "id": "e1",
      "d": "2022-11-10",
      "sym": "ETH",
      "type": "buy",
      "qty": 30,
      "price": 1260,
      "src": "binance",
      "ref": "Order 7418222193"
    },
    {
      "time": "14:22",
      "id": "b1",
      "d": "2023-06-20",
      "sym": "BTC",
      "type": "buy",
      "qty": 1.5,
      "price": 26400,
      "src": "binance",
      "ref": "Order 7410913577"
    },
    {
      "time": "15:31",
      "id": "v1",
      "d": "2023-10-24",
      "sym": "NVDA",
      "type": "buy",
      "qty": 150,
      "price": 48.2,
      "src": "ibkr",
      "ref": "Trade 333421"
    },
    {
      "time": "10:14",
      "id": "e2",
      "d": "2024-02-20",
      "sym": "ETH",
      "type": "buy",
      "qty": 25,
      "price": 2980,
      "src": "binance",
      "ref": "Order 7419135770"
    },
    {
      "time": "09:05",
      "id": "b2",
      "d": "2024-03-12",
      "sym": "BTC",
      "type": "buy",
      "qty": 0.8,
      "price": 68900,
      "src": "binance",
      "ref": "Order 7411827154"
    },
    {
      "time": "14:10",
      "id": "a1",
      "d": "2024-09-10",
      "sym": "AAPL",
      "type": "buy",
      "qty": 20,
      "price": 171.5,
      "src": "ibkr",
      "ref": "Trade 333622"
    },
    {
      "time": "09:12",
      "id": "s1",
      "d": "2024-11-05",
      "sym": "SOL",
      "type": "buy",
      "qty": 200,
      "price": 98.5,
      "src": "binance",
      "ref": "Order 7425530809"
    },
    {
      "time": "18:47",
      "id": "b3",
      "d": "2025-01-14",
      "sym": "BTC",
      "type": "buy",
      "qty": 0.6,
      "price": 96200,
      "src": "binance",
      "ref": "Order 7412740731"
    },
    {
      "time": "11:12",
      "id": "b4w",
      "d": "2025-02-03",
      "sym": "BTC",
      "type": "withdraw",
      "qty": 2.0226,
      "price": null,
      "src": "binance",
      "pair": "b4d",
      "to": "ledger",
      "ref": "Order 7413654308"
    },
    {
      "time": "11:49",
      "id": "b4d",
      "d": "2025-02-03",
      "sym": "BTC",
      "type": "deposit",
      "qty": 2.0226,
      "price": null,
      "src": "ledger",
      "pair": "b4w",
      "from": "binance",
      "ref": "txid 8f8a30…c1ad"
    },
    {
      "time": "11:00",
      "id": "n1",
      "d": "2025-03-18",
      "sym": "BNB",
      "type": "buy",
      "qty": 6,
      "price": 540,
      "src": "binance",
      "ref": "Order 7428271540"
    },
    {
      "time": "21:40",
      "id": "e3",
      "d": "2025-04-08",
      "sym": "ETH",
      "type": "buy",
      "qty": 12.8508,
      "price": 1610,
      "src": "okx",
      "ref": "Order 2238483233"
    },
    {
      "time": "16:02",
      "id": "v2",
      "d": "2025-05-06",
      "sym": "NVDA",
      "type": "buy",
      "qty": 100,
      "price": 118.4,
      "src": "ibkr",
      "ref": "Trade 333488"
    },
    {
      "time": "07:55",
      "id": "e4w",
      "d": "2025-06-02",
      "sym": "ETH",
      "type": "withdraw",
      "qty": 27,
      "price": null,
      "src": "binance",
      "pair": "e4d",
      "to": "onchain",
      "ref": "Order 7420962924"
    },
    {
      "time": "08:20",
      "id": "e4d",
      "d": "2025-06-02",
      "sym": "ETH",
      "type": "deposit",
      "qty": 27,
      "price": null,
      "src": "onchain",
      "pair": "e4w",
      "from": "binance",
      "ref": "txid 0x5d2e5f…a35f"
    },
    {
      "time": "15:20",
      "id": "a2",
      "d": "2025-12-02",
      "sym": "AAPL",
      "type": "buy",
      "qty": 160,
      "price": 236.4,
      "src": "ibkr",
      "ref": "Trade 333689"
    },
    {
      "time": "10:37",
      "id": "n2",
      "d": "2025-12-09",
      "sym": "BNB",
      "type": "buy",
      "qty": 94,
      "price": 585,
      "src": "binance",
      "ref": "Order 7429185117"
    },
    {
      "time": "08:31",
      "id": "b5",
      "d": "2026-02-09",
      "sym": "BTC",
      "type": "buy",
      "qty": 0.5,
      "price": 58200,
      "src": "binance",
      "edited": true,
      "imported": "deposit",
      "ref": "Order 7415481462"
    },
    {
      "time": "17:34",
      "id": "s2",
      "d": "2026-03-18",
      "sym": "SOL",
      "type": "buy",
      "qty": 245,
      "price": 142.3,
      "src": "binance",
      "ref": "Order 7426444386"
    },
    {
      "time": "15:26",
      "id": "e5",
      "d": "2026-04-14",
      "sym": "ETH",
      "type": "sell",
      "qty": 8,
      "price": 3480,
      "src": "binance",
      "ref": "Order 7422790078"
    },
    {
      "time": "16:03",
      "id": "b6",
      "d": "2026-06-08",
      "sym": "BTC",
      "type": "sell",
      "qty": 0.35,
      "price": 71000,
      "src": "binance",
      "ref": "Order 7416395039"
    },
    {
      "time": "12:09",
      "id": "e6",
      "d": "2026-06-17",
      "sym": "ETH",
      "type": "buy",
      "qty": 5,
      "price": 2890,
      "src": "binance",
      "ref": "Order 7423703655"
    },
    {
      "time": "15:45",
      "id": "v3",
      "d": "2026-07-15",
      "sym": "NVDA",
      "type": "sell",
      "qty": 30,
      "price": 137.9,
      "src": "ibkr",
      "ref": "Trade 333555"
    },
    {
      "time": "14:52",
      "id": "n3",
      "d": "2026-08-11",
      "sym": "BNB",
      "type": "sell",
      "qty": 14.1204,
      "price": 612,
      "src": "binance",
      "ref": "Order 7430098694"
    },
    {
      "time": "20:11",
      "id": "x1",
      "d": "2026-08-22",
      "sym": "NOVA",
      "type": "deposit",
      "qty": 8000,
      "price": null,
      "src": "onchain",
      "ref": "txid 0x5f2a0f…a45f"
    },
    {
      "time": "19:18",
      "id": "e7",
      "d": "2026-09-03",
      "sym": "ETH",
      "type": "sell",
      "qty": 5,
      "price": 2610,
      "src": "binance",
      "ref": "Order 7424617232"
    },
    {
      "time": "22:05",
      "id": "s3",
      "d": "2026-09-18",
      "sym": "SOL",
      "type": "withdraw",
      "qty": 35,
      "price": null,
      "src": "binance",
      "unpaired": true,
      "ref": "Order 7427357963"
    },
    {
      "time": "18:26",
      "id": "x2",
      "d": "2026-09-30",
      "sym": "NOVA",
      "type": "buy",
      "qty": 4000,
      "price": 0.395,
      "src": "onchain",
      "edited": true,
      "imported": "deposit",
      "ref": "txid 0x5f49ca…a46f"
    },
    {
      "time": "09:58",
      "id": "b7",
      "d": "2026-10-02",
      "sym": "BTC",
      "type": "buy",
      "qty": 0.1726,
      "price": 58634.52,
      "src": "binance",
      "ref": "Order 7417308616"
    },
    {
      "time": "16:15",
      "id": "a3",
      "d": "2026-10-06",
      "sym": "AAPL",
      "type": "sell",
      "qty": 30,
      "price": 236.15,
      "src": "ibkr",
      "ref": "Trade 333756"
    }
  ],
  "marketTargets": {
    "BTC": 10432927,
    "USDT": 0,
    "ETH": 6940000,
    "USDC": 0,
    "BNB": 1765000,
    "NVDA": 985000,
    "SOL": -930000,
    "AAPL": -312000
  },
  "monthMarket": {
    "2025-07": {
      "BTC": 2134.98424,
      "ETH": 2853.87084,
      "SOL": 0.0001,
      "BNB": 0.0001,
      "NVDA": -1288.21349,
      "AAPL": -1322.88586,
      "USDT": 18.24467,
      "USDC": 4
    },
    "2025-08": {
      "BTC": -33.45217,
      "ETH": 6159.29808,
      "SOL": 0.0001,
      "BNB": -1016.45958,
      "NVDA": -308.02749,
      "AAPL": -301.35833
    },
    "2025-09": {
      "BTC": 19965.00497,
      "ETH": -3332.05877,
      "SOL": 3104.67713,
      "BNB": 3769.47234,
      "NVDA": 2734.34877,
      "AAPL": 3058.55617
    },
    "2025-10": {
      "BTC": 20196.06543,
      "ETH": 16329.81386,
      "SOL": 3182.2193,
      "BNB": 3825.3728,
      "NVDA": 2769.24859,
      "AAPL": 3097.28065
    },
    "2025-11": {
      "BTC": 33670.88191,
      "ETH": 22560.21385,
      "SOL": 1026.3045599999996,
      "BNB": 5875.68535,
      "NVDA": 4049.30116,
      "AAPL": 4517.6138
    },
    "2025-12": {
      "BTC": -12507.8363,
      "ETH": -7712.99457,
      "SOL": -7792.96643,
      "BNB": -4086.68293,
      "NVDA": -2170.41157,
      "AAPL": 5670.89242
    },
    "2026-01": {
      "BTC": 16862.25494,
      "ETH": 13878.90853,
      "SOL": 2063.41734,
      "BNB": 3018.82395,
      "NVDA": 2265.70345,
      "AAPL": -6389.10758
    },
    "2026-02": {
      "BTC": -14767.30301,
      "ETH": -9374.07849,
      "SOL": -8551.22662,
      "BNB": -4633.31577,
      "NVDA": -2511.68577,
      "AAPL": -2762.38973
    },
    "2026-03": {
      "BTC": 34919.96567,
      "ETH": 30830.16182,
      "SOL": 14801.41324,
      "BNB": 8597.17646,
      "NVDA": 5748.38438,
      "AAPL": 6402.89905
    },
    "2026-04": {
      "BTC": -20879.8509,
      "ETH": -13867.81808,
      "SOL": -10602.55214,
      "BNB": 4405.56602,
      "NVDA": 3131.47523,
      "AAPL": -3786.81951
    },
    "2026-05": {
      "BTC": 6914.50737,
      "ETH": 6565.65915,
      "SOL": -4210.58007,
      "BNB": -1504.12613,
      "NVDA": 763.17654,
      "AAPL": 871.36376
    },
    "2026-06": {
      "BTC": 7520.26389,
      "ETH": -18928.3988,
      "SOL": -12912.63224,
      "BNB": -7777.47071,
      "NVDA": -4474.64678,
      "AAPL": 972.88526
    },
    "2026-07": {
      "BTC": 21076.89179,
      "ETH": 18242.20141,
      "SOL": 1142.22551,
      "BNB": 2796.54112,
      "NVDA": 2751.24837,
      "AAPL": -7709.10758
    },
    "2026-08": {
      "BTC": -13567.3452,
      "ETH": 1686.57396,
      "SOL": 1000.0001,
      "BNB": 1000.0001,
      "NVDA": -2849.25119,
      "AAPL": -3069.97715
    },
    "2026-09": {
      "BTC": -11215.79293,
      "ETH": -6072.26886,
      "SOL": 1000.0001,
      "BNB": 760.94788,
      "NVDA": -1966.25021,
      "AAPL": -2138.84536
    }
  }
} as Sample;

export async function seedDesktopSourceStatuses(page: Page) {
  await page.addInitScript((sources) => localStorage.setItem("track3-refresh-source-statuses", JSON.stringify(
    sources.map((source, index) => ({
      sourceId: `sample:${source.id}`,
      label: source.name,
      kind: source.kind.toLowerCase(),
      provider: source.id,
      status: "ok",
      startedAt: [
        "2026-10-31T09:40:56.900Z", "2026-10-31T09:40:53.200Z",
        "2026-10-31T09:39:55.800Z", "2026-10-31T09:39:55.000Z",
        "2026-10-31T09:40:56.500Z",
      ][index],
      finishedAt: index === 2 || index === 3
        ? "2026-10-31T09:40:00.000Z" : "2026-10-31T09:41:00.000Z",
      lastSuccessAt: `2026-10-31T09:41:00.000Z`,
    })),
  )), sample.sources);
}

export async function seedDesktopAiSummary(page: Page, summary = "BTC drove the week — it added $12,286.29 of the $26,010.84 gain: 47% of it.\nStablecoins are 29.1% of the portfolio — USDT and USDC total $222,446.74.\nAAPL is the one position down — it is −3.8% over 7 days while the total is +3.5%.") {
  await page.evaluate(async (summary) => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (992, ?)",
    values: [`!ent:e2e:${JSON.stringify({
      snapshotUuid: "fidelity-day-30", dismissedIds: [],
      insights: [{ id: "week:btc", severity: "info", messageKey: "insights.newAsset",
        data: { symbol: "BTC", value: 205737.58 } }],
      summary,
      summaryLocale: "en", summarySnapshotUuid: "fidelity-day-30",
    })}`],
  }), summary);
}

export async function installTauriBridge(page: Page, options: BaseOptions & { fidelitySample?: SampleMode; slowBackup?: boolean; fidelitySlowSummary?: boolean; fidelitySlowCoin?: boolean; slowRefreshPersist?: boolean; firstRunBinance?: boolean; keyRecoveryNeeded?: boolean; quotaUsageFixture?: "near" | "exhausted"; routeDemoR2ToFakeS3?: boolean } = {}) {
  const { fidelitySample, slowBackup = false, fidelitySlowSummary = false, fidelitySlowCoin = false, slowRefreshPersist = false, firstRunBinance = false, keyRecoveryNeeded = false, quotaUsageFixture, routeDemoR2ToFakeS3 = false, ...baseOptions } = options;
  const result = await installBaseBridge(page, baseOptions);
  if (routeDemoR2ToFakeS3) await page.addInitScript(() => {
    const original = (window as any).__e2eInvoke;
    (window as any).__e2eInvoke = (cmd: string, args: any, ...rest: any[]) => {
      if (cmd === "plugin:http|fetch" && args.clientConfig?.url) {
        const url = new URL(args.clientConfig.url);
        if (url.hostname === "demo.r2.cloudflarestorage.com") {
          url.hostname = "s3.example.test";
          args = { ...args, clientConfig: { ...args.clientConfig, url: url.href } };
        }
      }
      return original(cmd, args, ...rest);
    };
  });
  if (quotaUsageFixture) await page.addInitScript((quotaUsageFixture) => {
    const original = (window as any).__e2eInvoke;
    const usageRequests = new Set<number>();
    const usageResponses = new Set<number>();
    (window as any).__e2eInvoke = async (cmd: string, args: any, ...rest: any[]) => {
      if (cmd === "plugin:http|fetch") {
        const rid = await original(cmd, args, ...rest);
        const request = args.clientConfig;
        if (new URL(request.url).pathname === "/api/license" &&
          JSON.parse(new TextDecoder().decode(Uint8Array.from(request.data ?? []))).action === "usage") {
          usageRequests.add(rid);
        }
        return rid;
      }
      if (cmd === "plugin:http|fetch_send") {
        const response = await original(cmd, args, ...rest);
        if (usageRequests.has(args.rid)) usageResponses.add(response.rid);
        return response;
      }
      if (cmd === "plugin:http|fetch_read_body" && usageResponses.has(args.rid)) {
        const bytes = await original(cmd, args, ...rest);
        if (bytes.at(-1) !== 0) return bytes;
        const response = JSON.parse(new TextDecoder().decode(Uint8Array.from(bytes.slice(0, -1))));
        response.usage.erc20 = { limit: 50, used: quotaUsageFixture === "near" ? 47 : 50,
          remaining: quotaUsageFixture === "near" ? 3 : 0,
          periodStart: "2026-10-03T00:00:00.000Z", periodEnd: "2026-11-01T00:00:00.000Z" };
        return [...new TextEncoder().encode(JSON.stringify(response)), 0];
      }
      return original(cmd, args, ...rest);
    };
  }, quotaUsageFixture);
  if (firstRunBinance) await page.evaluate(async () => {
    await (window as any).__e2eInvoke("plugin:sql|execute", {
      query: "INSERT INTO configuration (id, data) VALUES (10, ?)",
      values: ["!ent:e2e:exchanges:\n  - name: binance\n    alias: Binance\n    initParams:\n      apiKey: demo-key\n      secret: demo-secret\n"],
    });
  });
  if (keyRecoveryNeeded) await page.addInitScript(() => {
    const original = (window as any).__e2eInvoke;
    (window as any).__e2eInvoke = (cmd: string, args: unknown) =>
      cmd === "ios_key_recovery_needed" ? Promise.resolve(true) : original(cmd, args);
  });
  if (slowBackup || fidelitySlowSummary || fidelitySlowCoin || slowRefreshPersist) {
    await page.addInitScript(({ slowBackup, fidelitySlowSummary, fidelitySlowCoin, slowRefreshPersist }) => {
      const original = (window as any).__e2eInvoke;
      let backupDelayed = false;
      (window as any).__e2eInvoke = async (cmd: string, args: any, ...rest: any[]) => {
        if (fidelitySlowSummary && cmd === "plugin:sql|select" && /SUM\(value\) as totalValue, uuid, createdAt/i.test(args.query)
          && /uuid NOT IN \(SELECT uuid FROM snapshot_partial\)/i.test(args.query)) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        if (fidelitySlowCoin && cmd === "plugin:sql|select" && /transactions/i.test(args.query)
          && args.values?.includes("BTC")) await new Promise((resolve) => setTimeout(resolve, 5000));
        if (slowRefreshPersist && cmd === "persist_refresh") await new Promise((resolve) => setTimeout(resolve, 7000));
        if (slowBackup && !backupDelayed && cmd === "plugin:fs|exists" && String(args.path).includes("track3-backup")) {
          backupDelayed = true;
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        return original(cmd, args, ...rest);
      };
    }, { slowBackup, fidelitySlowSummary, fidelitySlowCoin, slowRefreshPersist });
  }
  const walletIds = Object.fromEntries(Object.entries({
    binance: "binance-fidelity-binance-key",
    okx: "okex-fidelity-okx-key",
    ledger: "bc1qfidelityledgerwallet",
    onchain: "0x4f0000000000000000000000000000000000a91c",
    ibkr: "ibkr:fidelity-query",
  }).map(([id, identity]) => [id, md5(identity)]));
  if (fidelitySample) await page.evaluate(async ({ sample, fidelitySample, walletIds }) => {
    const invoke = (window as any).__e2eInvoke as (cmd: string, args: { query: string; values: unknown[] }) => Promise<any>;
    const db = {
      run: (query: string, values: unknown[] = []) => invoke("plugin:sql|execute", { query, values }),
      select: (query: string, values: unknown[] = []) => invoke("plugin:sql|select", { query, values }) as Promise<{ id: number }[]>,
    };
    await db.run("DELETE FROM alert_history");
    for (const title of ["BTC price alert", "Portfolio target alert"]) {
      await db.run(`INSERT INTO alert_history (kind, title, message, value, triggered_at, acknowledged_at)
        VALUES ('price', ?, 'Design fixture alert', 1, '2026-10-31T09:41:00.000Z', NULL)`, [title]);
    }
    const sourceWallet = (id: string) => walletIds[id] ?? id;
    await db.run("INSERT OR REPLACE INTO configuration (id, data) VALUES (10, ?)", [
      "!ent:e2e:exchanges:\n  - name: binance\n    alias: Binance\n    initParams:\n      apiKey: fidelity-binance-key\n      secret: demo-secret\n  - name: okx\n    alias: OKX\n    initParams:\n      apiKey: fidelity-okx-key\n      secret: demo-secret\n      password: demo-password\n",
    ]);
    await db.run("INSERT OR REPLACE INTO configuration (id, data) VALUES (11, ?)", [
      "btc:\n  addresses:\n    - address: bc1qfidelityledgerwallet\n      alias: Ledger cold wallet\nerc20:\n  addresses:\n    - address: '0x4f0000000000000000000000000000000000a91c'\n      alias: 0x4f…a91c\nsol: {addresses: []}\ndoge: {addresses: []}\ntrc20: {addresses: []}\nton: {addresses: []}\nsui: {addresses: []}\n",
    ]);
    await db.run("INSERT OR REPLACE INTO configuration (id, data) VALUES (20, ?)", [
      "!ent:e2e:brokers:\n  - name: ibkr\n    alias: Interactive Brokers\n    initParams:\n      token: demo-token\n      queryId: fidelity-query\n",
    ]);
    await db.run("INSERT OR REPLACE INTO configuration (id, data) VALUES (6, ?)", ["31"]);
    await db.run("DELETE FROM transactions");
    await db.run("DELETE FROM assets_v2");
    await db.run("UPDATE configuration SET data = ? WHERE id = 12", [
      `configs:\n  groupUSD: false\nothers:\n  - symbol: BTC\n    alias: Bitcoin\n    amount: 0\n  - symbol: NVDA\n    alias: NVIDIA\n    amount: 0\n  - symbol: NOVA\n    alias: Nova\n    amount: 12000\n    price:\n      kind: manual\n      usd: 0.421\n      setAt: '2026-10-12T10:00:00.000Z'\n`,
    ]);
    const assetType = Object.fromEntries(sample.meta.map(({ sym, type }) => [sym, type === "stock" ? "stock" : "crypto"]));
    const current = sample.sources.flatMap((source) => Object.entries(source.pos).map(([symbol, amount]) => ({
      source: sourceWallet(source.id), symbol, amount,
    })));
    const symbols = [...new Set(current.map((row) => row.symbol))];
    const finalAmounts = Object.fromEntries(symbols.map((symbol) => [symbol,
      current.filter((row) => row.symbol === symbol).reduce((sum, row) => sum + row.amount, 0)]));
    type State = Record<string, { amount: number; price: number }>;
    const stateFromDay = (day: number): State => Object.fromEntries(symbols.map((symbol) =>
      [symbol, { amount: finalAmounts[symbol], price: sample.prices[symbol][day] }]));
    const endStates = new Map<string, State>();
    let nextState = stateFromDay(0);
    const historyMonths = sample.months.filter((month) => month.ym !== "2026-10");
    for (let index = historyMonths.length - 1; index >= 0; index--) {
      const month = historyMonths[index];
      endStates.set(month.ym, nextState);
      nextState = Object.fromEntries(symbols.map((symbol) => {
        const after = nextState[symbol];
        const amount = after.amount * (1 - month.dep / month.end);
        const effect = sample.monthMarket[month.ym][symbol] ?? 0;
        return [symbol, { amount, price: after.price - effect / amount }];
      }));
    }
    const startState = nextState;
    const scaleState = (state: State, totalCents: number): State => {
      const nominal = symbols.reduce((sum, symbol) => sum + state[symbol].amount * state[symbol].price, 0);
      return Object.fromEntries(symbols.map((symbol) => [symbol, {
        amount: state[symbol].amount, price: state[symbol].price * totalCents / 100 / nominal,
      }]));
    };
    const addSnapshot = async (uuid: string, at: string, state: State, targetCents: number) => {
      const rows = current.map((row) => {
        const price = state[row.symbol].price;
        const amount = state[row.symbol].amount * row.amount / finalAmounts[row.symbol];
        const value = Math.round(amount * price * 100) / 100;
        return { row, amount, value };
      });
      rows[rows.length - 1].value = Math.round((rows[rows.length - 1].value +
        targetCents / 100 - rows.reduce((sum, item) => sum + item.value, 0)) * 100) / 100;
      for (const { row, amount, value } of rows) {
        await db.run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuid, at, row.source, assetType[row.symbol], row.symbol, amount, value, value / amount]);
      }
    };
    if (fidelitySample !== "empty") {
      const originalStart = scaleState(startState, sample.start);
      const quantityTargets: Record<string, number> = {
        BTC: 38_000, ETH: 25_000, SOL: 22_000, BNB: 6_000,
        NVDA: 8_000, AAPL: 6_000, USDT: 120_000, USDC: 40_000,
      };
      const targetStart: State = Object.fromEntries(symbols.map((symbol) => {
        const nextPrice = endStates.get("2025-07")![symbol].price;
        const original = originalStart[symbol];
        const firstMarketEffect = original.amount * (nextPrice - original.price);
        const desiredValue = finalAmounts[symbol] * sample.prices[symbol][30]
          - (sample.marketTargets[symbol] ?? 0) / 100 - quantityTargets[symbol];
        // One cent offsets rounding across source rows while retaining the approved aggregate.
        const amount = (desiredValue + firstMarketEffect - (symbol === "BTC" ? 0.01 : 0)) / nextPrice;
        return [symbol, { amount, price: desiredValue / amount }];
      }));
      await addSnapshot("fidelity-start", "2025-07-01T09:41:00.000Z", targetStart, sample.start);
      for (const month of historyMonths) {
        const day = month.ym === "2026-09" ? "30" : "28";
        await addSnapshot(`fidelity-${month.ym}`, `${month.ym}-${day}T09:41:00.000Z`, endStates.get(month.ym)!, month.end);
      }
      await addSnapshot("fidelity-previous-high", "2026-01-27T09:41:00.000Z", scaleState(endStates.get("2025-12")!, 66_820_000), 66_820_000);
      await addSnapshot("fidelity-ath", "2026-03-19T09:41:00.000Z", scaleState(endStates.get("2026-02")!, sample.ath.value), sample.ath.value);
      await addSnapshot("fidelity-lowest-since", "2026-04-22T09:41:00.000Z", scaleState(endStates.get("2026-03")!, 68_130_000), 68_130_000);
    }
    for (let day = fidelitySample === "empty" ? 30 : 0; day <= 30; day++) {
      const date = `2026-10-${String(day + 1).padStart(2, "0")}`;
      const total = symbols.reduce((sum, symbol) =>
        sum + Math.round(finalAmounts[symbol] * sample.prices[symbol][day] * 100), 0);
      await addSnapshot(`fidelity-day-${day}`, `${date}T09:41:00.000Z`, stateFromDay(day), total);
    }
    if (fidelitySample === "full") {
      let previousUuid = "fidelity-start";
      for (const month of historyMonths) {
        const uuid = `fidelity-${month.ym}`;
        let netFlow = 0;
        for (const symbol of symbols) {
          const [before, after] = await Promise.all([previousUuid, uuid].map(async (snapshot) =>
            (await db.select(`SELECT SUM(amount) AS amount, SUM(value) AS value FROM assets_v2
              WHERE uuid = ? AND symbol = ?`, [snapshot, symbol]))[0] as unknown as { amount: number; value: number }));
          const market = sample.monthMarket[month.ym][symbol] ?? 0;
          const flow = after.value - before.value - market
            + (month.ym === "2025-07" && symbol === "USDT" ? .01 : 0);
          const amount = after.amount - before.amount;
          netFlow += flow;
          if (Math.abs(amount) < 1e-9 && Math.abs(flow) < .02) continue;
          if (amount * flow <= 0) throw new Error(`Invalid ${month.ym} ${symbol} fixture flow`);
          const type = amount > 0 ? "deposit" : "sell";
          const asset = (await db.select("SELECT id FROM assets_v2 WHERE uuid = ? AND symbol = ? ORDER BY id DESC LIMIT 1", [uuid, symbol]))[0]?.id;
          await db.run(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuid, asset, assetType[symbol], sourceWallet(symbol === "NVDA" || symbol === "AAPL" ? "ibkr" : "binance"),
            symbol, Math.abs(amount), Math.abs(flow / amount), type, `${month.ym}-15T09:41:00.000Z`]);
        }
        if (Math.abs(netFlow - month.dep / 100) > .02) throw new Error(`Invalid ${month.ym} deposit total`);
        previousUuid = uuid;
      }
    }
    if (fidelitySample === "NOVA") {
      await db.run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
        VALUES ('fidelity-day-30', '2026-10-31T09:41:00.000Z', ?, 'crypto', 'NOVA', 12000, 5052, 0.421)`, [sourceWallet("onchain")]);
    }
    if (fidelitySample !== "empty" && fidelitySample !== "full") {
      for (const tx of sample.transactions) {
        if (tx.sym === "NOVA" && fidelitySample !== "NOVA") continue;
        if (tx.id === "s3" && ["full", "loading"].includes(fidelitySample)) continue;
        const type = assetType[tx.sym] ?? "crypto";
        const asset = (await db.select("SELECT id FROM assets_v2 WHERE symbol = ? AND wallet = ? ORDER BY id DESC LIMIT 1", [tx.sym, sourceWallet(tx.src)]))[0]?.id;
        if (asset === undefined) continue;
        await db.run(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ["fidelity-day-30", asset, type, sourceWallet(tx.src), tx.sym, tx.qty, tx.edited ? 0 : tx.price ?? 0, tx.edited ? tx.imported : tx.type,
          `${tx.d}T${tx.time}:00.000Z`]);
        if (tx.edited && tx.imported) {
          const id = (await db.select("SELECT id FROM transactions ORDER BY id DESC LIMIT 1"))[0].id;
          await invoke("update_local_transaction_type", { id, txnType: tx.type } as never);
          if (tx.price !== null) await invoke("update_local_transaction_price", { id, price: tx.price } as never);
        }
      }
    }
  }, { sample, fidelitySample, walletIds });
  return result;
}

export async function seedSettingsSnapshots(page: Page) {
  await page.evaluate(async () => {
    const execute = (query: string) => (window as any).__e2eInvoke("plugin:sql|execute", { query, values: [] });
    await execute("DELETE FROM history_snapshots");
    await execute("INSERT INTO history_snapshots (uuid, createdAt) SELECT uuid, MAX(createdAt) FROM assets_v2 GROUP BY uuid");
  });
}
