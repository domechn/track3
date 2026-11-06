import { coinTransactionPaginationTests } from "./coin-transactions-pagination-scenes";
import { test } from "@playwright/test";

test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
coinTransactionPaginationTests();
