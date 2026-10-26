import { DeviceEventEmitter } from 'react-native';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { storeRepository } from '../db/repositories/store.repository';

const labels = {
  home: ['Home', 'Tahanan'], stock: ['Stock', 'Paninda'], sell: ['Sell', 'Benta'], history: ['History', 'Kasaysayan'], more: ['More', 'Iba pa'],
  receive: ['Receive delivery', 'Tumanggap ng paninda'], count: ['Count stock', 'Bilangin ang paninda'], shopping: ['Shopping list', 'Listahan ng bibilhin'],
  credit: ['Utang', 'Utang'], closing: ['Daily closing', 'Pagtatapos ng araw'], batches: ['Batches', 'Mga batch'],
  save: ['Save', 'I-save'], cancel: ['Cancel', 'Kanselahin'], search: ['Search products', 'Maghanap ng paninda'],
  addProduct: ['Add product', 'Magdagdag ng paninda'], newSale: ['New sale', 'Bagong benta'], restock: ['Add stock', 'Dagdagan ang paninda'],
  lowStock: ['Low stock', 'Kaunti na'], expired: ['Expired', 'Paso na'], soon: ['Expiring soon', 'Malapit nang mapaso'],
  attention: ['Needs attention', 'Kailangang asikasuhin'], backup: ['Back up your records', 'I-backup ang mga tala'],
  favorite: ['Favorites', 'Mga paborito'], exactCash: ['Exact cash', 'Eksaktong bayad'], checkout: ['Checkout', 'Bayaran'],
  price: ['Selling price', 'Presyo ng benta'], cost: ['Cost per piece', 'Puhunan bawat piraso'], packSize: ['Pieces per pack / box', 'Piraso bawat pakete / kahon'],
  supplier: ['Supplier (optional)', 'Supplier (opsyonal)'], customer: ['Customer', 'Mamimili'],
  productName: ['Product name', 'Pangalan ng paninda'], startingStock: ['Starting quantity', 'Panimulang dami'],
  details: ['More details', 'Iba pang detalye'], all: ['All', 'Lahat'],
} as const;
const phrases: Record<string, string> = {
  'Save': 'I-save', 'Cancel': 'Kanselahin', 'Refresh': 'I-refresh', 'Add piece': 'Magdagdag ng piraso',
  'Edit price / pack size': 'Baguhin ang presyo / laki ng pakete', 'Batches': 'Mga batch',
  'Pin favorite': 'Idagdag sa paborito', 'Unpin favorite': 'Alisin sa paborito',
  'Save stock count': 'I-save ang bilang', 'Refresh counts': 'I-refresh ang bilang', 'Scan an item': 'I-scan ang paninda',
  'Scan delivery item': 'I-scan ang dumating na paninda', 'Number of packs / boxes': 'Bilang ng pakete / kahon',
  'Pieces received': 'Mga pirasong natanggap', 'Switch to pieces': 'Gumamit ng piraso', 'Remove item': 'Alisin ang paninda',
  'Save quantity': 'I-save ang dami', 'Mark still needed': 'Markahang kailangan pa', 'Mark bought': 'Markahang nabili na',
  'Remove from list': 'Alisin sa listahan', 'Share items still needed': 'Ibahagi ang mga kailangan pa', 'Refresh list': 'I-refresh ang listahan',
  'New customer name': 'Pangalan ng bagong mamimili', 'Add customer': 'Magdagdag ng mamimili',
  'Refresh customers': 'I-refresh ang mga mamimili', 'Select customer': 'Pumili ng mamimili',
  'Record payment': 'Itala ang bayad', 'Payment received (₱)': 'Natanggap na bayad (₱)',
  'Refresh totals': 'I-refresh ang kabuuan', 'Opening cash / float (₱)': 'Panimulang pera (₱)',
  'Cash counted at closing (₱)': 'Nabilang na pera sa pagtatapos (₱)', 'Save closing counts': 'I-save ang panghuling bilang',
  'Record expense / cash outflow': 'Itala ang gastos / perang inilabas', 'Expense description': 'Paglalarawan ng gastos',
  'Amount (₱)': 'Halaga (₱)', 'Save expense': 'I-save ang gastos',
  'Search products': 'Maghanap ng paninda', 'Supplier (optional)': 'Supplier (opsyonal)',
};

export type LabelKey = keyof typeof labels;
type Language = 'en' | 'fil';
const Preferences = createContext({ language: 'en' as Language, setLanguage: async (_value: Language) => {} });

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, setCurrent] = useState<Language>('en');
  useEffect(() => {
    let active = true;
    const load = () => storeRepository.setting('language').then(value => { if (active) setCurrent(value === 'fil' ? 'fil' : 'en'); }).catch(console.error);
    void load();
    const listener = DeviceEventEmitter.addListener('inventory-restored', load);
    return () => { active = false; listener.remove(); };
  }, []);
  const setLanguage = async (value: Language) => { await storeRepository.setSetting('language', value); setCurrent(value); };
  return <Preferences.Provider value={{ language, setLanguage }}>{children}</Preferences.Provider>;
}

export function useLabels() {
  const context = useContext(Preferences);
  return { ...context, translate: (value: string) => context.language === 'fil' ? phrases[value] ?? value : value, t: (key: LabelKey) => labels[key][context.language === 'fil' ? 1 : 0] };
}
