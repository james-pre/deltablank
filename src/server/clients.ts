import type { Socket } from 'socket.io';

import { level } from './server.js';
import { blacklist } from './config.js';
import { execCommandString } from './commands.js';
import { logger } from './utils.js';
import { io } from './transport.js';
import { Entity, type EntityJSON } from '../core/entity.js';
import type { UUID } from 'utilium';

export class Client extends Entity {
	lastMessager?: Client;
	sentPackets = 0;
	constructor(
		id: UUID,
		public readonly socket: Socket
	) {
		super(id, level);
	}

	kick(message: string) {
		this.socket.emit('kick', message);
		this.socket.disconnect();
	}

	ban(message: string) {
		this.kick(`You have been banned from this server: ${message}`);
		blacklist.add(this.id);
	}

	toJSON(): EntityJSON {
		return Object.assign(super.toJSON(), { nodeType: 'Player' });
	}
}

export function getDisconnectReason(reason: string): string {
	const reasons = new Map([
		['server namespace disconnect', 'Disconnected by server'],
		['client namespace disconnect', 'Client disconnected'],
		['ping timeout', 'Connection timed out'],
		['transport close', 'Lost Connection'],
		['transport error', 'Connection failed'],
	]);
	return reasons.get(reason) ?? reason;
}

export const clients = new Map<string, Client>();

export function getClientBy<T extends keyof Client>(key: T, value: Client[T]): Client {
	for (const client of clients.values()) {
		if (client[key] == value) {
			return client;
		}
	}

	throw new ReferenceError('Client does not exist');
}

export function getClientByID(id: UUID): Client {
	return getClientBy('id', id);
}

export function getClientByName(name: string): Client {
	return getClientBy('name', name);
}

export function addClient(client: Client) {
	io.emit(
		'playerlist',
		[...clients.values()].slice(0, 25).map(client => client.name)
	);
	client.socket.onAny(() => {
		client.sentPackets++;
	});
	client.socket.on('disconnect', reason => {
		const message = getDisconnectReason(reason);
		logger.info(`${client.name} left (${message})`);
		io.emit('chat', `${client.name} left`);
		clients.delete(client.socket.id);
		io.emit(
			'playerlist',
			[...clients.values()].slice(0, 25).map(client => client.name)
		);
	});
	client.socket.on('command', commandString => {
		const result = execCommandString(commandString, { executor: client });
		if (result) {
			client.socket.emit('chat', result);
		}
	});
	client.socket.on('chat', data => {
		logger.info(`(Chat) ${client.name}: ${data}`);
		io.emit('chat', `${client.name}: ${data}`);
	});
}
