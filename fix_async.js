const fs = require("fs");

const fedRoute = "server/src/routes/federation.ts";
let routeCode = fs.readFileSync(fedRoute, "utf8");
routeCode = routeCode.replace(
  /federationRoute\.get\("\/info", async \(c\) => \{/g,
  'federationRoute.get("/info", (c) => {',
);
routeCode = routeCode.replace(
  /federationRoute\.get\("\/categories", async \(c\) => \{/g,
  'federationRoute.get("/categories", (c) => {',
);
routeCode = routeCode.replace(
  /federationRoute\.get\("\/categories\/:id\/posts", async \(c\) => \{/g,
  'federationRoute.get("/categories/:id/posts", (c) => {',
);
routeCode = routeCode.replace(
  /federationRoute\.get\("\/posts\/:id", async \(c\) => \{/g,
  'federationRoute.get("/posts/:id", (c) => {',
);
fs.writeFileSync(fedRoute, routeCode);
