import {
  decode as nativeDecode,
  encode as nativeEncode,
} from "./osc_wasm.js";
import type {
  WasmOscArg,
  WasmOscBundle,
  WasmOscMessage,
  WasmOscValue,
} from "./osc_wasm.d.ts";

export type OscProtocol = "udp" | "tcp";

export interface WebSocketPortOptions {
  url: string;
  protocol?: OscProtocol;
  socket?: WebSocket;
}

export interface OscPort {
  open(): void;
  on(event: "ready", callback: () => void): void;
  on(event: "message", callback: (msg: OscMessage) => void): void;
  on(event: "bundle", callback: (msg: OscBundle) => void): void;
  on(event: "error", callback: (msg: unknown) => void): void;
  on(event: "close", callback: () => void): void;
  send(msg: OscMessage | OscBundle): void;
}

export type OscType = "i" | "f" | "s" | "b";
export type OscValue = number | string | Uint8Array;

export interface OscMessage {
  address: string;
  args: OscArg[];
}

export interface OscArg {
  type: OscType;
  value: OscValue;
}

export interface OscBundle {
  timeTag: number;
  packets: OscMessage[];
}

export interface OscEncodeOptions {
  protocol?: OscProtocol;
}

function decode(
  data: Uint8Array,
  options?: OscEncodeOptions,
): (OscMessage | OscBundle)[] {
  const packets = nativeDecode(data, options);
  return packets.map((packet) => {
    switch (packet.type) {
      case "message": {
        const message = packet as WasmOscMessage;
        return {
          address: message.address,
          args: message.args.map((x) => {
            return {
              type: x.type as OscType,
              value: wasmValueToOscValue(x.value),
            } satisfies OscArg;
          }),
        };
      }
      case "bundle": {
        const bundle = packet as WasmOscBundle;
        return {
          timeTag: bundle.timeTag,
          packets: bundle.packets.map((x) => {
            return {
              address: x.address,
              args: x.args.map((y) => {
                return {
                  type: y.type as OscType,
                  value: wasmValueToOscValue(y.value),
                } satisfies OscArg;
              }),
            } satisfies OscMessage;
          }),
        };
      }
      default:
        throw new Error("unsupported osc value");
    }
  });
}

function wasmValueToOscValue(v: WasmOscValue): OscValue {
  if (v && typeof v === "object") {
    if ("Int" in v) return v.Int as number;
    if ("Float" in v) return v.Float as number;
    if ("String" in v) return v.String as string;
    if ("Blob" in v) return new Uint8Array(v.Blob);
  }
  throw new Error("unsupported osc value");
}

function oscValueToWasmValue(v: OscValue, type: OscType): WasmOscValue {
  if (type === "i") return { Int: v as number };
  if (type === "f") return { Float: v as number };
  if (type === "s") return { String: v as string };
  if (type === "b") return { Blob: Array.from(v as Uint8Array) };
  throw new Error("unsupported osc value");
}

function encode(
  data: OscMessage | OscBundle,
  options?: OscEncodeOptions,
): Uint8Array {
  if ((data as OscBundle).packets) {
    const bundle = data as OscBundle;
    return nativeEncode({
      type: "bundle",
      timeTag: bundle.timeTag,
      packets: bundle.packets.map((x) => ({
        address: x.address,
        args: x.args.map((y) => ({
          type: y.type as OscType,
          value: oscValueToWasmValue(y.value, y.type),
        } satisfies WasmOscArg)),
      } satisfies WasmOscMessage)),
    }, options);
  } else {
    const message = data as OscMessage;
    return nativeEncode({
      type: "message",
      address: message.address,
      args: message.args.map((y) => ({
        type: y.type as OscType,
        value: oscValueToWasmValue(y.value, y.type),
      } satisfies WasmOscArg)),
    }, options);
  }
}

function WebSocketPort(options: WebSocketPortOptions): OscPort {
  const listeners: {
    [event: string]: ((msg: OscMessage | OscBundle | unknown) => void)[];
  } = {};

  const ws = options.socket ?? new WebSocket(options.url);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    emit("ready");
  };

  ws.onclose = () => {
    emit("close");
  };

  ws.onmessage = (event) => {
    const handleData = async (data: ArrayBuffer | Blob | string | any) => {
      let bytes: Uint8Array | null = null;
      if (typeof data === "string") {
        const enc = new TextEncoder();
        bytes = enc.encode(data);
      } else if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
      } else if (data instanceof Blob) {
        const ab = await data.arrayBuffer();
        bytes = new Uint8Array(ab);
      }

      if (bytes) {
        const packets = decode(bytes, { protocol: options.protocol });
        for (const packet of packets) {
          if ((packet as OscBundle).packets) {
            const bundle = packet as OscBundle;
            emit("bundle", bundle);
          } else {
            const message = packet as OscMessage;
            emit("message", message);
          }
        }
      }
    };

    // Fire and forget the async handler (onmessage can be async)
    void handleData(event.data);
  };

  function emit(event: string, msg?: OscMessage | OscBundle | unknown) {
    if (listeners[event]) {
      try {
        listeners[event].forEach((callback) => callback(msg));
      } catch (e) {
        if (event === "error") {
          throw e;
        } else {
          emit("error", e);
        }
      }
    }
  }

  type onMethod = {
    (event: "ready", callback: () => void): void;
    (event: "message", callback: (msg: OscMessage) => void): void;
    (event: "bundle", callback: (msg: OscBundle) => void): void;
    (event: "error", callback: (error: unknown) => void): void;
    (event: "close", callback: () => void): void;
  };

  const on: onMethod = (
    event: "ready" | "message" | "bundle" | "error" | "close",
    callback:
      | (() => void)
      | ((msg: OscMessage) => void)
      | ((msg: OscBundle) => void)
      | ((error: unknown) => void),
  ) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(
      callback as (msg: OscMessage | OscBundle | unknown | undefined) => void,
    );
  };

  return {
    open() {},
    on,
    send(msg: OscMessage | OscBundle) {
      const encoded = encode(msg, { protocol: options.protocol });
      ws.send(encoded);
    },
  };
}

export const osc = {
  WebSocketPort,
  encode,
  decode,
};
