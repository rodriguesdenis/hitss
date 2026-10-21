// Removes development-only packages (and everything only they need) from a pnpm virtual store.
//   node prune-cli.cjs <node_modules dir> <package name>[,<package name>...]
// `pnpm deploy --prod` keeps the Prisma CLI and typescript because @prisma/client lists them as
// optional peers: the lockfile snapshot links them even though the API only declares them as dev
// dependencies. This walks the dependency graph from the real direct dependencies, never following
// an edge named like one of the given packages, and deletes every virtual-store entry that stays
// unreachable.
const fs = require('node:fs');
const path = require('node:path');

const [, , nodeModules, names] = process.argv;
if (!nodeModules || !names) {
  console.error(
    'usage: node prune-cli.cjs <node_modules dir> <package name>[,<package name>...]',
  );
  process.exit(2);
}
const skip = new Set(names.split(',').filter(Boolean));
const store = path.join(nodeModules, '.pnpm');

/** Names (including @scope/name) of the entries of a node_modules directory. */
function entries(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.')) return [];
    return name.startsWith('@')
      ? fs.readdirSync(path.join(dir, name)).map((sub) => `${name}/${sub}`)
      : [name];
  });
}

/** Virtual-store id (first segment under .pnpm) of a real package path. */
function idOf(realPath) {
  const relative = path.relative(store, realPath);
  return relative.startsWith('..') ? null : relative.split(path.sep)[0];
}

const direct = entries(nodeModules);
for (const name of skip) {
  if (direct.includes(name)) {
    console.error(`${name} is a direct dependency; refusing to prune it`);
    process.exit(1);
  }
}

const reachable = new Set();
function visit(id) {
  if (reachable.has(id)) return;
  reachable.add(id);
  const container = path.join(store, id, 'node_modules');
  for (const name of entries(container)) {
    const link = path.join(container, name);
    if (!fs.lstatSync(link).isSymbolicLink() || skip.has(name)) continue;
    const next = idOf(fs.realpathSync(link));
    if (next) visit(next);
  }
}
for (const name of direct) {
  const next = idOf(fs.realpathSync(path.join(nodeModules, name)));
  if (next) visit(next);
}

let removed = 0;
for (const id of fs.readdirSync(store)) {
  if (id === 'node_modules' || id.startsWith('.') || id.endsWith('.yaml'))
    continue;
  if (!reachable.has(id)) {
    fs.rmSync(path.join(store, id), { recursive: true, force: true });
    removed += 1;
  }
}
// Links to removed packages (including the hoisted ones in .pnpm/node_modules) now dangle.
for (const container of [
  path.join(store, 'node_modules'),
  ...[...reachable].map((id) => path.join(store, id, 'node_modules')),
]) {
  for (const name of entries(container)) {
    const link = path.join(container, name);
    if (fs.lstatSync(link).isSymbolicLink() && !fs.existsSync(link))
      fs.rmSync(link);
  }
}
console.log(
  `pruned ${removed} virtual-store entries not needed without ${[...skip].join(', ')}`,
);
