import { startWebServer } from "../server/web-server.js";
import { appUrl } from "../utils/open-browser.js";

async function waitForEnter(message: string): Promise<void> {
  console.log(message);
  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => resolve());
  });
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3847);
  const url = appUrl(port);

  try {
    const { alreadyRunning } = await startWebServer();

    if (alreadyRunning) {
      let apiReady = false;
      try {
        const probe = await fetch(`${url}/api/app-modules`);
        apiReady = probe.ok;
      } catch {
        apiReady = false;
      }

      console.log("");
      console.log("=== Chile Finiquito — Modo navegador ===");
      if (apiReady) {
        console.log(`El servidor ya estaba activo en el puerto ${port}.`);
        console.log(`URL: ${url}`);
        console.log("");
        console.log("Si el navegador no se abrio, usa el enlace de arriba.");
      } else {
        console.log(`Hay otro proceso en el puerto ${port}, pero no responde la API unificada.`);
        console.log("Cierra la ventana negra anterior del servidor y vuelve a ejecutar run-finiquito.bat.");
      }
      await waitForEnter("Presiona Enter para cerrar esta ventana...");
      return;
    }
  } catch (error) {
    console.error("");
    console.error("No se pudo iniciar el servidor web.");
    console.error(error instanceof Error ? error.message : error);
    console.error("");
    await waitForEnter("Presiona Enter para cerrar...");
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await waitForEnter("Presiona Enter para cerrar...");
  process.exit(1);
});
