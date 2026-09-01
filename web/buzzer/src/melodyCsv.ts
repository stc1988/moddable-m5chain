export type CsvMelodyStep = {
	noteConstant: string;
	beats: number;
};

function parseCsvRow(line: string, lineNumber: number): string[] {
	const fields: string[] = [];
	let field = "";
	let quoted = false;

	for (let index = 0; index < line.length; index += 1) {
		const character = line[index];
		if (character === '"') {
			if (quoted && line[index + 1] === '"') {
				field += '"';
				index += 1;
			} else {
				quoted = !quoted;
			}
		} else if (character === "," && !quoted) {
			fields.push(field.trim());
			field = "";
		} else {
			field += character;
		}
	}

	if (quoted) throw new Error(`Line ${lineNumber}: quoted field is not closed.`);
	fields.push(field.trim());
	return fields;
}

function normalizeNote(value: string, validNotes: ReadonlySet<string>, lineNumber: number): string {
	let note = value
		.trim()
		.toUpperCase()
		.replace(/^BUZZER_NOTE\./, "")
		.replace(/^NOTE_/, "");
	if (note === "REST") return note;

	note = note.replace(/^([A-G])#([3-8])$/, "$1_SHARP_$2").replace(/^([A-G])S([3-8])$/, "$1_SHARP_$2");
	if (!validNotes.has(note)) throw new Error(`Line ${lineNumber}: unknown note "${value}".`);
	return note;
}

function parseBeats(value: string, lineNumber: number): number {
	const fraction = value.match(/^([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)$/);
	const beats = fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(value);
	if (!Number.isFinite(beats) || beats <= 0) {
		throw new Error(`Line ${lineNumber}: beats must be a number greater than 0.`);
	}
	return beats;
}

export function parseMelodyCsv(text: string, validNotes: ReadonlySet<string>): CsvMelodyStep[] {
	const steps: CsvMelodyStep[] = [];
	let firstDataRow = true;
	const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);

	for (let index = 0; index < lines.length; index += 1) {
		const lineNumber = index + 1;
		const line = lines[index]?.trim() ?? "";
		if (!line || line.startsWith("#")) continue;

		const fields = parseCsvRow(line, lineNumber);
		if (fields.length !== 2) throw new Error(`Line ${lineNumber}: expected exactly 2 columns (note, beats).`);
		if (firstDataRow && fields[0]?.toLowerCase() === "note" && fields[1]?.toLowerCase() === "beats") {
			firstDataRow = false;
			continue;
		}
		firstDataRow = false;
		steps.push({
			noteConstant: normalizeNote(fields[0] ?? "", validNotes, lineNumber),
			beats: parseBeats(fields[1] ?? "", lineNumber),
		});
	}

	if (steps.length === 0) throw new Error("CSV must contain at least one melody step.");
	return steps;
}
