import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "trumpet-trainer";
export default defineRailway(() => {
  const trumpetTrainer = service("trumpet-trainer", {
    source: github("EL101/trumpet-trainer", {
      branch: "main",
      checkSuites: false,
      rootDirectory: "/server",
    }),
    build: { buildEnvironment: "V3", builder: "RAILPACK" },
    preDeploy: "npx prisma migrate deploy",
    replicas: { sfo: 1 },
    deploy: { drainingSeconds: 30, overlapSeconds: 0 },
  });

  return project("soothing-commitment", {
    variables: { managed: false },
    resources: [trumpetTrainer],
  });
});
