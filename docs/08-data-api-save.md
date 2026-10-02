# 坦克风云数据接口与存档设计

以下是建议的数据契约，供后续 TypeScript 实现采用。配置包和账号状态分开；来源字段用于避免开发过程中误把原型数值当作原版数据。

## 配置表

| 表 | 主键 | 关键字段 | 校验 |
| --- | --- | --- | --- |
| Ruleset | rulesetId | schemaVersion、hash、battlePolicy、timePolicy | 有旧版本读取路径 |
| ResourceDef | resourceId | 名称、产出与容量策略、载重权重 | ID 唯一、量纲明确 |
| BuildingDef | buildingId | 类型、目标等级表、费用、秒数、前置、效果 | 等级连续、依赖无环 |
| UnitDef | unitId | classId、tier、attack、hp、load、cost、time、unlock | 四类合法，数值为非负安全整数 |
| TechDef | techId | 属性、作用范围、每级效果、前置和费用 | 加成组与取整定义明确 |
| SkillDef | skillId | 概率或属性、等级和荣誉勋章费用 | 基点范围明确 |
| Matchup | attackerClass 与 defenderClass | multiplierBps、provenance | 16 组齐全，缺失不静默兜底 |
| StageDef | stageId | 守军、首通和重复奖励、战损政策 | 编队不超过六格 |
| MineDef | mineTemplateId | 守军、资源量、采率、等级 | 不引用不存在单位 |
| QuestDef | questId | 条件、事件、奖励、前置 | 可在先完成条件后接任务 |

配置 provenance 至少有 status，取 verified_public、player_observation、inferred_mapping 或 proposed；另外记录 sourceIds、observedDate、appliesToEra 和 note。一个对象可混合不同来源字段，必要时以 fieldProvenance 指明。

原型文件只是这些表的起点，不包含所有建筑费用、关卡和任务。开发前还要按本设计生成完整内容表，不能把示例配置称为可直接运行的游戏。

## 状态实体

| 实体 | 标识与字段 | 关系及不变量 |
| --- | --- | --- |
| World | worldId、seed、time、rulesetId、revision | 一个权威事件序列 |
| Player | playerId、name、baseId、commander、legionId | 不在客户端信任权限字段 |
| Base | baseId、ownerId、position、buildings | 地图坐标唯一占用 |
| Wallet | ownerId、resourceId、balance、remainder、cap、protected | 非负；允许外部收益超自产 cap |
| Building | instanceId、buildingId、level、slot | 同 slot 不可重叠 |
| QueueJob | jobId、kind、dueAt、costSnapshot、count、completedCount | 完成数不超过原定数 |
| UnitContainer | containerId、ownerId、kind | kind 为 available、march、damaged、repair、conversion |
| UnitAmount | containerId、unitId、count | 数量整数，同型号全容器合计守恒 |
| FormationPreset | presetId、ownerId、slots | 预设不锁数量，只是期望配置 |
| March | marchId、ownerId、origin、target、state、containerId、cargo | 所有兵只存在于该容器一次 |
| Mine | mineId、position、remaining、occupierMarchId、guard | 一矿同时只有一个占用队 |
| Battle | battleId、input、result、settledAt | 同 battleId 最多结算一次 |
| QuestProgress | ownerId、questId、progress、claimed | 奖励领取状态只可完成一次 |
| Event | eventId、dueAt、priority、sequence、kind、payload | 同 dueAt 使用稳定序 |
| CommandReceipt | ownerId、commandId、payloadHash、result | 唯一约束，支持提交后重试 |
| Ledger | entryId、causeId、asset、from、to、delta | 转移双方相等；产出与销毁单独分类 |

推荐资产只用容器里的 count 表示。在 Player 对象再放一份“总兵数”只能作为可重建视图，不能成为第二套事实。永久损失累计值是统计字段，不是可用容器。

## 资产守恒

~~~text
初始部队 + 生产 + 任务赠兵 + 改装产出
= 可用 + 出征 + 待修 + 修理中 + 改装中 + 永久销毁 + 改装消耗

初始资源 + 自产 + 奖励 + NPC 外部注入
= 钱包 + 在途货物 + 费用消耗 + 销毁损失
~~~

玩家间掠夺属于转移，不计全世界新产出；矿中存量转到货物也属于转移。队列预扣资源记为已支付费用，取消时使用同一 causeId 做退款分录。改装是旧型消耗与新型产出两笔，不能用所有型号合计简单掩盖差异。

## 命令与查询

GameClientPort 提供 execute(Command)、query(Query)、subscribe(WorldNotification)。本地 Worker 与在线 HTTP 使用相同业务对象，区别是在线请求的 playerId 从会话获取，不从 payload 信任。

~~~json
{
  "commandId": "cmd-unique-id",
  "expectedRevision": 42,
  "kind": "StartProduction",
  "payload": {"factoryId": "factory-1", "unitId": "tank_t1", "count": 20}
}
~~~

