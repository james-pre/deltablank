/**
 * Account-related endpoints
 */
import type { UUID } from 'utilium';
import type { Account, AccountResult, FullAccount, UniqueAccountKey } from '../../accounts.js';
import { accountAttributes, checkAccountAttribute } from '../../accounts.js';
import type { Access } from '../../generic.js';
import { request } from '../request.js';

/**
 * Parses the account result of a response
 * @param result the response result
 * @returns the parsed result
 */
function parseAccount<A extends Account>(result: AccountResult): A {
	const parsed: Account = {
		id: result?.id,
		username: result?.username,
		type: result?.type,
		lastchange: new Date(result?.lastchange),
		created: new Date(result?.created),
		is_disabled: result?.is_disabled,
	};
	for (const maybe of ['token', 'session', 'email'] as const) {
		if (maybe in result) {
			parsed[maybe] = result[maybe];
		}
	}
	return parsed as A;
}

/**
 * Gets the current number of accounts
 */
export async function getAccountNum(): Promise<number> {
	const result = await request<number>('GET', 'account/num');
	return result;
}

/**
 * Logs an account in
 * @param email the account's email
 * @param password the account's password
 * @returns The logged in account's data (includes the token)
 */
export async function login(email: string, password: string): Promise<Account & { token: string }> {
	checkAccountAttribute('email', email);
	const result = await request<AccountResult>('POST', 'account/login', { email, password });
	return parseAccount<Account & { token: string }>(result);
}

/**
 * Logs an account out
 * @param id the account's id
 * @param reason why the account is being logged out (Requires authentication)
 * @returns True when successful
 */
export async function logout(id: UUID, reason?: string): Promise<boolean> {
	checkAccountAttribute('id', id);
	return await request<boolean>('POST', 'account/logout', { id, reason });
}

/**
 * Creates a new account
 * @param email the account's email
 * @param username the account's username
 * @param password the account's password
 * @returns The created account's data
 */
export async function createAccount(email: string, username: string, password: string): Promise<Account> {
	checkAccountAttribute('email', email);
	checkAccountAttribute('username', username);
	const result = await request<AccountResult>('POST', 'account/create', { email, username, password });
	return parseAccount(result);
}

/**
 * Deletes an account (Requires authentication)
 * @param id the ID of the account to delete
 */
export async function deleteAccount(id: UUID, reason?: string): Promise<void> {
	checkAccountAttribute('id', id);
	await request<void>('POST', 'account/delete', { id, reason });
	return;
}

/**
 * Gets info about an account
 * @param id the account's id
 * @param key the key to identify the account with (e.g. id)
 * @param value the value of the key (e.g. the account's id)
 * @param access which level of access
 * @returns The account's data
 */
export async function getAccount(id: string, access?: Access): Promise<Account>;
export async function getAccount(key: UniqueAccountKey, value?: string, access?: Access): Promise<Account>;
export async function getAccount(key: string, value?: string | Access, access?: Access): Promise<Account> {
	if (!accountAttributes.includes(key)) {
		if (typeof value == 'number') {
			access = value;
		}
		[key, value] = ['id', key];
	}

	checkAccountAttribute(key as UniqueAccountKey, value as string);
	const result = await request<AccountResult>('POST', 'account/info', { key, value, access, multiple: false });
	return parseAccount(result);
}

/**
 * Gets info about accounts (Requires authorization: Mod)
 * @param key the key to identify accounts with (e.g. id)
 * @param value the value of the key (e.g. the accounts role)
 * @returns The accounts
 */
export async function getAccounts(key: string, value?: string, offset = 0, limit = 1000): Promise<Account[]> {
	checkAccountAttribute(key as keyof FullAccount, value);
	const results = await request<AccountResult[]>('POST', 'account/info', { key, value, offset, limit, multiple: true });
	return results.map(result => parseAccount(result));
}

/**
 * Gets info about all account (Requires authorization: Mod)
 * @returns The accounts
 */
export async function getAllAccounts(offset = 0, limit = 1000): Promise<Account[]> {
	const results = await request<AccountResult[]>('POST', 'account/info', { multiple: true, all: true, offset, limit });
	return results.map(result => parseAccount(result));
}

/**
 * Updates an attribute of an account
 * @param id the account's id
 * @param key which attribute to update
 * @param value the new value
 * @param reason the reason for the change
 * @returns the updated account data
 */
export async function update<K extends keyof FullAccount>(id: UUID, key: K, value: FullAccount[K], reason?: string): Promise<Account> {
	checkAccountAttribute('id', id);
	checkAccountAttribute(key, value);
	const result = await request<AccountResult>('POST', 'account/update', { id, key, value, reason });
	return parseAccount(result);
}

/**
 * Disables an account
 * @param id the account's id
 * @param reason why the account is being disabled (Requires authentication)
 * @returns True when successful
 */
export async function disable(id: UUID, reason?: string): Promise<boolean> {
	const account = await update(id, 'is_disabled', true, reason);
	return account.is_disabled;
}

/**
 * Enables an account
 * @param id the account's id
 * @param reason why the account is being enabled (Requires authentication)
 * @returns True when successful
 */
export async function enable(id: UUID, reason?: string): Promise<boolean> {
	const account = await update(id, 'is_disabled', false, reason);
	return !account.is_disabled;
}
