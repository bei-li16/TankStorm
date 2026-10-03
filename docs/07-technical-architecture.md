# 坦克风云复刻技术架构

本文件提出适合个人项目的实现架构。它基于玩法的状态与一致性需求，并非对原游戏服务端的逆向结论。公开材料不能证明原游戏用了什么引擎、语言、数据库或微服务。

## 技术路线建议

首选 TypeScript 领域核心与浏览器 2D 客户端。M1 在浏览器 Worker 中运行世界与战斗，IndexedDB 保存状态；M2 将同一核心移到 Node 服务端，客户端改用命令接口。这样先完成可玩版本，后续可保留已验证的经济与战斗规则。

| 层 | 建议技术 | 选择理由与限制 |
| --- | --- | --- |
| 场景与战报动画 | PixiJS | 官方定位为 2D 渲染引擎；需自己实现世界规则及 UI。[官方 T01](https://pixijs.com/) |
| 菜单与表单 | HTML、CSS 与 TypeScript | 资源、升级和库存面板优先使用清晰可访问的 DOM |
| 领域规则 | 无框架 TypeScript 包 | 只依赖输入、规则包和随机种子，便于移到服务端 |
| 本地执行 | Web Worker 与消息命令 | 大段离线推进不阻塞界面；数据修改仍按统一提交过程 |
| 本地存储 | IndexedDB | 支持结构化对象及事务，适合存档。[文档 T03](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) |
| 在线接口 | Node 与 Fastify | 作为候选 HTTP 框架，提供命令和查询入口。[官方 T02](https://fastify.dev/docs/latest/) |
| 小型在线存储 | SQLite | 简单单文件，单世界串行写入较易管理；高写入并发要另行评估。[官方 T04](https://www.sqlite.org/whentouse.html) |
| 后续规模扩展 | PostgreSQL 等事务数据库 | 仅在多人规模与部署需求明确后决定，首版无需服务拆分 |

上表保留研究阶段的候选路线。2026 年 10 月 2 日首版实际采用 React、DOM、SVG、Worker 和 IndexedDB，依赖已经由 package-lock.json 锁定；PixiJS、Fastify 与 SQLite 尚未安装。具体决策见 [实现说明](12-implementation-guide.md)。

若最终优先原生桌面或移动端，可以选择 Godot 等引擎。该路径需要重写渲染与平台适配，仍可保留本文的领域接口、规则表和验收场景；不建议同时实现两条客户端路线。

## 模块结构

~~~mermaid
flowchart TB
    UI[基地 地图 编队 战报 UI] --> Client[GameClientPort]
    Client --> Local[本地 Worker Adapter]
    Client --> HTTP[HTTP Adapter 后续]
    Local --> App[WorldApplication 命令与事务]
    HTTP --> Server[在线鉴权与限流]
    Server --> App
    App --> World[WorldCore 状态推进]
    World --> Econ[Economy 建造 科技 生产 修理]
    World --> March[March 行军 采集 占领]
    World --> Battle[BattleCore 纯函数]
    App --> Store[StorePort]
    Store --> IDB[IndexedDB]
    Store --> SQL[SQLite 后续]
    Config[版本化配置与来源状态] --> World
    Config --> Battle
~~~

| 模块 | 负责 | 禁止承担 |
| --- | --- | --- |
| Config | 解析、校验、规则哈希、旧版规则读取 | 把不明来源的值标成原版 |
| Economy | 资源区间结算、容量、队列及成长效果 | 自行查询系统时钟 |
| Inventory | 可用、出征、待修等容器的原子转移 | 独立复制部队对象 |
| BattleCore | 对战快照、确定性计算、事件流 | 钱包和数据库写入 |
| WorldCore | 事件排序、目标冲突、行军与世界状态 | UI 动画时间 |
| Application | 命令验证、事务、幂等、奖励与存档 | 根据客户端上报结果直接给奖励 |
| Presentation | 输入、显示、音画与战报播放 | 再算一套伤害算法 |
| Adapter | Clock、Store、GameClient 与网络 | 隐式改变领域规则 |

建议目录为 apps/client、apps/server、packages/core、packages/config、packages/contracts、packages/test-fixtures、assets。首版实际代码位于 src/core、src/client 和 src/ui，后续迁移服务端时再按包拆分。

## 时间与离线推进

游戏权威时间用 UTC 毫秒，展示和游戏日换算采用 Asia/Shanghai。数据不存储容易混淆的本地日期字符串。

advanceWorld(targetTime) 先找最早到期事件，将资源和采集推进到该时刻，再应用事件；继续到 targetTime。资源产率、容量和守军等可能在中途改变，因此不能一次使用最终状态补算离线收益。

~~~text
while nextEvent.dueAt <= targetTime:
    settleContinuousFlows(worldTime, nextEvent.dueAt)
    worldTime = nextEvent.dueAt
    applyEvent(nextEvent)
    scheduleFollowUpEvents()
settleContinuousFlows(worldTime, targetTime)
worldTime = targetTime
~~~

持久化 dueAt、eventId、priority、sequence 和业务引用。建议同毫秒优先级：队列完成 10；资源点耗尽 20；行军到达与回城 30；日奖励状态切换 40；NPC 决策 50。每类内按持久化 sequence 升序；新生成同刻事件必须重新纳入排序。命令在所有到期事件完成后执行。

生产批次可聚合多个完成，但不能越过可能影响行为的其他事件时刻。NPC 决策只在配置的决策点执行，不能按离线秒数执行百万次。M1 世界尺寸和活跃 NPC 有限，超过处理预算时分块运行并显示“恢复世界进度”；尚未推进完禁止发新命令。

本地实时时钟回退时使用 max(上次权威时间, 当前时间) 并记录异常。单人模式无法可靠阻止用户调时；提供明确的沙盒时间倍率。联机模式只使用服务器时间，客户端倒计时不决定任务是否完成。

## 原子提交与幂等

每个命令含 commandId、expectedRevision、kind 和 payload。先推进到权威当前时刻，再在应用层事务中验证并转移资产。状态、资产账本、事件、命令结果和 revision 必须一次提交。

commandId 按 playerId 唯一。同 ID 同 payload 返回原结果；同 ID 不同 payload 返回 IDEMPOTENCY_CONFLICT。幂等查询先于 expectedRevision 校验，否则已成功的旧请求在重试时会错误报版本冲突。

本地模式建议先计算下一状态，再用 IndexedDB readwrite 事务读取当前 revision 并比较，写入变更和结果。事务中不等待网络、图片或长时间计算，避免事务自动结束；若 revision 已变，放弃计算并重新加载。多标签页只能有一个写入者，使用单写入协调与 revision 比较双重控制。

在线世界建议一个世界写入队列串行执行命令与定时事件，SQLite 事务作为最终一致性保证。定时器只负责唤醒；重启后扫描数据库内 dueAt 补结算，不依赖内存 setTimeout 作为任务事实。

## 战斗创建与结算

到达事件锁定相关基地、矿点与行军，读取双方实际容器，创建战斗快照。战斗纯函数生成结果后，应用层一次写入兵损、待修、货物、目标所有权、奖励和战报。结算使用唯一 battleId；已存在 BattleSettled 标记则直接返回现有结果。

客户端可能先看到“战斗已发生”再播放动画；世界继续运行，战报只重放历史快照。不能让玩家通过退出动画取消实际战损。

## 在线模式边界

M2 客户端只发送选择，不发送可信伤害、掉落、金币余额或对方快照。服务端验证归属、可用量、目标状态、费用和前置。侦察查询按权限返回字段，不发送全服私有钱包或其他玩家全部部队库存。

断线重连后先拉 revision 和当前公开视图，再查询未确认 commandId 的结果；未确定提交情况前不自动创建新 ID 重发。推送用于界面刷新，最终事实可通过查询恢复。

## 保存与诊断

保存 schemaVersion、rulesetId、rulesetHash、worldSeed、worldTime、revision、容器、活动事件和必要战报。每次重要资产变化自动保存，并保留最近两个可恢复快照。导出格式包含完整校验哈希；哈希用于发现损坏，不是防作弊签名。

错误日志按 commandId、battleId 和 eventId 关联。调参报告可以看产出消耗、永久损失、闲置队列和行动时长；单人默认本地记录。开发工具允许推进时间与生成固定阵容，但在线正式环境不得暴露给普通玩家。

## 架构决策记录

| 决策 | 当前建议 | 重新评估条件 |
| --- | --- | --- |
| 第一版运行方式 | 本地单人世界 | 用户明确要求联机优先 |
| 规则与显示 | 分离纯核心和 UI | 任何伤害或奖励逻辑出现在 UI 时纠正 |
| 计时 | 持久化事件与区间推进 | 活跃世界太大时做区域调度，但保留语义 |
| 一致性 | 世界单写入加事务 | 多世界水平扩展时每世界仍保留写入序 |
| 数值 | 整数表与基点 | 原始数据明确要求其他取整行为 |
| 规则包 | 与旧战报绑定 | 校准历史算法时创建新规则包 |
| 联机权威 | 服务端统一判定 | 不允许通过性能优化把资产权威交给客户端 |
