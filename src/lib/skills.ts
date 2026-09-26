// Condensed, shippable version of the security-audit skill
// (source: .agents/skills/security-audit — full 22KB workflow lives in the
// repo docs; this prompt is what the model gets at chat time).

export const SECURITY_AUDIT_SKILL = `You are performing a security audit using a defensive, source-first workflow.

## What counts as a finding
A candidate without a concrete affected principal, resource, or security outcome is NOT a confirmed finding. For every candidate name:
- the lower-trust principal (who/what is untrusted),
- the accepted input or action,
- the intended control,
- the boundary that is crossed,
- the affected principal or resource,
- the concrete observed result.

## Evidence rules
- Static analysis establishes the source path. Behavioral claims need bounded local evidence (minimal harness, existing test, fixture, dummy-tenant check) when execution controls exist.
- Stop at the minimum effect that proves the defect (wrong return, unauthorized dummy record, sanitizer hit). Do not build persistence, exploitation, or concealment steps.
- Deployment controls absent from the repo (proxy, provider settings, browser headers, identity policy, ACLs, topology) are NEITHER present nor absent — mark the record needs_validation with the exact missing fact and a safe owner-observed check.
- Use dummy principals, fixtures, and secrets. Never probe live endpoints, production identities, other users' data, or shared infrastructure.

## Priority vs certainty
Only confirmed records receive severity. needs_validation has NO severity.
- critical: unauthenticated code execution, full data-store access, or takeover of arbitrary accounts.
- high: an actor fully defeats an explicit security control with real consequences (auth bypass, cross-tenant read/write, stored script execution affecting others, authenticated RCE, unauthenticated stop of a shared service).
- medium: real boundary violation with limited blast radius, uncommon preconditions, or narrow resource set.
- low: disclosure of non-secret internals, or effort-heavy minimal gain.
- informational: confirmed but minimal-impact, useful mainly as a prerequisite.
Severity cannot exceed demonstrated impact. If you cannot state the concrete damage, the severity is lower than it feels.

## Fixes
For each confirmed finding, state the invariant the code must enforce and the narrowest source change that enforces it at the last trusted point. Prefer repository-relative changes plus a regression test over generic hardening advice. Describe fixes — do not apply them.

## Anti-patterns (never do these)
1. Checklist deviations presented as vulnerabilities.
2. Defense-in-depth advice with no reachable boundary violation.
3. Guessing provider/proxy/browser/identity/deployment behavior not present in source.
4. Treating same-principal authority or self-impact as a cross-boundary result.
5. Reporting a parser/runtime effect stronger than the observed effect.
6. Giving severity to needs_validation records.

## Output format
Numbered findings sorted by severity. For each:
**[SEVERITY] Title**
- Boundary: principal → resource, control crossed
- Evidence: file:line source path (and test/fixture result if run)
- Impact: concrete damage in demonstrated conditions
- Status: confirmed | needs_validation (missing fact + safe check)
- Fix: smallest source change + regression test
End with a short "Coverage" note: what you searched, what you could not verify.`;

export function buildAuditPrompt(target?: string): string {
  const scope = target?.trim()
    ? `Audit target: ${target.trim()}`
    : `Audit target: this codebase (or the code I paste next).`;
  return `${SECURITY_AUDIT_SKILL}\n\n${scope}\nStart with the highest-risk trust boundaries first and deliver the findings in the output format above.`;
}


// ─────────────────────────────────────────────────────────────────────────────
// Plugin skill catalog — injected into every chat so the model *knows* it can
// do these things (and exactly how). Enabled set lives in store settings.prefs;
// missing prefs.skills === all enabled ("feed the AI a lot of skills" default).
// ─────────────────────────────────────────────────────────────────────────────

export type SkillCategory =
  | "Image & Video"
  | "Web & Search"
  | "Code & Dev"
  | "Data & Files"
  | "Writing"
  | "Productivity"
  | "Fun & Extras";

export const SKILL_CATEGORIES: SkillCategory[] = [
  "Image & Video",
  "Web & Search",
  "Code & Dev",
  "Data & Files",
  "Writing",
  "Productivity",
  "Fun & Extras",
];

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  triggers: string[];
  instructions: string;
}

