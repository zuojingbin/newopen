# server（后端服务）

Node.js + TypeScript + Express，是整个系统的核心：接收网页版/小程序上传的图片和 PDF、
自动排版排序、把标记为 A3 的页面拆成两页 A4、扫描局域网打印机并通过 IPP 直接打印，
以及给跨网络的 `printer-agent` 提供任务队列。数据存 SQLite（`better-sqlite3`），文件存本地磁盘，
不依赖任何外部数据库/云服务，部署一台能常驻运行 Node 的机器（云主机、NAS、树莓派都行）即可。

## 开发

```bash
npm install
npm run dev      # tsx watch，默认监听 4000 端口
npm test         # vitest：自然排序、A3 尺寸识别的单元测试
npm run build && npm start   # 编译后用 node 运行
```

环境变量（都可选）：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `4000` | 监听端口 |
| `DATA_DIR` | `server/data` | SQLite 数据库、上传文件、生成的打印 PDF 存放目录 |

## 核心数据模型

- **batch（批次）**：一次"导入 → 排版 → 打印"的会话，有一个 6 位短码（如 `V27XGZ`），
  网页版和小程序都用这个码把上传的文件归到同一批。
- **files**：批次里的每张图片/每份 PDF，记录顺序（`order_index`）和是否标记 A3。
- **printers**：`kind='lan'` 是直接填 IPP 地址的局域网打印机；`kind='remote'` 是通过
  `printer-agent` 注册、由 agent 代为打印的远程打印机。
- **print_jobs**：一次打印请求；`lan` 打印机同步发送，`remote` 打印机异步排队等 agent 轮询。

## 主要 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/batches` | 新建批次，返回短码 |
| POST | `/api/batches/:code/upload` | 上传文件（multipart，字段名 `files`，可多选） |
| GET | `/api/batches/:code` | 批次详情 + 文件列表（含顺序、A3 标记） |
| POST | `/api/batches/:code/auto-order` | 按文件名自然排序（兼容"2.jpg"/"10.jpg"/"第2页"） |
| PATCH | `/api/batches/:code/order` | 保存手动拖拽后的顺序 |
| PATCH | `/api/batches/:code/files/:id` | 手动标记/取消该页为 A3 |
| POST | `/api/batches/:code/layout` | 生成排好版的打印 PDF（A3 自动拆两页 A4） |
| GET | `/api/batches/:code/print.pdf` | 下载/预览生成的 PDF |
| GET | `/api/printers/lan/scan` | mDNS 扫描局域网 IPP 打印机 |
| POST/GET/DELETE | `/api/printers` | 保存/查看/删除打印机 |
| POST | `/api/print` | 发起打印（局域网直接发送，远程打印机进队列） |
| POST/GET | `/api/agent/*` | `printer-agent` 用的注册/轮询/上报接口 |

## A3 拆 A4 的判定逻辑

- PDF 页面：用 `pdf-lib` 读到的真实页面尺寸（pt）与标准 A3/A4 尺寸比对（6% 容差，兼容扫描/打印的少量误差），
  这个判定是可靠的，因为 PDF 页面尺寸是精确的物理量。
- 图片（照片/扫描件）：没有物理尺寸信息，只能按长宽比是否接近 A 系列比例（√2）且长边像素数
  足够大做启发式默认猜测，网页版每张图都能手动纠正——这是唯一可靠的兜底方式，见 `src/services/paperSize.ts` 里的说明。
- 命中 A3 后统一按"对开"规则拆分：横放 A3 从中线左右切成两张 A4；竖放 A3 从中线上下切成两张 A4。
  PDF 页面用 `pdf-lib` 的 `embedPage` 按 bounding box 裁剪（矢量级，不失真、不需要栅格化）；
  图片用 `sharp` 按像素裁剪后各自嵌入一页 A4。

## 部署要点

- 生产环境请放在反向代理（Nginx/Caddy）后面并开 HTTPS——微信小程序线上版本只允许请求 HTTPS 域名。
- `server` 需要能直接访问打印机所在的局域网才能做 IPP 扫描/直连打印；如果 `server` 本身部署在云端、
  和打印机不在同一局域网，局域网打印机这条路径就用不了，只能靠 `printer-agent`（见 `../printer-agent`）。
