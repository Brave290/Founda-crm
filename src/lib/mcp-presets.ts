export type McpCategory =
  | "Development"
  | "Databases"
  | "Productivity"
  | "Communication"
  | "AI & Web"
  | "Finance"
  | "Media"
  | "Local tools";

export interface McpPreset {
  id: string;
  name: string;
  desc: string;
  category: McpCategory;
  mode: "remote" | "command";
  /** remote mode */
  url?: string;
  authHeader?: { header: string; prefix?: string; label: string };
  /** command mode — full command line, split on submit */
  command?: string;
  envKeys?: string[];
  /** token substituted for this marker inside the command string */
  argToken?: { marker: string; label: string };
  /** badge */
  auth: string;
}

export const MCP_CATEGORIES: McpCategory[] = [
  "Development",
  "Databases",
  "Productivity",
  "Communication",
  "AI & Web",
  "Finance",
  "Media",
  "Local tools",
];

export const MCP_PRESETS: McpPreset[] = [
  // ── Development / infrastructure ────────────────────────────────
  { id: "vercel", name: "Vercel", desc: "Deployments, projects, domains", category: "Development", mode: "remote", url: "https://mcp.vercel.com", auth: "OAuth" },
  { id: "github", name: "GitHub", desc: "Repos, issues, PRs, Actions", category: "Development", mode: "remote", url: "https://api.githubcopilot.com/mcp/", auth: "OAuth" },
  { id: "netlify", name: "Netlify", desc: "Sites, deploys, env vars", category: "Development", mode: "remote", url: "https://netlify-mcp.netlify.app/mcp", auth: "OAuth" },
  { id: "sentry", name: "Sentry", desc: "Errors, issues, releases", category: "Development", mode: "remote", url: "https://mcp.sentry.dev/sse", auth: "OAuth" },
  { id: "buildkite", name: "Buildkite", desc: "CI/CD pipelines and builds", category: "Development", mode: "remote", url: "https://mcp.buildkite.com/mcp", auth: "OAuth" },
  { id: "figma", name: "Figma", desc: "Designs, frames, dev mode", category: "Development", mode: "remote", url: "https://mcp.figma.com/mcp", auth: "OAuth" },
  { id: "cloudflare-bindings", name: "Cloudflare Bindings", desc: "Workers, KV, R2 bindings", category: "Development", mode: "remote", url: "https://bindings.mcp.cloudflare.com/sse", auth: "OAuth" },
  { id: "cloudflare-obs", name: "Cloudflare Observability", desc: "Logs, analytics, alerts", category: "Development", mode: "remote", url: "https://observability.mcp.cloudflare.com/sse", auth: "OAuth" },
  { id: "prisma", name: "Prisma", desc: "ORM, Studio, database ops", category: "Development", mode: "remote", url: "https://mcp.prisma.io/mcp", auth: "OAuth" },
  { id: "grafbase", name: "Grafbase", desc: "GraphQL platform tooling", category: "Development", mode: "remote", url: "https://api.grafbase.com/mcp", auth: "OAuth" },
  { id: "jam", name: "Jam", desc: "Bug reports with browser context", category: "Development", mode: "remote", url: "https://mcp.jam.dev/mcp", auth: "OAuth" },
  { id: "browserbase", name: "Browserbase", desc: "Headless browsers in the cloud", category: "Development", mode: "remote", url: "https://mcp.browserbase.com/mcp", auth: "Token", authHeader: { header: "Authorization", prefix: "Bearer ", label: "Browserbase API key" } },

  // ── Databases ───────────────────────────────────────────────────
  { id: "supabase", name: "Supabase", desc: "Projects, SQL, auth, storage", category: "Databases", mode: "remote", url: "https://mcp.supabase.com/mcp", auth: "OAuth" },
  { id: "neon", name: "Neon", desc: "Serverless Postgres branches", category: "Databases", mode: "remote", url: "https://mcp.neon.tech/sse", auth: "OAuth" },
  { id: "postgres-local", name: "PostgreSQL", desc: "Query a Postgres database", category: "Databases", mode: "command", command: "npx -y @modelcontextprotocol/server-postgres postgresql://user:pass@localhost:5432/db", auth: "Setup" },
  { id: "sqlite-local", name: "SQLite", desc: "Query a local SQLite file", category: "Databases", mode: "command", command: "uvx mcp-server-sqlite --db-path /tmp/data.db", auth: "Setup" },
  { id: "redis-local", name: "Redis", desc: "Read/write Redis keys", category: "Databases", mode: "command", command: "npx -y @modelcontextprotocol/server-redis redis://localhost:6379", auth: "Setup" },
  { id: "qdrant-local", name: "Qdrant", desc: "Vector search collections", category: "Databases", mode: "command", command: "npx -y @qdrant/mcp-server", envKeys: ["QDRANT_URL", "QDRANT_API_KEY"], auth: "Key" },

  // ── Productivity / work ─────────────────────────────────────────
  { id: "notion", name: "Notion", desc: "Pages, databases, wiki", category: "Productivity", mode: "remote", url: "https://mcp.notion.com/mcp", auth: "OAuth" },
  { id: "linear", name: "Linear", desc: "Issues, cycles, roadmaps", category: "Productivity", mode: "remote", url: "https://mcp.linear.app/mcp", auth: "OAuth" },
  { id: "asana", name: "Asana", desc: "Tasks, projects, goals", category: "Productivity", mode: "remote", url: "https://mcp.asana.com/sse", auth: "OAuth" },
  { id: "atlassian", name: "Atlassian", desc: "Jira + Confluence", category: "Productivity", mode: "remote", url: "https://mcp.atlassian.com/v1/mcp/authv2", auth: "OAuth" },
  { id: "monday", name: "Monday.com", desc: "Boards, items, workflows", category: "Productivity", mode: "remote", url: "https://mcp.monday.com/sse", auth: "OAuth" },
  { id: "close", name: "Close CRM", desc: "Leads, calls, opportunities", category: "Productivity", mode: "remote", url: "https://mcp.close.com/mcp", auth: "Token", authHeader: { header: "Authorization", prefix: "Bearer ", label: "Close API key" } },
  { id: "google-calendar", name: "Google Calendar", desc: "Events, reminders, my day", category: "Productivity", mode: "command", command: "npx -y @cocal/google-calendar-mcp", auth: "Setup" },
  { id: "gmail", name: "Gmail", desc: "Read/send mail, labels", category: "Productivity", mode: "command", command: "npx -y @gongrzhe/server-gmail-autoauth-mcp", auth: "Setup" },
  { id: "filesystem-local", name: "Filesystem", desc: "Read/write workspace files", category: "Productivity", mode: "command", command: "npx -y @modelcontextprotocol/server-filesystem /tmp/oc-workspace", auth: "Free" },
  { id: "memory-local", name: "Memory", desc: "Persistent knowledge graph", category: "Productivity", mode: "command", command: "npx -y @modelcontextprotocol/server-memory", auth: "Free" },
  { id: "sequential-local", name: "Sequential Thinking", desc: "Structured multi-step reasoning", category: "Productivity", mode: "command", command: "npx -y @modelcontextprotocol/server-sequential-thinking", auth: "Free" },

  // ── Communication ───────────────────────────────────────────────
  { id: "intercom", name: "Intercom", desc: "Customers, conversations", category: "Communication", mode: "remote", url: "https://mcp.intercom.com/sse", auth: "OAuth" },
  { id: "fireflies", name: "Fireflies", desc: "Meeting notes & transcripts", category: "Communication", mode: "remote", url: "https://api.fireflies.ai/mcp", auth: "Token", authHeader: { header: "Authorization", prefix: "Bearer ", label: "Fireflies API key" } },
  { id: "telnyx", name: "Telnyx", desc: "Calls, SMS, phone numbers", category: "Communication", mode: "remote", url: "https://api.telnyx.com/v2/mcp", auth: "Token", authHeader: { header: "Authorization", prefix: "Bearer ", label: "Telnyx API key" } },
  { id: "slack-local", name: "Slack", desc: "Channels, messages, users", category: "Communication", mode: "command", command: "npx -y @modelcontextprotocol/server-slack", envKeys: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"], auth: "Key" },
  { id: "telegram-local", name: "Telegram", desc: "Send/manage messages via bot", category: "Communication", mode: "command", command: "npx -y @node2flow/telegram-bot-mcp", envKeys: ["TELEGRAM_BOT_TOKEN"], auth: "Key" },
  { id: "whatsapp-local", name: "WhatsApp", desc: "Cloud API messaging", category: "Communication", mode: "command", command: "npx -y @fredshred7/whatsapp-mcp-server", envKeys: ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN"], auth: "Key" },
  { id: "resend-remote", name: "Resend", desc: "Send transactional email", category: "Communication", mode: "remote", url: "https://mcp.resend.com/mcp", auth: "Token", authHeader: { header: "Authorization", prefix: "Bearer ", label: "Resend API key" } },

  // ── AI & web ────────────────────────────────────────────────────
  { id: "context7", name: "Context7", desc: "Up-to-date library docs", category: "AI & Web", mode: "remote", url: "https://mcp.context7.com/mcp", auth: "Free" },
  { id: "deepwiki", name: "DeepWiki", desc: "Ask any GitHub repo", category: "AI & Web", mode: "remote", url: "https://mcp.deepwiki.com/mcp", auth: "Free" },
  { id: "apify", name: "Apify", desc: "Scrapers, actors, datasets", category: "AI & Web", mode: "remote", url: "https://mcp.apify.com", auth: "OAuth" },
  { id: "simplescraper", name: "SimpleScraper", desc: "Web scraping snapshots", category: "AI & Web", mode: "remote", url: "https://mcp.simplescraper.io/mcp", auth: "Token", authHeader: { header: "Authorization", prefix: "Bearer ", label: "SimpleScraper key" } },
  { id: "globalping", name: "GlobalPing", desc: "Network diagnostics worldwide", category: "AI & Web", mode: "remote", url: "https://mcp.globalping.dev/sse", auth: "Free" },
  { id: "fetch-local", name: "Fetch", desc: "Fetch & read web pages", category: "AI & Web", mode: "command", command: "uvx mcp-server-fetch", auth: "Free" },
  { id: "brave-local", name: "Brave Search", desc: "Web & news search", category: "AI & Web", mode: "command", command: "npx -y @modelcontextprotocol/server-brave-search", envKeys: ["BRAVE_API_KEY"], auth: "Key" },
  { id: "exa-local", name: "Exa Search", desc: "Neural web search", category: "AI & Web", mode: "command", command: "npx -y exa-mcp-server", envKeys: ["EXA_API_KEY"], auth: "Key" },
  { id: "tavily-local", name: "Tavily", desc: "AI-optimized web search", category: "AI & Web", mode: "command", command: "npx -y tavily-mcp", envKeys: ["TAVILY_API_KEY"], auth: "Key" },
  { id: "firecrawl-local", name: "Firecrawl", desc: "Crawl & scrape any site", category: "AI & Web", mode: "command", command: "npx -y firecrawl-mcp", envKeys: ["FIRECRAWL_API_KEY"], auth: "Key" },
  { id: "playwright-local", name: "Playwright", desc: "Browser automation & tests", category: "AI & Web", mode: "command", command: "npx -y @playwright/mcp@latest", auth: "Free" },
  { id: "chrome-local", name: "Chrome DevTools", desc: "Debug pages, network, perf", category: "AI & Web", mode: "command", command: "npx -y chrome-devtools-mcp@latest", auth: "Free" },
  { id: "puppeteer-local", name: "Puppeteer", desc: "Headless browser control", category: "AI & Web", mode: "command", command: "npx -y @modelcontextprotocol/server-puppeteer", auth: "Free" },
  { id: "maps-local", name: "Google Maps", desc: "Places, routes, geocoding", category: "AI & Web", mode: "command", command: "npx -y @modelcontextprotocol/server-google-maps", envKeys: ["GOOGLE_MAPS_API_KEY"], auth: "Key" },
  { id: "aws-docs-local", name: "AWS Docs", desc: "Official AWS documentation", category: "AI & Web", mode: "command", command: "uvx awslabs.aws-documentation-mcp-server", auth: "Free" },

  // ── Finance ─────────────────────────────────────────────────────
  { id: "stripe", name: "Stripe", desc: "Payments, customers, invoices", category: "Finance", mode: "remote", url: "https://mcp.stripe.com", auth: "Token", authHeader: { header: "Authorization", prefix: "Bearer ", label: "Stripe secret key" } },
  { id: "paypal", name: "PayPal", desc: "Orders, payouts, payments", category: "Finance", mode: "remote", url: "https://mcp.paypal.com/sse", auth: "OAuth" },
  { id: "square", name: "Square", desc: "Commerce, catalog, payments", category: "Finance", mode: "remote", url: "https://mcp.squareup.com/sse", auth: "OAuth" },
  { id: "plaid", name: "Plaid", desc: "Bank data, transactions", category: "Finance", mode: "remote", url: "https://api.dashboard.plaid.com/mcp/sse", auth: "Token", authHeader: { header: "Authorization", prefix: "Bearer ", label: "Plaid key" } },
  { id: "meta-ads", name: "Meta Ads", desc: "Facebook/Instagram ad analytics", category: "Finance", mode: "remote", url: "https://mcp.pipeboard.co/meta-ads-mcp", auth: "Token", authHeader: { header: "Authorization", prefix: "Bearer ", label: "Token" } },
  { id: "thoughtspot", name: "ThoughtSpot", desc: "BI queries & dashboards", category: "Finance", mode: "remote", url: "https://agent.thoughtspot.app/mcp", auth: "OAuth" },

  // ── Media / design ──────────────────────────────────────────────
  { id: "canva", name: "Canva", desc: "Designs, presentations, exports", category: "Media", mode: "remote", url: "https://mcp.canva.com/mcp", auth: "OAuth" },
  { id: "miro", name: "Miro", desc: "Boards, stickies, flowcharts", category: "Media", mode: "remote", url: "https://mcp.miro.com/", auth: "OAuth" },
  { id: "webflow", name: "Webflow", desc: "CMS, pages, publishing", category: "Media", mode: "remote", url: "https://mcp.webflow.com/sse", auth: "OAuth" },
  { id: "wix", name: "Wix", desc: "Sites, stores, members", category: "Media", mode: "remote", url: "https://mcp.wix.com/sse", auth: "OAuth" },
  { id: "cloudinary", name: "Cloudinary", desc: "Media library & transforms", category: "Media", mode: "remote", url: "https://asset-management.mcp.cloudinary.com/sse", auth: "OAuth" },
  { id: "invideo", name: "InVideo", desc: "AI video creation", category: "Media", mode: "remote", url: "https://mcp.invideo.io/sse", auth: "OAuth" },
  { id: "box", name: "Box", desc: "Files, folders, permissions", category: "Media", mode: "remote", url: "https://mcp.box.com", auth: "OAuth" },
  { id: "egnyte", name: "Egnyte", desc: "Enterprise file sharing", category: "Media", mode: "remote", url: "https://mcp-server.egnyte.com/sse", auth: "OAuth" },

  // ── Local tools / misc ──────────────────────────────────────────
  { id: "github-local", name: "GitHub (local)", desc: "Official GH MCP via npx", category: "Local tools", mode: "command", command: "npx -y @modelcontextprotocol/server-github", envKeys: ["GITHUB_PERSONAL_ACCESS_TOKEN"], auth: "Key" },
  { id: "gitlab-local", name: "GitLab (local)", desc: "Projects, issues, MRs", category: "Local tools", mode: "command", command: "npx -y @modelcontextprotocol/server-gitlab", envKeys: ["GITLAB_PERSONAL_ACCESS_TOKEN"], auth: "Key" },
  { id: "gdrive-local", name: "Google Drive", desc: "Files, docs, shared drives", category: "Local tools", mode: "command", command: "npx -y @modelcontextprotocol/server-gdrive", auth: "Setup" },
  { id: "supabase-local", name: "Supabase (local)", desc: "MCP with access token flag", category: "Local tools", mode: "command", command: "npx -y @supabase/mcp-server-supabase@latest --access-token <TOKEN>", argToken: { marker: "<TOKEN>", label: "Supabase secret key (sb_secret_…)" }, auth: "Key" },
  { id: "grafana-local", name: "Grafana", desc: "Dashboards, Loki, Prometheus", category: "Local tools", mode: "command", command: "uvx mcp-grafana", envKeys: ["GRAFANA_URL", "GRAFANA_API_KEY"], auth: "Key" },
  { id: "sentry-local", name: "Sentry (local)", desc: "Sentry issues via npx", category: "Local tools", mode: "command", command: "npx -y @modelcontextprotocol/server-sentry", envKeys: ["SENTRY_AUTH_TOKEN"], auth: "Key" },
  { id: "time-local", name: "Time & timezone", desc: "World clocks, conversions", category: "Local tools", mode: "command", command: "uvx mcp-server-time --local-timezone UTC", auth: "Free" },
];

export function splitCommand(cmd: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  for (const ch of cmd.trim()) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === " ") {
      if (cur) out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
