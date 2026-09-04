// pm2-Prozessdefinition für den Strato-V-Server. Siehe docs/deployment-strato.md.
// Umgebungsvariablen kommen bewusst NICHT aus dieser Datei (die liegt im Git-Repo),
// sondern aus /etc/lernsprung/.env.production (Rechte 600, außerhalb des Repos).
module.exports = {
  apps: [
    {
      name: "lernsprung-website",
      cwd: __dirname,
      script: "npm",
      args: "start",
      env_file: "/etc/lernsprung/.env.production",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
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
