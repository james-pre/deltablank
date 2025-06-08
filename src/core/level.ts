import type { IVector3Like } from '@babylonjs/core/Maths/math.like.js';
import { PerformanceMonitor } from '@babylonjs/core/Misc/performanceMonitor.js';
import { EventEmitter } from 'eventemitter3';
import { assignWithDefaults, pick, type UUID } from 'utilium';
import { Entity, filterEntities, type EntityJSON } from './entity.js';
import { logger } from './utils.js';

export interface MoveInfo<T> {
	id: string;
	target: T;
}

export interface LevelJSON {
	date: string;
	difficulty: number;
	name: string;
	id: UUID;
	entities: EntityJSON[];
}

const copy = ['difficulty', 'name', 'id'] as const satisfies ReadonlyArray<keyof Level>;

export interface LevelEvents {
	entity_added: [EntityJSON];
	entity_removed: [EntityJSON];
	entity_death: [EntityJSON];
	entity_path_start: [string, IVector3Like[]];
	tick: [];
}

export const levelEventNames = ['entity_added', 'entity_removed', 'entity_death', 'entity_path_start', 'tick'] as const satisfies readonly (keyof LevelEvents)[];

export let loadingOrder: (typeof Entity)[] = [Entity];

export function setLoadingOrder(order: (typeof Entity)[]) {
	loadingOrder = order;
}

export class Level extends EventEmitter<LevelEvents> {
	public id: UUID = crypto.randomUUID();
	public name: string = '';
	public date = new Date();
	public difficulty = 1;
	public entities: Set<Entity> = new Set();
	private _performanceMonitor = new PerformanceMonitor(60);

	public getEntityByID<N extends Entity = Entity>(id: UUID): N {
		for (const entity of this.entities) {
			if (entity.id == id) return entity as N;
		}

		throw new ReferenceError('Entity does not exist');
	}

	public *selectEntities(selector: string): Iterable<Entity> {
		yield* filterEntities(this.entities, selector);
	}

	public entity<T extends Entity = Entity>(selector: string): T {
		return this.selectEntities(selector)[Symbol.iterator]().next().value as T;
	}

	// events and ticking
	public get tps(): number {
		return this._performanceMonitor.averageFPS;
	}

	public async tick() {
		this._performanceMonitor.sampleFrame();
		this.emit('tick');

		for (const entity of this.entities) {
			await entity.tick();
		}
	}

	public toJSON(): LevelJSON {
		const entities: EntityJSON[] = [...this.entities].map(e => e.toJSON());
		const order = loadingOrder.map(entity => entity.name).toReversed();
		/**
		 * Note: Sorted to make sure entities are saved in the correct order
		 * This prevents `level.getEntityByID(...)` from returning null
		 * Which in turn prevents `.owner = .parent = this` from throwing an error
		 */
		entities.sort((a, b) => (order.indexOf(a.type) < order.indexOf(b.type) ? -1 : 1));

		return {
			...pick(this, copy),
			date: new Date().toJSON(),
			entities,
		};
	}

	public async load(json: LevelJSON): Promise<void> {
		assignWithDefaults(this as Level, pick(json, copy));
		this.date = new Date(json.date);

		logger.info(`Loading ${json.entities.length} entities`);
		const priorities = loadingOrder.map(type => type.name);
		json.entities.sort((a, b) => (priorities.indexOf(a.type) > priorities.indexOf(b.type) ? 1 : -1));
		for (const data of json.entities) {
			if (!priorities.includes(data.type)) {
				logger.debug(`Loading ${data.type} ${data.id} (skipped)`);
				continue;
			}

			logger.debug(`Loading ${data.type} ${data.id}`);
			const Ctor = loadingOrder[priorities.indexOf(data.type)];
			const entity = new Ctor(data.id, this);
			await entity.load(data);
		}
	}

	public static async FromJSON(this: new () => Level, json: LevelJSON): Promise<Level> {
		const level = new this();
		await level.load(json);
		return level;
	}
}
