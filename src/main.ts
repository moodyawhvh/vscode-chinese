/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import * as fs from 'original-fs';
import * as os from 'node:os';
import { performance } from 'node:perf_hooks';
import { configurePortable } from './bootstrap-node.js';
import { bootstrapESM } from './bootstrap-esm.js';
import { app, protocol, crashReporter, Menu, contentTracing } from 'electron';
import minimist from 'minimist';
import { product } from './bootstrap-meta.js';
import { parse } from './vs/base/common/jsonc.js';
import { getUserDataPath } from './vs/platform/environment/node/userDataPath.js';
import * as perf from './vs/base/common/performance.js';
import { resolveNLSConfiguration } from './vs/base/node/nls.js';
import { getUNCHost, addUNCHostToAllowlist } from './vs/base/node/unc.js';
import { INLSConfiguration } from './vs/nls.js';
import { NativeParsedArgs } from './vs/platform/environment/common/argv.js';

// 【中文注】本文件是 VS Code 的 Electron 主进程入口:
// 1) 配置便携模式与命令行开关(argv.json);
// 2) 决定沙箱/崩溃报告/用户数据目录/代码缓存路径;
// 3) 注册自定义协议(with 特权)与全局监听器;
// 4) 尽早解析 NLS(多语言)配置,待 app.ready 后引导加载真正的
//    主进程模块 ./vs/code/electron-main/main.js。
// 全流程通过 perf.mark 打点,便于启动性能分析。

perf.mark('code/didStartMain');

perf.mark('code/willLoadMainBundle', {
	// 【中文注】构建产物中主 bundle 是内联全部依赖的单个 JS 文件,
	// 因此把 `willLoadMainBundle` 标记为主 bundle 加载流程的起点。
	// When built, the main bundle is a single JS file with all
	// dependencies inlined. As such, we mark `willLoadMainBundle`
	// as the start of the main bundle loading process.
	startTime: Math.floor(performance.timeOrigin)
});
perf.mark('code/didLoadMainBundle');

// 【中文注】启用便携模式支持(数据目录跟随应用,见 bootstrap-node.ts)
// Enable portable support
const portable = configurePortable(product);

const args = parseCLIArgs();
// 【中文注】同步配置静态命令行参数(读取 argv.json,见 configureCommandlineSwitchesSync)
// Configure static command line arguments
const argvConfig = configureCommandlineSwitchesSync(args);
// 【中文注】全局启用沙箱,除非:
// 1) 命令行通过 `--no-sandbox` 或 `--disable-chromium-sandbox` 显式禁用;
// 2) argv.json 中配置了 `disable-chromium-sandbox: true`。
// Enable sandbox globally unless
// 1) disabled via command line using either
//    `--no-sandbox` or `--disable-chromium-sandbox` argument.
// 2) argv.json contains `disable-chromium-sandbox: true`.
if (args['sandbox'] &&
	!args['disable-chromium-sandbox'] &&
	!argvConfig['disable-chromium-sandbox']) {
	app.enableSandbox();
} else if (app.commandLine.hasSwitch('no-sandbox') &&
	!app.commandLine.hasSwitch('disable-gpu-sandbox')) {
	// 【中文注】使用 --no-sandbox 时同时禁用 GPU 沙箱
	// Disable GPU sandbox whenever --no-sandbox is used.
	app.commandLine.appendSwitch('disable-gpu-sandbox');
} else {
	app.commandLine.appendSwitch('no-sandbox');
	app.commandLine.appendSwitch('disable-gpu-sandbox');
}

// 【中文注】在 app 'ready' 事件之前设置用户数据目录;
// Windows 上若目录位于 UNC 网络路径,需先把主机加入允许列表
// Set userData path before app 'ready' event
const userDataPath = getUserDataPath(args, product.nameShort ?? 'code-oss-dev');
if (process.platform === 'win32') {
	const userDataUNCHost = getUNCHost(userDataPath);
	if (userDataUNCHost) {
		addUNCHostToAllowlist(userDataUNCHost); // 【中文注】允许在 userDataPath 中使用 UNC 路径
	}
}
app.setPath('userData', userDataPath);

// 【中文注】解析 V8 代码缓存路径(加速启动,见 getCodeCachePath)
// Resolve code cache path
const codeCachePath = getCodeCachePath();

