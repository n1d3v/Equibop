/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, type BrowserWindow, type NativeImage, nativeImage } from "electron";
import {
    type BadgeStatus,
    isBadgeStatus,
    MAX_NOTIFICATION_BADGE_COUNT,
    NOTIFICATION_BADGE_ASSETS,
    STATUS_BADGES,
    type TaskbarBadgeAsset,
    UNREAD_BADGE_ASSET
} from "shared/taskbarBadges";

import { AppEvents } from "./events";
import { mainWin } from "./mainWindow";
import { Settings } from "./settings";
import { resolveAssetPath, type UserAssetType } from "./userAssets";

const imgCache = new Map<UserAssetType, NativeImage>();
let lastBadge: { window: BrowserWindow; asset: TaskbarBadgeAsset | null } | undefined;
let badgeUpdate = 0;
let badgeCount = 0;
let badgeStatus: BadgeStatus | null = null;
let isInVoiceCall = false;

const voiceStateListener = (inCall: boolean) => {
    isInVoiceCall = inCall;
};

if (!AppEvents.listeners("voiceCallStateChanged").includes(voiceStateListener)) {
    AppEvents.on("voiceCallStateChanged", voiceStateListener);
}

export function destroyAppBadge() {
    AppEvents.off("voiceCallStateChanged", voiceStateListener);
    AppEvents.off("userAssetChanged", onAssetChanged);
    Settings.removeChangeListener("taskbarBadgeMode", refreshWindowsBadge);
    Settings.removeChangeListener("appBadge", refreshWindowsBadge);
    badgeUpdate++;
    imgCache.clear();
}

function onAssetChanged(asset: UserAssetType) {
    imgCache.delete(asset);
    if (getWindowsBadge()[0] === asset) refreshWindowsBadge();
}

if (process.platform === "win32") {
    AppEvents.on("userAssetChanged", onAssetChanged);
    Settings.addChangeListener("taskbarBadgeMode", refreshWindowsBadge);
    Settings.addChangeListener("appBadge", refreshWindowsBadge);
}

export function refreshWindowsBadge() {
    lastBadge = undefined;
    updateWindowsBadge().catch(error => console.error("Failed to update the taskbar badge:", error));
}

async function updateWindowsBadge() {
    if (process.platform !== "win32" || !mainWin || mainWin.isDestroyed()) return;

    const win = mainWin;
    const update = ++badgeUpdate;
    const [asset, description] = getWindowsBadge();
    if (lastBadge?.window === win && lastBadge.asset === asset) return;

    let image = asset && imgCache.get(asset);
    if (asset && !image) {
        image = nativeImage.createFromPath(await resolveAssetPath(asset));
        if (image.isEmpty()) {
            image = nativeImage.createFromPath(await resolveAssetPath(asset, false));
        }
    }
    if (update !== badgeUpdate || win.isDestroyed() || mainWin !== win) return;

    if (asset && image) imgCache.set(asset, image);
    win.setOverlayIcon(image ?? null, description);
    lastBadge = { window: win, asset };
}

export function setBadgeStatus(status: unknown) {
    if (process.platform !== "win32") return;

    const nextStatus = isBadgeStatus(status) ? status : null;
    if (badgeStatus === nextStatus) return;
    badgeStatus = nextStatus;
    if (Settings.store.taskbarBadgeMode === "status") return updateWindowsBadge();
}

/**
 * -1 = show unread indicator
 * 0 = clear
 */
export function setBadgeCount(count: number) {
    if (!isInVoiceCall) {
        AppEvents.emit("setTrayVariant", count !== 0 ? "trayUnread" : "tray");
    }

    switch (process.platform) {
        case "linux":
            if (count === -1) count = 0;
            app.setBadgeCount(count);
            break;
        case "darwin":
            if (count === 0) {
                app.dock!.setBadge("");
                break;
            }
            app.dock!.setBadge(count === -1 ? "•" : count.toString());
            break;
        case "win32":
            badgeCount = count;
            return updateWindowsBadge();
    }
}

function getWindowsBadge(): [TaskbarBadgeAsset | null, string] {
    if (!Settings.store.appBadge) return [null, ""];
    if (Settings.store.taskbarBadgeMode === "status") {
        if (!badgeStatus) return [null, ""];
        const { asset, label } = STATUS_BADGES[badgeStatus];
        return [asset, label];
    }

    if (badgeCount === 0) return [null, "No Notifications"];
    if (badgeCount === -1) return [UNREAD_BADGE_ASSET, "Unread Messages"];

    const count = Math.max(1, Math.min(badgeCount, MAX_NOTIFICATION_BADGE_COUNT));
    return [NOTIFICATION_BADGE_ASSETS[count - 1], `${count} Notification`];
}
