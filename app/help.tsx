import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ThemeColors, useThemeStyles } from '../src/theme/ThemeProvider';

const topics = [
  {
    title: 'Add your first product',
    steps: [
      'Open Stock and tap + Add product manually. Enter the product name and selling price in pesos.',
      'Add a category, purchase cost, opening stock, and low stock limit as needed. A photo, SKU, and barcode are optional.',
      'Tap Save Product. Open the product later and use Edit Info to change its details, or Manage under Variants & Stock for different sizes or units.',
    ],
    tip: 'Create categories in More > Categories to keep your shelves organized.',
  },
  {
    title: 'Find products and scan barcodes',
    steps: [
      'In Stock, search by product name, SKU, or barcode. Use the category, Low stock, Expiring soon, or Expired filters to narrow the list.',
      'Use a scan button to read a barcode and allow camera access when asked. You can also enter a barcode manually when adding a product.',
      'Auto-Fill from Web on the Add Product screen needs internet. Review any suggested details and enter your own prices before saving.',
    ],
    tip: 'Adding products, selling, and stock tracking work offline. Online lookup is optional.',
  },
  {
    title: 'Record a sale',
    steps: [
      'Open Sell. Tap products or scan their barcodes to add them to the cart. Choose a variant when prompted.',
      'Tap Checkout to review the cart. Change quantities or remove items, then choose a payment method and enter any discount.',
      'For cash payments, enter Cash Received to see the change due. Check Total Due and tap Confirm Sale.',
    ],
    tip: 'A confirmed sale reduces stock automatically. Use View Receipt to see the completed transaction.',
  },
  {
    title: 'Record stock movements',
    steps: [
      'Go to More > Stock Adjustment, or open a product in Stock and tap Adjust Stock.',
      'Choose the product and variant. Select Restock (+) for deliveries, Damage / Defect (−) for losses, or Return (+) for customer returns.',
      'Enter the quantity being added or removed and select a reason. Tap Commit Stock Adjustment, review the change, then Confirm & Save.',
    ],
    tip: 'Enter the amount of the change, not the final shelf balance. The current Manual Count option also adds the entered quantity to existing stock.',
  },
  {
    title: 'Track expiration dates',
    steps: [
      'Set an optional expiration date when adding a product. Use the YYYY-MM-DD format, for example 2027-06-30.',
      'To update it later, open the product and tap Edit expiration date for the relevant variant, then Save date. Clear the date if it no longer applies.',
      'Use the Expiring soon and Expired filters in Stock to review active variants with stock remaining. Expiring soon includes today and the next 30 days.',
    ],
    tip: 'Each variant has one expiration date. Update it when the stock you are tracking changes.',
  },
  {
    title: 'Review history and reports',
    steps: [
      'Open History to review sales and stock movements. Tap a sale to open its receipt.',
      'If a sale was entered by mistake, open its receipt, tap Void This Sale, enter a reason, and confirm. Voiding returns the sold stock.',
      'Go to More > Sales & Inventory Reports for sales totals, gross profit, inventory valuation, and CSV exports.',
    ],
    tip: 'Enter purchase costs on your products to make gross profit and inventory valuation more useful.',
  },
  {
    title: 'Back up your records',
    steps: [
      'Go to More > Backup & Restore and tap Create & Save Backup. Save a copy outside the app using the sharing options when available.',
      'Create backups regularly. Records are stored on this device, so losing the phone or uninstalling the app can lose your data.',
      'Restore Backup currently uses the most recent backup in the app folder and replaces current records. Save a backup of your current data first.',
    ],
    tip: 'Share Products CSV exports a spreadsheet of your catalog. Use a full backup to preserve sales, stock history, and photos too.',
  },
];

export default function HelpScreen() {
  const { styles } = useThemeStyles(createStyles);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.title}>Your everyday store guide</Text>
        <Text style={styles.subtitle}>Start with a product, record your sales, and keep your stock up to date. You can return to this guide anytime from More & Settings.</Text>
      </View>
      {topics.map((topic, index) => (
        <View key={topic.title} style={styles.card}>
          <Text accessibilityRole="header" style={styles.topicTitle}>{index + 1}. {topic.title}</Text>
          {topic.steps.map((step, stepIndex) => (
            <View key={step} style={styles.step}>
              <Text style={styles.stepNumber}>{stepIndex + 1}.</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          <View style={styles.tip}>
            <Text style={styles.tipText}>{topic.tip}</Text>
          </View>
        </View>
      ))}
      <Text style={styles.footer}>For a comfortable view, choose Use device, Light, or Dark under Appearance in More & Settings.</Text>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 720, alignSelf: 'center' },
  intro: { paddingVertical: 12, marginBottom: 12 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '500', marginBottom: 10 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 7, padding: 16, marginBottom: 16 },
  topicTitle: { color: colors.ink, fontSize: 18, fontWeight: '600', marginBottom: 16 },
  step: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stepNumber: { color: colors.accent, fontSize: 15, lineHeight: 23, minWidth: 18 },
  stepText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 23 },
  tip: { backgroundColor: colors.soft, borderRadius: 6, padding: 12, marginTop: 4 },
  tipText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  footer: { color: colors.muted, fontSize: 14, lineHeight: 21, paddingVertical: 8 },
});
