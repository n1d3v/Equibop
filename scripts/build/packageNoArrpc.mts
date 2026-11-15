import { execSync } from "child_process";

execSync("bun run build --no-arrpc", { stdio: "inherit", env: process.env });
execSync("electron-builder", { stdio: "inherit", env: process.env });