# osc-wasm
Open Sound Control (OSC) library implemented in WebAssembly/Rust for browsers and servers

English | [日本語](README_JA.md)

## Overview

osc-wasm is a library for handling Open Sound Control (OSC) built on WebAssembly (WASM). It depends only on basic Web APIs, so it works on major runtimes such as browsers, Node.js, and Deno.

The API of osc-wasm is inspired by [osc.js](https://github.com/colinbdclark/osc.js), but its core is implemented in Rust and compiled to WASM. This allows for improved performance when encoding/decoding large binaries and enables more robust code.

> [!WARNING]
> osc-wasm is currently in alpha and may undergo breaking changes.

## Installation

### npm

```
$ npm i osc-wasm
```

### Deno

```
$ deno add jsr:@nuskey8/osc-wasm
```

## Usage

> [!WARNING]
> The current version only supports WebSocket.

```ts
const port = osc.WebSocketPort({
	url: "ws://example.com:3000",
	protocol: "tcp", // UDP or TCP
});

port.open();

port.on("ready", () => {
	console.log("[client] ready, sending OSC message");
	port.send({ address: "/test", args: [{ type: "f", value: 440 }] });
});

port.on("message", (msg) => {
	console.log("[client] received message:", msg);
});

port.on("bundle", (bundle) => {
	console.log("[client] received bundle:", bundle);
});

port.send({
	timeTag: 60,
	packets: [
		{
			address: "/carrier/frequency",
			args: [{
				type: "f",
				value: 440,
			}],
		},
		{
			address: "/carrier/amplitude",
			args: [
				{
					type: "f",
					value: 0.5,
				},
			],
		},
	],
});
```

## License

This library is released under the [MIT License](LICENSE).

