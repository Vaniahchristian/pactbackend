import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '../..');
const serverPath = path.join(rootDir, 'src', 'server.ts');

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function parseServerRoutes(serverCode: string) {
  const baseMatch = serverCode.match(/const\s+v1\s*=\s*['`"]([^'`\"]+)['`\"]/);
  const basePath = baseMatch ? baseMatch[1] : '';

  const importRegex = /import\s+([A-Za-z0-9_]+)\s+from\s+['\"](.+?)['\"]/g;
  const importMap = new Map<string, string>();
  let importMatch;
  while ((importMatch = importRegex.exec(serverCode))) {
    importMap.set(importMatch[1], importMatch[2]);
  }

  const appUseRegex = /app\.use\(\s*([^,]+?)\s*,\s*([A-Za-z0-9_]+)\s*\)/g;
  const mounts: Array<{ name: string; mount: string; path: string }> = [];
  let appUseMatch;

  while ((appUseMatch = appUseRegex.exec(serverCode))) {
    let mountExpr = appUseMatch[1].trim();
    const routerName = appUseMatch[2].trim();

    if (mountExpr.startsWith('`') && mountExpr.endsWith('`')) {
      mountExpr = mountExpr.slice(1, -1).replace(/\$\{v1\}/g, basePath);
    } else if ((mountExpr.startsWith("'") && mountExpr.endsWith("'")) || (mountExpr.startsWith('"') && mountExpr.endsWith('"'))) {
      mountExpr = mountExpr.slice(1, -1);
    }

    if (importMap.has(routerName)) {
      mounts.push({ name: routerName, mount: mountExpr, path: importMap.get(routerName)! });
    }
  }

  return mounts;
}

function parseRouteFile(routeCode: string) {
  const fileAuth = /router\.use\(\s*requireAuth\s*\)/.test(routeCode);
  const routeCallRegex = /router\.(get|post|put|patch|delete|all|head)\(\s*(['`\"])([^'`\"]*?)\2([\s\S]*?)\)\s*;/g;
  const routes: Array<{ method: string; route: string; requiresAuth: boolean; roles: string[] }> = [];
  let match;

  while ((match = routeCallRegex.exec(routeCode))) {
    const method = match[1].toUpperCase();
    const route = match[3] || '/';
    const args = match[4];
    const requiresAuth = fileAuth || /requireAuth\W/.test(args);
    const roleMatch = /requireRole\(([^)]*)\)/.exec(args);
    const roles = roleMatch
      ? roleMatch[1]
          .split(',')
          .map((role) => role.trim().replace(/^['`"]|['`"]$/g, ''))
          .filter(Boolean)
      : [];

    routes.push({ method, route, requiresAuth, roles });
  }

  return routes;
}

function resolveRouteFile(importPath: string) {
  const normalized = importPath.replace(/^\.\//, '');
  const candidate = path.resolve(rootDir, 'src', normalized + '.ts');
  if (fs.existsSync(candidate)) return candidate;
  const candidateIndex = path.resolve(rootDir, 'src', normalized, 'index.ts');
  if (fs.existsSync(candidateIndex)) return candidateIndex;
  throw new Error(`Unable to resolve route file for import path: ${importPath}`);
}

function normalizePath(mount: string, route: string) {
  if (!mount.endsWith('/') && !route.startsWith('/')) {
    return `${mount}/${route}`;
  }
  if (mount.endsWith('/') && route.startsWith('/')) {
    return `${mount}${route.slice(1)}`;
  }
  return `${mount}${route}`;
}

function main() {
  const serverCode = readFile(serverPath);
  const mounts = parseServerRoutes(serverCode);

  const results: Array<{
    method: string;
    path: string;
    file: string;
    requiresAuth: boolean;
    roles: string[];
  }> = [];

  for (const mount of mounts) {
    const routeFile = resolveRouteFile(mount.path);
    const routeCode = readFile(routeFile);
    const routeDefs = parseRouteFile(routeCode);

    for (const def of routeDefs) {
      results.push({
        method: def.method,
        path: normalizePath(mount.mount, def.route),
        file: path.relative(rootDir, routeFile),
        requiresAuth: def.requiresAuth,
        roles: def.roles,
      });
    }
  }

  if (results.length === 0) {
    console.log('No endpoints found.');
    return;
  }

  results.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  console.log('Discovered endpoints:');
  console.log('METHOD PATH                                     AUTH  ROLES');
  console.log('------ ---------------------------------------- ----- ------------------------------');
  for (const entry of results) {
    const authLabel = entry.requiresAuth ? 'yes' : 'no';
    const rolesLabel = entry.roles.length ? entry.roles.join(',') : '-';
    console.log(
      `${entry.method.padEnd(6)} ${entry.path.padEnd(40)} ${authLabel.padEnd(5)} ${rolesLabel}`
    );
  }

  const publicEndpoints = results.filter((r) => !r.requiresAuth);
  const authEndpoints = results.filter((r) => r.requiresAuth);
  const roleEndpoints = results.filter((r) => r.roles.length > 0);

  console.log('\nSummary:');
  console.log(`  total endpoints: ${results.length}`);
  console.log(`  public endpoints: ${publicEndpoints.length}`);
  console.log(`  auth-protected endpoints: ${authEndpoints.length}`);
  console.log(`  role-protected endpoints: ${roleEndpoints.length}`);

  if (publicEndpoints.length) {
    console.log('\nPublic endpoints:');
    for (const entry of publicEndpoints) {
      console.log(`  ${entry.method.padEnd(6)} ${entry.path}`);
    }
  }
}

main();
