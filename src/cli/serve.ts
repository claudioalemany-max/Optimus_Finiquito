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
      console.log("");
      console.log("=== Chile Finiquito — Modo navegador ===");
      console.log(`El servidor ya estaba activo en el puerto ${port}.`);
      console.log(`URL: ${url}`);
      console.log("");
      console.log("Si el navegador no se abrio, usa el enlace de arriba.");
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
