import type { MetadataRoute } from "next";
import { eventConfig as ev } from "@/config/event";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${ev.shortName} Speaker Portal`,
    short_name: ev.shortName,
    start_url: "/",
    display: "standalone",
    background_color: ev.colours.paper,
    theme_color: ev.colours.brand,
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
