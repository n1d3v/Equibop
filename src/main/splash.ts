/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { pathToFileURL } from "url";

import { BrowserWindow } from "electron";
import { SplashProps } from "shared/browserWinProperties";
import { STATIC_DIR } from "shared/paths";

import { DATA_DIR } from "./constants";
import { Settings } from "./settings";
import { fileExistsAsync } from "./utils/fileExists";
import { loadView } from "./vesktopStatic";

export let splash: BrowserWindow | undefined;

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
    const { customSplashHtml, splashBackground, splashColor, splashTheming, splashProgress, splashPixelated } =
        Settings.store;
    const customSplashPath =
        customSplashHtml && (await fileExistsAsync(customSplashHtml)) ? customSplashHtml : undefined;
    const customSplashSettings = customSplashPath ? await readCustomSplashSettings(customSplashPath) : {};

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

    splash.on("closed", () => {
        splashReady = false;
        pendingSplashMessages.length = 0;
    });

    let usingCustomSplash = false;
    if (customSplashPath) {
        try {
            await splash.loadURL(pathToFileURL(customSplashPath).href);
            usingCustomSplash = true;
        } catch (e) {
            console.error("Failed to load custom splash screen HTML, falling back to default:", e);
        }
    }

    if (!usingCustomSplash) {
        try {
            const params = new URLSearchParams();
            if (splashTheming) {
                if (splashColor) params.set("fg", splashColor);
                if (splashBackground) params.set("bg", splashBackground);
            }
            if (splashPixelated) params.set("pixelated", "");
            await loadView(splash, "splash.html", params);
        } catch (e) {
            console.error("Failed to load the default splash screen:", e);
            return splash;
        }

        const hasCustomSplash = await fileExistsAsync(join(DATA_DIR, "userAssets", "splash"));

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

    if (!splash.isDestroyed()) {
        splashReady = true;
        for (const [channel, payload] of pendingSplashMessages) {
            splash.webContents.send(channel, payload);
        }
        pendingSplashMessages.length = 0;
    }

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
