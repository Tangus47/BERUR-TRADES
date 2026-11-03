/* BERUR TRADES - DERIV DEMO CONNECTION
   Demo-only connection test. No trade execution.
*/

(() => {
  "use strict";

  const APP_ID = "34RcebpeLamDpn5C515Yg";
  const API = "https://api.derivws.com";

  let socket = null;
  let token = "";
  let connected = false;

  function createPanel() {
    if (document.getElementById("berurDemoPanel")) return;

    const panel = document.createElement("section");
    panel.id = "berurDemoPanel";

    panel.style.cssText = `
      margin:16px 0;
      padding:16px;
      background:#10251d;
      color:white;
      border:2px solid #16a34a;
      border-radius:12px;
    `;

    panel.innerHTML = `
      <h2 style="color:#4ade80">BERUR TRADES — DEMO CONNECTION</h2>

      <p>Deriv App ID: ${APP_ID}</p>

      <input
        id="berurPat"
        type="password"
        placeholder="Enter your private demo API token"
        autocomplete="off"
        style="width:100%;padding:12px;box-sizing:border-box;margin:8px 0"
      >

      <button id="berurConnect"
        style="padding:12px;background:#16a34a;color:white;border:0;border-radius:7px">
        CONNECT DEMO ACCOUNT
      </button>

      <button id="berurDisconnect"
        style="padding:12px;background:#991b1b;color:white;border:0;border-radius:7px;margin-left:5px">
        DISCONNECT
      </button>

      <div id="berurDemoStatus" style="margin-top:14px;color:#facc15">
        NOT CONNECTED
      </div>

      <div id="berurDemoAccount" style="margin-top:8px"></div>

      <div id="berurDemoBalance" style="margin-top:8px;font-size:20px;color:#4ade80"></div>

      <p style="font-size:12px;color:#cbd5e1">
        DEMO ONLY — AUTOMATIC TRADING DISABLED.
        Your token is kept in memory and is not saved by this module.
      </p>
    `;

    const radar = document.getElementById("bestMarketRadar");

    if (radar && radar.parentElement) {
      radar.parentElement.insertBefore(panel, radar.nextSibling);
    } else {
      document.body.prepend(panel);
    }

    document.getElementById("berurConnect")
      .addEventListener("click", connectDemo);

    document.getElementById("berurDisconnect")
      .addEventListener("click", disconnectDemo);
  }

  function status(message, color = "#facc15") {
    const el = document.getElementById("berurDemoStatus");
    if (el) {
      el.textContent = message;
      el.style.color = color;
    }
  }

  async function connectDemo() {
    if (connected) {
      status("Already connected.", "#4ade80");
      return;
    }

    token = document.getElementById("berurPat").value.trim();

    if (!token) {
      status("Enter your private demo token.", "#f87171");
      return;
    }

    status("CHECKING DERIV ACCOUNT...");

    try {
      const response = await fetch(
        API + "/trading/v1/options/accounts",
        {
          method: "GET",
          headers: {
            "Authorization": "Bearer " + token,
            "Deriv-App-ID": APP_ID
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
          result.errors?.[0]?.message ||
          "Account request failed: HTTP " + response.status
        );
      }

      const accounts = Array.isArray(result.data)
        ? result.data
        : result.data?.accounts || [];

      const demo = accounts.find(account =>
        String(account.account_type || "").toLowerCase() === "demo" ||
        String(account.group || "").toLowerCase() === "demo"
      );

      if (!demo || !demo.account_id) {
        throw new Error("No demo Options account found.");
      }

      if (
        demo.currency &&
        String(demo.currency).toUpperCase() !== "USD"
      ) {
        throw new Error("Demo account must use USD.");
      }

      const accountId = demo.account_id;

      document.getElementById("berurDemoAccount").textContent =
        "Demo account: " + accountId;

      status("REQUESTING SECURE DEMO CONNECTION...");

      const otpResponse = await fetch(
        API + "/trading/v1/options/accounts/" +
        encodeURIComponent(accountId) + "/otp",
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + token,
            "Deriv-App-ID": APP_ID
          }
        }
      );

      const otpResult = await otpResponse.json();

      if (!otpResponse.ok) {
        throw new Error(
          otpResult.message ||
          otpResult.errors?.[0]?.message ||
          "Could not obtain demo connection."
        );
      }

      const wsUrl = otpResult.data?.url;

      if (
        !wsUrl ||
        !wsUrl.startsWith("wss://api.derivws.com/") ||
        !wsUrl.includes("/ws/demo?")
      ) {
        throw new Error("Demo WebSocket URL verification failed.");
      }

      status("OPENING AUTHENTICATED DEMO CONNECTION...");

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        connected = true;
        status("DEMO CONNECTED — TRADING DISABLED", "#4ade80");

        socket.send(JSON.stringify({
          balance: 1,
          subscribe: 1
        }));
      };

      socket.onmessage = event => {
        let message;

        try {
          message = JSON.parse(event.data);
        } catch (error) {
          return;
        }

        if (message.error) {
          status(
            "DERIV ERROR: " + message.error.message,
            "#f87171"
          );
          return;
        }

        if (message.msg_type === "balance" && message.balance) {
          const balance = message.balance;

          document.getElementById("berurDemoBalance").textContent =
            "DEMO BALANCE: " +
            balance.balance + " " +
            (balance.currency || "USD");
        }
      };

      socket.onerror = () => {
        status("WEBSOCKET CONNECTION ERROR", "#f87171");
      };

      socket.onclose = () => {
        connected = false;
        socket = null;
        status("DISCONNECTED", "#facc15");
      };

    } catch (error) {
      status("CONNECTION FAILED: " + error.message, "#f87171");
      token = "";
    }
  }

  function disconnectDemo() {
    if (socket) {
      socket.close();
      socket = null;
    }

    connected = false;
    token = "";

    const input = document.getElementById("berurPat");
    if (input) input.value = "";

    const balance = document.getElementById("berurDemoBalance");
    if (balance) balance.textContent = "";

    status("DISCONNECTED — TOKEN CLEARED");
  }

  createPanel();

  createPanel();

})();
