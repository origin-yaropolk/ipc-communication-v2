class ServiceStorage {
    private readonly localInstances: Map<string, unknown> = new Map;
    private readonly remoteInstances: Map<string, unknown> = new Map;

    storeLocal(contracts: string[], instance: unknown) {
        contracts.forEach(contract => {
            this.localInstances.set(contract, instance);
        })
    }

    storeRemote(contracts: string[], instance: unknown) {
        contracts.forEach(contract => {
            this.remoteInstances.set(contract, instance);
        })
    }

    removeLocal(contracts: string[]) {
        contracts.forEach(contract => {
            this.localInstances.delete(contract);
        })
    }

    removeRemote(contracts: string[]) {
        contracts.forEach(contract => {
            this.remoteInstances.delete(contract);
        })
    }
}