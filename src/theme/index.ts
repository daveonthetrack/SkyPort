import { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  primary: '#0095F6',
  secondary: '#00A5E0',
  background: '#F8F9FA',
  white: '#FFFFFF',
  black: '#000000',
  text: {
    primary: '#1A1A1A',
    secondary: '#757575',
    light: '#9E9E9E',
  },
  border: '#E0E0E0',
  error: '#DC3545',
  success: '#28A745',
  warning: '#FFC107',
  info: '#17A2B8',
  shadow: 'rgba(0, 0, 0, 0.1)',
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
  }
};

export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 9999,
};

export const shadows = {
  small: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const layout = {
  container: {
    paddingHorizontal: spacing.md,
  },
  maxWidth: 1200,
};

export const authStyles = {
  input: {
    height: 50,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    width: '100%',
    marginBottom: spacing.md,
  } as TextStyle,
  button: {
    height: 50,
    backgroundColor: colors.auth.primary,
    borderRadius: borderRadius.lg,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    width: '100%',
    marginVertical: spacing.md,
  } as ViewStyle,
  buttonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  } as TextStyle,
  secondaryButton: {
    height: 50,
    backgroundColor: 'transparent',
    borderRadius: borderRadius.lg,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.white,
  } as ViewStyle,
  secondaryButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  } as TextStyle,
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.white,
    marginBottom: spacing.lg,
  } as TextStyle,
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.auth.secondaryText,
    marginBottom: spacing.xl,
    textAlign: 'center' as const,
  } as TextStyle,
}; 