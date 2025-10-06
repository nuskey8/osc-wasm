use rosc::{OscMessage as RoscMessage, OscPacket, OscType};
use serde::{Deserialize, Serialize};
use tsify_next::Tsify;
use wasm_bindgen::prelude::*;

#[derive(Tsify, Serialize, Deserialize, Clone)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct WasmOscArg {
    #[serde(rename = "type")]
    pub type_: String,
    pub value: WasmOscValue,
}

#[derive(Tsify, Serialize, Deserialize, Clone)]
pub enum WasmOscValue {
    Int(i32),
    Float(f32),
    String(String),
    Blob(Vec<u8>),
}

#[derive(Tsify, Serialize, Deserialize, Clone)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct WasmOscMessage {
    pub address: String,
    pub args: Vec<WasmOscArg>,
}

#[derive(Tsify, Serialize, Deserialize, Clone)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct WasmOscBundle {
    #[serde(rename = "timeTag")]
    pub time_tag: f64,
    pub packets: Vec<WasmOscMessage>,
}

#[derive(Tsify, Serialize, Deserialize, Clone)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[serde(tag = "type")]
pub enum WasmOscPacket {
    #[serde(rename = "message")]
    Message(WasmOscMessage),
    #[serde(rename = "bundle")]
    Bundle(WasmOscBundle),
}

#[derive(Tsify, Serialize, Deserialize, Clone)]
#[tsify(into_wasm_abi, from_wasm_abi)]
#[serde(rename_all = "lowercase")]
pub enum WasmOscProtocol {
    UDP,
    TCP,
}

#[derive(Tsify, Serialize, Deserialize, Clone, Default)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct WasmEncodeOptions {
    pub protocol: Option<WasmOscProtocol>,
}

#[wasm_bindgen]
pub fn encode(
    packet: WasmOscPacket,
    options: Option<WasmEncodeOptions>,
) -> Result<Vec<u8>, JsValue> {
    match packet {
        WasmOscPacket::Message(msg) => encode_message(msg, options),
        WasmOscPacket::Bundle(bundle) => encode_bundle(bundle, options),
    }
}

#[wasm_bindgen]
pub fn decode(
    data: &[u8],
    options: Option<WasmEncodeOptions>,
) -> Result<Vec<WasmOscPacket>, JsValue> {
    let options = options.unwrap_or(WasmEncodeOptions::default());
    let (_remainder, packets) = match options.protocol.unwrap_or(WasmOscProtocol::UDP) {
        WasmOscProtocol::UDP => {
            let (_remainder, packet) =
                rosc::decoder::decode_udp(data).map_err(|e| JsValue::from_str(&e.to_string()))?;
            (_remainder, vec![packet])
        }
        WasmOscProtocol::TCP => {
            rosc::decoder::decode_tcp_vec(data).map_err(|e| JsValue::from_str(&e.to_string()))?
        }
    };

    packets
        .into_iter()
        .map(|packet| match packet {
            OscPacket::Message(msg) => {
                let args: Vec<WasmOscArg> = msg
                    .args
                    .into_iter()
                    .map(|arg| match arg {
                        OscType::String(s) => WasmOscArg {
                            type_: "s".to_string(),
                            value: WasmOscValue::String(s),
                        },
                        OscType::Blob(b) => WasmOscArg {
                            type_: "b".to_string(),
                            value: WasmOscValue::Blob(b),
                        },
                        OscType::Float(f) => WasmOscArg {
                            type_: "f".to_string(),
                            value: WasmOscValue::Float(f),
                        },
                        OscType::Int(i) => WasmOscArg {
                            type_: "i".to_string(),
                            value: WasmOscValue::Int(i),
                        },
                        _ => WasmOscArg {
                            type_: "unknown".to_string(),
                            value: WasmOscValue::String(String::new()),
                        },
                    })
                    .collect();

                Ok(WasmOscPacket::Message(WasmOscMessage {
                    address: msg.addr,
                    args,
                }))
            }
            OscPacket::Bundle(b) => {
                let secs = b.timetag.seconds as f64;
                let frac = (b.timetag.fractional as f64) / (u32::MAX as f64);
                let time_tag = secs + frac;

                let mut packets: Vec<WasmOscMessage> = Vec::new();
                for content in b.content {
                    match content {
                        OscPacket::Message(msg) => {
                            let args: Vec<WasmOscArg> = msg
                                .args
                                .into_iter()
                                .map(|arg| match arg {
                                    OscType::String(s) => WasmOscArg {
                                        type_: "s".to_string(),
                                        value: WasmOscValue::String(s),
                                    },
                                    OscType::Blob(b) => WasmOscArg {
                                        type_: "b".to_string(),
                                        value: WasmOscValue::Blob(b),
                                    },
                                    OscType::Float(f) => WasmOscArg {
                                        type_: "f".to_string(),
                                        value: WasmOscValue::Float(f),
                                    },
                                    OscType::Int(i) => WasmOscArg {
                                        type_: "i".to_string(),
                                        value: WasmOscValue::Int(i),
                                    },
                                    _ => WasmOscArg {
                                        type_: "unknown".to_string(),
                                        value: WasmOscValue::String(String::new()),
                                    },
                                })
                                .collect();
                            packets.push(WasmOscMessage {
                                address: msg.addr,
                                args,
                            });
                        }
                        _ => {
                            // ignore nested bundles for now
                        }
                    }
                }

                Ok(WasmOscPacket::Bundle(WasmOscBundle { time_tag, packets }))
            }
        })
        .collect()
}

