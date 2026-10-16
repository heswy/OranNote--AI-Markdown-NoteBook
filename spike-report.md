# Spike 报告：Electron printToPDF 导出 A4 PDF 可行性验证

- 分支：`p1/pdf-spike`
- 日期：2026-10-15
- 环境：无头 Linux 容器 + xvfb，Electron **44.7.2**（Chromium 打印管线 `Skia/PDF m152`）
- 结论：**跑通**。中文字体正确子集嵌入、页面为矢量文本、背景色与真实图片渲染正常、每页页脚页码正确。

---

## 一、实际可跑命令

产品无关的独立原型，产物全部放在 `/tmp/p1-spike/`，不进仓库：

| 文件 | 说明 |
| --- | --- |
| `/tmp/p1-spike/spike.cjs` | 独立主进程脚本（可被 `xvfb-run` 直接执行） |
| `/tmp/p1-spike/test-doc.html` | 测试文档：中文标题/段落、代码块、表格、真实图片，原生 CSS `@page` |
| `/tmp/p1-spike/out.pdf` | 生成的 PDF（6 页 / A4 / 160,927 字节） |

**本容器内实际使用的命令**（关键是 `--no-sandbox`，原因见问题 2、3）：

```bash
xvfb-run -a /home/ubuntu/work/orn-wt/pdf-spike/node_modules/.bin/electron \
  --no-sandbox /tmp/p1-spike/spike.cjs
```

等价的另一种写法（用 Electron 自带的隐藏环境变量，可在二进制里 grep 到 `ELECTRON_DISABLE_SANDBOX`）：

```bash
xvfb-run -a env ELECTRON_DISABLE_SANDBOX=1 \
  /home/ubuntu/work/orn-wt/pdf-spike/node_modules/.bin/electron /tmp/p1-spike/spike.cjs
```

> 任务书里给的 `xvfb-run -a .../electron /tmp/p1-spike/spike.cjs`（不带任何 flag）**在本容器跑不起来**，
> 且**无法靠脚本内 `app.commandLine.appendSwitch('no-sandbox')` 解决**——因为崩溃发生在脚本被加载之前，见问题 2。

脚本支持两个环境变量便于换用例：`SPIKE_HTML`（默认 `/tmp/p1-spike/test-doc.html`）、`SPIKE_OUT`（默认 `/tmp/p1-spike/out.pdf`）。

---

## 二、验收结果（实测，非推断）

| 验收项 | 命令 | 结果 |
| --- | --- | --- |
| 文件存在且 >20KB | `ls -la /tmp/p1-spike/out.pdf` | 160,927 字节 ✅ |
| ≥3 页、A4 | `pdfinfo out.pdf` | `Pages: 6`、`595.92 x 842.88 pts (A4)` ✅ |
| 可抽中文（矢量文本） | `pdftotext -f 1 -l 1 out.pdf -` | 标题/正文中文完整抽出 ✅ |
| 页脚页码 | `pdftotext -f N -l N out.pdf - \| grep -o '第[0-9]*页/共[0-9]*页'` | 6 页全部命中 `第1页/共6页` … `第6页/共6页` ✅ |
| 图片渲染 | `pdfimages -list out.pdf` | page 3 一张 `400x300` 真实位图 ✅ |
| 字体嵌入方式 | `pdffonts out.pdf` | `AAAAAA+WenQuanYiZenHei`、`WenQuanYiZenHeiMono`，`CID TrueType / Identity-H`，`emb=yes sub=yes uni=yes` ✅ |

补充证据：

- **不是位图**：`pdftotext` 每页可抽出 976 / 889 / 1234 / 1210 等字符，证明中文以矢量文本 + 子集字体输出。
- **正文页边距正确**：以 72dpi 栅格化后逐像素扫描，正文最左侧黑点 x = **42pt ≈ 1.5cm**，页脚同样为 42pt。
- **可重复性**：连续跑 3 次，输出**字节完全一致**（均 160,927 字节，6 页）。
- **性能**：窗口 `loadFile` ≈ 230ms，`printToPDF` ≈ **320ms**（6 页）。
- **PDF 元数据**：`Title` 自动取自 HTML `<title>`（`Oran记 PDF 导出测试文档`），`Producer: Skia/PDF m152`。

