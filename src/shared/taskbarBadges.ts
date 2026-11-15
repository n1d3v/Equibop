/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const MAX_NOTIFICATION_BADGE_COUNT = 10;
export const UNREAD_BADGE_ASSET = "badgeCount11";
export const NOTIFICATION_BADGE_ASSETS = Array.from(
    { length: MAX_NOTIFICATION_BADGE_COUNT },
    (_, index) => `badgeCount${index + 1}` as const
);

export const STATUS_BADGES = {
    online: { asset: "badgeOnline", label: "Online" },
    idle: { asset: "badgeIdle", label: "Idle" },
    dnd: { asset: "badgeDnd", label: "Do Not Disturb" },
    streaming: { asset: "badgeStreaming", label: "Streaming" },
    invisible: { asset: "badgeInvisible", label: "Invisible" },
    offline: { asset: "badgeOffline", label: "Offline" }
} as const;

export type BadgeStatus = keyof typeof STATUS_BADGES;
export type TaskbarBadgeAsset =
    | (typeof NOTIFICATION_BADGE_ASSETS)[number]
    | typeof UNREAD_BADGE_ASSET
    | (typeof STATUS_BADGES)[BadgeStatus]["asset"];

export function isBadgeStatus(status: unknown): status is BadgeStatus {
    return typeof status === "string" && Object.hasOwn(STATUS_BADGES, status);
}
