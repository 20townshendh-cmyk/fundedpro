import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>
        {children}
        <SupportAssistant />
      </body>
    </html>
  );
}
