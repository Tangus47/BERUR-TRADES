/* BERUR TRADES — MANUAL DEMO EXECUTION
   DEMO ACCOUNT ONLY
   USD stake: $0.35
   Duration: 5 ticks
   Manual confirmation required for every purchase.
   No automatic trading or purchase loops.
*/
(() => {
  "use strict";

  const APP_ID = "34RcebpeLamDpn5C515Yg";
  const API = "https://api.derivws.com";
  const STAKE = 0.35;
  const DURATION = 5;
  const QUOTE_MAX_AGE_MS = 30000;

  let ws = null;
  let connected = false;
  let stopped = false;
  let requestId = 200;

  const requests = new Map();

  let pendingProposal = null;
  let quoteInProgress = false;
  let buyInProgress = false;
  let refreshTimer = null;

  const el = id => document.getElementById(id);

  function status(message, color = "#facc15") {
    const node = el("manualStatus");
    if (node) {
      node.textContent = message;
      node.style.color = color;
    }
  }

  function output(message) {
    const node = el("manualOutput");
    if (node) node.textContent = message;
  }

  function setQuoteButtonEnabled(enabled) {
    const button = el("manualQuote");
    if (button) {
      button.disabled = !enabled;
      button.style.opacity = enabled ? "1" : "0.55";
    }
  }

  function clearPendingProposal(message) {
    pendingProposal = null;

    const button = el("manualBuy");
    if (button) {
      button.disabled = true;
      button.textContent = "DEMO BUY — GET A FRESH QUOTE";
      button.style.background = "#555";
    }

    if (message) output(message);
  }

  function invalidateConnection(message) {
    connected = false;
    clearPendingProposal(message || "Connection ended. No purchase made.");

    requests.forEach(item => {
      clearTimeout(item.timer);
      item.reject(new Error("Demo connection closed."));
    });

    requests.clear();
  }

  function createPanel() {
    if (el("berurManualPanel")) return;

    const panel = document.createElement("section");
    panel.id = "berurManualPanel";

    panel.style.cssText =
      "margin:16px 0;padding:16px;background:#10251d;color:white;" +
      "border:2px solid #16a34a;border-radius:12px;font-family:Arial;";

    panel.innerHTML = `
      <h2 style="color:#4ade80">BERUR TRADES — MANUAL DEMO</h2>

      <p style="color:#facc15;font-weight:bold">
        DEMO ONLY | MANUAL CONFIRMATION REQUIRED
      </p>

      <p style="color:#cbd5e1">
        Stake: $0.35 USD | Duration: 5 ticks
      </p>

      <button id="manualConnect"
        style="padding:12px;background:#16a34a;color:white;border:0;border-radius:7px">
        CONNECT MANUAL DEMO SESSION
      </button>

      <button id="manualDisconnect"
        style="padding:12px;background:#991b1b;color:white;border:0;border-radius:7px">
        DISCONNECT
      </button>

      <div id="manualStatus" style="margin-top:12px;color:#facc15">
        NOT CONNECTED
      </div>

      <hr style="margin:15px 0;border-color:#365447">

      <label>Qualified market</label>

      <select id="manualMarket"
        style="width:100%;padding:12px;margin:8px 0">
      </select>

      <div id="manualSignal" style="margin:8px 0;color:#cbd5e1">
        Waiting for analyzer signal.
      </div>

      <p>Contract duration: 5 ticks</p>
      <p>Stake: $0.35 USD</p>

      <button id="manualQuote"
        style="padding:13px;width:100%;background:#2563eb;color:white;border:0;border-radius:7px;font-weight:bold">
        CHECK CONTRACT AND GET QUOTE
      </button>

      <pre id="manualOutput"
        style="white-space:pre-wrap;background:#07150f;padding:12px;border-radius:8px;margin-top:12px">No quote requested.</pre>

      <button id="manualBuy" disabled
        style="padding:13px;width:100%;background:#555;color:white;border:0;border-radius:7px">
        DEMO BUY — GET A FRESH QUOTE
      </button>

      <p style="font-size:12px;color:#facc15">
        A purchase is made only after you press DEMO BUY and confirm.
        Never retry a purchase when its result is uncertain.
      </p>

      <button id="manualStop"
        style="padding:12px;width:100%;margin-top:10px;background:#991b1b;color:white;border:0;border-radius:7px">
        STOP REQUESTS
      </button>
    `;

    const original = el("berurDemoPanel");

    if (original && original.parentElement) {
      original.parentElement.insertBefore(panel, original.nextSibling);
    } else {
      document.body.prepend(panel);
    }

    el("manualConnect").onclick = connect;
    el("manualDisconnect").onclick = disconnect;
    el("manualQuote").onclick = getQuote;
    el("manualBuy").onclick = buyDemo;

    el("manualStop").onclick = () => {
      stopped = true;
      clearPendingProposal("STOPPED — no purchase can be made.");
      setQuoteButtonEnabled(false);
      status("REQUESTS STOPPED — DISCONNECT TO RESET", "#f87171");
    };

    el("manualMarket").onchange = () => {
      clearPendingProposal("Market changed. Get a fresh quote.");
      showSignal();
    };

    refreshMarkets();

    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refreshMarkets, 2500);
  }

  function candidates() {
    try {
      if (typeof radarCandidates !== "function") return [];

      const list = radarCandidates();

      if (!Array.isArray(list)) return [];

      return list.filter(m =>
        m &&
        m.available &&
        m.analysis &&
        m.analysis.allowed &&
        ["RISE", "FALL"].includes(m.analysis.direction)
      );
    } catch (error) {
      return [];
    }
  }

  function refreshMarkets() {
    const select = el("manualMarket");
    if (!select) return;

    const list = candidates();
    const previous = select.value;

    select.innerHTML = "";

    if (!list.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "NO QUALIFIED MARKET — WAIT";
      select.appendChild(option);

      showSignal();
      return;
    }

    list.forEach(m => {
      const option = document.createElement("option");
      option.value = m.symbol;
      option.textContent =
        m.symbol + " | " +
        m.analysis.direction + " | " +
        m.analysis.score + "/100";

      select.appendChild(option);
    });

    select.value = list.some(m => m.symbol === previous)
      ? previous
      : list[0].symbol;

    showSignal();
  }

  function selectedMarket() {
    const select = el("manualMarket");
    if (!select) return null;

    return candidates().find(
      m => m.symbol === select.value
    ) || null;
  }

  function signalMatches(quote) {
    const market = selectedMarket();

    return !!(
      market &&
      market.symbol === quote.symbol &&
      market.analysis.allowed &&
      market.analysis.direction === quote.direction &&
      Number(market.analysis.score) === quote.score
    );
  }

  function showSignal() {
    const node = el("manualSignal");
    if (!node) return;

    const market = selectedMarket();

    node.textContent = market
      ? "Market: " + market.symbol +
        " | Direction: " + market.analysis.direction +
        " | Score: " + market.analysis.score + "/100"
      : "NO TRADE — no qualified analyzer signal.";

    if (pendingProposal && !signalMatches(pendingProposal)) {
      clearPendingProposal(
        "QUOTE INVALIDATED — analyzer signal changed. Get a fresh quote."
      );
    }
  }

  function send(payload, expectedType) {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN || !connected) {
        reject(new Error("Demo WebSocket is not connected."));
        return;
      }

      const id = ++requestId;
      payload.req_id = id;

      const timer = setTimeout(() => {
        requests.delete(id);
        reject(new Error("Deriv request timed out."));
      }, 12000);

      requests.set(id, {
        resolve,
        reject,
        expectedType,
        timer
      });

      try {
        ws.send(JSON.stringify(payload));
      } catch (error) {
        clearTimeout(timer);
        requests.delete(id);
        reject(error);
      }
    });
  }

  function onMessage(event) {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch (error) {
      return;
    }

    if (data.msg_type === "balance" && data.balance) {
      status(
        "DEMO CONNECTED | Balance: " +
        data.balance.balance + " " +
        data.balance.currency,
        "#4ade80"
      );
    }

    if (data.req_id && requests.has(data.req_id)) {
      const item = requests.get(data.req_id);

      clearTimeout(item.timer);
      requests.delete(data.req_id);

      if (data.error) {
        item.reject(
          new Error(data.error.message || "Deriv error.")
        );
      } else if (data.msg_type !== item.expectedType) {
        item.reject(
          new Error("Unexpected response: " + data.msg_type)
        );
      } else {
        item.resolve(data);
      }
    }
  }

  async function readJson(response) {
    const raw = await response.text();

    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(
        "Invalid Deriv response: " + raw.slice(0, 120)
      );
    }
  }

  function ensureActive() {
    if (stopped) {
      throw new Error("Requests have been stopped.");
    }

    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("Demo connection is no longer active.");
    }
  }

  async function connect() {
    if (connected) {
      if (stopped) {
        status("DISCONNECT AND RECONNECT TO RESET STOP.", "#f87171");
      } else {
        status("Already connected.", "#4ade80");
      }
      return;
    }

    stopped = false;
    clearPendingProposal();
    setQuoteButtonEnabled(false);

    const input = el("berurPat");
    const token = input ? input.value.trim() : "";

    if (!token) {
      status(
        "Enter your demo token in the existing connection panel.",
        "#f87171"
      );
      return;
    }

    try {
      status("VERIFYING DEMO ACCOUNT...");

      const response = await fetch(
        API + "/trading/v1/options/accounts",
        {
          headers: {
            "Authorization": "Bearer " + token,
            "Deriv-App-ID": APP_ID
          }
        }
      );

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.errors?.[0]?.message ||
          "Account verification failed."
        );
      }

      const accounts = Array.isArray(data.data)
        ? data.data
        : data.data?.accounts || [];

      const demo = accounts.find(a =>
        String(a.account_type || "").toLowerCase() === "demo"
      );

      if (!demo || !demo.account_id) {
        throw new Error("No demo account found.");
      }

      if (
        String(demo.currency || "").toUpperCase() !== "USD"
      ) {
        throw new Error("A USD demo account is required.");
      }

      status("REQUESTING DEMO SESSION...");

      const otpResponse = await fetch(
        API + "/trading/v1/options/accounts/" +
        encodeURIComponent(demo.account_id) + "/otp",
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + token,
            "Deriv-App-ID": APP_ID
          }
        }
      );

      const otp = await readJson(otpResponse);

      if (!otpResponse.ok) {
        throw new Error(
          otp.message ||
          otp.errors?.[0]?.message ||
          "Demo session request failed."
        );
      }

      const url = otp.data?.url;

      if (
        !url ||
        !url.startsWith("wss://api.derivws.com/") ||
        !url.includes("/ws/demo?")
      ) {
        throw new Error("Demo WebSocket URL verification failed.");
      }

      status("OPENING DEMO WEBSOCKET...");

      const socket = new WebSocket(url);
      ws = socket;

      socket.onopen = () => {
        if (ws !== socket || stopped) {
          socket.close();
          return;
        }

        connected = true;
        setQuoteButtonEnabled(true);

        status("DEMO CONNECTED — USD DEMO ONLY", "#4ade80");

        socket.send(JSON.stringify({
          balance: 1,
          subscribe: 1,
          req_id: ++requestId
        }));
      };

      socket.onmessage = onMessage;

      socket.onerror = () => {
        if (ws === socket) {
          status("WEBSOCKET ERROR", "#f87171");
        }
      };

      socket.onclose = () => {
        if (ws !== socket) return;

        ws = null;
        invalidateConnection(
          "DISCONNECTED — no purchase made."
        );

        setQuoteButtonEnabled(false);
        status("DISCONNECTED", "#f87171");
      };

    } catch (error) {
      connected = false;
      ws = null;
      setQuoteButtonEnabled(false);
      status("CONNECTION FAILED: " + error.message, "#f87171");
    }
  }

  function durationTicks(value) {
    const match = String(value || "").match(/^(\d+)t$/i);
    return match ? Number(match[1]) : null;
  }

  async function getQuote() {
    if (quoteInProgress || buyInProgress) return;

    clearPendingProposal();

    if (stopped) {
      status("REQUESTS STOPPED. Disconnect and reconnect.", "#f87171");
      return;
    }

    if (!connected || !ws) {
      status("CONNECT DEMO SESSION FIRST.", "#f87171");
      return;
    }

    const market = selectedMarket();

    if (!market) {
      output("NO TRADE — analyzer has no qualified signal.");
      return;
    }

    const symbol = market.symbol;
    const direction = market.analysis.direction;
    const score = Number(market.analysis.score);
    const contractType = direction === "RISE" ? "CALL" : "PUT";

    quoteInProgress = true;
    setQuoteButtonEnabled(false);
    output("Checking contract availability...");

    try {
      ensureActive();

      const check = await send(
        { contracts_for: symbol },
        "contracts_for"
      );

      ensureActive();

      const available = check.contracts_for?.available || [];

      const contract = available.find(c =>
        c.contract_type === contractType
      );

      if (!contract) {
        throw new Error(
          direction + " contract is not available for " + symbol
        );
      }

      const min = durationTicks(contract.min_contract_duration);
      const max = durationTicks(contract.max_contract_duration);

      if (
        (min !== null && DURATION < min) ||
        (max !== null && DURATION > max)
      ) {
        throw new Error(
          "5 ticks is outside this contract range. Deriv reports: " +
          (contract.min_contract_duration || "?") + " to " +
          (contract.max_contract_duration || "?")
        );
      }

      const latest = selectedMarket();

      if (
        !latest ||
        latest.symbol !== symbol ||
        latest.analysis.direction !== direction ||
        Number(latest.analysis.score) !== score ||
        !latest.analysis.allowed
      ) {
        throw new Error("Analyzer signal changed. No trade.");
      }

      status("REQUESTING PRICE PROPOSAL...");

      const quote = await send({
        proposal: 1,
        amount: STAKE,
        basis: "stake",
        contract_type: contractType,
        currency: "USD",
        duration: DURATION,
        duration_unit: "t",
        underlying_symbol: symbol
      }, "proposal");

      ensureActive();

      const current = selectedMarket();
      if (
        !current ||
        current.symbol !== symbol ||
        current.analysis.direction !== direction ||
        Number(current.analysis.score) !== score ||
        !current.analysis.allowed
      ) {
        throw new Error("Analyzer signal changed. Quote discarded.");
      }

      const p = quote.proposal;

      if (
        !p ||
        !p.id ||
        !Number.isFinite(Number(p.ask_price)) ||
        !Number.isFinite(Number(p.payout))
      ) {
        throw new Error("Deriv returned an incomplete quote.");
      }

      pendingProposal = {
        id: p.id,
        askPrice: Number(p.ask_price),
        payout: Number(p.payout),
        symbol,
        direction,
        contractType,
        score,
        createdAt: Date.now(),
        expiresAt: Date.now() + QUOTE_MAX_AGE_MS
      };

      output(
        "VALID PRICE QUOTE\n\n" +
        "Account: DEMO USD\n" +
        "Market: " + symbol + "\n" +
        "Direction: " + direction + "\n" +
        "Contract: " + contractType + "\n" +
        "Duration: 5 ticks\n" +
        "Analyzer score: " + score + "/100\n" +
        "Requested stake: $0.35\n" +
        "Quoted purchase price: $" +
        Number(p.ask_price).toFixed(2) + "\n" +
        "Payout: $" + Number(p.payout).toFixed(2) + "\n" +
        "Potential profit: $" +
        (Number(p.payout) - Number(p.ask_price)).toFixed(2) +
        "\n\n" + (p.longcode || "") +
        "\n\nQuote valid for up to 30 seconds.\n" +
        "NO PURCHASE HAS BEEN MADE."
      );

      const button = el("manualBuy");

      if (button) {
        button.disabled = false;
        button.textContent = "CONFIRM DEMO BUY — $" +
          Number(p.ask_price).toFixed(2);
        button.style.background = "#16a34a";
      }

      status("FRESH QUOTE READY — WAITING FOR YOUR CONFIRMATION", "#4ade80");

    } catch (error) {
      clearPendingProposal();
      output("NO TRADE\n\n" + error.message);
      status("QUOTE CHECK FAILED", "#f87171");

    } finally {
      quoteInProgress = false;

      if (connected && !stopped && !buyInProgress) {
        setQuoteButtonEnabled(true);
      }
    }
  }

  async function buyDemo() {
    if (buyInProgress) return;

    const quote = pendingProposal;

    if (!quote) {
      status("NO VALID QUOTE — GET A FRESH QUOTE FIRST.", "#f87171");
      return;
    }

    try {
      ensureActive();

      if (Date.now() > quote.expiresAt) {
        clearPendingProposal("QUOTE EXPIRED — request a fresh quote.");
        status("QUOTE EXPIRED", "#f87171");
        return;
      }

      if (!signalMatches(quote)) {
        clearPendingProposal("SIGNAL CHANGED — request a fresh quote.");
        status("SIGNAL CHANGED", "#f87171");
        return;
      }

      const confirmation =
        "CONFIRM DEMO PURCHASE?\n\n" +
        "DEMO ACCOUNT ONLY\n" +
        "Market: " + quote.symbol + "\n" +
        "Direction: " + quote.direction + "\n" +
        "Contract: " + quote.contractType + "\n" +
        "Duration: 5 ticks\n" +
        "Stake: $0.35 USD\n" +
        "Quoted purchase price: $" +
        quote.askPrice.toFixed(2) + "\n" +
        "Payout: $" + quote.payout.toFixed(2) + "\n\n" +
        "This sends ONE purchase request.\n" +
        "Do you want to continue?";

      if (!window.confirm(confirmation)) {
        status("PURCHASE CANCELLED — NO TRADE PLACED.", "#facc15");
        return;
      }

      ensureActive();

      if (
        pendingProposal !== quote ||
        Date.now() > quote.expiresAt ||
        !signalMatches(quote)
      ) {
        clearPendingProposal("QUOTE OR SIGNAL CHANGED — no purchase sent.");
        status("PURCHASE CANCELLED — GET A FRESH QUOTE.", "#f87171");
        return;
      }

      buyInProgress = true;

      const buyButton = el("manualBuy");
      if (buyButton) {
        buyButton.disabled = true;
        buyButton.textContent = "PURCHASE REQUEST SENT...";
      }

      setQuoteButtonEnabled(false);
      status("SENDING ONE DEMO PURCHASE REQUEST...", "#facc15");

      let result;

      try {
        result = await send({
          buy: quote.id,
          price: quote.askPrice
        }, "buy");

      } catch (error) {
        clearPendingProposal();
        output(
          "PURCHASE RESULT UNCERTAIN\n\n" +
          error.message + "\n\n" +
          "Do NOT retry automatically.\n" +
          "Check your Deriv DEMO open positions and contract history " +
          "before making another purchase."
        );
        status("RESULT UNCERTAIN — CHECK DEMO HISTORY", "#f87171");
        return;
      }

      const bought = result.buy;

      if (!bought || !bought.contract_id) {
        clearPendingProposal();
        output(
          "Deriv did not return a confirmed contract ID.\n\n" +
          "Check your DEMO contract history before retrying."
        );
        status("PURCHASE NOT CONFIRMED — CHECK DEMO HISTORY", "#f87171");
        return;
      }

      output(
        "DEMO PURCHASE CONFIRMED\n\n" +
        "Contract ID: " + bought.contract_id + "\n" +
        "Market: " + quote.symbol + "\n" +
        "Direction: " + quote.direction + "\n" +
        "Duration: 5 ticks\n" +
        "Requested stake: $0.35 USD\n" +
        "Actual purchase price: $" +
        Number(bought.buy_price).toFixed(2) + "\n" +
        "Payout: $" + Number(bought.payout).toFixed(2) + "\n\n" +
        "Check the Deriv DEMO account for contract settlement."
      );

      clearPendingProposal();
      status("DEMO PURCHASE CONFIRMED", "#4ade80");

    } catch (error) {
      clearPendingProposal();
      output("NO PURCHASE SENT\n\n" + error.message);
      status("PURCHASE CANCELLED", "#f87171");

    } finally {
      buyInProgress = false;

      if (connected && !stopped) {
        setQuoteButtonEnabled(true);
      }

      const button = el("manualBuy");

      if (button && !pendingProposal) {
        button.disabled = true;
        button.textContent = "DEMO BUY — GET A FRESH QUOTE";
        button.style.background = "#555";
      }
    }
  }

  function disconnect() {
    stopped = true;
    connected = false;

    clearPendingProposal();
    setQuoteButtonEnabled(false);

    requests.forEach(item => {
      clearTimeout(item.timer);
      item.reject(new Error("Disconnected."));
    });

    requests.clear();

    if (ws) {
      const old = ws;
      ws = null;
      old.close();
    }

    status("DISCONNECTED — TOKEN NOT STORED");
    output("No purchase request is active.");
  }

  createPanel();
})();
