import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Socket } from 'socket.io';
import { getAccount } from '../api/frontend/index.js';
import { Level, levelEventNames, type LevelJSON } from '../core/level.js';
import { Client, addClient, clients, getClientByID } from './clients.js';
import { blacklist, config, ops, whitelist, type OpsEntry, type ServerConfig } from './config.js';
import { http, io } from './transport.js';
import { logger, readJSONFile } from './utils.js';

let isStopping = false;

export let level: Level, levelData: LevelJSON | undefined;

export async function init() {
	io.use((socket, next) => {
		checkClientAuth(socket)
			.then(next)
			.catch(error => {
				if (error instanceof Error) {
					logger.error('Client auth failed: ' + error.stack);
					next(new Error('Server error'));
				} else {
					next(new Error(error + ''));
				}
			});
	});

	io.on('connection', socket => {
		addClient(clients.get(socket.id)!);
	});

	if (levelData) {
		await level.load(levelData);
	} else {
		logger.info('No level detected. Generating...');
		level = new Level();
	}

	for (const type of levelEventNames) {
		level.on(type, (...args) => {
			io.emit('event', type, ...args);
		});
	}

	setInterval(() => {
		void level.tick();
	}, 1000 / config.tick_rate);

	setInterval(() => {
		for (const client of clients.values()) {
			if (client.sentPackets > 50) {
				client.kick('Sending to many packets');
			}
			client.sentPackets = 0;
		}
	}, 1000);
}

export type LoadMode = 'assign' | 'push';

export function loadFile<T extends (OpsEntry[] & string[]) | ServerConfig>(data: T, path: string, mode: LoadMode = 'assign') {
	const contents = readJSONFile<T>(path);
	if (!contents) {
		logger.warn('Failed to load ' + resolve(path));
		return;
	}

	if (mode == 'assign') {
		Object.assign(data, contents);
		return;
	}

	if (!Array.isArray(contents) || !Array.isArray(data)) {
		throw new TypeError('Invalid data in ' + resolve(path));
	}

	data.push(...contents);
}

export function save() {
	logger.info('Saved the current level');
	writeFileSync('level.json', JSON.stringify(level.toJSON()));
}

let _onCloseHandler: (() => void) | undefined;

export function onClose(handler: () => void): void {
	_onCloseHandler = handler;
}

export async function stop() {
	isStopping = true;
	logger.info('Stopping...');
	for (const client of clients.values()) {
		client.kick('Server shutting down');
	}
	await io.close();
	http.close();
	_onCloseHandler?.();
	logger.info('Stopped');
	process.exit();
}

export async function restart() {
	isStopping = true;
	logger.info('Restarting...');
	for (const client of clients.values()) {
		client.kick('Server restarting');
	}
	await io.close();
	http.close();
	_onCloseHandler?.();
	logger.info('Restarted');
	setTimeout(() => {
		process.on('exit', () => {
			spawn(process.argv.shift()!, process.argv, {
				cwd: process.cwd(),
				detached: true,
				stdio: 'inherit',
			});
		});
	}, 1000);
	process.exit();
}

export async function checkClientAuth(socket: Socket): Promise<undefined> {
	if (isStopping) {
		throw 'Server is stopping or restarting';
	}

	const account = await getAccount('token', socket.handshake.auth.token).catch((error: string) => {
		logger.warn('API request for client authentication failed: ' + error);
		throw 'Authentication request failed';
	});

	if (!account) {
		logger.warn('Invalid account data recieved');
		throw 'Invalid account';
	}

	if (config.whitelist && !whitelist.has(account.id)) {
		throw 'You are not whitelisted';
	}

	if (config.blacklist && blacklist.has(account.id)) {
		throw 'You are banned from this server';
	}

	if (+account.is_disabled) {
		throw 'Your account is disabled';
	}

	if (io.sockets.sockets.size >= config.max_clients && ![...ops].some(op => op.id == account.id && op.bypassLimit)) {
		throw 'Server full';
	}

	if (getClientByID(account.id)) {
		throw 'Already connected';
	}

	const client = new Client(account.id, socket);
	client.name = account.username;
	clients.set(socket.id, client);
	logger.info(`${client.name} connected with socket id ${socket.id}`);
	io.emit('chat', `${client.name} joined`);
	return;
}
