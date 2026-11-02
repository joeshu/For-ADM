import {SiteClient} from './site-api.mjs';
import {YqkClient} from './yqk-api.mjs';
import {DylsClient} from './dyls-api.mjs';
import {SoujuClient} from './souju-api.mjs';
import {KanjuClient} from './kanju-api.mjs';
import {assertSourceClientContract} from './source-contract.mjs';

// Each client owns its device identity, configuration and source-local caches.
export const sourceAdapterRegistry=Object.freeze({yqk:YqkClient,dyls:DylsClient,souju:SoujuClient,kanju:KanjuClient});

export function createSourceClient(site,transport,storage=globalThis.localStorage){
 if(!site||typeof site.id!=='string'||typeof transport!=='function')throw TypeError('创建片源客户端需要有效站点和网络传输器');
 const Client=site.provider&&Object.prototype.hasOwnProperty.call(sourceAdapterRegistry,site.provider)?sourceAdapterRegistry[site.provider]:site.provider?undefined:SiteClient;
 if(!Client)throw TypeError('未注册的片源适配器：'+String(site.provider));
 return assertSourceClientContract(site,new Client(site,transport,storage));
}
