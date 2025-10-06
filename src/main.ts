import init, {
  decode_osc_message,
  encode_osc_message,
  WasmOscArg,
  WasmOscMessage,
} from "../pkg/osc_wasm.js";

await init();

interface WebSocketPortOptions {
  url: string;
  metadata?: boolean;
}

interface OscPort {
  open(): void;
  on(event: string, callback: (msg?: OscMessage) => void): void;
  send(msg: OscMessage): void;
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

function decode(data: Uint8Array): OscMessage {
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

function encode(msg: OscMessage): Uint8Array {
  const data = new WasmOscMessage(
    msg.address,
    msg.args.map((x) => {
      return new WasmOscArg(x.type, x.value);
    }),
  );
  return encode_osc_message(data);
}

function WebSocketPort(options: WebSocketPortOptions): OscPort {
  const listeners: { [event: string]: ((msg?: OscMessage) => void)[] } = {};

  const ws = new WebSocket(options.url);
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
        const msg = decode(bytes);
        if (msg) emit("message", msg);
      }
    };

    // Fire and forget the async handler (onmessage can be async)
    void handleData(event.data);
  };

  function emit(event: string, msg?: OscMessage) {
    if (listeners[event]) {
      listeners[event].forEach((callback) => callback(msg));
    }
  }

  return {
    open() {
      // WebSocketは自動で開く
    },
    on(event: string, callback: (msg?: OscMessage) => void) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    },
    send(msg: OscMessage) {
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
