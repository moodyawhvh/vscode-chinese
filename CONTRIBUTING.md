# 为 VS Code 做贡献

欢迎,感谢你对参与 VS Code 贡献感兴趣!

除了编写代码之外,你还可以通过多种方式做出贡献。本文档的目标是提供一份参与贡献的高层次概览。

> 🌐 本文档由 [microsoft/vscode](https://github.com/microsoft/vscode) 翻译,英文原版见原项目。

## 提问

有问题?请不要直接开 issue,而是带上 `visual-studio-code` 标签到 [Stack Overflow](https://stackoverflow.com/questions/tagged/visual-studio-code) 上提问。

活跃的社区会很乐意帮助你。一个表述清晰的问题,也会成为后来者寻求帮助时的宝贵资源。

## 提供反馈

我们欢迎你的评论与反馈,开发团队也会通过多个不同渠道保持在线。

有关分享意见的具体方式,请参阅 [反馈渠道](https://github.com/microsoft/vscode/wiki/Feedback-Channels) wiki 页面。

## 报告问题

你在 VS Code 中发现了一个可复现的问题?或者你有一项功能请求?我们想听听!以下是让你的 issue 尽可能高效提交的方法。

### 确定报告位置

VS Code 项目分散在多个仓库中。请尽量把 issue 提交到正确的仓库。如果不确定哪个仓库才对,请查看[相关项目列表](https://github.com/microsoft/vscode/wiki/Related-Projects)。

在[禁用所有扩展](https://code.visualstudio.com/docs/editor/extension-gallery#_disable-an-extension)之后,问题还能复现吗?如果确认问题由你安装的某个扩展导致,请直接到该扩展的仓库提交 issue。

### 查找已有 issue

创建新 issue 之前,请先在[开放 issue](https://github.com/microsoft/vscode/issues) 中搜索,看看该问题或功能请求是否已被提交过。

请务必浏览[最受欢迎的](https://github.com/microsoft/vscode/issues?q=is%3Aopen+is%3Aissue+label%3Afeature-request+sort%3Areactions-%2B1-desc)功能请求列表。

如果你发现 issue 已经存在,请补充相关评论并添加你的 [reaction](https://github.com/blog/2119-add-reactions-to-pull-requests-issues-and-comments)。用 reaction 代替 "+1" 式的评论:

* 👍 - 支持
* 👎 - 反对

如果找不到能描述你的 bug 或功能需求的已有 issue,请按照下面的指引创建新 issue。

### 撰写高质量的 Bug 报告与功能请求

每个问题、每条功能请求只提交一个 issue。不要在同一个 issue 里罗列多个 bug 或功能请求。

除非是完全相同的问题,否则不要把你的 issue 作为评论追加到已有 issue 上。很多 issue 看似相似,成因却各不相同。

你提供的信息越多,别人成功复现问题并找到修复方案的可能性就越大。

VS Code 内置的问题报告工具(可通过帮助菜单中的 `Report Issue` 打开)能自动附带 VS Code 版本、已安装扩展列表和系统信息,帮你简化流程。此外,该工具还会在已有 issue 中搜索是否存在类似问题。

提交每个 issue 时请附带以下信息:

* VS Code 版本号
* 操作系统
* 已安装扩展的列表
* 能触发问题的可复现步骤(1... 2... 3...)
* 你期望的结果与实际看到的结果
* 展示问题发生的截图、动图或视频链接
* 能演示问题的代码片段,或一个开发者可以轻松拉取并在本地复现问题的代码仓库链接
  * **注意:** 开发者需要复制粘贴代码片段,所以把代码放在媒体文件里(如 .gif)是不够的。
* Dev Tools 控制台的报错信息(从菜单打开:帮助 > 切换开发人员工具)

### 创建 Pull Request

* 请参阅关于[创建 pull request](https://github.com/microsoft/vscode/wiki/How-to-Contribute#pull-requests) 以及为本项目做贡献的文章。

### 提交前最终检查

请记得完成以下事项:

* [ ] 在 issue 仓库中搜索,确认你的报告是新问题
* [ ] 在禁用所有扩展后复现该问题
* [ ] 精简问题周边的代码,更好地隔离问题

如果开发者没能立刻复现问题,也别灰心。他们只会向你请求更多信息!

### 跟进你的 issue

提交之后,你的报告将进入 [issue 跟踪](https://github.com/microsoft/vscode/wiki/Issue-Tracking)流程。请了解接下来会发生什么,这样你才知道该期待什么,以及在整个过程中如何继续提供协助。

## 自动化 issue 管理

我们使用 GitHub Actions 来协助管理 issue。这些 Action 及其说明可以[在这里查看](https://github.com/microsoft/vscode-github-triage-actions)。它们的部分功能举例:

* 自动关闭任何被标记为 `info-needed` 且过去 7 天内没有回应的 issue。
* 在 issue 关闭 45 天后自动锁定。
* 自动执行 VS Code 的[功能请求流水线](https://github.com/microsoft/vscode/wiki/Issues-Triaging#managing-feature-requests)。

如果你认为机器人处理有误,请开一个新 issue 告诉我们。

## 贡献修复

如果你有兴趣编写代码修复问题,请参阅 wiki 中的 [如何贡献](https://github.com/microsoft/vscode/wiki/How-to-Contribute)。

## 致谢

你对开源大大小小的贡献,成就了像这样伟大的项目。感谢你抽出时间参与贡献。