// 【中文注】禁用 Electron 默认应用菜单(https://github.com/electron/electron/issues/35512)
// Disable default menu (https://github.com/electron/electron/issues/35512)
Menu.setApplicationMenu(null);

// 【中文注】配置崩溃报告器:
// - 指定 --crash-reporter-directory 时,崩溃转储只存本地目录,不上传;
// - 否则按 argv.json 的 enable-crash-reporter 与 product.json 的 appCenter 配置决定是否上传。
// Configure crash reporter
perf.mark('code/willStartCrashReporter');
// If a crash-reporter-directory is specified we store the crash reports
// in the specified directory and don't upload them to the crash server.
//
// Appcenter crash reporting is enabled if
// * enable-crash-reporter runtime argument is set to 'true'
// * --disable-crash-reporter command line parameter is not set
//
// Disable crash reporting in all other cases.
if (args['crash-reporter-directory'] || (argvConfig['enable-crash-reporter'] && !args['disable-crash-reporter'])) {
	configureCrashReporter();
}
perf.mark('code/didStartCrashReporter');

// 【中文注】便携模式下,在 app 'ready' 前设置日志路径,
// 避免在便携目录之外的磁盘位置创建 'logs' 文件夹
// (https://github.com/microsoft/vscode/issues/56651)
if (portable.isPortable) {
	app.setAppLogsPath(path.join(userDataPath, 'logs'));
}

// 【中文注】注册自定义协议及其特权:
// vscode-webview(WebView 内容)、vscode-file(本地资源)、
// vscode-remote-resource / vscode-managed-remote-resource(远程资源)。
// 特权包括 secure、Fetch API、CORS、ServiceWorker、代码缓存等。
// Register custom schemes with privileges
protocol.registerSchemesAsPrivileged([
	{
		scheme: 'vscode-webview',
		privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, allowServiceWorkers: true, codeCache: true }
	},
	{
		scheme: 'vscode-file',
		privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true, codeCache: true }
	},
	{
		scheme: 'vscode-remote-resource',
		privileges: { secure: true, supportFetchAPI: true, corsEnabled: true }
	},
	{
		scheme: 'vscode-managed-remote-resource',
		privileges: { secure: true, supportFetchAPI: true, corsEnabled: true }
	}
]);

// Global app listeners
registerListeners();

/**
 * 【中文注】NLS(自然语言支持)配置解析:
 * 若 argv.json 已在 `app.ready` 事件前定义了语言,可以提前解析;
 * 否则必须等 `app.ready` 后才能拿到 OS 区域设置再解析。
 *
 * We can resolve the NLS configuration early if it is defined
 * in argv.json before `app.ready` event. Otherwise we can only
 * resolve NLS after `app.ready` event to resolve the OS locale.
 */
let nlsConfigurationPromise: Promise<INLSConfiguration> | undefined = undefined;

// 【中文注】用最优先的 OS 语言做语言推荐。注意该 API 在 Linux 上
// 可能返回空数组(例如用户只配置了 'C' 区域);任何平台上数组为空都回退到 'en'。
// Use the most preferred OS language for language recommendation.
// The API might return an empty array on Linux, such as when
// the 'C' locale is the user's only configured locale.
// No matter the OS, if the array is empty, default back to 'en'.
const osLocale = processZhLocale((app.getPreferredSystemLanguages()?.[0] ?? 'en').toLowerCase());
const userLocale = getUserDefinedLocale(argvConfig);
if (userLocale) {
	nlsConfigurationPromise = resolveNLSConfiguration({
		userLocale,
		osLocale,
		commit: product.commit,
		userDataPath,
		nlsMetadataPath: import.meta.dirname
	});
}

// 【中文注】把语言传给 Electron,让 Windows 上的标题栏控件
// (Windows Control Overlay)正确渲染;macOS 暂不传
// (https://github.com/microsoft/vscode/issues/167543)。
// `qps-ploc` 是微软伪语言包,此时按 `en` 处理。
// Pass in the locale to Electron so that the
// Windows Control Overlay is rendered correctly on Windows.
// For now, don't pass in the locale on macOS due to
// https://github.com/microsoft/vscode/issues/167543.
// If the locale is `qps-ploc`, the Microsoft
// Pseudo Language Language Pack is being used.
// In that case, use `en` as the Electron locale.

