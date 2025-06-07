import type { Component } from './component';
import type { Entity } from './entity';

const methodText = {
	setup: 'setting up',
	load: 'loading',
	tick: 'ticking',
	dispose: 'disposing',
	toJSON: 'serializing',
};

export type Method = keyof typeof methodText;

function detectMethod(error: Error & { method?: Method }): void {
	if (error.method) return;

	for (const line of error.stack?.split('\n').slice(1) || []) {
		const method = line.split('(')[0].trim().slice(3)?.split('.').pop();
		if (method && method in methodText) {
			error.method = method as Method;
			return;
		}
	}
}

export class ComponentError extends Error {
	public readonly entity: Entity;
	public readonly method?: Method;

	public constructor(
		public readonly component: Component,
		message: string
	) {
		super(message);
		this.entity = component['entity'];
		this.name = 'ComponentError';
		Error.captureStackTrace(this, ComponentError);
		detectMethod(this);
	}

	public toString(): string {
		return `Error ${this.method ? methodText[this.method] : 'in'} component ${this.component.constructor.name} for ${this.entity.type}: ${this.message}`;
	}
}

export class EntityError extends Error {
	public readonly method?: Method;

	public constructor(
		public readonly entity: Entity,
		message: string
	) {
		super(message);
		this.name = 'EntityError';
		Error.captureStackTrace(this, EntityError);
		detectMethod(this);
	}

	public toString(): string {
		return `Error ${this.method ? methodText[this.method] : 'in'} ${this.entity.type}: ${this.message}`;
	}
}
