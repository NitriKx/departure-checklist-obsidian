import { App, Modal, Notice, Setting } from 'obsidian';
import { isParseableExpression } from './expressions';
import {
	ChecklistItem,
	ChecklistSection,
	ComputedVariable,
	Question,
	QuestionOption,
	TOGGLE_ANSWERS,
} from './types';

const ALWAYS = '__always__';

interface ItemState {
	text: string;
	whenSource: string;
	whenEquals: string;
	whenGreaterThan: string;
}

interface ConditionSource {
	id: string;
	label: string;
	kind: 'answers' | 'numeric';
	answers?: QuestionOption[];
}

interface ConditionState {
	source: string;
	equals: string;
	greaterThan: string;
}

function slugify(text: string): string {
	const slug = text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'item';
}

function uniqueId(base: string, existing: Set<string>): string {
	let id = base;
	let n = 2;
	while (existing.has(id)) {
		id = `${base}-${n}`;
		n += 1;
	}
	return id;
}

function toggleOptions(): QuestionOption[] {
	return TOGGLE_ANSWERS.map((id) => ({ id, label: id === 'yes' ? 'Yes' : 'No' }));
}

function answersFor(question: Question): QuestionOption[] {
	if (question.type === 'toggle') {
		return toggleOptions();
	}
	return question.options ?? [];
}

/** Questions and computed values that conditions can reference. */
function conditionSources(
	questions: Question[],
	computed: ComputedVariable[] | undefined,
	excludeId?: string,
): ConditionSource[] {
	const sources: ConditionSource[] = [];
	for (const question of questions) {
		if (question.id === excludeId) {
			continue;
		}
		if (question.type === 'select' || question.type === 'toggle') {
			sources.push({
				id: question.id,
				label: question.label,
				kind: 'answers',
				answers: answersFor(question),
			});
		} else if (question.type === 'number') {
			sources.push({ id: question.id, label: question.label, kind: 'numeric' });
		}
	}
	for (const variable of computed ?? []) {
		sources.push({ id: variable.name, label: `${variable.name} (computed)`, kind: 'numeric' });
	}
	return sources;
}

function loadConditionState(condition: { question: string; equals?: string; greaterThan?: string } | undefined): ConditionState {
	if (!condition) {
		return { source: ALWAYS, equals: '', greaterThan: '' };
	}
	if (condition.greaterThan !== undefined) {
		return { source: condition.question, equals: '', greaterThan: condition.greaterThan };
	}
	if (condition.equals !== undefined) {
		return { source: condition.question, equals: condition.equals, greaterThan: '' };
	}
	return { source: condition.question, equals: '', greaterThan: '' };
}

/** Dropdowns for "when [source] is [value]". Numeric sources compare with "greater than". */
function renderCondition(
	containerEl: HTMLElement,
	name: string,
	sources: ConditionSource[],
	state: ConditionState,
	onChange: () => void,
): void {
	const sourceSetting = new Setting(containerEl).setName(name);
	const valueSetting = new Setting(containerEl).setName('Value is');

	const rebuildValue = (): void => {
		valueSetting.controlEl.empty();
		if (state.source === ALWAYS) {
			return;
		}
		const source = sources.find((candidate) => candidate.id === state.source);
		if (!source) {
			return;
		}
		if (source.kind === 'answers') {
			valueSetting.addDropdown((dropdown) => {
				dropdown.addOption('', 'Any answer');
				for (const answer of source.answers ?? []) {
					dropdown.addOption(answer.id, answer.label);
				}
				dropdown.setValue(state.equals).onChange((value) => {
					state.equals = value;
					onChange();
				});
			});
		} else {
			valueSetting.addText((text) =>
				text
					.setPlaceholder('Greater than 7')
					.setValue(state.greaterThan)
					.onChange((value) => {
						state.greaterThan = value;
						onChange();
					}),
			);
		}
	};

	sourceSetting.addDropdown((dropdown) => {
		dropdown.addOption(ALWAYS, 'Always');
		for (const source of sources) {
			dropdown.addOption(source.id, source.label);
		}
		dropdown.setValue(state.source).onChange((value) => {
			state.source = value;
			state.equals = '';
			state.greaterThan = '';
			onChange();
			rebuildValue();
		});
	});

	rebuildValue();
}

