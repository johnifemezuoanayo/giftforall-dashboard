export const sectionOptions = [
  { id: "gifts", label: "Gifts by recipient", basePath: "/gifts" },
  { id: "occasions", label: "Gifts by occasion", basePath: "/occasions" },
  { id: "discover", label: "Discover", basePath: "/discover" },
  { id: "unique-finds", label: "Unique finds", basePath: "/unique-finds" },
];

export const audienceOptions = [
  { id: "everyone", label: "Everyone" },
  { id: "men", label: "Men" },
  { id: "women", label: "Women" },
  { id: "kids", label: "Kids" },
  { id: "couples", label: "Couples" },
];

export function sectionLabel(id) {
  return sectionOptions.find((section) => section.id === id)?.label || id;
}

export function pagePath(page) {
  const base = sectionOptions.find((section) => section.id === page.section)?.basePath || `/${page.section}`;
  return page.slug ? `${base}/${page.slug}` : base;
}

// The rule in plain words, like "For men or everyone · Under $25".
export function ruleSummary(rule = {}, categoryNames = {}) {
  const parts = [];
  if (rule.ids?.length) parts.push(`${rule.ids.length} hand-picked`);
  if (rule.audiences?.length) {
    parts.push(`For ${rule.audiences.map((id) => audienceOptions.find((item) => item.id === id)?.label.toLowerCase() || id).join(" or ")}`);
  }
  if (rule.interests?.length) {
    const names = rule.interests.map((slug) => categoryNames[slug] || slug);
    parts.push(names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(" or "));
  }
  if (rule.maxPrice) parts.push(`Under $${Math.ceil(rule.maxPrice)}`);
  if (rule.trending) parts.push("Trending only");
  if (rule.sort === "featured") parts.push("Badges first");
  if (rule.sort === "newest") parts.push("Newest first");
  if (parts.length === 0) parts.push("All products");
  return parts;
}

// Links in the intro are written like [gifts for mom](/gifts/for-mom), so the intro can be edited as normal text.
export function introToText(intro = []) {
  return intro.map((part) => (typeof part === "string" ? part : `[${part.label}](${part.href})`)).join("");
}

export function textToIntro(text = "") {
  const parts = [];
  const linkPattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let match;
  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ label: match[1], href: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.filter((part) => part !== "");
}
