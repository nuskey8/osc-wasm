import init, {
  decode as nativeDecode,
  encode as nativeEncode,
} from "../pkg/osc_wasm.js";
import {
  WasmOscArg,
  WasmOscBundle,
  WasmOscMessage,
  WasmOscValue,
} from "../pkg/osc_wasm.d.ts";

await init();

interface WebSocketPortOptions {
  url: string;
  socket?: WebSocket;
}

interface OscPort {
  open(): void;
  on(event: "ready", callback: () => void): void;
  on(event: "message", callback: (msg: OscMessage) => void): void;
  on(event: "bundle", callback: (msg: OscBundle) => void): void;
  send(msg: OscMessage | OscBundle): void;
}

type OscType = "i" | "f" | "s" | "b";
type OscValue = number | string;

interface OscMessage {
  address: string;
  args: OscArg[];
}

interface OscArg {
  type: OscType;
  value: OscValue;
}

interface OscBundle {
  timeTag: number;
  packets: OscMessage[];
}

function decode(data: Uint8Array): OscMessage | OscBundle {
  const result = nativeDecode(data);
  switch (result.type) {
    case "message": {
      const message = result as WasmOscMessage;
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
      const bundle = result as WasmOscBundle;
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
}

function wasmValueToOscValue(v: WasmOscValue): OscValue {
  // WasmOscValue = { I: number } | { F: number } | { S: string }
  if (v && typeof v === "object") {
    if ("I" in v) return v.I as number;
    if ("F" in v) return v.F as number;
    if ("S" in v) return v.S as string;
  }
  return "";
}

function oscValueToWasmValue(v: OscValue, type: OscType): WasmOscValue {
  if (type === "i") return { I: Number(v) };
  if (type === "f") return { F: Number(v) };
  return { S: String(v) };
}

function encode(data: OscMessage | OscBundle): Uint8Array {
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
    });
  } else {
    const message = data as OscMessage;
    return nativeEncode({
      type: "message",
      address: message.address,
      args: message.args.map((y) => ({
        type: y.type as OscType,
        value: oscValueToWasmValue(y.value, y.type),
      } satisfies WasmOscArg)),
    });
  }
}

function WebSocketPort(options: WebSocketPortOptions): OscPort {
  const listeners: {
    [event: string]: ((msg: OscMessage | OscBundle | undefined) => void)[];
  } = {};

  const ws = options.socket ?? new WebSocket(options.url);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    emit("ready");
  };

  ws.onmessage = (event) => {
    const handleData = async (data: ArrayBuffer | Blob | string) => {
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
        const data = decode(bytes);
        if ((data as OscBundle).packets) {
          const bundle = data as OscBundle;
          emit("bundle", bundle);
        } else {
          const message = data as OscMessage;
          emit("message", message);
        }
      }
    };

    // Fire and forget the async handler (onmessage can be async)
    void handleData(event.data);
  };

  function emit(event: string, msg?: OscMessage | OscBundle) {
    if (listeners[event]) {
      listeners[event].forEach((callback) => callback(msg));
    }
  }

  type onMethod = {
    (event: "ready", callback: () => void): void;
    (event: "message", callback: (msg: OscMessage) => void): void;
    (event: "bundle", callback: (msg: OscBundle) => void): void;
  };

  const on: onMethod = (
    event: "ready" | "message" | "bundle",
    callback:
      | (() => void)
      | ((msg: OscMessage) => void)
      | ((msg: OscBundle) => void),
  ) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(
      callback as (msg: OscMessage | OscBundle | undefined) => void,
    );
  };

  return {
    open() {},
    on,
    send(msg: OscMessage | OscBundle) {
      const encoded = encode(msg);
      ws.send(encoded);
    },
  };
}

export const osc = {
  WebSocketPort,
  encode,
  decode,
};
