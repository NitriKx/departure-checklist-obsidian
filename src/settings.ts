import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { cloneConfig, getActiveConfig } from './config';
import { DEFAULT_CONFIG } from './defaultConfig';
import {
	ComputedEditorModal,
	ConfirmModal,
	QuestionEditorModal,
	SectionEditorModal,
} from './editors';
import DepartureChecklistPlugin from './main';
import {
	ChecklistConfig,
	ChecklistSection,
	ComputedVariable,
	Question,
} from './types';
import { validateConditions } from './validate';

export interface DepartureChecklistSettings {
	checklistFolder: string;
	rememberAnswers: boolean;
	lastAnswers: Record<string, string>;
	customConfig: ChecklistConfig | null;
}

export const DEFAULT_SETTINGS: DepartureChecklistSettings = {
	checklistFolder: 'Checklists',
	rememberAnswers: true,
	lastAnswers: {},
	customConfig: null,
};

export class DepartureChecklistSettingTab extends PluginSettingTab {
	plugin: DepartureChecklistPlugin;

	constructor(app: App, plugin: DepartureChecklistPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const config = getActiveConfig(this.plugin.settings.customConfig);

		new Setting(containerEl).setName('Checklist output').setHeading();

		new Setting(containerEl)
			.setName('Checklist folder')
			.setDesc('Folder where generated checklist notes are created.')
			.addText((text) =>
				text
					.setPlaceholder('Checklists')
					.setValue(this.plugin.settings.checklistFolder)
					.onChange(async (value) => {
						this.plugin.settings.checklistFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Remember answers')
			.setDesc('Pre-fill the questionnaire with the answers from your last run.')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.rememberAnswers).onChange(async (value) => {
					this.plugin.settings.rememberAnswers = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl).setName('Questions and answers').setHeading();
		for (const question of config.questions) {
			const description =
				question.type === 'toggle'
					? 'Yes / no'
					: question.type === 'date'
						? 'Date'
						: question.type === 'number'
							? `Number (minimum ${question.min ?? 1})`
							: (question.options ?? []).map((option) => option.label).join(', ');
			new Setting(containerEl)
				.setName(question.label)
				.setDesc(`${description}\nId: ${question.id}`)
				.addExtraButton((button) =>
					button.setIcon('pencil').setTooltip('Edit').onClick(() => this.editQuestion(question)),
				)
				.addExtraButton((button) =>
					button
						.setIcon('trash')
						.setTooltip('Delete')
						.onClick(() => this.deleteQuestion(question)),
				);
		}
		new Setting(containerEl).addButton((button) =>
			button.setButtonText('Add question').setIcon('plus').onClick(() => this.addQuestion()),
		);

		new Setting(containerEl)
			.setName('Computed values')
			.setHeading()
			.setDesc('Named numbers derived from your answers, usable in item text and conditions.');
		for (const variable of config.computed ?? []) {
			new Setting(containerEl)
				.setName(variable.name)
				.setDesc(variable.expression)
				.addExtraButton((button) =>
					button
						.setIcon('pencil')
						.setTooltip('Edit')
						.onClick(() => this.editComputed(variable)),
				)
				.addExtraButton((button) =>
					button
						.setIcon('trash')
						.setTooltip('Delete')
						.onClick(() => this.deleteComputed(variable)),
				);
		}
		new Setting(containerEl).addButton((button) =>
			button.setButtonText('Add computed value').setIcon('plus').onClick(() => this.addComputed()),
		);

		new Setting(containerEl).setName('Checklist sections').setHeading();
		for (const section of config.sections) {
			new Setting(containerEl)
				.setName(section.title)
				.setDesc(`${section.items.length} items`)
				.addExtraButton((button) =>
					button.setIcon('pencil').setTooltip('Edit').onClick(() => this.editSection(section)),
				)
				.addExtraButton((button) =>
					button
						.setIcon('trash')
						.setTooltip('Delete')
						.onClick(() => this.deleteSection(section)),
				);
		}
		new Setting(containerEl).addButton((button) =>
			button.setButtonText('Add section').setIcon('plus').onClick(() => this.addSection()),
		);

		new Setting(containerEl)
			.setName('Restore built-in content')
			.setDesc('Discard your custom questions and sections and go back to the defaults.')
			.addButton((button) =>
				button.setButtonText('Restore').setWarning().onClick(() => {
					new ConfirmModal(
						this.app,
						'Restore the built-in questions and sections? Your customizations will be lost.',
						'Restore',
						() => {
							this.plugin.settings.customConfig = null;
							void this.plugin.saveSettings();
							this.display();
						},
					).open();
				}),
			);
	}

	/** Apply a change to the custom config, persist it, and refresh the tab. */
	private async mutate(change: (config: ChecklistConfig) => void): Promise<void> {
		if (!this.plugin.settings.customConfig) {
			this.plugin.settings.customConfig = cloneConfig(DEFAULT_CONFIG);
		}
		const config = this.plugin.settings.customConfig;
		change(config);
		await this.plugin.saveSettings();
		const errors = validateConditions(getActiveConfig(config));
		if (errors.length > 0) {
			new Notice(`Departure checklist:\n${errors.join('\n')}`, 10000);
		}
		this.display();
	}

	private editQuestion(question: Question): void {
		const config = getActiveConfig(this.plugin.settings.customConfig);
		const others = config.questions.filter((candidate) => candidate.id !== question.id);
		new QuestionEditorModal(this.app, others, config.computed, question, (updated) => {
			void this.mutate((current) => {
				const index = current.questions.findIndex((candidate) => candidate.id === updated.id);
				if (index >= 0) {
					current.questions[index] = updated;
				} else {
					current.questions.push(updated);
				}
			});
		}).open();
	}

	private addQuestion(): void {
		const config = getActiveConfig(this.plugin.settings.customConfig);
		new QuestionEditorModal(this.app, config.questions, config.computed, null, (question) => {
			void this.mutate((current) => {
				current.questions.push(question);
			});
		}).open();
	}

	private deleteQuestion(question: Question): void {
		new ConfirmModal(
			this.app,
			`Delete the question "${question.label}"? Sections that depend on it will be reported.`,
			'Delete',
			() => {
				void this.mutate((current) => {
					current.questions = current.questions.filter(
						(candidate) => candidate.id !== question.id,
					);
				});
			},
		).open();
	}

	private editSection(section: ChecklistSection): void {
		const config = getActiveConfig(this.plugin.settings.customConfig);
		new SectionEditorModal(
			this.app,
			config.questions,
			config.computed,
			new Set(config.sections.map((candidate) => candidate.id)),
			section,
			(updated) => {
				void this.mutate((current) => {
					const index = current.sections.findIndex(
						(candidate) => candidate.id === updated.id,
					);
					if (index >= 0) {
						current.sections[index] = updated;
					} else {
						current.sections.push(updated);
					}
				});
			},
		).open();
	}

	private addSection(): void {
		const config = getActiveConfig(this.plugin.settings.customConfig);
		new SectionEditorModal(
			this.app,
			config.questions,
			config.computed,
			new Set(config.sections.map((candidate) => candidate.id)),
			null,
			(section) => {
				void this.mutate((current) => {
					current.sections.push(section);
				});
			},
		).open();
	}

	private editComputed(variable: ComputedVariable): void {
		new ComputedEditorModal(this.app, variable, (updated) => {
			void this.mutate((current) => {
				if (!current.computed) {
					current.computed = [];
				}
				const index = current.computed.findIndex(
					(candidate) => candidate.name === updated.name,
				);
				if (index >= 0) {
					current.computed[index] = updated;
				} else {
					current.computed.push(updated);
				}
			});
		}).open();
	}

	private addComputed(): void {
		new ComputedEditorModal(this.app, null, (variable) => {
			void this.mutate((current) => {
				if (!current.computed) {
					current.computed = [];
				}
				current.computed.push(variable);
			});
		}).open();
	}

	private deleteComputed(variable: ComputedVariable): void {
		new ConfirmModal(
			this.app,
			`Delete the computed value "${variable.name}"? Items that use it will show "?" instead of a number.`,
			'Delete',
			() => {
				void this.mutate((current) => {
					current.computed = (current.computed ?? []).filter(
						(candidate) => candidate.name !== variable.name,
					);
				});
			},
		).open();
	}

	private deleteSection(section: ChecklistSection): void {
		new ConfirmModal(
			this.app,
			`Delete the section "${section.title}"?`,
			'Delete',
			() => {
				void this.mutate((current) => {
					current.sections = current.sections.filter(
						(candidate) => candidate.id !== section.id,
					);
				});
			},
		).open();
	}
}
