import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");

const runtimeFiles = [
  "index.html",
  "navbar.html",
  "navbar.partial",
  "style.css",
  "_headers",
];
const runtimeDirectories = ["js", "product", "search", "shop"];
const assetDirectories = ["css", "fonts", "img", "vendor", "videos"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all([
  ...runtimeFiles.map((file) => copyFile(resolve(root, file), resolve(output, file))),
  ...runtimeDirectories.map((directory) =>
    cp(resolve(root, directory), resolve(output, directory), { recursive: true }),
  ),
  ...assetDirectories.map((directory) =>
    cp(
      resolve(root, "assets", directory),
      resolve(output, "assets", directory),
      { recursive: true },
    ),
  ),
]);
