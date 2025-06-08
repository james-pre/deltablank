import { componentRegistry, type Component } from './component.js';
import { entityRegistry, type Entity } from './entity.js';
import { logger } from './utils.js';

export const commands: Map<string, Command> = new Map();

export interface CommandExecutionContext {
	executor: Entity & { permissionLevel?: number };
}

export interface Command<T extends CommandExecutionContext = CommandExecutionContext> {
	name: string;
	exec(context: T, ...args: string[]): string | void;
	permissionLevel: number;
}

export function execCommandString(commandString: string, context: CommandExecutionContext, ignoreOp?: boolean): string | void {
	context.executor.permissionLevel ??= 0;
	for (const [name, command] of commands) {
		if (!commandString.startsWith(name)) continue;

		if (context.executor.permissionLevel < command.permissionLevel && !ignoreOp) {
			return 'You do not have permission to execute that command';
		}

		const args = commandString
			.slice(name.length)
			.split(/\s/)
			.filter(a => a);

		if (typeof command.exec != 'function') {
			return 'Command is not implemented';
		}

		return command.exec(context, ...args);
	}

	return 'Command does not exist';
}

export function addCommand<T extends CommandExecutionContext = CommandExecutionContext>(command: Command<T>): void {
	if (commands.has(command.name)) throw new Error(`Command with name "${command.name}" already exists`);

	commands.set(command.name, command);
	logger.debug(`Added command: ${command.name}`);
}

addCommand({
	name: 'debug:list_commands',
	permissionLevel: 0,
	exec() {
		return Array.from(commands.keys())
			.filter(cmd => !cmd.startsWith('debug:'))
			.join(', ');
	},
});

addCommand({
	name: 'debug:list_entities',
	permissionLevel: 0,
	exec($, includeComponents = 'false') {
		const include = includeComponents === 'true';

		return include
			? Object.entries(entityRegistry)
					.map(([name, Entity]) => `${name} => ${Entity.name} {${(Entity.components as (typeof Component)[]).map(c => c.name).join(', ')}}`)
					.join('\n')
			: Object.keys(entityRegistry).join(', ');
	},
});

addCommand({
	name: 'debug:list_components',
	permissionLevel: 0,
	exec() {
		return Array.from(componentRegistry.keys()).join(', ');
	},
});
