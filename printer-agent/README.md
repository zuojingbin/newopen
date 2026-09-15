# printer-agent（远程打印代理）

跨网络打印（比如手机/电脑在教室外，打印机在家里的局域网内）无法让手机直接连上那台打印机，
需要一个"中转"：`printer-agent` 是一个跑在**打印机所在局域网**内任意一台常开机器上
（旧电脑、树莓派、NAS 都可以）的小程序。它做三件事：

1. 向后端 `server` 注册自己，换取一个长期 token（对应后端 `printers` 表里的一条 `remote` 打印机）；
2. 每隔一段时间（默认 20s）向 `server` 轮询"有没有分给我的打印任务";
3. 有任务就下载排好版的 PDF，通过 IPP 协议直接打印到**本机局域网内**配置好的打印机，再回报结果。

打印机本身不需要暴露到公网，只有这台运行 agent 的机器需要能访问 `server`（公网地址）。

## 使用方法

```bash
npm install
cp .env.example .env   # 按需修改
npm run dev             # 开发模式；或 npm run build && npm start 跑编译产物
```

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `SERVER_URL` | 是 | 后端地址，例如 `https://printer.example.com` |
| `PRINTER_URI` | 是 | 本机局域网内打印机的 IPP 地址，例如 `ipp://192.168.1.50:631/ipp/print`（大多数支持 AirPrint/网络打印的打印机都能用；用 `lpinfo -v` 或路由器管理页可以查到打印机 IP） |
| `AGENT_NAME` | 否 | 显示名称，默认取主机名 |
| `POLL_INTERVAL_MS` | 否 | 轮询间隔，默认 20000 |
| `AGENT_CONFIG_PATH` | 否 | 注册凭证保存位置，默认 `./agent-config.json`，删除该文件可重新注册 |

首次启动会自动向 `SERVER_URL` 注册并把凭证写入 `agent-config.json`；之后的启动会复用这份凭证，
在 Web 端"打印机列表"里就能看到这台远程打印机（在线状态由最近一次轮询时间判断）。

建议用 `pm2` / `systemd` 常驻运行，保证 agent 一直在线才能收到打印任务。
