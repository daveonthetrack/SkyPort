import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, typography, borderRadius, spacing } from '../theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export const Button = ({
  onPress,
  title,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) => {
  const getButtonStyles = (): ViewStyle[] => {
    const styles: ViewStyle[] = [baseStyles.button];

    // Add size styles
    switch (size) {
      case 'small':
        styles.push(baseStyles.buttonSmall);
        break;
      case 'large':
        styles.push(baseStyles.buttonLarge);
        break;
    }

    // Add variant styles
    switch (variant) {
      case 'secondary':
        styles.push(baseStyles.buttonSecondary);
        break;
      case 'outline':
        styles.push(baseStyles.buttonOutline);
        break;
      case 'ghost':
        styles.push(baseStyles.buttonGhost);
        break;
      default:
        styles.push(baseStyles.buttonPrimary);
    }

    // Add disabled styles
    if (disabled || loading) {
      styles.push(baseStyles.buttonDisabled);
    }

    // Add full width style
    if (fullWidth) {
      styles.push(baseStyles.buttonFullWidth);
    }

    return styles;
  };

  const getTextStyles = (): TextStyle[] => {
    const styles: TextStyle[] = [baseStyles.text];

    // Add size styles
    switch (size) {
      case 'small':
        styles.push(baseStyles.textSmall);
        break;
      case 'large':
        styles.push(baseStyles.textLarge);
        break;
    }

    // Add variant styles
    switch (variant) {
      case 'outline':
        styles.push(baseStyles.textOutline);
        break;
      case 'ghost':
        styles.push(baseStyles.textGhost);
        break;
      default:
        styles.push(baseStyles.textPrimary);
    }

    // Add disabled styles
    if (disabled || loading) {
      styles.push(baseStyles.textDisabled);
    }

    return styles;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[...getButtonStyles(), style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} />
      ) : (
        <Text style={[...getTextStyles(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const baseStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonSmall: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonLarge: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.secondary,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonFullWidth: {
    width: '100%',
  },
  text: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  textSmall: {
    fontSize: typography.sizes.sm,
  },
  textLarge: {
    fontSize: typography.sizes.lg,
  },
  textPrimary: {
    color: colors.white,
  },
  textOutline: {
    color: colors.primary,
  },
  textGhost: {
    color: colors.primary,
  },
  textDisabled: {
    opacity: 0.7,
  },
}); 