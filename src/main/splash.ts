/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BrowserWindow, nativeTheme } from "electron";
import { readFile } from "fs/promises";
import { join } from "path";
import { SplashProps } from "shared/browserWinProperties";
import { STATIC_DIR } from "shared/paths";
import { pathToFileURL } from "url";

import { DATA_DIR } from "./constants";
import { Settings } from "./settings";
import { fileExistsAsync } from "./utils/fileExists";

export let splash: BrowserWindow | undefined;
import { loadView } from "./vesktopStatic";

const totalTasks = 9;
let doneTasks = 0;

let splashReady = false;
const pendingSplashMessages: Array<[string, unknown]> = [];

function sendToSplash(channel: string, payload: unknown) {
    if (!splash || splash.isDestroyed()) return;
    if (splashReady) {
        splash.webContents.send(channel, payload);
    } else {
        pendingSplashMessages.push([channel, payload]);
    }
}

interface CustomSplashSettings {
    width?: number;
    height?: number;
}

async function readCustomSplashSettings(htmlPath: string): Promise<CustomSplashSettings> {
    let content: string;
    try {
        content = await readFile(htmlPath, "utf-8");
    } catch {
        return {};
    }

    const tag = content.match(/<splashSettings\b[^>]*>/i)?.[0];
    if (!tag) return {};

    const parseDimension = (attr: "width" | "height") => {
        const value = tag.match(new RegExp(`${attr}\\s*=\\s*["']?(\\d+)["']?`, "i"))?.[1];
        const parsed = value ? parseInt(value, 10) : NaN;
        return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    };

    return { width: parseDimension("width"), height: parseDimension("height") };
}

export async function createSplashWindow(startMinimized = false) {
    const { customSplashHtml } = Settings.store;
    const hasCustomSplashHtml = !!customSplashHtml && (await fileExistsAsync(customSplashHtml));
    const customSplashSettings = hasCustomSplashHtml ? await readCustomSplashSettings(customSplashHtml!) : {};

    splash = new BrowserWindow({
        ...SplashProps,
        ...(customSplashSettings.width ? { width: customSplashSettings.width } : {}),
        ...(customSplashSettings.height ? { height: customSplashSettings.height } : {}),
        ...(process.platform === "win32"
            ? { icon: join(STATIC_DIR, "icon.ico") }
            : process.platform === "linux"
              ? { icon: join(STATIC_DIR, "icon.png") }
              : {}),
        show: !startMinimized,
        webPreferences: {
            preload: join(__dirname, "splashPreload.js")
        }
    });

    splash.webContents.setMaxListeners(15);

    const { splashBackground, splashColor, splashTheming, splashProgress, splashPixelated } = Settings.store;

    let usingCustomSplash = false;
    if (hasCustomSplashHtml) {
        try {
            await splash.loadURL(pathToFileURL(customSplashHtml!).href);
            usingCustomSplash = true;
        } catch (e) {
            console.error("Failed to load custom splash screen HTML, falling back to default:", e);
        }
    }

    if (!usingCustomSplash) {
        loadView(splash, "splash.html");

        const isDark = nativeTheme.shouldUseDarkColors;
        const systemBg = isDark ? "hsl(223 6.7% 20.6%)" : "white";
        const systemFg = isDark ? "white" : "black";
        const systemFgSemiTrans = isDark ? "rgb(255 255 255 / 0.2)" : "rgb(0 0 0 / 0.2)";

        if (splashTheming !== false) {
            const fg = splashColor || systemFg;
            const bg = splashBackground || systemBg;
            const fgSemiTrans = splashColor
                ? splashColor.replace("rgb(", "rgba(").replace(")", ", 0.2)")
                : systemFgSemiTrans;

            splash.webContents.insertCSS(
                `body { --bg: ${bg} !important; --fg: ${fg} !important; --fg-semi-trans: ${fgSemiTrans} !important; }`
            );
        } else {
            splash.webContents.insertCSS(
                `body { --bg: ${systemBg} !important; --fg: ${systemFg} !important; --fg-semi-trans: ${systemFgSemiTrans} !important; }`
            );
        }

        if (splashPixelated) {
            splash.webContents.insertCSS(`img { image-rendering: pixelated; }`);
        }

        const customSplashPath = join(DATA_DIR, "userAssets", "splash");
        const hasCustomSplash = await fileExistsAsync(customSplashPath);

        if (!hasCustomSplash) {
            splash.webContents.insertCSS(`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(-360deg); }
                }

                img {
                    animation: spin 2s linear infinite;
                }
            `);
        }
    }

    if (!splashProgress) {
        sendToSplash("set-splash-progress-visible", false);
    }

    splash.webContents.once("did-finish-load", () => {
        if (!splash || splash.isDestroyed()) return;
        splashReady = true;
        for (const [channel, payload] of pendingSplashMessages) {
            if (!splash || splash.isDestroyed()) return;
            splash.webContents.send(channel, payload);
        }
        pendingSplashMessages.length = 0;
    });

    splash.on("closed", () => {
        splashReady = false;
        pendingSplashMessages.length = 0;
    });

    return splash;
}

export function addSplashLog() {
    if (!splash || splash.isDestroyed()) return;
    doneTasks++;
    const percentage = Math.min(100, Math.round((doneTasks / totalTasks) * 100));
    sendToSplash("update-splash-progress", percentage);
}

export function getSplash() {
    return splash;
}

export function updateSplashMessage(message: string) {
    sendToSplash("update-splash-message", message);
}