fn encode_message(
    msg: WasmOscMessage,
    options: Option<WasmEncodeOptions>,
) -> Result<Vec<u8>, JsValue> {
    let osc_args: Vec<OscType> = msg
        .args
        .into_iter()
        .filter_map(|arg| match arg.value {
            WasmOscValue::String(s) => Some(OscType::String(s)),
            WasmOscValue::Float(f) => Some(OscType::Float(f)),
            WasmOscValue::Int(i) => Some(OscType::Int(i)),
            WasmOscValue::Blob(blob) => Some(OscType::Blob(blob)),
        })
        .collect();
    let osc_msg = RoscMessage {
        addr: msg.address.clone(),
        args: osc_args,
    };
    let packet = OscPacket::Message(osc_msg);

    let options = options.unwrap_or(WasmEncodeOptions::default());
    match options.protocol.unwrap_or(WasmOscProtocol::UDP) {
        WasmOscProtocol::UDP => rosc::encoder::encode(&packet),
        WasmOscProtocol::TCP => rosc::encoder::encode_tcp(&packet),
    }
    .map_err(|e| JsValue::from_str(&e.to_string()))
}

fn encode_bundle(
    bundle: WasmOscBundle,
    options: Option<WasmEncodeOptions>,
) -> Result<Vec<u8>, JsValue> {
    let seconds = bundle.time_tag.trunc() as u32;
    let fractional = ((bundle.time_tag.fract()) * (u32::MAX as f64)) as u32;
    let timetag = rosc::OscTime {
        seconds,
        fractional,
    };

    let mut contents: Vec<OscPacket> = Vec::new();
    for msg in bundle.packets {
        let osc_args: Vec<OscType> = msg
            .args
            .into_iter()
            .filter_map(|arg| match arg.value {
                WasmOscValue::String(s) => Some(OscType::String(s)),
                WasmOscValue::Blob(b) => Some(OscType::Blob(b)),
                WasmOscValue::Float(f) => Some(OscType::Float(f)),
                WasmOscValue::Int(i) => Some(OscType::Int(i)),
            })
            .collect();
        let osc_msg = RoscMessage {
            addr: msg.address.clone(),
            args: osc_args,
        };
        contents.push(OscPacket::Message(osc_msg));
    }

    let bundle_packet = rosc::OscPacket::Bundle(rosc::OscBundle {
        timetag,
        content: contents,
    });

    let options = options.unwrap_or(WasmEncodeOptions::default());
    match options.protocol.unwrap_or(WasmOscProtocol::UDP) {
        WasmOscProtocol::UDP => rosc::encoder::encode(&bundle_packet),
        WasmOscProtocol::TCP => rosc::encoder::encode_tcp(&bundle_packet),
    }
    .map_err(|e| JsValue::from_str(&e.to_string()))
}
