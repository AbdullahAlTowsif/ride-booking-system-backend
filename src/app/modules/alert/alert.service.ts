import AppError from "../../errorHelpers/AppError";

interface Contact {
  name: string;
  phone: string;
  email?: string;
}

interface AlertPayload {
  rideId: string;
  location: { lat: number; lng: number };
  contacts: Contact[];
  message: string;
}

const sendAlerts = async (payload: AlertPayload) => {
  const { contacts, message } = payload;

  if (!contacts?.length) {
    throw new AppError(400, "No contacts provided");
  }

  await Promise.all(
    contacts.map(async (c) => {
      console.log(`Sending alert to ${c.name} (${c.phone}) → ${message}`);
    })
  );

  return { ok: true };
};

export const AlertService = {
  sendAlerts,
};
