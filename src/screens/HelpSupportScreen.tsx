import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { borderRadius, colors, shadows, spacing, typography } from '../theme';

type FAQItem = {
  id: string;
  question: string;
  answer: string;
  category: string;
};

type ContactOption = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  action: () => void;
};

export default function HelpSupportScreen() {
  const navigation = useNavigation();
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const faqData: FAQItem[] = [
    {
      id: '1',
      question: 'How do I post an item for delivery?',
      answer: 'To post an item, go to your dashboard and tap "Post Item". Fill in the item details, pickup and delivery locations, and set your preferred delivery date. Once posted, travelers can see and accept your delivery request.',
      category: 'Getting Started',
    },
    {
      id: '2',
      question: 'How do I become a traveler and earn money?',
      answer: 'Switch your account type to "Traveler" in your profile settings. Then post your travel plans by tapping "Post Trip" on your dashboard. You can accept delivery requests that match your route and earn money for each successful delivery.',
      category: 'Getting Started',
    },
    {
      id: '3',
      question: 'How is my trust score calculated?',
      answer: 'Your trust score is based on account verification (email, phone, ID), completed deliveries, user ratings, and account age. Verify your account and complete deliveries successfully to improve your score.',
      category: 'Trust & Safety',
    },
    {
      id: '4',
      question: 'What if my item gets lost or damaged?',
      answer: 'BagMe provides protection for items up to $500. Report any issues immediately through the app. We will investigate and provide compensation according to our terms of service.',
      category: 'Trust & Safety',
    },
    {
      id: '5',
      question: 'How do payments work?',
      answer: 'Payments are processed securely through the app. Senders pay when posting items, and travelers receive payment after successful delivery confirmation. Funds are held securely until delivery is complete.',
      category: 'Payments',
    },
    {
      id: '6',
      question: 'Can I cancel a delivery request?',
      answer: 'Yes, you can cancel before a traveler accepts your request. If already accepted, cancellation may incur fees. Contact the traveler through the app to discuss any changes.',
      category: 'Deliveries',
    },
    {
      id: '7',
      question: 'How do I track my delivery?',
      answer: 'Once your item is accepted, you can track its progress in the "My Items" section. You will receive notifications at key milestones: pickup, in transit, and delivered.',
      category: 'Deliveries',
    },
    {
      id: '8',
      question: 'What items are not allowed?',
      answer: 'Prohibited items include: illegal substances, weapons, hazardous materials, perishable food, fragile items without proper packaging, and items over 50 lbs. Check our full terms for complete list.',
      category: 'Policies',
    },
  ];

  const contactOptions: ContactOption[] = [
    {
      id: 'email',
      title: 'Email Support',
      subtitle: 'Get help via email (24-48 hour response)',
      icon: 'mail-outline',
      action: () => {
        Linking.openURL('mailto:support@bagme.app?subject=BagMe Support Request');
      },
    },
    {
      id: 'chat',
      title: 'Live Chat',
      subtitle: 'Chat with our support team (Mon-Fri 9AM-6PM)',
      icon: 'chatbubble-outline',
      action: () => {
        Alert.alert(
          'Live Chat',
          'Live chat feature is coming soon! For immediate assistance, please email us at support@bagme.app'
        );
      },
    },
    {
      id: 'phone',
      title: 'Phone Support',
      subtitle: 'Call us for urgent issues',
      icon: 'call-outline',
      action: () => {
        Alert.alert(
          'Phone Support',
          'Phone support is available for urgent issues. Please email us first at support@bagme.app and we will provide a callback number.'
        );
      },
    },
    {
      id: 'community',
      title: 'Community Forum',
      subtitle: 'Connect with other users',
      icon: 'people-outline',
      action: () => {
        Alert.alert(
          'Community Forum',
          'Our community forum is coming soon! Join other BagMe users to share tips and experiences.'
        );
      },
    },
  ];

  const categories = [...new Set(faqData.map(item => item.category))];

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const renderFAQItem = (item: FAQItem) => {
    const isExpanded = expandedFAQ === item.id;
    
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.faqItem}
        onPress={() => toggleFAQ(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.faqHeader}>
          <Text style={styles.faqQuestion}>{item.question}</Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.text.secondary}
          />
        </View>
        {isExpanded && (
          <View style={styles.faqAnswer}>
            <Text style={styles.faqAnswerText}>{item.answer}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderContactOption = (option: ContactOption) => {
    return (
      <TouchableOpacity
        key={option.id}
        style={styles.contactOption}
        onPress={option.action}
        activeOpacity={0.7}
      >
        <View style={styles.contactIcon}>
          <Ionicons name={option.icon} size={24} color={colors.primary} />
        </View>
        <View style={styles.contactContent}>
          <Text style={styles.contactTitle}>{option.title}</Text>
          <Text style={styles.contactSubtitle}>{option.subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Get Help</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => {
              Alert.alert(
                'Report Issue',
                'Please email us at support@bagme.app with details about the issue you are experiencing.'
              );
            }}
          >
            <Ionicons name="warning-outline" size={24} color={colors.primary} />
            <Text style={styles.quickActionText}>Report Issue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => {
              Alert.alert(
                'Track Delivery',
                'You can track your deliveries in the "My Items" section of your dashboard.'
              );
            }}
          >
            <Ionicons name="location-outline" size={24} color={colors.primary} />
            <Text style={styles.quickActionText}>Track Delivery</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => {
              Alert.alert(
                'Account Help',
                'For account-related issues, please visit your Profile settings or contact support.'
              );
            }}
          >
            <Ionicons name="person-outline" size={24} color={colors.primary} />
            <Text style={styles.quickActionText}>Account Help</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contact Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Support</Text>
        <View style={styles.sectionContent}>
          {contactOptions.map(renderContactOption)}
        </View>
      </View>

      {/* FAQ Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {categories.map((category) => (
          <View key={category} style={styles.faqCategory}>
            <Text style={styles.categoryTitle}>{category}</Text>
            <View style={styles.sectionContent}>
              {faqData
                .filter(item => item.category === category)
                .map(renderFAQItem)}
            </View>
          </View>
        ))}
      </View>

      {/* Additional Resources */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Resources</Text>
        <View style={styles.sectionContent}>
          <TouchableOpacity
            style={styles.resourceItem}
            onPress={() => {
              Alert.alert(
                'User Guide',
                'A comprehensive user guide is coming soon! For now, explore the app or contact support for guidance.'
              );
            }}
          >
            <Ionicons name="book-outline" size={24} color={colors.primary} />
            <View style={styles.resourceContent}>
              <Text style={styles.resourceTitle}>User Guide</Text>
              <Text style={styles.resourceSubtitle}>Complete guide to using BagMe</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.resourceItem}
            onPress={() => {
              Alert.alert(
                'Safety Tips',
                'Always verify traveler identity, use in-app messaging, meet in public places, and report suspicious activity.'
              );
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
            <View style={styles.resourceContent}>
              <Text style={styles.resourceTitle}>Safety Tips</Text>
              <Text style={styles.resourceSubtitle}>Stay safe while using BagMe</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.resourceItem}
            onPress={() => {
              Alert.alert(
                'Terms of Service',
                'By using BagMe, you agree to our terms of service. Please use the platform responsibly and respect other users.'
              );
            }}
          >
            <Ionicons name="document-text-outline" size={24} color={colors.primary} />
            <View style={styles.resourceContent}>
              <Text style={styles.resourceTitle}>Terms of Service</Text>
              <Text style={styles.resourceSubtitle}>Read our terms and conditions</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Still need help? Email us at support@bagme.app
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
  },
  sectionContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    ...shadows.small,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: spacing.md,
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flex: 1,
    marginHorizontal: spacing.xs,
    ...shadows.small,
  },
  quickActionText: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    color: colors.text.primary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  contactSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  faqCategory: {
    marginBottom: spacing.md,
  },
  categoryTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  faqQuestion: {
    fontSize: typography.sizes.md,
    fontWeight: '500',
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  faqAnswer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  faqAnswerText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resourceContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  resourceTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  resourceSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    textAlign: 'center',
  },
}); 