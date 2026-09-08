/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import * as fs from 'node:fs';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import type { IProductConfiguration } from './vs/base/common/product.js';

// 【中文注】本文件是 VS Code 的 Node.js 引导(bootstrap)模块:
// 在任何主进程/共享进程/扩展宿主等 Node 环境代码运行之前执行,
// 负责环境准备:工作目录、SIGPIPE 处理、ASAR 模块解析、
// 开发模式模块查找路径注入、便携模式配置等。

const require = createRequire(import.meta.url);
const isWindows = process.platform === 'win32';

// 【中文注】避免 64 KiB 的缓冲池后备存储跨越 Mojo 的共享内存阈值,
// 在 Linux 上缩小 Buffer 池(64KiB 以上会触发共享内存通道,带来额外开销)。
// Avoid 64 KiB pooled backing stores crossing Mojo's shared-memory threshold.
if (process.platform === 'linux') {
	Buffer.poolSize = 8 * 1024;
}

// 【中文注】增大调用栈帧数上限(默认 10),便于排查深层调用栈问题。
// increase number of stack frames(from 10, https://github.com/v8/v8/wiki/Stack-Trace-API)
Error.stackTraceLimit = 100;

if (!process.env['VSCODE_HANDLES_SIGPIPE']) {
	// 【中文注】SIGPIPE 处理:Electron 默认没有安装忽略 SIGPIPE 的处理器,
	// 管道破裂(如输出重定向到已关闭的管道)会导致进程被杀,这里手动兜底。
	// Workaround for Electron not installing a handler to ignore SIGPIPE
	// (https://github.com/electron/electron/issues/13254)
	let didLogAboutSIGPIPE = false;
	process.on('SIGPIPE', () => {
		// 【中文注】参考 https://github.com/microsoft/vscode-remote-release/issues/6543:
		// 某些情况下控制台本身就处于 broken pipe 状态,
		// 此时再向控制台打印 SIGPIPE 会造成无限的异步循环,因此只报错一次。
		// See https://github.com/microsoft/vscode-remote-release/issues/6543
		// In certain situations, the console itself can be in a broken pipe state
		// so logging SIGPIPE to the console will cause an infinite async loop
		if (!didLogAboutSIGPIPE) {
			didLogAboutSIGPIPE = true;
			console.error(new Error(`Unexpected SIGPIPE`));
		}
	});
}

// 【中文注】为所有 Node 与 Electron 进程设置当前工作目录:
// - Windows:调用 `process.chdir()` 把应用所在文件夹设为 cwd
// - 所有系统:把 `process.cwd()` 存入 `VSCODE_CWD`,保证后续查找行为一致
// Setup current working directory in all our node & electron processes
// - Windows: call `process.chdir()` to always set application folder as cwd
// -  all OS: store the `process.cwd()` inside `VSCODE_CWD` for consistent lookups
function setupCurrentWorkingDirectory(): void {
	try {

		// 【中文注】把当前工作目录存入环境变量 `VSCODE_CWD`,
		// 便于后续一致地查找;仅设置一次,避免覆盖父进程已定义的值。
		// Store the `process.cwd()` inside `VSCODE_CWD`
		// for consistent lookups, but make sure to only
		// do this once unless defined already from e.g.
		// a parent process.
		if (typeof process.env['VSCODE_CWD'] !== 'string') {
			process.env['VSCODE_CWD'] = process.cwd();
		}

		// Windows: always set application folder as current working dir
		if (process.platform === 'win32') {
			process.chdir(path.dirname(process.execPath));
		}
	} catch (err) {
		console.error(err);
	}
}

setupCurrentWorkingDirectory();

