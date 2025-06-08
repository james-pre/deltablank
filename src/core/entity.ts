/* eslint-disable @typescript-eslint/no-empty-object-type */
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import dedent from 'dedent';
import { EventEmitter } from 'eventemitter3';
import type { InstancesFor, UUID } from 'utilium';
import { assignWithDefaults } from 'utilium';
import type { Component, ComponentMixin } from './component.js';
import type { Level } from './level.js';
import { logger, vectorString } from './utils.js';

export interface EntityJSON {
	id: UUID;
	type: string;
	name: string;
	parent?: UUID;
	position: [number, number, number];
	rotation: [number, number, number];
}

export class Entity<TComponents extends readonly Component[] = any>
	extends EventEmitter<{
		created: [];
	}>
	implements AsyncDisposable
{
	protected components = new Set<Component>();

	public isType<T extends Entity>(type: string): this is T {
		return this.type === type;
	}

	/**
	 * @todo Make this constant time.
	 */
	public hasComponent<T extends Component>(ctor: abstract new (...args: any[]) => T): this is this & ComponentMixin<T> {
		for (const component of this.components) {
			if (component instanceof ctor) return true;
		}
		return false;
	}

	public get [Symbol.toStringTag](): string {
		return this.constructor.name;
	}

	public name: string = '';

	public get type(): string {
		return this.constructor.name;
	}

	public parent?: Entity;

	public position: Vector3 = Vector3.Zero();
	public rotation: Vector3 = Vector3.Zero();

	public get absolutePosition(): Vector3 {
		return this.parent instanceof Entity ? this.parent.absolutePosition.add(this.position) : this.position;
	}

	public get absoluteRotation(): Vector3 {
		return this.parent instanceof Entity ? this.parent.absoluteRotation.add(this.rotation) : this.rotation;
	}

	declare ['constructor']: typeof Entity & { config: EntityConfig<TComponents> };

	public constructor(
		public id: UUID = crypto.randomUUID(),
		public readonly level: Level
	) {
		super();
		this.id ||= crypto.randomUUID();
		level.entities.add(this);

		queueMicrotask(() => this.emit('created'));
	}

	public onSetup?(): void | Promise<void>;

	public async setup(): Promise<void> {
		for (const component of this.components) Object.assign(this, await component.setup?.());
		await this.onSetup?.();
	}

	public onTick?(): void | Promise<void>;

	public async tick(): Promise<void> {
		if (Math.abs(this.rotation.y) > Math.PI) {
			this.rotation.y += Math.sign(this.rotation.y) * 2 * Math.PI;
		}
		await this.onTick?.();
	}

	public onDispose?(): void | Promise<void>;

	public async dispose(): Promise<void> {
		await this.onDispose?.();
		for (const component of this.components) await component.dispose?.();
		this.level.entities.delete(this);
		this.level.emit('entity_removed', this.toJSON());
	}

	public async [Symbol.asyncDispose](): Promise<void> {
		await this.dispose();
	}

	public toJSON(): ApplyComponentsJSON<TComponents> {
		return Object.assign(
			{
				id: this.id,
				type: this.type,
				name: this.name,
				parent: this.parent?.id,
				position: this.position.asArray(),
				rotation: this.rotation.asArray(),
			},
			...this.components.values().map(c => c.toJSON?.() || {})
		);
	}

	public async load(data: Partial<ApplyComponentsJSON<TComponents>>): Promise<void> {
		assignWithDefaults(this, {
			id: data.id,
			type: data.type,
			name: data.name,
			position: data.position && Vector3.FromArray(data.position),
			rotation: data.rotation && Vector3.FromArray(data.rotation),
			parent: data.parent ? this.level.getEntityByID(data.parent) : undefined,
		} as any);
		for (const component of this.components) await component.load?.(data);
	}

	public toString(): string {
		return dedent`${this.type} ${JSON.stringify(this.name)}
		position: ${vectorString(this.position)}
		rotation: ${vectorString(this.rotation)}
		${Array.from(this.components)
			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			.map(c => `${c.constructor.name} ${c.toString === Object.prototype.toString ? '' : c.toString()}`)
			.join('\n')}
		`;
	}

	public matches(selector: string): boolean {
		if (selector == '*') return true;

		switch (selector[0]) {
			case '@':
				if (this.name == selector.slice(1)) return true;
				break;
			case '#':
				if (this.id == selector.slice(1)) return true;
				break;
			case '.':
				if (this.type.toLowerCase().includes(selector.slice(1).toLowerCase())) return true;
				break;
			default:
				throw new Error('Invalid selector');
		}
		return false;
	}
}