if (process.platform === 'win32' || process.platform === 'linux') {
	const electronLocale = (!userLocale || userLocale === 'qps-ploc') ? 'en' : userLocale;
	app.commandLine.appendSwitch('lang', electronLocale);
}

// 【中文注】就绪后加载主进程代码;若带 --trace 参数,
// 先启动内容追踪(content tracing)再进入 onReady
// Load our code once ready
app.once('ready', function () {
	if (args['trace']) {
		let traceOptions: Electron.TraceConfig | Electron.TraceCategoriesAndOptions;
		if (args['trace-memory-infra']) {
			const customCategories = args['trace-category-filter']?.split(',') || [];
			customCategories.push('disabled-by-default-memory-infra', 'disabled-by-default-memory-infra.v8.code_stats');
			traceOptions = {
				included_categories: customCategories,
				excluded_categories: ['*'],
				memory_dump_config: {
					allowed_dump_modes: ['light', 'detailed'],
					triggers: [
						{
							type: 'periodic_interval',
							mode: 'detailed',
							min_time_between_dumps_ms: 10000
						},
						{
							type: 'periodic_interval',
							mode: 'light',
							min_time_between_dumps_ms: 1000
						}
					]
				}
			};
		} else {
			traceOptions = {
				categoryFilter: args['trace-category-filter'] || '*',
				traceOptions: args['trace-options'] || 'record-until-full,enable-sampling'
			};
		}

		contentTracing.startRecording(traceOptions).finally(() => onReady());
	} else {
		onReady();
	}
});

async function onReady() {
	perf.mark('code/mainAppReady');

	try {
		const [, nlsConfig] = await Promise.all([
			mkdirpIgnoreError(codeCachePath),
			resolveNlsConfiguration()
		]);

		await startup(codeCachePath, nlsConfig);
	} catch (error) {
		console.error(error);
	}
}

/**
 * 【中文注】主进程启动例程:
 * 把 NLS 配置与代码缓存路径写入环境变量,
 * 引导 ESM 加载器,然后动态 import 真正的主进程模块。
 *
 * Main startup routine
 */
async function startup(codeCachePath: string | undefined, nlsConfig: INLSConfiguration): Promise<void> {
	process.env['VSCODE_NLS_CONFIG'] = JSON.stringify(nlsConfig);
	process.env['VSCODE_CODE_CACHE_PATH'] = codeCachePath || '';

	// 【中文注】引导 ESM 加载器
	// Bootstrap ESM
	await bootstrapESM();

	// 【中文注】加载主进程入口模块
	// Load Main
	await import('./vs/code/electron-main/main.js');
	perf.mark('code/didRunMainBundle');
}

