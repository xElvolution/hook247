module.exports = {
  apps: [
    {
      name: "hook247-app",
      script: "npm",
      args: "start",
      cwd: "/root/hook247/app",
      env: {
        NODE_ENV: "production",
        NODE_OPTIONS: "--dns-result-order=ipv4first",
      },
    },
    {
      name: "hook247-landing",
      script: "npm",
      args: "start",
      cwd: "/root/hook247/landing",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
