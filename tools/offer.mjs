// Turns a pack offered through the "Offer a pack" issue form into a file in packs/ and a line in packs/index.json.
// Run by .github/workflows/offer.yml when such an issue is opened or edited.
//
//   node tools/offer.mjs                 reads the issue from the file GitHub names in GITHUB_EVENT_PATH
//   node tools/offer.mjs event.json      the same, from a file (for trying it by hand)
//   node tools/offer.mjs event.json --dry   checks and reports, writes nothing into packs/
//
// The issue is data from a stranger. Nothing in it is run, put into a command or used as a path: the file name is made
// here from letters, digits and hyphens, and the file's contents are what the app's own cleaners return.
// It writes offer-comment.md (what to tell the person) and offer-pr.md (the pull request's text) in the working
// folder, and sets the outputs ok ("true" or "false") and slug for the workflow.
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { problems, tidy, slug, packText, counts, MAX_BYTES } from "./packlib.mjs";
import { buildIndex } from "./gallery.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), ".."), args = process.argv.slice(2);
const dry = args.includes("--dry"), eventPath = args.find(a => !a.startsWith("--")) || process.env.GITHUB_EVENT_PATH;

// The issue form writes each answer under a "### Question" heading. Returns the answer under the heading that starts with the given words.
export function answer(body, heading) {
  const parts = String(body || "").replace(/\r/g, "").split(/^### +/m);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    if (nl > 0 && part.slice(0, nl).trim().toLowerCase().startsWith(heading)) return part.slice(nl + 1).trim();
  }
  return "";
}
function field(body, heading) { const a = answer(body, heading); return a === "_No response_" ? "" : a; }
// the pack: what is between the code fences if there are any, otherwise the whole answer
export function packField(body) {
  const a = field(body, "the pack"), m = /```[a-z]*\n([\s\S]*?)\n?```/.exec(a);
  return (m ? m[1] : a).trim();
}
const md = s => String(s).replace(/[\\`*_{}\[\]()#+!|<>@~]/g, "\\$&"); // text from the issue, shown as plain text in a comment
const list = c => Object.entries(c).filter(([, n]) => n > 0).map(([k, n]) => k === "scene" ? "a scene" : n + " " + (n === 1 ? k.replace(/s$/, "") : k)).join(", ");

export function handle(issue, taken) {
  const body = issue.body || "", text = packField(body), login = (issue.user && issue.user.login) || "";
  const no = why => ({ ok: false, comment: "This pack cannot go into the gallery as it is: " + why + "\n\nEdit the issue to try again. The format is described in [packs/README.md](../blob/main/packs/README.md)." });
  if (!text) return no("the form's pack box is empty.");
  if (text.length > MAX_BYTES) return no("it is larger than " + MAX_BYTES + " characters.");
  let raw;
  try { raw = JSON.parse(text); } catch (e) { return no("the pack box does not hold valid JSON. Copy the whole text from **Copy mine as text** in the app."); }
  const { pack, dropped } = tidy(raw, field(body, "pack name"), field(body, "your name") || login, field(body, "about"));
  if (!pack) return no("nothing in it could be used" + (dropped.length ? " (" + dropped.map(md).join(", ") + " would be refused by the app)." : "."));
  if (!pack.name) return no("it needs a name of 1 to 28 characters.");
  if (!pack.author) return no("it needs an author's name of 1 to 28 characters.");
  const out = packText(pack), left = problems(out);
  if (left.length) return no("the app would refuse or change it:\n\n" + left.map(x => "- " + md(x)).join("\n"));
  let name = slug(pack.name, "pack-" + issue.number);
  if (taken(name + ".json")) name = (name.slice(0, 32) + "-" + issue.number).replace(/^-/, "");
  const has = list(counts(pack));
  return {
    ok: true, slug: name, file: name + ".json", text: out,
    comment: "Thank you. The pack passed the same checks the app runs: " + has + "." +
      (dropped.length ? "\n\nLeft out, because the app would refuse them: " + dropped.map(md).join(", ") + "." : "") +
      "\n\nA pull request that adds it as `packs/" + name + ".json` has been opened. A maintainer will look at it, and at any programs in it, before it is merged. Editing this issue updates the pull request.",
    pr: "Adds `packs/" + name + ".json` (" + has + "), offered in #" + issue.number + " by " + md(login || "someone") + ".\n\n" +
      "Before merging: load the pack from this branch and look at every world, filter and overlay with a program in it. Merging marks them reviewed, which turns the flash limiter off for them (see packs/README.md, Reviewing a pack with programs).\n\nCloses #" + issue.number + "."
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!eventPath) { console.log("no event file"); process.exit(2); }
  const issue = JSON.parse(readFileSync(eventPath, "utf8")).issue || {};
  const r = handle(issue, f => existsSync(join(root, "packs", f)));
  if (r.ok && !dry) {
    writeFileSync(join(root, "packs", r.file), r.text);
    writeFileSync(join(root, "packs", "index.json"), buildIndex().text);
  }
  writeFileSync("offer-comment.md", r.comment + "\n");
  if (r.ok) writeFileSync("offer-pr.md", r.pr + "\n");
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "ok=" + (r.ok ? "true" : "false") + "\n" + (r.ok ? "slug=" + r.slug + "\n" : ""));
  console.log(r.ok ? "accepted as packs/" + r.file : "refused");
  console.log(r.comment);
}
