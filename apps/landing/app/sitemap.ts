import type { MetadataRoute } from "next";
import { DEPLOYMENT_URL } from "vercel-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: DEPLOYMENT_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
