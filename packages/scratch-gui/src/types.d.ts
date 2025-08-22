declare module '!arraybuffer-loader!.*' {
  declare const value: ArrayBuffer;
  export default value;
}

declare module '!raw-loader!.*' {
  declare const value: string;
  export default value;
}

declare module '@scratch/scratch-vm' {
  class VirtualMachine {
    constructor();
    attachStorage(storage: any): void;
    // Add other methods as needed
  }
  
  export const ArgumentType: any;
  export const BlockType: any;
  
  export default VirtualMachine;
}
