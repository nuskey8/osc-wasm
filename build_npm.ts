import { copy } from "@std/fs/copy";
import { ensureDir } from "@std/fs/ensure_dir";
import { exists } from "@std/fs/exists";
import { join } from "@std/path";
import { build } from "dnt";
import denoJson from "./deno.json" with { type: "json" };

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
    ],
  },
  test: false,
  shims: {},
  compilerOptions: {
    lib: ["DOM", "ES2022"],
    target: "ES2022",
  },
  scriptModule: false,
});

await copy("pkg/osc_wasm_bg.wasm", join(outDir, "esm/pkg/osc_wasm_bg.wasm"))
await copy("pkg/osc_wasm_bg.wasm", join(outDir, "src/pkg/osc_wasm_bg.wasm"))
