import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://ragereport.potion.sh",
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
