/* =========================================================
   BERUR TRADES — DERIV BOT XML GENERATOR
   File: berur-xml-generator.js

   Generates downloadable Deriv Bot Blockly XML templates.
   No API token is requested or stored.
   ========================================================= */

(() => {
  "use strict";

  if (window.BERUR_XML_GENERATOR) return;
  window.BERUR_XML_GENERATOR = true;

  const CONFIG = {
    stake: 0.35,
    duration: 5,
    durationUnit: "t",
    currency: "USD",
    minimumScore: 75,
    recoveryMultiplier: 1.5,
    maximumStake: 0.80
  };

  const MARKET_LIST = [
    "R_10", "R_25", "R_50", "R_75", "R_100",
    "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V",
    "1HZ100V", "1HZ150V", "1HZ250V", "1HZ300V"
  ];

  const el = id => document.getElementById(id);

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function makeId() {
    return "b" + Math.random().toString(36).slice(2, 12);
  }

  function getSelectedMarket() {
    const select = el("berurXmlMarket");
    return select ? select.value : "R_100";
  }

  function getMarketCategory(symbol) {
    return symbol.startsWith("1HZ")
      ? "synthetic_index"
      : "synthetic_index";
  }

  function getRadarMarket() {
    try {
      if (typeof radarCandidates === "function") {
        const candidates = radarCandidates();

        if (candidates.length) {
          return candidates[0].symbol;
        }
      }
    } catch (error) {
      console.warn("BERUR Radar not available:", error);
    }

    return "";
  }

  function createTradeBlock({
    symbol,
    category,
    tradeType,
    contractType,
    duration,
    stake,
    prediction
  }) {
    const predictionBlock = prediction === null
      ? ""
      : `
        <value name="PREDICTION">
          <block type="math_number" id="${makeId()}">
            <field name="NUM">${prediction}</field>
          </block>
        </value>`;

    return `
<block type="trade" id="trade" x="0" y="0">

  <field name="MARKET_LIST">${getMarketCategory(symbol)}</field>
  <field name="SUBMARKET_LIST">random_index</field>
  <field name="SYMBOL_LIST">${escapeXml(symbol)}</field>
  <field name="TRADETYPECAT_LIST">${category}</field>
  <field name="TRADETYPE_LIST">${tradeType}</field>
  <field name="TYPE_LIST">${contractType}</field>
  <field name="CANDLEINTERVAL_LIST">60</field>
  <field name="TIME_MACHINE_ENABLED">FALSE</field>
  <field name="RESTARTONERROR">FALSE</field>

  <statement name="INITIALIZATION">
    <block type="text_print" id="${makeId()}">
      <value name="TEXT">
        <shadow type="text" id="${makeId()}">
          <field name="TEXT">BERUR TRADES strategy template — DEMO TEST FIRST</field>
        </shadow>
      </value>
    </block>
  </statement>

  <statement name="SUBMARKET">
    <block type="tradeOptions" id="${makeId()}">

      <field name="DURATIONTYPE_LIST">${duration === 5 ? "t" : "t"}</field>
      <field name="CURRENCY_LIST">${CONFIG.currency}</field>
      <field name="BARRIEROFFSETTYPE_LIST">+</field>
      <field name="SECONDBARRIEROFFSETTYPE_LIST">-</field>

      <value name="DURATION">
        <block type="math_number" id="${makeId()}">
          <field name="NUM">${duration}</field>
        </block>
      </value>

      <value name="AMOUNT">
        <block type="math_number" id="${makeId()}">
          <field name="NUM">${stake}</field>
        </block>
      </value>

      ${predictionBlock}

    </block>
  </statement>
</block>`;
  }

  function createPurchaseBlock(purchaseType) {
    return `
<block type="before_purchase" id="strategy" x="0" y="500">
  <statement name="BEFOREPURCHASE_STACK">
    <block type="purchase" id="${makeId()}">
      <field name="PURCHASE_LIST">${purchaseType}</field>
    </block>
  </statement>
</block>`;
  }

  function createAfterPurchaseBlock() {
    return `
<block type="after_purchase" id="finish" x="0" y="650">
  <statement name="AFTERPURCHASE_STACK">
    <block type="text_print" id="${makeId()}">
      <value name="TEXT">
        <shadow type="text" id="${makeId()}">
          <field name="TEXT">BERUR trade settled. Review results and risk before continuing.</field>
        </shadow>
      </value>
    </block>
  </statement>
</block>`;
  }

  function createXml({
    symbol,
    category,
    tradeType,
    contractType,
    purchaseType,
    duration,
    stake,
    prediction = null
  }) {
    const trade = createTradeBlock({
      symbol,
      category,
      tradeType,
      contractType,
      duration,
      stake,
      prediction
    });

    const purchase = createPurchaseBlock(purchaseType);
    const after = createAfterPurchaseBlock();

    return `<?xml version="1.0" encoding="UTF-8"?>
<xml xmlns="https://developers.google.com/blockly/xml"
     is_dbot="true"
     collection="false">

${trade}

${purchase}

${after}

</xml>`;
  }

  function createRiseFallXml(symbol, direction) {
    const purchase = direction === "FALL" ? "PUT" : "CALL";

    return createXml({
      symbol,
      category: "callput",
      tradeType: "risefall",
      contractType: "both",
      purchaseType: purchase,
      duration: CONFIG.duration,
      stake: CONFIG.stake
    });
  }

  function createDigitsXml(symbol, strategy, prediction) {
    const definitions = {
      MATCHES: {
        category: "digits",
        tradeType: "matches",
        purchaseType: "DIGITMATCH",
        needsPrediction: true
      },
      DIFFERS: {
        category: "digits",
        tradeType: "matches",
        purchaseType: "DIGITDIFF",
        needsPrediction: true
      },
      EVEN: {
        category: "digits",
        tradeType: "evenodd",
        purchaseType: "DIGITEVEN",
        needsPrediction: false
      },
      ODD: {
        category: "digits",
        tradeType: "evenodd",
        purchaseType: "DIGITODD",
        needsPrediction: false
      },
      OVER: {
        category: "digits",
        tradeType: "overunder",
        purchaseType: "DIGITOVER",
        needsPrediction: true
      },
      UNDER: {
        category: "digits",
        tradeType: "overunder",
        purchaseType: "DIGITUNDER",
        needsPrediction: true
      }
    };

    const selected = definitions[strategy];

    if (!selected) {
      throw new Error("Unsupported DIGITS strategy.");
    }

    if (selected.needsPrediction &&
        (!Number.isInteger(prediction) ||
         prediction < 0 || prediction > 9)) {
      throw new Error(
        "Enter a valid prediction digit from 0 to 9."
      );
    }

    return createXml({
      symbol,
      category: selected.category,
      tradeType: selected.tradeType,
      contractType: "both",
      purchaseType: selected.purchaseType,
      duration: 1,
      stake: CONFIG.stake,
      prediction: selected.needsPrediction ? prediction : null
    });
  }

  function downloadXml(filename, xml) {
    const blob = new Blob(
      [xml],
      { type: "application/xml;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function status(message, color = "#f4c45e") {
    const node = el("berurXmlStatus");

    if (!node) return;

    node.textContent = message;
    node.style.color = color;
  }

  function generateRiseFall() {
    try {
      const symbol = getSelectedMarket();

      const direction = el("berurXmlDirection").value;

      const xml = createRiseFallXml(symbol, direction);

      downloadXml(
        "BERUR_RISE_FALL_" + symbol + ".xml",
        xml
      );

      status(
        "RISE/FALL XML generated. Import it into Deriv Bot and inspect every block.",
        "#20d997"
      );

    } catch (error) {
      status(error.message, "#ff647c");
    }
  }

  function generateDigits() {
    try {
      const symbol = getSelectedMarket();
      const strategy = el("berurXmlDigitsType").value;
      const prediction = Number(el("berurXmlPrediction").value);

      const xml = createDigitsXml(
        symbol,
        strategy,
        prediction
      );

      downloadXml(
        "BERUR_DIGITS_" + strategy + "_" + symbol + ".xml",
        xml
      );

      status(
        "DIGITS XML generated. Import and validate it in Deriv Bot.",
        "#20d997"
      );

    } catch (error) {
      status(error.message, "#ff647c");
    }
  }

  function syncPrediction() {
    const type = el("berurXmlDigitsType")?.value;
    const prediction = el("berurXmlPrediction");

    if (!prediction) return;

    prediction.disabled = ![
      "MATCHES",
      "DIFFERS",
      "OVER",
      "UNDER"
    ].includes(type);
  }

  function createPanel() {
    if (el("berurXmlPanel")) return;

    const panel = document.createElement("section");

    panel.id = "berurXmlPanel";

    panel.style.cssText = `
      margin:16px 0;
      padding:16px;
      background:#101d30;
      color:#e8f0fc;
      border:2px solid #55aaff;
      border-radius:12px;
      font-family:Arial,sans-serif;
    `;

    panel.innerHTML = `
      <h2 style="color:#55aaff;margin-top:0">
        BERUR — DERIV BOT XML GENERATOR
      </h2>

      <p style="font-size:12px;color:#91a4bd;line-height:1.6">
        Generate strategy XML files for import into the official
        Deriv Bot workspace. Each file is generated separately.
      </p>

      <label>SELECT MARKET</label>

      <select id="berurXmlMarket"
        style="display:block;width:100%;padding:12px;margin:8px 0 14px">
      </select>

      <button id="berurXmlRadar"
        style="width:100%;margin-bottom:15px;padding:12px">
        USE BEST RADAR MARKET
      </button>

      <hr style="border-color:#263951">

      <h3>RISE / FALL STRATEGY</h3>

      <label>Direction</label>

      <select id="berurXmlDirection"
        style="display:block;width:100%;padding:12px;margin:8px 0">
        <option value="RISE">RISE / CALL</option>
        <option value="FALL">FALL / PUT</option>
      </select>

      <p style="font-size:12px;color:#91a4bd">
        Duration: 5 ticks | Base stake: $0.35
      </p>

      <button id="berurXmlRiseFall"
        style="width:100%;padding:13px;background:#20d997;color:#062016;font-weight:bold">
        DOWNLOAD RISE/FALL XML
      </button>

      <hr style="border-color:#263951;margin:18px 0">

      <h3>DIGITS STRATEGY</h3>

      <label>Contract type</label>

      <select id="berurXmlDigitsType"
        style="display:block;width:100%;padding:12px;margin:8px 0">
        <option value="MATCHES">Matches</option>
        <option value="DIFFERS">Differs</option>
        <option value="EVEN">Even</option>
        <option value="ODD">Odd</option>
        <option value="OVER">Over</option>
        <option value="UNDER">Under</option>
      </select>

      <label>Prediction digit (0–9)</label>

      <input id="berurXmlPrediction"
        type="number"
        min="0"
        max="9"
        value="5"
        style="display:block;width:100%;padding:12px;margin:8px 0">

      <p style="font-size:12px;color:#91a4bd">
        Duration: 1 tick | Base stake: $0.35
      </p>

      <button id="berurXmlDigits"
        style="width:100%;padding:13px;background:#55aaff;color:#07111f;font-weight:bold">
        DOWNLOAD DIGITS XML
      </button>

      <div id="berurXmlStatus"
        style="margin-top:15px;padding:12px;background:#07111f;border-radius:8px;color:#f4c45e;font-size:12px">
        READY — Choose your market and strategy.
      </div>

      <div style="margin-top:12px;padding:12px;background:#302515;border:1px solid #72531d;border-radius:8px;color:#f4c45e;font-size:11px;line-height:1.6">
        SAFETY: These are strategy templates, not verified profitable
        signals. The XML does not receive BERUR's live AI radar score,
        and its recovery settings are not yet implemented as executable
        Deriv Bot blocks. Test imports and run demo only.
      </div>
    `;

    const footer = document.querySelector("footer");

    if (footer && footer.parentElement) {
      footer.parentElement.insertBefore(panel, footer);
    } else {
      document.querySelector(".wrap")?.appendChild(panel);
    }

    const select = el("berurXmlMarket");

    MARKET_LIST.forEach(symbol => {
      const option = document.createElement("option");
      option.value = symbol;
      option.textContent = symbol;
      select.appendChild(option);
    });

    select.value = "R_100";

    el("berurXmlRiseFall")
      .addEventListener("click", generateRiseFall);

    el("berurXmlDigits")
      .addEventListener("click", generateDigits);

    el("berurXmlDigitsType")
      .addEventListener("change", syncPrediction);

    el("berurXmlRadar")
      .addEventListener("click", () => {
        const best = getRadarMarket();

        if (!best) {
          status(
            "No qualified Radar market yet. Select a market manually.",
            "#ff647c"
          );
          return;
        }

        select.value = best;

        status(
          "Radar market selected: " + best,
          "#20d997"
        );
      });

    syncPrediction();
  }

  function initialize() {
    createPanel();

    console.log(
      "BERUR DERIV BOT XML GENERATOR INITIALIZED"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

})();