// 【中文注】读取并应用 argv.json 中允许的命令行开关:
// - SUPPORTED_ELECTRON_SWITCHES:转发给 Electron/Chromium 的开关
//   (禁用硬件加速、颜色配置、LCD 字体渲染、代理绕过、远程调试端口等);
// - SUPPORTED_MAIN_PROCESS_SWITCHES:追加到 process.argv 的主进程开关
//   (提议 API、日志级别、内存密钥库、RDP 显示跟踪等)。
function configureCommandlineSwitchesSync(cliArgs: NativeParsedArgs) {
	const SUPPORTED_ELECTRON_SWITCHES = [

		// 【中文注】我们为 --disable-gpu 提供的别名
		// alias from us for --disable-gpu
		'disable-hardware-acceleration',

		// 【中文注】覆盖使用的颜色配置文件
		// override for the color profile to use
		'force-color-profile',

		// 【中文注】禁用 LCD 字体渲染(Chromium 标志)
		// disable LCD font rendering, a Chromium flag
		'disable-lcd-text',

		// 【中文注】为分号分隔的主机列表绕过指定代理
		// bypass any specified proxy for the given semi-colon-separated list of hosts
		'proxy-bypass-list',

		'remote-debugging-port'
	];

	if (process.platform === 'linux') {

		// 【中文注】Linux 上通过该标志强制启用屏幕阅读器
		// Force enable screen readers on Linux via this flag
		SUPPORTED_ELECTRON_SWITCHES.push('force-renderer-accessibility');

		// 【中文注】Linux 上覆盖使用的密码管理后端
		// override which password-store is used on Linux
		SUPPORTED_ELECTRON_SWITCHES.push('password-store');
	}

	const SUPPORTED_MAIN_PROCESS_SWITCHES = [

		// 【中文注】通过 argv.json 持久启用提议 API(https://github.com/microsoft/vscode/issues/99775)
		// Persistently enable proposed api via argv.json: https://github.com/microsoft/vscode/issues/99775
		'enable-proposed-api',

		// 【中文注】日志级别,默认 'info',可选 'error'、'warn'、'info'、'debug'、'trace'、'off'
		// Log level to use. Default is 'info'. Allowed values are 'error', 'warn', 'info', 'debug', 'trace', 'off'.
		'log-level',

		// 【中文注】使用内存存储保存密钥(secrets)
		// Use an in-memory storage for secrets
		'use-inmemory-secretstorage',

		// 【中文注】启用显示器跟踪,在 RDP 下恢复最大化窗口(https://github.com/electron/electron/issues/47016)
		// Enables display tracking to restore maximized windows under RDP: https://github.com/electron/electron/issues/47016
		'enable-rdp-display-tracking',
	];

	// 【中文注】读取 argv 配置(用户数据目录下的 argv.json)
	// Read argv config
	const argvConfig = readArgvConfigSync();

	Object.keys(argvConfig).forEach(argvKey => {
		const argvValue = argvConfig[argvKey];

		// Append Electron flags to Electron
		if (SUPPORTED_ELECTRON_SWITCHES.indexOf(argvKey) !== -1) {
			if (argvValue === true || argvValue === 'true') {
				if (argvKey === 'disable-hardware-acceleration') {
					app.disableHardwareAcceleration(); // needs to be called explicitly
				} else {
					app.commandLine.appendSwitch(argvKey);
				}
			} else if (typeof argvValue === 'string' && argvValue) {
				if (argvKey === 'password-store') {
					// Password store
					// TODO@TylerLeonhardt: Remove this migration in 3 months
					let migratedArgvValue = argvValue;
					if (argvValue === 'gnome' || argvValue === 'gnome-keyring') {
						migratedArgvValue = 'gnome-libsecret';
					}
					app.commandLine.appendSwitch(argvKey, migratedArgvValue);
				} else {
					app.commandLine.appendSwitch(argvKey, argvValue);
				}
			}
		}

		// Append main process flags to process.argv
		else if (SUPPORTED_MAIN_PROCESS_SWITCHES.indexOf(argvKey) !== -1) {
			switch (argvKey) {
				case 'enable-proposed-api':
					if (Array.isArray(argvValue)) {
						argvValue.forEach(id => id && typeof id === 'string' && process.argv.push('--enable-proposed-api', id));
					} else {
						console.error(`Unexpected value for \`enable-proposed-api\` in argv.json. Expected array of extension ids.`);
					}
					break;

				case 'log-level':
					if (typeof argvValue === 'string') {
						process.argv.push('--log', argvValue);
					} else if (Array.isArray(argvValue)) {
						for (const value of argvValue) {
							process.argv.push('--log', value);
						}
					}
					break;

				case 'use-inmemory-secretstorage':
					if (argvValue) {
						process.argv.push('--use-inmemory-secretstorage');
					}
					break;

				case 'enable-rdp-display-tracking':
					if (argvValue) {
						process.argv.push('--enable-rdp-display-tracking');
					}
					break;
			}
		}
	});

	// Following features are enabled from the runtime:
	// `NetAdapterMaxBufSizeFeature` - Specify the max buffer size for NetToMojoPendingBuffer, refs https://github.com/microsoft/vscode/issues/268800
	// `DocumentPolicyIncludeJSCallStacksInCrashReports` - https://www.electronjs.org/docs/latest/api/web-frame-main#framecollectjavascriptcallstack-experimental
	// `EarlyEstablishGpuChannel` - Refs https://issues.chromium.org/issues/40208065
	// `EstablishGpuChannelAsync` - Refs https://issues.chromium.org/issues/40208065
	// `GlobalShortcutsPortal` - Enables Electron's `globalShortcut` (system-wide keybindings) on Linux Wayland via the XDG global shortcuts portal (no-op elsewhere)
	const featuresToEnable =
		`NetAdapterMaxBufSizeFeature:NetAdapterMaxBufSize/8192,DocumentPolicyIncludeJSCallStacksInCrashReports,EarlyEstablishGpuChannel,EstablishGpuChannelAsync${process.platform === 'linux' ? ',GlobalShortcutsPortal' : ''},${app.commandLine.getSwitchValue('enable-features')}`;
	app.commandLine.appendSwitch('enable-features', featuresToEnable);

	// Following features are disabled from the runtime:
	// `CalculateNativeWinOcclusion` - Disable native window occlusion tracker (https://groups.google.com/a/chromium.org/g/embedder-dev/c/ZF3uHHyWLKw/m/VDN2hDXMAAAJ)
	const featuresToDisable =
		`CalculateNativeWinOcclusion,${app.commandLine.getSwitchValue('disable-features')}`;
	app.commandLine.appendSwitch('disable-features', featuresToDisable);

	// Blink features to configure.
	// `FontMatchingCTMigration` - Siwtch font matching on macOS to Appkit (Refs https://github.com/microsoft/vscode/issues/224496#issuecomment-2270418470).
	// `StandardizedBrowserZoom` - Disable zoom adjustment for bounding box (https://github.com/microsoft/vscode/issues/232750#issuecomment-2459495394)
	const blinkFeaturesToDisable =
		`FontMatchingCTMigration,StandardizedBrowserZoom,${app.commandLine.getSwitchValue('disable-blink-features')}`;
	app.commandLine.appendSwitch('disable-blink-features', blinkFeaturesToDisable);

	// Support JS Flags
	const jsFlags = getJSFlags(cliArgs, argvConfig);
	if (jsFlags) {
		app.commandLine.appendSwitch('js-flags', jsFlags);
	}

	// Use portal version 4 that supports current_folder option
	// to address https://github.com/microsoft/vscode/issues/213780
	// Runtime sets the default version to 3, refs https://github.com/electron/electron/pull/44426
	app.commandLine.appendSwitch('xdg-portal-required-version', '4');

	// Increase the maximum number of active WebGL contexts as each terminal may
	// use up to 2
	app.commandLine.appendSwitch('max-active-webgl-contexts', '32');

	return argvConfig;
}

