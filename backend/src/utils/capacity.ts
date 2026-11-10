import mongoose from 'mongoose';
import { ParkingListing } from '../models/ParkingListing';

/**
 * Atomically decrements `availableSlots` by 1 ONLY when the listing is active
 * and `availableSlots > 0`. Serialized at the document level by WiredTiger so
 * concurrent last-slot reservations cannot oversell or produce negative capacity.
 */
export async function atomicReserveSlot(listingId: mongoose.Types.ObjectId | string) {
  return ParkingListing.findOneAndUpdate(
    {
      _id: listingId,
      status: 'active',
      availableSlots: { $gt: 0 },
    },
    {
      $inc: { availableSlots: -1 },
    },
    {
      new: true,
    }
  );
}

/**
 * Atomically restores 1 slot to `availableSlots`, guarded so `availableSlots`
 * never exceeds `totalSlots`.
 */
export async function atomicReleaseSlot(listingId: mongoose.Types.ObjectId | string) {
  return ParkingListing.findOneAndUpdate(
    {
      _id: listingId,
      $expr: { $lt: ['$availableSlots', '$totalSlots'] },
    },
    {
      $inc: { availableSlots: 1 },
    },
    {
      new: true,
    }
  );
}

