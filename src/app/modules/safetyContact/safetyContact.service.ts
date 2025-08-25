import { SafetyContact } from "./safetyContact.model";
import { ISafetyContact } from "./safetyContact.interface";
import AppError from "../../errorHelpers/AppError";
import httpStatus from "http-status-codes";

const getContacts = async (riderId: string) => {
//   console.log('Searching for riderId:', riderId);
  
  try {
    const docs = await SafetyContact.find({ riderId: riderId });
    // console.log("Found documents:", docs);
    
    return docs;
  } catch (error) {
    throw new AppError(httpStatus.NOT_FOUND, `Data not found, ${error}`);
  }
}

const saveContacts = async (riderId: string, contacts: ISafetyContact[]) => {
  // Check if document exists
  let safetyDoc = await SafetyContact.findOne({ riderId });

  if (!safetyDoc) {
    safetyDoc = await SafetyContact.create({ riderId, contacts });
  } else {
    safetyDoc.contacts = contacts;
    await safetyDoc.save();
  }

  return safetyDoc.contacts;
};



export const SafetyContactService = {
  getContacts,
  saveContacts,
};
