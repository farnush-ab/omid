import { darkTheme } from './builtin/dark';
import { lightTheme } from './builtin/light';
import { themeRegistry } from './registry';

/** The single place where built-in themes are registered. */
themeRegistry.register(darkTheme).register(lightTheme);

export const DEFAULT_THEME_ID = darkTheme.id;
