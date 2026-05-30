import { BaseText, Button, CheckedTextInput } from "@equicord/types/components";
import { Margins } from "@equicord/types/utils";
import { showToast } from "@equicord/types/webpack/common";
import { useSettings } from "renderer/settings";

import { cl, SettingsComponent } from "./Settings";

export const CustomSettingsSection: SettingsComponent = () => {
    const settings = useSettings();

    const onTitleChange = (value: string) => {
        settings.customStaticTitle = value || undefined;
    };

    const onSelectIcon = async () => {
        const res = await VesktopNative.fileManager.selectWindowIcon();
        if (res === "ok") {
            showToast("Window icon updated. It will apply immediately.");
        }
    };

    const onClearIcon = () => {
        settings.customWindowIcon = undefined;
        showToast("Window icon reset to default.");
    };

    return (
        <div className={cl("custom-settings")}>
            <div style={{ marginBottom: "16px" }}>
                <BaseText size="md" weight="medium" tag="h3" className={Margins.bottom8}>
                    Custom Static Title
                </BaseText>
                <BaseText size="sm" style={{ color: "var(--text-muted)", marginBottom: "8px" }}>
                    Override the window title shown when "Static Title" is enabled. Leave blank to use "Equibop".
                </BaseText>
                <div style={!settings.staticTitle ? { opacity: 0.5, pointerEvents: "none" } : undefined}>
                    <CheckedTextInput
                        placeholder="Equibop"
                        value={settings.customStaticTitle ?? ""}
                        onChange={onTitleChange}
                        validate={() => true}
                    />
                </div>
                {!settings.staticTitle && (
                    <BaseText size="sm" style={{ color: "var(--text-muted)", marginTop: "4px" }}>
                        Enable "Static Title" above to use this option.
                    </BaseText>
                )}
            </div>

            <div>
                <BaseText size="md" weight="medium" tag="h3" className={Margins.bottom8}>
                    Custom Window Icon
                </BaseText>
                <BaseText size="sm" style={{ color: "var(--text-muted)", marginBottom: "8px" }}>
                    Replace the taskbar and window icon. Supports .ico, .png, .jpg files.
                </BaseText>
                {settings.customWindowIcon && (
                    <BaseText size="sm" style={{ color: "var(--text-muted)", marginBottom: "8px", wordBreak: "break-all" }}>
                        Current: {settings.customWindowIcon}
                    </BaseText>
                )}
                <div style={{ display: "flex", gap: "8px" }}>
                    <Button onClick={onSelectIcon}>Choose Icon</Button>
                    {settings.customWindowIcon && (
                        <Button variant="secondary" onClick={onClearIcon}>
                            Reset to Default
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
