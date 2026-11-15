import { Text, Button } from "@equicord/types/components";
import { Margins } from "@equicord/types/utils";
import { showToast, useState } from "@equicord/types/webpack/common";
import { useSettings } from "renderer/settings";
import { stripLineBreaks } from "shared/staticTitleFormat";

import { cl, SettingsComponent } from "./Settings";

export const CustomSettingsSection: SettingsComponent = () => {
    const settings = useSettings();
    const [titleDraft, setTitleDraft] = useState<string>(settings.customStaticTitle ?? "");

    const onTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitleDraft(stripLineBreaks(e.target.value));
    };

    const onTitleBlur = () => {
        settings.customStaticTitle = titleDraft.trim() || undefined;
    };

    const onSelectIcon = async () => {
        const res = await VesktopNative.fileManager.selectWindowIcon();
        if (res === "ok") {
            showToast({ text: "Window icon updated. It will apply immediately." });
        }
    };

    const onClearIcon = () => {
        settings.customWindowIcon = undefined;
        showToast({ text: "Window icon reset to default." });
    };

    const onSelectSplashHtml = async () => {
        const res = await VesktopNative.fileManager.selectSplashHtml();
        if (res === "ok") {
            showToast({ text: "Custom splash screen updated. It will apply next launch." });
        }
    };

    const onClearSplashHtml = () => {
        settings.customSplashHtml = undefined;
        showToast({ text: "Splash screen reset to default." });
    };

    return (
        <div className={cl("custom-settings")}>
            <div style={{ marginBottom: "16px" }}>
                <Text size="md" weight="medium" tag="h3" className={Margins.bottom8}>
                    Custom Static Title
                </Text>
                <Text size="sm" style={{ color: "var(--text-muted)", marginBottom: "8px" }}>
                    Override the window title shown when "Static Title" is enabled. Leave blank to use "Equibop".
                    Supports custom formatting tokens, look at FORMATTING_DOC.md in the forked repository to learn how to use it.
                </Text>
                <div style={!settings.staticTitle ? { opacity: 0.5, pointerEvents: "none" } : undefined}>
                    <input
                        type="text"
                        className="default-colors"
                        placeholder="Equibop"
                        value={titleDraft}
                        onChange={onTitleChange}
                        onBlur={onTitleBlur}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: "4px",
                            border: "1px solid var(--input-background)",
                            background: "var(--input-background)",
                            color: "var(--text-normal)",
                            fontSize: "14px",
                            boxSizing: "border-box"
                        }}
                    />
                </div>
                {!settings.staticTitle && (
                    <Text size="sm" style={{ color: "var(--text-muted)", marginTop: "4px" }}>
                        Enable "Static Title" above to use this option.
                    </Text>
                )}
            </div>

            <div>
                <Text size="md" weight="medium" tag="h3" className={Margins.bottom8}>
                    Custom Window Icon
                </Text>
                <Text size="sm" style={{ color: "var(--text-muted)", marginBottom: "8px" }}>
                    Replace the taskbar and window icon. Supports .ico, .png, .jpg files.
                </Text>
                {settings.customWindowIcon && (
                    <Text size="sm" style={{ color: "var(--text-muted)", marginBottom: "8px", wordBreak: "break-all" }}>
                        Current: {settings.customWindowIcon}
                    </Text>
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

            <div style={{ marginTop: "16px" }}>
                <Text size="md" weight="medium" tag="h3" className={Margins.bottom8}>
                    Custom Splash Screen
                </Text>
                <Text size="sm" style={{ color: "var(--text-muted)", marginBottom: "8px" }}>
                    Replace the splash screen shown while Equibop is loading with your own HTML file.
                    The file can include its own independent CSS and JavaScript as you see fit.
                    Look at SPLASH_DOC.md in the forked repository to learn how to create for it.
                </Text>
                {settings.customSplashHtml && (
                    <Text
                        size="sm"
                        style={{ color: "var(--text-muted)", marginBottom: "8px", wordBreak: "break-all" }}
                    >
                        Current: {settings.customSplashHtml}
                    </Text>
                )}
                <div style={{ display: "flex", gap: "8px" }}>
                    <Button onClick={onSelectSplashHtml}>Choose HTML File</Button>
                    {settings.customSplashHtml && (
                        <Button variant="secondary" onClick={onClearSplashHtml}>
                            Reset to Default
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
