import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProductWithDetails } from '../types';
import { StockBadge } from './StockBadge';
import { MoneyText } from './MoneyText';
import { resolveImageUri } from '../services/image.service';
import { FramedProductImage } from './FramedProductImage';
import { readImageFrame } from '../utils/imageFrame';

interface ProductCardProps {
  product: ProductWithDetails;
  onPress: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onPress }) => {
  const primaryVariant = product.variants[0];
  const firstImageRelPath = product.images[0]?.relative_path;
  const imageUri = resolveImageUri(firstImageRelPath);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.imageContainer}>
        {imageUri ? (
          <FramedProductImage uri={imageUri} frame={readImageFrame(product.images[0]?.frame_json)} style={styles.image} />
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="image-outline" size={28} color="#94A3B8" />
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>
            {product.name}
          </Text>
          <MoneyText amountMinor={product.primary_price_minor} style={styles.price} />
        </View>

        <View style={styles.metaRow}>
          {product.category_name && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText} numberOfLines={1}>
                {product.category_name}
              </Text>
            </View>
          )}
          {product.brand && (
            <Text style={styles.brandText} numberOfLines={1}>
              {product.brand}
            </Text>
          )}
        </View>

        <View style={styles.footerRow}>
          <StockBadge
            quantity={product.total_stock}
            lowStockThreshold={primaryVariant?.low_stock_threshold}
            unitLabel={primaryVariant?.unit_label ?? 'units'}
          />
          {product.has_multiple_variants && (
            <Text style={styles.variantsNotice}>
              {product.variants.length} variants
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  imageContainer: {
    width: 68,
    height: 68,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginRight: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  categoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  brandText: {
    fontSize: 12,
    color: '#64748B',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  variantsNotice: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
});