export class QuestionEditorModal extends Modal {
	private label: string;
	private type: Question['type'];
	private options: QuestionOption[];
	private defaultAnswer: string;
	private minimum: string;
	private showWhen: ConditionState;

	constructor(
		app: App,
		private otherQuestions: Question[],
		private computed: ComputedVariable[] | undefined,
		private initial: Question | null,
		private onSave: (question: Question) => void,
	) {
		super(app);
		this.label = initial?.label ?? '';
		this.type = initial?.type ?? 'toggle';
		this.options = (initial?.options ?? []).map((option) => ({ ...option }));
		this.defaultAnswer = initial?.default ?? '';
		this.minimum = initial?.min !== undefined ? String(initial.min) : '1';
		this.showWhen = loadConditionState(initial?.showWhen);
	}

	onOpen(): void {
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h3', { text: this.initial ? 'Edit question' : 'Add question' });

		new Setting(contentEl).setName('Question').addText((text) =>
			text.setPlaceholder('Do you have pets?').setValue(this.label).onChange((value) => {
				this.label = value;
			}),
		);

		new Setting(contentEl).setName('Answer type').addDropdown((dropdown) =>
			dropdown
				.addOption('toggle', 'Yes / no')
				.addOption('select', 'Choice list')
				.addOption('date', 'Date')
				.addOption('number', 'Number')
				.setValue(this.type)
				.onChange((value) => {
					this.type = value as Question['type'];
					this.defaultAnswer = '';
					this.render();
				}),
		);

		if (this.type === 'select') {
			this.renderAnswers(contentEl);
		}
		if (this.type === 'number') {
			new Setting(contentEl).setName('Minimum').addText((text) =>
				text.setValue(this.minimum).onChange((value) => {
					this.minimum = value;
				}),
			);
		}
		this.renderDefault(contentEl);

		renderCondition(
			contentEl,
			'Show this question when',
			conditionSources(this.otherQuestions, this.computed, this.initial?.id),
			this.showWhen,
			() => {},
		);

		new Setting(contentEl).addButton((button) =>
			button.setButtonText('Save').setCta().onClick(() => this.save()),
		);
	}

	private renderAnswers(contentEl: HTMLElement): void {
		for (const option of this.options) {
			new Setting(contentEl)
				.setDesc(`Answer id: ${option.id}`)
				.addText((text) =>
					text.setPlaceholder('Answer').setValue(option.label).onChange((value) => {
						option.label = value;
					}),
				)
				.addExtraButton((button) =>
					button.setIcon('trash').setTooltip('Delete answer').onClick(() => {
						this.options = this.options.filter((candidate) => candidate !== option);
						if (this.defaultAnswer === option.id) {
							this.defaultAnswer = '';
						}
						this.render();
					}),
				);
		}
		new Setting(contentEl).addButton((button) =>
			button.setButtonText('Add answer').onClick(() => {
				const id = uniqueId(
					slugify('New answer'),
					new Set(this.options.map((option) => option.id)),
				);
				this.options.push({ id, label: 'New answer' });
				this.render();
			}),
		);
	}

	private renderDefault(contentEl: HTMLElement): void {
		if (this.type === 'toggle') {
			new Setting(contentEl).setName('Default answer').addDropdown((dropdown) => {
				dropdown.addOption('', 'No default');
				for (const answer of toggleOptions()) {
					dropdown.addOption(answer.id, answer.label);
				}
				dropdown.setValue(this.defaultAnswer).onChange((value) => {
					this.defaultAnswer = value;
				});
			});
		} else if (this.type === 'select') {
			new Setting(contentEl).setName('Default answer').addDropdown((dropdown) => {
				dropdown.addOption('', 'No default');
				for (const answer of this.options) {
					dropdown.addOption(answer.id, answer.label);
				}
				dropdown.setValue(this.defaultAnswer).onChange((value) => {
					this.defaultAnswer = value;
				});
			});
		} else if (this.type === 'date') {
			new Setting(contentEl)
				.setName('Default date')
				.setDesc('Today, a fixed date like 2026-09-27, or empty.')
				.addText((text) =>
					text.setPlaceholder('Today').setValue(this.defaultAnswer).onChange((value) => {
						this.defaultAnswer = value;
					}),
				);
		} else {
			new Setting(contentEl).setName('Default number').addText((text) =>
				text.setPlaceholder('3').setValue(this.defaultAnswer).onChange((value) => {
					this.defaultAnswer = value;
				}),
			);
		}
	}

