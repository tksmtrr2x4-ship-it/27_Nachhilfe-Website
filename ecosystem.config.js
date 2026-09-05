// pm2-Prozessdefinition für den Strato-V-Server. Siehe docs/deployment-strato.md.
// Umgebungsvariablen kommen bewusst NICHT aus dieser Datei (die liegt im Git-Repo),
// sondern aus /etc/lernsprung/.env.production (Rechte 600, außerhalb des Repos).
//
// Wichtig: pm2's eingebautes `env_file` liest die Datei nur unzuverlässig neu ein
// (weder `pm2 reload --update-env` noch ein frischer `pm2 start` griffen in der
// Praxis zuverlässig auf Änderungen an der Datei zu). Deshalb parsen wir die Datei
// hier selbst und reichen sie über das normale `env`-Feld durch – pm2 liest diese
// Config-Datei bei JEDEM `pm2 reload ecosystem.config.js`/`pm2 start
// ecosystem.config.js` frisch ein, also auch die hier eingelesenen Werte.
const fs = require("fs");

function loadEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

module.exports = {
  apps: [
    {
      name: "lernsprung-website",
      cwd: __dirname,
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        ...loadEnvFile("/etc/lernsprung/.env.production"),
      },
      // Zero-Downtime-Reload: `pm2 reload ecosystem.config.js` statt `restart`
      // startet neue Worker, bevor die alten beendet werden.
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "300M",
      out_file: "/var/log/lernsprung/pm2-out.log",
      error_file: "/var/log/lernsprung/pm2-error.log",
      time: true,
    },
  ],
};
