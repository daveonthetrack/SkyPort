import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';

// Define comprehensive theme types
export type ThemeColors = {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  card: string;
  white: string;
  black: string;
  text: {
    primary: string;
    secondary: string;
    light: string;
    inverse: string;
  };
  border: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  shadow: string;
  overlay: string;
  auth: {
    primary: string;
    background: string;
    text: string;
    inputBackground: string;
    inputText: string;
    buttonText: string;
    secondaryText: string;
    gradientStart: string;
    gradientEnd: string;
  };
};

export type Theme = {
  colors: ThemeColors;
  isDark: boolean;
};

// Light theme colors
const lightColors: ThemeColors = {
  primary: '#0095F6',
  secondary: '#00A5E0',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  white: '#FFFFFF',
  black: '#000000',
  text: {
    primary: '#1A1A1A',
    secondary: '#757575',
    light: '#9E9E9E',
    inverse: '#FFFFFF',
  },
  border: '#E0E0E0',
  error: '#DC3545',
  success: '#28A745',
  warning: '#FFC107',
  info: '#17A2B8',
  shadow: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  auth: {
    primary: '#007AFF',
    background: '#0A84FF',
    text: '#FFFFFF',
    inputBackground: '#FFFFFF',
    inputText: '#000000',
    buttonText: '#FFFFFF',
    secondaryText: 'rgba(255, 255, 255, 0.7)',
    gradientStart: '#4F46E5',
    gradientEnd: '#0EA5E9',
  },
};

// Dark theme colors
const darkColors: ThemeColors = {
  primary: '#0A84FF',
  secondary: '#30D158',
  background: '#000000',
  surface: '#1C1C1E',
  card: '#2C2C2E',
  white: '#FFFFFF',
  black: '#000000',
  text: {
    primary: '#FFFFFF',
    secondary: '#AEAEB2',
    light: '#8E8E93',
    inverse: '#000000',
  },
  border: '#38383A',
  error: '#FF453A',
  success: '#30D158',
  warning: '#FFD60A',
  info: '#64D2FF',
  shadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.7)',
  auth: {
    primary: '#0A84FF',
    background: '#1C1C1E',
    text: '#FFFFFF',
    inputBackground: '#2C2C2E',
    inputText: '#FFFFFF',
    buttonText: '#FFFFFF',
    secondaryText: 'rgba(255, 255, 255, 0.6)',
    gradientStart: '#5E5CE6',
    gradientEnd: '#007AFF',
  },
};

const lightTheme: Theme = {
  colors: lightColors,
  isDark: false,
};

const darkTheme: Theme = {
  colors: darkColors,
  isDark: true,
};

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
  systemTheme: ColorSchemeName;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const [systemTheme, setSystemTheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  // Listen to system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme);
    });

    return () => subscription?.remove();
  }, []);

  const theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const setTheme = (dark: boolean) => {
    setIsDark(dark);
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      isDark, 
      toggleTheme, 
      setTheme,
      systemTheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 