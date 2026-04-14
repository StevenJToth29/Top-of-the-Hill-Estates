-- Seed file: 3 properties + 10 rooms each = 30 rooms total

-- ============================================================
-- PROPERTIES
-- ============================================================
INSERT INTO properties (id, name, address, city, state, description) VALUES
(
  'a1000000-0000-0000-0000-000000000001',
  'Northridge',
  '1234 Northridge Dr',
  'Mesa',
  'AZ',
  'A quiet residential property in north Mesa with easy freeway access and a peaceful neighborhood atmosphere.'
),
(
  'a2000000-0000-0000-0000-000000000002',
  'Linden',
  '5678 Linden Ave',
  'Tempe',
  'AZ',
  'A modern property steps from the Tempe light rail, with proximity to ASU, dining, and entertainment.'
),
(
  'a3000000-0000-0000-0000-000000000003',
  'Mesa Downtown',
  '910 W Main St',
  'Mesa',
  'AZ',
  'Centrally located in downtown Mesa with walkable access to shops, restaurants, and the arts district.'
);

-- ============================================================
-- NORTHRIDGE ROOMS (property 1)
-- ============================================================
INSERT INTO rooms (
  id, property_id, name, slug, short_description, description,
  guest_capacity, bedrooms, bathrooms,
  nightly_rate, monthly_rate,
  minimum_nights_short_term, minimum_nights_long_term,
  amenities, house_rules, is_active
) VALUES

('b1010000-0000-0000-0000-000000000001',
 'a1000000-0000-0000-0000-000000000001',
 'Northridge Room 1', 'northridge-room-1',
 'Cozy private room with queen bed, great natural light.',
 'A spacious private room featuring a queen bed, blackout curtains, and large windows. Shared bathroom with one other guest.',
 1, 1, 0.5, 65, 1050, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access', 'Laundry'],
 'No smoking. No pets. Quiet hours 10pm–8am. Keep shared areas clean.', true),

('b1020000-0000-0000-0000-000000000001',
 'a1000000-0000-0000-0000-000000000001',
 'Northridge Room 2', 'northridge-room-2',
 'Bright corner room with twin beds, perfect for solo travelers.',
 'A bright corner room with two twin beds and an ergonomic workspace. Shares a bathroom with one neighboring room.',
 2, 1, 0.5, 70, 1100, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access'],
 'No smoking. No pets. Quiet hours 10pm–8am. Keep shared areas clean.', true),

('b1030000-0000-0000-0000-000000000001',
 'a1000000-0000-0000-0000-000000000001',
 'Northridge Room 3', 'northridge-room-3',
 'Private room with en-suite bathroom and king bed.',
 'Premium private room featuring a king bed, private en-suite bathroom, and a small sitting area with armchair.',
 2, 1, 1.0, 95, 1650, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access', 'Laundry', 'Private Bathroom'],
 'No smoking. No pets. Quiet hours 10pm–8am.', true),

('b1040000-0000-0000-0000-000000000001',
 'a1000000-0000-0000-0000-000000000001',
 'Northridge Room 4', 'northridge-room-4',
 'Affordable standard room, ideal for extended stays.',
 'A comfortable standard room with a full bed and plenty of closet space. Great for longer stays.',
 1, 1, 0.5, 55, 950, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access'],
 'No smoking. No pets. Quiet hours 10pm–8am.', true),

('b1050000-0000-0000-0000-000000000001',
 'a1000000-0000-0000-0000-000000000001',
 'Northridge Room 5', 'northridge-room-5',
 'Spacious room with full bed and private mini-fridge.',
 'A well-appointed room with a full bed, mini-fridge, microwave, and large closet. Ideal for self-sufficient guests.',
 1, 1, 0.5, 75, 1200, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access', 'Mini Fridge', 'Microwave'],
 'No smoking. No pets. Quiet hours 10pm–8am.', true),

('b1060000-0000-0000-0000-000000000001',
 'a1000000-0000-0000-0000-000000000001',
 'Northridge Room 6', 'northridge-room-6',
 'Garden-view room with twin bed, peaceful and quiet.',
 'A serene garden-view room with a twin bed, soft lighting, and a view of the backyard garden.',
 1, 1, 0.5, 60, 975, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access'],
 'No smoking. No pets. Quiet hours 10pm–8am.', true),

