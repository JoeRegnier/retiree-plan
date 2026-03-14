type DesktopProfile = { id: string; label?: string; path: string; createdAt: string; lastUsedAt?: string };

declare global {
  interface Window {
    electron?: {
      platform: string;
      desktop: {
        getDataInfo: () => Promise<{ dataDir: string | null; dbFile: string | null; profiles: DesktopProfile[] }>;
        openDataFolder: () => Promise<{ success: boolean }>;
        changeDataLocation: () => Promise<{ success: boolean; dataDir?: string | null }>;
        listProfiles: () => Promise<{ profiles: DesktopProfile[] }>;
        switchProfile: (p: string) => Promise<{ success: boolean }>;
        createFreshProfile: () => Promise<{ success: boolean; dataDir?: string | null }>;
      };
    };
  }
}

export {};
