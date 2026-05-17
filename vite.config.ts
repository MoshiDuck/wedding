import { defineConfig } from "vite";
import { readFileSync } from "fs";
import { resolve } from "path";

const NAV_PARTIAL = readFileSync(
  resolve(__dirname, "partials/site-nav.html"),
  "utf-8",
);

const NAV_PAGE_BY_FILE: Record<string, string> = {
  index: "home",
  rsvp: "rsvp",
  registry: "registry",
  qa: "qa",
};

function injectActiveNav(navHtml: string, activePage: string): string {
  return navHtml.replace(
    /<a\s+href="([^"]+)"\s+class="site-nav__btn"\s+data-nav="([^"]+)"/g,
    (match, href, navId) => {
      if (navId !== activePage) return match;
      return `<a href="${href}" class="site-nav__btn active" aria-current="page" data-nav="${navId}"`;
    },
  );
}

function resolveNavPage(filename: string): string {
  for (const [key, page] of Object.entries(NAV_PAGE_BY_FILE)) {
    if (filename.includes(key)) return page;
  }
  return "home";
}

function injectSiteNavPlugin() {
  return {
    name: "inject-site-nav",
    transformIndexHtml: {
      order: "pre" as const,
      handler(html: string, ctx: { filename: string }) {
        const page = resolveNavPage(ctx.filename);
        const nav = injectActiveNav(NAV_PARTIAL, page);
        return html.replace("<!-- SITE_NAV -->", nav);
      },
    },
  };
}

export default defineConfig({
  plugins: [injectSiteNavPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        rsvp: resolve(__dirname, "rsvp.html"),
        qa: resolve(__dirname, "qa.html"),
        registry: resolve(__dirname, "registry.html"),
      },
    },
  },
});
