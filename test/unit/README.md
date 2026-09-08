# 单元测试

> 🌐 本文档由 [microsoft/vscode](https://github.com/microsoft/vscode) 翻译,英文原版见原项目。

## 运行(在 Electron 内)

    ./scripts/test.[sh|bat]

所有单元测试都在 Electron 渲染进程环境中运行,可同时访问 DOM 和 Node.js API。这与 VS Code 本体发布时的运行环境最接近。注意:

- 使用 `--dev` 可以打开带开发者工具的 Electron 窗口,便于调试
- 只运行一部分测试时,使用 `--run` 或 `--glob` 选项
- 使用 `npm run watch` 自动编译改动

例如,`./scripts/test.sh --debug --glob **/extHost*.test.js` 会运行来自 `extHost` 文件的所有测试,并支持调试。

## 运行(在浏览器内)

    npm run test-browser -- --browser webkit --browser chromium

`common` 层和 `browser` 层的单元测试会在 `chromium`、`webkit` 以及(不久后的)`firefox` 中运行(基于 playwright)。它补充了基于 Electron 的单元测试运行器,覆盖更多受支持平台。注意:

- 这些测试是持续构建的一部分,也就是说你可能遇到只在 _windows_ 上的 webkit 或 linux 上的 _chromium_ 中出现的测试失败
- 你可以在本地运行这些测试:`npm run test-browser -- --browser chromium --browser webkit`
- 调试时,在浏览器中打开 `<vscode>/test/unit/browser/renderer.html`,并通过 `?m=<amd_module>` 查询参数指定要加载的 AMD 模块,例如 `file:///Users/jrieken/Code/vscode/test/unit/browser/renderer.html?m=vs/base/test/common/strings.test` 会运行 `strings.test.ts` 中的所有测试
- 只运行一部分测试时,使用 `--run` 或 `--glob` 选项

**注意**:运行测试前设置 `DEBUG` 环境变量,可以开启 playwright 库的详细日志输出(https://playwright.dev/docs/debug#verbose-api-logs)

## 运行(在 Node 中)

    npm run test-node -- --run src/vs/editor/test/browser/controller/cursor.test.ts

## 覆盖率

以下命令会在工作区根目录的 `.build` 文件夹中创建 `coverage` 文件夹:

### OS X 与 Linux

    ./scripts/test.sh --coverage

### Windows

    scripts\test --coverage