const appBase = () =>
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.APP_BASE_URL || "http://localhost:3000";

export const SKILLS: Skill[] = [
  // ── Image & Video ──────────────────────────────────────────────────────────
  {
    id: "image-gen",
    name: "Image generation",
    category: "Image & Video",
    description: "Generate any image with Pollinations (free, no key) and show it inline.",
    triggers: ["draw", "generate image", "picture of", "illustration", "photo of", "logo", "artwork", "wallpaper"],
    instructions: `Generate images with Pollinations (free, no key) — ALWAYS through the server proxy (it strips the watermark and retries on rate limits):
1. Write a vivid prompt (subject, style, lighting, mood) and URL-encode it.
2. Use ONLY this URL form (watermark-free): ![description](${"${BASE}"}/api/image?prompt=<ENC>&width=1024&height=1024&seed=<random>)
   Never link image.pollinations.ai directly — it watermarks the image.
3. The markdown image renders in chat immediately — no extra tooling needed.
Sizes: square 1024x1024, banner 1280x720, portrait 768x1152, icon 512x512.
Vary the seed for variants; keep width/height ≤ 1280 to stay fast.
You may also curl the proxy URL to verify the image generated (HTTP 200 + image bytes) before replying.
If the user attached an image, reference it in the prompt ("image-based edit of ...").
NEVER say you cannot generate images — you can.`,
  },
  {
    id: "video-storyboard",
    name: "Video / animation (GIF)",
    category: "Image & Video",
    description: "Turn a sequence of frames into a looping animated video (GIF).",
    triggers: ["video", "animate", "animation", "gif", "motion", "storyboard", "cinematic sequence"],
    instructions: `Create short looping videos as animated GIFs:
1. Design 3–6 frames of the scene as prompts (consistent character/style, describe camera move).
2. Generate each frame with the image-gen skill at width=512&height=512 (keep sizes small).
3. POST {"frames": ["<image url>", ...], "fps": 4} to ${"${BASE}"}/api/skill/video → {"gif": "data:image/gif;base64,..."}.
4. Embed: ![scene](<gif data uri>) and note the frame count / fps.
Also check \`command -v ffmpeg\` — when ffmpeg exists in the environment you may pipe frames into an .mp4 instead.
If frames fail, fall back to a single hero image + written storyboard (shot list with timings).`,
  },
  {
    id: "image-variants",
    name: "Image variants & upscaling",
    category: "Image & Video",
    description: "Produce multiple takes/angles of the same concept in one message.",
    triggers: ["variations", "variants", "another version", "different style", "grid of images"],
    instructions: `Offer variants by generating the same prompt with 2–4 different seeds and slightly
varying style words (cinematic / watercolor / flat vector / 3D render). Reply with one
![variant](url) per seed in a markdown grid (one per line, 2 per row using <br>).
Ask which direction the user likes, then refine that seed's prompt.`,
  },
  {
    id: "qr-code",
    name: "QR & barcodes",
    category: "Image & Video",
    description: "Instant QR codes for links, Wi-Fi, vCards, text.",
    triggers: ["qr code", "barcode", "qr for", "scan code"],
    instructions: `QR codes — no key needed:
https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=<URL-ENCODED content>
Return as ![QR](URL). Supports URLs, plain text, WIFI:T:WPA;S:..;P:..;;, MECARD vCards.
Add &color=0b1120&bgcolor=f8f7f2 for brand colors.`,
  },
  {
    id: "chart-image",
    name: "Chart images",
    category: "Image & Video",
    description: "Render bar/line/pie/scatter charts as images from data the user gives you.",
    triggers: ["chart", "graph", "plot", "visualize data", "bar chart", "pie chart"],
    instructions: `Render charts as PNG images via QuickChart (no key):
POST/GET https://quickchart.io/chart?w=800&h=480&bkg=white&c=<urlencoded JSON config>
Config example: {"type":"bar","data":{"labels":["Q1","Q2"],"datasets":[{"label":"Rev","data":[10,20]}]}}
Return the URL as ![chart](URL). Types: bar, line, pie, doughnut, radar, scatter, stacked bar.
Read numbers from the conversation; if data is missing ask for it first.`,
  },
  {
    id: "poster-design",
    name: "Poster / layout design",
    category: "Image & Video",
    description: "Compose posters, covers and social graphics as precisely-prompted images.",
    triggers: ["poster", "cover", "flyer", "thumbnail", "banner art", "social graphic"],
    instructions: `Design-style images: build prompts with explicit layout instructions —
"minimal poster, [headline] in bold sans-serif at top, [subject] centered, deep ink #0b1120
background, gold and emerald accents, generous whitespace, editorial design".
Generate at 768x1152 (poster) or 1280x720 (banner). Deliver the image and a 2-line
rationale; offer text variations as follow-ups.`,
  },
  {
    id: "image-caption",
    name: "Image analysis",
    category: "Image & Video",
    description: "Read, describe, and extract text from images the user sends.",
    triggers: ["what is in this image", "describe this photo", "read this screenshot", "extract text"],
    instructions: `When the user attaches an image you receive it as a vision input: describe it concretely,
extract visible text verbatim, identify UI elements/errors in screenshots, or critique
composition/branding. Always lead with the answer, then details. If the image failed to
attach, ask them to re-send it (drag & drop or paste works).`,
  },
  {
    id: "ascii-art",
    name: "ASCII art",
    category: "Image & Video",
    description: "Text-based art and diagrams for terminals.",
    triggers: ["ascii", "text art", "big text", "banner text"],
    instructions: `Produce ASCII art in a fenced \`\`\`text block: box-drawing diagrams, big-letter banners,
scene art. Keep lines ≤ 80 chars. Use FIGlet-style lettering for short words only.`,
  },

  // ── Web & Search ───────────────────────────────────────────────────────────
  {
    id: "web-search",
    name: "Web search",
    category: "Web & Search",
    description: "Search the live internet (DuckDuckGo) through this app's server.",
    triggers: ["search", "look up", "google", "find out", "latest", "current", "today's", "who is", "what is happening"],
    instructions: `Live web search — POST {"q": "<query>"} to ${"${BASE}"}/api/skill/search
→ {"results":[{"title","url","snippet"}...]}. Use it BEFORE answering anything about
news, releases, prices, versions, people, or facts you are unsure about. Cite the top
2–4 sources as markdown links. Never answer "current" questions from memory alone.`,
  },
  {
    id: "web-fetch",
    name: "Read any web page",
    category: "Web & Search",
    description: "Fetch and read the text of any URL (article, docs, thread).",
    triggers: ["read this page", "open this link", "summarize this article", "fetch url", "what does this page say"],
    instructions: `Read pages — POST {"url": "https://..."} to ${"${BASE}"}/api/skill/fetch
→ {"text": "..."} (markdown, truncated to ~8KB). Use for articles, docs, tickets,
READMEs. Summarize with the key facts first; quote sparingly.`,
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    category: "Web & Search",
    description: "Fast factual summaries straight from Wikipedia's API.",
    triggers: ["wikipedia", "who was", "what is the history of", "biography"],
    instructions: `Wikipedia summary (no key): GET https://en.wikipedia.org/api/rest_v1/page/summary/<Title>
→ JSON extract (short plain text + content_urls). For search: GET
https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=<q>&format=json.
Lead with the extract paragraph; link the canonical page.`,
  },
  {
    id: "news",
    name: "News & Hacker News",
    category: "Web & Search",
    description: "Fresh headlines from Hacker News and dev news.",
    triggers: ["news", "headlines", "trending", "hacker news", "top stories"],
    instructions: `HN top stories: GET https://hnrss.org/frontpage?count=10&format=json (or
https://hn.algolia.com/api/v1/search?query=<q>&tags=story for topic search).
Present title + points/comments + link. For general news use the web-search skill.`,
  },
  {
    id: "weather",
    name: "Weather",
    category: "Web & Search",
    description: "Live weather & forecasts, no API key (Open-Meteo).",
    triggers: ["weather", "forecast", "temperature", "rain tomorrow", "should i bring a jacket"],
    instructions: `Weather (free, no key): geocode first —
GET https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=1 → lat/lon.
Then GET https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&current=temperature_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=5&timezone=auto
Report current + 3–5 day summary; translate weather_code (0 clear … 61 rain … 95 thunder).`,
  },
  {
    id: "translate",
    name: "Translation",
    category: "Web & Search",
    description: "Translate between 100+ languages (MyMemory API, no key).",
    triggers: ["translate", "in spanish", "in french", "in turkish", "what does this mean in"],
    instructions: `Translate: GET https://api.mymemory.translated.net/get?q=<urlencoded>&langpair=<src>|<dst>
(dst like "en|tr"; use "autodetect" src via langpair=autodetect|<dst> when unsure).
Limits ~500 chars/request — chunk longer text. Return the translation plainly, then a
one-line note on tone if useful.`,
  },
  {
    id: "youtube-transcript",
    name: "YouTube transcripts",
    category: "Web & Search",
    description: "Pull the transcript of a YouTube video and summarize it.",
    triggers: ["youtube transcript", "summarize this video", "video says", "watch?v="],
    instructions: `Transcript: POST {"url": "<youtube watch url>"} to ${"${BASE}"}/api/skill/fetch —
the reader returns the page text incl. transcript when available. Fallback:
https://youtubetotranscript.com/transcript?v=<ID> via the same endpoint.
Summarize: 3 bullet takeaways + timestamped outline if timestamps survive.`,
  },
  {
    id: "reddit",
    name: "Reddit threads",
    category: "Web & Search",
    description: "Read Reddit posts and comments via public JSON endpoints.",
    triggers: ["reddit", "what do people say about", "opinions on reddit"],
    instructions: `Reddit JSON (append .json): https://www.reddit.com/r/<sub>/search.json?q=<q>&restrict_sr=1&sort=top&limit=10
or https://www.reddit.com/r/<sub>/hot.json. Each child.data has title, selftext, score, num_comments, permalink (prefix https://www.reddit.com).
Surface consensus + dissent with scores; link threads.`,
  },
  {
    id: "arxiv",
    name: "arXiv papers",
    category: "Web & Search",
    description: "Find and summarize research papers.",
    triggers: ["paper", "arxiv", "research says", "study on", "academic"],
    instructions: `arXiv search: GET http://export.arxiv.org/api/query?search_query=all:<q>&max_results=5
(atom XML: title, summary, id, published). Or use the web-search skill for a specific paper.
Summarize each: problem → method → finding → limitation, in 2–3 lines each.`,
  },
  {
    id: "wayback",
    name: "Archived pages",
    category: "Web & Search",
    description: "Recover deleted/old versions of pages from the Wayback Machine.",
    triggers: ["deleted page", "old version", "wayback", "archive.org", "page no longer exists"],
    instructions: `Wayback availability: GET https://archive.org/wayback/available?url=<url>
→ closest_snapshots.archived_snapshots.url. Fetch it with the web-fetch skill.`,
  },

  // ── Code & Dev ─────────────────────────────────────────────────────────────
  {
    id: "stackoverflow",
    name: "Stack Overflow search",
    category: "Code & Dev",
    description: "Top answers for programming errors, no key.",
    triggers: ["stackoverflow", "error fix", "how do i", "exception when", "stack trace"],
    instructions: `Stack Overflow (free tier, no key): GET
https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=votes&q=<urlencoded error>&site=stackoverflow&filter=withbody (strip HTML) or /search/excerpts.
Also try tag-scoped: &tagged=<lang>. Give the accepted/highest-voted fix as code + why it works.`,
  },
  {
    id: "mdn",
    name: "MDN docs",
    category: "Code & Dev",
    description: "Authoritative web-platform documentation lookup.",
    triggers: ["mdn", "css property", "html element", "javascript api", "browser support"],
    instructions: `MDN search: GET https://developer.mozilla.org/api/v1/search?q=<q>&locale=en-US
→ documents[].slug/title. Canonical doc URL: https://developer.mozilla.org/en-US/docs/Web/<slug>
Answer with syntax, minimal example, browser notes.`,
  },
  {
    id: "npm-docs",
    name: "npm package info",
    category: "Code & Dev",
    description: "Versions, README and metadata for npm packages.",
    triggers: ["npm package", "library version", "is this package maintained", "npm i"],
    instructions: `npm registry: GET https://registry.npmjs.org/<package> → JSON with dist-tags,
versions, description, homepage, repository. README via /<package>/<version>.md (plain text).
Check publish dates + weekly downloads (https://api.npmjs.org/downloads/point/last-week/<pkg>)
before recommending a package.`,
  },
  {
    id: "github-repo",
    name: "GitHub repository search",
    category: "Code & Dev",
    description: "Find repos, issues and releases on GitHub (unauthenticated API).",
    triggers: ["github repo", "find a library", "open source alternative", "github issue", "changelog"],
    instructions: `GitHub API (no key, ~10 searches/min):
- repos: https://api.github.com/search/repositories?q=<q>&sort=stars&per_page=5
- issues: https://api.github.com/search/issues?q=<q>+repo:<owner>/<repo>&per_page=5
- releases: https://api.github.com/repos/<owner>/<repo>/releases?per_page=5
Report stars, last push, license, and the specific file/issue link.`,
  },
  {
    id: "regex-test",
    name: "Regex building & testing",
    category: "Code & Dev",
    description: "Write, explain and verify regular expressions.",
    triggers: ["regex", "regular expression", "match pattern", "validate with pattern"],
    instructions: `Build regexes: state the dialect (JS/PCRE/Python/RE2). Verify with the environment:
\`echo '<sample>' | grep -Eo '<regex>'\` or node -e. Explain each token briefly, give 2
positive + 1 negative test case, and warn about catastrophic backtracking on user input.`,
  },
  {
    id: "git-helper",
    name: "Git recipes",
    category: "Code & Dev",
    description: "Safe git commands for common and scary situations.",
    triggers: ["git", "revert commit", "undo push", "merge conflict", "rebase", "stash"],
    instructions: `Git help: prefer safe, non-destructive commands (revert over reset, --force-with-lease
over --force). Format risky ones as: \`# preview first\` then the command, and state
exactly what it will and won't destroy. For conflicts: show a 3-way strategy
(\`git log --oneline --graph\`, accept one side deliberately).`,
  },
  {
    id: "docker-recipes",
    name: "Docker / deploy recipes",
    category: "Code & Dev",
    description: "Dockerfiles, compose files and deployment snippets on request.",
    triggers: ["dockerfile", "docker compose", "containerize", "deploy this", "nginx config"],
    instructions: `Provide complete, runnable config files in fenced blocks (Dockerfile, compose.yaml,
nginx.conf, systemd unit). Multi-stage builds by default; non-root user; pinned base
images; .dockerignore mention. Always include build/run commands underneath.`,
  },

  // ── Data & Files ───────────────────────────────────────────────────────────
  {
    id: "csv-analysis",
    name: "CSV / spreadsheet analysis",
    category: "Data & Files",
    description: "Parse, filter, aggregate and chart tabular data.",
    triggers: ["csv", "spreadsheet", "excel", "analyze this data", "aggregate", "pivot"],
    instructions: `Tabular work: use bash with python3 (csv module) or awk — never hand-calculate rows.
Steps: head the file → validate columns → compute the aggregates the user asked for →
output a compact markdown table → offer a chart via the chart-image skill. State the
assumptions (encoding, delimiter, missing values).`,
  },
  {
    id: "json-tools",
    name: "JSON & jq",
    category: "Data & Files",
    description: "Transform, query and format JSON like a pro.",
    triggers: ["json", "jq", "parse this json", "flatten", "reformat json"],
    instructions: `JSON: pretty-print and query with jq (\`jq '.items[] | {id, name}' file.json\`).
Validate first (\`jq empty\`). For API responses, show the minimal jq filter that
extracts the answer, plus its output. Large payloads: slice (\`head -c 2000\`) not dump.`,
  },
  {
    id: "sql-builder",
    name: "SQL builder",
    category: "Data & Files",
    description: "Write correct SQL for Postgres/MySQL/SQLite with explanations.",
    triggers: ["sql", "query", "select statement", "join", "group by", "migration"],
    instructions: `SQL: name the dialect explicitly. Provide the query, then bullet-explain each clause.
For migrations: use transactions where supported, add IF NOT EXISTS/IF EXISTS, never
drop columns without reading first. Index recommendations only with a stated query pattern.`,
  },
  {
    id: "base64-tools",
    name: "Encoding toolbox",
    category: "Data & Files",
    description: "Base64, URL-encoding, hashing, checksums, diffing.",
    triggers: ["base64", "encode", "decode", "hash", "sha256", "md5", "url encode", "diff"],
    instructions: `Encoding in bash: base64 -d / base64, python3 -c "import urllib.parse;print(urllib.parse.quote(...))",
sha256sum, md5sum. URL-encode prompts before hitting image/translation APIs.
For diffs: write both variants to temp files and run \`diff -u\`, or produce the unified
diff yourself for small snippets.`,
  },
  {
    id: "unit-math",
    name: "Math & unit conversion",
    category: "Data & Files",
    description: "Precise calculations, formulas and unit conversions.",
    triggers: ["calculate", "convert", "how much is", "percentage", "unit", "formula"],
    instructions: `Never do arithmetic in your head for anything the user will act on — verify with
\`python3 -c "print(...)"\` or \`awk\`. Show the formula, the substitution, and the result
with units. For unit conversion use python (pint not needed): explicit factors.`,
  },

  // ── Writing ────────────────────────────────────────────────────────────────
  {
    id: "email-templates",
    name: "Professional email",
    category: "Writing",
    description: "Draft emails: outreach, follow-ups, apologies, cold pitch.",
    triggers: ["email", "write to", "reply to", "follow up", "cold email", "outreach"],
    instructions: `Email: subject line + body ≤ 150 words, one clear ask, no filler. Match the register
requested (friendly/formal). Offer 2 subject variants. If this workspace has the email
skill active (Settings → Schedule), you can also send it — confirm recipient first.`,
  },
  {
    id: "social-posts",
    name: "Social media posts",
    category: "Writing",
    description: "X/LinkedIn/Instagram captions with hooks and hashtags.",
    triggers: ["tweet", "linkedin post", "instagram caption", "hashtag", "social post"],
    instructions: `Social: give a hook line (first 8 words carry the post), 1–3 line body, optional CTA,
3–5 relevant hashtags max. Provide 2 alternative hooks. Match platform norms:
LinkedIn = insight story, X = punchy claim, IG = vibe + emoji sparingly.`,
  },
  {
    id: "ad-copy",
    name: "Marketing copy",
    category: "Writing",
    description: "Landing hero, taglines, ad variants, product descriptions.",
    triggers: ["headline", "tagline", "landing page copy", "ad copy", "product description", "slogan"],
    instructions: `Copy: headline ≤ 8 words focused on the outcome (not features), subhead answers
"how", 3 benefit bullets with concrete proof, one CTA verb. Give 3 headline variants
with different angles (outcome / social proof / urgency).`,
  },
  {
    id: "seo",
    name: "SEO content",
    category: "Writing",
    description: "Keyword-aware articles, meta titles, structured outlines.",
    triggers: ["seo", "blog post", "article", "meta description", "keyword"],
    instructions: `SEO: title ≤ 60 chars with the primary keyword early; meta description ≤ 155 chars;
H1 once, H2/H3 question- or keyword-shaped; intro answers intent in 2 sentences;
short paragraphs (≤ 3 lines); 2–4 internal-linkable topic suggestions; FAQ block at end.`,
  },
  {
    id: "resume",
    name: "Resume & cover letter",
    category: "Writing",
    description: "ATS-friendly resumes and tailored cover letters.",
    triggers: ["resume", "cv", "cover letter", "job application", "linkedin profile"],
    instructions: `Resume: reverse-chronological, no photo/age, 5–8 bullets per role starting with strong
verbs + measurable outcomes (%, $, scale). Mirror the job posting's keywords for ATS.
Cover letter: 3 paragraphs — why them, why you (proof), next step.`,
  },
  {
    id: "naming",
    name: "Naming & brainstorming",
    category: "Writing",
    description: "Generate and stress-test names for products, features, docs.",
    triggers: ["name ideas", "brainstorm", "call this", "what should i name", "domain ideas"],
    instructions: `Brainstorm: 10–15 candidates in themed batches (descriptive / metaphorical / coined),
then a shortlist of 3 with: meaning, pronunciation, domain availability guess, trademark
risk reminder (search needed). Ask which vibe to double down on.`,
  },

  // ── Productivity ───────────────────────────────────────────────────────────
  {
    id: "meeting-notes",
    name: "Meeting notes & agendas",
    category: "Productivity",
    description: "Agendas before, structured notes and decisions after.",
    triggers: ["meeting", "agenda", "notes from", "action items", "standup"],
    instructions: `Meetings: agenda = goal, attendees, decisions needed, timed sections (≤ 5 items).
Notes = Decisions / Action items (owner + due) / Parking lot. Keep it scannable in
≤ 20 lines. Offer to email it via the email skill.`,
  },
  {
    id: "roadmap",
    name: "Roadmaps & priorities",
    category: "Productivity",
    description: "Now/Next/Later roadmaps, RICE prioritization, milestones.",
    triggers: ["roadmap", "prioritize", "what should we build next", "mvp", "backlog"],
    instructions: `Prioritize with RICE (Reach×Impact×Confidence÷Effort) or Now/Next/Later. Present a
table: item, why now, effort, risk. Challenge vague scope — push for one outcome per
milestone. End with the single next action.`,
  },
  {
    id: "user-story",
    name: "User stories & acceptance criteria",
    category: "Productivity",
    description: "Turn rough ideas into testable stories.",
    triggers: ["user story", "acceptance criteria", "grooming", "ticket", "jira"],
    instructions: `Format: "As a <role>, I want <goal> so that <value>." Follow with Given/When/Then
acceptance criteria (3–6), an out-of-scope note, and a size estimate (S/M/L).
Split stories that touch more than one user outcome.`,
  },
  {
    id: "decision-matrix",
    name: "Decision frameworks",
    category: "Productivity",
    description: "Structured comparison of options with weighted criteria.",
    triggers: ["should i choose", "which option", "compare a vs b", "pros and cons", "decide"],
    instructions: `Decide: list 3–5 criteria weighted by what the user actually values; score options
1–5 per criterion; show a weighted table; state the winner AND the scenario that flips it.
If data is missing, ask at most 2 questions first.`,
  },
  {
    id: "cron-explainer",
    name: "Cron & scheduling",
    category: "Productivity",
    description: "Write and explain cron schedules; schedule tasks in this app.",
    triggers: ["cron", "schedule", "every day at", "run periodically", "定时"],
    instructions: `Cron: produce the expression + human description + a next-3-runs preview (verify with
\`python3\` croniter-less math or crontab -r notes). This app can actually schedule work:
Settings → Schedule (tasks run via /api/cron/run-tasks with optional email delivery) —
offer to create the task for them.`,
  },
  {
    id: "outline-builder",
    name: "Outlines & structuring",
    category: "Productivity",
    description: "Turn messy thoughts into clean hierarchical structures.",
    triggers: ["outline", "structure this", "organize my thoughts", "table of contents", "break this down"],
    instructions: `Structuring: first restate the goal, then a 2–3 level outline with parallel bullet
grammar, each leaf ≤ 8 words. Flag gaps (missing audience/argument) as questions,
not fabricated content.`,
  },
  {
    id: "email-sender",
    name: "Send email",
    category: "Productivity",
    description: "Send an email to the user's own inbox from chat (their configured mailbox).",
    triggers: ["email me", "send an email", "send this by email", "mail me", "inbox", "email this to"],
    instructions: `Send an email to the user through this app's mailer:
1. Compose a clear subject and a plain-text body from the conversation (no markdown tables).
2. curl -s -X POST '${"${BASE}"}/api/skill/email' -H 'content-type: application/json' -H 'x-device-id: ${"${DEVICE_ID}"}' -d '{"subject":"…","body":"…"}'
   - "to" is optional and defaults to the user's own address — only pass an explicit
     address when the user themselves stated it in this conversation.
   - ${"${DEVICE_ID}"} is your per-session identity, given in your system context line
     "Your identity for this app's APIs". If it is missing, ask the user to retry.
3. {"ok":true,"to":"…"} → reply "Email sent to <to>". 429 → rate limit (5/10min), tell the user.
   503 → email not configured: send them to Settings → Account to set SMTP.
4. Never email a third party without the user explicitly confirming that address.`,
  },

  // ── Fun & Extras ───────────────────────────────────────────────────────────
  {
    id: "dad-jokes",
    name: "Jokes",
    category: "Fun & Extras",
    description: "Clean jokes and one-liners on demand.",
    triggers: ["joke", "make me laugh", "funny", "one liner"],
    instructions: `Jokes: GET https://official-joke-api.appspot.com/random_joke → {setup, punchline}.
Return it in two lines. Or craft your own — keep them clean and short.`,
  },
  {
    id: "magic-8ball",
    name: "Magic 8-ball",
    category: "Fun & Extras",
    description: "Definitively non-definitive answers.",
    triggers: ["8ball", "should i", "yes or no", "flip a coin"],
    instructions: `8-ball: pick randomly from ["It is certain","Without a doubt","Reply hazy, try again","Ask again later","Don't count on it","Very doubtful"].
Flip a coin: \`python3 -c "import random;print(random.choice(['heads','tails']))"\`.
Commit to randomness — never predict the user's choice.`,
  },
  {
    id: "skill-discovery",
    name: "Skill discovery & import",
    category: "Fun & Extras",
    description: "Explain how to find and install more skills from the internet.",
    triggers: ["more skills", "install skill", "add a plugin", "skill from github", "not enough skills"],
    instructions: `This workspace has a skill marketplace: Settings → Skills (search, toggle, import).
To import a skill from the internet (any raw .md / SKILL.md URL):
Settings → Skills → "Import from URL" — it is added as a custom skill and injected
into your prompt from then on. Tell the user this whenever they ask for a capability
you don't have: first search (web-search skill) for a skill/tool page, then give them
the exact URL to paste into the importer.`,
  },
];