	private save(): void {
		const label = this.label.trim();
		if (!label) {
			new Notice('The question needs a label.');
			return;
		}
		if (this.type === 'select' && this.options.length === 0) {
			new Notice('A choice list needs at least one answer.');
			return;
		}
		let min: number | undefined;
		if (this.type === 'number') {
			min = Number(this.minimum);
			if (!Number.isFinite(min) || min < 0) {
				new Notice('The minimum must be a number of at least 0.');
				return;
			}
		}
		if (
			this.type === 'date' &&
			this.defaultAnswer !== '' &&
			this.defaultAnswer.toLowerCase() !== 'today' &&
			!/^\d{4}-\d{2}-\d{2}$/.test(this.defaultAnswer)
		) {
			new Notice('The default date must be "today" or a date like 2026-09-27.');
			return;
		}

		// The id always follows the label (slugified, and suffixed when the
		// slug is already taken by another question or computed value).
		const takenIds = new Set<string>([
			...this.otherQuestions.map((q) => q.id),
			...(this.computed ?? []).map((c) => c.name),
		]);
		const question: Question = {
			id: uniqueId(slugify(label), takenIds),
			label,
			type: this.type,
		};
		if (this.type === 'select') {
			question.options = this.options.map((option) => ({ ...option }));
		}
		if (this.type === 'number') {
			question.min = min;
		}
		if (this.defaultAnswer !== '') {
			question.default =
				this.type === 'date' && this.defaultAnswer.toLowerCase() === 'today'
					? 'today'
					: this.defaultAnswer;
		}
		if (this.showWhen.source !== ALWAYS) {
			const condition = buildCondition(this.showWhen);
			if (condition) {
				question.showWhen = condition;
			}
		}
		this.onSave(question);
		this.close();
	}
}

function buildCondition(state: ConditionState): { question: string; equals?: string; greaterThan?: string } | null {
	if (state.source === ALWAYS) {
		return null;
	}
	const greaterThan = state.greaterThan.trim();
	if (greaterThan !== '') {
		return { question: state.source, greaterThan };
	}
	if (state.equals !== '') {
		return { question: state.source, equals: state.equals };
	}
	return null;
}

export class SectionEditorModal extends Modal {
	private title: string;
	private items: ItemState[];
	private includeWhen: ConditionState;

	constructor(
		app: App,
		private questions: Question[],
		private computed: ComputedVariable[] | undefined,
		private existingIds: Set<string>,
		private initial: ChecklistSection | null,
		private onSave: (section: ChecklistSection) => void,
	) {
		super(app);
		this.title = initial?.title ?? '';
		this.items = (initial?.items ?? []).map((item) => {
			const asObject = typeof item === 'string' ? { text: item } : item;
			const state = loadConditionState(asObject.when);
			return {
				text: asObject.text,
				whenSource: state.source,
				whenEquals: state.equals,
				whenGreaterThan: state.greaterThan,
			};
		});
		this.includeWhen = loadConditionState(initial?.includeWhen);
	}

