import { contextBridge, ipcRenderer } from 'electron';

// Expose a small desktop API to the renderer. Keep surface area tiny and use
// `ipcRenderer.invoke` for async calls.
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  desktop: {
    getDataInfo: async () => ipcRenderer.invoke('desktop:get-data-info'),
    openDataFolder: async () => ipcRenderer.invoke('desktop:open-data-folder'),
    changeDataLocation: async () => ipcRenderer.invoke('desktop:change-data-location'),
    listProfiles: async () => ipcRenderer.invoke('desktop:list-profiles'),
    switchProfile: async (p: string) => ipcRenderer.invoke('desktop:switch-profile', p),
    createFreshProfile: async () => ipcRenderer.invoke('desktop:create-fresh-profile'),
  },
});
