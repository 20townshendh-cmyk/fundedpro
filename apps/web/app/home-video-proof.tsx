export function HomeVideoProof() {
  const candles = [
    { left: "1.5%", bottom: "66%", height: "8%", wick: "14%", tone: "green" },
    { left: "3.8%", bottom: "63%", height: "5%", wick: "11%", tone: "green" },
    { left: "6.1%", bottom: "58%", height: "10%", wick: "16%", tone: "red" },
    { left: "8.7%", bottom: "54%", height: "7%", wick: "13%", tone: "red" },
    { left: "11.2%", bottom: "49%", height: "9%", wick: "15%", tone: "green" },
    { left: "14%", bottom: "41%", height: "13%", wick: "18%", tone: "red" },
    { left: "17.4%", bottom: "46%", height: "8%", wick: "12%", tone: "green" },
    { left: "20.3%", bottom: "52%", height: "6%", wick: "10%", tone: "green" },
    { left: "23.7%", bottom: "60%", height: "5%", wick: "9%", tone: "green" },
    { left: "27.4%", bottom: "61%", height: "7%", wick: "12%", tone: "red" },
    { left: "31.1%", bottom: "56%", height: "10%", wick: "16%", tone: "red" },
    { left: "34.5%", bottom: "48%", height: "11%", wick: "18%", tone: "green" },
    { left: "38.6%", bottom: "44%", height: "8%", wick: "13%", tone: "green" },
    { left: "42.2%", bottom: "50%", height: "7%", wick: "11%", tone: "red" },
    { left: "46%", bottom: "57%", height: "6%", wick: "10%", tone: "green" },
    { left: "49.5%", bottom: "63%", height: "7%", wick: "12%", tone: "green" },
    { left: "53.6%", bottom: "54%", height: "14%", wick: "20%", tone: "red" },
    { left: "57.7%", bottom: "40%", height: "18%", wick: "24%", tone: "green" },
    { left: "61.4%", bottom: "47%", height: "10%", wick: "16%", tone: "green" },
    { left: "65.3%", bottom: "38%", height: "16%", wick: "21%", tone: "red" },
    { left: "69.2%", bottom: "29%", height: "20%", wick: "28%", tone: "green" },
    { left: "73.1%", bottom: "37%", height: "11%", wick: "18%", tone: "red" },
    { left: "77%", bottom: "31%", height: "9%", wick: "14%", tone: "red" },
    { left: "80.8%", bottom: "26%", height: "8%", wick: "12%", tone: "red" },
    { left: "84.2%", bottom: "22%", height: "7%", wick: "12%", tone: "green" },
    { left: "87.4%", bottom: "24%", height: "6%", wick: "10%", tone: "green" },
    { left: "90.6%", bottom: "19%", height: "9%", wick: "14%", tone: "red" },
    { left: "93.5%", bottom: "11%", height: "11%", wick: "16%", tone: "red" },
    { left: "96.2%", bottom: "8%", height: "8%", wick: "13%", tone: "red" },
    { left: "98.4%", bottom: "5%", height: "6%", wick: "10%", tone: "green" }
  ];
  const ambientChips = [
    { className: "chip-one", label: "Execution-ready", value: "Buy / Sell in one strip" },
    { className: "chip-two", label: "Risk visible", value: "Equity and buying power pinned" },
    { className: "chip-three", label: "Chart range", value: "1m to 1w views" },
    { className: "chip-four", label: "Desk flow", value: "Ladder, chart, blotter aligned" }
  ];

  return (
    <section className="section-stack">
      <div className="trade-now-showcase">
        <div className="trade-now-showcase-copy">
          <p className="eyebrow">Inside Trade Now</p>
          <h2 className="section-title">
            A picture of our
            {" "}
            <span className="accent-text">actual Trade Now layout</span>
          </h2>
          <p className="section-copy">
            The main terminal is laid out so execution, chart context, and account risk all stay visible on one screen.
          </p>
        </div>

        <div className="trade-now-shot">
          <div className="trade-now-shot-canvas" aria-label="FundedPro Trade Now screenshot style preview">
            <div className="trade-now-shot-header">
              <div className="trade-now-shot-left-title">
                <strong>ES6</strong>
                <span>E-mini S&amp;P 500</span>
              </div>
              <div className="trade-now-shot-status">
                <span>Evaluation</span>
                <strong>$100,000.00</strong>
              </div>
              <div className="trade-now-shot-toolbar">
                <div className="trade-now-shot-size">1</div>
                <button type="button" className="buy">BUY</button>
                <button type="button" className="sell">SELL</button>
                <button type="button" className="accounts">Accounts</button>
              </div>
              <div className="trade-now-shot-metrics">
                <span>Exec</span>
                <strong>4,914.50</strong>
                <span>Chart</span>
                <strong>6,506.48</strong>
              </div>
            </div>

            <div className="trade-now-shot-body">
              <aside className="trade-now-shot-ladder">
                <div className="trade-now-shot-sidecard">
                  <strong>ES6</strong>
                  <span>E-mini S&amp;P 500</span>
                  <small>Max 10 ctr</small>
                </div>
                <div className="trade-now-shot-form">
                  <label><span>Qty</span><div>1</div></label>
                  <label><span>Type</span><div>Mkt</div></label>
                  <label><span>TIF</span><div>DAY</div></label>
                  <label><span>ATM</span><div>OFF</div></label>
                </div>
                <div className="trade-now-shot-book">
                  {["4916.50","4916.25","4916.00","4915.75","4915.50","4915.25","4915.00","4914.75","4914.50","4914.25"].map((price, index) => (
                    <div key={price} className="trade-now-shot-book-row">
                      <span className="bid">{price}</span>
                      <strong>{price}</strong>
                      <span className="ask">{11 - index}</span>
                    </div>
                  ))}
                </div>
              </aside>

              <main className="trade-now-shot-main">
                <div className="trade-now-shot-timeframes">
                  {["ES", "NQ", "1m", "5m", "15m", "1h", "1d", "1w"].map((item) => (
                    <span key={item} className={item === "5m" ? "active" : ""}>{item}</span>
                  ))}
                </div>

                <div className="trade-now-shot-chart">
                  <div className="trade-now-shot-grid" />
                  <div className="trade-now-shot-chart-glow" />
                  <div className="trade-now-shot-chart-vignette" />
                  <div className="trade-now-shot-chart-header">
                    <strong>6506.48</strong>
                    <span>+0.00</span>
                  </div>
                  <div className="trade-now-shot-candles">
                    {candles.map((candle, index) => (
                      <span
                        key={`${candle.left}-${index}`}
                        className={`trade-now-shot-candle ${candle.tone}`}
                        style={{
                          left: candle.left,
                          bottom: candle.bottom,
                          height: candle.height,
                          ["--wick-height" as string]: candle.wick,
                          animationDelay: `${index * 0.08}s`
                        }}
                      />
                    ))}
                  </div>
                  <div className="trade-now-shot-chart-price-line" />
                  <div className="trade-now-shot-chart-line" />
                  <div className="trade-now-shot-chart-line overlay" />
                  <div className="trade-now-shot-chart-axis">
                    {["7100", "7050", "7000", "6950", "6900", "6850", "6800", "6750", "6700", "6650", "6600", "6550", "6500", "6450"].map((level) => (
                      <span key={level}>{level}</span>
                    ))}
                  </div>
                  <div className="trade-now-shot-chart-timeline">
                    {["Feb", "5", "10", "13", "19", "24", "Mar", "5", "10", "13", "18", "18:00"].map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                  <div className="trade-now-shot-last">6506.48</div>
                  <div className="trade-now-shot-chart-scan" />
                </div>

                <div className="trade-now-shot-bottom">
                  <section className="trade-now-shot-market">
                    <strong>Indices</strong>
                    <div className="trade-now-shot-table">
                      <span>ES</span><span>6,506.48</span><span className="negative">-372.01</span>
                      <span>NQ</span><span>23,898.15</span><span className="negative">-1,563.55</span>
                      <span>CL</span><span>79.85</span><span className="positive">+0.02</span>
                      <span>GC</span><span>2,063.30</span><span className="positive">+0.70</span>
                    </div>
                  </section>

                  <section className="trade-now-shot-blotter">
                    <div className="trade-now-shot-tabs">
                      <span>Orders</span>
                      <span className="active">Positions</span>
                      <span>Fills</span>
                      <span>History</span>
                    </div>
                    <div className="trade-now-shot-empty">No positions yet.</div>
                  </section>
                </div>
              </main>

              <aside className="trade-now-shot-risk">
                <strong>Account Details</strong>
                <small>Trade now</small>
                <div className="trade-now-shot-risk-grid">
                  <div><span>Buying power</span><strong>$100,000.00</strong></div>
                  <div><span>Equity</span><strong>$100,000.00</strong></div>
                  <div><span>Realized</span><strong>$0.00</strong></div>
                  <div><span>Unrealized</span><strong className="positive">$0.00</strong></div>
                </div>
              </aside>
            </div>

            <div className="trade-now-pointer pointer-toolbar">
              <span className="line h" />
              <span className="dot" />
              <div className="label">
                <strong>Buy / Sell strip</strong>
                <p>Fast execution controls with account switching.</p>
              </div>
            </div>

            <div className="trade-now-pointer pointer-ladder">
              <span className="line h" />
              <span className="dot" />
              <div className="label">
                <strong>Ladder and ticket</strong>
                <p>Quantity, order type, TIF, and live pricing depth.</p>
              </div>
            </div>

            <div className="trade-now-pointer pointer-chart">
              <span className="line v" />
              <span className="dot" />
              <div className="label">
                <strong>Main chart area</strong>
                <p>Symbol toggles and timeframes sit directly above the chart.</p>
              </div>
            </div>

            <div className="trade-now-pointer pointer-risk">
              <span className="line h reverse" />
              <span className="dot" />
              <div className="label">
                <strong>Account details</strong>
                <p>Buying power, equity, and P&amp;L stay visible at all times.</p>
              </div>
            </div>

            <div className="trade-now-pointer pointer-blotter">
              <span className="line v up" />
              <span className="dot" />
              <div className="label">
                <strong>Blotter and market panels</strong>
                <p>Orders, fills, history, and market context sit below the chart.</p>
              </div>
            </div>

            {ambientChips.map((chip) => (
              <div key={chip.className} className={`trade-now-ambient-chip ${chip.className}`}>
                <small>{chip.label}</small>
                <strong>{chip.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
