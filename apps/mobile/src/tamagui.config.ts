import { config as v3Config } from '@tamagui/config/v3';
import { createTamagui } from 'tamagui';

const config = createTamagui(v3Config);

type AppConfig = typeof config;
declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
