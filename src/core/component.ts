import type { Entity, EntityJSON } from './entity.js';

export abstract class Component<TMix extends {} = any, TData extends {} = TMix, TConfig extends {} = {}> {
	protected get config(): TConfig {
		return this.entity.constructor.config;
	}

	constructor(protected entity: Entity<TConfig> & TMix) {}

	setup?(): TMix | Promise<TMix>;
	load?(data: EntityJSON & TData): void | Promise<void>;
	tick?(): void | Promise<void>;
	dispose?(): void | Promise<void>;
	toJSON?(): TData;
}

export type ComponentMixin<T extends Component> = T extends Component<infer TMix, any> ? TMix : never;

export type ComponentData<T extends Component> = T extends Component<any, infer TData> ? TData : never;

export type ComponentConfig<T extends Component> = T extends Component<any, any, infer Config> ? Config : never;
