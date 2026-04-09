import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/", "/contract/", "/profile/"],
    },
    sitemap: "https://cascrow.com/sitemap.xml",
  };
}
