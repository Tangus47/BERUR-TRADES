/* BERUR TRADES - MANUAL DEMO QUOTE MODULE
   Demo connection and quote requests only.
   BUY EXECUTION DISABLED.
*/
(() => {
  "use strict";

  const APP_ID = "34RcebpeLamDpn5C515Yg";
  const API = "https://api.derivws.com";
  const STAKE = 0.35;
  const DURATION = 15;

  let ws = null;
  let connected = false;
  let stopped = false;
  let requestId = 200;
  let requests = new Map();

  const el = id => document.getElementById(id);

  function status(message, color = "#facc15") {
    const node = el("manualStatus");
    if (node) {
      node.textContent = message;
      node.style.color = color;
    }
  }

  function output(message) {
    if (el("manualOutput")) el("manualOutput").textContent = message;
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
        DEMO ONLY | PURCHASE DISABLED
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

      <p>Contract duration: 15 seconds</p>
      <p>Stake: $0.35 USD</p>

      <button id="manualQuote"
        style="padding:13px;width:100%;background:#2563eb;color:white;border:0;border-radius:7px;font-weight:bold">
        CHECK CONTRACT AND GET QUOTE
      </button>

      <pre id="manualOutput"
        style="white-space:pre-wrap;background:#07150f;padding:12px;border-radius:8px;margin-top:12px">No quote requested.</pre>

      <button disabled
        style="padding:13px;width:100%;background:#555;color:white;border:0;border-radius:7px">
        PURCHASE DISABLED — TEST STAGE
      </button>

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
    el("manualStop").onclick = () => {
      stopped = true;
      output("STOPPED — no purchase can be made.");
      status("NEW REQUESTS STOPPED", "#f87171");
    };

    el("manualMarket").onchange = showSignal;

    refreshMarkets();
    setInterval(refreshMarkets, 2500);
  }

  function candidates() {
    try {
      return radarCandidates().filter(m =>
        m.available &&
        m.analysis &&
        m.analysis.allowed &&
        ["RISE", "FALL"].includes(m.analysis.direction)
      );
    } catch (e) {
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
        m.symbol + " | " + m.analysis.direction +
        " | " + m.analysis.score + "/100";
      select.appendChild(option);
    });

    select.value = list.some(m => m.symbol === previous)
      ? previous : list[0].symbol;

    showSignal();
  }

  function selectedMarket() {
    return candidates().find(
      m => m.symbol === el("manualMarket")?.value
    ) || null;
  }

  function showSignal() {
    const node = el("manualSignal");
    if (!node) return;

    const m = selectedMarket();

    node.textContent = m
      ? "Market: " + m.symbol +
        " | Direction: " + m.analysis.direction +
        " | Score: " + m.analysis.score + "/100"
      : "NO TRADE — no qualified analyzer signal.";
  }

  function send(payload, expectedType) {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
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
        resolve, reject, expectedType, timer
      });

      ws.send(JSON.stringify(payload));
    });
  }

  function onMessage(event) {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (e) {
      return;
    }

    if (data.msg_type === "balance" && data.balance) {
      status(
        "DEMO CONNECTED | Balance: " +
        data.balance.balance + " " + data.balance.currency,
        "#4ade80"
      );
    }

    if (data.req_id && requests.has(data.req_id)) {
      const item = requests.get(data.req_id);
      clearTimeout(item.timer);
      requests.delete(data.req_id);

      if (data.error) {
        item.reject(new Error(data.error.message || "Deriv error."));
      } else if (data.msg_type !== item.expectedType) {
        item.reject(new Error("Unexpected response: " + data.msg_type));
      } else {
        item.resolve(data);
      }
    }
  }

  async function readJson(response) {
    const raw = await response.text();
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error("Invalid Deriv response: " + raw.slice(0, 120));
    }
  }

  async function connect() {
    if (connected) {
      status("Already connected.", "#4ade80");
      return;
    }

    stopped = false;

    const input = el("berurPat");
    const token = input ? input.value.trim() : "";

    if (!token) {
      status("Enter your demo token in the existing connection panel.", "#f87171");
      return;
    }

    try {
      status("VERIFYING DEMO ACCOUNT...");

      const response = await fetch(API + "/trading/v1/options/accounts", {
        headers: {
          "Authorization": "Bearer " + token,
          "Deriv-App-ID": APP_ID
        }
      });

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(
          data.message || data.errors?.[0]?.message ||
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

      if (String(demo.currency || "").toUpperCase() !== "USD") {
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
          otp.message || otp.errors?.[0]?.message ||
          "Demo session request failed."
        );
      }

      const url = otp.data?.url;

      if (!url ||
          !url.startsWith("wss://api.derivws.com/") ||
          !url.includes("/ws/demo?")) {
        throw new Error("Demo WebSocket URL verification failed.");
      }

      status("OPENING DEMO WEBSOCKET...");

      ws = new WebSocket(url);

      ws.onopen = () => {
        connected = true;
        status("DEMO CONNECTED — PURCHASE DISABLED", "#4ade80");

        ws.send(JSON.stringify({
          balance: 1,
          subscribe: 1,
          req_id: ++requestId
        }));
      };

      ws.onmessage = onMessage;

      ws.onerror = () => {
        status("WEBSOCKET ERROR", "#f87171");
      };

      ws.onclose = () => {
        connected = false;
        ws = null;

        requests.forEach(item => {
          clearTimeout(item.timer);
          item.reject(new Error("Demo connection closed."));
        });

        requests.clear();
        status("DISCONNECTED");
      };

    } catch (error) {
      status("CONNECTION FAILED: " + error.message, "#f87171");
    }
  }

  function durationSeconds(value) {
    const match = String(value || "").match(/^(\d+)(s|m|h|d)$/i);
    if (!match) return null;

    const units = { s: 1, m: 60, h: 3600, d: 86400 };
    return Number(match[1]) * units[match[2].toLowerCase()];
  }

  async function getQuote() {
    if (stopped) {
      status("REQUESTS STOPPED. Reconnect to continue.", "#f87171");
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
    const contractType = direction === "RISE" ? "CALL" : "PUT";

    el("manualQuote").disabled = true;
    output("Checking contract availability...");

    try {
      const check = await send(
        { contracts_for: symbol },
        "contracts_for"
      );

      const available = check.contracts_for?.available || [];

      const contract = available.find(c =>
        c.contract_type === contractType
      );

      if (!contract) {
        throw new Error(
          direction + " contract is not available for " + symbol
        );
      }

      const min = durationSeconds(contract.min_contract_duration);
      const max = durationSeconds(contract.max_contract_duration);

      if (min === null || max === null ||
          DURATION < min || DURATION > max) {
        throw new Error(
          "15 seconds is not supported for this contract. " +
          "Deriv reports: " +
          (contract.min_contract_duration || "?") + " to " +
          (contract.max_contract_duration || "?")
        );
      }

      const latest = selectedMarket();

      if (!latest ||
          latest.analysis.direction !== direction ||
          !latest.analysis.allowed) {
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
        duration_unit: "s",
        underlying_symbol: symbol
      }, "proposal");

      const p = quote.proposal;

      if (!p || !p.id ||
          !Number.isFinite(Number(p.ask_price)) ||
          !Number.isFinite(Number(p.payout))) {
        throw new Error("Deriv returned an incomplete quote.");
      }

      output(
        "VALID PRICE QUOTE\n\n" +
        "Market: " + symbol + "\n" +
        "Direction: " + direction + "\n" +
        "Contract: " + contractType + "\n" +
        "Duration: 15 seconds\n" +
        "Analyzer score: " + market.analysis.score + "/100\n" +
        "Stake: $" + Number(p.ask_price).toFixed(2) + "\n" +
        "Payout: $" + Number(p.payout).toFixed(2) + "\n" +
        "Potential profit: $" +
        (Number(p.payout) - Number(p.ask_price)).toFixed(2) +
        "\n\n" + (p.longcode || "") +
        "\n\nPURCHASE DISABLED — NO TRADE PLACED."
      );

      status("QUOTE RECEIVED — NO PURCHASE MADE", "#4ade80");

    } catch (error) {
      output("NO TRADE\n\n" + error.message);
      status("QUOTE CHECK FAILED", "#f87171");

    } finally {
      el("manualQuote").disabled = false;
    }
  }

  function disconnect() {
    stopped = true;
    connected = false;

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
    output("No quote requested.");
  }

  createPanel();
})();