---

## 三、printToPDF 参数（实际使用值）

```js
const pdf = await win.webContents.printToPDF({
  pageSize: 'A4',
  printBackground: true,          // 必须显式打开，默认 false
  landscape: false,
  displayHeaderFooter: true,
  headerTemplate: HEADER_TEMPLATE,
  footerTemplate: FOOTER_TEMPLATE, // 内含 <span class="pageNumber"> / <span class="totalPages">
  margins: { top: 0.59, bottom: 0.59, left: 0.59, right: 0.59 }, // 0.59in ≈ 1.5cm
  preferCSSPageSize: false,
});
```

页脚模板（中文实测正常）：

```html
<div style="width:100%;margin:0 1.5cm;font-family:'WenQuanYi Zen Hei',sans-serif;
            font-size:9px;color:#66748a;display:flex;justify-content:space-between;">
  <span>Oran记 · PDF 导出 spike</span>
  <span>第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页</span>
</div>
```

- **Promise 版 API 确认可用**：`node_modules/electron/electron.d.ts:18640` 签名为 `printToPDF(options: PrintToPDFOptions): Promise<Buffer>`，实测 `Buffer.isBuffer(pdf) === true`，无需回调形式。
- `printBackground: true` 是**必设项**：代码块灰底、表格表头底色、引用块浅底全靠它，默认 `false` 会全部丢失。
- `pageSize` 默认是 `Letter`，**必须显式写 `'A4'`**。
- 页脚模板是**独立文档**，不继承页面 CSS，样式必须内联（`font-family` 也要写，否则中文可能回退）。

---

## 四、遇到的问题（按踩坑顺序）

### 1. Electron 二进制没装好，`install.js` 挂死
`node_modules/electron/dist/` 不存在，跑起来只打印 `Downloading Electron binary...` 然后无限等待——
`@electron/get` 需要访问 github，**本环境 github.com 不可达**（npmmirror 可达）。
解决：直接复用本地缓存里的 zip 手动解包：

```bash
unzip -q ~/.cache/electron/<hash>/electron-v44.7.2-linux-x64.zip -d node_modules/electron/dist
printf 'electron' > node_modules/electron/path.txt   # 不能带换行！带 \n 会被当成文件名，再次触发下载
```

### 2. SUID sandbox 直接 FATAL，而且**脚本内的 appendSwitch 救不了**

```
FATAL:sandbox/linux/suid/client/setuid_sandbox_host.cc:166] The SUID sandbox helper binary
was found, but is not configured correctly ... chrome-sandbox is owned by root and has mode 4755
```

实测用一个只打印一行日志的探针脚本验证：**主进程脚本一行都没执行就被 abort**，
即 sandbox 初始化发生在 app 代码之前。所以任务书建议的 `app.commandLine.appendSwitch('no-sandbox')`
对这个错误**无效**（本脚本里仍保留该调用作为兜底，但真正生效的是命令行 flag）。
可行做法：命令行 `--no-sandbox`，或 `ELECTRON_DISABLE_SANDBOX=1`。

### 3. 把 chrome-sandbox 修成 root:4755 之后，**打印本身会失败**（打印依赖共享内存）

用 `sudo chown root:root chrome-sandbox && chmod 4755` 后 sandbox 能起来了，但 `printToPDF` 报：

```
ERROR:base/memory/platform_shared_memory_region_posix.cc:214] Creating shared memory in
  /dev/shm/.org.chromium.Chromium.xxx failed: No such process (3)
ERROR:components/services/print_compositor/print_compositor_impl.cc:442] CompositePages:
  Cannot create new shared memory region.
SPIKE FAILED: [Error: Failed to generate PDF: Printing failed]
```

