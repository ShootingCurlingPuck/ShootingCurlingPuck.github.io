// Makes the HTML pages safe for the TV (Chrome 56). Their inline <script>s aren't bundled with the app,
// so this runs each one through esbuild for Chrome 56, the same treatment the app's code gets (e.g. it
// drops trailing commas in function calls, which Chrome 56 can't read). Writes dist/html/<page>,
// which the deploy publishes instead of the originals. If a script can't be fully converted, the
// build fails and nothing gets published (the TV keeps the last good version).
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const PAGES = ["index.html", "diag.html"];
const OUT = "dist/html";

fs.mkdirSync(OUT, { recursive: true });
for (const page of PAGES) {
  const html = fs.readFileSync(page, "utf8");
  const safe = html.replace(/<script>([\s\S]*?)<\/script>/g, (all, code) => {
    const r = esbuild.transformSync(code, { target: "chrome56", loader: "js" });
    // esbuild only warns about the few things it can't convert: treat that as a failure too
    if (r.warnings.length)
      throw new Error(
        page + ": " + r.warnings.map((w) => w.text).join("; "),
      );
    return "<script>\n" + r.code + "</script>";
  });
  fs.writeFileSync(path.join(OUT, page), safe);
  console.log("TV-safe " + page + " -> " + OUT + "/" + page);
}
