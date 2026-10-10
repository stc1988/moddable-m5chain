export function assertDeepEqual(actual, expected, path = "value") {
	if (Object.is(actual, expected)) return;
	if (!actual || !expected || typeof actual !== "object" || typeof expected !== "object") {
		throw new Error(`${path}: expected ${String(expected)}, got ${String(actual)}`);
	}

	if (ArrayBuffer.isView(actual) || ArrayBuffer.isView(expected)) {
		assert(ArrayBuffer.isView(actual) && ArrayBuffer.isView(expected), `${path}: typed array mismatch`);
		assert.sameValue(actual.length, expected.length, `${path}.length`);
		for (let index = 0; index < actual.length; index++) {
			assert.sameValue(actual[index], expected[index], `${path}[${index}]`);
		}
		return;
	}

	const actualKeys = Object.keys(actual);
	const expectedKeys = Object.keys(expected);
	assert.sameValue(actualKeys.length, expectedKeys.length, `${path}: property count`);
	for (const key of expectedKeys) {
		assert(Object.hasOwn(actual, key), `${path}: missing property ${key}`);
		assertDeepEqual(actual[key], expected[key], `${path}.${key}`);
	}
}

export function assertThrows(callback, expected) {
	try {
		callback();
	} catch (error) {
		if (expected?.prototype instanceof Error || expected === Error) {
			assert(error instanceof expected, `expected ${expected.name}, got ${error?.constructor?.name}`);
		} else if (expected instanceof RegExp) {
			assert(expected.test(String(error?.message ?? error)), `unexpected error: ${error}`);
		}
		return error;
	}
	throw new Error("expected callback to throw");
}

export async function assertRejects(promise, expected) {
	try {
		await promise;
	} catch (error) {
		if (expected?.prototype instanceof Error || expected === Error) {
			assert(error instanceof expected, `expected ${expected.name}, got ${error?.constructor?.name}`);
		} else if (expected instanceof RegExp) {
			assert(expected.test(String(error?.message ?? error)), `unexpected rejection: ${error}`);
		}
		return error;
	}
	throw new Error("expected promise to reject");
}
