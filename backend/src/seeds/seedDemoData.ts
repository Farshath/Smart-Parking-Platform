import '../config/env';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { User, UserRole } from '../models/User';
import { ParkingListing, ParkingType } from '../models/ParkingListing';
import { hashPassword } from '../utils/auth';

interface DemoUserSeed {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phoneNumber: string;
}

interface DemoListingSeed {
  title: string;
  description: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    formattedAddress: string;
  };
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  hourlyRate: number;
  dailyRate: number;
  parkingType: ParkingType;
  operatingHours: {
    open: string;
    close: string;
    is24_7: boolean;
  };
  images: string[];
  totalSlots: number;
  availableSlots: number;
  amenities: string[];
  status: 'active';
}

const DEMO_USERS: DemoUserSeed[] = [
  {
    name: 'Demo Customer',
    email: 'customer.demo@smartparking.com',
    password: 'Customer@123',
    role: 'customer',
    phoneNumber: '+91 98400 11101',
  },
  {
    name: 'Demo Parking Owner',
    email: 'owner.demo@smartparking.com',
    password: 'Owner@123',
    role: 'parking_owner',
    phoneNumber: '+91 98400 22202',
  },
  {
    name: 'Demo Platform Admin',
    email: 'admin.demo@smartparking.com',
    password: 'Admin@123',
    role: 'admin',
    phoneNumber: '+91 98400 33303',
  },
];

const DEMO_LISTINGS: DemoListingSeed[] = [
  {
    title: 'Chennai Central – Metro Plaza Parking',
    description:
      'Multi-level covered parking facility steps away from Puratchi Thalaivar Dr. MGR Central Railway Station and Chennai Metro hub. 24/7 CCTV surveillance and EV fast charging bays available.',
    address: {
      street: '14 Walltax Road, Chennai Central',
      city: 'Chennai',
      state: 'Tamil Nadu',
      zipCode: '600003',
      country: 'India',
      formattedAddress: '14 Walltax Road, Chennai Central, Chennai, Tamil Nadu 600003, India',
    },
    location: {
      type: 'Point',
      coordinates: [80.2755, 13.0827],
    },
    hourlyRate: 40,
    dailyRate: 350,
    parkingType: 'covered',
    operatingHours: {
      open: '00:00',
      close: '23:59',
      is24_7: true,
    },
    images: [],
    totalSlots: 10,
    availableSlots: 10,
    amenities: ['cctv', 'covered', 'ev_charging', 'security_guard'],
    status: 'active',
  },
  {
    title: 'Anna Nagar – Tower Park Bay',
    description:
      'Spacious, well-lit shaded parking lot located near Anna Nagar Tower Park and 2nd Avenue shopping corridor. Ideal for daily commuters, shoppers, and evening visitors.',
    address: {
      street: '28 2nd Avenue, Anna Nagar East',
      city: 'Chennai',
      state: 'Tamil Nadu',
      zipCode: '600102',
      country: 'India',
      formattedAddress: '28 2nd Avenue, Anna Nagar East, Chennai, Tamil Nadu 600102, India',
    },
    location: {
      type: 'Point',
      coordinates: [80.2101, 13.0850],
    },
    hourlyRate: 30,
    dailyRate: 250,
    parkingType: 'open',
    operatingHours: {
      open: '06:00',
      close: '23:00',
      is24_7: false,
    },
    images: [],
    totalSlots: 8,
    availableSlots: 8,
    amenities: ['cctv', 'well_lit', 'security_guard'],
    status: 'active',
  },
  {
    title: 'T. Nagar – Pondy Bazaar Smart Garage',
    description:
      'Secure underground valet-enabled parking garage in the heart of T. Nagar retail district, right off Sir Thyagaraya Road near Pondy Bazaar.',
    address: {
      street: '55 Sir Thyagaraya Road, T. Nagar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      zipCode: '600017',
      country: 'India',
      formattedAddress: '55 Sir Thyagaraya Road, T. Nagar, Chennai, Tamil Nadu 600017, India',
    },
    location: {
      type: 'Point',
      coordinates: [80.2341, 13.0418],
    },
    hourlyRate: 50,
    dailyRate: 450,
    parkingType: 'underground',
    operatingHours: {
      open: '07:00',
      close: '23:30',
      is24_7: false,
    },
    images: [],
    totalSlots: 12,
    availableSlots: 12,
    amenities: ['cctv', 'covered', 'valet', 'security_guard', 'wheelchair_accessible'],
    status: 'active',
  },
];

async function seedDemoData() {
  console.log('===============================================================');
  console.log('   SMART PARKING PLATFORM — IDEMPOTENT DEMO DATA SEED SCRIPT   ');
  console.log('===============================================================');

  const connected = await connectDatabase();
  if (!connected) {
    console.error('❌ Unable to connect to MongoDB Atlas. Check MONGODB_URI and Network Access.');
    process.exit(1);
  }

  try {
    let ownerId = null;

    // 1. Seed Demo Users safely (never duplicates, never overwrites existing passwords)
    console.log('\n[Step 1] Seeding demonstration user accounts...');
    for (const demoUser of DEMO_USERS) {
      const normalizedEmail = demoUser.email.toLowerCase();
      let existing = await User.findOne({ email: normalizedEmail });

      if (existing) {
        console.log(`  • Existing user preserved (no overwrite): ${existing.email} [${existing.role}]`);
      } else {
        const passwordHash = await hashPassword(demoUser.password);
        existing = new User({
          name: demoUser.name,
          email: normalizedEmail,
          passwordHash,
          role: demoUser.role,
          phoneNumber: demoUser.phoneNumber,
        });
        await existing.save();
        console.log(`  ✓ Created demo user: ${existing.email} [${existing.role}] (ID: ${existing._id})`);
      }

      if (existing.role === 'parking_owner') {
        ownerId = existing._id;
      }
    }

    if (!ownerId) {
      throw new Error('Demo parking owner account could not be resolved.');
    }

    // 2. Seed Demo Parking Listings owned by Demo Parking Owner
    console.log('\n[Step 2] Seeding demonstration parking listings...');
    for (const listingData of DEMO_LISTINGS) {
      const existingListing = await ParkingListing.findOne({
        ownerId,
        title: listingData.title,
      });

      if (existingListing) {
        console.log(
          `  • Existing listing preserved: "${existingListing.title}" (₹${existingListing.hourlyRate}/hr, ${existingListing.availableSlots}/${existingListing.totalSlots} slots)`
        );
      } else {
        const createdListing = new ParkingListing({
          ...listingData,
          ownerId,
        });
        await createdListing.save();
        console.log(
          `  ✓ Created listing: "${createdListing.title}" (₹${createdListing.hourlyRate}/hr, ${createdListing.availableSlots} slots free, ID: ${createdListing._id})`
        );
      }
    }

    console.log('\n===============================================================');
    console.log('   DEMO SEEDING COMPLETED SUCCESSFULLY!');
    console.log('===============================================================');
  } catch (error) {
    console.error('\n❌ Demo seed error:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

seedDemoData();

