import { spawn } from "node:child_process";

function runDetached(command: string, args: string[]): void {
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

/** Opens a URL or local file in the system default browser. */
export async function openInBrowser(target: string): Promise<boolean> {
  if (process.platform === "win32") {
    const fileTarget = target.startsWith("http") ? target : target.replace(/\\/g, "/");

    const attempts: Array<[string, string[]]> = [
      [
        "powershell.exe",
        ["-NoProfile", "-Command", `Start-Process -FilePath ${JSON.stringify(fileTarget)}`],
      ],
      ["cmd.exe", ["/c", "start", "", fileTarget]],
      ["rundll32.exe", ["url.dll,FileProtocolHandler", fileTarget]],
    ];

    for (const [command, args] of attempts) {
      try {
        runDetached(command, args);
        await new Promise((resolve) => setTimeout(resolve, 400));
        return true;
      } catch {
        // try next method
      }
    }
    return false;
  }

  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  try {
    runDetached(opener, [target]);
    await new Promise((resolve) => setTimeout(resolve, 400));
    return true;
  } catch {
    return false;
  }
}

export function appUrl(port = Number(process.env.PORT ?? 3847)): string {
  return `http://127.0.0.1:${port}`;
}
