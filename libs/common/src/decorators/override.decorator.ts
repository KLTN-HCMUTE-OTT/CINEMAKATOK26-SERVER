/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
export const Override = () => {
  return (target: any, __: any, property: PropertyDescriptor) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentTarget = target;
    let parentPropertyDescriptor;
    do {
      if (Object.getPrototypeOf(currentTarget.constructor).name === '') {
        throw new Error('class $ {currentTarget.constructor.name} does not have a parent class');
      }
      parentPropertyDescriptor = Object.getOwnPropertyDescriptor(
        currentTarget,
        property.value.name,
      );
    } while (!parentPropertyDescriptor);

    const metadataKeys = Reflect.getOwnMetadataKeys(parentPropertyDescriptor.value);

    metadataKeys.forEach(mkey => {
      const parentMetadata = Reflect.getMetadata(mkey, parentPropertyDescriptor.value);
      Reflect.defineMetadata(mkey, parentMetadata, property.value);
    });
  };
};
