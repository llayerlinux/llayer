

import * as Domain from '../domain/index.js';

import * as Infrastructure from '../infrastructure/index.js';

import * as Presentation from '../presentation/index.js';

import * as UseCases from '../usecases/index.js';

import { DIContainer } from './di.js';
import { EventBusClass, Events } from './eventBus.js';


export const MODULES = {
    ...Domain,

    ...Infrastructure,

    ...Presentation,

    ...UseCases,

    DIContainer,
    EventBusClass,
    Events
};

export { Domain, Infrastructure, Presentation, UseCases };
