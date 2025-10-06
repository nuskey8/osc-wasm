import { copy } from "@std/fs/copy";

await copy("pkg/osc_wasm.js", "src/osc_wasm.js", { overwrite: true });
await copy("pkg/osc_wasm.d.ts", "src/osc_wasm.d.ts", { overwrite: true });
await copy("pkg/osc_wasm_bg.wasm", "src/osc_wasm_bg.wasm", { overwrite: true });
await copy("pkg/osc_wasm_bg.wasm.d.ts", "src/osc_wasm_bg.wasm.d.ts", { overwrite: true });
await copy("pkg/osc_wasm_bg.js", "src/osc_wasm_bg.js", { overwrite: true });