('b1070000-0000-0000-0000-000000000001',
 'a1000000-0000-0000-0000-000000000001',
 'Northridge Room 7', 'northridge-room-7',
 'Large double room with two full beds, great for two guests.',
 'Generously sized room with two full beds, suitable for two guests traveling together or extended stays.',
 2, 1, 1.0, 85, 1400, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access', 'Laundry'],
 'No smoking. No pets. Quiet hours 10pm–8am.', true),

('b1080000-0000-0000-0000-000000000001',
 'a1000000-0000-0000-0000-000000000001',
 'Northridge Room 8', 'northridge-room-8',
 'Budget-friendly single with fast WiFi and desk.',
 'A practical single room with a twin bed, dedicated work desk, and high-speed WiFi. Perfect for remote workers.',
 1, 1, 0.5, 50, 900, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Desk'],
 'No smoking. No pets. Quiet hours 10pm–8am.', true),

('b1090000-0000-0000-0000-000000000001',
 'a1000000-0000-0000-0000-000000000001',
 'Northridge Room 9', 'northridge-room-9',
 'Premium room with queen bed, smart TV, and private bath.',
 'A premium room with queen bed, 50" smart TV, private bathroom, and a cozy reading nook.',
 2, 1, 1.0, 100, 1700, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access', 'Smart TV', 'Private Bathroom'],
 'No smoking. No pets. Quiet hours 10pm–8am.', true),

('b1100000-0000-0000-0000-000000000001',
 'a1000000-0000-0000-0000-000000000001',
 'Northridge Room 10', 'northridge-room-10',
 'Charming room with full bed and vintage decor.',
 'A charming room with a full bed, vintage-inspired decor, soft ambient lighting, and shared laundry access.',
 1, 1, 0.5, 68, 1075, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access', 'Laundry'],
 'No smoking. No pets. Quiet hours 10pm–8am.', true);

-- ============================================================
-- LINDEN ROOMS (property 2)
-- ============================================================
INSERT INTO rooms (
  id, property_id, name, slug, short_description, description,
  guest_capacity, bedrooms, bathrooms,
  nightly_rate, monthly_rate,
  minimum_nights_short_term, minimum_nights_long_term,
  amenities, house_rules, is_active
) VALUES

('b2010000-0000-0000-0000-000000000002',
 'a2000000-0000-0000-0000-000000000002',
 'Linden Room 1', 'linden-room-1',
 'Modern studio-style room near ASU and Tempe Marketplace.',
 'A modern room with a queen bed, stylish furnishings, and easy walking distance to ASU and Tempe Marketplace.',
 2, 1, 1.0, 90, 1550, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access', 'Laundry', 'Smart TV'],
 'No smoking. No pets. Guests must be 18+. Quiet hours 11pm–8am.', true),

('b2020000-0000-0000-0000-000000000002',
 'a2000000-0000-0000-0000-000000000002',
 'Linden Room 2', 'linden-room-2',
 'Sunny room with twin bed and study area.',
 'A bright and sunny room with a twin bed, dedicated study area, and large windows.',
 1, 1, 0.5, 62, 1000, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Desk'],
 'No smoking. No pets. Quiet hours 11pm–8am.', true),

('b2030000-0000-0000-0000-000000000002',
 'a2000000-0000-0000-0000-000000000002',
 'Linden Room 3', 'linden-room-3',
 'Spacious room with king bed and private bathroom.',
 'A spacious room with a king bed, private bathroom, and ample storage space.',
 2, 1, 1.0, 105, 1800, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access', 'Laundry', 'Private Bathroom'],
 'No smoking. No pets. Quiet hours 11pm–8am.', true),

('b2040000-0000-0000-0000-000000000002',
 'a2000000-0000-0000-0000-000000000002',
 'Linden Room 4', 'linden-room-4',
 'Cozy single room, walking distance to light rail.',
 'A cozy single room with a full bed, perfect for commuters using the Tempe light rail.',
 1, 1, 0.5, 58, 960, 2, 30,
 ARRAY['WiFi', 'AC', 'Laundry'],
 'No smoking. No pets. Quiet hours 11pm–8am.', true),

