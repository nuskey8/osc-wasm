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