/**
 * 【中文注】为 Node 的 CommonJS 模块解析增加 ASAR 支持。
 *
 * 生产构建会把 `node_modules` 打包为 `node_modules.asar` 归档,
 * 与(如今基本为空的)`node_modules` 文件夹并排放置。
 * Node 自身不会查找 `.asar` 归档,因此这里在真实的
 * `node_modules` 目录之前插入归档查找路径。
 *
 * 归档保持与 `node_modules` 相同的顶层布局
 * (`node_modules.asar/<module>`),所以 `require('<module>')`
 * 的解析结果与引入 ASAR 之前完全一致,依赖
 * `${appRoot}/node_modules.asar/<module>` 的扩展与工具链继续可用。
 *
 * 注意:仅对 Electron 上运行的打包应用生效
 * (包括 `ELECTRON_RUN_AS_NODE` 子进程),从源码运行时永不生效。
 *
 * Add ASAR support to Node's CommonJS module resolution.
 *
 * Production builds bundle our `node_modules` into a `node_modules.asar`
 * archive that sits next to the (now mostly empty) `node_modules` folder.
 * Node does not look into `.asar` archives on its own, so we splice the
 * archive into the lookup paths right before the real `node_modules` folder.
 *
 * The archive keeps the same top-level layout as `node_modules`
 * (`node_modules.asar/<module>`), so bare `require('<module>')` calls resolve
 * exactly like they did before ASAR was introduced. This keeps extensions and
 * tooling that reach into `${appRoot}/node_modules.asar/<module>` working.
 *
 * Note: only applies to the packaged app running on Electron (incl.
 * `ELECTRON_RUN_AS_NODE` forks), never when running out of sources.
 */
function enableASARSupport(): void {
	if (!process.env['ELECTRON_RUN_AS_NODE'] && !process.versions['electron']) {
		return; // only on Electron / Electron-as-node
	}

	if (process.env['VSCODE_DEV']) {
		return; // no ASAR when running out of sources
	}

	// 【中文注】把盘符统一转为小写再比较:Windows 上 `import.meta.dirname`
	// 推导出的路径盘符大小写可能与 Node 为 `require` 父模块计算的路径不一致,
	// 精确字符串比较会错过插入点(导致归档内模块的 `require('mkdirp')` 之类失败)。
	// Normalize the drive letter to lower-case for comparison. On Windows the
	// path derived from `import.meta.dirname` (a file URL) can use a different
	// drive-letter case than the paths Node computes for a `require` parent, so
	// an exact string comparison would miss the insertion point (breaking e.g.
	// `require('mkdirp')` from a module inside the archive).
	const normalizeDriveLetter = (p: string): string => {
		if (isWindows && p.length >= 2 && p.charCodeAt(1) === 58 /* : */) {
			const code = p.charCodeAt(0);
			if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
				return p[0].toLowerCase() + p.slice(1);
			}
		}
		return p;
	};

	const NODE_MODULES_PATH = normalizeDriveLetter(path.join(import.meta.dirname, '../node_modules'));

	const Module = require('node:module') as typeof import('node:module') & {
		_resolveLookupPaths: (request: string, parent: unknown) => string[] | null;
	};

	const originalResolveLookupPaths = Module._resolveLookupPaths;
	Module._resolveLookupPaths = function (request: string, parent: unknown): string[] | null {
		const paths = originalResolveLookupPaths(request, parent);
		if (Array.isArray(paths)) {
			for (let i = 0, len = paths.length; i < len; i++) {
				if (normalizeDriveLetter(paths[i]) === NODE_MODULES_PATH) {
					// Derive the archive path from the matched entry so drive-letter
					// case and path separators are preserved exactly.
					paths.splice(i, 0, `${paths[i]}.asar`);
					break;
				}
			}
		}

		return paths;
	};
}

enableASARSupport();

/**
 * 【中文注】重写 Node 模块查找路径逻辑,支持重定向 node 模块的加载位置。
 * 注意:仅在从源码运行(VSCODE_DEV)时生效。
 *
 * Add support for redirecting the loading of node modules
 *
 * Note: only applies when running out of sources.
 */
export function devInjectNodeModuleLookupPath(injectPath: string): void {
	if (!process.env['VSCODE_DEV']) {
		return; // 【中文注】仅从源码运行时生效
	}

	if (!injectPath) {
		throw new Error('Missing injectPath');
	}

	// 【中文注】注册一个模块加载器钩子,把注入路径加入解析范围
	// register a loader hook
	const Module = require('node:module');
	Module.register('./bootstrap-import.js', { parentURL: import.meta.url, data: injectPath });
}

