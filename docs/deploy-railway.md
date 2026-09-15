# 部署到 Railway（自动部署）

把 `server/` 和 `web/` 分别部署成 Railway 里的两个服务，接到这个 GitHub 仓库后，
以后每次 push 到 `main`（或你选的分支）Railway 会自动重新构建部署，不需要手动操作。

这一步需要你自己有 Railway 账号并授权它访问这个 GitHub 仓库——这部分只有你能在浏览器里点，
我这边没有你的账号权限，下面是完整步骤，照着做就行。

## 1. 创建 Railway 项目并连上仓库

1. 打开 https://railway.app ，用 GitHub 账号登录（还没有账号的话直接用 GitHub 登录注册）。
2. New Project → **Deploy from GitHub repo** → 选 `zuojingbin/newopen`
   （如果列表里没有，先点 Configure GitHub App，把这个仓库加到 Railway 有权限访问的仓库列表）。
3. Railway 会先建一个服务，默认把整个仓库根目录当项目——这个仓库是四个子项目的 monorepo，
   接下来要把这个服务的 Root Directory 改成 `server`，再新建一个服务把 Root Directory 设成 `web`。

## 2. 配置 `server` 服务

在这个服务的 Settings 里：

- **Root Directory**：`server`
- **Build/Start**：不用改，仓库里已经带了 `server/railway.json`，Railway 会自动用
  `npm run build` 构建、`npm start` 启动，并且把 `/api/health` 设为健康检查路径。
- **Variables**（环境变量）加一个：`DATA_DIR` = `/data`
- **Volumes**：Settings → Volumes → New Volume，Mount Path 填 `/data`。
  这一步必须做——`server` 用 SQLite + 本地文件存上传的图片/PDF，
  不挂 Volume 的话每次重新部署数据都会丢。
- **Networking**：Settings → Networking → Generate Domain，拿到一个
  `https://xxx.up.railway.app` 形式的公网地址，记下来，下一步网页版要用。

## 3. 配置 `web` 服务

- **Root Directory**：`web`
- **Build/Start**：同样不用改，`web/railway.json` 已经配好 `npm run build` + `npm start`
  （`npm start` 用 `serve` 把构建产物托管出来）。
- **Variables** 加一个：`VITE_API_BASE_URL` = 上一步拿到的 `server` 公网地址
  （不要带结尾斜杠，例如 `https://your-server.up.railway.app`）。
  这个变量是构建时打进静态文件里的，所以打开网页时会自动连到后端，不用再手动去"设置"里填一遍；
  用户仍然可以在"设置"里改成别的地址。
- **Networking**：同样 Generate Domain，拿到网页版的公网地址，手机/电脑打开这个地址即可使用。

## 4. 验证

两个服务第一次部署完（Railway 控制台能看到 Deploy 成功、状态是绿色）之后：

- 浏览器打开 `web` 的域名，应该能看到批次码自动生成（说明已经连上 `server`，不用手动填服务器地址了）。
- 试着导入一张图、点"生成打印 PDF"，能正常出结果就说明两边都通了。

## 5. 之后的自动部署

不需要额外配置——Railway 默认对接了 GitHub，只要 push 到你连的那个分支
（一般是 `main`，也可以在服务的 Settings → Source 里改成 `claude/wechat-file-printer-mgyh2y` 或其它分支），
Railway 就会自动拉最新代码重新构建、重新部署这两个服务。

## 后续要接微信小程序 / printer-agent

- 拿到 `server` 的公网 HTTPS 地址后，去微信公众平台把这个域名加到"request 合法域名"和
  "uploadFile 合法域名"（见 `../miniprogram/README.md`）。
- `printer-agent` 的 `SERVER_URL` 也填这个 `server` 公网地址（见 `../printer-agent/README.md`）。

## 费用提醒

Railway 免费额度有限（按用量计费，新账号一般带几美元/月的免费额度），`server` 常驻运行 + 挂了
Volume 之后，用量超出免费额度会产生费用，具体以 Railway 官网当前计费规则为准，部署前建议看一眼
https://railway.app/pricing 。