interface IArgvConfig {
	[key: string]: string | string[] | boolean | undefined;
	readonly locale?: string;
	readonly 'disable-lcd-text'?: boolean;
	readonly 'proxy-bypass-list'?: string;
	readonly 'disable-hardware-acceleration'?: boolean;
	readonly 'force-color-profile'?: string;
	readonly 'enable-crash-reporter'?: boolean;
	readonly 'crash-reporter-id'?: string;
	readonly 'enable-proposed-api'?: string[];
	readonly 'log-level'?: string | string[];
	readonly 'disable-chromium-sandbox'?: boolean;
	readonly 'use-inmemory-secretstorage'?: boolean;
	readonly 'enable-rdp-display-tracking'?: boolean;
	readonly 'remote-debugging-port'?: string;
	readonly 'js-flags'?: string;
}

function readArgvConfigSync(): IArgvConfig {

	// 【中文注】在 app('ready') 之前同步读取(必要时创建)argv.json 配置文件
	// Read or create the argv.json config file sync before app('ready')
	const argvConfigPath = getArgvConfigPath();
	let argvConfig: IArgvConfig | undefined = undefined;
	try {
		argvConfig = parse(fs.readFileSync(argvConfigPath).toString());
	} catch (error) {
		if (error && error.code === 'ENOENT') {
			createDefaultArgvConfigSync(argvConfigPath);
		} else {
			console.warn(`Unable to read argv.json configuration file in ${argvConfigPath}, falling back to defaults (${error})`);
		}
	}

	// 【中文注】兜底为空配置
	// Fallback to default
	if (!argvConfig) {
		argvConfig = {};
	}

	return argvConfig;
}