注意这不是纸张/字体问题：**`print_compositor`（打印合成器）必须用共享内存**，
而容器里沙箱化的进程拿不到可用的 shm（`/dev/shm` 本身可写、tmpfs 正常，是沙箱侧的问题）。
结论：**本容器内必须 `--no-sandbox`**。已把 `chrome-sandbox` 权限还原为原状（`ubuntu:ubuntu 755`），
避免留下"普通命令报 /dev/shm 错"的迷惑状态。

### 4. ⚠️ CSS `@page` 的 `margin` 会**覆盖** `printToPDF` 的 `margins` 选项

这是本次最有价值的坑。第一版文档里写了 `@page { size: A4; margin: 0 }`（本意是"边距交给 options"），
结果正文**直接贴到纸张边缘**：72dpi 逐像素扫描得正文最左侧 x = **0pt**，标题左边缘被裁切，
而 Chromium 自己画的页脚却还在 42pt 处，形成"正文贴边 + 页码正常"的诡异错位（肉眼看缩略图极易漏判）。

对照实验（同一文档，只改 `@page`）：

| `@page` 写法 | 正文最左侧 x | 说明 |
| --- | --- | --- |
| `{ size: A4; margin: 0 }` | **0pt** | CSS 赢，options 的 1.5cm 被忽略 ❌ |
| `{ size: A4 }`（不写 margin） | 42pt | options 的 1.5cm 生效 ✅ |
| `{ size: A4; margin: 1.5cm }` | 43pt | CSS 生效（与 options 一致）✅ |

**做法：页边距只保留一个来源，且两处必须一致。**最终交付文档采用 `@page { size: A4; margin: 1.5cm }` + options `0.59in`。
另外注意第一版 `margin: 0` 时页数是 4 页，改成真实 1.5cm 边距后变成 6 页——版心变小会显著增加页数，
做产品时要意识到"页数变化"可能来自边距而非内容。

### 5. 资源就绪时序
在图片解码/字体度量完成前就调用 `printToPDF`，会得到空白图片位或首行字体回退（行宽变化 → 分页漂移）。
脚本里的做法是先等 `document.fonts.ready`，再等所有 `document.images` 进入 `complete`：

```js
await document.fonts.ready;
await Promise.all([...document.images].map(i => i.complete ? null :
  new Promise(r => { i.addEventListener('load', r); i.addEventListener('error', r); })));
```

注意 `document.fonts` 只包含 `@font-face` 字体，**系统字体不会出现在里面**（实测 `fontsLoaded: []`），
所以"中文有没有用上"要用 `measureText` 对比宽度的方式探针，或直接看产物的 `pdffonts`。

### 6. 其他小坑
- 页脚文字被 `pdftotext` 抽出来时**不含空格**（`第1页/共6页` 而非 `第 1 页 / 共 6 页`，几个 `<span>` 被合并），写验收正则别写死空格。
- `file:///tmp/orannote-test-ws/orange.png` 在 `loadFile()` 场景下可直接加载，不受网络策略影响。
- 图片以 128 x-ppi 写入，正文清晰度没问题，但图片密度偏低，产品级可对图片单独提质量。
- 打印失败时 `printToPDF` 是 reject（`Error: Failed to generate PDF: Printing failed`），不是返回空 buffer，调用方要 `try/catch`。

---

## 五、下一步做产品级实现的注意点

**安全（最重要）**
- `--no-sandbox` / `ELECTRON_DISABLE_SANDBOX=1` **只是本容器/CI 的临时手段，绝对不要带进发给用户的打包版**：
  关掉沙箱会让渲染进程沙箱失效，而笔记应用要加载本地文件与用户 Markdown，风险不可接受。
