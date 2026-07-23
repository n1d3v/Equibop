import { execSync } from "child_process";

process.env.EQUIBOP_NO_ARRPC = "1";

execSync("bun run build --no-arrpc", { stdio: "inherit", env: process.env });
execSync("electron-builder", { stdio: "inherit", env: process.env });