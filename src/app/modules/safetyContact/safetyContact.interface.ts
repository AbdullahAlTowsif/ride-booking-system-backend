export interface ISafetyContact {
  name: string;
  phone: string;
  email?: string;
}

export interface IRiderSafety {
  riderId: string;
  contacts: ISafetyContact[];
}
