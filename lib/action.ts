import Version, {VersionObject} from './version.js';

function isAction(object: any): object is Action {
	return true;
}

export interface ActionObject {
	version: string;
	nodeId?: string;
	label: string;
}

export default class Action {
	version: Version;
	nodeId?: string;
	label: string;

	constructor(action: Action | string);
	constructor(node: BaseNode, version: Version, label: string);
	constructor(actionOrNode: Action | string | BaseNode, version?: Version, label?: string) {
		if (isAction(actionOrNode)) {
			this.version = actionOrNode.version;
			this.nodeId = actionOrNode.nodeId;
			this.label = actionOrNode.label;
		} else if (typeof actionOrNode === 'string') {
			const action = JSON.parse(actionOrNode) as ActionObject;

			this.version = new Version(action.version);
			this.nodeId = action.nodeId;
			this.label = action.label;
		} else {
			this.version = version;
			this.nodeId = actionOrNode.id;
			this.label = label;
		}
	}

	toString(): string {
		return JSON.stringify(this.toObject());
	}

	toObject(): ActionObject {
		return {
			version: this.version.toString(),
			nodeId: this.nodeId,
			label: this.label,
		};
	}
}