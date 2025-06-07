import type { Server as HTTPServer } from 'node:http';
import { createServer } from 'node:http';
import type { ListenOptions } from 'node:net';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config.js';
import { logger } from './utils.js';

export interface PingInfo {
	current_clients: number;
	max_clients: number;
	message: string;
	version: string;
	uptime?: number;
}

export let version: string;

export function setVersion(value: string): void {
	version = value;
}

export const http: HTTPServer = createServer((req, res) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	switch (req.url) {
		case '/ping':
			const data: PingInfo = {
				current_clients: io.sockets.sockets.size,
				max_clients: config.max_clients,
				message: config.message,
				version,
			};
			if (config.public_uptime) data.uptime = process.uptime();
			res.end(JSON.stringify(data));
			break;
		case '/log':
			res.writeHead(config.public_log ? 200 : 403).end(config.public_log ? logger.toString() : null);
			break;
	}
});

export const io: SocketIOServer = new SocketIOServer(http, {
	pingInterval: 1000,
	pingTimeout: 10000,
}).attach(http);

export function listen(options: ListenOptions): Promise<void> {
	return new Promise<void>(resolve => http.listen(options, resolve));
}