function createDefaultArgvConfigSync(argvConfigPath: string): void {
	try {

		// 【中文注】确保 argv.json 的父目录存在
		// Ensure argv config parent exists
		const argvConfigPathDirname = path.dirname(argvConfigPath);
		if (!fs.existsSync(argvConfigPathDirname)) {
			fs.mkdirSync(argvConfigPathDirname);
		}

		// 【中文注】默认 argv.json 内容(允许向 VS Code 传递永久命令行参数)
		// Default argv content
		const defaultArgvConfigContent = [
			'// This configuration file allows you to pass permanent command line arguments to VS Code.',
			'// Only a subset of arguments is currently supported to reduce the likelihood of breaking',
			'// the installation.',
			'//',
			'// PLEASE DO NOT CHANGE WITHOUT UNDERSTANDING THE IMPACT',
			'//',
			'// NOTE: Changing this file requires a restart of VS Code.',
			'{',
			'	// Use software rendering instead of hardware accelerated rendering.',
			'	// This can help in cases where you see rendering issues in VS Code.',
			'	// "disable-hardware-acceleration": true',
			'}'
		];

		// Create initial argv.json with default content
		fs.writeFileSync(argvConfigPath, defaultArgvConfigContent.join('\n'));
	} catch (error) {
		console.error(`Unable to create argv.json configuration file in ${argvConfigPath}, falling back to defaults (${error})`);
	}
}

function getArgvConfigPath(): string {
	// 【中文注】argv.json 路径:便携模式放便携目录;
	// 普通模式放 `~/.<产品数据文件夹名>/argv.json`,开发模式加 `-dev` 后缀
	const vscodePortable = process.env['VSCODE_PORTABLE'];
	if (vscodePortable) {
		return path.join(vscodePortable, 'argv.json');
	}

	let dataFolderName = product.dataFolderName;
	if (process.env['VSCODE_DEV']) {
		dataFolderName = `${dataFolderName}-dev`;
	}

	return path.join(os.homedir(), dataFolderName!, 'argv.json');
}

function configureCrashReporter(): void {
	let crashReporterDirectory = args['crash-reporter-directory'];
	let submitURL = '';
	if (crashReporterDirectory) {
		crashReporterDirectory = path.normalize(crashReporterDirectory);

		if (!path.isAbsolute(crashReporterDirectory)) {
			console.error(`The path '${crashReporterDirectory}' specified for --crash-reporter-directory must be absolute.`);
			app.exit(1);
		}

		if (!fs.existsSync(crashReporterDirectory)) {
			try {
				fs.mkdirSync(crashReporterDirectory, { recursive: true });
			} catch (error) {
				console.error(`The path '${crashReporterDirectory}' specified for --crash-reporter-directory does not seem to exist or cannot be created.`);
				app.exit(1);
			}
		}

		// 【中文注】崩溃转储默认存在 crashDumps 目录,这里改为用户指定的目录
		// Crashes are stored in the crashDumps directory by default, so we
		// need to change that directory to the provided one
		console.log(`Found --crash-reporter-directory argument. Setting crashDumps directory to be '${crashReporterDirectory}'`);
		app.setPath('crashDumps', crashReporterDirectory);
	}

	// 【中文注】未指定本地目录时,按 product.json 中的 appCenter 配置上传崩溃报告
	// Otherwise we configure the crash reporter from product.json
	else {
		const appCenter = product.appCenter;
		if (appCenter) {
			const isWindows = (process.platform === 'win32');
			const isLinux = (process.platform === 'linux');
			const isDarwin = (process.platform === 'darwin');
			const crashReporterId = argvConfig['crash-reporter-id'];
			const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
			if (crashReporterId && uuidPattern.test(crashReporterId)) {
				if (isWindows) {
					switch (process.arch) {
						case 'x64':
							submitURL = appCenter['win32-x64'];
							break;
						case 'arm64':
							submitURL = appCenter['win32-arm64'];
							break;
					}
				} else if (isDarwin) {
					if (product.darwinUniversalAssetId) {
						submitURL = appCenter['darwin-universal'];
					} else {
						switch (process.arch) {
							case 'x64':
								submitURL = appCenter['darwin'];
								break;
							case 'arm64':
								submitURL = appCenter['darwin-arm64'];
								break;
						}
					}
				} else if (isLinux) {
					submitURL = appCenter['linux-x64'];
				}
				submitURL = submitURL.concat('&uid=', crashReporterId, '&iid=', crashReporterId, '&sid=', crashReporterId);
				// 【中文注】为显式启动崩溃报告器的子 Node 进程传递 id;
				// 对 vscode 而言目前就是扩展宿主(ExtensionHost)进程。
				// Send the id for child node process that are explicitly starting crash reporter.
				// For vscode this is ExtensionHost process currently.
				const argv = process.argv;
				const endOfArgsMarkerIndex = argv.indexOf('--');
				if (endOfArgsMarkerIndex === -1) {
					argv.push('--crash-reporter-id', crashReporterId);
				} else {
					// 【中文注】若存在参数结束标记 "--",不能追加到末尾,
					// 必须把参数插入到 "--" 之前
					// if the we have an argument "--" (end of argument marker)
					// we cannot add arguments at the end. rather, we add
					// arguments before the "--" marker.
					argv.splice(endOfArgsMarkerIndex, 0, '--crash-reporter-id', crashReporterId);
				}
			}
		}
	}

	// 【中文注】为所有进程启动崩溃报告器;开发模式不上传
	// Start crash reporter for all processes
	const productName = (product.crashReporter ? product.crashReporter.productName : undefined) || product.nameShort;
	const companyName = (product.crashReporter ? product.crashReporter.companyName : undefined) || 'Microsoft';
	const uploadToServer = Boolean(!process.env['VSCODE_DEV'] && submitURL && !crashReporterDirectory);
	crashReporter.start({
		companyName,
		productName: process.env['VSCODE_DEV'] ? `${productName} Dev` : productName,
		submitURL,
		uploadToServer,
		compress: true,
		ignoreSystemCrashHandler: true
	});
}

