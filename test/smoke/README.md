# VS Code 冒烟测试

> 🌐 本文档由 [microsoft/vscode](https://github.com/microsoft/vscode) 翻译,英文原版见原项目。

请确保你使用的是 **Node v12.x**。

## 快速概览

```bash
# 构建 VS Code 仓库中的扩展(如有需要)
npm i && npm run compile

# 开发版(Electron)
npm run smoketest

# 开发版(Web - 必须在发行版上运行)
npm run smoketest -- --web --browser [chromium|webkit]

# 构建版(Electron)
npm run smoketest -- --build <最新版本路径>
示例: npm run smoketest -- --build /Applications/Visual\ Studio\ Code\ -\ Insiders.app

# 构建版(Web - 阅读下文说明)
npm run smoketest -- --build <server web 构建路径(以 -web 结尾)> --web --browser [chromium|webkit]

# 远程(Electron)
npm run smoketest -- --build <最新版本路径> --remote
```

\* 只有在不带 `--build` 运行、且 `.build/electron` 目录中尚不存在 OSS 构建时,才需要此步骤。

### 发布流程运行(Endgame)

你必须始终运行与被测发布版本相匹配的冒烟测试版本。因此,如果你想针对某个发布构建(例如 `release/1.22`)运行冒烟测试,也需要检出该版本的冒烟测试代码:

```bash
git fetch
git checkout release/1.22
npm i && npm run compile
cd test/smoke
npm i
```

#### Web

目前尚不支持用旧版本测试新版本。
替代做法是,把 `--build` 命令行参数配置为解压后的 server web 构建文件夹的绝对路径(例如 macOS 上为 `<其余路径>/vscode-server-darwin-x64-web`)。server web 构建可以从构建页面获取(见上一小节)。

**macOS**:如果你下载了带 web 组件的 server,解压前请务必运行以下命令,以避免启动时的安全问题:

```bash
xattr -d com.apple.quarantine <带 web 文件夹的 server zip 路径>
```

**注意**:请确保指向的是包含客户端组件的 server!

### 调试

- `--verbose` 记录所有对 Code 的底层驱动调用;
- `-f PATTERN`(别名 `-g PATTERN`)过滤要运行的测试。几乎所有 mocha 参数都可以使用;
- `--headless` 在使用 `--web` 时以无头模式运行 playwright。

**注意**:运行测试前设置 `DEBUG` 环境变量(例如设为 `pw:browser`),可以开启 playwright 库的详细日志输出(<https://playwright.dev/docs/debug#verbose-api-logs>)。

### 开发

```bash
cd test/smoke
npm run watch
```

## 故障排查

### 错误:Could not get a unique tmp filename, max tries reached

在 Windows 上,请检查 `C:\Users\<用户名>\AppData\Local\Temp\t` 文件夹。如果该文件夹存在,`tmp` 模块将无法正常运行,从而导致上述错误。此时删除 `t` 文件夹即可。

## 常见陷阱

- 当心工作台(workbench)**状态**。同一套件内的测试会共享相同的状态。

- 当心**单例**。这种"邪恶"会以文件系统路径、TCP 端口、IPC 句柄的形式显现。无论何时编写测试,或搭建更多冒烟测试架构,都要确保它能与任何其他测试、甚至与它自身并行运行。所有测试套件都应当能多次并行运行。

- 当心**焦点**。**绝不**要依赖 `.focused` 类或 `:focus` 伪类来判断 DOM 元素是否持有焦点,因为一旦有其他窗口覆盖在正在运行的 VS Code 窗口之上,它们就会失去该状态。一种安全的替代方案是使用 `waitForActiveElement` API。许多测试在需要等待特定元素_获得焦点_时都会使用它。

- 当心**时机**。你需要读取或写入 DOM……但现在真的是做这件事的正确时机吗?你能 100% 保证那一刻 `input` 输入框已经可见吗?还是只是希望如此?在 UI 测试中,侥幸心理是你最大的敌人。举例:触发了 `F1` 打开快速访问,并不代表它已经打开、可以直接开始输入;你必须先等待输入元素出现在 DOM 中,并且成为当前的活动元素。

- 当心**等待**。**绝不**要等待超过几秒钟的时间,除非有充分理由。把测试想象成一个使用 Code 的人类:人类会花 10 分钟跑完搜索视图的冒烟测试吗?不会,那计算机更应该更快。**不要**无缘无故使用 `setTimeout`。想清楚你在等 DOM 中的什么准备就绪,然后等待那个条件。
