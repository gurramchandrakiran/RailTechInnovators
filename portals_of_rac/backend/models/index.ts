// backend/models/index.ts
// Export all Mongoose models from a single entry point

export { default as Passenger, getPassengerModel, IPassenger } from './Passenger';
export { default as TTEUser, ITTEUser } from './TTEUser';
export { default as UpgradeNotification, IUpgradeNotification } from './UpgradeNotification';
