const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const GenerateJsonPlugin = require('generate-json-webpack-plugin');
const TerserPlugin = require("terser-webpack-plugin");

function getPackageName() {
	const PACKAGE_DEFAULT_NAME = 'tradingview-desktop';
	const PACKAGE_LINUX_NAME = 'tradingview';

	return process.platform === 'linux' ? PACKAGE_LINUX_NAME : PACKAGE_DEFAULT_NAME;
}

function getPackageBuildDate(buildDate) {
	if (buildDate) {
		return buildDate;
	}

	return Date.now();
}

function getPackageVersion(appVersion) {
	if (appVersion) {
		return appVersion;
	}

	return "1.0.0";
}

const packageMetadata = (appVersion, buildDate) => ({
	name: getPackageName(),
	productName: 'TradingView',
	description: 'Experience extra power, extra speed and extra flexibility, all with the same UX you know and love.',
	main: 'index.js',
	version: getPackageVersion(appVersion),
	buildDate: getPackageBuildDate(buildDate),
	private: true,
	homepage: "https://tradingview.com",
	license: "Proprietary",
	author: {
		name: "TradingView, Inc.",
		email: "desktop@tradingview.com"
	}
});

exports.main = (appVersion, buildDate) => ({
	entry: './src/index.ts',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'index.js',
		devtoolModuleFilenameTemplate: (info) => {
			const context = path.resolve('./dist');
			return path.relative(context, info.absoluteResourcePath);
		}
	},
	target: 'electron-main',
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: ['ts-loader']
			},
			{
				test: /\.js$/,
				exclude: /node_modules/,
				resolve: {
					fullySpecified: false
				}
			}
		]
	},
	resolve: {
		extensions: ['.ts', '.js', '.mjs', '.svg', '.css']
	},
	optimization: {
		minimizer: [
			new TerserPlugin({
				parallel: true,
				terserOptions: {
					compress: {
						reduce_vars: false
					}
				}
			}),
		]
	},
	plugins: [
		new CopyPlugin({
			patterns: [
				{ from: 'src/index.css', to: 'app' }
			]
		}),
		new GenerateJsonPlugin('package.json', packageMetadata(appVersion, buildDate), null, 2)
	]
});


// when adding new renderer page add folder name in app here (or path)
const commonWindows = [
	'worker',
];
exports.renderers = () => buildRenderers(commonWindows);

function buildRenderers(commonAppFolders) {
	let renderers = {
		entry: {},
		target: 'electron-renderer',
		module: {
			rules: [
				{
					test: /\.ts(x?)$/,
					include: /src/,
					use: [
						{ loader: 'ts-loader' }
					]
				},
				{
					test: /\.css$/i,
					use: ['style-loader', 'css-loader']
				},
				{
					test: /\.(jpe?g|png|gif|webm)$/i,
					type: 'asset/resource',
				},
				{
					test: /\.js$/,
					resolve: {
						fullySpecified: false
					}
				}
			]
		},
		output: {
			path: __dirname + '/dist/app',
		},
		resolve: {
			extensions: ['.ts', '.tsx', '.js', '.mjs', '.css']
		},
		optimization: {
			splitChunks: {
				chunks: 'all',
				minSize: 20000,
				maxAsyncRequests: 30,
				maxInitialRequests: 30,
				enforceSizeThreshold: 50000,
				cacheGroups: {
					defaultVendors: {
						test: /[\\/]node_modules[\\/]/,
						priority: -10,
						reuseExistingChunk: true
					},
					default: {
						minChunks: 2,
						priority: -20,
						reuseExistingChunk: true
					}
				}
			}
		},
		plugins: []
	};

	const setRendersData = (folder, isTransparent) => {
		let entryName = folder.toLowerCase();

		renderers.entry[entryName] = { import: `./src/${ folder }/index.tsx`, filename: `./${ folder }/bundle.js` };
		renderers.plugins.push(
			new HtmlWebpackPlugin({
				inject: true,
				chunks: [entryName],
				template: isTransparent ? './src/indexTransparent.html' : './src/index.html',
				filename: `./${ folder }/index.html`
			})
		);
	}

	commonAppFolders.forEach((f) => setRendersData(f, false));

	return renderers;
}
