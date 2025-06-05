import type { Entity } from './entity.js';

export interface CommandExecutionContext {
	executor: Entity & { permissionLevel?: number };
}

export interface Command {
	exec(context: CommandExecutionContext, ...args: string[]): string | void;
	permissionLevel: number;
}

export const commands: Map<string, Command> = new Map();

export const execCommandString = (string: string, context: CommandExecutionContext, ignoreOp?: boolean): string | void => {
	context.executor.permissionLevel ??= 0;
	for (const [name, command] of commands) {
		if (!string.startsWith(name)) {
			continue;
		}

		if (context.executor.permissionLevel < command.permissionLevel && !ignoreOp) {
			return 'You do not have permission to execute that command';
		}

		const args = string
			.slice(name.length)
			.split(/\s/)
			.filter(a => a);

		if (typeof command.exec != 'function') {
			return 'Command is not implemented';
		}

		return command.exec(context, ...args);
	}

	return 'Command does not exist';
};
