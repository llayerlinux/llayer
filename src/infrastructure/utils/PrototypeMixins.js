export function copyPrototypeDescriptors(targetPrototype, sourcePrototype) {
    const descriptors = Object.getOwnPropertyDescriptors(sourcePrototype);
    delete descriptors.constructor;
    Object.defineProperties(targetPrototype, descriptors);
}
