import { writeFileSync } from 'node:fs';
import { List } from 'utilium';

// whitelist

export const whitelist = new List<string>();
whitelist.on('update', () => writeFileSync('whitelist.json', JSON.stringify(whitelist)));

// blacklist

export const blacklist = new List<string>();
blacklist.on('update', () => writeFileSync('blacklist.json', JSON.stringify(blacklist)));

//operators

export interface OpsEntry {
	id: string;
	bypassLimit: boolean;
	oplvl: number;
}

export const ops = new List<OpsEntry>();
ops.on('update', () => writeFileSync('ops.json', JSON.stringify(ops)));

export interface ServerConfig {
	whitelist: boolean;
	blacklist: boolean;
	max_clients: number;
	message: string;
	debug: boolean;
	port: number;
	public_uptime: boolean;
	public_log: boolean;
	tick_rate: number;
}

export const config: ServerConfig = {
	whitelist: false,
	blacklist: true,
	max_clients: 10,
	message: '',
	debug: false,
	public_log: false,
	public_uptime: false,
	port: 1123,
	tick_rate: 60,
};
