import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

const port = Number(process.env.PORT || 3000);

function serveFile(response, filePath) {
  response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}

createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const isDocumentRequest = request.headers.accept?.includes("text/html") || pathname === "/" || pathname === "/planner.html" || pathname.endsWith("/");
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(root, requestedPath));

  if (filePath.startsWith(root) && existsSync(filePath) && statSync(filePath).isFile()) {
    serveFile(response, filePath);
    return;
  }

  if (isDocumentRequest) {
    serveFile(response, join(root, "index.html"));
    return;
  }

  {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Static preview running on http://localhost:${port}`);
});
