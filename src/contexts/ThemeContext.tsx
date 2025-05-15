import React, { createContext, useContext, useState } from 'react';

type Theme = {
  primary: string;
  background: string;
  text: string;
  white: string;
  gray: string;
  isDark: boolean;
  colors: {
    primary: string;
    text: string;
    textSecondary: string;
    background: string;
    border: string;
    card: string;
    error: string;
  };
};

const lightTheme: Theme = {
  primary: '#007AFF',
  background: '#FFFFFF',
  text: '#000000',
  white: '#FFFFFF',
  gray: '#8E8E93',
  isDark: false,
  colors: {
    primary: '#007AFF',
    text: '#000000',
    textSecondary: '#8E8E93',
    background: '#FFFFFF',
    border: '#8E8E93',
    card: '#FFFFFF',
    error: '#DC3545',
  },
};

const darkTheme: Theme = {
  primary: '#0A84FF',
  background: '#000000',
  text: '#FFFFFF',
  white: '#FFFFFF',
  gray: '#8E8E93',
  isDark: true,
  colors: {
    primary: '#0A84FF',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    background: '#000000',
    border: '#8E8E93',
    card: '#1F1F1F',
    error: '#FF453A',
  },
};

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
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