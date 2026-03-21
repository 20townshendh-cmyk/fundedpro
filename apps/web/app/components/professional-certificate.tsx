type ProfessionalCertificateProps = {
  eyebrow: string;
  title: string;
  recipientName: string;
  detailLine: string;
  issuedOn: string;
  reference: string;
  accent: string;
  summary: string;
  amountHighlight?: string;
  approvalSignature?: string;
};

export function ProfessionalCertificate({
  eyebrow,
  title,
  recipientName,
  detailLine,
  issuedOn,
  reference,
  accent,
  summary,
  amountHighlight,
  approvalSignature
}: ProfessionalCertificateProps) {
  return (
    <section className="certificate-shell">
      <div className="certificate-frame">
        <div className="certificate-glow" />
        <div className="certificate-corner certificate-corner-top" />
        <div className="certificate-corner certificate-corner-bottom" />

        <div className="certificate-head">
          <div>
            <span className="certificate-kicker">{eyebrow}</span>
            <span className="certificate-mark">FundedPro Capital</span>
          </div>
          <div className="certificate-head-approval">
            <span className="certificate-mark">{accent}</span>
            {approvalSignature ? <strong className="certificate-head-signature-label">{approvalSignature}</strong> : null}
          </div>
        </div>

        <div className="certificate-main">
          <div className="certificate-visual">
            <div className="certificate-visual-grid" />
            <div className="certificate-visual-orb" />
            <div className="certificate-visual-panel certificate-visual-panel-back" />
            <div className="certificate-visual-panel certificate-visual-panel-front" />
            <div className="certificate-spotlight" />
            <div className="certificate-trophy-base" />
            <div className="certificate-trophy-shadow" />
            <div className="certificate-trophy">
              <div className="certificate-trophy-reflection" />
              <div className="certificate-trophy-edge certificate-trophy-edge-left" />
              <div className="certificate-trophy-edge certificate-trophy-edge-right" />
              <div className="certificate-trophy-core">
                <span>FP</span>
              </div>
            </div>
          </div>

          <div className="certificate-body">
            <div className="certificate-body-contours" aria-hidden="true" />
            <div className="certificate-body-orb" aria-hidden="true" />
            <span className="certificate-overline">Certificate of Achievement</span>
            <h1 className="certificate-title">{title}</h1>
            <p className="certificate-copy">Proudly presented to</p>
            <div className="certificate-recipient-pill">
              <strong className="certificate-recipient">{recipientName}</strong>
            </div>
            <p className="certificate-detail">{summary}</p>
            <div className="certificate-seal" aria-label="Verified Prop Trader seal">
              <div className="certificate-seal-core">
                <span className="certificate-seal-year">2026</span>
                <strong>FP</strong>
              </div>
              <span className="certificate-seal-ring certificate-seal-ring-top">Verified Prop Trader</span>
              <span className="certificate-seal-ring certificate-seal-ring-bottom">FundedPro Capital</span>
            </div>

            <div className="certificate-accent-row">
              <span className="certificate-accent-label">{accent}</span>
              {approvalSignature ? (
                <div className="certificate-head-signature-wrap certificate-approval-signature" aria-label={approvalSignature}>
                  <span className="certificate-head-signature-word">johnathanpro</span>
                  <span className="certificate-head-signature-line" aria-hidden="true" />
                </div>
              ) : null}
              <span className="certificate-accent-line" />
            </div>

            {amountHighlight ? (
              <div className="certificate-amount-block">
                <span>Reward amount</span>
                <strong>{amountHighlight}</strong>
              </div>
            ) : null}

            <p className="certificate-copy certificate-copy-wide">{detailLine}</p>

            <div className="certificate-meta-grid">
              <article>
                <span>Issued on</span>
                <strong>{issuedOn}</strong>
              </article>
              <article>
                <span>Reference</span>
                <strong>{reference}</strong>
              </article>
              <article>
                <span>Verified by</span>
                <strong>FundedPro Operations</strong>
              </article>
            </div>
          </div>
        </div>

        <div className="certificate-footer">
          <div className="certificate-date-block">
            <strong>{issuedOn}</strong>
            <span>Date</span>
          </div>
          <div className="certificate-signature">
            <span className="certificate-signature-script">FundedPro</span>
            <strong>Managing Director</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