	onOpen(): void {
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h3', { text: this.initial ? 'Edit section' : 'Add section' });

		new Setting(contentEl).setName('Section title').addText((text) =>
			text.setPlaceholder('Work items').setValue(this.title).onChange((value) => {
				this.title = value;
			}),
		);

		renderCondition(
			contentEl,
			'Include this section when',
			conditionSources(this.questions, this.computed),
			this.includeWhen,
			() => {},
		);

		contentEl.createEl('h4', { text: 'Items' });
		contentEl.createDiv({
			cls: 'setting-item-description',
			text: 'Item text can contain computed values in braces, like "Pack {ceil(days / 2)} t-shirts".',
		});
		const sources = conditionSources(this.questions, this.computed);
		for (const item of this.items) {
			const row = new Setting(contentEl);
			row.addText((text) =>
				text.setPlaceholder('Checklist item').setValue(item.text).onChange((value) => {
					item.text = value;
				}),
			);
			row.addDropdown((dropdown) => {
				dropdown.addOption(ALWAYS, 'Always');
				for (const source of sources) {
					dropdown.addOption(source.id, source.label);
				}
				dropdown.setValue(item.whenSource).onChange((value) => {
					item.whenSource = value;
					item.whenEquals = '';
					item.whenGreaterThan = '';
					this.render();
				});
			});
			const source = sources.find((candidate) => candidate.id === item.whenSource);
			if (source?.kind === 'answers') {
				row.addDropdown((dropdown) => {
					dropdown.addOption('', 'Any answer');
					for (const answer of source.answers ?? []) {
						dropdown.addOption(answer.id, answer.label);
					}
					dropdown.setValue(item.whenEquals).onChange((value) => {
						item.whenEquals = value;
					});
				});
			} else if (source?.kind === 'numeric') {
				row.addText((text) =>
					text.setPlaceholder('> 7').setValue(item.whenGreaterThan).onChange((value) => {
						item.whenGreaterThan = value;
					}),
				);
			}
			row.addExtraButton((button) =>
				button.setIcon('trash').setTooltip('Delete item').onClick(() => {
					this.items = this.items.filter((candidate) => candidate !== item);
					this.render();
				}),
			);
		}
		new Setting(contentEl).addButton((button) =>
			button.setButtonText('Add item').onClick(() => {
				this.items.push({ text: '', whenSource: ALWAYS, whenEquals: '', whenGreaterThan: '' });
				this.render();
			}),
		);

		new Setting(contentEl).addButton((button) =>
			button.setButtonText('Save').setCta().onClick(() => this.save()),
		);
	}

	private save(): void {
		const title = this.title.trim();
		if (!title) {
			new Notice('The section needs a title.');
			return;
		}
		const items: ChecklistItem[] = this.items
			.filter((item) => item.text.trim())
			.map((item) => {
				const text = item.text.trim();
				const condition = buildCondition({
					source: item.whenSource,
					equals: item.whenEquals,
					greaterThan: item.whenGreaterThan,
				});
				return condition ? { text, when: condition } : { text };
			});
		if (items.length === 0) {
			new Notice('The section needs at least one item.');
			return;
		}
		// The id always follows the title (slugified, and suffixed when the
		// slug is already taken by another section).
		const takenIds = new Set(this.existingIds);
		if (this.initial) {
			takenIds.delete(this.initial.id);
		}
		const section: ChecklistSection = {
			id: uniqueId(slugify(title), takenIds),
			title,
			items,
		};
		const includeWhen = buildCondition(this.includeWhen);
		if (includeWhen) {
			section.includeWhen = includeWhen;
		}
		this.onSave(section);
		this.close();
	}
}

export class ComputedEditorModal extends Modal {
	private name: string;
	private expression: string;

	constructor(
		app: App,
		private initial: ComputedVariable | null,
		private onSave: (variable: ComputedVariable) => void,
	) {
		super(app);
		this.name = initial?.name ?? '';
		this.expression = initial?.expression ?? '';
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl('h3', { text: this.initial ? 'Edit computed value' : 'Add computed value' });
		new Setting(contentEl)
			.setName('Name')
			.setDesc('Used in item text and conditions, like "days".')
			.addText((text) =>
				text.setValue(this.name).onChange((value) => {
					this.name = value;
				}),
			);
		new Setting(contentEl)
			.setName('Expression')
			.setDesc('Arithmetic over date answers (in days from today), number answers, and earlier computed values, like "return - departure".')
			.addText((text) =>
				text.setPlaceholder('Trip length').setValue(this.expression).onChange((value) => {
					this.expression = value;
				}),
			);
		new Setting(contentEl).addButton((button) =>
			button.setButtonText('Save').setCta().onClick(() => this.save()),
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private save(): void {
		const name = slugify(this.name);
		if (!name || name === 'item') {
			new Notice('The computed value needs a name.');
			return;
		}
		if (!isParseableExpression(this.expression)) {
			new Notice('The expression is not valid arithmetic.');
			return;
		}
		this.onSave({ name, expression: this.expression });
		this.close();
	}
}

export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private message: string,
		private confirmText: string,
		private onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl('p', { text: this.message });
		new Setting(contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText(this.confirmText)
					.setWarning()
					.onClick(() => {
						this.close();
						this.onConfirm();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
