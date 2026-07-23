/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, dialog, nativeImage, net } from "electron";
import { copyFile, mkdir, rm, writeFile } from "fs/promises";
import { extname, join } from "path";
import { IpcEvents } from "shared/IpcEvents";
import { STATIC_DIR } from "shared/paths";
import { pathToFileURL } from "url";

import { DATA_DIR } from "./constants";
import { AppEvents } from "./events";
import { mainWin } from "./mainWindow";
import { Settings } from "./settings";
import { fileExistsAsync } from "./utils/fileExists";
import { handle } from "./utils/ipcWrappers";
import { quantizeTo16BitColor } from "./utils/trayColor";

const CUSTOMIZABLE_ASSETS = [
    "splash",
    "tray",
    "trayUnread",
    "traySpeaking",
    "trayIdle",
    "trayMuted",
    "trayDeafened"
] as const;
export type UserAssetType = (typeof CUSTOMIZABLE_ASSETS)[number];

const TRAY_ASSET_TYPES: UserAssetType[] = [
    "tray",
    "trayUnread",
    "traySpeaking",
    "trayIdle",
    "trayMuted",
    "trayDeafened"
];

const DEFAULT_ASSETS: Record<UserAssetType, string> = {
    splash: "tray.png",
    tray:
        process.platform === "darwin"
            ? "tray/trayTemplate.png"
            : process.platform === "win32"
              ? "icon.ico"
              : "tray/tray.png",
    trayUnread: "tray/trayUnread.png",
    traySpeaking: "tray/speaking.png",
    trayIdle: "tray/idle.png",
    trayMuted: "tray/muted.png",
    trayDeafened: "tray/deafened.png"
};

const UserAssetFolder = join(DATA_DIR, "userAssets");

export async function resolveAssetPath(asset: UserAssetType) {
    if (!CUSTOMIZABLE_ASSETS.includes(asset)) {
        throw new Error(`Invalid asset: ${asset}`);
    }

    const assetPath = join(UserAssetFolder, asset);
    if (await fileExistsAsync(assetPath)) {
        return assetPath;
    }

    return join(STATIC_DIR, DEFAULT_ASSETS[asset]);
}

async function writeAssetFile(sourcePath: string, destPath: string) {
    if (extname(sourcePath).toLowerCase() === ".ico") {
        const image = nativeImage.createFromPath(sourcePath);
        if (image.isEmpty()) {
            throw new Error(`Failed to decode ico file: ${sourcePath}`);
        }
        await writeFile(destPath, image.toPNG());
        return;
    }

    await copyFile(sourcePath, destPath);
}

export async function handleVesktopAssetsProtocol(path: string, req: Request) {
    const asset = path.slice(1);

    // @ts-expect-error dumb types
    if (!CUSTOMIZABLE_ASSETS.includes(asset)) {
        return new Response(null, { status: 404 });
    }

    if (TRAY_ASSET_TYPES.includes(asset as UserAssetType) && Settings.store.tray16BitColor) {
        try {
            const assetPath = await resolveAssetPath(asset as UserAssetType);
            const image = quantizeTo16BitColor(nativeImage.createFromPath(assetPath));
            return new Response(new Uint8Array(image.toPNG()), { headers: { "Content-Type": "image/png" } });
        } catch (e) {
            console.error(`Failed to render 16-bit preview for ${asset}:`, e);
        }
    }

    try {
        const res = await net.fetch(pathToFileURL(join(UserAssetFolder, asset)).href);
        if (res.ok) return res;
    } catch {}

    return net.fetch(pathToFileURL(join(STATIC_DIR, DEFAULT_ASSETS[asset])).href);
}

handle(IpcEvents.SELECT_WINDOW_ICON, async () => {
    const res = await dialog.showOpenDialog(mainWin, {
        properties: ["openFile"],
        title: "Select a window icon",
        defaultPath: app.getPath("pictures"),
        filters: [{ name: "Images", extensions: ["ico", "png", "jpg", "jpeg"] }]
    });

    if (res.canceled || !res.filePaths.length) return "cancelled";

    Settings.store.customWindowIcon = res.filePaths[0];
    return "ok";
});

handle(IpcEvents.CHOOSE_USER_ASSET, async (_event, asset: UserAssetType, value?: null) => {
    if (!CUSTOMIZABLE_ASSETS.includes(asset)) {
        throw `Invalid asset: ${asset}`;
    }

    const assetPath = join(UserAssetFolder, asset);

    if (value === null) {
        try {
            await rm(assetPath, { force: true });
            AppEvents.emit("userAssetChanged", asset);
            return "ok";
        } catch (e) {
            console.error(`Failed to remove user asset ${asset}:`, e);
            return "failed";
        }
    }

    const res = await dialog.showOpenDialog(mainWin, {
        properties: ["openFile"],
        title: `Select an image to use as ${asset}`,
        defaultPath: app.getPath("pictures"),
        filters: [
            {
                name: "Images",
                extensions: ["png", "jpg", "jpeg", "webp", "gif", "avif", "svg", "ico"]
            }
        ]
    });

    if (res.canceled || !res.filePaths.length) return "cancelled";

    try {
        await mkdir(UserAssetFolder, { recursive: true });
        await writeAssetFile(res.filePaths[0], assetPath);
        AppEvents.emit("userAssetChanged", asset);
        return "ok";
    } catch (e) {
        console.error(`Failed to copy user asset ${asset}:`, e);
        return "failed";
    }
});

handle(IpcEvents.CHOOSE_ALL_TRAY_ASSETS, async () => {
    const res = await dialog.showOpenDialog(mainWin, {
        properties: ["openFile"],
        title: "Select an image to use for all tray icon states",
        defaultPath: app.getPath("pictures"),
        filters: [
            {
                name: "Images",
                extensions: ["png", "jpg", "jpeg", "webp", "gif", "avif", "svg", "ico"]
            }
        ]
    });

    if (res.canceled || !res.filePaths.length) return "cancelled";

    try {
        await mkdir(UserAssetFolder, { recursive: true });
        await Promise.all(
            TRAY_ASSET_TYPES.map(asset => writeAssetFile(res.filePaths[0], join(UserAssetFolder, asset)))
        );
        TRAY_ASSET_TYPES.forEach(asset => AppEvents.emit("userAssetChanged", asset));
        return "ok";
    } catch (e) {
        console.error("Failed to copy tray asset to all variants:", e);
        return "failed";
    }
});
