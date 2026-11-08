const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const os = require("os");
const crypto = require("crypto");

const WORK = "D:\\Users\\XiaoH\\Documents\\deepseek-harness\\dsh-perfect-ui";
const BAKROOT = "D:\\Users\\XiaoH\\Documents\\deepseek-harness\\dsh-perfect-ui-backups";

function stamp() {
  const d = new Date();
  const p = (n) => ("0" + n).slice(-2);
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
}
function hashOf(p) { return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"); }
function countFiles(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(path.join(dir, e.name)); else n++;
  }
  return n;
}
function listBackups() {
  if (!fs.existsSync(BAKROOT)) { console.log("备份根目录不存在: " + BAKROOT); return; }
  const items = fs.readdirSync(BAKROOT, { withFileTypes: true }).filter((e) => e.isDirectory());
  console.log("=== 可用备份 ===");
  items.forEach((e, i) => {
    const full = path.join(BAKROOT, e.name);
    console.log("  [" + i + "] " + e.name + "  (" + countFiles(full) + " 个文件)");
  });
}
function copyTree(srcDir, dstDir, stats) {
  for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const from = path.join(srcDir, e.name);
    const to = path.join(dstDir, e.name);
    if (e.isDirectory()) { fs.mkdirSync(to, { recursive: true }); copyTree(from, to, stats); }
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      stats.copied++;
      if (hashOf(from) !== hashOf(to)) stats.mismatch.push(path.relative(srcDir, from));
    }
  }
}
function rollbackCurrent() {
  const dir = path.join(BAKROOT, "rollback-" + stamp());
  fs.mkdirSync(dir, { recursive: true });
  const st = { copied: 0, mismatch: [] };
  copyTree(WORK, dir, st);
  console.log("已自动备份当前状态 -> " + dir);
}
function selfCheck() {
  const checks = ["dist/client.js", "index.js", "host-session.js", "host-actions.js", "host-skill-market.js"];
  console.log("\n=== 恢复后自检 ===");
  let ok = true;
  for (const f of checks) {
    try { execFileSync(process.execPath, ["--check", path.join(WORK, f)], { stdio: "pipe" }); console.log("  OK   " + f); }
    catch (e) { ok = false; console.log("  FAIL " + f); }
  }
  try { execFileSync(process.execPath, ["build.js"], { cwd: WORK, stdio: "pipe" }); console.log("  OK   build.js 重建"); }
  catch (e) { ok = false; console.log("  FAIL build.js"); }
  return ok;
}

const arg = process.argv[2];
if (!arg) { listBackups(); console.log("\n用法: node restore.cjs <备份目录名>"); process.exit(0); }

let sourceDir;
if (arg === "--zip") {
  const z = process.argv[3];
  if (!z || !fs.existsSync(z)) { console.error("压缩包不存在: " + z); process.exit(1); }
  const tmp = path.join(os.tmpdir(), "restore-" + stamp());
  execFileSync("powershell", ["-NoProfile", "-Command", "Expand-Archive -Path '" + z + "' -DestinationPath '" + tmp + "' -Force"], { stdio: "pipe" });
  const dirs = fs.readdirSync(tmp, { withFileTypes: true }).filter((e) => e.isDirectory());
  sourceDir = dirs.length === 1 ? path.join(tmp, dirs[0].name) : tmp;
  console.log("从压缩包解出 -> " + sourceDir);
} else {
  sourceDir = path.join(BAKROOT, arg);
  if (!fs.existsSync(sourceDir)) { console.error("备份不存在: " + sourceDir); listBackups(); process.exit(1); }
}

console.log("\n=== 恢复来源: " + sourceDir + " ===");
rollbackCurrent();
const st = { copied: 0, mismatch: [] };
copyTree(sourceDir, WORK, st);
console.log("已恢复 " + st.copied + " 个文件");
if (st.mismatch.length) { console.error("!! 哈希不一致: " + st.mismatch.join(", ")); process.exit(1); }
console.log("哈希校验全部通过");
process.exit(selfCheck() ? 0 : 1);
