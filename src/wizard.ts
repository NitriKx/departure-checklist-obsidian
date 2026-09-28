import { App, Modal, Notice } from 'obsidian';
import { includedSections, scopeFor } from './builder';
import { isQuestionVisible } from './conditions';
import DepartureChecklistPlugin from './main';
import { formatDateString } from './output';
import { Answers, ChecklistConfig, Question, TOGGLE_NO, TOGGLE_YES } from './types';

/**
 * Step-by-step questionnaire. One question per screen; questions whose
 * showWhen condition is not satisfied are skipped. Ends on a summary
 * screen with the sections that will be included.
 */
export class WizardModal extends Modal {
	private answers: Answers = {};
	private index = 0;
	private onSummary = false;

	constructor(
		app: App,
		private plugin: DepartureChecklistPlugin,
		private config: ChecklistConfig,
	) {
		super(app);
	}

	onOpen(): void {
		this.answers = this.plugin.settings.rememberAnswers
			? { ...this.plugin.settings.lastAnswers }
			: {};
		this.answers = prefillDefaults(this.config, this.answers);
		if (this.config.questions.length === 0) {
			new Notice('Departure checklist: the config has no questions.');
			this.close();
			return;
		}
		this.index = this.nextVisible(-1);
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private currentScope(): Record<string, number> {
		return scopeFor(this.config, this.answers, new Date());
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		const question = this.config.questions[this.index];
		if (this.onSummary || !question) {
			this.onSummary = true;
			this.renderSummary(contentEl);
			return;
		}
		this.renderQuestion(contentEl, question);
	}

	private renderQuestion(contentEl: HTMLElement, question: Question): void {
		const total = this.config.questions.length + 1; // + summary step
		contentEl.createDiv({
			cls: 'departure-checklist-progress',
			text: `Step ${this.index + 1} of ${total}`,
		});
		contentEl.createEl('h3', { text: question.label });

		if (question.type === 'select' || question.type === 'toggle') {
			this.renderChoice(contentEl, question);
		} else {
			this.renderValueInput(contentEl, question);
		}

		const footer = contentEl.createDiv({ cls: 'departure-checklist-footer' });
		const back = footer.createDiv().createEl('button', { text: 'Back' });
		back.disabled = !this.hasVisibleBefore();
		back.addEventListener('click', () => this.move(-1));
	}

	private renderChoice(contentEl: HTMLElement, question: Question): void {
		const optionsEl = contentEl.createDiv({
			cls: 'departure-checklist-options',
		});
		const options =
			question.type === 'toggle'
				? [
						{ id: TOGGLE_YES, label: 'Yes' },
						{ id: TOGGLE_NO, label: 'No' },
					]
				: (question.options ?? []);
		for (const option of options) {
			const selected = this.answers[question.id] === option.id;
			const button = optionsEl.createEl('button', {
				cls: selected
					? 'departure-checklist-option is-selected'
					: 'departure-checklist-option',
				text: option.label,
			});
			button.addEventListener('click', () => {
				this.answers[question.id] = option.id;
				this.move(1);
			});
		}
		const skip = contentEl.createDiv({ cls: 'departure-checklist-footer' })
			.createEl('button', { text: 'Skip' });
		skip.addEventListener('click', () => this.move(1));
	}

	private renderValueInput(contentEl: HTMLElement, question: Question): void {
		const input = contentEl.createEl('input', {
			cls: 'departure-checklist-input',
			type: question.type === 'date' ? 'date' : 'number',
		});
		input.value = this.answers[question.id] ?? '';
		if (question.type === 'number') {
			input.min = String(question.min ?? 1);
		}
		input.placeholder = question.type === 'date' ? 'YYYY-MM-DD' : '';

		const next = (): void => {
			const value = input.value;
			if (question.type === 'number') {
				const parsed = Number(value);
				const minimum = question.min ?? 1;
				if (!Number.isFinite(parsed) || parsed < minimum) {
					new Notice(`Enter a number of at least ${minimum}.`);
					return;
				}
			} else if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
				new Notice('Pick a date.');
				return;
			}
			this.answers[question.id] = value;
			this.move(1);
		};

		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				next();
			}
		});

		const actions = contentEl.createDiv({ cls: 'departure-checklist-footer' });
		const nextButton = actions.createEl('button', {
			cls: 'mod-cta',
			text: 'Next',
		});
		nextButton.addEventListener('click', () => next());
		const skip = actions.createEl('button', { text: 'Skip' });
		skip.addEventListener('click', () => this.move(1));
	}

	private renderSummary(contentEl: HTMLElement): void {
		contentEl.createEl('h3', { text: 'Your checklist will include' });

		const sections = includedSections(this.config, this.answers);
		const list = contentEl.createDiv({ cls: 'departure-checklist-summary' });
		if (sections.length === 0) {
			list.createDiv({ text: 'No sections match your answers.' });
		}
		for (const { section, items } of sections) {
			list.createDiv({
				cls: 'departure-checklist-summary-item',
				text: `${section.title} (${items.length} items)`,
			});
		}

		const footer = contentEl.createDiv({ cls: 'departure-checklist-footer' });
		const back = footer.createDiv().createEl('button', { text: 'Back' });
		back.addEventListener('click', () => this.move(-1));

		const generate = footer.createEl('button', {
			cls: 'mod-cta departure-checklist-generate',
			text: 'Generate checklist',
		});
		generate.addEventListener('click', () => {
			this.close();
			void this.plugin.generateChecklist(this.config, this.answers);
		});
	}

	private move(direction: 1 | -1): void {
		if (direction === 1) {
			this.index = this.nextVisible(this.index);
			if (this.index >= this.config.questions.length) {
				this.onSummary = true;
			}
		} else {
			this.onSummary = false;
			this.index = this.previousVisible(this.index);
		}
		this.render();
	}

	private nextVisible(from: number): number {
		let index = from + 1;
		const questions = this.config.questions;
		while (index < questions.length) {
			const question = questions[index];
			if (question && isQuestionVisible(question, this.answers, this.currentScope())) {
				break;
			}
			index += 1;
		}
		return index;
	}

	private previousVisible(from: number): number {
		let index = from - 1;
		const questions = this.config.questions;
		while (index > 0) {
			const question = questions[index];
			if (question && isQuestionVisible(question, this.answers, this.currentScope())) {
				break;
			}
			index -= 1;
		}
		return Math.max(index, 0);
	}

	private hasVisibleBefore(): boolean {
		return this.previousVisible(this.index) < this.index;
	}
}

function prefillDefaults(config: ChecklistConfig, answers: Answers): Answers {
	const result = { ...answers };
	for (const question of config.questions) {
		if (result[question.id] !== undefined && result[question.id] !== '') {
			continue;
		}
		if (question.type === 'date' && question.default === 'today') {
			result[question.id] = formatDateString(new Date());
		} else if (question.default !== undefined && question.default !== '') {
			result[question.id] = question.default;
		}
	}
	return result;
}
