/* tslint:disable */
/* eslint-disable */
export function encode_osc_message(msg: WasmOscMessage): Uint8Array;
export function decode_osc_message(data: Uint8Array): WasmOscMessage;
export class WasmOscArg {
  free(): void;
  [Symbol.dispose](): void;
  constructor(type_: string, value: any);
  type: string;
  value: any;
}
export class WasmOscMessage {
  free(): void;
  [Symbol.dispose](): void;
  constructor(addr: string, args: WasmOscArg[]);
  address: string;
  args: WasmOscArg[];
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_wasmoscarg_free: (a: number, b: number) => void;
  readonly __wbg_get_wasmoscarg_type: (a: number) => [number, number];
  readonly __wbg_set_wasmoscarg_type: (a: number, b: number, c: number) => void;
  readonly __wbg_get_wasmoscarg_value: (a: number) => any;
  readonly __wbg_set_wasmoscarg_value: (a: number, b: any) => void;
  readonly wasmoscarg_new: (a: number, b: number, c: any) => number;
  readonly __wbg_wasmoscmessage_free: (a: number, b: number) => void;
  readonly __wbg_get_wasmoscmessage_address: (a: number) => [number, number];
  readonly __wbg_get_wasmoscmessage_args: (a: number) => [number, number];
  readonly __wbg_set_wasmoscmessage_args: (a: number, b: number, c: number) => void;
  readonly wasmoscmessage_new: (a: number, b: number, c: number, d: number) => number;
  readonly encode_osc_message: (a: number) => [number, number, number, number];
  readonly decode_osc_message: (a: number, b: number) => [number, number, number];
  readonly __wbg_set_wasmoscmessage_address: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_drop_slice: (a: number, b: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
