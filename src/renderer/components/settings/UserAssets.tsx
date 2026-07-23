/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./UserAssets.css";

import { BaseText, Button, Divider, FormSwitch } from "@equicord/types/components";
import { Margins, openModal, wordsFromCamel, wordsToTitle } from "@equicord/types/utils";
import { Modal, showToast, useState } from "@equicord/types/webpack/common";
import { UserAssetType } from "main/userAssets";
import { useSettings } from "renderer/settings";

import { SettingsComponent } from "./Settings";

const CUSTOMIZABLE_ASSETS: UserAssetType[] = [
    "splash",
    "tray",
    "trayUnread",
    "traySpeaking",
    "trayIdle",
    "trayMuted",
    "trayDeafened"
];

const TRAY_ASSETS: UserAssetType[] = ["tray", "trayUnread", "traySpeaking", "trayIdle", "trayMuted", "trayDeafened"];

type AssetVersions = Record<UserAssetType, number>;

function makeInitialVersions(): AssetVersions {
    const now = Date.now();
    return Object.fromEntries(CUSTOMIZABLE_ASSETS.map(asset => [asset, now])) as AssetVersions;
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
            showToast("Something went wrong. Please try again");
        }
    };

    return (
        <div className="vcd-user-assets">
            <section>
                <BaseText size="md" weight="medium" tag="h3">
                    Tray icons
                </BaseText>
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
        </div>
    );
}

function Asset({ asset, version, onChanged }: { asset: UserAssetType; version: number; onChanged: () => void }) {
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
            showToast("Something went wrong. Please try again");
        }
    };

    return (
        <section>
            <BaseText size="md" weight="medium" tag="h3">
                {wordsToTitle(wordsFromCamel(asset))}
            </BaseText>
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
                            value={settings.splashPixelated ?? false}
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
