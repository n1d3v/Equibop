/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// We bypass Electron's method to remove its rounding of any icon.

import { type BrowserWindow, type NativeImage, nativeImage } from "electron";

const OVERLAY_SIZE = 16;
const COINIT_APARTMENTTHREADED = 2;
const CLSCTX_INPROC_SERVER = 1;
const RPC_E_CHANGED_MODE = 0x80010106 | 0;
const ICON_RESOURCE_VERSION = 0x00030000;

const RELEASE_SLOT = 2;
const HR_INIT_SLOT = 3;
const SET_OVERLAY_ICON_SLOT = 18;

let api: ReturnType<typeof loadOverlayApi> | undefined;

function checkResult(operation: string, result: number) {
    if (result < 0) {
        throw new Error(`${operation} failed (HRESULT 0x${(result >>> 0).toString(16)})`);
    }
}

function loadOverlayApi() {
    const koffi = require("koffi") as typeof import("koffi");
    const ole32 = koffi.load("ole32.dll");
    const user32 = koffi.load("user32.dll");

    const initializeCom = ole32.func("int32_t __stdcall CoInitializeEx(void *reserved, uint32_t options)");
    const uninitializeCom = ole32.func("void __stdcall CoUninitialize()");
    const createInstance = ole32.func(
        "int32_t __stdcall CoCreateInstance(const void *clsid, void *outer, uint32_t context, const void *iid, _Out_ void **instance)"
    );
    const parseGuid = ole32.func("int32_t __stdcall CLSIDFromString(str16 text, void *guid)");
    const registerWindowMessage = user32.func("uint32_t __stdcall RegisterWindowMessageW(str16 name)");
    const createIcon = user32.func(
        "void * __stdcall CreateIconFromResourceEx(const void *data, uint32_t size, int32_t icon, uint32_t version, int32_t width, int32_t height, uint32_t flags)"
    );
    const destroyIcon = user32.func("int32_t __stdcall DestroyIcon(void *icon)");

    const taskbarClass = Buffer.alloc(16);
    const taskbarInterface = Buffer.alloc(16);
    checkResult("CLSIDFromString", parseGuid("{56FDF344-FD6D-11D0-958A-006097C9A090}", taskbarClass));
    checkResult("CLSIDFromString", parseGuid("{EA1AFB91-9E28-4B86-90E9-9E9F8A5EEFAF}", taskbarInterface));

    const release = koffi.proto("uint32_t __stdcall Release(void *instance)");
    const hrInit = koffi.proto("int32_t __stdcall HrInit(void *instance)");
    const setOverlayIcon = koffi.proto(
        "int32_t __stdcall SetOverlayIcon(void *instance, void *hwnd, void *icon, str16 description)"
    );

    return {
        taskbarButtonCreated: registerWindowMessage("TaskbarButtonCreated"),
        setOverlay(hwnd: bigint, png: Buffer | null, description: string) {
            const apartment = initializeCom(null, COINIT_APARTMENTTHREADED);
            if (apartment !== RPC_E_CHANGED_MODE) checkResult("CoInitializeEx", apartment);

            try {
                const instance: [bigint | null] = [null];
                checkResult(
                    "CoCreateInstance",
                    createInstance(taskbarClass, null, CLSCTX_INPROC_SERVER, taskbarInterface, instance)
                );
                const taskbar = instance[0];
                const vtable = koffi.decode(taskbar, "void *");
                const method = (slot: number) => koffi.decode(vtable, slot * koffi.sizeof("void *"), "void *");

                try {
                    checkResult("ITaskbarList3::HrInit", koffi.call(method(HR_INIT_SLOT), hrInit, taskbar));
                    const icon = png
                        ? createIcon(png, png.length, 1, ICON_RESOURCE_VERSION, OVERLAY_SIZE, OVERLAY_SIZE, 0)
                        : null;
                    if (png && !icon) throw new Error("CreateIconFromResourceEx failed");

                    try {
                        checkResult(
                            "ITaskbarList3::SetOverlayIcon",
                            koffi.call(method(SET_OVERLAY_ICON_SLOT), setOverlayIcon, taskbar, hwnd, icon, description)
                        );
                    } finally {
                        if (icon) destroyIcon(icon);
                    }
                } finally {
                    koffi.call(method(RELEASE_SLOT), release, taskbar);
                }
            } finally {
                if (apartment >= 0) uninitializeCom();
            }
        }
    };
}

function makeOverlayPng(image: NativeImage) {
    const { width, height } = image.getSize();
    const scale = OVERLAY_SIZE / Math.max(width, height);
    const resized = image.resize({
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        quality: "best"
    });
    const size = resized.getSize();
    if (size.width === OVERLAY_SIZE && size.height === OVERLAY_SIZE) return resized.toPNG();

    const pixels = resized.toBitmap();
    const canvasStride = OVERLAY_SIZE * 4;
    const imageStride = size.width * 4;
    const canvas = Buffer.alloc(canvasStride * OVERLAY_SIZE);
    const x = Math.floor((OVERLAY_SIZE - size.width) / 2) * 4;
    const y = Math.floor((OVERLAY_SIZE - size.height) / 2);
    for (let row = 0; row < size.height; row++) {
        pixels.copy(canvas, (y + row) * canvasStride + x, row * imageStride, (row + 1) * imageStride);
    }

    return nativeImage.createFromBitmap(canvas, { width: OVERLAY_SIZE, height: OVERLAY_SIZE }).toPNG();
}

export function setTaskbarOverlay(win: BrowserWindow, image: NativeImage | null, description: string) {
    const handle = win.getNativeWindowHandle();
    const hwnd = handle.length === 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE());
    const png = image && !image.isEmpty() ? makeOverlayPng(image) : null;
    (api ??= loadOverlayApi()).setOverlay(hwnd, png, description);
}

export function watchTaskbarButton(win: BrowserWindow, callback: () => void) {
    try {
        const { taskbarButtonCreated } = (api ??= loadOverlayApi());
        if (taskbarButtonCreated) win.hookWindowMessage(taskbarButtonCreated, callback);
    } catch (error) {
        console.warn("Could not watch for Windows taskbar button creation:", error);
    }
}
