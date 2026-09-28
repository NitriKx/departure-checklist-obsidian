import { App, TFile, normalizePath } from 'obsidian';

export function formatDateString(date: Date): string {
	const year = String(date.getFullYear()).padStart(4, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/** Create a dated checklist note and return it. Adds a suffix if the path is taken. */
export async function createChecklistNote(
	app: App,
	folder: string,
	date: string,
	markdown: string,
): Promise<TFile> {
	const base = folder
		? `${normalizePath(folder)}/${date} departure checklist.md`
		: `${date} departure checklist.md`;
	let path = base;
	let suffix = 2;
	while (app.vault.getAbstractFileByPath(path)) {
		path = base.replace(/\.md$/, ` ${suffix}.md`);
		suffix += 1;
	}
	await createMissingFolders(app, path);
	return app.vault.create(path, markdown);
}

async function createMissingFolders(app: App, filePath: string): Promise<void> {
	const parts = filePath.split('/');
	parts.pop();
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(current)) {
			await app.vault.createFolder(current);
		}
	}
}
