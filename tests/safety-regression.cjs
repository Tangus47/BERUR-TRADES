const fs = require("node:fs");
const assert = require("node:assert/strict");
const trader = fs.readFileSync("deriv-trader.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
function has(source, pattern, message) { assert.match(source, pattern, message); }

has(trader, /account\.account_type!=="demo"/, "Execution must remain DEMO-only.");
has(trader, /REAL execution remains disabled/, "Trade readiness must explicitly block REAL execution.");
has(trader, /ws\.readyState!==WebSocket\.OPEN/, "Purchases must require an open authenticated socket.");
has(trader, /!reconciliationReady\|\|readPendingPurchase\(\)/, "Purchases must wait for reconciliation and pending-buy resolution.");
has(trader, /openContracts\.size>=maxOpenTrades\(\)/, "Open-contract limit must be enforced.");
has(trader, /function maxOpenTrades\(\)\{return 1;\}/, "Only one open contract is permitted.");
has(trader, /settlementAlreadyRecorded\(settledId\)/, "Repeated settlement messages must be deduplicated.");
has(trader, /markSettlementRecorded\(settledId\)/, "Settlement IDs must be persisted before risk accounting.");
has(trader, /if\(openContracts\.size>0\|\|readPendingPurchase\(\)\)/, "Account switching must be blocked while positions/purchases are unresolved.");
has(trader, /DEMO validation only: REAL purchases are disabled/, "Purchase function must independently reject REAL execution.");
has(trader, /baseStake:0\.35,maxTradePct:2,maxExposurePct:2,sessionLossPct:5,sessionProfitPct:3,dailyLossPct:5,dailyProfitPct:3,rapidLossPct:2/, "Approved capital-risk limits must remain unchanged.");
has(trader, /rapidLossWindowMs:60000/, "Rapid-loss window must remain 60 seconds.");
has(trader, /Math\.max\(600,Number\(s\.requiredTicks\|\|0\)\)/, "Digit execution must retain 600-observation minimum.");
has(trader, /Number\(s\.liveObservations\|\|0\)<20/, "Signals must retain minimum live observations.");
has(trader, /EMERGENCY STOP ACTIVATED/, "Emergency stop must remain available.");
has(trader, /function persistOpenTradeState\(\)/, "Open contracts must be persisted for reload recovery.");
has(trader, /function restoreOpenTradeState\(\)/, "Open contracts must be restored before broker reconciliation.");
has(trader, /restoreOpenTradeState\(\);loadRiskState\(\);await connectAccount\(\)/, "Saved open contracts must be restored before the authenticated connection is reconciled.");
has(trader, /persistOpenTradeState\(\);updateRow\(settledId/, "Settlement must remove the saved open-contract record.");
has(html, /DERIV MARKET INTELLIGENCE/, "Main app shell should contain the market-intelligence interface.");
console.log("BERUR TRADES safety regression checks passed.");
