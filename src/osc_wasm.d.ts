/* tslint:disable */
/* eslint-disable */
export function encode(packet: WasmOscPacket, options?: WasmEncodeOptions | null): Uint8Array;
export function decode(data: Uint8Array, options?: WasmEncodeOptions | null): WasmOscPacket[];
export interface WasmOscArg {
    type: string;
    value: WasmOscValue;
}

export type WasmOscValue = { Int: number } | { Float: number } | { String: string } | { Blob: number[] };

export interface WasmOscMessage {
    address: string;
    args: WasmOscArg[];
}

export interface WasmOscBundle {
    timeTag: number;
    packets: WasmOscMessage[];
}

export type WasmOscPacket = ({ type: "message" } & WasmOscMessage) | ({ type: "bundle" } & WasmOscBundle);

export type WasmOscProtocol = "udp" | "tcp";

export interface WasmEncodeOptions {
    protocol: WasmOscProtocol | null;
}

