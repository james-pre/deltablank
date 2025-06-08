/* eslint-disable @typescript-eslint/no-empty-object-type */
import { pick } from 'utilium';
import type { Entity, EntityJSON } from './entity.js';
import { logger } from './utils.js';

export abstract class Component<TMix extends {} = any, TData extends {} = TMix, TConfig extends {} = {}> {
	protected get config(): TConfig {
		return this.entity.constructor.config;
	}

	constructor(protected entity: Entity<[Component<TMix, TData, TConfig>]> & TMix) {}

	setup?(): TMix | Promise<TMix>;
	load?(data: EntityJSON & TData): void | Promise<void>;
	tick?(): void | Promise<void>;
	dispose?(): void | Promise<void>;
	toJSON?(): TData;
}

export type ComponentMixin<T extends Component> = T extends Component<infer TMix, any> ? TMix : never;

export type ComponentData<T extends Component> = T extends Component<any, infer TData> ? TData : never;

export type ComponentConfig<T extends Component> = T extends Component<any, any, infer Config> ? Config : {};

/**
 * A small utility components that copies data between an entity and its JSON representation.
 * This allows for custom data to easily be used without overriding an entity's `toJSON` and `load` methods.
 */
export class CopyData<TData extends {} = any> extends Component<TData, TData, { copy_data: (keyof TData)[] | TData }> {
	protected keys!: (keyof TData)[];

	setup(): TData {
		let { copy_data } = this.config;
		if (Array.isArray(copy_data)) {
			copy_data = Object.fromEntries(copy_data.map(key => [key, undefined])) as TData;
		}

		this.keys = Object.keys(copy_data) as (keyof TData)[];
		return copy_data;
	}

	toJSON(): TData {
		return pick(this.entity, this.keys);
	}

	load(data: EntityJSON & TData): void {
		Object.assign(this.entity, pick(data, this.keys));
	}
}

export function registerComponent<T extends typeof Component<any, any, any>>(component: T): void {
	if (componentRegistry.has(component.name)) {
		throw new Error(`Component with name "${component.name}" already exists`);
	}
	componentRegistry.set(component.name, component);
	logger.debug(`Registered component: ${component.name}`);
}

export const componentRegistry = new Map<string, typeof Component>();
