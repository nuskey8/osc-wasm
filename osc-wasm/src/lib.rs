use rosc::{OscMessage as RoscMessage, OscPacket, OscType};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone)]
pub struct WasmOscArg {
    #[wasm_bindgen(getter_with_clone, js_name = type)]
    pub type_: String,
    #[wasm_bindgen(getter_with_clone)]
    pub value: JsValue,
}

#[wasm_bindgen]
impl WasmOscArg {
    #[wasm_bindgen(constructor)]
    pub fn new(type_: String, value: JsValue) -> WasmOscArg {
        WasmOscArg { type_, value }
    }
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct WasmOscMessage {
    #[wasm_bindgen(getter_with_clone, js_name = address)]
    pub addr: String,
    #[wasm_bindgen(getter_with_clone)]
    pub args: Vec<WasmOscArg>,
}

#[wasm_bindgen]
impl WasmOscMessage {
    #[wasm_bindgen(constructor)]
    pub fn new(addr: String, args: Vec<WasmOscArg>) -> WasmOscMessage {
        WasmOscMessage { addr, args }
    }
}

#[wasm_bindgen]
pub fn encode_osc_message(msg: &WasmOscMessage) -> Result<Vec<u8>, JsValue> {
    let osc_args: Vec<OscType> = msg
        .args
        .iter()
        .filter_map(|arg| match arg.type_.as_str() {
            "s" => Some(OscType::String(arg.value.as_string().unwrap_or_default())),
            "f" => Some(OscType::Float(arg.value.as_f64().unwrap_or(0.0) as f32)),
            "i" => Some(OscType::Int(arg.value.as_f64().unwrap_or(0.0) as i32)),
            _ => None,
        })
        .collect();
    let osc_msg = RoscMessage {
        addr: msg.addr.clone(),
        args: osc_args,
    };
    let packet = OscPacket::Message(osc_msg);
    rosc::encoder::encode(&packet).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn decode_osc_message(data: &[u8]) -> Result<WasmOscMessage, JsValue> {
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
                        value: JsValue::from_str(&s),
                    },
                    OscType::Float(f) => WasmOscArg {
                        type_: "f".to_string(),
                        value: JsValue::from_f64(f as f64),
                    },
                    OscType::Int(i) => WasmOscArg {
                        type_: "i".to_string(),
                        value: JsValue::from_f64(i as f64),
                    },
                    _ => WasmOscArg {
                        type_: "unknown".to_string(),
                        value: JsValue::NULL,
                    },
                })
                .collect();
            Ok(WasmOscMessage {
                addr: msg.addr,
                args,
            })
        }
        OscPacket::Bundle(_) => Err(JsValue::from_str("Bundle not supported")),
    }
}

// --- Bundle support ---

#[wasm_bindgen]
#[derive(Clone)]
pub struct WasmOscBundle {
    #[wasm_bindgen(getter_with_clone, js_name = timeTag)]
    pub time_tag: f64,
    #[wasm_bindgen(getter_with_clone, js_name = packets)]
    pub packets: Vec<WasmOscMessage>,
}

#[wasm_bindgen]
impl WasmOscBundle {
    #[wasm_bindgen(constructor)]
    pub fn new(time_tag: f64, packets: Vec<WasmOscMessage>) -> WasmOscBundle {
        WasmOscBundle { time_tag, packets }
    }
}

#[wasm_bindgen]
pub fn encode_osc_bundle(bundle: &WasmOscBundle) -> Result<Vec<u8>, JsValue> {
    // Convert time_tag (seconds from now or absolute seconds) represented as f64
    // rosc uses OscTime as (secs, frac) in u32; here we'll convert seconds.fraction -> (u32, u32)
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
            .filter_map(|arg| match arg.type_.as_str() {
                "s" => Some(OscType::String(arg.value.as_string().unwrap_or_default())),
                "f" => Some(OscType::Float(arg.value.as_f64().unwrap_or(0.0) as f32)),
                "i" => Some(OscType::Int(arg.value.as_f64().unwrap_or(0.0) as i32)),
                _ => None,
            })
            .collect();
        let osc_msg = RoscMessage {
            addr: msg.addr.clone(),
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

#[wasm_bindgen]
pub fn decode_osc_bundle(data: &[u8]) -> Result<WasmOscBundle, JsValue> {
    let (_remainder, packet) =
        rosc::decoder::decode_udp(data).map_err(|e| JsValue::from_str(&e.to_string()))?;
    match packet {
        OscPacket::Bundle(b) => {
            // Convert timetag to f64 seconds
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
                                    value: JsValue::from_str(&s),
                                },
                                OscType::Float(f) => WasmOscArg {
                                    type_: "f".to_string(),
                                    value: JsValue::from_f64(f as f64),
                                },
                                OscType::Int(i) => WasmOscArg {
                                    type_: "i".to_string(),
                                    value: JsValue::from_f64(i as f64),
                                },
                                _ => WasmOscArg {
                                    type_: "unknown".to_string(),
                                    value: JsValue::NULL,
                                },
                            })
                            .collect();
                        packets.push(WasmOscMessage {
                            addr: msg.addr,
                            args,
                        });
                    }
                    _ => {
                        // ignore nested bundles or unsupported packet types for now
                    }
                }
            }

            Ok(WasmOscBundle { time_tag, packets })
        }
        _ => Err(JsValue::from_str("Not a bundle")),
    }
}
