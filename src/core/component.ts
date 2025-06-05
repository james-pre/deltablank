import type { Entity, EntityJSON } from './entity.js';

export abstract class Component<TMix extends {} = any, TData extends {} = TMix, TConfig extends {} = any> {
	constructor(protected entity: Entity<TConfig> & TMix) {}

	abstract setup(): TMix | Promise<TMix>;
	abstract load(data: EntityJSON & TData): void | Promise<void>;
	abstract tick(): void | Promise<void>;
	abstract dispose(): void | Promise<void>;
	abstract toJSON(): TData;
}

export type ComponentData<T extends Component> = T extends Component<any, infer TData> ? TData : never;

export type ComponentConstructor<TMix extends {} = any, TData extends {} = any> = new () => Component<TMix, TData>;

export type ComponentConfig<T extends Component[]> = T extends []
	? {}
	: T extends [Component<any, any, infer Config>, ...infer Rest extends Component[]]
		? Config & ComponentConfig<Rest>
		: never;
