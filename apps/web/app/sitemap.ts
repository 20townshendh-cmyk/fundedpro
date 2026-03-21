import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://fundedpro.example";
  const routes = [
    "",
    "/challenges",
    "/how-it-works",
    "/why-fundedpro",
    "/faq",
    "/payouts",
    "/trading-rules",
    "/about",
    "/contact",
    "/login",
    "/signup"
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7
  }));
}
