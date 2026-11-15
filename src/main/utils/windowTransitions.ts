import type { BrowserWindow } from "electron";
import { once } from "shared/utils/once";

const DWMWA_TRANSITIONS_FORCEDISABLED = 3;
const DISABLE_TRANSITIONS = Buffer.from([1, 0, 0, 0]);

let setWindowAttribute: ((hwnd: bigint, attribute: number, value: Buffer, size: number) => number) | undefined;

const loadWindowTransitions = once(() => {
    try {
        const koffi = require("koffi") as typeof import("koffi");
        setWindowAttribute = koffi
            .load("dwmapi.dll")
            .func(
                "int32_t __stdcall DwmSetWindowAttribute(void *hwnd, uint32_t attribute, const void *value, uint32_t size)"
            );
    } catch (err) {
        console.warn("Could not load Windows window transition controls:", err);
    }
});

export function disableWindowTransitions(win: BrowserWindow) {
    loadWindowTransitions();
    if (!setWindowAttribute) return;

    try {
        const handle = win.getNativeWindowHandle();
        const hwnd = handle.length === 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE());
        const result = setWindowAttribute(
            hwnd,
            DWMWA_TRANSITIONS_FORCEDISABLED,
            DISABLE_TRANSITIONS,
            DISABLE_TRANSITIONS.length
        );
        if (result < 0) console.warn("Could not disable Windows notification transitions:", result);
    } catch (err) {
        console.warn("Could not disable Windows notification transitions:", err);
    }
}
