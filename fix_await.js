const fs = require('fs');

const fedRoute = 'server/src/routes/federation.ts';
let routeCode = fs.readFileSync(fedRoute, 'utf8');
routeCode = routeCode.replace(/await federationService/g, 'federationService');
fs.writeFileSync(fedRoute, routeCode);

const fedService = 'server/src/services/federation.ts';
let serviceCode = fs.readFileSync(fedService, 'utf8');
serviceCode = serviceCode.replace(/\.get\(\) as any/g, '.get() as { id: string; siteUrl: string; displayName: string | null; blogTitle: string | null; avatarUrl: string | null; lastFetchedAt: string | null; createdAt: string; remoteBlogId: string; remoteId: string; name: string; slug: string; description: string | null; }');
serviceCode = serviceCode.replace(/catch \(err: any\)/g, 'catch (err)');
fs.writeFileSync(fedService, serviceCode);
