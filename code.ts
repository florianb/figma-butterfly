import Action, {ActionObject} from './lib/action.js';
import Version from './lib/version.js';
import Plugin from './lib/plugin.js';

// @ts-expect-error: TS2307
import ui from './ui.html';

interface SettingsObject {
	useRfc?: boolean;
	updateName?: boolean;
	useCommitMessage?: boolean;
}

const versionRegex = /@(\d+\.\d+\.\d+(-rfc\.\d+)?)$/im;

function deriveActions(node: BaseNode, version?: Version, useRfc?: boolean, updateName?: boolean): ActionObject[] {
	const versionFromName = getVersionFromName(node);
	const actions: ActionObject[] = [{
		version: version ? version.toString() : null,
		label: 'keep',
	}];

	if (version) {
		const options
			= version
				.deriveOptions(useRfc)
				.map(versionObject => {
					const newVersion = new Version(versionObject);
					const label = version.elevatedLevel(newVersion) || 'keep';
					const action = new Action(node, newVersion, label);

					return action.toObject();
				});

		actions.push(...options);
	} else {
		const initialVersion = new Version(undefined, useRfc);
		const action = new Action(node, initialVersion, 'initial');

		actions.push(action.toObject());
	}

	const hasOneVersionUndefined = (!versionFromName !== !version);
	const hasDifferentVersion = (Boolean(versionFromName) && Boolean(version) && !version.equals(versionFromName));
	if (updateName && (hasOneVersionUndefined || hasDifferentVersion)) {
		actions.push({
			nodeId: node.id,
			version: versionFromName ? versionFromName.toString() : undefined,
			label: 'fromName',
		}, {
			nodeId: node.id,
			label: 'toName',
			version: version ? version.toString() : undefined,
			nameVersion: versionFromName ? versionFromName.toString() : undefined,
		});
	}

	return actions;
}

function getVersionFromName(node: BaseNode): undefined | Version {
	const name = node.name;
	const match = versionRegex.exec(name);

	if (match) {
		return new Version(match[1]);
	}

	return undefined;
}

function updateVersionInName(node: BaseNode, version?: Version | string): void {
	const name = node.name;
	const hasVersionInName = getVersionFromName(node) !== undefined;

	if (version === undefined || version === '') {
		node.name = name.replace(versionRegex, '');
	} else {
		const newVersionString = `@${version.toString()}`;

		node.name = hasVersionInName
			? name.replace(versionRegex, newVersionString)
			: `${name}${newVersionString}`;
	}
}

const selectionChange = (): void => {
	updateUi(true);
};

figma.on('selectionchange', selectionChange);
figma.on('close', () => {
	figma.off('selectionchange', selectionChange);
});

// eslint-disable-next-line unicorn/prefer-add-event-listener
figma.ui.onmessage = message => {
	switch (message.type) {
		case 'settings': {
			const settings: SettingsObject = {
				useRfc: false,
				useCommitMessage: false,
				updateName: false,
				...(Plugin.getConfig('settings') as SettingsObject),
			};

			figma.ui.postMessage({
				type: 'settings',
				settings,
			});

			break;
		}

		case 'updateSettings': {
			const oldSettings = (Plugin.getConfig('settings') || {}) as SettingsObject;
			const newSettings = {...oldSettings, ...(message.settings as SettingsObject)};

			Plugin.setConfig('settings', newSettings);

			updateUi();
			break;
		}

		case 'updateVersion': {
			const action = message.action as ActionObject;
			const node = figma.getNodeById(action.nodeId);
			const {updateName} = (Plugin.getConfig('settings') || {}) as SettingsObject;
			const version = action.version ? new Version(action.version) : '';

			Plugin.setVersion(node, version);
			if (updateName) {
				updateVersionInName(node, version);
			}

			updateUi();
			break;
		}

		default: {
			break;
		}
	}
};

function updateUi(hasSelectionChanged = false) {
	const page = figma.currentPage;
	const selection = page.selection;

	if (selection.length > 0) {
		let message = null;
		const uiOptions: ShowUIOptions = {};

		if (selection.length === 1) {
			const {useRfc, updateName} = (Plugin.getConfig('settings') || {}) as SettingsObject;
			const node = selection[0] as BaseNode;
			const version = Plugin.getVersion(node);
			const history = Plugin.getHistory(node);

			const actions = deriveActions(node, version, useRfc, updateName);

			uiOptions.title = node.name;
			message = {
				type: 'actions',
				data: actions,
				history,
			};
		} else {
			const selectedNodes = selection.map(node => {
				const versionValue = Plugin.getNode(node, 'version') as string | undefined;
				const version = versionValue ? (new Version(versionValue)).toString() : null;

				return {
					id: node.id,
					name: node.name,
					version,
				};
			});

			message = {
				type: 'list',
				data: selectedNodes,
			};
		}

		figma.showUI(ui, uiOptions);
		figma.ui.postMessage(message);
	} else {
		const closeMessage = hasSelectionChanged ? undefined : 'Semantic Versioning requires selected Nodes.';

		figma.closePlugin(closeMessage);
	}
}

if (figma.editorType === 'figma') {
	updateUi();
} else {
	figma.closePlugin('Semantic Versioning is currently only running in Figma Design.');
}