- 正确的分流：CI/无头回归用 flag；终端用户桌面端保持 sandbox 开启（桌面发行版上 chrome-sandbox 的 SUID 是安装器正常处理的）。

**打印参数与样式的一致性**
- 页边距/纸张只留**单一来源**，CSS `@page` 与 `margins`/`pageSize` 必须对齐（见问题 4）；若要让 CSS 说了算，用 `preferCSSPageSize: true`。
- 打印样式与被打印内容要**解耦**：建议单独维护一份 `@media print` / 打印专用样式，隐藏交互控件（工具栏、侧栏、按钮），
  否则编辑器 UI 会被一起打进 PDF。本次已用 `@page` + 原生 CSS 验证了这条路径不需要第三方排版库。

**分页质量**
- `break-inside: avoid`（代码块、表格、图注）能避免难看的断行断表，但代价是**末尾容易出现大面积空白**（本次最后一页就偏空）。
  产品上可考虑"允许超长表格内部断页 + 表头重复"的策略，而不是无脑 avoid。
- 标题建议 `break-after: avoid` 防止标题孤行。
- 需要目录/书签时可用 Electron 44 的实验参数 `generateDocumentOutline: true`（从标题层级生成大纲）；
  需要无障碍标签可用 `generateTaggedPDF: true`。两者都标了 experimental，上产品前要单独验证。

**架构与性能**
- 复用**隐藏窗口**做导出：可复用同一 `BrowserWindow`（换内容再打印），避免每次新建窗口的开销；
  注意导出后要恢复/销毁，别泄漏窗口。本次单文档 `printToPDF` 仅 ~320ms，6 页，性能不是瓶颈。
- 打印路径建议独立于编辑器的 DOM：把 Markdown 渲染成一份**干净的打印用 HTML**（含打印 CSS）再打印，
  比直接打印当前编辑器 DOM 更可控（缺资源、扩展、折叠态等边界少很多）。
- 长文档（100+ 页 / 大量图片）未在本次覆盖，产品前建议补一档压测；大图建议转 data URI 以规避异步加载竞态。
- 体积参考：中文正文页**子集嵌入**约 27KB/页（本次 6 页 161KB）。**不要嵌入完整中文字体**（动辄数 MB）；
  同时注意子集嵌入的 PDF 文本不可再编辑，阅读/存档场景足够。

**与已有代码的衔接**
- 导出落盘走主进程 `fs.writeFile` + `dialog.showSaveDialog`，经 IPC 暴露给渲染层
  （与 `p1/ipc-bridge` 的 `pdf:export` 占位通道正好对接）。
- 导出前需保证编辑器内容已"渲染完成"（预览模式/分页节点就绪），否则会打印到半成品 DOM。

---

## 六、复现方式

```bash
cd /home/ubuntu/work/orn-wt/pdf-spike

# 1) 生成 PDF
xvfb-run -a ./node_modules/.bin/electron --no-sandbox /tmp/p1-spike/spike.cjs

# 2) 验收
ls -la /tmp/p1-spike/out.pdf
pdfinfo /tmp/p1-spike/out.pdf                      # 期望：Pages: 6；Page size: 595.92 x 842.88 pts (A4)
pdftotext -f 1 -l 1 /tmp/p1-spike/out.pdf - | head # 期望：可读中文
pdffonts /tmp/p1-spike/out.pdf                     # 期望：WenQuanYiZenHei 子集嵌入
pdfimages -list /tmp/p1-spike/out.pdf              # 期望：page 3 一张 400x300
for p in 1 2 3 4 5 6; do pdftotext -f $p -l $p /tmp/p1-spike/out.pdf - | grep -o "第[0-9]*页/共[0-9]*页"; done
```

**对仓库的影响**：本次未改动任何产品代码（`src/`、`electron/main.cjs` 均未触碰），
仓库内只新增本报告；`spike.cjs` / `test-doc.html` / `out.pdf` 均在 `/tmp/p1-spike/`，不入库。
