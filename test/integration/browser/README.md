# 集成测试

> 🌐 本文档由 [microsoft/vscode](https://github.com/microsoft/vscode) 翻译,英文原版见原项目。

## 编译

请确保先运行以下命令完成编译并安装依赖:

    cd test/integration/browser
    npm i
    npm run compile

## 运行(在 Electron 内)

    scripts/test-integration.[sh|bat]

所有集成测试都在一个 Electron 实例中运行。你可以通过设置环境变量 `INTEGRATION_TEST_ELECTRON_PATH` 和 `VSCODE_REMOTE_SERVER_PATH`(如果希望包含远程测试),指定针对真实构建产物运行测试。

## 运行(在浏览器内)

    scripts/test-web-integration.[sh|bat] --browser [chromium|webkit] [--debug]

所有集成测试都会在命令行参数指定的浏览器实例中运行。

加上 `--debug` 标志可以看到一个浏览器窗口,实时展示测试运行过程。

**注意**:运行测试前设置 `DEBUG` 环境变量,可以开启 playwright 库的详细日志输出(<https://playwright.dev/docs/debug#verbose-api-logs>)

## 调试

所有集成测试(无论 Electron 还是 Web)都可以直接在 VS Code 内运行和调试:只需选择对应的启动配置并运行即可。
