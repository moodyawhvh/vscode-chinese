# 发布新版 monaco-editor-core 的步骤

> 🌐 本文档由 [microsoft/vscode](https://github.com/microsoft/vscode) 翻译,英文原版见原项目。

## 生成 monaco.d.ts

* 现在运行 `gulp watch` 时会自动生成 `monaco.d.ts`

## 升级版本号

* 递增 `build/monaco/package.json` 中的版本号

## 生成 monaco-editor-core 的 npm 内容

* 确保所有更改已提交**并推送到远端**
* (生成的文件包含 HEAD 的 sha,该提交必须存在于远端)
* 运行 gulp editor-distro

## 发布

* `cd out-monaco-editor-core`
* `npm publish`
