'use strict';

const CATEGORY_SEED = [
  {
    slug: 'signature',
    name: 'Signature Drinks',
    description: 'House favorites and crowd-pleasing specialty drinks.',
    layout: 'card',
    priceLabels: [],
    requireImage: true,
    allowMultiPrice: false,
    displayOrder: 1
  },
  {
    slug: 'iced-favorites',
    name: 'Iced Favorites',
    description: 'Cold drinks built for an easy afternoon stop.',
    layout: 'card',
    priceLabels: [],
    requireImage: true,
    allowMultiPrice: false,
    displayOrder: 2
  },
  {
    slug: 'hot-coffee',
    name: 'Hot Coffee',
    description: 'Classic espresso drinks and warm comfort pours.',
    layout: 'table',
    priceLabels: ['M', 'L'],
    requireImage: false,
    allowMultiPrice: true,
    displayOrder: 3
  },
  {
    slug: 'iced-coffee',
    name: 'Iced Coffee',
    description: 'Chilled coffee drinks with medium and large pricing.',
    layout: 'table',
    priceLabels: ['M', 'L'],
    requireImage: false,
    allowMultiPrice: true,
    displayOrder: 4
  },
  {
    slug: 'tea-drinks',
    name: 'Tea & Drinks',
    description: 'Tea, herbal drinks, and refreshing cafe staples.',
    layout: 'table',
    priceLabels: ['M', 'L'],
    requireImage: false,
    allowMultiPrice: true,
    displayOrder: 5
  }
];