('b2050000-0000-0000-0000-000000000002',
 'a2000000-0000-0000-0000-000000000002',
 'Linden Room 5', 'linden-room-5',
 'Upgraded room with queen bed, mini kitchen, and smart TV.',
 'An upgraded room with queen bed, mini kitchen setup including microwave and mini-fridge, and smart TV.',
 2, 1, 0.5, 80, 1300, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Mini Fridge', 'Microwave', 'Smart TV'],
 'No smoking. No pets. Quiet hours 11pm–8am.', true),

('b2060000-0000-0000-0000-000000000002',
 'a2000000-0000-0000-0000-000000000002',
 'Linden Room 6', 'linden-room-6',
 'Affordable room with two twin beds and WiFi.',
 'A well-priced room with two twin beds, closet space, and fast WiFi — ideal for extended stays.',
 2, 1, 0.5, 65, 1050, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access'],
 'No smoking. No pets. Quiet hours 11pm–8am.', true),

('b2070000-0000-0000-0000-000000000002',
 'a2000000-0000-0000-0000-000000000002',
 'Linden Room 7', 'linden-room-7',
 'Quiet back room with full bed and garden view.',
 'A quiet room at the back of the property with a full bed, peaceful garden view, and blackout curtains.',
 1, 1, 0.5, 67, 1080, 2, 30,
 ARRAY['WiFi', 'AC', 'Kitchen Access'],
 'No smoking. No pets. Quiet hours 11pm–8am.', true),

('b2080000-0000-0000-0000-000000000002',
 'a2000000-0000-0000-0000-000000000002',
 'Linden Room 8', 'linden-room-8',
 'Premium room near campus with en-suite bath and desk.',
 'A premium room designed for students and professionals with queen bed, en-suite bathroom, and dedicated desk.',
 1, 1, 1.0, 98, 1680, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access', 'Private Bathroom', 'Desk'],
 'No smoking. No pets. Quiet hours 11pm–8am.', true),

('b2090000-0000-0000-0000-000000000002',
 'a2000000-0000-0000-0000-000000000002',
 'Linden Room 9', 'linden-room-9',
 'Stylish room with double bed and modern furnishings.',
 'A stylishly furnished room with a double bed, modern art prints, and USB charging stations throughout.',
 2, 1, 0.5, 75, 1200, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access', 'Laundry'],
 'No smoking. No pets. Quiet hours 11pm–8am.', true),

('b2100000-0000-0000-0000-000000000002',
 'a2000000-0000-0000-0000-000000000002',
 'Linden Room 10', 'linden-room-10',
 'Value room with twin bed, great for short stays.',
 'A no-frills value room with a twin bed, plenty of natural light, and access to shared kitchen and laundry.',
 1, 1, 0.5, 52, 915, 2, 30,
 ARRAY['WiFi', 'AC', 'Kitchen Access', 'Laundry'],
 'No smoking. No pets. Quiet hours 11pm–8am.', true);

-- ============================================================
-- MESA DOWNTOWN ROOMS (property 3)
-- ============================================================
INSERT INTO rooms (
  id, property_id, name, slug, short_description, description,
  guest_capacity, bedrooms, bathrooms,
  nightly_rate, monthly_rate,
  minimum_nights_short_term, minimum_nights_long_term,
  amenities, house_rules, is_active
) VALUES

('b3010000-0000-0000-0000-000000000003',
 'a3000000-0000-0000-0000-000000000003',
 'Mesa Downtown Room 1', 'mesa-downtown-room-1',
 'Urban chic room near arts district, queen bed.',
 'An urban chic room in the heart of Mesa with a queen bed, exposed brick accents, and walkable arts district access.',
 2, 1, 1.0, 88, 1500, 2, 30,
 ARRAY['WiFi', 'AC', 'Kitchen Access', 'Laundry', 'Smart TV'],
 'No smoking. No pets. Quiet hours 10pm–7am. No parties or events.', true),

('b3020000-0000-0000-0000-000000000003',
 'a3000000-0000-0000-0000-000000000003',
 'Mesa Downtown Room 2', 'mesa-downtown-room-2',
 'Minimalist room with full bed and high ceilings.',
 'A minimalist room with clean lines, a full bed, high ceilings, and polished concrete floors.',
 1, 1, 0.5, 70, 1100, 2, 30,
 ARRAY['WiFi', 'AC', 'Kitchen Access'],
 'No smoking. No pets. Quiet hours 10pm–7am.', true),