// 【中文注】移除 Node.js 全局模块查找路径(globalPaths):
// 防止应用意外解析到用户全局安装的 node 模块,保证依赖封闭性。
export function removeGlobalNodeJsModuleLookupPaths(): void {
	if (typeof process?.versions?.electron === 'string') {
		return; // 【中文注】Electron 已自行禁用全局查找路径(见 electron 源码 node_bindings.cc)
	}

	const Module = require('module');
	const globalPaths = Module.globalPaths;

	const originalResolveLookupPaths = Module._resolveLookupPaths;

	Module._resolveLookupPaths = function (moduleName: string, parent: unknown): string[] {
		const paths = originalResolveLookupPaths(moduleName, parent);
		if (Array.isArray(paths)) {
			let commonSuffixLength = 0;
			while (commonSuffixLength < paths.length && paths[paths.length - 1 - commonSuffixLength] === globalPaths[globalPaths.length - 1 - commonSuffixLength]) {
				commonSuffixLength++;
			}

			return paths.slice(0, paths.length - commonSuffixLength);
		}

		return paths;
	};

	const originalNodeModulePaths = Module._nodeModulePaths;
	Module._nodeModulePaths = function (from: string): string[] {
		let paths: string[] = originalNodeModulePaths(from);
		if (!isWindows) {
			return paths;
		}

		// 【中文注】Windows 上从查找路径中移除盘符根目录和用户主目录,
		// 除非 `from` 本身就指向这些位置。
		// On Windows, remove drive(s) and users' home directory from search paths,
		// UNLESS 'from' is explicitly set to one of those.
		const isDrive = (p: string) => p.length >= 3 && p.endsWith(':\\');

		if (!isDrive(from)) {
			paths = paths.filter(p => !isDrive(path.dirname(p)));
		}

		if (process.env.HOMEDRIVE && process.env.HOMEPATH) {
			const userDir = path.dirname(path.join(process.env.HOMEDRIVE, process.env.HOMEPATH));

			const isUsersDir = (p: string) => path.relative(p, userDir).length === 0;

			// Check if 'from' is the same as 'userDir'
			if (!isUsersDir(from)) {
				paths = paths.filter(p => !isUsersDir(path.dirname(p)));
			}
		}

		return paths;
	};
}

/**
 * 【中文注】启用便携模式(portable mode)的辅助函数。
 * 便携模式把用户数据存放在应用旁边的 `data` 文件夹中,
 * 便于 U 盘/绿色版部署;返回数据路径与是否处于便携模式。
 *
 * Helper to enable portable mode.
 */
export function configurePortable(product: Partial<IProductConfiguration>): { portableDataPath: string; isPortable: boolean } {
	const appRoot = path.dirname(import.meta.dirname);

	// 【中文注】计算应用安装路径:不同平台/打包方式的目录层级不同
	function getApplicationPath(): string {
		if (process.env['VSCODE_DEV']) {
			return appRoot;
		}

		if (process.platform === 'darwin') {
			return path.dirname(path.dirname(path.dirname(appRoot)));
		}

		// appRoot = ..\Microsoft VS Code Insiders\<version>\resources\app
		if (process.platform === 'win32' && product.win32VersionedUpdate) {
			return path.dirname(path.dirname(path.dirname(appRoot)));
		}

		return path.dirname(path.dirname(appRoot));
	}

	// 【中文注】计算便携数据目录:优先取环境变量 `VSCODE_PORTABLE`;
	// Windows/Linux 放在应用目录下的 `data`,macOS 放在应用包旁边的专用文件夹
	function getPortableDataPath(): string {
		if (process.env['VSCODE_PORTABLE']) {
			return process.env['VSCODE_PORTABLE'];
		}

		if (process.platform === 'win32' || process.platform === 'linux') {
			return path.join(getApplicationPath(), 'data');
		}

		const portableDataName = product.portable || `${product.applicationName}-portable-data`;
		return path.join(path.dirname(getApplicationPath()), portableDataName);
	}

	const portableDataPath = getPortableDataPath();
	const isPortable = !('target' in product) && fs.existsSync(portableDataPath);
	const portableTempPath = path.join(portableDataPath, 'tmp');
	const isTempPortable = isPortable && fs.existsSync(portableTempPath);

	if (isPortable) {
		process.env['VSCODE_PORTABLE'] = portableDataPath;
	} else {
		delete process.env['VSCODE_PORTABLE'];
	}

	if (isTempPortable) {
		if (process.platform === 'win32') {
			process.env['TMP'] = portableTempPath;
			process.env['TEMP'] = portableTempPath;
		} else {
			process.env['TMPDIR'] = portableTempPath;
		}
	}

	return {
		portableDataPath,
		isPortable
	};
}
