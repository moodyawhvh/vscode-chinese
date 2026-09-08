<div align="center">

# vscode 中文文档

[![原项目](https://img.shields.io/badge/原项目-microsoft--vscode-blue?style=flat-square&logo=github)](https://github.com/microsoft/vscode)
[![中文简介](https://img.shields.io/badge/中文简介-README.md-orange?style=flat-square)](README.md)
[![GitHub Stars](https://img.shields.io/github/stars/microsoft/vscode?style=flat-square&label=原项目Stars)](https://github.com/microsoft/vscode/stargazers)
[![微信联系](https://img.shields.io/badge/微信-uaycar-brightgreen?style=flat-square&logo=wechat)](#)

</div>

---

> 本文件是 [microsoft/vscode](https://github.com/microsoft/vscode) 官方 README 的中文翻译版本,内容以原项目为准。
> 完整源代码请访问原项目:https://github.com/microsoft/vscode

**代部署 / 定制服务 / 技术咨询 请添加微信:uaycar**

---

# Visual Studio Code - 开源版("Code - OSS")

[![Feature Requests](https://img.shields.io/github/issues/microsoft/vscode/feature-request.svg)](https://github.com/microsoft/vscode/issues?q=is%3Aopen+is%3Aissue+label%3Afeature-request+sort%3Areactions-%2B1-desc)
[![Bugs](https://img.shields.io/github/issues/microsoft/vscode/bug.svg)](https://github.com/microsoft/vscode/issues?q=is%3Aissue+is%3Aopen+label%3Abug)

## 关于本仓库

本仓库("`Code - OSS`")是微软与社区共同开发 [Visual Studio Code](https://code.visualstudio.com) 产品的地方。我们不仅在这里处理代码和 issue,还会发布[路线图](https://github.com/microsoft/vscode/wiki/Roadmap)、[月度迭代计划](https://github.com/microsoft/vscode/wiki/Iteration-Plans)以及[endgame 计划](https://github.com/microsoft/vscode/wiki/Running-the-Endgame)。源代码在标准 [MIT 许可证](https://github.com/microsoft/vscode/blob/main/LICENSE.txt)下向所有人开放。

## Visual Studio Code 简介

<p align="center">
  <img alt="VS Code in action" src="https://github.com/user-attachments/assets/56af271c-949d-454c-a3ea-16188c063414">
</p>

[Visual Studio Code](https://code.visualstudio.com) 是 `Code - OSS` 仓库的一个发行版,包含微软专属定制,并以传统的[微软产品许可证](https://code.visualstudio.com/License/)发布。

[Visual Studio Code](https://code.visualstudio.com) 将代码编辑器的简洁性与开发者核心"编辑—构建—调试"循环所需的能力结合在一起:提供完善的代码编辑、导航与理解支持,轻量级调试,丰富的扩展模型,以及与现有工具的轻量集成。

Visual Studio Code 每月更新,持续带来新功能与缺陷修复。你可以在 [Visual Studio Code 官网](https://code.visualstudio.com/Download)下载 Windows、macOS 和 Linux 版本;想每天获取最新版本,可以安装 [Insiders 版](https://code.visualstudio.com/insiders)。

## 参与贡献

你可以通过多种方式参与本项目,例如:

* [提交缺陷与功能请求](https://github.com/microsoft/vscode/issues),并帮助我们在修复合入时进行验证
* 审查[源代码变更](https://github.com/microsoft/vscode/pulls)
* 审阅[文档](https://github.com/microsoft/vscode-docs),从错别字到新内容都欢迎提交 pull request

如果你有兴趣修复问题并直接向代码库贡献,请阅读 [How to Contribute](https://github.com/microsoft/vscode/wiki/How-to-Contribute) 文档,其中涵盖:

* [如何从源码构建并运行](https://github.com/microsoft/vscode/wiki/How-to-Contribute)
* [开发工作流,包括调试与运行测试](https://github.com/microsoft/vscode/wiki/How-to-Contribute#debugging)
* [编码规范](https://github.com/microsoft/vscode/wiki/Coding-Guidelines)
* [提交 pull request](https://github.com/microsoft/vscode/wiki/How-to-Contribute#pull-requests)
* [寻找可以认领的 issue](https://github.com/microsoft/vscode/wiki/How-to-Contribute#where-to-contribute)
* [参与翻译贡献](https://aka.ms/vscodeloc)

## 反馈

* 在 [Stack Overflow](https://stackoverflow.com/questions/tagged/vscode) 上提问
* [请求新功能](https://github.com/microsoft/vscode/blob/main/CONTRIBUTING.md)
* 为[热门功能请求](https://github.com/microsoft/vscode/issues?q=is%3Aopen+is%3Aissue+label%3Afeature-request+sort%3Areactions-%2B1-desc)点赞
* [提交 issue](https://github.com/microsoft/vscode/issues)
* 在 [GitHub Discussions](https://github.com/microsoft/vscode-discussions/discussions) 或 [Slack](https://aka.ms/vscode-dev-community) 上与扩展作者社区交流
* 关注 [@code](https://x.com/code),告诉我们你的想法!

各渠道的详细说明以及其他社区驱动渠道,请参阅我们的 [wiki](https://github.com/microsoft/vscode/wiki/Feedback-Channels)。

## 相关项目

VS Code 的许多核心组件与扩展都存放在 GitHub 上各自的仓库中。例如,[node 调试适配器](https://github.com/microsoft/vscode-node-debug)与 [mono 调试适配器](https://github.com/microsoft/vscode-mono-debug)就是彼此独立的仓库。完整清单请访问 wiki 上的 [Related Projects](https://github.com/microsoft/vscode/wiki/Related-Projects) 页面。

## 内置扩展

VS Code 在 [extensions](https://github.com/microsoft/vscode/tree/main/extensions) 文件夹中附带了一组内置扩展,包括众多语言的语法与代码片段支持。为某种语言提供富语言支持(内联建议、跳转到定义等)的扩展以 `language-features` 为后缀。例如,`json` 扩展为 `JSON` 提供着色,而 `json-language-features` 扩展为 `JSON` 提供富语言支持。

## 开发容器

本仓库包含 Visual Studio Code Dev Containers / GitHub Codespaces 开发容器。

* 对于 [Dev Containers](https://aka.ms/vscode-remote/download/containers),使用 **Dev Containers: Clone Repository in Container Volume...** 命令,它会在 Docker 卷中克隆源码,在 macOS 与 Windows 上获得更好的磁盘 I/O 性能。
  * 如果你已安装 VS Code 与 Docker,也可以[点击这里](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/microsoft/vscode)快速开始:VS Code 会自动安装 Dev Containers 扩展(如需要),把源码克隆到容器卷中,并启动开发容器。

* 对于 Codespaces,在 VS Code 中安装 [GitHub Codespaces](https://marketplace.visualstudio.com/items?itemName=GitHub.codespaces) 扩展,然后使用 **Codespaces: Create New Codespace** 命令。

Docker / Codespace 至少需要 **4 核 CPU 与 6 GB 内存(推荐 8 GB)** 才能完成完整构建。更多信息请参阅[开发容器 README](https://github.com/microsoft/vscode/blob/main/.devcontainer/README.md)。

## 行为准则

本项目采用[微软开源行为准则](https://opensource.microsoft.com/codeofconduct/)。更多信息请参阅[行为准则 FAQ](https://opensource.microsoft.com/codeofconduct/faq/),如有其他问题或意见,请联系 [opencode@microsoft.com](mailto:opencode@microsoft.com)。

## 许可证

Copyright (c) Microsoft Corporation. 保留所有权利。

基于 [MIT](https://github.com/microsoft/vscode/blob/main/LICENSE.txt) 许可证授权。

---

**代部署 / 定制服务 / 技术咨询 请添加微信:uaycar**

本项目为 [microsoft/vscode](https://github.com/microsoft/vscode) 的中文翻译版本,所有代码版权归原项目作者(Microsoft Corporation)所有,遵循其原始 MIT 许可证。

**如果觉得有用,请给原项目点个 Star!** ⭐