const ITEM_SEED = [
  { categorySlug: 'signature', name: 'Caramel Matcha', description: 'Earthy matcha balanced with a ribbon of caramel.', priceSingle: 5.95, imageUrl: 'assets/images/menuitems/caramel-matcha.JPG', isFeatured: true, isAvailable: true, displayOrder: 1 },
  { categorySlug: 'signature', name: 'Coconut Cream Latte', description: 'Velvety coconut cream swirled into smooth espresso.', priceSingle: 5.75, imageUrl: 'assets/images/menuitems/coconut-cream-latte.JPG', isFeatured: true, isAvailable: true, displayOrder: 2 },
  { categorySlug: 'signature', name: 'Cotton Candy Latte', description: 'Playful sweetness with a creamy finish.', priceSingle: 5.5, imageUrl: 'assets/images/menuitems/cotton-candy-latte.JPG', isFeatured: true, isAvailable: true, displayOrder: 3 },
  { categorySlug: 'iced-favorites', name: 'Dubai Chocolate Latte', description: 'Chocolate with a warm cardamom finish.', priceSingle: 5.95, imageUrl: 'assets/images/menuitems/dubai-chocolate-latte.JPG', isFeatured: true, isAvailable: true, displayOrder: 1 },
  { categorySlug: 'iced-favorites', name: 'Mango Latte', description: 'Sunny mango notes blended with creamy espresso.', priceSingle: 5.5, imageUrl: 'assets/images/menuitems/mango-latte.JPG', isFeatured: true, isAvailable: true, displayOrder: 2 },
  { categorySlug: 'iced-favorites', name: 'Strawberry Matcha', description: 'Bright strawberry layered with ceremonial matcha.', priceSingle: 5.75, imageUrl: 'assets/images/menuitems/strawberry-matcha.JPG', isFeatured: true, isAvailable: true, displayOrder: 3 },
  { categorySlug: 'hot-coffee', name: 'Espresso', description: 'Medium roast espresso double shot.', priceMedium: 4.0, priceLarge: 4.99, isAvailable: true, displayOrder: 1 },
  { categorySlug: 'hot-coffee', name: 'Cappuccino', description: 'Espresso, steamed milk, and foam.', priceMedium: 4.75, priceLarge: 4.99, isAvailable: true, displayOrder: 2 },
  { categorySlug: 'hot-coffee', name: 'Cafe Mocha', description: 'Espresso, steamed milk, and chocolate syrup.', priceMedium: 4.99, priceLarge: 5.25, isAvailable: true, displayOrder: 3 },
  { categorySlug: 'hot-coffee', name: 'Cafe Latte', description: 'Espresso, steamed milk, and foam.', priceMedium: 4.75, priceLarge: 4.99, isAvailable: true, displayOrder: 4 },
  { categorySlug: 'hot-coffee', name: 'Americano', description: 'Espresso and hot water.', priceMedium: 4.25, isAvailable: true, displayOrder: 5 },
  { categorySlug: 'hot-coffee', name: 'Matcha Latte', description: 'Matcha powder and steamed milk.', priceMedium: 4.75, priceLarge: 4.99, isAvailable: true, displayOrder: 6 },
  { categorySlug: 'hot-coffee', name: 'Chai Latte', description: 'Chai powder and steamed milk.', priceMedium: 4.99, priceLarge: 5.25, isAvailable: true, displayOrder: 7 },
  { categorySlug: 'hot-coffee', name: 'Turmeric Latte', description: 'Turmeric and steamed milk.', priceMedium: 3.95, priceLarge: 4.25, isAvailable: true, displayOrder: 8 },
  { categorySlug: 'hot-coffee', name: 'Drip Coffee', description: 'New Harvest medium roast.', priceMedium: 3.25, priceLarge: 3.75, isAvailable: true, displayOrder: 9 },
  { categorySlug: 'hot-coffee', name: 'Cafe Au Lait', description: 'Coffee and steamed milk.', priceMedium: 3.75, priceLarge: 3.95, isAvailable: true, displayOrder: 10 },
  { categorySlug: 'hot-coffee', name: 'Hot Chocolate', description: 'Chocolate syrup and steamed milk.', priceMedium: 4.5, priceLarge: 4.75, isAvailable: true, displayOrder: 11 },
  { categorySlug: 'hot-coffee', name: 'Dirty Turmeric Latte', description: 'Espresso, turmeric, and steamed milk.', priceMedium: 5.5, priceLarge: 5.95, isAvailable: true, displayOrder: 12 },
  { categorySlug: 'hot-coffee', name: 'Dirty Chai Latte', description: 'Espresso added to a chai latte.', priceMedium: 4.95, priceLarge: 5.25, isAvailable: true, displayOrder: 13 },
  { categorySlug: 'iced-coffee', name: 'Iced Chocolate', description: 'Chocolate powder and milk.', priceMedium: 4.75, priceLarge: 5.25, isAvailable: true, displayOrder: 1 },
  { categorySlug: 'iced-coffee', name: 'Iced Cappuccino', description: 'Espresso, milk, and foam.', priceMedium: 4.75, priceLarge: 4.99, isAvailable: true, displayOrder: 2 },
  { categorySlug: 'iced-coffee', name: 'Iced Mocha', description: 'Espresso, milk, and chocolate syrup.', priceMedium: 4.99, priceLarge: 5.25, isAvailable: true, displayOrder: 3 },
  { categorySlug: 'iced-coffee', name: 'Iced Latte', description: 'Espresso and milk.', priceMedium: 4.75, priceLarge: 4.99, isAvailable: true, displayOrder: 4 },
  { categorySlug: 'iced-coffee', name: 'Iced Americano', description: 'Espresso and cold water.', priceMedium: 4.25, isAvailable: true, displayOrder: 5 },
  { categorySlug: 'iced-coffee', name: 'Iced Matcha', description: 'Matcha powder and milk.', priceMedium: 4.75, priceLarge: 4.99, isAvailable: true, displayOrder: 6 },
  { categorySlug: 'iced-coffee', name: 'Iced Chai Latte', description: 'Chai powder and milk.', priceMedium: 4.99, priceLarge: 5.25, isAvailable: true, displayOrder: 7 },
  { categorySlug: 'iced-coffee', name: 'Iced Coffee', description: 'Cold brew blend.', priceMedium: 3.5, priceLarge: 3.75, isAvailable: true, displayOrder: 8 },
  { categorySlug: 'tea-drinks', name: 'Hot Tea', description: '', priceMedium: 3.5, priceLarge: 3.95, isAvailable: true, displayOrder: 1 },
  { categorySlug: 'tea-drinks', name: 'Herbal Tea / Butterfly Tea', description: '', priceMedium: 3.5, priceLarge: 3.95, isAvailable: true, displayOrder: 2 },
  { categorySlug: 'tea-drinks', name: 'Iced Tea', description: '', priceMedium: 3.5, priceLarge: 3.95, isAvailable: true, displayOrder: 3 },
  { categorySlug: 'tea-drinks', name: 'Herbal Tea / Butterfly Tea (Iced)', description: '', priceMedium: 3.95, priceLarge: 4.5, isAvailable: true, displayOrder: 4 },
  { categorySlug: 'tea-drinks', name: 'Black Lemon Tea', description: '', priceMedium: 3.95, priceLarge: 4.5, isAvailable: true, displayOrder: 5 },
  { categorySlug: 'tea-drinks', name: 'London Fog', description: 'Earl grey tea with vanilla syrup and steamed milk.', priceMedium: 3.95, priceLarge: 4.5, isAvailable: true, displayOrder: 6 },
  { categorySlug: 'tea-drinks', name: 'Arnold Palmer', description: 'Iced black tea and lemonade.', priceMedium: 4.25, priceLarge: 4.75, isAvailable: true, displayOrder: 7 }
];

const FEATURED_SEED = [
  { sourceName: 'Caramel Matcha', headline: 'Signature Pour', subtext: 'Creamy, bright, and one of the most-requested drinks on the menu.', displayOrder: 1 },
  { sourceName: 'Dubai Chocolate Latte', headline: 'Afternoon Favorite', subtext: 'Chocolate-forward with a warm cardamom note and a smooth finish.', displayOrder: 2 },
  { sourceName: 'Mango Latte', headline: 'Seasonal Mood', subtext: 'Fruit-forward espresso with a playful café profile.', displayOrder: 3 }
];

module.exports = {
  CATEGORY_SEED,
  FEATURED_SEED,
  ITEM_SEED
};
