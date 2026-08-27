# XrayUI 原生配置保留与安全 Apply 开发路线

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 让 XrayUI 在显示和编辑已适配字段的同时，对未适配的入站、出站、路由、Reverse 及未知字段保持原样；无法证明无损回写时阻止 Apply。

**Architecture:** 原生 JSON 是唯一基线，独立保存 immutable baseline、working document 和 ordered JSON Patch。旧 Vue model 只作为 UI 投影，不能再作为整份配置的序列化来源。Apply 分为 native-preserving 路径和显式 legacy 路径；当前真机配置只允许前者，所有未适配结构默认拒绝提交。

**Tech Stack:** Vue 3 + TypeScript、class-transformer（仅用于 UI 投影）、Jest、Vite、ASUSWRT `/start_apply.htm`、Xray 26.7.28 `run -test`。

---

## 已固定基线与问题证据

- 仓库：`/root/asuswrt-merlin-xrayui-rebuild`
- 分支：`xrayui-rebuild`
- 官方 UI 基线：`9cc8ab210106be5a93630bc4cb50cf10a6ba304b`
- 当前安全闸门提交：`5d7de5a`
- 真机：AX86U，Xray `26.7.28`，`linux/arm64`
- 用户原始配置 `config _15_.json` 哈希：`d1189dc8f630e855cd1eb429c27fc4b653eeea00189de07e822070fdbdacf8b7`
- 被 Apply 后的 `config _16_.json` 哈希：`57924f7b87f39e1724cfbe84b428ae5ded746cf03f7bdd58f329bd580df0d511`
- 结构规模：4 个入站、32 个出站、44 条路由规则
- 已确认破坏：空 `clients`、空 `vnext`、`rawSettings`、`xhttpSettings`、`finalmask`、`hysteriaSettings` 被删除或改写，系统规则顺序被改变。

真机当前只读状态不能作为开发成功标准；除非用户另行确认，开发期间不恢复、不覆盖、不重启真机。

---

## 阶段 0：安全边界与基线固化

### Task 0.1：保存脱敏基线 fixture

**Files:**
- Create: `tests/fixtures/native-config/ax86u-config15.redacted.json`
- Create: `tests/fixtures/native-config/README.md`

**要求:** 保留 4/32/44 的完整结构、字段名、数组顺序、Reverse、XHTTP、FinalMask、Hysteria、balancer 和 routing；所有 UUID、密码、私钥、Reality 长密钥、订阅 URL 使用稳定占位符，不能提交真实凭据。

**验证:** JSON parse；字段路径和数组顺序与原始文件一致；报告只输出路径和短哈希。

### Task 0.2：把当前阻止式闸门标为临时保护

**Files:**
- Modify: `src/modules/ConfigCompatibility.ts`
- Test: `src/modules/ConfigCompatibility.spec.ts`

**要求:** 保持当前行为：检测到 `users`、扁平 VLESS、Reverse、XHTTP、FinalMask、Hysteria 原生字段时拒绝 Apply；明确注释这是 native-preserving adapter 完成前的 fail-closed 保护，不把它误称为最终无损 Apply。

**验证:** 运行专项 Jest；当前真实结构命中阻止路径。

### Task 0.3：提交基线文档

```bash
git add docs/plans/native-config-preserving-apply-roadmap.md tests/fixtures/native-config/ src/modules/ConfigCompatibility.*
git commit -m "docs: define native config preserving apply roadmap"
git push origin xrayui-rebuild
```

---

## 阶段 1：建立 Native Document 与 JSON Patch 边界

### Task 1.1：先写 baseline/working/patches 失败测试

**Files:**
- Create: `src/modules/NativeDocument.spec.ts`

覆盖：无 patch 保持原结构；deep copy 不污染 baseline；patch 有序；未知顶层键、未知子树、标量和数组顺序保留。

### Task 1.2：实现最小文档容器

**Files:**
- Create: `src/modules/NativeDocument.ts`

接口至少包括：

```ts
createNativeDocument(input)
getBaseline()
getWorking()
applyPatch(operation)
applyPatches(operations)
reset()
isDirty()
```

禁止在该模块调用任何 `normalize()`、DNS repair、排序或 class-transformer。

### Task 1.3：先写 JSON Pointer 失败测试，再实现 patch

**Files:**
- Modify: `src/modules/NativeDocument.spec.ts`
- Modify: `src/modules/NativeDocument.ts`

支持 RFC 6901 的 `add`、`replace`、`remove`；支持 `~1`、`~0` 和数组 `-`；批量操作失败必须原子回滚；非法路径不能改变 working 或 patch log。

### Task 1.4：验证并提交