function getJSFlags(cliArgs: NativeParsedArgs, argvConfig: IArgvConfig): string | null {
	const jsFlags: string[] = [];

	// Add any existing JS flags we already got from the command line
	if (cliArgs['js-flags']) {
		jsFlags.push(cliArgs['js-flags']);
	}

	// Add JS flags from runtime arguments (argv.json)
	if (typeof argvConfig['js-flags'] === 'string' && argvConfig['js-flags']) {
		jsFlags.push(argvConfig['js-flags']);
	}

	return jsFlags.length > 0 ? jsFlags.join(' ') : null;
}

function parseCLIArgs(): NativeParsedArgs {
	return minimist(process.argv, {
		string: [
			'user-data-dir',
			'locale',
			'js-flags',
			'crash-reporter-directory'
		],
		boolean: [
			'disable-chromium-sandbox',
		],
		default: {
			'sandbox': true
		},
		alias: {
			'no-sandbox': 'sandbox'
		}
	});
}

function registerListeners(): void {

	/**
	 * 【中文注】macOS:当用户把文件拖到尚未启动完成的 VS Code 图标上时,
	 * open-file 事件甚至早于 app-ready 事件触发。这里尽早在启动阶段
	 * 监听 open-file 并记住这些路径,作为待打开的文件。
	 *
	 * macOS: when someone drops a file to the not-yet running VSCode, the open-file event fires even before
	 * the app-ready event. We listen very early for open-file and remember this upon startup as path to open.
	 */
	const macOpenFiles: string[] = [];
	(globalThis as { macOpenFiles?: string[] }).macOpenFiles = macOpenFiles;
	app.on('open-file', function (event, path) {
		macOpenFiles.push(path);
	});

	/**
	 * 【中文注】macOS:响应 open-url 请求(如 vscode:// 协议链接)
	 * macOS: react to open-url requests.
	 */
	const openUrls: string[] = [];
	const onOpenUrl =
		function (event: { preventDefault: () => void }, url: string) {
			event.preventDefault();

			openUrls.push(url);
		};

	app.on('will-finish-launching', function () {
		app.on('open-url', onOpenUrl);
	});

	(globalThis as { getOpenUrls?: () => string[] }).getOpenUrls = function () {
		app.removeListener('open-url', onOpenUrl);

		return openUrls;
	};
}

function getCodeCachePath(): string | undefined {

	// 【中文注】通过命令行参数显式禁用代码缓存
	// explicitly disabled via CLI args
	if (process.argv.indexOf('--no-cached-data') > 0) {
		return undefined;
	}

	// 【中文注】从源码运行时不使用代码缓存
	// running out of sources
	if (process.env['VSCODE_DEV']) {
		return undefined;
	}

	// 【中文注】代码缓存必须绑定 commit id(否则缓存可能失配)
	// require commit id
	const commit = product.commit;
	if (!commit) {
		return undefined;
	}

	return path.join(userDataPath, 'CachedData', commit);
}

