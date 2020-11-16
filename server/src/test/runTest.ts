import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

export function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		color: true,
		bail: true
	});
	mocha.timeout(100000);

	const testsRoot = __dirname;

	return new Promise((resolve, reject) => {
		glob('**.test.js', { cwd: testsRoot }, (err, files) => {
			if (err) {
				return reject(err);
			}

			// Add files to the test suite
			files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

			try {
				// Run the mocha test
				mocha.run(failures => {
					if (failures > 0) {
						reject(new Error(`${failures} tests failed.`));
					} else {
						resolve();
					}
				});
			} catch (err) {
				console.error(err);
				reject(err);
			}
		});
	});
}

async function main() {
	try {
		await run();
	} catch (err) {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

main();