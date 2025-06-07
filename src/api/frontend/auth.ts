/**
 * The current token used for authentication
 */
export let authToken: string;

/**
 * Sets the authentication token
 * @param token the new token
 */
export function auth(token: string): void {
	authToken = token;
}
