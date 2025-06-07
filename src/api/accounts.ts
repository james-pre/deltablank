import type { UUID } from 'utilium';
import { Access } from './generic.js';
import type { KeyValue } from './utils.js';

export const uniqueAccountAttributes = ['id', 'username', 'email', 'token', 'session'];

export const accountAttributes = [...uniqueAccountAttributes, 'type', 'lastchange', 'created', 'is_disabled'];

/**
 * The account's level of access and status
 */
export enum AccountType {
	/**
	 * Standard accounts
	 */
	ACCOUNT = 0,
	MODERATOR = 1,

	DEVELOPER = 2,

	ADMINISTRATOR = 3,

	OWNER = 4,
}

/**
 * The result object of a response representing an account
 * @see Account
 */
export interface AccountResult {
	id: UUID;
	username: string;
	email?: string;
	type: AccountType;
	lastchange: string;
	created: string;
	is_disabled: boolean;
	token?: string;
	session?: string;
}

/**
 * The result object of a response representing an account with all data
 * @see FullAccount
 */
export interface FullAccountResult extends AccountResult {
	email: string;
	token: string;
	session: string;
}

/**
 * Represents an account
 */
export interface Account {
	/**
	 * The ID of the account
	 */
	id: UUID;

	/**
	 * The username of the account
	 */
	username: string;

	/**
	 * The email of the account
	 */
	email?: string;

	/**
	 * The type of the account
	 */
	type: AccountType;

	/**
	 * The last time the account's username was changed
	 */
	lastchange: Date;

	/**
	 * When the account was created
	 */
	created: Date;

	/**
	 * If the account is currently disabled
	 */
	is_disabled: boolean;

	/**
	 * The login token of the account
	 */
	token?: string;

	/**
	 * The session token of the account
	 */
	session?: string;

	/**
	 * The account's password hash.
	 *
	 * This is ***never*** sent by the server, it is only here for code convience when updating the password.
	 */
	password?: string;
}

/**
 * Represents an account with all data (i.e. sensitive information must be included)
 */
export interface FullAccount extends Account {
	email: string;
	token: string;
	session: string;
	password?: string;
}

export type UniqueAccountKey = 'id' | 'email' | 'username' | 'token' | 'session';

/**
 * The roles of account types
 */
export const accountRoles: { [key in AccountType]: string } & string[] = ['User', 'Moderator', 'Developer', 'Administrator', 'Owner'];

/**
 * Gets a string describing the role of the account type
 * @param type the acccount type
 * @param short whether to use the short form or not
 * @returns the role
 */
export function getAccountRole(type: AccountType, short?: boolean): string {
	if (typeof accountRoles[type] != 'string') {
		return 'Unknown' + (short ? '' : ` (${type})`);
	}
	if (!short) {
		return accountRoles[type];
	}
	switch (type) {
		case AccountType.MODERATOR:
			return 'Mod';
		case AccountType.DEVELOPER:
			return 'Dev';
		case AccountType.ADMINISTRATOR:
			return 'Admin';
		default:
			return accountRoles[type];
	}
}

/**
 * Strips private information (e.g. email, password hash, etc.) from an account
 * @param account the account to strip info from
 * @returns a new object without the stripped info
 */
export function stripAccountInfo(account: Account, access: Access = Access.PUBLIC): Account {
	const info = {
		id: account.id,
		username: account.username,
		type: account.type,
		lastchange: account.lastchange,
		created: account.created,
		is_disabled: account.is_disabled,
	};
	if (access == Access.PUBLIC) {
		return info;
	}
	Object.assign(info, {
		email: account.email,
		token: account.token,
		session: account.session,
	});
	if (access == Access.PROTECTED || access == Access.PRIVATE) {
		return info;
	}

	throw new Error('Invalid access level: ' + (access as string));
}

/**
 * Checks if `value` is a valid `key`
 * @param key The attribute to check
 * @param value The value
 */
export function checkAccountAttribute<K extends keyof FullAccount>(key: K, value: FullAccount[K]): void {
	const [_key, _value] = [key, value] as KeyValue<FullAccount>;
	switch (_key) {
		case 'id':
			if (_value.length != 32) throw new Error('Invalid ID length');
			if (!/^[0-9a-f]+$/.test(_value)) throw new Error('Invalid ID');
			break;
		case 'username':
			if (_value.length < 3 || _value.length > 20) throw new Error('Usernames must be between 3 and 20 characters.');
			if (!/^[_0-9a-zA-Z]+$/.test(_value)) throw new Error('Usernames can only contain letters, numbers, and underscores');
			if (['admin', 'administrator', 'owner', 'moderator', 'developer'].includes(_value.toLowerCase())) throw new Error('That username is not allowed');
			break;
		case 'type':
			if (typeof _value != 'number') throw new TypeError('Account type is not a number');
			if (_value < AccountType.ACCOUNT || _value > AccountType.OWNER) throw new RangeError('Account type is not valid');
			break;
		case 'email':
			if (!/^[\w.-]+@[\w-]+(\.\w{2,})+$/.test(_value)) throw new Error('Invalid email');
			break;
		case 'lastchange':
		case 'created':
			if (_value.getTime() > Date.now()) {
				throw new Error('Date is in the future');
			}
			break;
		case 'token':
		case 'session':
			if (_value.length != 64) throw new Error('Invalid token or session');
			if (!/^[0-9a-f]+$/.test(_value)) throw new Error('Invalid token or session');
			break;
		case 'is_disabled':
			if (![true, false, 1, 0, 'true', 'false'].some(v => v === _value)) throw new Error('Invalid disabled value');
			break;
		case 'password':
			break;
		default:
			throw new TypeError(`"${key}" is not an account attribute`);
	}
}

/**
 * Checks if `value` is a valid `key`
 * @param key The attribute to check
 * @param value The value
 * @returns whether the value is valid
 */
export function isValidAccountAttribute<K extends keyof FullAccount>(key: K, value: FullAccount[K]): boolean {
	try {
		checkAccountAttribute(key, value);
		return true;
	} catch (e) {
		return false;
	}
}
