import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoName = process.argv[2] ?? "Optimus_Finiquito";
const owner = process.argv[3] ?? "claudioalemany-max";
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function getGitHubToken() {
  const input = "protocol=https\nhost=github.com\n\n";
  const result = spawnSync("git", ["credential", "fill"], {
    input,
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) {
    throw new Error("No se pudieron obtener credenciales de GitHub desde Git Credential Manager.");
  }

  const lines = result.stdout.split("\n");
  const fields = Object.fromEntries(
    lines
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );

  const token = fields.password;
  if (!token) {
    throw new Error("Git Credential Manager no devolvio un token de GitHub.");
  }

  return token;
}

async function createRepo(token) {
  const response = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "chile-finiquito-engine",
    },
    body: JSON.stringify({
      name: repoName,
      description: "Chile termination/finiquito advisory engine for employer clients",
      private: false,
      auto_init: false,
    }),
  });

  if (response.status === 201) {
    const data = await response.json();
    return data.html_url;
  }

  if (response.status === 422) {
    const data = await response.json();
    const message = JSON.stringify(data);
    if (message.includes("already exists") || message.includes("name already exists")) {
      return `https://github.com/${owner}/${repoName}`;
    }
    throw new Error(`GitHub rechazo la creacion del repo: ${message}`);
  }

  const body = await response.text();
  throw new Error(`GitHub API error ${response.status}: ${body}`);
}

function pushToOrigin(remoteUrl) {
  execFileSync("git", ["remote", "set-url", "origin", remoteUrl], {
    cwd: packageRoot,
    stdio: "inherit",
    windowsHide: true,
  });
  execFileSync("git", ["push", "-u", "origin", "main"], {
    cwd: packageRoot,
    stdio: "inherit",
    windowsHide: true,
  });
}

const remoteUrl = `https://github.com/${owner}/${repoName}.git`;

try {
  console.log(`Creando repositorio ${owner}/${repoName} en GitHub...`);
  const token = getGitHubToken();
  const repoUrl = await createRepo(token);
  console.log(`Repositorio listo: ${repoUrl}`);
  console.log("Subiendo rama main...");
  pushToOrigin(remoteUrl);
  console.log("");
  console.log("Listo. Codigo publicado en GitHub.");
} catch (error) {
  console.error("");
  console.error(error instanceof Error ? error.message : error);
  console.error("");
  console.error("Si falla la autenticacion:");
  console.error("1. Abre https://github.com/new");
  console.error(`2. Crea el repo ${repoName} vacio`);
  console.error("3. Ejecuta: git push -u origin main");
  process.exit(1);
}