```bash
corepack pnpm exec jest --config ./jest.config.ts --runInBand src/modules/NativeDocument.spec.ts
corepack pnpm exec tsc --noEmit -p tsconfig.json
 git diff --check
 git commit -m "feat: add native document patch boundary"
```

---

## 阶段 2：入站原生 users/clients 投影

### Task 2.1：先写入站投影失败测试

**Files:**
- Create: `src/modules/NativeInboundUsers.spec.ts`

矩阵：

1. `users` 正确投影到 Clients UI；
2. clients-only 旧配置保持 clients；
3. `users + clients: []` 不让空 clients 覆盖 users；
4. 两者都非空报告冲突，不自动合并；
5. user 的未知字段、`reverse`、`testseed` 保留；
6. UI 修改 email/flow 只产生对应 user JSON Pointer patch。

### Task 2.2：实现集中适配器

**Files:**
- Create: `src/modules/NativeInboundUsers.ts`
- Modify: `src/modules/InboundObjects.ts`
- Modify: `src/components/inbounds/VlessInbound.vue`
- Modify: `src/components/clients/VlessClients.vue`

UI 可以继续使用 `clients` 命名，但原生保存只能使用原文档实际字段；不得为了 UI 写入 `clients: []`。

### Task 2.3：真实 fixture round-trip

使用脱敏 AX86U fixture，经真实 hydrate → UI 投影 → 无修改 patch 路径后，断言入站子树结构等价；再测试只改一个 user email 时只有该 Pointer 改变。

### Task 2.4：提交

```bash
corepack pnpm exec jest --config ./jest.config.ts --runInBand src/modules/NativeInboundUsers.spec.ts src/modules/InboundObjects.spec.ts
corepack pnpm exec jest --config ./jest.config.ts --runInBand --silent
corepack pnpm run build
git diff --check
git commit -m "feat: preserve native inbound users in UI"
```

---

## 阶段 3：扁平 VLESS 出站适配与无损回写

### Task 3.1：先写两种 VLESS 形状的失败测试

**Files:**
- Create: `src/modules/NativeVlessOutbound.spec.ts`

覆盖旧 `settings.vnext`、新版扁平 `address/port/id/flow/encryption`，以及 `settings.reverse`、`testseed`、未知字段和 IPv6 address。

### Task 3.2：实现出站投影适配器

**Files:**
- Create: `src/modules/NativeVlessOutbound.ts`
- Modify: `src/modules/OutboundObjects.ts`
- Modify: `src/components/outbounds/VlessOutbound.vue`

读取时生成统一 UI view；写回时按 baseline 形状选择 legacy 或 flat。不得给所有 VLESS 出站无条件添加 `vnext`，不得把 flat 结构转换成旧结构。

### Task 3.3：实现“未编辑出站原文回放”

**Files:**
- Modify: `src/modules/NativeDocument.ts`
- Modify: `src/modules/Engine.ts`

没有对应显式 patch 的 outbound 必须直接使用 baseline 对象；只有用户明确编辑的 outbound 才应用局部 patch。这样即使 UI model 不认识某字段，也不会参与序列化。

### Task 3.4：完整出站 fixture 验收

逐个按 `tag` 对齐 32 个出站，断言：tag、protocol、address、port、settings、streamSettings、Reverse、XHTTP、FinalMask、Hysteria 和未知字段未编辑时完全保持；编辑单个字段时只改变预期路径。

---

## 阶段 4：传输层和未知字段无损保留

### Task 4.1：补齐传输字段行为测试

**Files:**
- Modify: `src/modules/NativeVlessOutbound.spec.ts`
- Modify: `src/modules/TransportObjects.spec.ts`

重点字段：

```text
rawSettings
xhttpSettings
finalmask
hysteriaSettings
tlsSettings.echConfigList
tlsSettings.pinnedPeerCertSha256
```

未知 FinalMask type 必须保留原对象，不能 normalize 成 `undefined`。

### Task 4.2：修复 typed serializer 的边界

**Files:**
- Modify: `src/modules/TransportObjects.ts`
- Modify: `src/modules/CommonObjects.ts`
- Modify: `src/modules/Engine.ts`

旧 normalize 只允许显式 legacy mode 调用；Native Apply 不调用这些会删默认/未知字段的 normalize。

### Task 4.3：提交前后结构差异工具

**Files:**
- Create: `scripts/compare_native_config.ts` 或与项目工具链一致的等价脚本

按 outbound tag、inbound tag、rule name/idx 对齐，输出增加、删除、修改路径；值只输出类型、长度和短哈希，禁止敏感值。

---

## 阶段 5：Reverse 与路由引用兼容

### Task 5.1：先写 Reverse 收集失败测试

**Files:**
- Create: `src/modules/NativeReverseReferences.spec.ts`

