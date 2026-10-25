import {SiteClient} from './site-api.mjs';
import {YqkClient} from './yqk-api.mjs';
import {DylsClient} from './dyls-api.mjs';

// Each client owns its device identity, configuration and source-local caches.
export function createSourceClient(site,transport,storage=globalThis.localStorage){
 if(site.provider==='yqk')return new YqkClient(site,transport,storage);
 if(site.provider==='dyls')return new DylsClient(site,transport,storage);
 return new SiteClient(site,transport,storage);
}
