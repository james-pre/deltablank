import { getAccount } from '../api/frontend/index.js';
import { addCommand, commands } from '../core/commands.js';
import { Client, getClientByName } from './clients.js';
import { blacklist } from './config.js';
import * as server from './server.js';
import { logger } from './utils.js';

interface ExecutionContext {
	executor: Client;
}

addCommand({
	name: 'kick',
	permissionLevel: 3,
	exec({ executor }, player, ...reason: string[]) {
		const client = getClientByName(player);
		if (!client) {
			return 'Player is not online or does not exist';
		}
		client.kick(reason.join(' '));
		logger.info(`${executor.name} kicked ${player}. Reason: ${reason.join(' ')}`);
		return 'Kicked ' + player;
	},
});

addCommand({
	name: 'ban',
	permissionLevel: 4,
	exec({ executor }, player, ...reason: string[]) {
		const client = getClientByName(player);
		if (!client) {
			return 'Player is not online or does not exist';
		}
		client.ban(reason.join(' '));
		logger.info(`${executor.name} banned ${player}. Reason: ${reason.join(' ')}`);
		return 'Banned ' + player;
	},
});

addCommand<ExecutionContext>({
	name: 'unban',
	permissionLevel: 4,
	exec({ executor }, player, ...reason) {
		getAccount('username', player)
			.then(client => {
				blacklist.delete(client.id);
				logger.info(`${executor.name} unbanned ${player}. Reason: ${reason.join(' ')}`);
				executor.socket.emit('chat', `Unbanned ${player}`);
			})
			.catch(() => {
				executor.socket.emit('chat', 'Player is not online or does not exist');
			});
	},
});

addCommand({
	name: 'log',
	permissionLevel: 1,
	exec({ executor }, ...message) {
		logger.info(`${executor.name} logged ${message.join(' ')}`);
	},
});

addCommand<ExecutionContext>({
	name: 'msg',
	permissionLevel: 0,
	exec({ executor }, player, ...message) {
		if (!(getClientByName(player) instanceof Client)) {
			return 'That user is not online';
		}
		getClientByName(player).socket.emit(`[${executor.name} -> me] ${message.join(' ')}`);
		logger.info(`[${executor.name} -> ${player}] ${message.join(' ')}`);
		getClientByName(player).lastMessager = executor;
		return `[me -> ${executor.name}] ${message.join(' ')}`;
	},
});

addCommand<ExecutionContext>({
	name: 'reply',
	permissionLevel: 0,
	exec({ executor }, ...message) {
		return executor.lastMessager ? commands.get('msg')!.exec({ executor }, executor.lastMessager.name, ...message) : 'No one messaged you yet =(';
	},
});

addCommand({
	name: 'stop',
	permissionLevel: 4,
	exec() {
		void server.stop();
	},
});
addCommand({
	name: 'restart',
	permissionLevel: 4,
	exec() {
		void server.restart();
	},
});

addCommand({
	name: 'save',
	permissionLevel: 4,
	exec() {
		server.save();
		return 'Saved the current level';
	},
});