覆盖：顶层 `reverse.bridges/portals`、入站 `settings.users[].reverse.tag`、出站 `settings.reverse.tag`；验证来源分类、重复标签、空标签和路由选项显示。

### Task 5.2：实现集中引用收集器

**Files:**
- Create: `src/modules/NativeReverseReferences.ts`
- Modify: `src/components/ReverseProxy.vue`
- Modify: `src/components/modals/ReverseItemsModal.vue`
- Modify: `src/components/modals/RulesModal.vue`
- Modify: `src/components/Routing.vue`

只做读取投影和显式 Pointer patch；不把 Reverse 标签投影成普通 outbound，不重排 routing.rules。

### Task 5.3：真实规则 round-trip

以 44 条规则和 3 个 balancer 为完整 fixture，验证无编辑时规则顺序、idx、name、inboundTag、outboundTag、balancerTag、selector、fallbackTag 和 strategy 不变。

---

## 阶段 6：Engine Apply 双通道

### Task 6.1：先写 Apply 行为测试

**Files:**
- Modify: `src/modules/Engine.spec.ts`
- Create: `src/modules/ApplyMode.spec.ts`

要求：

- native-preserving 无 patch：不调用 legacy `prepareServerConfig`；
- native-preserving 单 patch：只提交 patch 后 working document；
- 检测到无法证明无损的结构：拒绝提交；
- legacy mode 必须显式传入，不能从字段猜测；
- 阻止时不创建提交 payload、不触发 `/start_apply.htm`。

### Task 6.2：实现显式 Apply mode

**Files:**
- Modify: `src/components/MainForm.vue`
- Modify: `src/modules/Engine.ts`
- Create/Modify: `src/modules/ApplyMode.ts`

`MainForm` 的 Apply 必须走 native-preserving 路径；旧 `prepareServerConfig()` 暂时保留给明确 legacy caller。当前临时 `ConfigCompatibility` 闸门在适配器完成前继续 fail closed。

### Task 6.3：后端最终保存闸门

**Files:**
- Inspect/Modify: `src/backend/install.sh`
- Inspect/Modify: `src/backend/update.sh`
- Inspect generated shipped script and backend Apply handler

正式配置覆盖前必须：同目录唯一临时文件、JSON parse、目标 Xray `run -test`、同目录备份、原子 `mv`、读回哈希；失败保持旧文件并清理临时文件。前端闸门不能替代后端闸门。

---

## 阶段 7：完整验证与部署门槛

### 本地必须全部通过

```bash
corepack pnpm exec jest --config ./jest.config.ts --runInBand --silent
corepack pnpm run build
corepack pnpm exec tsc --noEmit -p tsconfig.json   # 记录现有错误，不能新增本次错误
bash -n src/backend/install.sh src/backend/update.sh
git diff --check
```

### 脱敏真实结构验证

- `config _15_` fixture 经 no-op native Apply 后结构无差异；
- 单字段 patch 只改变目标 Pointer；
- Xray 26.7.28 `run -test` 通过；
- 不把 `run -test` 表述为网络互通。

### 真机部署前硬门槛

必须同时具备：

1. 用户明确授权真机变更；
2. 设备身份、Core 版本/PID、正式配置哈希、UI 哈希已记录；
3. 当前正式配置有带哈希备份；
4. UI-only 部署和配置变更分开；
5. 候选配置经真实 Core `-test`；
6. Apply 前后结构差异只包含明确用户 patch；
7. 失败可原子恢复并读回；
8. 重启后验证进程、配置哈希、监听状态和关键业务链路。

### 真机执行顺序

```text
备份与只读记录
→ 只部署 UI
→ 回读 UI 哈希
→ 只读加载原生配置
→ 页面显示验证
→ 用户确认后再做最小配置 patch
→ 同目录临时文件 + xray -test
→ 备份 + 原子替换
→ 重启并回读
→ 失败立即恢复
```

禁止把 UI 构建成功、JSON 可解析或 Core `-test` 通过说成出站网络已恢复；实际网络恢复还要按具体出站做 TCP/TLS/Reality/XHTTP/Hysteria 业务验证。

---

## 提交与执行规则

- 每个 Task 按 RED → 运行失败测试 → GREEN → 专项测试 → 全量测试 → 构建 → commit。
- 不在未完成上一阶段验收时进入下一阶段。
- 不用真实 UUID、密码、私钥、订阅链接和长公钥写入 fixture、日志、提交或报告。
- 不修改真机配置、防火墙、TPROXY、IPsec 或启动脚本，直到阶段 7 的真机门槛全部满足并得到明确授权。
- 当前第一项实际开发任务是 **Task 0.1：制作脱敏完整 fixture**，不是恢复真机，也不是再次点击 Apply。
