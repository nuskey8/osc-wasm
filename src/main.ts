import init, {
  decode_osc_bundle,
  decode_osc_message,
  encode_osc_bundle,
  encode_osc_message,
  WasmOscArg,
  WasmOscMessage,
} from "../pkg/osc_wasm.js";
import { WasmOscBundle } from "./osc_wasm.js";

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
  timeTag: number; // seconds (floating)
  packets: OscMessage[];
}

function decodeMessage(data: Uint8Array): OscMessage {
  const result = decode_osc_message(data);
  return {
    address: result.address,
    args: result.args.map((x) => {
      return {
        type: x.type as OscType,
        value: x.value as OscValue,
      } satisfies OscArg;
    }),
  };
}

function decodeBundle(data: Uint8Array): OscBundle {
  const result = decode_osc_bundle(data);
  return {
    timeTag: result.timeTag,
    packets: result.packets.map((p) => {
      return {
        address: p.address,
        args: p.args.map((x) => {
          return {
            type: x.type as OscType,
            value: x.value as OscValue,
          } satisfies OscArg;
        }),
      } satisfies OscMessage;
    }),
  };
}

function encodeMessage(msg: OscMessage): Uint8Array {
  const data = new WasmOscMessage(
    msg.address,
    msg.args.map((x) => {
      return new WasmOscArg(x.type, x.value);
    }),
  );
  return encode_osc_message(data);
}

function encodeBundle(bundle: OscBundle): Uint8Array {
  const data = new WasmOscBundle(
    bundle.timeTag,
    bundle.packets.map((p) => {
      return new WasmOscMessage(
        p.address,
        p.args.map((x) => new WasmOscArg(x.type, x.value)),
      );
    }),
  );

  return encode_osc_bundle(data);
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
        const td = new TextDecoder();
        const probeLen = Math.min(7, bytes.length);
        const header = td.decode(bytes.subarray(0, probeLen));
        if (header === "#bundle" || header.startsWith("#bundle")) {
          const b = decodeBundle(bytes);
          if (b) emit("bundle", b);
        } else {
          const msg = decodeMessage(bytes);
          if (msg) emit("message", msg);
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

  const on: onMethod = (event: string, callback: any) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
  };

  return {
    open() {},
    on,
    send(msg: OscMessage | OscBundle) {
      if ((msg as OscBundle).timeTag) {
        const encoded = encodeBundle(msg as OscBundle);
        ws.send(encoded);
      } else {
        const encoded = encodeMessage(msg as OscMessage);
        ws.send(encoded);
      }
    },
  };
}

export const osc = {
  WebSocketPort,
  encodeMessage,
  decodeMessage,
  encodeBundle,
  decodeBundle,
};