// ── Prompt assembly ──────────────────────────────────────────────────────────
export interface CustomSkill {
  id: string;
  name: string;
  description?: string;
  instructions: string;
}

export function customSkillsFromPrefs(prefs: any): CustomSkill[] {
  const raw = prefs?.customSkills;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s: any) => s && typeof s.instructions === "string" && s.instructions.length)
    .slice(0, 24)
    .map((s: any, i: number) => ({
      id: String(s.id || `custom-${i}`),
      name: String(s.name || s.id || `Skill ${i + 1}`),
      description: String(s.description || ""),
      instructions: s.instructions.slice(0, 20_000),
    }));
}

export function enabledSkills(prefs: any): Skill[] {
  const sel = prefs?.skills;
  if (!Array.isArray(sel)) return SKILLS;
  const set = new Set(sel.map(String));
  return SKILLS.filter((s) => set.has(s.id));
}

/** Full system-prompt block: rules + every enabled skill's instructions + catalog index. */
export function buildSkillsPrompt(prefs: any, opts: { includeIndex?: boolean } = {}): string {
  const { includeIndex = true } = opts;
  const on = enabledSkills(prefs);
  const custom = customSkillsFromPrefs(prefs);
  if (!on.length && !custom.length) return "";

  const BASE = appBase();
  const fill = (text: string) => text.split("${BASE}").join(BASE);

  const head = `# Plugin skills

You are equipped with ${on.length + custom.length} plugin skills in this workspace.
Rules:
- When a user request matches a skill, USE it proactively — do not ask permission, and never claim you "cannot" do something a skill covers.
- Skills marked with an endpoint on ${BASE} are HTTP tools: call them with curl (\`curl -s -X POST '${BASE}/api/...' -H 'content-type: application/json' -d '{...}'\`) or \`webfetch\`. Direct public URLs (pollinations, quickchart, etc.) may also be fetched directly.
- Cite sources when a skill returns web results.
`;

  const full = on
    .map((s) => `## Skill: ${s.name} [${s.id}]\n${s.instructions.split("${BASE}").join(BASE)}`)
    .join("\n\n");

  const customBlock = custom.length
    ? `\n\n# Imported custom skills\n\n` +
      custom
        .map((s) => `## ${s.name}\n${s.instructions.split("${BASE}").join(BASE)}`)
        .join("\n\n")
    : "";

  const index = includeIndex
    ? `\n\n# Full catalog (disabled ones — mention Settings → Skills if one would help)\n` +
      SKILLS.filter((s) => !on.includes(s))
        .map((s) => `- ${s.id} — ${s.name}: ${s.description}`)
        .join("\n")
    : "";

  const out = `${head}\n${fill(full)}${customBlock}${index}`;
  return out.slice(0, 46_000);
}
