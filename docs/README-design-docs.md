# v0.40.0 架构与详细设计文档

两册按当前工程实现编写，源码基线为 `570e6694ba1d13123850502bd0aa5764c2ad1483`，编制日期为 2026-10-23（Asia/Singapore）。

- [架构设计 PDF](70-architecture-design/TankStorm-Architecture-v0.40.0.pdf)：15 页，运行架构、模块、事务、时间、表现、存储、构建和维护边界。
- [详细设计 PDF](71-detailed-design/TankStorm-Detailed-Design-v0.40.0.pdf)：34 页，数据、RPC/命令、订单、经济、科研、成长、战斗、世界、副本、档案、兼容与验证。
- LaTeX 入口分别为两个目录的 `main.tex`，`chapters/` 为正文，`generated/` 为从源码导出的附表和基线。

主线 36 章 576 关、核心 20 章 320 关、28 车型、27 科技和 40 篇手册均按源码导出核对。文档任务重新运行 42 个测试文件、905 项测试并全部通过。本文档不是新的软件 Release，也没有修改游戏规则。

## 重新编译

Windows 下需要 XeLaTeX（本次使用本机 MiKTeX）、中文字体 SimSun/Microsoft YaHei/KaiTi，以及 Times New Roman、Segoe UI、Consolas。项目使用 ctex、TikZ、longtable、tabularx、fontspec、hyperref 等包。

从工程根目录运行：

```powershell
pwsh -NoProfile -File docs/latex-tools/build-design-docs.ps1
```

脚本检查源码基线后，运行三遍 XeLaTeX以稳定目录、页码和引用，检查溢出与缺字，将两个 PDF 放回各自源目录。默认清除本次编译目录；调试时可使用 `-KeepIntermediate`，完成后应删除对应临时目录。编译产生的 `.aux`、`.log`、`.toc`、`.out`、`.xdv` 等不属于交付物。

## 随代码更新规则附表

`collect-evidence.mjs` 读取实际模块，不启动玩家存档服务。更新前先审阅新源码与正文，随后从工程根目录运行：

```powershell
New-Item -ItemType Directory -Path tmp/design-docs -Force
npm test -- --maxWorkers=2 --reporter=json --outputFile=tmp/design-docs/tests.json
node docs/latex-tools/collect-evidence.mjs
pwsh -NoProfile -File docs/latex-tools/build-design-docs.ps1
```

附表更新不自动改正文、封面版本或文档日期。`baseline.json` 中的 SHA-256 对源码文本统一 LF 换行后计算，避免 CRLF/LF 造成误报。文档的维护建议与当前行为明确分开；历史说明中未落地或已变更的机制不作为现行接口承诺。

## 视觉复核

最终 PDF 已栅格化检查全部页面，并对封面、目录、架构/状态图、伤害公式与长表单页复核。检查项包括缺字、溢出、遮挡、表格跨页、页眉页脚、页码、公式和目录链接。复核结果见 [验收说明](design-docs-verification.txt)。渲染 PNG、缩略图、测试临时数据和编译缓存在交付前清理。

可使用带有 `pypdf`、`pdfplumber`、`pypdfium2` 和 `Pillow` 的 Python 环境重新生成逐页图片、联系表及自动检查结果：

```powershell
python docs/latex-tools/inspect-design-docs.py tmp/design-docs/visual
```

脚本不会替代人工视觉复核。完成后应清除本次生成的 `tmp/design-docs`；最终 PDF 与 LaTeX 源文件均在 `docs` 对应目录中。
