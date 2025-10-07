import { copy } from "@std/fs/copy";
import { ensureDir } from "@std/fs/ensure_dir";
import { exists } from "@std/fs/exists";
import { dirname, join } from "@std/path";
import { build } from "dnt";
import denoJson from "./deno.json" with { type: "json" };

// Copy pkg assets into src (keeps existing behavior for local dev)
await copy("pkg/osc_wasm.js", "src/osc_wasm.js", { overwrite: true });
await copy("pkg/osc_wasm.d.ts", "src/osc_wasm.d.ts", { overwrite: true });
await copy("pkg/osc_wasm_bg.wasm", "src/osc_wasm_bg.wasm", { overwrite: true });
await copy("pkg/osc_wasm_bg.wasm.d.ts", "src/osc_wasm_bg.wasm.d.ts", {
  overwrite: true,
});
await copy("pkg/osc_wasm_bg.js", "src/osc_wasm_bg.js", { overwrite: true });

// Build npm package using dnt
const outDir = "./npm";
await ensureDir(outDir);

// Ensure the wasm file is present in pkg
if (!(await exists("pkg/osc_wasm_bg.wasm"))) {
  console.warn(
    "warning: pkg/osc_wasm_bg.wasm not found. Make sure wasm build ran.",
  );
}

// dnt emit options
await build({
  entryPoints: ["./src/main.ts"],
  outDir,
  package: {
    name: "osc-wasm",
    version: denoJson.version,
    description: denoJson.description,
    license: denoJson.license,
    type: "module",
    files: [
      "esm/",
      "src/",
      "osc_wasm.js",
      "osc_wasm.d.ts",
      "osc_wasm_bg.wasm",
      "osc_wasm_bg.js",
      "osc_wasm_bg.wasm.d.ts",
    ],
  },
  test: false,
  shims: {},
  scriptModule: false,
});

// copy runtime assets (wasm + companion files) into npm package
const copyFiles = [
  ["pkg/osc_wasm_bg.wasm", join(outDir, "osc_wasm_bg.wasm")],
  ["pkg/osc_wasm.js", join(outDir, "osc_wasm.js")],
  ["pkg/osc_wasm.d.ts", join(outDir, "osc_wasm.d.ts")],
  ["pkg/osc_wasm_bg.wasm.d.ts", join(outDir, "osc_wasm_bg.wasm.d.ts")],
  ["pkg/osc_wasm_bg.js", join(outDir, "osc_wasm_bg.js")],
];

for (const [src, dest] of copyFiles) {
  if (await exists(src)) {
    await ensureDir(dirname(dest));
    await copy(src, dest, { overwrite: true });
  }
}
