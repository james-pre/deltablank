import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { EventEmitter } from 'eventemitter3';
import { assignWithDefaults, type UUID } from 'utilium';
import type { Component } from './component.js';
import type { Level } from './level.js';
import { logger, type Instances } from './utils.js';

export interface EntityJSON {
	id: UUID;
	type: string;
	name: string;
	parent?: string;
	position: [number, number, number];
	rotation: [number, number, number];
}

export class Entity<Config extends {} = any>
	extends EventEmitter<{
		created: [];
	}>
	implements AsyncDisposable
{
	protected components = new Set<Component>();

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

	declare ['constructor']: typeof Entity & { config: Config };

	public constructor(
		public id: UUID = crypto.randomUUID(),
		public readonly level: Level
	) {
		super();
		this.id ||= crypto.randomUUID();
		level.entities.add(this);

		queueMicrotask(() => this.emit('created'));
	}

	public setup?(): void | Promise<void>;

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
		for (const component of this.components) await component.dispose();
		this.level.entities.delete(this);
		this.level.emit('entity_removed', this.toJSON());
	}

	public async [Symbol.asyncDispose](): Promise<void> {
		await this.dispose();
	}

	public toJSON(): EntityJSON {
		return Object.assign(
			{
				id: this.id,
				type: this.type,
				name: this.name,
				parent: this.parent?.id,
				position: this.position.asArray(),
				rotation: this.rotation.asArray(),
			},
			...this.components.values().map(c => c.toJSON())
		);
	}

	public load(data: Partial<EntityJSON>): void {
		assignWithDefaults(this, {
			id: data.id,
			type: data.type,
			name: data.name,
			position: data.position && Vector3.FromArray(data.position),
			rotation: data.rotation && Vector3.FromArray(data.rotation),
			parent: data.parent ? this.level.getEntityByID(data.parent) : undefined,
		} as any);
		for (const component of this.components) component.load(data);
	}
}

/**
 * An entity with some components applied
 */
export type ApplyComponents<T extends Component[], Result extends Entity = Entity> = T extends []
	? Result
	: T extends [Component<infer TMix, any>, ...infer Rest extends Component[]]
		? ApplyComponents<Rest, Result & TMix>
		: never;

export interface EntityConstructor<T extends Component[]> {
	new (...args: ConstructorParameters<typeof Entity>): ApplyComponents<T>;
}

export function EntityWithComponents<const T extends (new (...args: any[]) => Component)[]>(...components: T): EntityConstructor<Instances<T>> {
	class __WithComponents extends Entity {
		constructor(id: UUID, level: any) {
			super(id, level);

			for (const ctor of components) {
				const component = new ctor(this);
				this.components.add(component);
			}
		}
	}

	return __WithComponents as typeof __WithComponents & EntityConstructor<Instances<T>>;
}

export interface EntityRegistry extends Record<string, EntityConstructor<any>> {}

export const entityRegistry: EntityRegistry = Object.create(null);

export function registerEntity(name?: string) {
	return function __registerEntity<Class extends EntityConstructor<any>>(target: Class) {
		name ||= target.name;
		logger.debug('Registered entity type: ' + name);
		entityRegistry[name] = target;
	};
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