~~~json
{
  "commandId": "cmd-unique-id",
  "revision": 43,
  "worldTime": 1790812800000,
  "status": "accepted",
  "result": {"jobId": "job-1"},
  "changedViews": ["wallet", "production"]
}
~~~

示例时间只是格式样例，接口不能按该常量运行。

| 命令 | Payload 核心 | 关键校验 |
| --- | --- | --- |
| UpgradeBuilding | instanceId | 等级、费用、队列 |
| StartResearch | techId、targetLevel | 当前级、科研中心、声望 |
| StartProduction | factoryId、unitId、count | 型号解锁、数量、费用 |
| CancelProduction | jobId | 所有权、已完成量、退款状态 |
| UpgradeLeadership | targetLevel | 统率书、下一等级 |
| UpgradeSkill | skillId | 技能等级、荣誉勋章 |
| ScoutTarget | targetId | 水晶、目标可访问 |
| SaveFormation | presetId、slots | 单位定义、数量、槽位，不锁库存 |
| StartMarch | targetId、action、slots | 六格、实际库存、出征槽 |
| RecallMarch | marchId | 当前状态及已推进的采量 |
| ChallengeStage | stageId、slots | 解锁、库存、体力或费用政策 |
| StartRepair | unitId、count | 待修池、修理槽与水晶 |
| CancelRepair | jobId | 完成数量、未完成返回与退款 |
| ClaimQuest | questId | 条件满足、未领取 |
| UseAcceleration | jobId、itemId | 费用、到期边界、实际剩余时间 |

查询包括 GetBaseView、GetInventoryView、GetCommanderView、GetWorldRegion、GetMarches、GetBattleReport、GetStageList、GetQuestView。GetWorldRegion 必须按可见信息裁剪，不含对方私有库存。

在线候选路径：POST /v1/commands；GET /v1/me/state；GET /v1/world/region；GET /v1/battles/:id；GET /v1/commands/:id。推送事件附 revision；丢失推送时重新查询视图即可。

| 错误码 | 意义与客户端处理 |
| --- | --- |
| REVISION_CONFLICT | 状态已变化，重新查询后由用户重新操作 |
| INSUFFICIENT_RESOURCE | 返回缺少的资源和数量，无扣费 |
| INSUFFICIENT_UNITS | 返回可用量，不把在途部队计为可用 |
| PREREQUISITE_NOT_MET | 返回具体前置名称与缺口 |
| QUEUE_FULL | 展示占用任务和预计完成时间 |
| INVALID_FORMATION | 标出槽位、数量或统率问题 |
| TARGET_CHANGED | 目标已变化，允许查看新情报 |
| INVALID_MARCH_STATE | 当前阶段不能执行该操作 |
| ALREADY_CLAIMED | 返回原领取结果，不再次发奖 |
| IDEMPOTENCY_CONFLICT | 同 commandId 参数不同，拒绝执行 |
| RULESET_UNAVAILABLE | 缺少旧规则，保留存档并提示恢复路径 |

## 存档格式和迁移

~~~json
{
  "schemaVersion": 1,
  "rulesetId": "classic-prototype-v0.1",
  "rulesetHash": "computed-at-build-time",
  "worldId": "local-world-1",
  "worldSeed": 2601001,
  "worldTime": 1790812800000,
  "revision": 43,
  "state": {},
  "pendingEvents": [],
  "recentCommandReceipts": [],
  "recentBattleReports": [],
  "checksum": "computed-over-canonical-payload"
}
~~~

state 在示例中省略，正式导出必须包含上表必要实体。canonical-payload 定义为键按字典序、数组按业务顺序、整数十进制序列化后的 UTF-8 内容，checksum 字段自身不参与计算。hash 采用 SHA-256，具体实现开工时选择统一库。

导入流程：读取到临时对象；检查结构、大小、哈希、所有引用及资产非负；确认 schema 与 ruleset 能加载；迁移到新结构；验证迁移前后资产统计；存入新档位；成功后才切换。失败保留当前档，不“尽力”加载半个状态。

schemaVersion 变更属于结构迁移；rulesetId 变更属于玩法迁移，两者不能混为一谈。玩法升级可以只作用新世界；旧档继续加载旧包最安全。若要迁移旧档，明确列出费用、任务计时、伤残和战报的转换政策，并先保留备份。

## 数据生成与内容来源

开工时生成建筑等级表、12 个单位、科技等级、12 个教学关、矿点模板、NPC 初始配置及任务表。生成器输出确定的整数文件；内容校验一次发现全部缺项，不到游戏运行时才发现不存在的引用。

官方截图、文章和玩家评论作为研究引用，正式资产需重新绘制或使用有明确许可的素材。source-index 只存引用与短摘要，不包含原游戏安装包、提取资源或整页转载。