async function mkdirpIgnoreError(dir: string | undefined): Promise<string | undefined> {
	if (typeof dir === 'string') {
		try {
			await fs.promises.mkdir(dir, { recursive: true });

			return dir;
		} catch (error) {
			// ignore
		}
	}

	return undefined;
}

// 【中文注】NLS(自然语言支持)相关
//#region NLS Support

// 【中文注】规范化中文区域:Windows/macOS 返回 zh-hans/zh-hant 前缀,
// 可直接判断简繁;Linux 返回 zh-XY(国家代码)形式,
// CN/SG/MY 视为简体,其余视为繁体。
function processZhLocale(appLocale: string): string {
	if (appLocale.startsWith('zh')) {
		const region = appLocale.split('-')[1];

		// 【中文注】Windows 与 macOS 上 app.getPreferredSystemLanguages()
		// 返回的中文以 zh-hans(简体)或 zh-hant(繁体)开头,可直接区分;
		// 而 Linux 上同一 API 返回 zh-XY 形式(XY 为国家代码),
		// 中国(CN)、新加坡(SG)、马来西亚(MY)视为简体,其余视为繁体。
		// On Windows and macOS, Chinese languages returned by
		// app.getPreferredSystemLanguages() start with zh-hans
		// for Simplified Chinese or zh-hant for Traditional Chinese,
		// so we can easily determine whether to use Simplified or Traditional.
		// However, on Linux, Chinese languages returned by that same API
		// are of the form zh-XY, where XY is a country code.
		// For China (CN), Singapore (SG), and Malaysia (MY)
		// country codes, assume they use Simplified Chinese.
		// For other cases, assume they use Traditional.
		if (['hans', 'cn', 'sg', 'my'].includes(region)) {
			return 'zh-cn';
		}

		return 'zh-tw';
	}

	return appLocale;
}

/**
 * 【中文注】解析 NLS 配置:优先用 app.ready 前已定义的语言(argv.json),
 * 其次用 app.getLocale() 拿到的应用语言,最终兜底英文。
 *
 * Resolve the NLS configuration
 */
async function resolveNlsConfiguration(): Promise<INLSConfiguration> {

	// 【中文注】解析顺序:用户自定义语言 → 应用语言 → 英文兜底
	// First, we need to test a user defined locale.
	// If it fails we try the app locale.
	// If that fails we fall back to English.

	const nlsConfiguration = nlsConfigurationPromise ? await nlsConfigurationPromise : undefined;
	if (nlsConfiguration) {
		return nlsConfiguration;
	}

	// 【中文注】尝试使用应用语言(仅在 app ready 事件触发后才有效)
	// Try to use the app locale which is only valid
	// after the app ready event has been fired.

	let userLocale = app.getLocale();
	if (!userLocale) {
		return {
			userLocale: 'en',
			osLocale,
			resolvedLanguage: 'en',
			defaultMessagesFile: path.join(import.meta.dirname, 'nls.messages.json'),

			// NLS: below 2 are a relic from old times only used by vscode-nls and deprecated
			locale: 'en',
			availableLanguages: {}
		};
	}

	// See above the comment about the loader and case sensitiveness
	userLocale = processZhLocale(userLocale.toLowerCase());

	return resolveNLSConfiguration({
		userLocale,
		osLocale,
		commit: product.commit,
		userDataPath,
		nlsMetadataPath: import.meta.dirname
	});
}

/**
 * 【中文注】语言标签本身不区分大小写,但 ESM 加载器对路径大小写敏感。
 * 为了在大小写保留/不敏感的文件系统上都能工作:
 * 语言包统一使用小写语言标签,同时把来自用户或 OS 的区域统一转小写。
 *
 * Language tags are case insensitive however an ESM loader is case sensitive
 * To make this work on case preserving & insensitive FS we do the following:
 * the language bundles have lower case language tags and we always lower case
 * the locale we receive from the user or OS.
 */
function getUserDefinedLocale(argvConfig: IArgvConfig): string | undefined {
	const locale = args['locale'];
	if (locale) {
		return locale.toLowerCase(); // 【中文注】直接传入的 --locale 优先级最高
	}

	return typeof argvConfig?.locale === 'string' ? argvConfig.locale.toLowerCase() : undefined;
}

//#endregion
