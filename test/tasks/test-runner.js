const { Console } = require('console');
const chalk = require('chalk');
const httpServer = require('http-server');
const browserStackRunner = require('browserstack-runner');
const config = require('./browserstack.json');
const desktopBrowsers = require('./browserstack.desktop.json');
const mobileBrowsers = require('./browserstack.mobile.json');
const ports = require('./ports.json');

config.test_server_port = ports.base;

const seed = String(Math.random()).slice(-5);
function setSeed() {
	config.test_path += '?seed=' + seed;
	console.log('Seed set to ' + seed);
}

console.log('chalk.supportsColor', chalk.supportsColor);

switch (process.argv[2]) {
	case '--desktop':
		console.log('Running tests on desktop browsers.');
		config.browsers = desktopBrowsers;
		setSeed();
		break;
	case '--mobile':
		console.log('Running tests on mobile browsers.');
		config.browsers = mobileBrowsers;
		setSeed();
		break;
	case '--local':
	default:
		console.log('Running test server locally.');
		config.browsers = [];
		break;
}

/**
 * Check the report and pretty-print to the console
 * @see https://github.com/browserstack/browserstack-runner#usage-as-a-module
 * @param report BrowserStack report
 * @returns {boolean} true on success, false on failure
 */
const checkReport = report => {
	let out = [];
	let errOut = [];

	if (!report.length) {
		console.log(
			'No report received, probably because the build has been terminated...'
		);
		console.log(
			'Check the tests runs! https://travis-ci.org/Tradeshift/io/pull_requests'
		);
		return false;
	}

	out.push('');
	out.push('');
	report.forEach(browserRes => {
		out.push('____________________________________________________________');
		out.push(
			chalk.white.bgBlack('Browser: ') +
				chalk.white.bold.bgBlack(browserRes.browser)
		);
		if (browserRes.tests && browserRes.tests.length) {
			browserRes.tests.forEach(test => {
				let timeString = ` (${test.runtime}ms)`;
				if (test.runtime > 500) {
					timeString = chalk.red(timeString);
				} else if (test.runtime < 100) {
					timeString = chalk.green(timeString);
				}

				if (test.status === 'failed') {
					out.push(chalk.red(`${test.suiteName} > ${test.name}`) + timeString);

					errOut.push('');
					errOut.push(`Browser: ${chalk.red.bold(browserRes.browser)}`);
					errOut.push(
						chalk.white.bgRed.bold(`${test.suiteName} > ${test.name}`)
					);
					test.errors.forEach(function(err) {
						if (err.stack) {
							errOut.push(chalk.red(err.stack.replace('/\\n/i', '\n')));
						} else {
							errOut.push(chalk.red('No stacktrace supplied :('));
						}
						errOut.push('');
					});
				} else {
					out.push(
						chalk.green(`${test.suiteName} > ${test.name}`) + timeString
					);
				}
			});
		} else {
			errOut.push('');
			errOut.push(`Browser: ${chalk.red.bold(browserRes.browser)}`);
			errOut.push(
				chalk.white.bgRed.bold('No tests ran, something went horribly wrong!')
			);
			out.push(
				chalk.white.bgRed.bold('No tests ran, something went horribly wrong!')
			);
		}
	});

	const logger = new Console(process.stdout, process.stderr);

	logger.log('');
	logger.log('stdout:');
	logger.log('');
	out.forEach(line => logger.log(line));
	logger.log('');
	logger.log('stderr:');
	logger.log('');
	errOut.forEach(line => logger.error(line));
	logger.log('');

	return !errOut.length;
};

httpServer
	.createServer({
		cache: -1
	})
	.listen(ports.crossdomain, '0.0.0.0', () => {
		console.log(
			'Started HTTP Server for crossdomain simulation on port ' +
				ports.crossdomain +
				'.'
		);
		console.log(
			'Starting Browserstack HTTP Server on port ' + ports.base + '…'
		);
		browserStackRunner.run(config, async (err, report) => {
			if (err) {
				console.log('Error:' + err);
				process.exit(2);
			}
			if (checkReport(report)) {
				process.exit(0);
			} else {
				process.exit(1);
			}
		});
	});
