declare module 'virtual:signalsmith-stretch-core' {
  const createModule: (moduleArg?: Record<string, unknown>) => Promise<unknown>;
  export default createModule;
}
