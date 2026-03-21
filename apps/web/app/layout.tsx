import type { Metadata } from "next";
import { SupportAssistant } from "./components/support-assistant";
import "./globals.css";

export const metadata: Metadata = {
  title: "FundedPro | Premium Prop Trading Evaluations",
  description:
    "FundedPro gives disciplined traders a premium path from evaluation to funded progression with transparent rules, sharp analytics, and risk-first operations.",
  openGraph: {
    title: "FundedPro | Premium Prop Trading Evaluations",
    description:
      "Transparent rules, premium dashboards, and a serious trading progression experience built for disciplined performance.",
    siteName: "FundedPro",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "FundedPro | Premium Prop Trading Evaluations",
    description:
      "Transparent rules, premium dashboards, and a serious trading progression experience built for disciplined performance."
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <SupportAssistant />
      </body>
    </html>
  );
}
