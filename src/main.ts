import { Notice, Plugin, TFile } from 'obsidian';
import { buildChecklistMarkdown } from './builder';
import { getActiveConfig } from './config';
import { createChecklistNote, formatDateString } from './output';
import {
	DEFAULT_SETTINGS,
	DepartureChecklistSettingTab,
	DepartureChecklistSettings,
} from './settings';
import { Answers, ChecklistConfig } from './types';
import { WizardModal } from './wizard';

export default class DepartureChecklistPlugin extends Plugin {
	settings!: DepartureChecklistSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addRibbonIcon('list-checks', 'Departure checklist', () => {
			void this.openWizard();
		});

		this.addCommand({
			id: 'generate-checklist',
			name: 'Generate checklist',
			callback: () => {
				void this.openWizard();
			},
		});

		this.addSettingTab(new DepartureChecklistSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<DepartureChecklistSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async openWizard(): Promise<void> {
		const config = getActiveConfig(this.settings.customConfig);
		new WizardModal(this.app, this, config).open();
	}

	async generateChecklist(config: ChecklistConfig, answers: Answers): Promise<void> {
		const date = formatDateString(new Date());
		const markdown = buildChecklistMarkdown(config, answers, date);
		try {
			const file: TFile = await createChecklistNote(
				this.app,
				this.settings.checklistFolder,
				date,
				markdown,
			);
			await this.app.workspace.getLeaf('tab').openFile(file);
			new Notice('Departure checklist created.');
		} catch (error) {
			new Notice(`Departure checklist: could not create the note (${String(error)}).`);
			return;
		}

		if (this.settings.rememberAnswers) {
			this.settings.lastAnswers = { ...answers };
			await this.saveSettings();
		}
	}
}
