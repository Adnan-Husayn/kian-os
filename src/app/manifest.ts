import type { MetadataRoute } from "next";

/**
 * Web app manifest: lets Kian OS be added to a phone's home screen and open
 * full-screen like an app. Colors match the light "page" background.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kian OS",
    short_name: "Kian OS",
    description: "Kian's personal life-management system.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#f3f3ee",
    theme_color: "#f3f3ee",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Today", url: "/today" },
      { name: "Inbox", url: "/inbox" },
      { name: "Journal", url: "/journal" },
    ],
  };
}
