import type { ScimErrorType } from "./http";

export class ScimProtocolError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly scimType?: ScimErrorType,
	) {
		super(message);
		this.name = "ScimProtocolError";
	}
}
