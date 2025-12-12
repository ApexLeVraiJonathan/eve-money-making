/**
 * NOTE:
 * The API runtime should not depend on `@eve/eve-esi` directly because that
 * package is published as ESM (`type: module`) and exports TS sources. Jest
 * (CJS) e2e tests for the API will fail to load it.
 *
 * We only need a DI token here, so define it locally.
 */
export const ESI_CLIENT_ADAPTER = Symbol('ESI_CLIENT_ADAPTER');

