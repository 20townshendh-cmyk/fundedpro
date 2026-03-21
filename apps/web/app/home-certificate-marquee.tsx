const certificateItems = [
  { name: "Marcus Bennett", amount: "$8,420", ref: "FP-8420" },
  { name: "Leila Costa", amount: "$9,275", ref: "FP-9275" },
  { name: "Samuel Hughes", amount: "$6,940", ref: "FP-6940" },
  { name: "Ariana Cole", amount: "$11,860", ref: "FP-11860" },
  { name: "Daniel Rowe", amount: "$7,540", ref: "FP-7540" },
  { name: "Nadia Brooks", amount: "$13,120", ref: "FP-13120" },
  { name: "Owen Clarke", amount: "$5,880", ref: "FP-5880" },
  { name: "Mila Hart", amount: "$10,460", ref: "FP-10460" }
] as const;

export function HomeCertificateMarquee() {
  const loopItems = [...certificateItems, ...certificateItems];

  return (
    <section className="home-certificate-band" aria-label="Sample FundedPro payout certificates">
      <div className="home-certificate-marquee">
        <div className="home-certificate-marquee-fade home-certificate-marquee-fade-left" aria-hidden="true" />
        <div className="home-certificate-marquee-fade home-certificate-marquee-fade-right" aria-hidden="true" />
        <div className="home-certificate-marquee-track">
          {loopItems.map((certificate, index) => (
            <article className="mini-certificate-card" key={`${certificate.ref}-${index}`}>
              <div className="mini-certificate-top">
                <span className="mini-certificate-kicker">Reward Certificate</span>
                <span className="mini-certificate-mark">FundedPro</span>
              </div>
              <div className="mini-certificate-body">
                <strong>{certificate.amount}</strong>
                <span>{certificate.name}</span>
              </div>
              <div className="mini-certificate-bottom">
                <span>{certificate.ref}</span>
                <span>Verified</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