('b3030000-0000-0000-0000-000000000003',
 'a3000000-0000-0000-0000-000000000003',
 'Mesa Downtown Room 3', 'mesa-downtown-room-3',
 'Spacious room with two twin beds and private bath.',
 'A spacious room with two twin beds, private bathroom, and proximity to the Mesa Arts Center.',
 2, 1, 1.0, 92, 1575, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access', 'Private Bathroom'],
 'No smoking. No pets. Quiet hours 10pm–7am.', true),

('b3040000-0000-0000-0000-000000000003',
 'a3000000-0000-0000-0000-000000000003',
 'Mesa Downtown Room 4', 'mesa-downtown-room-4',
 'Compact single with twin bed, ideal for solo travelers.',
 'A compact, well-designed single room with a twin bed, in-room safe, and shared bathroom.',
 1, 1, 0.5, 53, 920, 2, 30,
 ARRAY['WiFi', 'AC', 'Kitchen Access'],
 'No smoking. No pets. Quiet hours 10pm–7am.', true),

('b3050000-0000-0000-0000-000000000003',
 'a3000000-0000-0000-0000-000000000003',
 'Mesa Downtown Room 5', 'mesa-downtown-room-5',
 'Stylish room with queen bed and vintage-modern mix.',
 'A stylish room blending vintage and modern elements — queen bed, velvet accent chair, and warm Edison lighting.',
 2, 1, 0.5, 78, 1250, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access', 'Laundry'],
 'No smoking. No pets. Quiet hours 10pm–7am.', true),

('b3060000-0000-0000-0000-000000000003',
 'a3000000-0000-0000-0000-000000000003',
 'Mesa Downtown Room 6', 'mesa-downtown-room-6',
 'Bright room with full bed, close to dining and shopping.',
 'A bright, well-ventilated room steps from downtown Mesa restaurants, shops, and the light rail station.',
 1, 1, 0.5, 63, 1020, 2, 30,
 ARRAY['WiFi', 'AC', 'Kitchen Access'],
 'No smoking. No pets. Quiet hours 10pm–7am.', true),

('b3070000-0000-0000-0000-000000000003',
 'a3000000-0000-0000-0000-000000000003',
 'Mesa Downtown Room 7', 'mesa-downtown-room-7',
 'Premium suite-style room with king bed and lounge area.',
 'A premium suite-style room featuring a king bed, private lounge area with sofa, and en-suite bathroom.',
 3, 1, 1.0, 120, 2200, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Kitchen Access', 'Laundry', 'Smart TV', 'Private Bathroom'],
 'No smoking. No pets. Quiet hours 10pm–7am. No parties.', true),

('b3080000-0000-0000-0000-000000000003',
 'a3000000-0000-0000-0000-000000000003',
 'Mesa Downtown Room 8', 'mesa-downtown-room-8',
 'Quiet room with full bed and blackout curtains.',
 'A quiet interior room with a full bed, heavy blackout curtains, and white noise machine for deep sleepers.',
 1, 1, 0.5, 60, 975, 2, 30,
 ARRAY['WiFi', 'AC', 'Kitchen Access', 'Laundry'],
 'No smoking. No pets. Quiet hours 10pm–7am.', true),

('b3090000-0000-0000-0000-000000000003',
 'a3000000-0000-0000-0000-000000000003',
 'Mesa Downtown Room 9', 'mesa-downtown-room-9',
 'Modern room with queen bed, work desk, and fast WiFi.',
 'A modern productivity-focused room with queen bed, spacious work desk, monitor stand, and gigabit WiFi.',
 1, 1, 0.5, 72, 1150, 2, 30,
 ARRAY['WiFi', 'AC', 'Parking', 'Desk', 'Kitchen Access'],
 'No smoking. No pets. Quiet hours 10pm–7am.', true),

('b3100000-0000-0000-0000-000000000003',
 'a3000000-0000-0000-0000-000000000003',
 'Mesa Downtown Room 10', 'mesa-downtown-room-10',
 'Affordable double room with two twin beds and WiFi.',
 'An affordable and spacious double room with two twin beds, great natural light, and shared kitchen access.',
 2, 1, 0.5, 56, 940, 2, 30,
 ARRAY['WiFi', 'AC', 'Kitchen Access', 'Laundry'],
 'No smoking. No pets. Quiet hours 10pm–7am.', true);
