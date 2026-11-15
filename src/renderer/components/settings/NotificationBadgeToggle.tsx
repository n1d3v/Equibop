/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { setBadge } from "renderer/appBadge";
import { isWindows } from "renderer/utils";

import { SettingsComponent } from "./Settings";
import { VesktopSettingsSwitch } from "./VesktopSettingsSwitch";

export const NotificationBadgeToggle: SettingsComponent = ({ settings }) => {
    const showStatus = isWindows && settings.taskbarBadgeMode === "status";
    return (
        <>
            <VesktopSettingsSwitch
                title={showStatus ? "Taskbar Badge" : "Notification Badge"}
                description={
                    showStatus ? "Show your Discord status on the taskbar icon" : "Show mention badge on the app icon"
                }
                value={settings.appBadge}
                onChange={v => {
                    settings.appBadge = v;
                    if (v) setBadge();
                    else VesktopNative.app.setBadgeCount(0);
                }}
            />
            {settings.appBadge && !showStatus && (
                <VesktopSettingsSwitch
                    title="Badge Only for Mentions"
                    description="Show badge only for pings/mentions, not for unread messages"
                    value={settings.badgeOnlyForMentions}
                    onChange={v => {
                        settings.badgeOnlyForMentions = v;
                        setBadge();
                    }}
                />
            )}
        </>
    );
};
