export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  categories: string[];
}

export const onboardingTemplates: OnboardingTemplate[] = [
  {
    id: 'mini_supermarket',
    name: 'Mini Supermarket',
    description: 'General groceries, fresh produce, and household essentials.',
    categories: ['Bakery & Bread', 'Dairy & Eggs', 'Fresh Produce', 'Meat & Poultry', 'Pantry Staples', 'Frozen Foods', 'Beverages', 'Canned Goods', 'Cleaning Supplies']
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    description: 'Medicines, health products, and baby care.',
    categories: ['Prescription Meds', 'OTC Medicines', 'First Aid', 'Vitamins & Supplements', 'Baby Care', 'Oral Care', 'Personal Hygiene']
  },
  {
    id: 'cosmetics',
    name: 'Cosmetics / Personal Care',
    description: 'Beauty, skincare, and fragrances.',
    categories: ['Skincare', 'Haircare', 'Makeup', 'Fragrances', 'Beauty Tools', 'Hand & Nail Care']
  },
  {
    id: 'electronics',
    name: 'Electronics / Accessories',
    description: 'Phones, computers, and tech accessories.',
    categories: ['Mobile Devices', 'Computer Hardware', 'Audio & Headphones', 'Power & Charging', 'Cases & Protection', 'Storage Devices']
  },
  {
    id: 'clothing',
    name: 'Clothing / Footwear',
    description: 'Apparel for all ages and footwear.',
    categories: ['Men\'s Wear', 'Women\'s Wear', 'Kids & Baby', 'Footwear', 'Activewear', 'Accessories & Bags']
  },
  {
    id: 'stationery',
    name: 'Stationery / Office Supplies',
    description: 'Paper, writing tools, and office materials.',
    categories: ['Paper Products', 'Writing Instruments', 'Office Supplies', 'Art Supplies', 'School Essentials', 'Mailing & Shipping']
  },
  {
    id: 'hardware',
    name: 'Hardware / Tools',
    description: 'Building materials, tools, and DIY.',
    categories: ['Hand Tools', 'Power Tools', 'Fasteners', 'Paint & Supplies', 'Plumbing', 'Electrical Components', 'Garden & Outdoor']
  },
  {
    id: 'wholesale',
    name: 'Wholesale / Distributor',
    description: 'Bulk goods and distribution categories.',
    categories: ['Bulk Dry Goods', 'Pallet Items', 'Industrial Supplies', 'Packaging Materials']
  }
];

export const keywordToCategoryMapping: Record<string, string> = {
  'charger': 'Power & Charging',
  'cable': 'Power & Charging',
  'usb': 'Power & Charging',
  'earphone': 'Audio & Headphones',
  'headphone': 'Audio & Headphones',
  'power bank': 'Power & Charging',
  'phone case': 'Cases & Protection',
  'adapter': 'Power & Charging',
  'soap': 'Personal Hygiene',
  'deodorant': 'Personal Hygiene',
  'shampoo': 'Haircare',
  'lotion': 'Skincare',
  'toothpaste': 'Oral Care',
  'snacks': 'Pantry Staples',
  'sweets': 'Pantry Staples',
  'candy': 'Pantry Staples',
  'drinks': 'Beverages',
  'groceries': 'Pantry Staples',
  'mouse': 'Computer Hardware',
  'keyboard': 'Computer Hardware',
  'monitor': 'Computer Hardware',
  'pc': 'Computer Hardware',
  'laptop': 'Computer Hardware',
  'medicine': 'OTC Medicines',
  'pill': 'OTC Medicines',
  'tablet': 'OTC Medicines',
  'syrup': 'OTC Medicines',
  'bandage': 'First Aid',
  'health': 'Vitamins & Supplements',
  'bread': 'Bakery & Bread',
  'milk': 'Dairy & Eggs',
  'fruit': 'Fresh Produce',
  'vegetable': 'Fresh Produce',
  'meat': 'Meat & Poultry',
  'tools': 'Hand Tools',
  'nails': 'Fasteners',
  'screws': 'Fasteners',
  'paint': 'Paint & Supplies',
  'shirt': 'Men\'s Wear',
  'dress': 'Women\'s Wear',
  'shoes': 'Footwear',
  'bag': 'Accessories & Bags',
  'pen': 'Writing Instruments',
  'paper': 'Paper Products',
  'notebook': 'Paper Products'
};
