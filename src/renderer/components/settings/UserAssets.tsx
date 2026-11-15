/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./UserAssets.css";
import { Button, Divider, FormSwitch, Text } from "@equicord/types/components";
import { Margins, wordsFromCamel, wordsToTitle } from "@equicord/types/utils";
import { Modal, openModal, Select, showToast, useState } from "@equicord/types/webpack/common";
import { UserAssetType } from "main/userAssets";
import { useSettings } from "renderer/settings";
import { isWindows } from "renderer/utils";
import {
    MAX_NOTIFICATION_BADGE_COUNT,
    NOTIFICATION_BADGE_ASSETS,
    STATUS_BADGES,
    UNREAD_BADGE_ASSET
} from "shared/taskbarBadges";

import { SettingsComponent } from "./Settings";

const TRAY_ASSETS: UserAssetType[] = ["tray", "trayUnread", "traySpeaking", "trayIdle", "trayMuted", "trayDeafened"];
const STATUS_ASSETS = Object.values(STATUS_BADGES);
const CUSTOMIZABLE_ASSETS: UserAssetType[] = ["splash", ...TRAY_ASSETS];
const COUNT_BADGE_OPTIONS = [
    ...NOTIFICATION_BADGE_ASSETS.map((value, index) => {
        const count = index + 1;
        return {
            label: count === MAX_NOTIFICATION_BADGE_COUNT ? `${count}+ notifications` : String(count),
            value
        };
    }),
    { label: "Unread messages", value: UNREAD_BADGE_ASSET } as const
];

type AssetVersions = Record<UserAssetType, number>;

function makeInitialVersions(): AssetVersions {
    const now = Date.now();
    const assets = [
        ...CUSTOMIZABLE_ASSETS,
        ...COUNT_BADGE_OPTIONS.map(({ value }) => value),
        ...STATUS_ASSETS.map(({ asset }) => asset)
    ];
    return Object.fromEntries(assets.map(asset => [asset, now])) as AssetVersions;
}

export const UserAssetsButton: SettingsComponent = () => {
    return <Button onClick={() => openAssetsModal()}>Customize App Assets</Button>;
};

function openAssetsModal() {
    openModal(props => (
        <Modal {...props} size="md" title="User Assets">
            <AssetsModalContent />
        </Modal>
    ));
}

function AssetsModalContent() {
    const settings = useSettings();
    const [versions, setVersions] = useState<AssetVersions>(makeInitialVersions);
    const [countBadge, setCountBadge] = useState(COUNT_BADGE_OPTIONS[0].value);

    const bumpVersions = (assets: UserAssetType[]) => {
        const now = Date.now();
        setVersions(prev => {
            const next = { ...prev };
            for (const asset of assets) next[asset] = now;
            return next;
        });
    };

    const onSetAllTrayIcons = async () => {
        const res = await VesktopNative.fileManager.chooseAllTrayAssets();
        if (res === "ok") {
            bumpVersions(TRAY_ASSETS);
        } else if (res === "failed") {
            showToast({ text: "Something went wrong. Please try again", variant: "critical" });
        }
    };

    return (
        <div className="vcd-user-assets">
            <section>
                <Text size="md" weight="medium" tag="h3">
                    Tray icons
                </Text>
                <div className="vcd-user-assets-actions">
                    <div className="vcd-user-assets-buttons">
                        <Button onClick={onSetAllTrayIcons}>Set all tray icon states</Button>
                    </div>
                    <FormSwitch
                        title="16-bit tray icon color"
                        description="Quantizes tray icons down to 16-bit color (65,536 colors), useful for Windows 95 - 2000 setups."
                        value={settings.tray16BitColor ?? false}
                        onChange={val => (settings.tray16BitColor = val)}
                        className={Margins.top16}
                        hideBorder
                    />
                </div>
            </section>
            <Divider />
            {CUSTOMIZABLE_ASSETS.map(asset => (
                <Asset key={asset} asset={asset} version={versions[asset]} onChanged={() => bumpVersions([asset])} />
            ))}
            {isWindows && (
                <>
                    <Divider />
                    <section>
                        <Text size="md" weight="medium" tag="h3" className={Margins.bottom8}>
                            Taskbar Badges
                        </Text>
                        <Select
                            options={[
                                { label: "Notification count", value: "count" },
                                { label: "User status", value: "status" }
                            ]}
                            closeOnSelect
                            select={value => (settings.taskbarBadgeMode = value)}
                            isSelected={value => value === settings.taskbarBadgeMode}
                            serialize={value => value}
                        />
                    </section>
                    {settings.taskbarBadgeMode === "status" ? (
                        STATUS_ASSETS.map(({ asset, label }) => (
                            <Asset
                                key={asset}
                                asset={asset}
                                label={label}
                                version={versions[asset]}
                                onChanged={() => bumpVersions([asset])}
                            />
                        ))
                    ) : (
                        <>
                            <Select
                                options={COUNT_BADGE_OPTIONS}
                                closeOnSelect
                                select={setCountBadge}
                                isSelected={value => value === countBadge}
                                serialize={value => value}
                            />
                            <Asset
                                key={countBadge}
                                asset={countBadge}
                                label={COUNT_BADGE_OPTIONS.find(({ value }) => value === countBadge)?.label}
                                version={versions[countBadge]}
                                onChanged={() => bumpVersions([countBadge])}
                            />
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function Asset({
    asset,
    label,
    version,
    onChanged
}: {
    asset: UserAssetType;
    label?: string;
    version: number;
    onChanged: () => void;
}) {
    const settings = useSettings();

    const isSplash = asset === "splash";
    const imageRendering = isSplash && settings.splashPixelated ? "pixelated" : "auto";

    const onChooseAsset = (value?: null) => async () => {
        const res = await VesktopNative.fileManager.chooseUserAsset(asset, value);
        if (res === "ok") {
            onChanged();
            if (isSplash && value === null) {
                settings.splashPixelated = false;
            }
        } else if (res === "failed") {
            showToast({ text: "Something went wrong. Please try again", variant: "critical" });
        }
    };

    return (
        <section>
            <Text size="md" weight="medium" tag="h3">
                {label ?? wordsToTitle(wordsFromCamel(asset))}
            </Text>
            <div className="vcd-user-assets-asset">
                <img
                    className="vcd-user-assets-image"
                    src={`equibop://assets/${asset}?v=${version}`}
                    alt=""
                    style={{ imageRendering }}
                />
                <div className="vcd-user-assets-actions">
                    <div className="vcd-user-assets-buttons">
                        <Button onClick={onChooseAsset()}>Customize</Button>
                        <Button variant="secondary" onClick={onChooseAsset(null)}>
                            Reset to default
                        </Button>
                    </div>
                    {isSplash && (
                        <FormSwitch
                            title="Nearest-Neighbor Scaling (for pixel art)"
                            value={settings.splashPixelated}
                            onChange={val => (settings.splashPixelated = val)}
                            className={Margins.top16}
                            hideBorder
                        />
                    )}
                </div>
            </div>
        </section>
    );
}