/**
 * Entity JSON representation with components applied.
 */
export type ApplyComponentsJSON<T extends readonly Component[], Result extends EntityJSON = EntityJSON> = T extends []
	? Result
	: T extends readonly [Component<{}, infer TData>, ...infer Rest extends readonly Component[]]
		? ApplyComponentsJSON<Rest, Result & TData>
		: never;

/**
 * An entity with some components applied
 */
export type ApplyComponents<T extends readonly Component[], Result extends Entity = Entity<T>> = T extends []
	? Result
	: T extends readonly [Component<infer TMix, any>, ...infer Rest extends readonly Component[]]
		? ApplyComponents<Rest, Result & TMix>
		: never;

/**
 * A constructor for an entity with some components.
 */
export interface EntityConstructor<T extends Component[] = any> {
	new (...args: ConstructorParameters<typeof Entity>): ApplyComponents<T>;
	components: (typeof Component)[];
}

/**
 * Extend `Entity` and automatically apply the given components.
 */
export function EntityWithComponents<const T extends (new (...args: any[]) => Component)[]>(...components: T): EntityConstructor<InstancesFor<T>> {
	class __WithComponents extends Entity {
		static components = components;

		constructor(id: UUID, level: any) {
			super(id, level);

			for (const ctor of components) {
				const component = new ctor(this);
				this.components.add(component);
			}
		}
	}

	return __WithComponents as typeof __WithComponents & EntityConstructor<InstancesFor<T>>;
}

/**
 * Configuration for an entity's components.
 */
export type EntityConfig<T extends readonly Component[]> = T extends []
	? {}
	: T extends readonly [Component<any, any, infer Config>, ...infer Rest extends readonly Component[]]
		? Config & EntityConfig<Rest>
		: never;

/**
 * Options for `EntityWith`
 * @see EntityWith
 */
export interface EntityWithOptions<T extends readonly (new (...args: any[]) => Component)[]> {
	components: T;
	config: EntityConfig<InstancesFor<T>>;
	name: string;
}

/**
 * A shortcut to create an entity class/constructor with some components and config.
 * This comes with proper TS typing of the config, unlike class extending `EntityWithComponents(...)`.
 */
export function EntityWith<const T extends readonly (new (...args: any[]) => Component)[]>(opt: EntityWithOptions<T>): EntityConstructor<InstancesFor<T>> & EntityWithOptions<T> {
	const Constructor = EntityWithComponents(...opt.components) as EntityConstructor<InstancesFor<[...T]>> & typeof opt;
	Object.defineProperties(Constructor, {
		config: { value: opt.config },
		name: { value: opt.name },
	});
	registerEntity(Constructor);
	return Constructor;
}

export interface EntityRegistry extends Record<string, EntityConstructor> {}

export const entityRegistry: EntityRegistry = Object.create(null);

export function registerEntity<Class extends EntityConstructor & { components: (typeof Component)[] }>(target: Class) {
	logger.debug('Registered entity type: ' + target.name);
	entityRegistry[target.name] = target;
}

export function* filterEntities(entities: Iterable<Entity>, selector: string): Iterable<Entity> {
	if (typeof selector != 'string') {
		throw new TypeError('selector must be of type string');
	}

	if (selector == '*') {
		yield* entities;
		return;
	}

	for (const entity of entities) {
		switch (selector[0]) {
			case '@':
				if (entity.name == selector.slice(1)) yield entity;
				break;
			case '#':
				if (entity.id == selector.slice(1)) yield entity;
				break;
			case '.':
				if (entity.type.toLowerCase().includes(selector.slice(1).toLowerCase())) yield entity;
				break;
			default:
				throw new Error('Invalid selector');
		}
	}
}
