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
    I(i32),
    F(f32),
    S(String),
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

#[wasm_bindgen]
pub fn encode(packet: WasmOscPacket) -> Result<Vec<u8>, JsValue> {
    match packet {
        WasmOscPacket::Message(msg) => encode_message(&msg),
        WasmOscPacket::Bundle(bundle) => encode_bundle(&bundle),
    }
}

#[wasm_bindgen]
pub fn decode(data: &[u8]) -> Result<WasmOscPacket, JsValue> {
    let (_remainder, packet) =
        rosc::decoder::decode_udp(data).map_err(|e| JsValue::from_str(&e.to_string()))?;

    match packet {
        OscPacket::Message(msg) => {
            let args: Vec<WasmOscArg> = msg
                .args
                .into_iter()
                .map(|arg| match arg {
                    OscType::String(s) => WasmOscArg {
                        type_: "s".to_string(),
                        value: WasmOscValue::S(s),
                    },
                    OscType::Float(f) => WasmOscArg {
                        type_: "f".to_string(),
                        value: WasmOscValue::F(f),
                    },
                    OscType::Int(i) => WasmOscArg {
                        type_: "i".to_string(),
                        value: WasmOscValue::I(i),
                    },
                    _ => WasmOscArg {
                        type_: "unknown".to_string(),
                        value: WasmOscValue::S(String::new()),
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
                                    value: WasmOscValue::S(s),
                                },
                                OscType::Float(f) => WasmOscArg {
                                    type_: "f".to_string(),
                                    value: WasmOscValue::F(f),
                                },
                                OscType::Int(i) => WasmOscArg {
                                    type_: "i".to_string(),
                                    value: WasmOscValue::I(i),
                                },
                                _ => WasmOscArg {
                                    type_: "unknown".to_string(),
                                    value: WasmOscValue::S(String::new()),
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
    }
}

fn encode_message(msg: &WasmOscMessage) -> Result<Vec<u8>, JsValue> {
    let osc_args: Vec<OscType> = msg
        .args
        .iter()
        .filter_map(|arg| match &arg.value {
            WasmOscValue::S(s) => Some(OscType::String(s.clone())),
            WasmOscValue::F(f) => Some(OscType::Float(*f as f32)),
            WasmOscValue::I(i) => Some(OscType::Int(*i as i32)),
        })
        .collect();
    let osc_msg = RoscMessage {
        addr: msg.address.clone(),
        args: osc_args,
    };
    let packet = OscPacket::Message(osc_msg);
    rosc::encoder::encode(&packet).map_err(|e| JsValue::from_str(&e.to_string()))
}

fn encode_bundle(bundle: &WasmOscBundle) -> Result<Vec<u8>, JsValue> {
    let seconds = bundle.time_tag.trunc() as u32;
    let fractional = ((bundle.time_tag.fract()) * (u32::MAX as f64)) as u32;
    let timetag = rosc::OscTime {
        seconds,
        fractional,
    };

    let mut contents: Vec<OscPacket> = Vec::new();
    for msg in &bundle.packets {
        let osc_args: Vec<OscType> = msg
            .args
            .iter()
            .filter_map(|arg| match &arg.value {
                WasmOscValue::S(s) => Some(OscType::String(s.clone())),
                WasmOscValue::F(f) => Some(OscType::Float(*f as f32)),
                WasmOscValue::I(i) => Some(OscType::Int(*i as i32)),
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
    rosc::encoder::encode(&bundle_packet).map_err(|e| JsValue::from_str(&e.to_string()))
}
